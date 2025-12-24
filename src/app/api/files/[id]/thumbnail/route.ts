import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const file = await prisma.file.findUnique({
      where: { id },
      select: {
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

    if (file.thumbnailData) {
      // Serve from DB
      return new NextResponse(file.thumbnailData, {
        headers: {
          'Content-Type': 'image/webp',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }

    // Auto-generate missing thumbnail for videos (Lazy Generation)
    if (file.fileType === 'video' && !file.thumbnailData) {
      try {
        if (file) {
           // Find MinIO config
           let config = null;
           if (file.configId) {
             const configsRecord = await prisma.config.findUnique({ where: { key: 'minio_configs' } });
             if (configsRecord) {
               const configs = JSON.parse(configsRecord.value);
               config = configs.find((c: any) => c.id === file.configId);
             }
           }
           
           if (!config) {
             const defaultConfig = await prisma.config.findUnique({ where: { key: 'minio_default' } });
             if (defaultConfig) config = JSON.parse(defaultConfig.value);
           }

           if (config) {
             const { getMinioService } = await import('@/lib/minio');
             const minioService = getMinioService();
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

               return new NextResponse(thumbnailBuffer, {
                 headers: {
                   'Content-Type': 'image/webp',
                   'Cache-Control': 'public, max-age=31536000, immutable',
                 },
               });
             }
           }
        }
      } catch (err) {
        console.error('Lazy video thumbnail generation failed:', err);
      }
    }

    // Legacy support: if we have a path but no data, redirect to download (or handle as before)
    if (file.thumbnailPath && file.thumbnailPath !== 'database') {
      try {
        // ... (existing legacy code for image migration) ...
        let config = null;
        if (file.configId) {
          const configsRecord = await prisma.config.findUnique({ where: { key: 'minio_configs' } });
          if (configsRecord) {
            const configs = JSON.parse(configsRecord.value);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            config = configs.find((c: any) => c.id === file.configId);
          }
        }
        
        if (!config) {
          const defaultConfig = await prisma.config.findUnique({ where: { key: 'minio_default' } });
          if (defaultConfig) config = JSON.parse(defaultConfig.value);
        }

        if (config) {
          const { getMinioService } = await import('@/lib/minio');
          const minioService = getMinioService();
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

          return new NextResponse(thumbnailBuffer, {
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
