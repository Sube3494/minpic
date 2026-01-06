import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MinioService } from '@/lib/minio';
import { generateThumbnail, generateVideoThumbnail, getImageDimensions, getFileType, generatePinyin } from '@/lib/image-utils';
import { requireAuth } from '@/lib/auth-utils';
import { checkStorageQuota, checkFileQuota, updateStorageUsage, updateFileCount } from '@/lib/team-quota';
import { checkRateLimit } from '@/lib/rate-limit';
import { rateLimitResponse } from '@/lib/rate-limit-response';
import { getUserMinioConfig, getStorageIdentityConfigIds } from '@/lib/get-user-minio-config';
import { decryptMinioConfig } from '@/lib/config-encryption';
import { serializeBigInt } from '@/lib/utils';

export async function POST(request: NextRequest) {
  // Get dynamic rate limit
  const settings = await prisma.systemSettings.findFirst();
  const limit = settings?.uploadRateLimit || 100;

  // Rate limiting
  const rateLimit = checkRateLimit(request, { limit, windowMs: 60000 });
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.resetTime);
  }

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

    // Fast Quota Check
    const contentLength = request.headers.get('content-length');
    if (contentLength) {
      const estimatedSize = parseInt(contentLength);
      if (estimatedSize > 0) {
        const quotaCheck = await checkStorageQuota(user.id, estimatedSize, 0, configId);
        if (!quotaCheck.allowed) {
          return NextResponse.json({ 
            error: quotaCheck.reason,
            details: 'Upload blocked early by server quota check' 
          }, { status: 403 });
        }
      }
    }

    // Check file quota
    const fileQuotaCheck = await checkFileQuota(user.id, 0, configId);
    if (!fileQuotaCheck.allowed) {
      return NextResponse.json({ error: fileQuotaCheck.reason }, { status: 403 });
    }

    // Get user's MinIO config using refactored utility
    const config = await getUserMinioConfig(user.id, configId);
    if (!config) {
      return NextResponse.json({ error: 'Invalid config' }, { status: 400 });
    }

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
      user.githubId
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

    // Create record
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
        configId: config.id,
        expiresAt: expiresAt || (expiresAtStr ? new Date(expiresAtStr) : null),
      },
      select: {
        id: true,
        userId: true,
        filename: true,
        minioPath: true,
        fileSize: true,
        mimeType: true,
        fileType: true,
        thumbnailPath: true,
        // thumbnailData: false, // 明确排除大字段,减少传输开销
        width: true,
        height: true,
        duration: true,
        tags: true,
        pinyin: true,
        configId: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    // Update quotas
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

    return NextResponse.json(serializeBigInt(result));
  } catch (error) {
    // Handle file exists error gracefully
    if (error instanceof Error && error.message === 'FILE_EXISTS') {
      return NextResponse.json(
        { error: '文件已存在', message: '该文件名已存在于存储桶中，请修改配置或重命名文件' },
        { status: 409 }
      );
    }
    
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

    // Determine effective config IDs for filtering using refactored utility
    let filterConfigIds: string[] | undefined = undefined;
    const activeConfig = await getUserMinioConfig(user.id, configId);
    
    if (activeConfig) {
      filterConfigIds = await getStorageIdentityConfigIds(user.id, activeConfig);
    }

    const where = {
      userId: user.id,
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
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.file.count({ where }),
    ]);

    return NextResponse.json(serializeBigInt({
      files,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    }));
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
    const deleteMode = searchParams.get('deleteMode') || 'record-only';
    
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'No IDs provided' }, { status: 400 });
    }

    const files = await prisma.file.findMany({
      where: {
        id: { in: ids },
        userId: user.id,
      },
    });

    if (files.length === 0) {
      return NextResponse.json({ error: 'No files found' }, { status: 404 });
    }

    // Step 1: Group by configId
    const groups: Record<string, typeof files> = {};
    for (const f of files) {
      const cid = f.configId || 'unknown';
      if (!groups[cid]) groups[cid] = [];
      groups[cid].push(f);
    }

    // Step 2: 批量加载所有需要的配置 (避免 N+1 查询)
    const configIds = Object.keys(groups).filter(id => id !== 'unknown');
    const configRecords = await prisma.config.findMany({
      where: {
        userId: user.id,
        key: { in: configIds.map(id => `minio_${id}`) }
      }
    });
    
    // 构建配置映射
    const configMap = new Map<string, any>();
    for (const record of configRecords) {
      try {
        const config = JSON.parse(record.value);
        const decrypted = decryptMinioConfig(config);
        const configId = record.key.replace('minio_', '');
        configMap.set(configId, decrypted);
      } catch (err) {
        console.error(`Failed to parse config ${record.key}:`, err);
      }
    }

    // Step 3: Delete from MinIO per group
    if (deleteMode === 'full') {
      for (const [configId, groupFiles] of Object.entries(groups)) {
        if (configId === 'unknown') continue;
        
        try {
          const config = configMap.get(configId);
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

    // Update quotas
    const totalSize = files.reduce((sum, f) => sum + BigInt(f.fileSize), BigInt(0));
    
    await Promise.all([
      updateStorageUsage(user.id, -totalSize),
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
