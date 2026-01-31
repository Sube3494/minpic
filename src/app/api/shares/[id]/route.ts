import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 1. 尝试查找文件 (通过 shareId 或 id)
    const file = await prisma.file.findFirst({
      where: {
        OR: [
          { shareId: id },
          { id: id }
        ]
      },
      select: { id: true, shareExpiresAt: true, expiresAt: true }
    });

    if (file) {
      const now = new Date();
      if ((file.shareExpiresAt && new Date(file.shareExpiresAt) < now) || 
          (file.expiresAt && new Date(file.expiresAt) < now)) {
        return NextResponse.json({ error: 'Expired' }, { status: 410 });
      }
      return NextResponse.json({ type: 'file', id: file.id });
    }

    // 2. 尝试查找合集 (通过 id 或 shortCode)
    const collection = await prisma.collection.findFirst({
      where: {
        OR: [
          { id: id },
          { shortCode: id }
        ]
      },
      select: { id: true, expiresAt: true, isShared: true }
    });

    if (collection) {
      const now = new Date();
      if (collection.expiresAt && new Date(collection.expiresAt) < now) {
        return NextResponse.json({ error: 'Expired' }, { status: 410 });
      }
      // 如果不是为了分享的目的创建的，或者未开启分享，可能需要逻辑判断
      // 这里根据用户需求：只要是 f/ 开头的访问，如果是合集就显示合集视图
      return NextResponse.json({ type: 'collection', id: collection.id });
    }

    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  } catch (error) {
    console.error('Error in shares API:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
