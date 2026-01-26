
import { useState, useEffect, useCallback } from 'react';
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
import { Loader2, Search, CheckCircle2, Circle, Image as ImageIcon, Video } from 'lucide-react';
import { useDebounce } from '@/hooks/use-debounce';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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
  thumbnailUrl?: string; // We'll construct this manually or use API helper
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

  // Stable fetch function
  const fetchFiles = useCallback(async (pageParam: number, searchParam: string, reset: boolean) => {
    setLoading(true);
    
    try {
      const params = new URLSearchParams({
        page: pageParam.toString(),
        pageSize: '24',
      });
      if (searchParam) params.set('search', searchParam);

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
      // Reset state on open
      setSearch('');
      setSelectedIds([]);
      setPage(1);
      setHasMore(true);
      fetchFiles(1, '', true);
    }
  }, [open, fetchFiles]);

  // Refetch when search changes (debounce)
  useEffect(() => {
    if (open) {
        // Only if search changed? Use a text comparison or just rely on debounce
        // The previous search value check is missing, so this might run on open too?
        // But the first effect handles open.
        // We really only want this if debouncedSearch CHANGES.
        // But react runs effect on mount/update. 
        // We can just call it. reset=true.
        if (debouncedSearch !== '') {
             fetchFiles(1, debouncedSearch, true);
        }
    }
  }, [debouncedSearch, open, fetchFiles]);

  // Load More handler
  const handleLoadMore = () => {
      fetchFiles(page, debouncedSearch, false);
  };


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
        // onAdd closes dialog or we close it here? 
        // usually parent handles logic, but let's clear state
        setSelectedIds([]);
    } finally {
        setSubmitting(false);
    }
  };

  const isExisting = (id: string) => existingFileIds.includes(id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl dark:bg-zinc-900/95 backdrop-blur-md border-white/10 h-[80vh] flex flex-col p-0 gap-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-border/50">
            <DialogHeader>
            <DialogTitle>添加文件</DialogTitle>
            </DialogHeader>
            <div className="mt-4 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                    placeholder="搜索文件名..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 bg-zinc-100/50 dark:bg-white/5 border-none shadow-none"
                />
            </div>
        </div>

        <ScrollArea className="flex-1 p-6">
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                {files.map(file => {
                    const exists = isExisting(file.id);
                    const selected = selectedIds.includes(file.id);
                    
                    return (
                        <div 
                            key={file.id}
                            onClick={() => toggleSelect(file.id)}
                            className={cn(
                                "group relative aspect-square rounded-lg overflow-hidden border cursor-pointer transition-all",
                                exists ? "opacity-50 grayscale cursor-not-allowed border-transparent" : 
                                selected ? "border-primary ring-2 ring-primary/20 ring-offset-1 ring-offset-background" : "border-border/50 hover:border-primary/50"
                            )}
                        >
                            {/* Thumbnail */}
                            <div className="w-full h-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                                {file.fileType === 'image' || file.thumbnailPath ? (
                                    <img 
                                        src={file.thumbnailPath === 'database' 
                                            ? `/api/files/${file.id}/thumbnail`
                                            : `/api/files/${file.id}/thumbnail` // Simplified assuming route handles redirect if needed, or we rely on logic. 
                                            // Wait, files list usually returns presigned URL or we use API for db thumbs.
                                            // Let's use the standard API thumbnail route for simplicity on grid.
                                        } 
                                        loading="lazy"
                                        alt={file.filename}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    file.fileType === 'video' ? <Video className="w-8 h-8 opacity-20" /> : <ImageIcon className="w-8 h-8 opacity-20" />
                                )}
                            </div>

                            {/* Selection Overlay */}
                            <div className={cn(
                                "absolute inset-0 transition-colors flex items-center justify-center",
                                selected ? "bg-primary/10" : "bg-transparent group-hover:bg-black/10 dark:group-hover:bg-white/5"
                            )}>
                                {exists ? (
                                    <span className="text-[10px] font-medium bg-black/60 text-white px-1.5 py-0.5 rounded-full backdrop-blur-sm">已添加</span>
                                ) : (
                                    selected ? (
                                        <CheckCircle2 className="w-8 h-8 text-primary drop-shadow-md" />
                                    ) : (
                                        <Circle className="w-4 h-4 text-white/70 opacity-0 group-hover:opacity-100 drop-shadow-md absolute top-2 right-2" />
                                    )
                                )}
                            </div>
                            
                            {/* Filename caption */}
                            <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/80 to-transparent p-2 pt-6">
                                <p className="text-[10px] text-white truncate px-1">{file.filename}</p>
                            </div>
                        </div>
                    );
                })}
            </div>
            
            {loading && (
                <div className="py-8 flex justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
            )}
            
            {!loading && hasMore && (
                <div className="py-4 text-center">
                    <Button variant="ghost" size="sm" onClick={handleLoadMore}>加载更多</Button>
                </div>
            )}

            {!loading && files.length === 0 && (
                <div className="py-12 text-center text-muted-foreground">
                    未找到文件
                </div>
            )}
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t border-border/50 bg-muted/20">
            <div className="flex items-center justify-between w-full">
                <span className="text-sm text-muted-foreground">已选择 {selectedIds.length} 个文件</span>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>取消</Button>
                    <Button onClick={handleConfirm} disabled={submitting || selectedIds.length === 0}>
                        {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        确认添加
                    </Button>
                </div>
            </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
