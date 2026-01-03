import { useState, useEffect, useCallback, useRef } from 'react';
import { FileItem, FilterType, ViewMode } from '@/types/file';
import { fileService } from '@/services/file.service';
import { toast } from 'sonner';

export function useFiles(
  initialFilter: FilterType = 'all', 
  initialViewMode: ViewMode = 'grid',
  selectedConfigId?: string,
  refreshQuotaFn?: () => void  // Add optional quota refresh callback
) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>(initialFilter);
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode);
  const pageRef = useRef(1); // 使用 Ref 追踪真实页码，避免 useCallback 闭包循环
  const [hasMore, setHasMore] = useState(true);
  const hasMoreRef = useRef(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const isLoadingMoreRef = useRef(false);
  const isInitialLoading = useRef(false);
  const hasDataRef = useRef(false);
  const pageSize = 30;

  const fetchIdRef = useRef(0);

  const fetchFiles = useCallback(async (targetPage: number, isAppend: boolean) => {
    const requestId = ++fetchIdRef.current;
    
    if (isAppend) {
      if (isLoadingMoreRef.current || !hasMoreRef.current) return;
      setLoadingMore(true);
      isLoadingMoreRef.current = true;
    } else {
      // 切换过滤/搜索/配置时，始终允许发起新请求，不被 isInitialLoading 阻塞
      if (hasDataRef.current) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }
      isInitialLoading.current = true;
      setHasMore(true);
      hasMoreRef.current = true;
    }

    try {
      const data = await fileService.getFiles(filter, search, targetPage, pageSize, selectedConfigId);
      
      // 丢弃过时的请求结果
      if (requestId !== fetchIdRef.current) {
        return;
      }
      
      if (isAppend) {
        setFiles(prev => {
          const newFiles = [...prev, ...data.files];
          hasDataRef.current = newFiles.length > 0;
          return newFiles;
        });
      } else {
        setFiles(data.files);
        hasDataRef.current = data.files.length > 0;
      }
      
      const newHasMore = data.pagination.totalPages > targetPage;
      setHasMore(newHasMore);
      hasMoreRef.current = newHasMore;
      pageRef.current = targetPage;
    } catch {
      if (requestId === fetchIdRef.current) {
        toast.error('加载文件列表失败');
      }
    } finally {
      if (requestId === fetchIdRef.current) {
        if (!isAppend) {
          setLoading(false);
          setIsRefreshing(false);
          isInitialLoading.current = false;
        }
        setLoadingMore(false);
        isLoadingMoreRef.current = false;
      }
    }
  }, [filter, search, selectedConfigId]);

  // 仅在搜索、过滤或配置变化时重置
  useEffect(() => {
    hasDataRef.current = false; // 强制重设数据状态，确保切换配置时显示全屏加载
    fetchFiles(1, false);
  }, [filter, search, selectedConfigId, fetchFiles]);

  const removeFile = useCallback((id: string) => {
    setFiles(prev => {
      const newFiles = prev.filter(f => f.id !== id);
      hasDataRef.current = newFiles.length > 0;
      return newFiles;
    });
  }, []);

  const deleteFile = async (id: string, deleteMode: 'full' | 'record-only' = 'record-only') => {
    const file = files.find(f => f.id === id);
    try {
      await fileService.deleteFile(id, deleteMode);
      removeFile(id);
      
      // Refresh quota after deletion
      if (refreshQuotaFn) {
        refreshQuotaFn();
      }
      
      const message = deleteMode === 'full' ? '文件已完全删除' : '记录已删除';
      const description = deleteMode === 'full' 
        ? (file?.filename || '已从存储库中移除')
        : (file?.filename ? `${file.filename} (图床文件保留)` : 'MinIO文件保留，可重新同步');
      
      toast.success(message, { description });
      return true;
    } catch {
      toast.error('删除失败', {
        description: file?.filename ? `无法删除 ${file.filename}` : '无法删除文件，请稍后重试'
      });
      return false;
    }
  };

  const batchDelete = async (ids: string[], deleteMode: 'full' | 'record-only' = 'record-only') => {
    try {
        await fileService.batchDeleteFiles(ids, deleteMode);
        setFiles(prev => {
          const newFiles = prev.filter(f => !ids.includes(f.id));
          hasDataRef.current = newFiles.length > 0;
          return newFiles;
        });
        
        // Refresh quota after batch deletion
        if (refreshQuotaFn) {
          refreshQuotaFn();
        }
        
        const message = deleteMode === 'full'
          ? `成功完全删除 ${ids.length} 个文件`
          : `成功删除 ${ids.length} 条记录`;
        const description = deleteMode === 'full'
          ? '已从存储库中批量移除'
          : 'MinIO文件保留，可重新同步';
        
        toast.success(message, { description });
        return true;
    } catch {
        toast.error('批量删除失败', {
          description: '部分文件可能无法删除，请重试'
        });
        return false;
    }
  }

  return {
    files,
    loading,
    isRefreshing,
    search,
    setSearch,
    filter,
    setFilter,
    viewMode,
    setViewMode,
    hasMore,
    loadingMore,
    loadMore: useCallback(() => fetchFiles(pageRef.current + 1, true), [fetchFiles]),
    refreshFn: useCallback(() => fetchFiles(1, false), [fetchFiles]),
    deleteFile,
    batchDelete
  };
}
