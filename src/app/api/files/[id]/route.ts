import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import { getMinioService } from '@/lib/minio';
import { generatePinyin } from '@/lib/image-utils';
import { getUserMinioConfig } from '@/lib/get-user-minio-config';

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

    return NextResponse.json(file);
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
      const minioService = getMinioService();
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

    // Delete database record
    await prisma.file.delete({
      where: { id },
    });

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

    // 验证所有权
    const existingFile = await prisma.file.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!existingFile) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    if (existingFile.userId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const file = await prisma.file.update({
      where: { id },
      data: {
        ...(filename && { 
          filename,
          pinyin: generatePinyin(filename)
        }),
        ...(tags && { tags: JSON.stringify(tags) }),
      },
    });

    return NextResponse.json(file);
  } catch (error) {
    console.error('Error updating file:', error);
    return NextResponse.json(
      { error: 'Failed to update file' },
      { status: 500 }
    );
  }
}
