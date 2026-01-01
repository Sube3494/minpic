import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import { serializeBigInt } from '@/lib/utils';

/**
 * 重新计算用户的配额使用量
 * 管理员专用API
 */
export async function POST(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    let userId = null;
    try {
      const body = await request.json();
      userId = body?.userId;
      } catch {
        // Ignore errors for individual users
      }

    // 如果指定了userId,只重算该用户;否则重算所有用户
    const userIds = userId 
      ? [userId] 
      : (await prisma.user.findMany({ select: { id: true } })).map(u => u.id);

    const results = [];

    for (const uid of userIds) {
      // 计算该用户的实际文件总大小和数量
      const stats = await prisma.file.aggregate({
        where: { userId: uid },
        _sum: { fileSize: true },
        _count: true
      });

      const actualStorageUsed = BigInt(stats._sum.fileSize || 0);
      const actualFileCount = stats._count;

      // 更新用户配额
      await prisma.user.update({
        where: { id: uid },
        data: {
          storageUsed: actualStorageUsed,
          fileCount: actualFileCount
        }
      });

      results.push({
        userId: uid,
        actualStorageUsed,
        actualFileCount
      });


    }

    return NextResponse.json(serializeBigInt({
      success: true,
      recalculated: results.length,
      results
    }));

  } catch (error) {
    console.error('配额重算失败:', error);
    return NextResponse.json(
      { error: '配额重算失败', message: String(error) },
      { status: 500 }
    );
  }
}
