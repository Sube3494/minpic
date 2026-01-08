import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MinioService } from '@/lib/minio';
import { generateThumbnail, generateVideoThumbnail, getImageDimensions, getFileType, generatePinyin } from '@/lib/image-utils';
import { SyncEvent } from '@/types/config';
import { auth } from '@/lib/auth';
import { checkStorageQuota, checkFileQuota, updateStorageUsage, updateFileCount } from '@/lib/team-quota';
import { getUserMinioConfig } from '@/lib/get-user-minio-config';
import { serializeBigInt } from '@/lib/utils';

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
        controller.enqueue(encoder.encode(JSON.stringify(serializeBigInt(event)) + '\n'));
      };

      try {
        const body = await request.json();
        const targetConfigId = body.configId;

        if (!targetConfigId) {
          sendEvent({ type: 'error', message: '缺少配置 ID' });
          controller.close();
          return;
        }

        // 获取解密后的 MinIO 配置
        const minioConfig = await getUserMinioConfig(userId, targetConfigId);
        
        if (!minioConfig) {
          sendEvent({ type: 'error', message: '未找到配置或由于权限原因无法访问' });
          controller.close();
          return;
        }


        // Connect to MinIO
        const minioService = new MinioService();
        await minioService.connect(minioConfig);

        // 构建用户路径前缀:baseDir/users/{userId}/
        let userPrefix = '';
        if (minioConfig.baseDir) {
          userPrefix = `${minioConfig.baseDir}/`;
        }
        userPrefix += `users/${userId}/`;

        // List only current user's files
        const files = await minioService.listFiles(userPrefix);
        const total = files.length;
        
        let imported = 0;
        let skipped = 0;
        let errors = 0;
        let current = 0;
        let batchTotalSize = BigInt(0); // 兼容性写法，不直接使用 0n
        let newFilesCount = 0;
        let hasError = false;

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
              skipped++;
              continue;
            }

            // 对于不存在的文件,进行限额检查
            const fileSizeBigInt = BigInt(fileObj.size || 0);
            if (!existing) {
              // 检查文件数量限额
              const fileQuotaCheck = await checkFileQuota(userId, newFilesCount, targetConfigId);
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

              // 检查存储空间限额
              const storageQuotaCheck = await checkStorageQuota(userId, fileSizeBigInt, batchTotalSize, targetConfigId);
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

            // Download file to process
            const fileBuffer = await minioService.downloadFile(fileObj.name!);
            
            const extension = fileObj.name?.split('.').pop()?.toLowerCase() || '';
            const mimeTypeMap: Record<string, string> = {
              'jpg': 'image/jpeg',
              'jpeg': 'image/jpeg',
              'png': 'image/png',
              'gif': 'image/gif',
              'webp': 'image/webp',
              'svg': 'image/svg+xml',
              'bmp': 'image/bmp',
              'tiff': 'image/tiff',
              'ico': 'image/x-icon',
              'avif': 'image/avif',
              'mp4': 'video/mp4',
              'webm': 'video/webm',
              'mov': 'video/quicktime',
              'avi': 'video/x-msvideo',
              'mkv': 'video/x-matroska',
              'm4v': 'video/x-m4v',
              'mp3': 'audio/mpeg',
              'wav': 'audio/wav',
              'ogg': 'audio/ogg',
              'm4a': 'audio/mp4',
              'flac': 'audio/flac',
              'aac': 'audio/aac',
              'wma': 'audio/x-ms-wma',
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
                  configId: targetConfigId,
                }
              });
            } else {
              // Create new record
              await prisma.file.create({
                data: {
                  userId,
                  filename,
                  minioPath: fileObj.name!,
                  fileSize: fileSizeBigInt,
                  mimeType,
                  fileType,
                  thumbnailData,
                  width,
                  height,
                  configId: targetConfigId,
                  pinyin: pinyinValue,
                },
              });
            }
            
            if (!existing) {
              batchTotalSize += fileSizeBigInt;
              newFilesCount++;
              imported++;
            } else {
              skipped++;
            }
          } catch (error) {
            console.error(`Error importing file ${fileObj.name}:`, error);
            errors++;
          }
        }

        // 批量更新用户配额
        if (newFilesCount > 0 || batchTotalSize > BigInt(0)) {
          try {
            await Promise.all([
              updateStorageUsage(userId, batchTotalSize),
              updateFileCount(userId, newFilesCount),
            ]);
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
