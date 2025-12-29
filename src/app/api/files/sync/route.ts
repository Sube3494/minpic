import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MinioService, MinioConfig } from '@/lib/minio';
import { generateThumbnail, generateVideoThumbnail, getImageDimensions, getFileType, generatePinyin } from '@/lib/image-utils';
import { SyncEvent } from '@/types/config';

interface StoredMinioConfig extends MinioConfig {
  id: string;
  name: string;
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: SyncEvent) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
      };

      try {
        const { configId } = await request.json();

        if (!configId) {
          sendEvent({ type: 'error', message: '缺少配置 ID' });
          controller.close();
          return;
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
            const configs: StoredMinioConfig[] = JSON.parse(configsRecord.value);
            config = configs.find((c) => c.id === configId);
          }
        }

        if (!config) {
          sendEvent({ type: 'error', message: '未找到配置' });
          controller.close();
          return;
        }

        // Connect to MinIO
        const minioService = new MinioService();
        await minioService.connect(config);

        // List all files in bucket
        const files = await minioService.listFiles();
        const total = files.length;
        
        let imported = 0;
        let skipped = 0;
        let errors = 0;
        let current = 0;

        for (const fileObj of files) {
          current++;
          try {
            const currentFilename = fileObj.name?.split('/').pop() || fileObj.name || 'unknown';
            const pinyinValue = generatePinyin(currentFilename);
            
            // Send progressive update
            sendEvent({
              type: 'progress',
              data: {
                total,
                current,
                imported,
                skipped,
                errors,
                currentFilename,
                status: 'syncing'
              }
            });

            // Check if file already exists in database
            const existing = await prisma.file.findUnique({
              where: { minioPath: fileObj.name },
            });

            const needsMetadata = existing && (!existing.thumbnailData || !existing.pinyin);

            if (existing && !needsMetadata) {
              const isSameStorageGroup = await (async () => {
                if (existing.configId === configId) return true;
                if (!existing.configId) return false;

                const configsRecord = await prisma.config.findUnique({ where: { key: 'minio_configs' } });
                if (!configsRecord) return false;
                
                const allConfigs: StoredMinioConfig[] = JSON.parse(configsRecord.value);
                const currentCfg = allConfigs.find((c) => c.id === configId);
                const existingCfg = allConfigs.find((c) => c.id === existing.configId);

                if (currentCfg && existingCfg) {
                  return currentCfg.accessKey === existingCfg.accessKey && 
                         currentCfg.bucket === existingCfg.bucket &&
                         (currentCfg.baseDir || '') === (existingCfg.baseDir || '');
                }
                return false;
              })();

              if (!isSameStorageGroup) {
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

            // Download file to process (either new file or backfilling metadata)
            const fileBuffer = await minioService.downloadFile(fileObj.name!);
            
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

            if (fileType === 'image') {
              const dimensions = await getImageDimensions(fileBuffer);
              if (dimensions) {
                width = dimensions.width;
                height = dimensions.height;
              }

              thumbnailData = await generateThumbnail(fileBuffer, mimeType);
            } else if (fileType === 'video') {
              thumbnailData = await generateVideoThumbnail(fileBuffer);
            }

            const filename = fileObj.name?.split('/').pop() || fileObj.name || 'unknown';

            if (existing) {
              // Backfill metadata for existing record
              await prisma.file.update({
                where: { id: existing.id },
                data: {
                  thumbnailData,
                  width,
                  height,
                  pinyin: pinyinValue,
                  configId, // Update configId as well
                }
              });
            } else {
              // Create new record
              await prisma.file.create({
                data: {
                  filename,
                  minioPath: fileObj.name!,
                  fileSize: fileObj.size || 0,
                  mimeType,
                  fileType,
                  thumbnailData,
                  width,
                  height,
                  configId,
                  pinyin: pinyinValue,
                },
              });
            }

            imported++;
          } catch (error) {
            console.error(`Error importing file ${fileObj.name}:`, error);
            errors++;
          }
        }

        // Final result
        sendEvent({
          type: 'done',
          data: {
            total,
            imported,
            skipped,
            errors,
            status: 'completed'
          }
        });
      } catch (error) {
        console.error('Error syncing files:', error);
        sendEvent({ type: 'error', message: String(error) });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
