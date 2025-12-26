import { useState, useEffect, useCallback } from 'react';
import { UploadTask } from '@/types/file';
import { toast } from 'sonner';

export function useFileUpload(refreshFiles: () => void) {
  const [queue, setQueue] = useState<UploadTask[]>([]);
  const [uploading, setUploading] = useState(false);

  // Compute aggregate progress
  const aggregateProgress = (() => {
    const activeTasks = queue.filter(t => t.status !== 'completed' || t.loaded < t.total);
    if (activeTasks.length === 0) return { loaded: 0, total: 0, percent: 0, isProcessing: false };
    
    const total = activeTasks.reduce((acc, t) => acc + t.total, 0);
    const loaded = activeTasks.reduce((acc, t) => acc + t.loaded, 0);
    const percent = total > 0 ? Math.min(99, Math.round((loaded / total) * 100)) : 0;
    const isProcessing = activeTasks.every(t => t.status === 'processing' || t.status === 'completed');
    
    return { loaded, total, percent, isProcessing };
  })();

  const startUploadTask = useCallback((taskId: string, configId: string) => {
    const task = queue.find(t => t.id === taskId);
    if (!task) return;

    const formData = new FormData();
    formData.append('file', task.file);
    if (configId) formData.append('configId', configId);

    const xhr = new XMLHttpRequest();
    
    setQueue(prev => prev.map(t => t.id === taskId ? { ...t, status: 'uploading', xhr } : t));

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        setQueue(prev => prev.map(t => t.id === taskId ? { ...t, loaded: e.loaded } : t));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const sizeInMB = (task.file.size / (1024 * 1024)).toFixed(2);
        toast.success(`${task.file.name} 上传成功`, {
          description: `文件大小 ${sizeInMB} MB`
        });
        setQueue(prev => prev.map(t => t.id === taskId ? { ...t, status: 'completed', loaded: task.total } : t));
      } else {
        try {
          const errorData = JSON.parse(xhr.responseText);
          if (errorData.message?.includes('FILE_EXISTS')) {
            toast.info(`${task.file.name} 已存在`, {
              description: '该文件已在存储库中，已跳过上传'
            });
          } else {
            toast.error(`${task.file.name} 上传失败`, {
              description: errorData.error || '请检查网络连接和存储配置'
            });
          }
        } catch {
          toast.error(`${task.file.name} 上传失败`, {
            description: '请检查网络连接和存储配置'
          });
        }
        setQueue(prev => prev.map(t => t.id === taskId ? { ...t, status: 'error' } : t));
      }
    });

    xhr.addEventListener('error', () => {
      toast.error(`${task.file.name} 网络错误`, {
        description: '请检查网络连接后重试'
      });
      setQueue(prev => prev.map(t => t.id === taskId ? { ...t, status: 'error' } : t));
    });

    xhr.upload.addEventListener('load', () => {
      setQueue(prev => prev.map(t => t.id === taskId ? { ...t, status: 'processing', loaded: task.total } : t));
    });

    xhr.open('POST', '/api/files');
    xhr.send(formData);
  }, [queue]);

  const uploadFiles = async (selectedFiles: FileList, configId: string) => {
    if (!selectedFiles || selectedFiles.length === 0) return;

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

    // When everything is done, wait a bit then reset uploading state and refresh list
    if (queue.length > 0 && queue.every(t => t.status === 'completed' || t.status === 'error')) {
      const timer = setTimeout(() => {
        setUploading(false);
        setQueue([]);
        refreshFiles();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [queue, refreshFiles]);

  return {
    queue,
    uploading,
    aggregateProgress,
    uploadFiles,
    setQueue,
    setUploading
  };
}
