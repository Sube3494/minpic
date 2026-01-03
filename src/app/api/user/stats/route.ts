import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import { serializeBigInt } from '@/lib/utils';

export async function GET() {
  const { error, user } = await requireAuth();
  if (error) return error;

  try {
    // 1. 获取用户自己拥有的所有 MinIO 配置
    const userConfigs = await prisma.config.findMany({
      where: {
        userId: user.id,
        // 放宽判定：只要是 minio_ 开头且不是保留字段，或者任何可能代表存储配置的 key
        key: { startsWith: 'minio_' },
        NOT: { key: { in: ['minio_active_id', 'minio_configs', 'minio_test'] } }
      }
    });

    // 调试：如果还是 0，尝试查一下所有带 minio 的 key
    if (userConfigs.length === 0) {
      const allMinioKeys = await prisma.config.findMany({
        where: { userId: user.id, key: { contains: 'minio' } },
        select: { key: true }
      });
      console.log('User MinIO Keys found:', allMinioKeys);
    }
    
    // 找出活跃配置 ID
    const activeConfigRecord = await prisma.config.findUnique({
      where: { userId_key: { userId: user.id, key: 'minio_active_id' } }
    });
    const activeConfigId = activeConfigRecord?.value;
    const personalKeys = userConfigs.map(c => c.key);
    const personalIds = userConfigs.map(c => c.key.replace('minio_', ''));

    // 2. 获取用户身份和团队属性
    const teamMember = await prisma.teamMember.findUnique({
      where: { userId: user.id },
      include: { team: true }
    });
    const isOwner = teamMember?.team?.ownerId === user.id;

    // 3. 开始统计
    const allFiles = await prisma.file.findMany({
      where: { userId: user.id },
      select: { fileSize: true, configId: true, createdAt: true, fileType: true }
    });

    const categories = {
      personal: { totalFiles: 0, totalStorage: BigInt(0) },
      team: { totalFiles: 0, totalStorage: BigInt(0) },
    };
    
    const context = {
      recentFiles: 0,
      fileTypeDistribution: {} as Record<string, number>
    };

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    allFiles.forEach(file => {
      const configId = file.configId;
      // 判定所有权：是否属于用户自己拥有的配置
      const belongsToUser = configId ? (personalIds.includes(configId) || personalKeys.includes(configId)) : false;
      
      // 判定情境：是否属于团队协作情境 (是活跃配置，或者不是自己的配置)
      const isTeamContext = configId ? (configId === activeConfigId || !belongsToUser) : true;

      // 1. 如果属于用户拥有的配置，计入个人统计（所有权维度）
      if (belongsToUser) {
        categories.personal.totalFiles++;
        categories.personal.totalStorage += file.fileSize;
      }

      // 2. 如果属于团队活跃配置或他人分享配置，计入团队统计（情境维度）
      if (isTeamContext) {
        categories.team.totalFiles++;
        categories.team.totalStorage += file.fileSize;
      }

      // 3. 全局通用统计（不重叠）
      if (file.createdAt >= sevenDaysAgo) context.recentFiles++;
      context.fileTypeDistribution[file.fileType] = (context.fileTypeDistribution[file.fileType] || 0) + 1;
    });

    const totalStorageGlobal = allFiles.reduce((acc, file) => acc + file.fileSize, BigInt(0));

    return NextResponse.json(serializeBigInt({
      personalStats: categories.personal,
      teamStats: categories.team,
      personalConfigCount: userConfigs.length,
      totalFiles: allFiles.length,
      totalStorage: totalStorageGlobal,
      recentFiles: context.recentFiles,
      fileTypeDistribution: Object.entries(context.fileTypeDistribution).map(([type, count]) => ({
        type,
        count
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
