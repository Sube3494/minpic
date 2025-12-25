import { useState, useEffect, useCallback } from 'react';
import { FileItem, FilterType, ViewMode } from '@/types/file';
import { fileService } from '@/services/file.service';
import { toast } from 'sonner';

export function useFiles(initialFilter: FilterType = 'all', initialViewMode: ViewMode = 'grid') {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>(initialFilter);
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode);
  
  const loadFiles = useCallback(async () => {
    setLoading(true);
    const startTime = Date.now();
    try {
      const data = await fileService.getFiles(filter, search);
      
      // Calculate remaining time to satisfy minimum loading duration of 300ms
      // This prevents the "Heavy Render" from colliding with the "Page Entry Animation"
      const elapsed = Date.now() - startTime;
      const minLoadTime = 300; 
      if (elapsed < minLoadTime) {
        await new Promise(resolve => setTimeout(resolve, minLoadTime - elapsed));
      }
      
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

  const removeFile = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
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
    refreshFn: loadFiles,
    deleteFile,
    batchDelete
  };
}
