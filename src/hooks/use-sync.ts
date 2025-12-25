import { useState } from 'react';
import { configService } from '@/services/config.service';
import { SyncProgress } from '@/types/config';
import { toast } from 'sonner';

export function useSync() {
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);

  const syncFiles = async (configId: string) => {
    setSyncing(true);
    setSyncProgress(null);

    try {
      const data = await configService.syncFiles(configId);

      if (data.success) {
        setSyncProgress({
          total: data.total,
          imported: data.imported,
          skipped: data.skipped,
        });
        toast.success(`同步完成！共 ${data.total} 个文件，导入 ${data.imported} 个，跳过 ${data.skipped} 个`);
        return true;
      } else {
        toast.error(data.error || '同步失败');
        return false;
      }
    } catch (error) {
      console.error(error);
      toast.error('同步时发生错误');
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
