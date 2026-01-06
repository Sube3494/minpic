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
