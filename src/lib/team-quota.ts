import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { cache, CacheKeys, CacheTTL } from './cache';

type TeamMemberWithQuota = Prisma.TeamMemberGetPayload<{
  include: {
    team: {
      select: {
        id: true,
        ownerId: true,
        storageQuota: true,
        fileQuota: true,
        members: {
          include: {
            user: {
              select: { storageUsed: true, fileCount: true },
            },
          },
        },
      },
    },
    user: {
      select: { storageUsed: true, fileCount: true },
    },
  },
}>;

interface QuotaCacheData {
  data: TeamMemberWithQuota;
  timestamp: number;
}

/**
 * 获取用户的配额相关数据（包含团队信息、成员限额、所有成员的使用量）
 */
async function getQuotaData(userId: string): Promise<TeamMemberWithQuota | null> {
  const cacheKey = CacheKeys.userQuota(userId);
  const cached = await cache.get<QuotaCacheData>(cacheKey);

  // Use 5-second cache to ensure fresh data after deletions
  if (cached && Date.now() - cached.timestamp < 5000) {
    return cached.data;
  }
  
  const data = await prisma.teamMember.findUnique({
    where: { userId },
    include: {
      team: {
        select: {
          id: true,
          ownerId: true,
          storageQuota: true,
          fileQuota: true,
          members: {
            include: {
              user: {
                select: { storageUsed: true, fileCount: true },
              },
            },
          },
        },
      },
      user: {
        select: { storageUsed: true, fileCount: true },
      },
    },
  }) as TeamMemberWithQuota | null;

  if (data) {
    await cache.set(cacheKey, { data, timestamp: Date.now() }, CacheTTL.QUOTA);
  }

  return data;
}

export async function checkStorageQuota(
  userId: string,
  fileSize: number | bigint,
  pendingUsage: number | bigint = 0,
  configId?: string | null
): Promise<{ allowed: boolean; reason?: string }> {
  // 1. 如果指定了配置 ID，检查是否为用户的私有配置
  if (configId) {
    const isPersonalConfig = await prisma.config.findUnique({
      where: { userId_key: { userId, key: `minio_${configId}` } }
    });
    if (isPersonalConfig) {
      return { allowed: true }; // 私有配置不受限
    }
  }

  const teamMember = await getQuotaData(userId);

  // 个人用户(无团队): 不限制
  if (!teamMember) {
    return { allowed: true };
  }

  // 团队场景: 检查团队总限额
  const team = teamMember.team;
  
  // 团队主不受限制
  if (team.ownerId === userId) {
    return { allowed: true };
  }

  // 计算团队总使用量(只统计普通成员，排除团队主)
  const totalUsed = team.members.reduce(
    (sum: bigint, m) => {
      if (m.userId === team.ownerId) return sum; // 排除团队主
      return sum + m.user.storageUsed;
    },
    BigInt(0)
  ) + BigInt(pendingUsage);

  // 检查成员个人限额
  if (!teamMember.storageQuota || teamMember.storageQuota <= BigInt(0)) {
    return {
      allowed: false,
      reason: '等待管理员分配存储配额',
    };
  }

  const memberTotal = teamMember.user.storageUsed + BigInt(pendingUsage);
  if (memberTotal + BigInt(fileSize) > teamMember.storageQuota) {
    return {
      allowed: false,
      reason: '个人存储配额已满',
    };
  }

  if (totalUsed + BigInt(fileSize) > team.storageQuota) {
    return {
      allowed: false,
      reason: '团队存储资源已耗尽',
    };
  }

  return { allowed: true };
}

export async function checkFileQuota(
  userId: string,
  pendingCount: number = 0,
  configId?: string | null
): Promise<{ allowed: boolean; reason?: string }> {
  // 1. 如果指定了配置 ID，检查是否为用户的私有配置
  if (configId) {
    const isPersonalConfig = await prisma.config.findUnique({
      where: { userId_key: { userId, key: `minio_${configId}` } }
    });
    if (isPersonalConfig) {
      return { allowed: true }; // 私有配置不受限
    }
  }

  const teamMember = await getQuotaData(userId);

  // 个人用户(无团队): 不限制
  if (!teamMember) {
    return { allowed: true };
  }

  // 团队场景: 检查团队总限额
  const team = teamMember.team;

  // 团队主不受限制
  if (team.ownerId === userId) {
    return { allowed: true };
  }

  // 计算团队总文件数(只统计普通成员，排除团队主)
  const totalCount = team.members.reduce(
    (sum: number, m) => {
      if (m.userId === team.ownerId) return sum; // 排除团队主
      return sum + m.user.fileCount;
    },
    0
  ) + pendingCount;

  // 检查成员个人限额
  if (!teamMember.fileQuota || teamMember.fileQuota <= 0) {
    return {
      allowed: false,
      reason: '等待管理员分配文件配额',
    };
  }

  if (teamMember.user.fileCount + pendingCount >= teamMember.fileQuota) {
    return {
      allowed: false,
      reason: '个人文件配额已满',
    };
  }

  if (totalCount >= team.fileQuota) {
    return {
      allowed: false,
      reason: '团队文件资源已耗尽',
    };
  }

  return { allowed: true };
}

/**
 * 更新用户存储使用量
 */
export async function updateStorageUsage(
  userId: string,
  delta: number | bigint
) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      storageUsed: {
        increment: delta,
      },
    },
  });

  // 清除缓存
  await cache.del(CacheKeys.userQuota(userId));
}

/**
 * 更新用户文件数量
 */
export async function updateFileCount(userId: string, delta: number) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      fileCount: {
        increment: delta,
      },
    },
  });

  // 清除缓存
  await cache.del(CacheKeys.userQuota(userId));
}
