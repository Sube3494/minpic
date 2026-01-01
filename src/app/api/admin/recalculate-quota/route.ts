import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';

/**
 * 重新计算用户的配额使用量
 * 管理员专用API
 */
export async function POST(request: NextRequest) {
  const { error, user } = await requireAuth(['ADMIN']);
  if (error) return error;

  try {
    const { userId } = await request.json();

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
        actualStorageUsed: actualStorageUsed.toString(),
        actualFileCount
      });

      console.log(`[配额重算] userId: ${uid}, storageUsed: ${actualStorageUsed}, fileCount: ${actualFileCount}`);
    }

    return NextResponse.json({
      success: true,
      recalculated: results.length,
      results
    });

  } catch (error) {
    console.error('配额重算失败:', error);
    return NextResponse.json(
      { error: '配额重算失败', message: String(error) },
      { status: 500 }
    );
  }
}
