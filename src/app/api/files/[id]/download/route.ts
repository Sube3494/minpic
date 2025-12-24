import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMinioService } from '@/lib/minio';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const file = await prisma.file.findUnique({
      where: { id },
    });

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Get MinIO config
    let config = null;
    
    // Try to find config from configs list
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
        { error: 'MinIO config not found' },
        { status: 404 }
      );
    }

    const minioService = getMinioService();
    await minioService.connect(config);

    const fileBuffer = await minioService.downloadFile(file.minioPath);

    // 正确编码中文文件名 (RFC 5987)
    const encodedFilename = encodeURIComponent(file.filename);

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': file.mimeType,
        'Content-Disposition': `inline; filename="${file.filename.replace(/[^\x00-\x7F]/g, '_')}"; filename*=UTF-8''${encodedFilename}`,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Error downloading file:', error);
    return NextResponse.json(
      { error: 'Failed to download file' },
      { status: 500 }
    );
  }
}
