import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMinioService } from '@/lib/minio';
import { getShortlinkService } from '@/lib/shortlink';
import { generatePinyin } from '@/lib/image-utils';

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

    if (config) {
      const minioService = getMinioService();
      await minioService.connect(config);

      const minioDeletePromises = []; // Restore this line

      // Delete main file
      minioDeletePromises.push(
        minioService.deleteFile(file.minioPath).catch(error => {
          console.error('Error deleting main file:', error);
        })
      );
      
      // Thumbnail is now stored in DB (cascade delete) or was separate path. 
      // For legacy files with thumbnailPath, we ideally should delete from MinIO too.
      // But user asked to "delete together" implying DB delete handles it.
      // I will keep the legacy deletion for `thumbnailPath` just in case, 
      // but `thumbnailData` in DB needs no extra action.
      if (file.thumbnailPath) {
        minioDeletePromises.push(
          minioService.deleteFile(file.thumbnailPath).catch(error => {
            console.error('Error deleting legacy thumbnail:', error);
          })
        );
      }

      await Promise.all(minioDeletePromises);
    }

    // Delete shortlink if exists (parallel with database delete)
    const deletePromises = [];
    
    if (file.shortlinkCode) {
      const shortlinkDeletePromise = (async () => {
        const shortlinkConfig = await prisma.config.findUnique({
          where: { key: 'shortlink_default' },
        });

        if (shortlinkConfig) {
          try {
            const config = JSON.parse(shortlinkConfig.value);
            const shortlinkService = getShortlinkService();
            shortlinkService.setConfig(config);
            await shortlinkService.deleteShortlink(file.shortlinkCode!);
          } catch (error) {
            console.error('Error deleting shortlink:', error);
          }
        }
      })();
      
      deletePromises.push(shortlinkDeletePromise);
    }

    // Delete database record
    deletePromises.push(
      prisma.file.delete({
        where: { id },
      })
    );

    await Promise.all(deletePromises);

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
        ...(filename && { 
          filename,
          pinyin: generatePinyin(filename)
        }),
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
