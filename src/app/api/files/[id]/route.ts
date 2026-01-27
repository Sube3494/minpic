import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import { MinioService } from '@/lib/minio';
import { generatePinyin } from '@/lib/image-utils';
import { getUserMinioConfig } from '@/lib/get-user-minio-config';
import { serializeBigInt } from '@/lib/utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireAuth();
  if (error) return error;

  try {
    const { id } = await params;
    const file = await prisma.file.findUnique({
      where: { id },
    });

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // 验证所有权
    if (file.userId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    return NextResponse.json(serializeBigInt(file));
  } catch (error) {
    console.error('Error getting file:', error);
    return NextResponse.json(
      { error: 'Failed to get file' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireAuth();
  if (error) return error;

  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const deleteMode = searchParams.get('deleteMode') || 'record-only'; // 'full' | 'record-only'
    
    const file = await prisma.file.findUnique({
      where: { id },
    });

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // 验证所有权
    if (file.userId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // 获取 MinIO 配置
    const config = await getUserMinioConfig(user.id, file.configId);

    // Only delete MinIO files if mode is 'full'
    if (deleteMode === 'full' && config) {
      const minioService = new MinioService();
      await minioService.connect(config);

      const minioDeletePromises = [];

      // Delete main file
      minioDeletePromises.push(
        minioService.deleteFile(file.minioPath).catch(error => {
          console.error('Error deleting main file:', error);
        })
      );
      
      // Delete legacy thumbnail if exists
      if (file.thumbnailPath) {
        minioDeletePromises.push(
          minioService.deleteFile(file.thumbnailPath).catch(error => {
            console.error('Error deleting legacy thumbnail:', error);
          })
        );
      }

      await Promise.all(minioDeletePromises);
    }

    // Delete database record and update user statistics
    await prisma.$transaction(async (tx) => {
      // Delete the file record
      await tx.file.delete({
        where: { id },
      });

      // Update user storage statistics
      await tx.user.update({
        where: { id: user.id },
        data: {
          storageUsed: {
            decrement: file.fileSize,
          },
          fileCount: {
            decrement: 1,
          },
        },
      });
    });

    // Invalidate quota cache
    const { cache, CacheKeys } = await import('@/lib/cache');
    await cache.del(CacheKeys.userQuota(user.id));


    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting file:', error);
    return NextResponse.json(
      { error: 'Failed to delete file' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireAuth();
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json();
    const { filename, tags } = body;

    // 优化: 使用 update 的 where 条件同时检查所有权,减少一次查询
    const file = await prisma.file.update({
      where: { 
        id,
        userId: user.id  // 同时验证所有权
      },
      data: {
        ...(filename && { 
          filename,
          pinyin: generatePinyin(filename)
        }),
        ...(tags && { tags: JSON.stringify(tags) }),
      },
    });

    return NextResponse.json(serializeBigInt(file));
  } catch (error) {
    // Prisma 在找不到记录时会抛出 P2025 错误
    if (error instanceof Error && 'code' in error && error.code === 'P2025') {
      return NextResponse.json(
        { error: 'File not found or unauthorized' },
        { status: 404 }
      );
    }
    
    console.error('Error updating file:', error);
    return NextResponse.json(
      { error: 'Failed to update file' },
      { status: 500 }
    );
  }
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
    const { rotate, expiresIn, unit } = body as {
      rotate?: boolean;
      expiresIn?: number;
      unit?: 'minutes' | 'hours' | 'days';
    };

    // 验证所有权
    const file = await prisma.file.findUnique({
      where: { id, userId: user.id },
    });

    if (!file) {
      return NextResponse.json({ error: 'File not found or unauthorized' }, { status: 404 });
    }

    const data: { shareId?: string; shortCode?: string | null; shortUrl?: string | null; shareExpiresAt?: Date } = {};
    const { randomUUID } = await import('crypto');

    if (rotate) {
      data.shareId = randomUUID();
      
      // Cleanup old shortlink if exists
      const fileWithShortCode = file as unknown as { shortCode: string | null };
      if (fileWithShortCode.shortCode) {
        try {
          const shortlinkConfig = await prisma.config.findUnique({
            where: { 
              userId_key: { userId: user.id, key: 'shortlink_default' }
            },
          });

          if (shortlinkConfig) {
            const { ShortlinkService } = await import('@/lib/shortlink');
            const sConfig = JSON.parse(shortlinkConfig.value);
            const shortlinkService = new ShortlinkService();
            shortlinkService.setConfig(sConfig);
            await shortlinkService.deleteShortlink(fileWithShortCode.shortCode);
          }
        } catch (e) {
          console.warn('Failed to delete old shortlink for file during rotation:', e);
        }
        // Even if delete fails (e.g. already deleted or config missing), we clear it locally
        data.shortCode = null;
        data.shortUrl = null;
      }
    }

    if (expiresIn && unit) {
      const now = new Date();
      let ms = 0;
      switch (unit) {
        case 'minutes': ms = expiresIn * 60 * 1000; break;
        case 'hours': ms = expiresIn * 3600 * 1000; break;
        case 'days': ms = expiresIn * 86400 * 1000; break;
      }
      data.shareExpiresAt = new Date(now.getTime() + ms);
    }

    const updated = await prisma.file.update({
      where: { id },
      data,
    });

    return NextResponse.json(serializeBigInt(updated));
  } catch (error) {
    console.error('Error patching file:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
