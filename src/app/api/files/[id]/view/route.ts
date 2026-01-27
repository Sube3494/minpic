import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserMinioConfig } from '@/lib/get-user-minio-config';
import { MinioService } from '@/lib/minio';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: fileId } = await params;

    // 获取文件信息 (兼容 CUID 和 UUID/shareId)
    const file = await prisma.file.findFirst({
      where: {
        OR: [
          { id: fileId },
          { shareId: fileId }
        ]
      },
      select: {
        id: true,
        shareId: true,
        userId: true,
        filename: true,
        fileType: true,
        mimeType: true,
        minioPath: true,
        thumbnailPath: true,
        width: true,
        height: true,
        duration: true,
        configId: true,
        expiresAt: true,
      },
    });

    if (!file) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // 增加过期时间校验
    if (file.expiresAt && new Date(file.expiresAt) < new Date()) {
      return NextResponse.json(
        { error: 'File expired' },
        { status: 404 }
      );
    }

    // 获取 MinIO 配置
    const config = await getUserMinioConfig(file.userId, file.configId);

    if (!config) {
      return NextResponse.json(
        { error: 'MinIO configuration not found' },
        { status: 404 }
      );
    }

    // 使用 MinioService 获取文件 URL
    const minioService = new MinioService();
    await minioService.connect(config);
    const fileUrl = await minioService.getFileUrl(file.minioPath);
    
    // 获取缩略图 URL（如果存在）
    let thumbnailUrl: string | null = null;
    if (file.thumbnailPath) {
      thumbnailUrl = await minioService.getFileUrl(file.thumbnailPath);
    }

    return NextResponse.json({
      id: file.id,
      filename: file.filename,
      fileType: file.fileType,
      mimeType: file.mimeType,
      fileUrl,
      thumbnailUrl,
      width: file.width,
      height: file.height,
      duration: file.duration,
    });
  } catch (error) {
    console.error('Error fetching file view info:', error);
    return NextResponse.json(
      { error: 'Failed to fetch file info' },
      { status: 500 }
    );
  }
}
