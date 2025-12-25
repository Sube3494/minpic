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
      toast.error('加载文件列表失败');
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

  const deleteFile = async (id: string) => {
    try {
      await fileService.deleteFile(id);
      removeFile(id);
      toast.success('文件已删除');
      return true;
    } catch {
      toast.error('删除失败');
      return false;
    }
  };

  const batchDelete = async (ids: string[]) => {
    try {
        await fileService.batchDeleteFiles(ids);
        setFiles(prev => prev.filter(f => !ids.includes(f.id)));
        // Update cache for batch deletion
        Object.keys(cache.current).forEach(key => {
          cache.current[key] = cache.current[key].filter(f => !ids.includes(f.id));
        });
        toast.success(`成功删除 ${ids.length} 个文件`);
        return true;
    } catch {
        toast.error('批量删除失败');
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
