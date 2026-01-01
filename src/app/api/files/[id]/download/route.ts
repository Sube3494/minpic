import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import { getMinioService } from '@/lib/minio';
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
      select: {
        id: true,
        userId: true,
        filename: true,
        mimeType: true,
        minioPath: true,
        configId: true,
      },
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

    if (!config) {
      return NextResponse.json(
        { error: 'MinIO config not found' },
        { status: 404 }
      );
    }

    const minioService = getMinioService();
    await minioService.connect(config);

    const fileBuffer = await minioService.downloadFile(file.minioPath);

    // 正确编码中文文件名 (RFC 5987)
    const encodedFilename = encodeURIComponent(file.filename);

    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        'Content-Type': file.mimeType,
        'Content-Disposition': `inline; filename="${file.filename.replace(/[^\x00-\x7F]/g, '_')}"; filename*=UTF-8''${encodedFilename}`,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Error downloading file:', error);
    return NextResponse.json(
      { error: 'Failed to download file' },
      { status: 500 }
    );
  }
}
