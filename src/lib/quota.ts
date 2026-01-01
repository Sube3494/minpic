import { prisma } from './prisma';

/**
 * 获取用户的配额所有者（团队主或自己）
 */
async function getQuotaOwner(userId: string) {
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
    return teamMember.team.ownerId;  // 返回团队主ID
  }
  
  return userId;  // 返回用户自己的ID
}

export async function checkStorageQuota(
  userId: string,
  fileSize: number,
  pendingUsage: number | bigint = 0 // 已待处理但未写入DB的使用量
): Promise<{ allowed: boolean; reason?: string }> {
  const quotaOwnerId = await getQuotaOwner(userId);
  
  const user = await prisma.user.findUnique({
    where: { id: quotaOwnerId },
    select: { storageQuota: true, storageUsed: true }
  });
  
  if (!user) {
    return { allowed: false, reason: 'User not found' };
  }
  
  const currentTotal = user.storageUsed + BigInt(pendingUsage);
  const willExceed = currentTotal + BigInt(fileSize) > user.storageQuota;

  console.log('[存储配额检查]', {
    userId,
    quotaOwnerId,
    isTeamMember: userId !== quotaOwnerId,
    storageUsed: user.storageUsed.toString(),
    pendingUsage: pendingUsage.toString(),
    storageQuota: user.storageQuota.toString(),
    fileSize,
    afterUpload: (currentTotal + BigInt(fileSize)).toString(),
    willExceed
  });
  
  if (willExceed) {
    return { 
      allowed: false, 
      reason: userId !== quotaOwnerId ? 'Team storage quota exceeded' : 'Storage quota exceeded' 
    };
  }
  
  return { allowed: true };
}

export async function checkFileQuota(
  userId: string,
  pendingCount: number = 0
): Promise<{ allowed: boolean; reason?: string }> {
  const quotaOwnerId = await getQuotaOwner(userId);
  
  const user = await prisma.user.findUnique({
    where: { id: quotaOwnerId },
    select: { fileQuota: true, fileCount: true }
  });
  
  if (!user) {
    return { allowed: false, reason: 'User not found' };
  }
  
  if (user.fileCount + pendingCount >= user.fileQuota) {
    return { 
      allowed: false, 
      reason: userId !== quotaOwnerId ? 'Team file quota exceeded' : 'File quota exceeded' 
    };
  }
  
  return { allowed: true };
}

export async function updateStorageUsage(
  userId: string,
  delta: number | bigint
) {
  const quotaOwnerId = await getQuotaOwner(userId);
  
  // Prisma的increment不支持BigInt,需要先读取再更新
  const user = await prisma.user.findUnique({
    where: { id: quotaOwnerId },
    select: { storageUsed: true }
  });
  
  if (!user) {
    throw new Error('User not found');
  }
  
  const newStorageUsed = user.storageUsed + BigInt(delta);
  console.log('[配额更新]', {
    userId,
    quotaOwnerId,
    isTeamMember: userId !== quotaOwnerId,
    oldValue: user.storageUsed.toString(),
    delta: BigInt(delta).toString(),
    newValue: newStorageUsed.toString()
  });
  
  await prisma.user.update({
    where: { id: quotaOwnerId },
    data: {
      storageUsed: newStorageUsed
    }
  });
}

export async function updateFileCount(
  userId: string,
  delta: number
) {
  const quotaOwnerId = await getQuotaOwner(userId);
  
  await prisma.user.update({
    where: { id: quotaOwnerId },
    data: {
      fileCount: { increment: delta }
    }
  });
}
