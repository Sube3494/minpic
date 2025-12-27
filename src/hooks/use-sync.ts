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
          shortlinksCreated: data.shortlinksCreated,
          shortlinksFailed: data.shortlinksFailed,
        });
        
        const shortlinkMsg = data.shortlinksCreated 
          ? `，生成短链 ${data.shortlinksCreated} 个${data.shortlinksFailed ? `（失败 ${data.shortlinksFailed} 个）` : ''}` 
          : '';
        
        toast.success('同步完成', {
          description: `共扫描 ${data.total} 个文件，导入 ${data.imported} 个，跳过 ${data.skipped} 个${shortlinkMsg}`
        });
        return true;
      } else {
        toast.error('同步失败', {
          description: data.error || '请检查存储配置和网络连接'
        });
        return false;
      }
    } catch (error) {
      console.error(error);
      toast.error('同步时发生错误', {
        description: '请检查网络连接和 MinIO 配置'
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
