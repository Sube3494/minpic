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
  const configs = await getAccessibleMinioConfigs(userId);
  // A specified node must match exactly; never silently switch storage targets.
  if (configId) return configs.find(config => config.id === configId) ?? null;

  const active = await prisma.config.findUnique({
    where: { userId_key: { userId, key: 'minio_active_id' } },
  });
  return configs.find(config => config.id === active?.value) ?? configs[0] ?? null;
}

/** Own nodes plus the owner's explicitly shared nodes; legacy nodes retain sharing. */
export async function getAccessibleMinioConfigs(userId: string): Promise<MinioConfig[]> {
  const nodeFilter = {
    key: { startsWith: 'minio_' },
    NOT: { key: { in: ['minio_active_id', 'minio_configs', 'minio_test'] } },
  };
  const [ownRecords, membership] = await Promise.all([
    prisma.config.findMany({ where: { userId, ...nodeFilter }, orderBy: { updatedAt: 'desc' } }),
    prisma.teamMember.findUnique({
      where: { userId }, include: { team: { select: { ownerId: true, name: true } } },
    }),
  ]);
  const parse = (record: { key: string; value: string }): MinioConfig => {
    const config = JSON.parse(record.value);
    return { ...decryptMinioConfig(config) as MinioConfig, id: record.key.slice('minio_'.length), isTeam: false };
  };
  const ownConfigs = ownRecords.map(parse);
  if (!membership || membership.team.ownerId === userId) return ownConfigs;

  const ownerId = membership.team.ownerId;
  const [ownerRecords, ownerActive] = await Promise.all([
    prisma.config.findMany({ where: { userId: ownerId, ...nodeFilter }, orderBy: { updatedAt: 'desc' } }),
    prisma.config.findUnique({ where: { userId_key: { userId: ownerId, key: 'minio_active_id' } } }),
  ]);
  const sharedConfigs = ownerRecords.map(parse)
    .filter(config => config.sharedWithTeam !== false)
    .map(config => ({ ...config, isTeam: true, teamName: membership.team.name }));
  sharedConfigs.sort((a, b) => Number(b.id === ownerActive?.value) - Number(a.id === ownerActive?.value));
  return [...sharedConfigs, ...ownConfigs];
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
        const decrypted = decryptMinioConfig(config as unknown as Record<string, unknown>) as MinioConfig;
        return { 
          id: config.id || record.key.replace('minio_', ''), 
          config: decrypted  // 使用解密后的配置进行比较
        };
      } catch {
        return null;
      }
    })
    .filter((item): item is { id: string; config: MinioConfig } => 
      item !== null &&
      item.config.accessKey === activeConfig.accessKey &&  // 比较解密后的值
      item.config.bucket === activeConfig.bucket &&
      (item.config.baseDir || '') === (activeConfig.baseDir || '')
    )
    .map(item => item.id);

  return storageGroupConfigIds.length > 0 ? storageGroupConfigIds : [activeConfig.id];
}
