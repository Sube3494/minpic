import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MinioService } from '@/lib/minio';
import { getShortlinkService } from '@/lib/shortlink';
import { generateThumbnail, generateVideoThumbnail, getImageDimensions, getFileType, generatePinyin } from '@/lib/image-utils';

export async function POST(request: NextRequest) {
  try {
    // ... existing metadata extraction ...
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const configId = formData.get('configId') as string;
    const expiresAtStr = formData.get('expiresAt') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Determine MinIO config to use
    let minioConfigValue = null;
    let usedConfigId = 'minio_default';

    if (configId) {
      // Try to find specific config from the list
      const configsRecord = await prisma.config.findUnique({
        where: { key: 'minio_configs' },
      });
      
      if (configsRecord && configsRecord.value) {
        const configs = JSON.parse(configsRecord.value);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const targetConfig = configs.find((c: any) => c.id === configId);
        if (targetConfig) {
          minioConfigValue = targetConfig;
          usedConfigId = configId;
        }
      }
    }

    // Fallback to default if no specific config found or requested
    if (!minioConfigValue) {
        const minioDefault = await prisma.config.findUnique({
          where: { key: 'minio_default' },
        });
        
        if (minioDefault) {
            minioConfigValue = JSON.parse(minioDefault.value);
        }
    }

    if (!minioConfigValue) {
      return NextResponse.json(
        { error: 'MinIO not configured' },
        { status: 400 }
      );
    }

    // Use a new instance to avoid singleton side effects with concurrent requests using different configs
    const minioService = new MinioService();
    await minioService.connect(minioConfigValue);

    // Upload file
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type;
    const fileType = getFileType(mimeType);

    if (!fileType) {
      return NextResponse.json(
        { error: 'Unsupported file type' },
        { status: 400 }
      );
    }

    const { objectName, expiresAt } = await minioService.uploadFile(
      fileBuffer,
      file.name,
      mimeType
    );

    // Generate thumbnail
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
      // Generate thumbnail for video
      thumbnailData = await generateVideoThumbnail(fileBuffer);
    }

    // Create database record
    const fileRecord = await prisma.file.create({
      data: {
        filename: file.name,
        minioPath: objectName,
        fileSize: file.size,
        mimeType,
        fileType,
        thumbnailData, // Store binary data
        thumbnailPath: thumbnailData ? 'database' : null, // Mark that we have thumbnail in DB
        pinyin: generatePinyin(file.name),
        width,
        height,
        configId: usedConfigId,
        expiresAt: expiresAtStr || expiresAt ? new Date(expiresAtStr || expiresAt!) : null,
      },
    });

    // Auto-generate shortlink if configured
    const shortlinkConfig = await prisma.config.findUnique({
      where: { key: 'shortlink_default' },
    });

    if (shortlinkConfig) {
      const slConfig = JSON.parse(shortlinkConfig.value);
      if (slConfig.enabled) {
        try {
          const fileUrl = await minioService.getFileUrl(objectName);
          const shortlinkService = getShortlinkService();
          shortlinkService.setConfig(slConfig);
          
          // Use configured expires_in (hours), default to undefined for permanent
          const expiresIn = slConfig.expiresIn && slConfig.expiresIn > 0 ? slConfig.expiresIn : undefined;
          
          let shortlink = null;
          let retryCount = 0;
          const maxRetries = 3;

          while (retryCount < maxRetries && !shortlink) {
            try {
              shortlink = await shortlinkService.createShortlink(fileUrl, undefined, expiresIn);
            } catch (err) {
              retryCount++;
              console.error(`Attempt ${retryCount} failed to generate shortlink:`, err);
              if (retryCount < maxRetries) {
                await new Promise(r => setTimeout(r, 1000));
              }
            }
          }
          
          if (shortlink) {
            // Update file record with shortlink
            await prisma.file.update({
              where: { id: fileRecord.id },
              data: { shortlinkCode: shortlink.short_code },
            });

            return NextResponse.json({
              ...fileRecord,
              shortlinkCode: shortlink.short_code,
              shortlink: shortlink.short_url,
            });
          }
        } catch (error) {
          console.error('Error in shortlink generation process:', error);
          // Continue without shortlink
        }
      }
    }

    return NextResponse.json(fileRecord);
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

    // Determine effective active config ID for strict filtering
    let filterConfigId: string | undefined = undefined;
    
    // Check if we are in multi-config mode
    const [configsRes, activeIdRes] = await Promise.all([
      prisma.config.findUnique({ where: { key: 'minio_configs' } }),
      prisma.config.findUnique({ where: { key: 'minio_active_id' } }),
    ]);

    if (configsRes && configsRes.value) {
      // Multi-config mode active
      const configs = JSON.parse(configsRes.value);
      if (configs.length > 0) {
        if (activeIdRes && activeIdRes.value) {
           filterConfigId = activeIdRes.value;
        } else {
           // Fallback to first config if no active ID recorded (default behavior)
           filterConfigId = configs[0].id;
        }
      }
    }

    const where = {
      ...(fileType && { fileType }),
      ...(filterConfigId !== undefined && { configId: filterConfigId }),
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
          shortlinkCode: true,
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
    const { ids } = await request.json();
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

    // Step 2: Delete from MinIO per group
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

    // Step 3: Delete shortlinks and DB records
    const shortlinkCodes = files.filter(f => f.shortlinkCode).map(f => f.shortlinkCode!);
    if (shortlinkCodes.length > 0) {
      try {
        const sc = await prisma.config.findUnique({ where: { key: 'shortlink_default' } });
        if (sc) {
          const slConfig = JSON.parse(sc.value);
          const service = getShortlinkService();
          service.setConfig(slConfig);
          // Delete in parallel
          await Promise.all(shortlinkCodes.map(code => service.deleteShortlink(code).catch(() => {})));
        }
      } catch (err) {
        console.error('Failed to delete shortlinks:', err);
      }
    }

    await prisma.file.deleteMany({
      where: { id: { in: ids } },
    });

    return NextResponse.json({ success: true, deletedCount: files.length });
  } catch (error) {
    console.error('Batch delete failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
