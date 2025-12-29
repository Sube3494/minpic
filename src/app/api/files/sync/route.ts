import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MinioService } from '@/lib/minio';
import { generateThumbnail, getImageDimensions, getFileType } from '@/lib/image-utils';

export async function POST(request: NextRequest) {
  try {
    const { configId } = await request.json();

    if (!configId) {
      return NextResponse.json({ error: '缺少配置 ID' }, { status: 400 });
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
      return NextResponse.json({ error: '未找到配置' }, { status: 404 });
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
          // Check if the existing file belongs to the same storage group
          // form a storage identity group: Same AccessKey + Bucket + BaseDir
          const isSameStorageGroup = await (async () => {
            if (existing.configId === configId) return true;
            if (!existing.configId) return false;

            const configsRecord = await prisma.config.findUnique({ where: { key: 'minio_configs' } });
            if (!configsRecord) return false;
            
            const allConfigs = JSON.parse(configsRecord.value);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const currentCfg = allConfigs.find((c: any) => c.id === configId);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const existingCfg = allConfigs.find((c: any) => c.id === existing.configId);

            if (currentCfg && existingCfg) {
              return currentCfg.accessKey === existingCfg.accessKey && 
                     currentCfg.bucket === existingCfg.bucket &&
                     (currentCfg.baseDir || '') === (existingCfg.baseDir || '');
            }
            return false;
          })();

          if (!isSameStorageGroup) {
            // Only update ID if it's truly a different storage or currently unassigned
            await prisma.file.update({
              where: { id: existing.id },
              data: { configId },
            });
            imported++;
          } else {
            skipped++;
          }
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

        // Short links are now generated on-demand by users, not during sync

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
      { error: '同步文件失败', message: String(error) },
      { status: 500 }
    );
  }
}
