import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMinioService } from '@/lib/minio';
import { getShortlinkService } from '@/lib/shortlink';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileId, customCode } = body;

    if (!fileId) {
      return NextResponse.json({ error: 'File ID required' }, { status: 400 });
    }

    const file = await prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Get MinIO and shortlink configs
    const [minioConfig, shortlinkConfig] = await Promise.all([
      prisma.config.findUnique({
        where: { key: file.configId || 'minio_default' },
      }),
      prisma.config.findUnique({
        where: { key: 'shortlink_default' },
      }),
    ]);

    if (!minioConfig || !shortlinkConfig) {
      return NextResponse.json(
        { error: 'Required configs not found' },
        { status: 400 }
      );
    }

    // Get file URL
    const mConfig = JSON.parse(minioConfig.value);
    const minioService = getMinioService();
    await minioService.connect(mConfig);
    const fileUrl = await minioService.getFileUrl(file.minioPath);

    // Create shortlink
    const sConfig = JSON.parse(shortlinkConfig.value);
    const shortlinkService = getShortlinkService();
    shortlinkService.setConfig(sConfig);
    
    const shortlink = await shortlinkService.createShortlink(fileUrl, customCode);

    // Update file record
    await prisma.file.update({
      where: { id: fileId },
      data: { shortlinkCode: shortlink.short_code },
    });

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
  try {
    const files = await prisma.file.findMany({
      where: {
        shortlinkCode: { not: null },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ shortlinks: files });
  } catch (error) {
    console.error('Error getting shortlinks:', error);
    return NextResponse.json(
      { error: 'Failed to get shortlinks' },
      { status: 500 }
    );
  }
}
