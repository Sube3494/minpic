import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MinioService } from '@/lib/minio';
import { generateThumbnail, getImageDimensions, getFileType } from '@/lib/image-utils';

export async function POST(request: NextRequest) {
  try {
    const { configId } = await request.json();

    if (!configId) {
      return NextResponse.json({ error: 'Config ID required' }, { status: 400 });
    }

    // Get MinIO config
    let config = null;
    
    if (configId === 'minio_default') {
      const defaultConfig = await prisma.config.findUnique({
        where: { key: 'minio_default' },
      });
      if (defaultConfig) {
        config = JSON.parse(defaultConfig.value);
      }
    } else {
      const configsRecord = await prisma.config.findUnique({
        where: { key: 'minio_configs' },
      });
      
      if (configsRecord) {
        const configs = JSON.parse(configsRecord.value);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        config = configs.find((c: any) => c.id === configId);
      }
    }

    if (!config) {
      return NextResponse.json({ error: 'Config not found' }, { status: 404 });
    }

    // Connect to MinIO
    const minioService = new MinioService();
    await minioService.connect(config);

    // List all files in bucket
    const files = await minioService.listFiles();
    
    let imported = 0;
    let skipped = 0;
    let errors = 0;

    for (const fileObj of files) {
      try {
        // Check if file already exists in database
        const existing = await prisma.file.findUnique({
          where: { minioPath: fileObj.name },
        });

        if (existing) {
          skipped++;
          continue;
        }

        // Download file to process
        const fileBuffer = await minioService.downloadFile(fileObj.name!);
        
        // Detect mime type from extension
        const extension = fileObj.name?.split('.').pop()?.toLowerCase() || '';
        const mimeTypeMap: Record<string, string> = {
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'png': 'image/png',
          'gif': 'image/gif',
          'webp': 'image/webp',
          'svg': 'image/svg+xml',
          'mp4': 'video/mp4',
          'webm': 'video/webm',
          'mov': 'video/quicktime',
          'avi': 'video/x-msvideo',
          'mkv': 'video/x-matroska',
          'mp3': 'audio/mpeg',
          'wav': 'audio/wav',
          'ogg': 'audio/ogg',
          'm4a': 'audio/mp4',
          'flac': 'audio/flac',
        };
        
        const mimeType = mimeTypeMap[extension] || 'application/octet-stream';
        const fileType = getFileType(mimeType);

        if (!fileType) {
          skipped++;
          continue;
        }

        let thumbnailData: Buffer | null = null;
        let width: number | null = null;
        let height: number | null = null;

        // Generate thumbnail for images
        if (fileType === 'image') {
          const dimensions = await getImageDimensions(fileBuffer);
          if (dimensions) {
            width = dimensions.width;
            height = dimensions.height;
          }

          const thumbnail = await generateThumbnail(fileBuffer, mimeType);
          if (thumbnail) {
            thumbnailData = thumbnail;
          }
        }

        // Extract filename from path
        const filename = fileObj.name?.split('/').pop() || fileObj.name || 'unknown';

        // Create database record
        await prisma.file.create({
          data: {
            filename,
            minioPath: fileObj.name!,
            fileSize: fileObj.size || 0,
            mimeType,
            fileType,
            thumbnailData, // Store binary data
            width,
            height,
            configId,
          },
        });

        imported++;
      } catch (error) {
        console.error(`Error importing file ${fileObj.name}:`, error);
        errors++;
      }
    }

    return NextResponse.json({
      success: true,
      total: files.length,
      imported,
      skipped,
      errors,
    });
  } catch (error) {
    console.error('Error syncing files:', error);
    return NextResponse.json(
      { error: 'Failed to sync files', message: String(error) },
      { status: 500 }
    );
  }
}
