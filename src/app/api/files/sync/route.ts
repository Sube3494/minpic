import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MinioService } from '@/lib/minio';
import { generateThumbnail, getImageDimensions, getFileType } from '@/lib/image-utils';
import { getShortlinkService } from '@/lib/shortlink';

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
    let shortlinksCreated = 0;
    let shortlinksFailed = 0;

    // Get shortlink config (if enabled)
    let shortlinkConfig = null;
    let shortlinkEnabled = false;
    try {
      const shortlinkConfigRecord = await prisma.config.findUnique({
        where: { key: 'shortlink_default' },
      });
      if (shortlinkConfigRecord) {
        shortlinkConfig = JSON.parse(shortlinkConfigRecord.value);
        shortlinkEnabled = shortlinkConfig?.enabled === true;
      }
    } catch {
      console.log('Shortlink config not found or disabled');
    }

    for (const fileObj of files) {
      try {
        // Check if file already exists in database
        const existing = await prisma.file.findUnique({
          where: { minioPath: fileObj.name },
        });

        if (existing) {
          // If file exists but has different configId (or null), update it to current configId
          if (existing.configId !== configId) {
            await prisma.file.update({
              where: { id: existing.id },
              data: { configId },
            });
            imported++; // Count as imported since we "recovered" it for this view
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

        // Generate shortlink if enabled
        let shortlinkCode: string | null = null;
        if (shortlinkEnabled && shortlinkConfig) {
          try {
            // Get file URL
            const fileUrl = await minioService.getFileUrl(fileObj.name!);
            
            // Create shortlink (service handles MD5 deduplication automatically)
            const shortlinkService = getShortlinkService();
            shortlinkService.setConfig(shortlinkConfig);
            
            const expiresIn = shortlinkConfig.expiresIn && shortlinkConfig.expiresIn > 0 
              ? shortlinkConfig.expiresIn 
              : undefined;
            
            const shortlink = await shortlinkService.createShortlink(fileUrl, undefined, expiresIn);
            shortlinkCode = shortlink.short_code;
            shortlinksCreated++;
          } catch (error) {
            console.error(`Failed to create shortlink for ${fileObj.name}:`, error);
            shortlinksFailed++;
            // Continue without shortlink - don't fail the entire sync
          }
        }

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
            shortlinkCode,
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
      shortlinksCreated,
      shortlinksFailed,
    });
  } catch (error) {
    console.error('Error syncing files:', error);
    return NextResponse.json(
      { error: 'Failed to sync files', message: String(error) },
      { status: 500 }
    );
  }
}
