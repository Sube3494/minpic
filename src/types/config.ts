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
}

export interface ShortlinkConfig {
  apiUrl: string;
  apiKey: string;
  enabled: boolean;
  expiresIn?: number;
}

export interface SyncProgress {
  total: number;
  imported: number;
  skipped: number;
}

export const DEFAULT_MINIO_CONFIG: Omit<MinioConfigItem, 'id' | 'name'> = {
  endpoint: 'localhost',
  port: 9000,
  useSSL: false,
  accessKey: '',
  secretKey: '',
  bucket: 'minpic',
  region: '',
  customDomain: '',
  duplicateHandling: 'keep-both',
  baseDir: '',
  archiveStrategy: 'none',
  expirationDays: 0,
};
