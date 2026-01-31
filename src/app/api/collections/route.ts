import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
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
    const { fileIds, expiresIn, unit, name, description, shared } = body as {
      fileIds: string[];
      expiresIn?: number;
      unit?: 'minutes' | 'hours' | 'days';
      name?: string;
      description?: string;
      shared?: boolean;
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

    // Create collection (private by default)
    const collection = await prisma.collection.create({
      data: {
        userId: user.id,
        name,
        description,
        fileCount: files.length,
        totalSize,
        isShared: false,
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

    // Generate shortlink only if user explicitly requests sharing
    if (shared && expiresIn && unit) {
      const shortlinkConfig = await prisma.config.findUnique({
        where: {
          userId_key: { userId: user.id, key: 'shortlink_default' },
        },
      });

      if (shortlinkConfig) {
        const sConfig = JSON.parse(shortlinkConfig.value);
        if (sConfig.enabled !== false) {
          const shortlinkService = new ShortlinkService();
          shortlinkService.setConfig(sConfig);

          // Get base URL from environment or request fallback
          const baseUrl = process.env.NEXTAUTH_URL || `${request.nextUrl.protocol}//${request.nextUrl.host}`;
          
          // 如果没有名称，意味着这是一个“临时分享”，路径使用 /f/
          // 如果有名称，意味着这是一个“合集”，路径使用 /c/
          const pathPrefix = !collection.name ? 'f' : 'c';
          const collectionUrl = `${baseUrl}/${pathPrefix}/${collection.id}`;

          const shortlink = await shortlinkService.createShortlink(
            collectionUrl,
            undefined,
            expiresIn,
            unit,
            collection.name || `多选分享 (${collection.fileCount}个文件)`
          );

          // Calculate expiration time and update collection with sharing info
          const expiresAt = calculateExpiresAt(expiresIn, unit);
          await prisma.collection.update({
            where: { id: collection.id },
            data: {
              shortCode: shortlink.short_code,
              shortUrl: shortlink.short_url,
              expiresAt,
              isShared: true,
              sharedAt: new Date(),
            },
          });

          shortUrl = shortlink.short_url;
        } else {
            // Shortlink disabled, just set expiration time and mark as shared
            const expiresAt = calculateExpiresAt(expiresIn, unit);
            await prisma.collection.update({
              where: { id: collection.id },
              data: {
                expiresAt,
                isShared: true,
                sharedAt: new Date(),
              },
            });
            const baseUrl = process.env.NEXTAUTH_URL || `${request.nextUrl.protocol}//${request.nextUrl.host}`;
            const pathPrefix = !collection.name ? 'f' : 'c';
            shortUrl = `${baseUrl}/${pathPrefix}/${collection.id}`;
        }
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

export async function GET(request: NextRequest) {
  const { user, error } = await requireAuth();
  if (error) return error;

  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const sharedParam = searchParams.get('shared');
    
    // Build where clause
    const where: Prisma.CollectionWhereInput = { 
      userId: user.id,
      name: { not: null } // 仅展示命名的合集，不展示临时分享包
    };
    
    if (sharedParam === 'true') {
      where.isShared = true;
    } else if (sharedParam === 'false') {
      where.isShared = false;
    }

    const collections = await prisma.collection.findMany({
      where,
      include: {
        items: {
          take: 4,
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
      // Generate thumbnail URLs
      const thumbnails = c.items.map(item => {
          if (item.file.thumbnailPath) {
              return `/api/files/${item.file.id}/thumbnail?v=${item.file.updatedAt.getTime()}`;
          }
          return null;
      }).filter(Boolean);

      return {
        id: c.id,
        name: c.name,
        description: c.description,
        fileCount: c.fileCount,
        totalSize: c.totalSize.toString(),
        shortCode: c.shortCode,
        shortUrl: c.shortUrl,
        firstThumbnail: thumbnails[0] || null,
        thumbnails,
        createdAt: c.createdAt.toISOString(),
        expiresAt: c.expiresAt?.toISOString(),
        isShared: c.isShared,
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
