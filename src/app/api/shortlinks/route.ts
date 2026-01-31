import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import { ShortlinkService } from '@/lib/shortlink';

// Force dynamic rendering and disable caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

    // Generate local sharing page URL (using shareId/UUID prioritised)
    const baseUrl = process.env.NEXTAUTH_URL || `${request.nextUrl.protocol}//${request.nextUrl.host}`;
    const sharingId = (file as unknown as Record<string, string | null>).shareId || file.id;
    const sharingUrl = `${baseUrl}/f/${sharingId}`;

    // Create shortlink
    const sConfig = JSON.parse(shortlinkConfig.value);
    
    if (sConfig.enabled === false) {
      return NextResponse.json(
        { error: 'Shortlink service is currently disabled' },
        { status: 400 }
      );
    }

    const shortlinkService = new ShortlinkService();
    shortlinkService.setConfig(sConfig);
    
    // Pass expires_in and unit directly to service
    const shortlink = await shortlinkService.createShortlink(
      sharingUrl, 
      customCode,
      expiresIn !== undefined ? Number(expiresIn) : undefined,
      unit as 'minutes' | 'hours' | 'days'
    );

    // Persist shortlink info to File record
    await prisma.file.update({
      where: { id: file.id },
      data: {
        shortCode: shortlink.short_code,
        shortUrl: shortlink.short_url
      } as Record<string, string | null>
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

    // 批量查询优化：先解析所有 ID，然后批量查询
    const fileIds: string[] = [];
    const fileShareIds: string[] = [];
    const collectionIds: string[] = [];
    const collectionCodes: string[] = [];
    const linkTypeMap = new Map<string, { type: 'f' | 'c', id: string }>();

    // 第一步：解析所有链接，收集 ID
    shortlinks.forEach(link => {
      const match = link.original_url.match(/\/(f|c)\/([^\/\?#]+)/);
      if (match && match[2]) {
        const idOrShareId = match[2];
        linkTypeMap.set(link.short_code, { type: match[1] as 'f' | 'c', id: idOrShareId });
        
        // 尝试在文件和合集中都进行批量查询，因为 f/c 路径可能混用了（由于之前的逻辑变更）
        fileIds.push(idOrShareId);
        fileShareIds.push(idOrShareId);
        collectionIds.push(idOrShareId);
        collectionCodes.push(idOrShareId);
      }
    });

    // 第二步：批量查询文件
    const files = await prisma.file.findMany({
      where: {
        OR: [
          { id: { in: fileIds }, userId: user.id },
          { shareId: { in: fileShareIds }, userId: user.id }
        ]
      },
      select: {
        id: true,
        shareId: true,
        filename: true,
        thumbnailPath: true,
        fileType: true,
        createdAt: true,
        shareExpiresAt: true
      }
    });

    // 第三步：批量查询合集
    const collections = await prisma.collection.findMany({
      where: {
        OR: [
          { id: { in: collectionIds }, userId: user.id },
          { shortCode: { in: collectionCodes }, userId: user.id }
        ]
      },
      select: {
        id: true,
        shortCode: true,
        name: true,
        createdAt: true,
        expiresAt: true,
        fileCount: true,
        items: {
          take: 4,
          orderBy: { order: 'asc' },
          select: {
            file: {
              select: {
                id: true,
                thumbnailPath: true
              }
            }
          }
        }
      }
    });

    // 第四步：创建查找映射
    const fileMap = new Map();
    files.forEach(file => {
      fileMap.set(file.id, file);
      if (file.shareId) fileMap.set(file.shareId, file);
    });

    const collectionMap = new Map();
    collections.forEach(col => {
      collectionMap.set(col.id, col);
      if (col.shortCode) collectionMap.set(col.shortCode, col);
    });

    // 第五步：组合数据
    const shortlinksWithFiles = shortlinks.map(link => {
      const typeInfo = linkTypeMap.get(link.short_code);
      if (!typeInfo) return null;

      try {
        // 优先查找文件（针对单文件分享）
        const file = fileMap.get(typeInfo.id);
        if (file) {
          return {
            ...link,
            fileId: file.id,
            filename: file.filename,
            thumbnail: file.thumbnailPath ? `/api/files/${file.id}/thumbnail` : null,
            thumbnails: file.thumbnailPath ? [`/api/files/${file.id}/thumbnail`] : [],
            fileType: file.fileType,
            dbCreatedAt: file.createdAt.toISOString(),
            expiresAt: file.shareExpiresAt?.toISOString()
          };
        }
        
        // 找不到文件，查找合集（针对合集分享或多文件分享）
        const collection = collectionMap.get(typeInfo.id);
        if (collection) {
          const thumbnails = collection.items
            .map((item: { file: { id: string; thumbnailPath: string | null } | null }) => item.file?.thumbnailPath ? `/api/files/${item.file.id}/thumbnail` : null)
            .filter(Boolean) as string[];

          return {
            ...link,
            id: collection.id,
            filename: collection.name || `多选分享 (${collection.fileCount}个文件)`,
            thumbnail: thumbnails[0] || null,
            thumbnails: thumbnails,
            fileType: 'collection',
            dbCreatedAt: collection.createdAt.toISOString(),
            expiresAt: collection.expiresAt?.toISOString()
          };
        }
      } catch (e) {
        console.error('Failed to link data for shortlink:', e);
      }

      return null;
    }).filter(link => link !== null);
 
    return NextResponse.json({ shortlinks: shortlinksWithFiles });
  } catch (error) {
    console.error('Error getting shortlinks:', error);
    return NextResponse.json(
      { error: 'Failed to get shortlinks' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const { user, error } = await requireAuth();
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json({ error: 'Short code required' }, { status: 400 });
    }

    // Get shortlink config
    const shortlinkConfig = await prisma.config.findUnique({
      where: { 
        userId_key: { userId: user.id, key: 'shortlink_default' }
      },
    });

    if (!shortlinkConfig) {
      return NextResponse.json({ error: 'Shortlink config not found' }, { status: 400 });
    }

    const sConfig = JSON.parse(shortlinkConfig.value);
    const shortlinkService = new ShortlinkService();
    shortlinkService.setConfig(sConfig);

    // Delete from shortlink service
    await shortlinkService.deleteShortlink(code);

    // Also clear from File record if it was a file share
    await prisma.file.updateMany({
      where: { 
        userId: user.id,
        shortCode: code
      },
      data: {
        shortCode: null,
        shortUrl: null
      }
    });

    // Or from Collection record
    await prisma.collection.updateMany({
      where: {
        userId: user.id,
        shortCode: code
      },
      data: {
        shortCode: null,
        shortUrl: null,
        isShared: false,
        sharedAt: null
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting shortlink:', error);
    return NextResponse.json(
      { error: 'Failed to delete shortlink', message: String(error) },
      { status: 500 }
    );
  }
}
