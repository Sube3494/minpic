import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MinioService, MinioConfig } from '@/lib/minio';
import { generateThumbnail, generateVideoThumbnail, getImageDimensions, getFileType, generatePinyin } from '@/lib/image-utils';
import { requireAuth } from '@/lib/auth-utils';
import { checkStorageQuota, checkFileQuota, updateStorageUsage, updateFileCount } from '@/lib/quota';

export async function POST(request: NextRequest) {
  // Require authentication
  const { error: authError, user } = await requireAuth();
  if (authError) return authError;
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const configId = formData.get('configId') as string;
    const expiresAtStr = formData.get('expiresAt') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    interface StoredMinioConfig extends MinioConfig {
      id: string;
      name: string;
    }

    // Check file quota
    const fileQuotaCheck = await checkFileQuota(user.id);
    console.log('[上传限额检查] 文件数量检查:', { userId: user.id, allowed: fileQuotaCheck.allowed, reason: fileQuotaCheck.reason });
    if (!fileQuotaCheck.allowed) {
      return NextResponse.json({ error: fileQuotaCheck.reason }, { status: 403 });
    }

    // Check storage quota (preliminary check with file size)
    const storageQuotaCheck = await checkStorageQuota(user.id, file.size);
    console.log('[上传限额检查] 存储空间检查:', { userId: user.id, fileSize: file.size, allowed: storageQuotaCheck.allowed, reason: storageQuotaCheck.reason });
    if (!storageQuotaCheck.allowed) {
      return NextResponse.json({ error: storageQuotaCheck.reason }, { status: 403 });
    }

    // Determine config to use (user-specific)
    // 获取用户的 MinIO 配置
    const configRecord = await prisma.config.findUnique({
      where: {
        userId_key: { userId: user.id, key: `minio_${configId}` }
      }
    });

    if (!configRecord) {
      return NextResponse.json({ error: 'Invalid config' }, { status: 400 });
    }

    const config: StoredMinioConfig = JSON.parse(configRecord.value);
    const usedConfigId = configId;

    // Process file
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type;
    const fileType = getFileType(mimeType);

    if (!fileType) {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
    }

    // Upload to MinIO
    const minioService = new MinioService();
    await minioService.connect(config);
    const { objectName, expiresAt } = await minioService.uploadFile(
      fileBuffer,
      file.name,
      mimeType,
      user.githubId  // 使用GitHub ID进行路径隔离
    );

    // Generate metadata
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

    // Create record with user association
    const result = await prisma.file.create({
      data: {
        userId: user.id,
        filename: file.name,
        minioPath: objectName,
        fileSize: file.size,
        mimeType,
        fileType,
        thumbnailData,
        thumbnailPath: thumbnailData ? 'database' : null,
        pinyin: generatePinyin(file.name),
        width,
        height,
        configId: usedConfigId,
        expiresAt: expiresAt || (expiresAtStr ? new Date(expiresAtStr) : null),
      },
    });

    // Update user quotas
    await Promise.all([
      updateStorageUsage(user.id, file.size),
      updateFileCount(user.id, 1),
    ]);

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'FILE_UPLOADED',
        targetType: 'File',
        targetId: result.id,
        metadata: JSON.stringify({ filename: file.name, fileSize: file.size }),
      }
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { error: 'Failed to upload file', message: String(error) },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { error, user } = await requireAuth();
  if (error) return error;
  
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const fileType = searchParams.get('fileType');
    const search = searchParams.get('search');
    const configId = searchParams.get('configId');

    // Determine effective config IDs for filtering (Storage Identity Sharing)
    let filterConfigIds: string[] | undefined = undefined;
    
    // 获取活动配置 ID
    const activeIdRes = await prisma.config.findUnique({
      where: {
        userId_key: { userId: user.id, key: 'minio_active_id' }
      }
    });

    const activeConfigId = configId || activeIdRes?.value;

    // 存储身份共享：相同 AccessKey + Bucket + BaseDir 的配置可以共享文件
    if (activeConfigId) {
      // 获取当前活动配置
      const activeConfigRecord = await prisma.config.findUnique({
        where: {
          userId_key: { userId: user.id, key: `minio_${activeConfigId}` }
        }
      });

      if (activeConfigRecord) {
        const activeConfig = JSON.parse(activeConfigRecord.value);
        
        // 获取用户的所有 MinIO 配置
        const allConfigRecords = await prisma.config.findMany({
          where: {
            userId: user.id,
            key: { startsWith: 'minio_' },
            NOT: {
              key: { in: ['minio_active_id', 'minio_configs'] }
            }
          }
        });

        // 找出所有与当前配置属于同一存储组的配置
        const storageGroupConfigs = allConfigRecords
          .map(record => {
            try {
              return { id: JSON.parse(record.value).id, config: JSON.parse(record.value) };
            } catch {
              return null;
            }
          })
          .filter((item): item is { id: string; config: MinioConfig } => item !== null)
          .filter(item => 
            item.config.accessKey === activeConfig.accessKey &&
            item.config.bucket === activeConfig.bucket &&
            (item.config.baseDir || '') === (activeConfig.baseDir || '')
          );

        filterConfigIds = storageGroupConfigs.map(item => item.id);
      } else {
        // 如果找不到配置，只显示该 ID 的文件
        filterConfigIds = [activeConfigId];
      }
    }

    const where = {
      userId: user.id,  // Only show current user's files
      ...(fileType && { fileType }),
      ...(filterConfigIds && { configId: { in: filterConfigIds } }),
      ...(search && {
        OR: [
          { filename: { contains: search } },
          { pinyin: { contains: search.toLowerCase() } },
        ],
      }),
    };


    const [files, total] = await Promise.all([
      prisma.file.findMany({
        where,
        select: {
          id: true,
          filename: true,
          minioPath: true,
          fileSize: true,
          mimeType: true,
          fileType: true,
          thumbnailPath: true,
          width: true,
          height: true,
          duration: true,
          configId: true,
          expiresAt: true,
          createdAt: true,
          updatedAt: true,
          // Explicitly exclude thumbnailData as it's too large for list view
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.file.count({ where }),
    ]);

    return NextResponse.json({
      files,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('Error getting files:', error);
    return NextResponse.json(
      { error: 'Failed to get files' },
      { status: 500 }
    );
  }
}
export async function DELETE(request: NextRequest) {
  const { error, user } = await requireAuth();
  if (error) return error;
  
  try {
    const body = await request.json();
    const { ids } = body;
    const { searchParams } = new URL(request.url);
    const deleteMode = searchParams.get('deleteMode') || 'record-only'; // 'full' | 'record-only'
    
    
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'No IDs provided' }, { status: 400 });
    }

    // Fetch files and verify ownership
    const files = await prisma.file.findMany({
      where: {
        id: { in: ids },
        userId: user.id,  // Only allow deleting own files
      },
    });

    if (files.length === 0) {
      return NextResponse.json({ error: 'No files found' }, { status: 404 });
    }

    // Step 1: Group by configId to minimize MinIO connections
    const groups: Record<string, typeof files> = {};
    for (const f of files) {
      const cid = f.configId || 'unknown';
      if (!groups[cid]) groups[cid] = [];
      groups[cid].push(f);
    }

    // Step 2: Delete from MinIO per group (only if mode is 'full')
    if (deleteMode === 'full') {
      for (const [configId, groupFiles] of Object.entries(groups)) {
        try {
          // 获取配置
          const configRecord = await prisma.config.findUnique({
            where: {
              userId_key: { userId: user.id, key: `minio_${configId}` }
            }
          });
          const config = configRecord ? JSON.parse(configRecord.value) : null;

          if (config) {
            const minioService = new MinioService();
            await minioService.connect(config);
            
            const deleteBatch = [];
            for (const f of groupFiles) {
              deleteBatch.push(minioService.deleteFile(f.minioPath).catch(() => {}));
              if (f.thumbnailPath && f.thumbnailPath !== 'database') {
                deleteBatch.push(minioService.deleteFile(f.thumbnailPath).catch(() => {}));
              }
            }
            await Promise.all(deleteBatch);
          }
        } catch (err) {
          console.error(`Failed to delete MinIO group ${configId}:`, err);
        }
      }
    }

    // Delete database records
    await prisma.file.deleteMany({
      where: {
        id: { in: ids },
        userId: user.id,
      },
    });

    // Update user quotas - 使用BigInt避免溢出
    const totalSize = files.reduce((sum, f) => sum + BigInt(f.fileSize), BigInt(0));
    console.log('[删除文件配额更新]', {
      userId: user.id,
      filesCount: files.length,
      totalSize: totalSize.toString()
    });
    
    await Promise.all([
      updateStorageUsage(user.id, -totalSize),  // 直接传递BigInt
      updateFileCount(user.id, -files.length),
    ]);

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'FILE_DELETED',
        targetType: 'File',
        metadata: JSON.stringify({ count: files.length, totalSize: totalSize.toString() }),
      }
    });

    return NextResponse.json({ success: true, deletedCount: files.length });
  } catch (error) {
    console.error('Batch delete failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
