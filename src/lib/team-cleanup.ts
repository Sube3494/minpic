import { prisma } from './prisma';
import { MinioService } from './minio';

/**
 * 清理指定成员在团队中产生的所有数据
 * @param teamId 团队ID
 * @param ownerId 团队主ID
 * @param targetUserId 要清理的目标成员ID
 */
export async function cleanupMemberData(teamId: string, ownerId: string, targetUserId: string) {
  // 1. 获取团队主的所有配置ID
  const ownerConfigs = await prisma.config.findMany({
    where: {
      userId: ownerId,
      key: { startsWith: 'minio_' },
      NOT: { key: { in: ['minio_active_id', 'minio_configs'] } }
    }
  });
  
  const ownerIdSuffixes = ownerConfigs.map(c => c.key.replace('minio_', ''));
  
  // 2. 查找该成员使用这些配置上传的所有文件
  const filesToDelete = await prisma.file.findMany({
    where: {
      userId: targetUserId,
      configId: { in: ownerIdSuffixes }
    }
  });

  if (filesToDelete.length > 0) {
    console.log(`[TeamCleanup] Found ${filesToDelete.length} files to delete for user ${targetUserId} in team ${teamId}`);
    
    // 按 configId 分组以减少连接次数
    const filesByConfig: Record<string, typeof filesToDelete> = {};
    filesToDelete.forEach(f => {
      if (f.configId) {
        if (!filesByConfig[f.configId]) filesByConfig[f.configId] = [];
        filesByConfig[f.configId].push(f);
      }
    });

    const minioService = new MinioService();

    for (const configId in filesByConfig) {
      const configRecord = ownerConfigs.find(c => c.key === `minio_${configId}`);
      if (!configRecord) continue;

      try {
        const config = JSON.parse(configRecord.value);
        await minioService.connect(config);
        
        const files = filesByConfig[configId];
        for (const file of files) {
          try {
            // 删除原始文件
            await minioService.deleteFile(file.minioPath);
            // 如果有缩略图，也要删除
            if (file.thumbnailPath) {
              await minioService.deleteFile(file.thumbnailPath);
            }
          } catch (err) {
            console.error(`[TeamCleanup] Failed to delete object ${file.minioPath} from MinIO:`, err);
          }
        }
      } catch (err) {
        console.error(`[TeamCleanup] Failed to connect to MinIO for config ${configId}:`, err);
      }
    }

    // 3. 从数据库中批量删除记录
    await prisma.file.deleteMany({
      where: {
        id: { in: filesToDelete.map(f => f.id) }
      }
    });
    
    console.log(`[TeamCleanup] Deleted ${filesToDelete.length} database records.`);
  }

  // 4. 重新校准团队主的用量
  await recalculateOwnerUsage(ownerId, ownerIdSuffixes);
  
  // 5. 重新校准该成员自身的用量（防止负数或不一致）
  await recalculateUserUsage(targetUserId);

  return filesToDelete.length;
}

/**
 * 清理整个团队的数据（解散团队时使用）
 */
export async function cleanupTeamData(teamId: string, ownerId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const team = await (prisma as any).team.findUnique({
    where: { id: teamId },
    include: { members: true }
  });

  if (!team) return;

  // 依次清理每个成员的数据
  for (const member of team.members) {
    if (member.userId !== ownerId) {
      await cleanupMemberData(teamId, ownerId, member.userId);
    }
  }

  // 团队主自己的文件保留，但仍需重新校准用量（仅统计自己的）
  const ownerConfigs = await prisma.config.findMany({
    where: {
      userId: ownerId,
      key: { startsWith: 'minio_' },
      NOT: { key: { in: ['minio_active_id', 'minio_configs'] } }
    }
  });
  const ownerIdSuffixes = ownerConfigs.map(c => c.key.replace('minio_', ''));
  await recalculateOwnerUsage(ownerId, ownerIdSuffixes);
}

/**
 * 重新计算并保存所有权者的 Consolidated 用量
 */
async function recalculateOwnerUsage(ownerId: string, ownerConfigIds: string[]) {
  const stats = await prisma.file.aggregate({
    where: {
      OR: [
        { userId: ownerId }, // 店主自己的
        { configId: { in: ownerConfigIds } } // 之前用店主配置传的（理论上清理后只剩店主自己的，但安全起见这样算）
      ]
    },
    _sum: { fileSize: true },
    _count: true
  });

  await prisma.user.update({
    where: { id: ownerId },
    data: {
      storageUsed: BigInt(stats._sum.fileSize || 0),
      fileCount: stats._count
    }
  });
}

/**
 * 重新计算并保存普通用户的个人用量
 */
async function recalculateUserUsage(userId: string) {
    const stats = await prisma.file.aggregate({
      where: { userId },
      _sum: { fileSize: true },
      _count: true
    });
  
    await prisma.user.update({
      where: { id: userId },
      data: {
        storageUsed: BigInt(stats._sum.fileSize || 0),
        fileCount: stats._count
      }
    });
  }
