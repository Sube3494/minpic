import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MinioService } from '@/lib/minio';
import { getUserMinioConfig } from '@/lib/get-user-minio-config';
import { requireAuth } from '@/lib/auth-utils';


export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const collection = await prisma.collection.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            file: {
              select: {
                filename: true,
                fileType: true,
                mimeType: true,
                minioPath: true,
                thumbnailPath: true,
                width: true,
                height: true,
                duration: true,
                configId: true,
                updatedAt: true,
              },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!collection) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      );
    }

    // Check expiration
    if (collection.expiresAt && new Date(collection.expiresAt) < new Date()) {
        return NextResponse.json(
            { error: 'Collection expired' },
            { status: 404 } 
        );
    }

    // Get user's MinIO config
    const minioConfig = await getUserMinioConfig(
      collection.userId,
      collection.items[0]?.file.configId
    );

    if (!minioConfig) {
      return NextResponse.json(
        { error: 'MinIO config not found' },
        { status: 500 }
      );
    }

    // Connect to MinIO
    const minioService = new MinioService();
    await minioService.connect(minioConfig);

    // Generate file URLs dynamically (works for both custom domain and presigned URLs)
    const items = await Promise.all(
      collection.items.map(async (item) => {
        const fileUrl = await minioService.getFileUrl(item.file.minioPath);
        
        // Handle thumbnail URL based on storage location
        let thumbnailUrl: string | null = null;
        if (item.file.thumbnailPath) {
          if (item.file.thumbnailPath === 'database') {
            // Thumbnail stored in database, use API route
            thumbnailUrl = `/api/files/${item.fileId}/thumbnail?v=${item.file.updatedAt.getTime()}`;
          } else {
            // Thumbnail stored in MinIO
            thumbnailUrl = await minioService.getFileUrl(item.file.thumbnailPath);
          }
        }

        return {
          id: item.id,
          fileId: item.fileId,
          filename: item.file.filename,
          fileType: item.file.fileType,
          mimeType: item.file.mimeType,
          fileUrl,
          thumbnailUrl,
          width: item.file.width,
          height: item.file.height,
          duration: item.file.duration,
          order: item.order,
        };
      })
    );

    return NextResponse.json({
      id: collection.id,
      items,
    });
  } catch (error) {
    console.error('Error getting collection:', error);
    return NextResponse.json(
      { error: 'Failed to get collection', message: String(error) },
      { status: 500 }
    );
  }
}

// Helper function to calculate expiration time
function calculateExpiresAt(expiresIn: number, unit: 'minutes' | 'hours' | 'days'): Date {
  const now = new Date();
  let milliseconds = 0;
  
  switch (unit) {
    case 'minutes':
      milliseconds = expiresIn * 60 * 1000;
      break;
    case 'hours':
      milliseconds = expiresIn * 60 * 60 * 1000;
      break;
    case 'days':
      milliseconds = expiresIn * 24 * 60 * 60 * 1000;
      break;
  }
  
  return new Date(now.getTime() + milliseconds);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { user, error } = await requireAuth();
  if (error) return error;

  try {
    const body = await request.json();
    const { expiresIn, unit } = body as {
      expiresIn: number;
      unit: 'minutes' | 'hours' | 'days';
    };

    if ((!expiresIn || !unit) && !body.addFileIds && !body.removeFileIds) {
      return NextResponse.json({ error: 'Missing update parameters' }, { status: 400 });
    }

    // Verify ownership
    const collection = await prisma.collection.findUnique({
      where: { id },
    });

    if (!collection) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
    }

    if (collection.userId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Generate NEW shortlink
    let shortCode = collection.shortCode;
    let shortUrl: string | undefined;

    const shortlinkConfig = await prisma.config.findUnique({
      where: {
        userId_key: { userId: user.id, key: 'shortlink_default' },
      },
    });

    if (shortlinkConfig) {
      const { ShortlinkService } = await import('@/lib/shortlink');
      const sConfig = JSON.parse(shortlinkConfig.value);
      const shortlinkService = new ShortlinkService();
      shortlinkService.setConfig(sConfig);

      // Get base URL from request
      const baseUrl = `${request.nextUrl.protocol}//${request.nextUrl.host}`;
      const collectionUrl = `${baseUrl}/c/${collection.id}`;

      // Create NEW shortlink (this effectively rotates the link)
      const shortlink = await shortlinkService.createShortlink(
        collectionUrl,
        undefined,
        expiresIn,
        unit
      );

      shortCode = shortlink.short_code;
      shortUrl = shortlink.short_url;
    }

    // Update collection
    const expiresAt = expiresIn && unit ? calculateExpiresAt(expiresIn, unit) : undefined;
    
    // Handle File Modifications
    if (body.removeFileIds && Array.isArray(body.removeFileIds)) {
       const removeIds = body.removeFileIds as string[];
       if (removeIds.length > 0) {
          await prisma.collectionItem.deleteMany({
            where: {
              collectionId: id,
              fileId: { in: removeIds }
            }
          });
       }
    }

    if (body.addFileIds && Array.isArray(body.addFileIds)) {
       const addIds = body.addFileIds as string[];
       if (addIds.length > 0) {
          // Get current max order
          const maxOrderAgg = await prisma.collectionItem.aggregate({
            where: { collectionId: id },
            _max: { order: true }
          });
          const currentOrder = (maxOrderAgg._max.order ?? -1) + 1;

          // Filter out files that are already in the collection to avoid unique constraint errors
          const existingItems = await prisma.collectionItem.findMany({
             where: { collectionId: id, fileId: { in: addIds } },
             select: { fileId: true }
          });
          const existingFileIds = new Set(existingItems.map(item => item.fileId));
          const newFileIds = addIds.filter(fid => !existingFileIds.has(fid));

          if (newFileIds.length > 0) {
             const data = newFileIds.map((fileId, index) => ({
                collectionId: id,
                fileId,
                order: currentOrder + index
             }));
             
             await prisma.collectionItem.createMany({
               data
             });
          }
       }
    }

    // Recalculate stats
    const allItems = await prisma.collectionItem.findMany({
      where: { collectionId: id },
      include: { file: { select: { fileSize: true } } }
    });

    const fileCount = allItems.length;
    const totalSize = allItems.reduce((acc, item) => acc + Number(item.file.fileSize), 0);

    const updateData: {
      fileCount: number;
      totalSize: bigint;
      expiresAt?: Date | null;
      shortCode?: string | null;
    } = {
      fileCount,
      totalSize: BigInt(totalSize),
    };

    // Only update expiration/shortlink if provided
    if (expiresAt) {
       updateData.expiresAt = expiresAt;
       updateData.shortCode = shortCode;
    }

    const updated = await prisma.collection.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      id: updated.id,
      shortCode: updated.shortCode,
      shortUrl,
      expiresAt: updated.expiresAt?.toISOString(),
    });
  } catch (error) {
    console.error('Error updating collection:', error);
    return NextResponse.json(
      { error: 'Failed to update collection' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { user, error } = await requireAuth();
  if (error) return error;

  try {
    // Verify ownership
    const collection = await prisma.collection.findUnique({
      where: { id },
    });

    if (!collection) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      );
    }

    if (collection.userId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Delete collection (cascade will delete CollectionItems)
    await prisma.collection.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting collection:', error);
    return NextResponse.json(
      { error: 'Failed to delete collection' },
      { status: 500 }
    );
  }
}
