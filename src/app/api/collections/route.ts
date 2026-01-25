import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import { ShortlinkService } from '@/lib/shortlink';

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

export async function POST(request: NextRequest) {
  const { user, error } = await requireAuth();
  if (error) return error;

  try {
    const body = await request.json();
    const { fileIds, expiresIn, unit, name } = body as {
      fileIds: string[];
      expiresIn?: number;
      unit?: 'minutes' | 'hours' | 'days';
      name?: string;
    };

    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      return NextResponse.json(
        { error: 'File IDs required' },
        { status: 400 }
      );
    }

    // Verify file ownership and get file info
    const files = await prisma.file.findMany({
      where: {
        id: { in: fileIds },
        userId: user.id,
      },
    });

    if (files.length !== fileIds.length) {
      return NextResponse.json(
        { error: 'Some files not found or unauthorized' },
        { status: 403 }
      );
    }

    // Calculate total size
    const totalSize = files.reduce((sum, file) => sum + BigInt(file.fileSize), BigInt(0));

    // Create collection
    const collection = await prisma.collection.create({
      data: {
        userId: user.id,
        name,
        fileCount: files.length,
        totalSize,
      },
    });

    // Create collection items with order
    await prisma.collectionItem.createMany({
      data: fileIds.map((fileId, index) => ({
        collectionId: collection.id,
        fileId,
        order: index + 1,
      })),
    });

    let shortUrl: string | undefined;

    // Generate shortlink if requested
    if (expiresIn && unit) {
      const shortlinkConfig = await prisma.config.findUnique({
        where: {
          userId_key: { userId: user.id, key: 'shortlink_default' },
        },
      });

      if (shortlinkConfig) {
        const sConfig = JSON.parse(shortlinkConfig.value);
        const shortlinkService = new ShortlinkService();
        shortlinkService.setConfig(sConfig);

        // Get base URL from environment or request fallback
        const baseUrl = process.env.NEXTAUTH_URL || `${request.nextUrl.protocol}//${request.nextUrl.host}`;
        const collectionUrl = `${baseUrl}/c/${collection.id}`;

        const shortlink = await shortlinkService.createShortlink(
          collectionUrl,
          undefined,
          expiresIn,
          unit
        );

        // Calculate expiration time and update collection with both code and full URL
        const expiresAt = calculateExpiresAt(expiresIn, unit);
        await prisma.collection.update({
          where: { id: collection.id },
          data: {
            shortCode: shortlink.short_code,
            shortUrl: shortlink.short_url,
            expiresAt,
          },
        });

        shortUrl = shortlink.short_url;
      }
    }

    return NextResponse.json({
      id: collection.id,
      fileCount: collection.fileCount,
      shortUrl,
      createdAt: collection.createdAt.toISOString(),
    });
  } catch (error) {
    console.error('Error creating collection:', error);
    return NextResponse.json(
      { error: 'Failed to create collection', message: String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  const { user, error } = await requireAuth();
  if (error) return error;

  try {
    const collections = await prisma.collection.findMany({
      where: { userId: user.id },
      include: {
        items: {
          take: 1,
          orderBy: { order: 'asc' },
          include: {
            file: {
              select: { 
                id: true,
                thumbnailPath: true,
                updatedAt: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const result = collections.map((c) => {
      // Generate thumbnail URL
      let firstThumbnail: string | undefined;
      if (c.items[0]?.file.thumbnailPath) {
        if (c.items[0].file.thumbnailPath === 'database') {
          // Thumbnail stored in database
          firstThumbnail = `/api/files/${c.items[0].file.id}/thumbnail?v=${c.items[0].file.updatedAt.getTime()}`;
        } else {
          // This would need MinIO service, but for simplicity we'll use the database route for now
          // TODO: Generate MinIO URL for thumbnails stored in MinIO
          firstThumbnail = `/api/files/${c.items[0].file.id}/thumbnail?v=${c.items[0].file.updatedAt.getTime()}`;
        }
      }

      return {
        id: c.id,
        name: c.name,
        fileCount: c.fileCount,
        totalSize: c.totalSize.toString(),
        shortCode: c.shortCode,
        shortUrl: c.shortUrl,
        firstThumbnail,
        createdAt: c.createdAt.toISOString(),
        expiresAt: c.expiresAt?.toISOString(),
      };
    });

    return NextResponse.json({ collections: result });
  } catch (error) {
    console.error('Error fetching collections:', error);
    return NextResponse.json(
      { error: 'Failed to fetch collections' },
      { status: 500 }
    );
  }
}
