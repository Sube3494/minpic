import { useState, useRef } from 'react';
import { configService } from '@/services/config.service';
import { SyncProgress, SyncEvent } from '@/types/config';
import { toast } from 'sonner';

export function useSync() {
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const syncFiles = async (configId: string) => {
    setSyncing(true);
    setSyncProgress(null);

    // 创建新的 AbortController
    abortControllerRef.current = new AbortController();

    try {
      const finalProgress = await configService.syncFiles(
        configId, 
        (event: SyncEvent) => {
          if (event.type === 'progress') {
            setSyncProgress(event.data);
          } else if (event.type === 'done') {
            setSyncProgress(event.data);
            toast.success('同步完成', {
              description: `共扫描 ${event.data.total} 个文件,导入 ${event.data.imported} 个,跳过 ${event.data.skipped} 个`
            });
          } else if (event.type === 'quota_exceeded') {
            const { message, quotaType, progress } = event.data;
            let description = `已扫描 ${progress.total} 个,导入 ${progress.imported} 个,跳过 ${progress.skipped} 个`;
            
            if (quotaType === 'storage') {
              description += '\n请清理文件或联系管理员增加存储限额';
            } else {
              description += '\n请删除部分文件或联系管理员增加文件数量限额';
            }

            toast.error(message, {
              description,
              duration: 5000 // 让错误显示久一点
            });
          } else if (event.type === 'error') {
            toast.error('同步错误', {
              description: event.message
            });
          }
        },
        abortControllerRef.current.signal  // 传递 signal
      );

      return !!finalProgress;
    } catch (error) {
      // 如果是用户主动取消，不显示错误提示
      if (error instanceof Error && error.name === 'AbortError') {
        toast.info('同步已暂停', {
          description: '已导入的文件已保存，下次同步将自动跳过'
        });
        return false;
      }

      console.error(error);
      toast.error('同步时发生错误', {
        description: error instanceof Error ? error.message : '请检查网络连接和 MinIO 配置'
      });
      return false;
    } finally {
      setSyncing(false);
      abortControllerRef.current = null;
    }
  };

  const cancelSync = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  return {
    syncing,
    syncProgress,
    syncFiles,
    cancelSync
  };
}
