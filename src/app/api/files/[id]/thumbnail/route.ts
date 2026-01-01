import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
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
        thumbnailData: true,
        fileType: true,
        thumbnailPath: true,
        minioPath: true,
        configId: true,
      }
    });

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // 验证所有权
    if (file.userId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (file.thumbnailData) {
      // Serve from DB
      return new NextResponse(new Uint8Array(file.thumbnailData), {
        headers: {
          'Content-Type': 'image/webp',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }

    // Auto-generate missing thumbnail for videos (Lazy Generation)
    if (file.fileType === 'video' && !file.thumbnailData) {
      try {
        // 获取 MinIO 配置
        const config = await getUserMinioConfig(user.id, file.configId);

        if (config) {
          const { MinioService } = await import('@/lib/minio');
          const minioService = new MinioService();
          await minioService.connect(config);
          
          const videoBuffer = await minioService.downloadFile(file.minioPath);
          const { generateVideoThumbnail } = await import('@/lib/image-utils');
          const thumbnailBuffer = await generateVideoThumbnail(videoBuffer);

          if (thumbnailBuffer) {
            // Save to DB for next time
            await prisma.file.update({
               where: { id },
               data: { 
                 thumbnailData: thumbnailBuffer,
                 thumbnailPath: 'database'
               }
            });

            return new NextResponse(new Uint8Array(thumbnailBuffer), {
              headers: {
                'Content-Type': 'image/webp',
                'Cache-Control': 'public, max-age=31536000, immutable',
              },
            });
          }
        }
      } catch (err) {
        console.error('Lazy video thumbnail generation failed:', err);
      }
    }

    // Legacy support: if we have a path but no data, migrate from MinIO
    if (file.thumbnailPath && file.thumbnailPath !== 'database') {
      try {
        const config = await getUserMinioConfig(user.id, file.configId);

        if (config) {
          const { MinioService } = await import('@/lib/minio');
          const minioService = new MinioService();
          await minioService.connect(config);
          
          const thumbnailBuffer = await minioService.downloadFile(file.thumbnailPath);
          
          // Save to DB for next time (Lazy Migration)
          await prisma.file.update({
             where: { id },
             data: { 
               thumbnailData: thumbnailBuffer,
               thumbnailPath: 'database'
             }
          });

          return new NextResponse(new Uint8Array(thumbnailBuffer), {
            headers: {
              'Content-Type': 'image/webp',
              'Cache-Control': 'public, max-age=31536000, immutable',
            },
          });
        }
      } catch (err) {
        console.error('Lazy migration failed:', err);
      }
    }

    // Fallback: If migration failed or no legacy path, redirect to download (last resort)
    return NextResponse.redirect(new URL(`/api/files/${id}/download`, request.url));
  } catch (error) {
    console.error('Error fetching thumbnail:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
