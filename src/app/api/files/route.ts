import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MinioService, MinioConfig } from '@/lib/minio';
import { generateThumbnail, generateVideoThumbnail, getImageDimensions, getFileType, generatePinyin } from '@/lib/image-utils';

export async function POST(request: NextRequest) {
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

    // Determine config to use
    let config: StoredMinioConfig | null = null;
    let usedConfigId = 'minio_default';

    if (configId === 'minio_default') {
      const dbConfig = await prisma.config.findUnique({
        where: { key: 'minio_default' },
      });
      if (dbConfig) {
        config = JSON.parse(dbConfig.value);
      }
    } else {
      const configsRecord = await prisma.config.findUnique({
        where: { key: 'minio_configs' },
      });
      if (configsRecord) {
        const configs: StoredMinioConfig[] = JSON.parse(configsRecord.value);
        const target = configs.find(c => c.id === configId);
        if (target) {
          config = target;
          usedConfigId = configId;
        }
      }
    }

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
      mimeType
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
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const fileType = searchParams.get('fileType');
    const search = searchParams.get('search');
    const configId = searchParams.get('configId');

    interface StoredMinioConfig extends MinioConfig {
      id: string;
      name: string;
    }

    // Determine effective config IDs for filtering (Storage Identity Sharing)
    let filterConfigIds: string[] | undefined = undefined;
    
    // Check if we are in multi-config mode
    const [configsRes, activeIdRes] = await Promise.all([
      prisma.config.findUnique({ where: { key: 'minio_configs' } }),
      prisma.config.findUnique({ where: { key: 'minio_active_id' } }),
    ]);

    const activeConfigId = configId || activeIdRes?.value;

    if (activeConfigId && configsRes && configsRes.value) {
      const allConfigs: StoredMinioConfig[] = JSON.parse(configsRes.value);
      const targetConfig = allConfigs.find(c => c.id === activeConfigId);

      if (targetConfig) {
        // Form a storage identity group: Same AccessKey + Bucket + BaseDir
        // This allows sharing files between Local and Remote endpoints for same bucket
        const sharedGroup = allConfigs.filter(c => 
          c.accessKey === targetConfig.accessKey && 
          c.bucket === targetConfig.bucket &&
          (c.baseDir || '') === (targetConfig.baseDir || '')
        );
        filterConfigIds = sharedGroup.map(c => c.id);
      } else if (activeConfigId === 'minio_default') {
        filterConfigIds = ['minio_default'];
      }
    } else if (activeConfigId) {
      filterConfigIds = [activeConfigId];
    }

    const where = {
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
  try {
    const body = await request.json();
    const { ids } = body;
    const { searchParams } = new URL(request.url);
    const deleteMode = searchParams.get('deleteMode') || 'record-only'; // 'full' | 'record-only'
    
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'No IDs provided' }, { status: 400 });
    }

    const files = await prisma.file.findMany({
      where: { id: { in: ids } },
    });

    if (files.length === 0) {
      return NextResponse.json({ error: 'No files found' }, { status: 404 });
    }

    // Step 1: Group by configId to minimize MinIO connections
    const groups: Record<string, typeof files> = {};
    for (const f of files) {
      const cid = f.configId || 'minio_default';
      if (!groups[cid]) groups[cid] = [];
      groups[cid].push(f);
    }

    // Step 2: Delete from MinIO per group (only if mode is 'full')
    if (deleteMode === 'full') {
      for (const [configId, groupFiles] of Object.entries(groups)) {
        try {
          let config = null;
          if (configId === 'minio_default') {
            const dc = await prisma.config.findUnique({ where: { key: 'minio_default' } });
            if (dc) config = JSON.parse(dc.value);
          } else {
            const mc = await prisma.config.findUnique({ where: { key: 'minio_configs' } });
            if (mc) {
              const list = JSON.parse(mc.value);
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              config = list.find((c: any) => c.id === configId);
            }
          }

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
      where: { id: { in: ids } },
    });

    return NextResponse.json({ success: true, deletedCount: files.length });
  } catch (error) {
    console.error('Batch delete failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
