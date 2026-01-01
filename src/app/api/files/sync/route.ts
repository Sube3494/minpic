import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MinioService, MinioConfig } from '@/lib/minio';
import { generateThumbnail, generateVideoThumbnail, getImageDimensions, getFileType, generatePinyin } from '@/lib/image-utils';
import { SyncEvent } from '@/types/config';
import { auth } from '@/lib/auth';
import { checkStorageQuota, checkFileQuota, updateStorageUsage, updateFileCount } from '@/lib/quota';

interface StoredMinioConfig extends MinioConfig {
  id: string;
  name: string;
}

export async function POST(request: NextRequest) {
  // Get user session
  const session = await auth();
  if (!session?.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  const userId = (session.user as { id: string }).id;
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

        // 获取用户的 MinIO 配置（新格式）
        const configRecord = await prisma.config.findUnique({
          where: {
            userId_key: { userId, key: `minio_${configId}` }
          },
        });
        
        if (!configRecord) {
          sendEvent({ type: 'error', message: '未找到配置' });
          controller.close();
          return;
        }

        const config: StoredMinioConfig = JSON.parse(configRecord.value);

        // Connect to MinIO
        const minioService = new MinioService();
        await minioService.connect(config);

        // 构建用户路径前缀:baseDir/users/{userId}/
        let userPrefix = '';
        if (config.baseDir) {
          userPrefix = `${config.baseDir}/`;
        }
        userPrefix += `users/${userId}/`;

        // List only current user's files
        const files = await minioService.listFiles(userPrefix);
        const total = files.length;
        
        let imported = 0;
        let skipped = 0;
        let errors = 0;
        let current = 0;
        let totalSizeImported = 0;  // 跟踪已导入文件的总大小
        let newFilesCount = 0;      // 跟踪新导入的文件数量
        let hasError = false;       // 跟踪是否发生阻断性错误

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

            // Check if file already exists for THIS USER
            const existing = await prisma.file.findFirst({
              where: { 
                minioPath: fileObj.name,
                userId: userId  // 只检查当前用户的文件
              },
            });



            const needsMetadata = existing && (!existing.thumbnailData || !existing.pinyin);

            if (existing && !needsMetadata) {
              const isSameStorageGroup = await (async () => {
                if (existing.configId === configId) return true;
                if (!existing.configId) return false;

                // 获取当前配置和已存在文件的配置
                const [currentConfigRecord, existingConfigRecord] = await Promise.all([
                  prisma.config.findUnique({
                    where: { userId_key: { userId, key: `minio_${configId}` } }
                  }),
                  prisma.config.findUnique({
                    where: { userId_key: { userId, key: `minio_${existing.configId}` } }
                  })
                ]);

                if (!currentConfigRecord || !existingConfigRecord) return false;

                const currentCfg: StoredMinioConfig = JSON.parse(currentConfigRecord.value);
                const existingCfg: StoredMinioConfig = JSON.parse(existingConfigRecord.value);

                return currentCfg.accessKey === existingCfg.accessKey && 
                       currentCfg.bucket === existingCfg.bucket &&
                       (currentCfg.baseDir || '') === (existingCfg.baseDir || '');
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

            // 对于不存在的文件,进行限额检查
            // 对于不存在的文件,进行限额检查
            if (!existing) {
              // 检查文件数量限额 (传入当前批次已新增的文件数)
              const fileQuotaCheck = await checkFileQuota(userId, newFilesCount);
              if (!fileQuotaCheck.allowed) {
                sendEvent({
                  type: 'quota_exceeded',
                  data: {
                    quotaType: 'file',
                    message: '文件数量已达限额,同步已停止',
                    progress: { total, imported, skipped, errors, current }
                  }
                });
                hasError = true;
                break; // 停止同步
              }

              // 检查存储空间限额 (传入当前批次已累积的大小)
              const storageQuotaCheck = await checkStorageQuota(userId, fileObj.size || 0, totalSizeImported);
              if (!storageQuotaCheck.allowed) {
                sendEvent({
                  type: 'quota_exceeded',
                  data: {
                    quotaType: 'storage',
                    message: '存储空间已达限额,同步已停止',
                    progress: { total, imported, skipped, errors, current }
                  }
                });
                hasError = true;
                break; // 停止同步
              }
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
                  userId,  // Add user association
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
            
            // 如果是新导入的文件,统计大小和数量
            if (!existing) {
              totalSizeImported += fileObj.size || 0;
              newFilesCount++;
              imported++;  // 只有新文件才算imported
            } else {
              // 已存在的文件,只是更新元数据,不计入配额
              skipped++;
            }
          } catch (error) {
            console.error(`Error importing file ${fileObj.name}:`, error);
            errors++;
          }
        }

        // 批量更新用户配额
        if (newFilesCount > 0 || totalSizeImported > 0) {
          console.log('[同步配额更新]', {
            userId,
            newFilesCount,
            totalSizeImported,
            imported,
            skipped,
            errors
          });
          try {
            await Promise.all([
              updateStorageUsage(userId, totalSizeImported),
              updateFileCount(userId, newFilesCount),
            ]);
            console.log('[同步配额更新成功]');
          } catch (quotaError) {
            console.error('[同步配额更新失败]', quotaError);
          }
        }

        // Final result
        if (!hasError) {
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
        }
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
