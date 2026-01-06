import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import { serializeBigInt } from '@/lib/utils';

export async function GET() {
  const { error, user } = await requireAuth();
  if (error) return error;

  try {
    // 1. 获取用户配置信息
    const [userConfigs, activeConfigRecord, teamMember] = await Promise.all([
      prisma.config.findMany({
        where: {
          userId: user.id,
          key: { startsWith: 'minio_' },
          NOT: { key: { in: ['minio_active_id', 'minio_configs', 'minio_test'] } }
        }
      }),
      prisma.config.findUnique({
        where: { userId_key: { userId: user.id, key: 'minio_active_id' } }
      }),
      prisma.teamMember.findUnique({
        where: { userId: user.id },
        include: { team: true }
      })
    ]);

    const activeConfigId = activeConfigRecord?.value;
    const personalKeys = userConfigs.map(c => c.key);
    const personalIds = userConfigs.map(c => c.key.replace('minio_', ''));
    const isOwner = teamMember?.team?.ownerId === user.id;

    // 2. 使用数据库聚合查询代替全表加载
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const [totalStats, recentCount, typeDistribution, personalFiles, teamFiles] = await Promise.all([
      // 全局统计
      prisma.file.aggregate({
        where: { userId: user.id },
        _count: true,
        _sum: { fileSize: true }
      }),
      // 最近7天文件数
      prisma.file.count({
        where: {
          userId: user.id,
          createdAt: { gte: sevenDaysAgo }
        }
      }),
      // 按文件类型分组统计
      prisma.file.groupBy({
        by: ['fileType'],
        where: { userId: user.id },
        _count: true
      }),
      // 个人文件统计 (属于用户自己配置的)
      prisma.file.aggregate({
        where: {
          userId: user.id,
          OR: [
            { configId: { in: personalIds } },
            { configId: { in: personalKeys } }
          ]
        },
        _count: true,
        _sum: { fileSize: true }
      }),
      // 团队文件统计 (活跃配置或非个人配置)
      prisma.file.aggregate({
        where: {
          userId: user.id,
          OR: [
            { configId: activeConfigId },
            { 
              AND: [
                { configId: { not: null } },
                { configId: { notIn: [...personalIds, ...personalKeys] } }
              ]
            },
            { configId: null }
          ]
        },
        _count: true,
        _sum: { fileSize: true }
      })
    ]);

    return NextResponse.json(serializeBigInt({
      personalStats: {
        totalFiles: personalFiles._count || 0,
        totalStorage: personalFiles._sum.fileSize || BigInt(0)
      },
      teamStats: {
        totalFiles: teamFiles._count || 0,
        totalStorage: teamFiles._sum.fileSize || BigInt(0)
      },
      personalConfigCount: userConfigs.length,
      totalFiles: totalStats._count || 0,
      totalStorage: totalStats._sum.fileSize || BigInt(0),
      recentFiles: recentCount,
      fileTypeDistribution: typeDistribution.map(({ fileType, _count }) => ({
        type: fileType,
        count: _count
      })),
      debug: {
        isOwner,
        activeConfigId,
        personalIds,
        personalKeys
      }
    }));
  } catch (error) {
    console.error('Error fetching user stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user stats' },
      { status: 500 }
    );
  }
}
