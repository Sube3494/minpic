/*
 * @Date: 2025-12-25 15:52:53
 * @Author: Sube
 * @FilePath: config.ts
 * @LastEditTime: 2026-01-02 02:03:44
 * @Description: 
 */
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
  isTeam?: boolean; // 是否为团队共享配置 (只读)
  teamName?: string; // 所属团队名称
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

// --- Hook Return Types ---

export interface UseMinioConfigReturn {
  configs: MinioConfigItem[];
  activeId: string;
  selectedId: string;
  setSelectedId: (id: string) => void;
  loading: boolean;
  saving: boolean;
  testing: boolean;
  createConfig: () => void;
  deleteConfig: (id: string) => Promise<void>;
  updateSelectedConfig: (updates: Partial<MinioConfigItem>) => void;
  activateConfig: (id: string) => Promise<void>;
  saveConfigs: (feedbackName?: string, silent?: boolean) => Promise<void>;
  testMinioConnection: (id?: string | unknown, silent?: boolean) => Promise<{
    success: boolean;
    error?: string;
    updatedConfigs?: MinioConfigItem[];
  }>;
}

export interface UseShortlinkConfigReturn {
  shortlinkConfig: ShortlinkConfig;
  updateShortlinkConfig: (updates: Partial<ShortlinkConfig>) => void;
  saveShortlinkConfig: (updates?: Partial<ShortlinkConfig>, silent?: boolean) => Promise<void>;
  testShortlinkConnection: (configToTest?: ShortlinkConfig | unknown) => Promise<boolean>;
  loading: boolean;
  saving: boolean;
  testing: boolean;
}

export interface UseSyncReturn {
  syncing: boolean;
  syncProgress: SyncProgress | null;
  syncFiles: (configId: string) => Promise<boolean>;
  cancelSync: () => void;
}
