import { prisma } from './prisma';

/**
 * 获取用户的 MinIO 配置
 * 优先级顺序：
 * 1. 用户指定的configId
 * 2. 用户的活动配置
 * 3. 如果用户是团队成员，获取团队主的活动配置
 * 4. 用户的第一个配置
 */
export async function getUserMinioConfig(userId: string, configId?: string | null) {
  let config = null;

  // 1. 如果提供了 configId，尝试获取该配置
  if (configId) {
    try {
      const configRecord = await prisma.config.findUnique({
        where: {
          userId_key: { userId, key: `minio_${configId}` }
        },
      });

      if (configRecord) {
        config = JSON.parse(configRecord.value);
        return config;
      }
    } catch {
      // Ignore error
    }
  }

  // 2. 尝试获取用户的活动配置
  try {
    const activeConfigRecord = await prisma.config.findUnique({
      where: {
        userId_key: { userId, key: 'minio_active_id' }
      }
    });

    if (activeConfigRecord) {
      const activeId = activeConfigRecord.value;

      const configRecord = await prisma.config.findUnique({
        where: {
          userId_key: { userId, key: `minio_${activeId}` }
        },
      });

      if (configRecord) {
        config = JSON.parse(configRecord.value);
        return config;
      }
    }
  } catch {
    // Ignore error
  }

  // 3. 如果用户是团队成员，尝试获取团队主的活动配置
  try {
    const teamMember = await prisma.teamMember.findUnique({
      where: { userId },
      include: {
        team: {
          select: {
            ownerId: true,
          },
        },
      },
    });

    if (teamMember) {
      const ownerConfig = await getUserMinioConfig(teamMember.team.ownerId);
      if (ownerConfig) {
        return ownerConfig;
      }
    }
  } catch {
    // Ignore error
  }

  // 4. 最后尝试获取用户的第一个配置
  const userConfig = await prisma.config.findFirst({
    where: {
      userId,
      key: { startsWith: 'minio_' },
      NOT: {
        key: { in: ['minio_active_id', 'minio_configs'] }
      }
    },
    orderBy: { updatedAt: 'desc' },
  });

  if (userConfig) {
    config = JSON.parse(userConfig.value);
  }

  return config;
}
