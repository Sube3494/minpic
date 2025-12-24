import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMinioService } from '@/lib/minio';
import { getShortlinkService } from '@/lib/shortlink';

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

    return NextResponse.json(file);
  } catch (error) {
    console.error('Error getting file:', error);
    return NextResponse.json(
      { error: 'Failed to get file' },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    if (minioConfig) {
      const config = JSON.parse(minioConfig.value);
      const minioService = getMinioService();
      await minioService.connect(config);

      // Delete main file
      await minioService.deleteFile(file.minioPath);

      // Delete thumbnail if exists
      if (file.thumbnailPath) {
        try {
          await minioService.deleteFile(file.thumbnailPath);
        } catch (error) {
          console.error('Error deleting thumbnail:', error);
        }
      }
    }

    // Delete shortlink if exists
    if (file.shortlinkCode) {
      const shortlinkConfig = await prisma.config.findUnique({
        where: { key: 'shortlink_default' },
      });

      if (shortlinkConfig) {
        try {
          const config = JSON.parse(shortlinkConfig.value);
          const shortlinkService = getShortlinkService();
          shortlinkService.setConfig(config);
          await shortlinkService.deleteShortlink(file.shortlinkCode);
        } catch (error) {
          console.error('Error deleting shortlink:', error);
        }
      }
    }

    // Delete database record
    await prisma.file.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting file:', error);
    return NextResponse.json(
      { error: 'Failed to delete file' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { filename, tags } = body;

    const file = await prisma.file.update({
      where: { id },
      data: {
        ...(filename && { filename }),
        ...(tags && { tags: JSON.stringify(tags) }),
      },
    });

    return NextResponse.json(file);
  } catch (error) {
    console.error('Error updating file:', error);
    return NextResponse.json(
      { error: 'Failed to update file' },
      { status: 500 }
    );
  }
}
