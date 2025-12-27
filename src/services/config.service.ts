import { MinioConfigItem, ShortlinkConfig } from '@/types/config';

export const configService = {
  // MinIO Configs
  async getMinioConfigs(): Promise<{ configs: MinioConfigItem[], activeId: string }> {
    const res = await fetch('/api/config/minio');
    if (!res.ok) throw new Error('Failed to fetch MinIO configs');
    return res.json();
  },

  async saveMinioConfigs(configs: MinioConfigItem[], activeId: string): Promise<void> {
    const res = await fetch('/api/config/minio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ configs, activeId }),
    });
    if (!res.ok) throw new Error('Failed to save MinIO configs');
  },

  // Shortlink Config
  async getShortlinkConfig(): Promise<ShortlinkConfig> {
    const res = await fetch('/api/config/shortlink');
    if (!res.ok) throw new Error('Failed to fetch shortlink config');
    return res.json();
  },

  async saveShortlinkConfig(config: ShortlinkConfig): Promise<void> {
    const res = await fetch('/api/config/shortlink', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    if (!res.ok) throw new Error('Failed to save shortlink config');
  },

  // Connection Testing
  async testConnection(type: 'minio' | 'shortlink', config: MinioConfigItem | ShortlinkConfig): Promise<boolean> {
    const res = await fetch('/api/config/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, ...config }),
    });
    const data = await res.json();
    return data.success;
  },

  // Sync
  async syncFiles(configId: string): Promise<{ success: boolean; total: number; imported: number; skipped: number; shortlinksCreated?: number; shortlinksFailed?: number; error?: string }> {
    const res = await fetch('/api/files/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ configId }),
    });
    return res.json();
  }
};
