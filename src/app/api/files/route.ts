import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MinioService } from '@/lib/minio';
import { getShortlinkService } from '@/lib/shortlink';
import { generateThumbnail, getImageDimensions, getFileType } from '@/lib/image-utils';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const configId = formData.get('configId') as string;

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

    const objectName = await minioService.uploadFile(
      fileBuffer,
      file.name,
      mimeType
    );

    // Generate thumbnail for images
    let thumbnailPath: string | null = null;
    let width: number | null = null;
    let height: number | null = null;

    if (fileType === 'image') {
      const dimensions = await getImageDimensions(fileBuffer);
      if (dimensions) {
        width = dimensions.width;
        height = dimensions.height;
      }

      const thumbnail = await generateThumbnail(fileBuffer, mimeType);
      if (thumbnail) {
        thumbnailPath = await minioService.uploadFile(
          thumbnail,
          `thumb_${file.name}`,
          'image/webp'
        );
      }
    }

    // Create database record
    const fileRecord = await prisma.file.create({
      data: {
        filename: file.name,
        minioPath: objectName,
        fileSize: file.size,
        mimeType,
        fileType,
        thumbnailPath,
        width,
        height,
        configId: usedConfigId,
      },
    });

    // Auto-generate shortlink if configured
    const shortlinkConfig = await prisma.config.findUnique({
      where: { key: 'shortlink_default' },
    });

    if (shortlinkConfig) {
      const slConfig = JSON.parse(shortlinkConfig.value);
      if (slConfig.autoGenerate) {
        try {
          const fileUrl = await minioService.getFileUrl(objectName);
          const shortlinkService = getShortlinkService();
          shortlinkService.setConfig(slConfig);
          
          const shortlink = await shortlinkService.createShortlink(fileUrl);
          
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
        } catch (error) {
          console.error('Error generating shortlink:', error);
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

    const where = {
      ...(fileType && { fileType }),
      ...(search && {
        filename: {
          contains: search,
        },
      }),
    };

    const [files, total] = await Promise.all([
      prisma.file.findMany({
        where,
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
