import { prisma } from './prisma';
import { decryptMinioConfig } from './config-encryption';
import { MinioConfigItem } from '@/types/config';

type MinioConfig = MinioConfigItem;

/**
 * 获取用户的 MinIO 配置
 * 优先级顺序：
 * 1. 用户指定的configId
 * 2. 用户的活动配置
 * 3. 如果用户是团队成员，获取团队主的活动配置
 * 4. 用户的第一个配置
 */
export async function getUserMinioConfig(userId: string, configId?: string | null): Promise<MinioConfig | null> {
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
        // 解密敏感字段
        config = decryptMinioConfig(config) as unknown as MinioConfig;
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
        // 解密敏感字段
        config = decryptMinioConfig(config) as unknown as MinioConfig;
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
    // 解密敏感字段
    config = decryptMinioConfig(config) as unknown as MinioConfig;
  }

  return config;
}

/**
 * 根据物理存储特征（AccessKey + Bucket + BaseDir）找出所有相关的配置 ID
 * 用于存储身份共享场景
 */
export async function getStorageIdentityConfigIds(
  userId: string, 
  activeConfig: MinioConfig
): Promise<string[]> {
  if (!activeConfig) return [];

  // 获取用户的所有 MinIO 配置
  const allConfigRecords = await prisma.config.findMany({
    where: {
      userId,
      key: { startsWith: 'minio_' },
      NOT: {
        key: { in: ['minio_active_id', 'minio_configs'] }
      }
    }
  });

  // 找出所有与当前配置属于同一存储组的配置
  const storageGroupConfigIds = allConfigRecords
    .map(record => {
      try {
        const config = JSON.parse(record.value) as MinioConfig;
        return { 
          id: config.id || record.key.replace('minio_', ''), 
          config 
        };
      } catch {
        return null;
      }
    })
    .filter((item): item is { id: string; config: MinioConfig } => 
      item !== null &&
      item.config.accessKey === activeConfig.accessKey &&
      item.config.bucket === activeConfig.bucket &&
      (item.config.baseDir || '') === (activeConfig.baseDir || '')
    )
    .map(item => item.id);

  return storageGroupConfigIds.length > 0 ? storageGroupConfigIds : [activeConfig.id];
}
