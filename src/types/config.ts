export interface MinioConfigItem {
  id: string;
  name: string;
  endpoint: string;
  port?: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  bucket: string;
  region?: string;
  customDomain?: string;
  duplicateHandling?: 'skip' | 'overwrite' | 'keep-both';
  baseDir?: string;
  archiveStrategy?: 'none' | 'year' | 'month' | 'day';
  expirationDays?: number; // 文件过期天数，0 表示永不过期
  status?: 'unknown' | 'success' | 'error'; // 配置状态
}

export interface ShortlinkConfig {
  apiUrl: string;
  apiKey: string;
  enabled: boolean;
}

export interface SyncProgress {
  total: number;
  imported: number;
  skipped: number;
  errors: number;
  current?: number;
  currentFilename?: string;
  status?: 'syncing' | 'completed' | 'error';
}

export type SyncEvent = 
  | { type: 'progress'; data: SyncProgress }
  | { type: 'done'; data: SyncProgress }
  | { type: 'quota_exceeded'; data: { quotaType: 'storage' | 'file'; message: string; progress: SyncProgress } }
  | { type: 'error'; message: string };

export const DEFAULT_MINIO_CONFIG: Omit<MinioConfigItem, 'id' | 'name'> = {
  endpoint: '',
  port: undefined,
  useSSL: false,
  accessKey: '',
  secretKey: '',
  bucket: '',
  region: '',
  customDomain: '',
  duplicateHandling: 'skip',
  baseDir: '',
  archiveStrategy: 'none',
  expirationDays: 0,
};
