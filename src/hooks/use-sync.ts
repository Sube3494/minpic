import { useState } from 'react';
import { configService } from '@/services/config.service';
import { SyncProgress, SyncEvent } from '@/types/config';
import { toast } from 'sonner';

export function useSync() {
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);

  const syncFiles = async (configId: string) => {
    setSyncing(true);
    setSyncProgress(null);

    try {
      const finalProgress = await configService.syncFiles(configId, (event: SyncEvent) => {
        if (event.type === 'progress') {
          setSyncProgress(event.data);
        } else if (event.type === 'done') {
          setSyncProgress(event.data);
          toast.success('同步完成', {
            description: `共扫描 ${event.data.total} 个文件,导入 ${event.data.imported} 个,跳过 ${event.data.skipped} 个`
          });
        } else if (event.type === 'error') {
          toast.error('同步错误', {
            description: event.message
          });
        }
      });

      return !!finalProgress;
    } catch (error) {
      console.error(error);
      toast.error('同步时发生错误', {
        description: error instanceof Error ? error.message : '请检查网络连接和 MinIO 配置'
      });
      return false;
    } finally {
      setSyncing(false);
    }
  };

  return {
    syncing,
    syncProgress,
    syncFiles
  };
}
