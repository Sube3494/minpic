import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMinioService } from '@/lib/minio';
import { getShortlinkService } from '@/lib/shortlink';

export async function POST(request: NextRequest) {
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

    // Get shortlink config
    const shortlinkConfig = await prisma.config.findUnique({
      where: { key: 'shortlink_default' },
    });

    if (!shortlinkConfig) {
      return NextResponse.json(
        { error: 'Shortlink config not found' },
        { status: 400 }
      );
    }

    // Get MinIO config
    let minioConfig = null;
    
    if (file.configId) {
      const configsRecord = await prisma.config.findUnique({
        where: { key: 'minio_configs' },
      });
      
      if (configsRecord) {
        const configs = JSON.parse(configsRecord.value);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        minioConfig = configs.find((c: any) => c.id === file.configId);
      }
    }
    
    if (!minioConfig) {
      const defaultConfig = await prisma.config.findUnique({
        where: { key: 'minio_default' },
      });
      
      if (defaultConfig) {
        minioConfig = JSON.parse(defaultConfig.value);
      }
    }

    if (!minioConfig) {
      return NextResponse.json(
        { error: 'MinIO config not found' },
        { status: 400 }
      );
    }

    // Get file URL
    const minioService = getMinioService();
    await minioService.connect(minioConfig);
    const fileUrl = await minioService.getFileUrl(file.minioPath);

    // Create shortlink (shortlink service will handle MD5 deduplication)
    const sConfig = JSON.parse(shortlinkConfig.value);
    const shortlinkService = getShortlinkService();
    shortlinkService.setConfig(sConfig);
    
    // Calculate expires_in based on user input
    let expiresInHours = 24; 
    
    if (expiresIn !== undefined && unit) {
      if (unit === 'minutes') {
        expiresInHours = expiresIn / 60;
      } else if (unit === 'hours') {
        expiresInHours = expiresIn;
      } else if (unit === 'days') {
        expiresInHours = expiresIn * 24;
      }
    }
    
    const shortlink = await shortlinkService.createShortlink(fileUrl, customCode, expiresInHours);

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
    // Get shortlink config
    const shortlinkConfig = await prisma.config.findUnique({
      where: { key: 'shortlink_default' },
    });

    if (!shortlinkConfig) {
      return NextResponse.json({ shortlinks: [] });
    }

    const sConfig = JSON.parse(shortlinkConfig.value);
    const shortlinkService = getShortlinkService();
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
