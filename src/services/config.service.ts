import { MinioConfigItem, ShortlinkConfig, SyncEvent, SyncProgress } from '@/types/config';

export const configService = {
  // MinIO Configs
  async getMinioConfigs(): Promise<{ configs: MinioConfigItem[], activeId: string }> {
    const res = await fetch('/api/config/minio');
    if (!res.ok) throw new Error(`Failed to fetch MinIO configs (${res.status})`);
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
  async testConnection(type: 'minio' | 'shortlink', config: MinioConfigItem | ShortlinkConfig): Promise<{ success: boolean; duration?: number; error?: string }> {
    const res = await fetch('/api/config/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, ...config }),
    });
    const data = await res.json();
    return data;
  },

  // Sync
  async syncFiles(configId: string, onProgress?: (event: SyncEvent) => void, signal?: AbortSignal): Promise<SyncProgress> {
    const res = await fetch('/api/files/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ configId }),
      signal,  // 传递 AbortSignal
    });

    if (!res.ok) throw new Error('同步请求失败');
    
    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    let finalProgress: SyncProgress = { total: 0, imported: 0, skipped: 0, errors: 0 };

    if (!reader) throw new Error('无法读取响应流');

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(l => l.trim());

      for (const line of lines) {
        try {
          const event: SyncEvent = JSON.parse(line);
          if (event.type === 'progress' || event.type === 'done' || event.type === 'quota_exceeded') {
            if (event.type !== 'quota_exceeded') {
               finalProgress = event.data as SyncProgress;
            }
            if (onProgress) onProgress(event);
          } else if (event.type === 'error') {
            throw new Error(event.message);
          }
        } catch (e) {
          console.error('解析同步进度失败:', e);
        }
      }
    }

    return finalProgress;
  }
};
