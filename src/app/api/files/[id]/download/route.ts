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
    const minioConfig = await prisma.config.findUnique({
      where: { key: file.configId || 'minio_default' },
    });

    if (!minioConfig) {
      return NextResponse.json(
        { error: 'MinIO config not found' },
        { status: 404 }
      );
    }

    const config = JSON.parse(minioConfig.value);
    const minioService = getMinioService();
    await minioService.connect(config);

    const fileBuffer = await minioService.downloadFile(file.minioPath);

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': file.mimeType,
        'Content-Disposition': `attachment; filename="${file.filename}"`,
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
