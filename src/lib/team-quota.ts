import { prisma } from './prisma';
import { cache, CacheKeys, CacheTTL } from './cache';

/**
 * 团队配额检查
 * 规则:
 * 1. 个人用户(无团队): 不限制
 * 2. 团队成员:
 *    a. 检查团队总限额
 *    b. 如果成员有个人子限额,再检查个人限额
 */

/**
 * 获取用户的配额相关数据（包含团队信息、成员限额、所有成员的使用量）
 */
async function getQuotaData(userId: string) {
  const cacheKey = CacheKeys.userQuota(userId);
  const cached = await cache.get<any>(cacheKey);

  if (cached && Date.now() - cached.timestamp < 60000) {
    return cached.data;
  }

  const data = await prisma.teamMember.findUnique({
    where: { userId },
    include: {
      team: {
        select: {
          id: true,
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
  });

  if (data) {
    await cache.set(cacheKey, { data, timestamp: Date.now() }, CacheTTL.QUOTA);
  }

  return data;
}

export async function checkStorageQuota(
  userId: string,
  fileSize: number | bigint,
  pendingUsage: number | bigint = 0
): Promise<{ allowed: boolean; reason?: string }> {
  const teamMember = await getQuotaData(userId);

  // 个人用户(无团队): 不限制
  if (!teamMember) {
    return { allowed: true };
  }

  // 团队场景: 检查团队总限额
  const team = teamMember.team;
  
  // 计算团队总使用量(所有成员累计)
  const totalUsed = team.members.reduce(
    (sum: bigint, m: any) => sum + m.user.storageUsed,
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
  pendingCount: number = 0
): Promise<{ allowed: boolean; reason?: string }> {
  const teamMember = await getQuotaData(userId);

  // 个人用户(无团队): 不限制
  if (!teamMember) {
    return { allowed: true };
  }

  // 团队场景: 检查团队总限额
  const team = teamMember.team;

  // 计算团队总文件数(所有成员累计)
  const totalCount = team.members.reduce(
    (sum: number, m: any) => sum + m.user.fileCount,
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
