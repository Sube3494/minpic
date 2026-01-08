import { useState, useEffect, useCallback, useMemo } from 'react';
import { UploadTask } from '@/types/file';
import { toast } from 'sonner';
import { UserQuota } from './use-quota';
import { useTeam } from './use-team';
import { formatFileSize } from '@/lib/utils';

// Helper to parse potential BigInt strings
const parseSize = (val: string | number) => {
  if (typeof val === 'number') return val;
  return Number(val);
};

const translateError = (err: unknown) => {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  if (msg.includes('failed to fetch')) return '网络连接失败 (Failed to fetch)';
  if (msg.includes('networkerror') || msg.includes('network error')) return '网络异常';
  if (msg.includes('aborted')) return '上传已取消';
  if (msg.includes('failed to presign')) return '获取分片凭证失败';
  if (msg.includes('initialization failed') || msg.includes('初始化上传失败')) return '存储源初始化失败';
  return err instanceof Error ? err.message : String(err);
};

export function useFileUpload(
  refreshFiles: () => void,
  quota: UserQuota | null,
  refreshQuota: () => void
) {
  const [queue, setQueue] = useState<UploadTask[]>([]);
  const [uploading, setUploading] = useState(false);
  const { teamInfo } = useTeam();

  // Compute aggregate progress
  const aggregateProgress = useMemo(() => {
    if (queue.length === 0) return { loaded: 0, total: 0, percent: 0, isProcessing: false, isAllDone: false, successCount: 0, errorCount: 0, totalCount: 0 };
    
    // Only count tasks that are NOT in error or skipped status for the progress bar
    const validTasks = queue.filter(t => t.status !== 'error' && t.status !== 'skipped');
    const successTasks = queue.filter(t => t.status === 'completed');
    const errorTasks = queue.filter(t => t.status === 'error');
    
    if (validTasks.length === 0) return { loaded: 0, total: 0, percent: 0, isProcessing: false, isAllDone: true, successCount: 0, errorCount: errorTasks.length, totalCount: queue.length };

    const total = validTasks.reduce((acc, t) => acc + t.total, 0);
    const loaded = validTasks.reduce((acc, t) => {
        if (t.status === 'completed') return acc + t.total;
        return acc + t.loaded;
    }, 0);
    
    const isAllDone = queue.every(t => t.status === 'completed' || t.status === 'error' || t.status === 'skipped');
    const percent = total > 0 ? (isAllDone ? 100 : Math.min(99, Math.round((loaded / total) * 100))) : 0;
    const isProcessing = validTasks.length > 0 && validTasks.every(t => t.status === 'processing');
    
    return { 
      loaded, 
      total, 
      percent, 
      isProcessing,
      isAllDone,
      successCount: successTasks.length,
      errorCount: errorTasks.length,
      totalCount: validTasks.length + errorTasks.length // Total count shown to user excludes skipped
    };
  }, [queue]);

  const startUploadTask = useCallback(async (taskId: string, configId: string) => {
    const task = queue.find(t => t.id === taskId);
    if (!task) return;

    setQueue(prev => prev.map(t => t.id === taskId ? { ...t, status: 'uploading' } : t));

    try {
        // 1. Init Upload
        const initRes = await fetch('/api/files/multipart/init', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filename: task.file.name,
                fileSize: task.file.size,
                mimeType: task.file.type,
                configId,
            }),
        });

        if (!initRes.ok) {
            const errorData = await initRes.json();
            
            if (initRes.status === 409) {
                toast.info(`${task.file.name} 已存在`, {
                    description: '已跳过上传'
                });
                setQueue(prev => prev.map(t => t.id === taskId ? { ...t, status: 'skipped', loaded: t.total } : t));
            } else {
                toast.error(`${task.file.name} 上传失败`, {
                    description: translateError(errorData.error || '初始化上传失败')
                });
                setQueue(prev => prev.map(t => t.id === taskId ? { ...t, status: 'error' } : t));
            }
            return;
        }

        const { uploadId, chunkSize, totalChunks } = await initRes.json();
        const uploadedParts: { partNumber: number; etag: string }[] = [];
        let uploadedBytes = 0;

        // 2. Upload Chunks
        for (let partNumber = 1; partNumber <= totalChunks; partNumber++) {
            const start = (partNumber - 1) * chunkSize;
            const end = Math.min(start + chunkSize, task.file.size);
            const chunk = task.file.slice(start, end);

            // Get Presigned URL
            const presignRes = await fetch('/api/files/multipart/presign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uploadId, partNumber }),
            });

            if (!presignRes.ok) throw new Error('获取预签名 URL 失败');
            const { url } = await presignRes.json();

            // Upload to MinIO
            const uploadRes = await fetch(url, {
                method: 'PUT',
                body: chunk,
            });

            if (!uploadRes.ok) throw new Error('上传分片失败');

            const etag = uploadRes.headers.get('ETag')?.replace(/['"]/g, '');
            if (etag) {
                uploadedParts.push({ partNumber, etag });
            }

            uploadedBytes += chunk.size;
            
            // Update Progress
            setQueue(prev => prev.map(t => t.id === taskId ? { ...t, loaded: uploadedBytes } : t));
        }

        // 3. Complete Upload
        const completeRes = await fetch('/api/files/multipart/complete', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ 
                 uploadId, 
                 filename: task.file.name,
                 parts: uploadedParts.sort((a, b) => a.partNumber - b.partNumber)
             }),
        });

        if (!completeRes.ok) throw new Error((await completeRes.json()).error || '完成上传失败');

        await completeRes.json();
        
        const sizeInMB = (task.file.size / (1024 * 1024)).toFixed(2);
        toast.success(`${task.file.name} 上传成功`, {
          description: `文件大小 ${sizeInMB} MB`
        });
        
        setQueue(prev => prev.map(t => t.id === taskId ? { ...t, status: 'completed', loaded: task.total } : t));
        refreshQuota();

    } catch (error) {
        console.error('Upload failed:', error);
        toast.error(`${task.file.name} 上传失败`, {
            description: translateError(error)
        });
        setQueue(prev => prev.map(t => t.id === taskId ? { ...t, status: 'error' } : t));
    }
  }, [queue, refreshQuota]);

  const uploadFiles = async (selectedFiles: FileList, configId: string) => {
    if (!selectedFiles || selectedFiles.length === 0) return;

    // Check if config exists
    if (!configId) {
      toast.error('未配置存储源', {
        description: '请先前往设置页面添加存储配置'
      });
      return;
    }

    // Quota Pre-check
    if (quota) {
      const storageQuota = quota.storageQuota ? parseSize(quota.storageQuota) : null;
      const storageUsed = parseSize(quota.storageUsed);
      const fileQuota = quota.fileQuota || null;
      const fileCount = quota.fileCount;

      let totalUploadSize = 0;
      for (let i = 0; i < selectedFiles.length; i++) {
        totalUploadSize += selectedFiles[i].size;
      }

      // 1. Check Storage Quota (only if quota is set)
      if (storageQuota !== null) {
        const remainingStorage = storageQuota - storageUsed;
        if (totalUploadSize > remainingStorage) {
          const isOwner = teamInfo?.role === 'OWNER';
          toast.error('存储空间不足', {
            description: `剩余 ${formatFileSize(remainingStorage)}，本次上传 ${formatFileSize(totalUploadSize)}。${isOwner ? '请先删除文件释放空间。' : '请联系管理员提高限额或清理空间。'}`,
            duration: 5000,
          });
          return; // Reject upload
        }
      }

      // 2. Check File Count Quota (only if quota is set)
      if (fileQuota !== null) {
        const remainingFiles = fileQuota - fileCount;
        if (selectedFiles.length > remainingFiles) {
          const isOwner = teamInfo?.role === 'OWNER';
          toast.error('文件数量超限', {
            description: `剩余文件配额 ${remainingFiles} 个，本次上传 ${selectedFiles.length} 个。${isOwner ? '请先删除文件释放空间。' : '请联系管理员提高限额或清理空间。'}`,
            duration: 5000,
          });
          return; // Reject upload
        }
      }
    }

    const newTasks: UploadTask[] = Array.from(selectedFiles).map(file => ({
      id: Math.random().toString(36).substring(7),
      file,
      loaded: 0,
      total: file.size,
      status: 'pending',
      configId
    }));

    setQueue(prev => [...prev, ...newTasks]);
    setUploading(true);
  };

  // Queue processing effect
  useEffect(() => {
    const CONCURRENCY_LIMIT = 3;
    const activeCount = queue.filter(t => t.status === 'uploading' || t.status === 'processing').length;
    
    if (activeCount < CONCURRENCY_LIMIT) {
      const nextTask = queue.find(t => t.status === 'pending');
      if (nextTask) {
        // Use setTimeout to avoid "setState synchronously in effect" warning and breaking render cycle
        const timer = setTimeout(() => {
             startUploadTask(nextTask.id, nextTask.configId || '');
        }, 0);
        return () => clearTimeout(timer);
      }
    }

    // When everything is done, handle cleanup
    if (queue.length > 0 && queue.every(t => t.status === 'completed' || t.status === 'error' || t.status === 'skipped')) {
      const hasSuccess = queue.some(t => t.status === 'completed');
      
      if (!hasSuccess) {
        // If all failed, reset immediately
        setUploading(false);
        setQueue([]);
        refreshFiles();
        return;
      }

      // If at least one succeeded, wait a bit then reset
      const timer = setTimeout(() => {
        setUploading(false);
        setQueue([]);
        refreshFiles();
        refreshQuota(); // Refresh quota on success
      }, 2000); 
      return () => clearTimeout(timer);
    }
  }, [queue, refreshFiles, refreshQuota, startUploadTask]);

  return {
    queue,
    uploading,
    aggregateProgress,
    uploadFiles,
    setQueue,
    setUploading
  };
}
