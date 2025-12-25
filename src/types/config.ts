export interface MinioConfigItem {
  id: string;
  name: string;
  endpoint: string;
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  bucket: string;
  region?: string;
  customDomain?: string;
  duplicateHandling?: 'skip' | 'overwrite' | 'keep-both';
  baseDir?: string;
  autoArchive?: boolean;
}

export interface ShortlinkConfig {
  apiUrl: string;
  apiKey: string;
  autoGenerate: boolean;
  expiresIn: number;
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
  autoArchive: false,
};
