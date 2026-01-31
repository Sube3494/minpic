import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import { ShortlinkService } from '@/lib/shortlink';

// Helper function to calculate expiration time
function calculateExpiresAt(expiresIn: number, unit: 'minutes' | 'hours' | 'days'): Date {
  const now = new Date();
  let milliseconds = 0;
  
  switch (unit) {
    case 'minutes':
      milliseconds = expiresIn * 60 * 1000;
      break;
    case 'hours':
      milliseconds = expiresIn * 60 * 60 * 1000;
      break;
    case 'days':
      milliseconds = expiresIn * 24 * 60 * 60 * 1000;
      break;
  }
  
  return new Date(now.getTime() + milliseconds);
}

// POST /api/collections/[id]/share - Activate sharing for a collection
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireAuth();
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json();
    const { expiresIn, unit } = body as {
      expiresIn: number;
      unit: 'minutes' | 'hours' | 'days';
    };

    if (!expiresIn || !unit) {
      return NextResponse.json(
        { error: 'expiresIn and unit are required' },
        { status: 400 }
      );
    }

    // Verify collection ownership
    const collection = await prisma.collection.findUnique({
      where: { id },
    });

    if (!collection) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      );
    }

    if (collection.userId !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Get shortlink configuration
    const shortlinkConfig = await prisma.config.findUnique({
      where: {
        userId_key: { userId: user.id, key: 'shortlink_default' },
      },
    });

    let shortUrl: string;
    let shortCode: string | undefined;
    const baseUrl = process.env.NEXTAUTH_URL || `${request.nextUrl.protocol}//${request.nextUrl.host}`;
    const collectionUrl = `${baseUrl}/c/${collection.id}`;

    if (shortlinkConfig) {
      const sConfig = JSON.parse(shortlinkConfig.value);
      
      if (sConfig.enabled !== false) {
        // Generate shortlink via external service
        const shortlinkService = new ShortlinkService();
        shortlinkService.setConfig(sConfig);

        const shortlink = await shortlinkService.createShortlink(
          collectionUrl,
          undefined,
          expiresIn,
          unit,
          collection.name || `多选分享 (${collection.fileCount}个文件)`
        );

        shortUrl = shortlink.short_url;
        shortCode = shortlink.short_code;
      } else {
        // Shortlink service disabled, use direct URL
        shortUrl = collectionUrl;
      }
    } else {
      // No shortlink config, use direct URL
      shortUrl = collectionUrl;
    }

    // Calculate expiration time and update collection
    const expiresAt = calculateExpiresAt(expiresIn, unit);
    const updatedCollection = await prisma.collection.update({
      where: { id },
      data: {
        shortCode,
        shortUrl,
        expiresAt,
        isShared: true,
        sharedAt: new Date(),
      },
    });

    return NextResponse.json({
      id: updatedCollection.id,
      shortCode: updatedCollection.shortCode,
      shortUrl: updatedCollection.shortUrl,
      expiresAt: updatedCollection.expiresAt?.toISOString(),
      isShared: updatedCollection.isShared,
    });
  } catch (error) {
    console.error('Error activating collection share:', error);
    return NextResponse.json(
      { error: 'Failed to activate sharing', message: String(error) },
      { status: 500 }
    );
  }
}

// DELETE /api/collections/[id]/share - Deactivate sharing for a collection
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireAuth();
  if (error) return error;

  try {
    const { id } = await params;

    // Verify collection ownership
    const collection = await prisma.collection.findUnique({
      where: { id },
    });

    if (!collection) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      );
    }

    if (collection.userId !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Optionally delete the shortlink from external service
    if (collection.shortCode) {
      try {
        const shortlinkConfig = await prisma.config.findUnique({
          where: {
            userId_key: { userId: user.id, key: 'shortlink_default' },
          },
        });

        if (shortlinkConfig) {
          const sConfig = JSON.parse(shortlinkConfig.value);
          if (sConfig.enabled !== false) {
            const shortlinkService = new ShortlinkService();
            shortlinkService.setConfig(sConfig);
            await shortlinkService.deleteShortlink(collection.shortCode);
          }
        }
      } catch (e) {
        console.error('Failed to delete shortlink from service:', e);
        // Continue even if shortlink deletion fails
      }
    }

    // Update collection to private state
    const updatedCollection = await prisma.collection.update({
      where: { id },
      data: {
        shortCode: null,
        shortUrl: null,
        expiresAt: null,
        isShared: false,
        sharedAt: null,
      },
    });

    return NextResponse.json({
      id: updatedCollection.id,
      isShared: updatedCollection.isShared,
      message: 'Sharing deactivated successfully',
    });
  } catch (error) {
    console.error('Error deactivating collection share:', error);
    return NextResponse.json(
      { error: 'Failed to deactivate sharing', message: String(error) },
      { status: 500 }
    );
  }
}
