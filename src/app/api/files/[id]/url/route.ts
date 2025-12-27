import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MinioService } from '@/lib/minio';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Get file from database
    const file = await prisma.file.findUnique({
      where: { id },
    });

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Get MinIO config
    let config = null;
    
    if (file.configId) {
      const configsRecord = await prisma.config.findUnique({
        where: { key: 'minio_configs' },
      });
      
      if (configsRecord) {
        const configs = JSON.parse(configsRecord.value);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        config = configs.find((c: any) => c.id === file.configId);
      }
    }
    
    // Fallback to default config
    if (!config) {
      const defaultConfig = await prisma.config.findUnique({
        where: { key: 'minio_default' },
      });
      
      if (defaultConfig) {
        config = JSON.parse(defaultConfig.value);
      }
    }

    if (!config) {
      return NextResponse.json(
        { error: 'MinIO configuration not found' },
        { status: 400 }
      );
    }

    // Get direct URL from MinIO
    const minioService = new MinioService();
    await minioService.connect(config);
    const url = await minioService.getFileUrl(file.minioPath);

    return NextResponse.json({ url });
  } catch (error) {
    console.error('Error getting file URL:', error);
    return NextResponse.json(
      { error: 'Failed to get file URL' },
      { status: 500 }
    );
  }
}
