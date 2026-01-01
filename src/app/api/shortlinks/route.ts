import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import { MinioService } from '@/lib/minio';
import { ShortlinkService } from '@/lib/shortlink';
import { getUserMinioConfig } from '@/lib/get-user-minio-config';

export async function POST(request: NextRequest) {
  const { user, error } = await requireAuth();
  if (error) return error;

  try {
    const body = await request.json();
    const { fileId, customCode, expiresIn, unit } = body;

    if (!fileId) {
      return NextResponse.json({ error: 'File ID required' }, { status: 400 });
    }

    const file = await prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // 验证所有权
    if (file.userId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get shortlink config (user-level)
    const shortlinkConfig = await prisma.config.findUnique({
      where: { 
        userId_key: { userId: user.id, key: 'shortlink_default' }
      },
    });

    if (!shortlinkConfig) {
      return NextResponse.json(
        { error: 'Shortlink config not found' },
        { status: 400 }
      );
    }

    // 获取 MinIO 配置
    const minioConfig = await getUserMinioConfig(user.id, file.configId);

    if (!minioConfig) {
      return NextResponse.json(
        { error: 'MinIO config not found' },
        { status: 400 }
      );
    }

    // Get file URL
    const minioService = new MinioService();
    await minioService.connect(minioConfig);
    const fileUrl = await minioService.getFileUrl(file.minioPath);

    // Create shortlink (shortlink service will handle MD5 deduplication)
    const sConfig = JSON.parse(shortlinkConfig.value);
    const shortlinkService = new ShortlinkService();
    shortlinkService.setConfig(sConfig);
    
    // Pass expires_in and unit directly to service
    const shortlink = await shortlinkService.createShortlink(
      fileUrl, 
      customCode, 
      expiresIn !== undefined ? Number(expiresIn) : undefined,
      unit as 'minutes' | 'hours' | 'days'
    );

    return NextResponse.json(shortlink);
  } catch (error) {
    console.error('Error creating shortlink:', error);
    return NextResponse.json(
      { error: 'Failed to create shortlink', message: String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  const { user, error } = await requireAuth();
  if (error) return error;

  try {
    // Get shortlink config (user-level)
    const shortlinkConfig = await prisma.config.findUnique({
      where: { 
        userId_key: { userId: user.id, key: 'shortlink_default' }
      },
    });

    if (!shortlinkConfig) {
      return NextResponse.json({ shortlinks: [] });
    }

    const sConfig = JSON.parse(shortlinkConfig.value);
    const shortlinkService = new ShortlinkService();
    shortlinkService.setConfig(sConfig);

    // Get all shortlinks from shortlink service
    const shortlinks = await shortlinkService.listShortlinks();

    return NextResponse.json({ shortlinks });
  } catch (error) {
    console.error('Error getting shortlinks:', error);
    return NextResponse.json(
      { error: 'Failed to get shortlinks' },
      { status: 500 }
    );
  }
}
