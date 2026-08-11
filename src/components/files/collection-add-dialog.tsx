
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Search, CheckCircle2, Circle, Image as ImageIcon, Video, Check, Plus } from 'lucide-react';
import { useDebounce } from '@/hooks/use-debounce';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useConfigs } from '@/hooks/use-configs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface CollectionAddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (fileIds: string[]) => Promise<void>;
  existingFileIds: string[];
}

interface FileItem {
  id: string;
  filename: string;
  fileType: string;
  thumbnailPath: string | null;
  thumbnailUrl?: string; 
  updatedAt: string;
}

export function CollectionAddDialog({
  open,
  onOpenChange,
  onAdd,
  existingFileIds,
}: CollectionAddDialogProps) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const { configs, selectedConfigId, configLoading } = useConfigs();
  const [sourceConfigId, setSourceConfigId] = useState('');
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const availableConfigs = configs.filter(config => config.status !== 'error');

  // Stable fetch function
  const fetchFiles = useCallback(async (pageParam: number, searchParam: string, reset: boolean, configId: string) => {
    setLoading(true);
    
    try {
      const params = new URLSearchParams({
        page: pageParam.toString(),
        pageSize: '30',
      });
      if (searchParam) params.set('search', searchParam);
      if (configId) params.set('configId', configId);

      const res = await fetch(`/api/files?${params}`);
      if (!res.ok) throw new Error('Failed to load files');
      const data = await res.json();
      
      const newFiles = data.files || [];
      
      if (reset) {
        setFiles(newFiles);
      } else {
        setFiles(prev => [...prev, ...newFiles]);
      }
      
      setHasMore(pageParam < (data.pagination?.totalPages || 0));
      setPage(pageParam + 1);

    } catch (error) {
      console.error(error);
      toast.error('加载文件列表失败');
    } finally {
        setLoading(false);
    }
  }, []);

  // Reset and initial load on open
  useEffect(() => {
    if (open) {
      setSearch('');
      setSelectedIds([]);
      setPage(1);
      setHasMore(true);
    }
  }, [open]);

  useEffect(() => {
    if (!sourceConfigId && (selectedConfigId || availableConfigs[0]?.id)) {
      setSourceConfigId(selectedConfigId || availableConfigs[0].id);
    }
  }, [sourceConfigId, selectedConfigId, availableConfigs]);

  useEffect(() => {
    if (open && sourceConfigId) fetchFiles(1, '', true, sourceConfigId);
  }, [open, sourceConfigId, fetchFiles]);

  // Refetch when search changes (debounce)
  useEffect(() => {
    if (open && debouncedSearch !== undefined) {
        fetchFiles(1, debouncedSearch, true, sourceConfigId);
    }
  }, [debouncedSearch, open, sourceConfigId, fetchFiles]);

  useEffect(() => {
    if (!open || !hasMore || loading || !sourceConfigId) return;

    const sentinel = loadMoreRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          fetchFiles(page, debouncedSearch, false, sourceConfigId);
        }
      },
      { threshold: 0.1, rootMargin: '240px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [open, hasMore, loading, page, debouncedSearch, sourceConfigId, fetchFiles]);

  const toggleSelect = (id: string) => {
    if (existingFileIds.includes(id)) return;
    
    setSelectedIds(prev => 
        prev.includes(id) 
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  };

  const handleConfirm = async () => {
    if (selectedIds.length === 0) return;
    setSubmitting(true);
    try {
        await onAdd(selectedIds);
        setSelectedIds([]);
    } finally {
        setSubmitting(false);
    }
  };

  const isExisting = (id: string) => existingFileIds.includes(id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl bg-white dark:bg-[#0d1424]/95 backdrop-blur-3xl border-zinc-200 dark:border-[#2d3748] h-[90vh] sm:h-[85vh] flex flex-col p-0 gap-0 overflow-hidden shadow-2xl rounded-t-[32px] sm:rounded-3xl">
        <div className="p-4 sm:p-6 pb-4 bg-linear-to-b from-zinc-50/60 to-transparent dark:from-[#171e2d] dark:to-transparent border-b border-zinc-100 dark:border-[#202938]">
            <DialogHeader className="mb-4 text-left">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-primary/10 text-primary">
                        <Plus className="w-5 h-5" />
                    </div>
                    <DialogTitle className="text-xl font-bold tracking-tight">添加文件至合集</DialogTitle>
                </div>
            </DialogHeader>
            <div className="mb-3 flex items-center gap-2">
                <label htmlFor="collection-source" className="shrink-0 text-xs font-medium text-zinc-500">资源库</label>
                <Select
                    value={sourceConfigId}
                    disabled={configLoading || availableConfigs.length === 0}
                    onValueChange={(value) => {
                        setSourceConfigId(value);
                        setSelectedIds([]);
                        setSearch('');
                    }}
                >
                    <SelectTrigger className="h-9 min-w-0 flex-1 rounded-xl border-zinc-200/80 bg-white/70 text-xs text-zinc-700 shadow-sm hover:bg-white dark:border-white/15 dark:bg-white/[0.08] dark:text-zinc-100 dark:hover:bg-white/[0.12]">
                        <SelectValue placeholder={configLoading ? '正在加载资源库...' : '选择资源库'} />
                    </SelectTrigger>
                    <SelectContent position="popper" className="border-zinc-200/80 bg-white/95 dark:border-white/15 dark:bg-zinc-800/95">
                        {availableConfigs.length === 0 ? (
                            <SelectItem value="empty" disabled>暂无可用资源库</SelectItem>
                        ) : availableConfigs.map(config => (
                            <SelectItem key={config.id} value={config.id}>{config.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="relative group">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-primary transition-colors" />
                <Input 
                    placeholder="搜索资源库中的文件..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-11 pl-10 pr-4 bg-zinc-100/50 dark:bg-white/5 border-zinc-200 dark:border-zinc-800 focus-visible:ring-primary/20 rounded-2xl shadow-inner transition-all"
                />
            </div>
        </div>

        <ScrollArea className="flex-1">
            <div className="p-3 sm:p-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-3">
                    <AnimatePresence mode="popLayout">
                        {files.map((file, idx) => {
                            const exists = isExisting(file.id);
                            const selected = selectedIds.includes(file.id);
                            
                            return (
                                <motion.div 
                                    key={file.id}
                                    layout
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: Math.min(idx * 0.02, 0.2) }}
                                    onClick={() => toggleSelect(file.id)}
                                    className={cn(
                                        "group relative aspect-square rounded-2xl overflow-hidden border-2 transition-all active:scale-95",
                                        exists ? "opacity-40 grayscale cursor-not-allowed border-transparent" : 
                                        selected 
                                            ? "border-primary bg-primary/5 shadow-[0_0_20px_rgba(var(--primary),0.2)]" 
                                            : "border-zinc-100 dark:border-white/5 bg-zinc-50 dark:bg-white/2 hover:border-zinc-300 dark:hover:border-white/20 cursor-pointer"
                                    )}
                                >
                                    {/* Thumbnail */}
                                    <div className="w-full h-full flex items-center justify-center relative overflow-hidden">
                                        {file.fileType === 'image' || file.thumbnailPath ? (
                                            /* eslint-disable-next-line @next/next/no-img-element */
                                            <img 
                                                src={`/api/files/${file.id}/thumbnail`} 
                                                loading="lazy"
                                                alt={file.filename}
                                                className={cn(
                                                    "w-full h-full object-cover transition-transform duration-500 group-hover:scale-110",
                                                    selected && "scale-105"
                                                )}
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-zinc-100 dark:bg-zinc-800">
                                                {file.fileType === 'video' ? <Video className="w-8 h-8 text-zinc-400 opacity-40" /> : <ImageIcon className="w-8 h-8 text-zinc-400 opacity-40" />}
                                            </div>
                                        )}
                                        
                                        {/* Selection Indicator */}
                                        <div className={cn(
                                            "absolute inset-0 transition-all duration-300 flex items-center justify-center",
                                            selected ? "bg-primary/20 backdrop-blur-[2px]" : "bg-transparent group-hover:bg-black/5 dark:group-hover:bg-white/2"
                                        )}>
                                            {exists ? (
                                                <div className="flex flex-col items-center gap-1">
                                                    <CheckCircle2 className="w-6 h-6 text-zinc-400" />
                                                    <span className="text-[9px] font-bold text-zinc-500 bg-white/80 dark:bg-black/80 px-1.5 py-0.5 rounded-md">已添加</span>
                                                </div>
                                            ) : (
                                                selected ? (
                                                    <motion.div
                                                        initial={{ scale: 0.5, opacity: 0 }}
                                                        animate={{ scale: 1, opacity: 1 }}
                                                        className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center shadow-xl shadow-primary/30"
                                                    >
                                                        <Check className="w-6 h-6 stroke-[3px]" />
                                                    </motion.div>
                                                ) : (
                                                    <Circle className="w-5 h-5 text-white/50 opacity-0 group-hover:opacity-100 drop-shadow-md absolute top-2 right-2 transition-opacity" />
                                                )
                                            )}
                                        </div>
                                    </div>
                                    
                                    {/* Filename caption */}
                                    <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/90 via-black/40 to-transparent p-2 pt-6 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                                        <p className="text-[10px] text-white font-medium truncate">{file.filename}</p>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
                
                <div className="mt-8 flex flex-col items-center py-8">
                    {loading && (
                        <div className="flex flex-col items-center gap-3">
                             <Loader2 className="w-8 h-8 animate-spin text-primary opacity-50" />
                             <span className="text-xs font-medium text-zinc-500 animate-pulse">正在载入更多资源...</span>
                        </div>
                    )}
                    
                    {!loading && hasMore && (
                        <div
                            ref={loadMoreRef}
                            className="h-10 w-full"
                            aria-label="滚动加载更多资源"
                        />
                    )}

                    {!loading && files.length === 0 && (
                        <div className="flex flex-col items-center gap-4 opacity-40">
                            <Search className="w-12 h-12" />
                            <p className="text-sm font-medium">资源库中未找到相关文件</p>
                        </div>
                    )}
                </div>
            </div>
        </ScrollArea>

        <DialogFooter className="px-4 sm:px-6 py-3 sm:py-4 border-t border-zinc-100 dark:border-white/5 bg-zinc-50/50 dark:bg-white/2">
            <div className="flex flex-col sm:flex-row items-center justify-between w-full gap-4 sm:gap-0">
                <div className="flex items-center gap-2">
                    <div className="h-6 px-2.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center">
                        {selectedIds.length}
                    </div>
                    <span className="text-xs font-medium text-zinc-500">项已选</span>
                </div>
                <div className="flex gap-3">
                    <Button 
                        variant="ghost" 
                        onClick={() => onOpenChange(false)} 
                        disabled={submitting}
                        className="rounded-full px-6 text-xs font-bold"
                    >
                        取消
                    </Button>
                    <Button 
                        onClick={handleConfirm} 
                        disabled={submitting || selectedIds.length === 0}
                        className="rounded-full px-8 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all font-bold text-xs"
                    >
                        {submitting && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}
                        确认引入
                    </Button>
                </div>
            </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
