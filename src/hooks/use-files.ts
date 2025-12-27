import { useState, useEffect, useCallback, useRef } from 'react';
import { FileItem, FilterType, ViewMode } from '@/types/file';
import { fileService } from '@/services/file.service';
import { toast } from 'sonner';

export function useFiles(initialFilter: FilterType = 'all', initialViewMode: ViewMode = 'grid') {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>(initialFilter);
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode);
  
  // Cache for storing fetched results: key = "${filter}-${search}"
  const cache = useRef<Record<string, FileItem[]>>({});

  const loadFiles = useCallback(async (force = false) => {
    const cacheKey = `${filter}-${search}`;

    // Return from cache if available and not forced
    if (!force && cache.current[cacheKey]) {
      setFiles(cache.current[cacheKey]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const startTime = Date.now();
    try {
      const data = await fileService.getFiles(filter, search);
      
      // Calculate remaining time to satisfy minimum loading duration of 300ms
      // Only delay if it was a real network request (not cache)
      const elapsed = Date.now() - startTime;
      const minLoadTime = 300; 
      if (elapsed < minLoadTime) {
        await new Promise(resolve => setTimeout(resolve, minLoadTime - elapsed));
      }
      
      cache.current[cacheKey] = data;
      setFiles(data);
    } catch {
      toast.error('加载文件列表失败', {
        description: '请检查网络连接或刷新页面重试'
      });
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const refreshFiles = useCallback(() => {
    cache.current = {}; // Clear cache on force refresh
    loadFiles(true);
  }, [loadFiles]);

  const removeFile = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
    // Update cache to reflect deletion
    Object.keys(cache.current).forEach(key => {
      cache.current[key] = cache.current[key].filter(f => f.id !== id);
    });
  }, []);

  const deleteFile = async (id: string, deleteMode: 'full' | 'record-only' = 'record-only') => {
    const file = files.find(f => f.id === id);
    try {
      await fileService.deleteFile(id, deleteMode);
      removeFile(id);
      
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
        setFiles(prev => prev.filter(f => !ids.includes(f.id)));
        // Update cache for batch deletion
        Object.keys(cache.current).forEach(key => {
          cache.current[key] = cache.current[key].filter(f => !ids.includes(f.id));
        });
        
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
    search,
    setSearch,
    filter,
    setFilter,
    viewMode,
    setViewMode,
    refreshFn: refreshFiles,
    deleteFile,
    batchDelete
  };
}
