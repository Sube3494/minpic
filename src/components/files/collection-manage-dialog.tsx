
import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Trash2, Plus, FileText, Image as ImageIcon, Video, Check } from 'lucide-react';
import { toast } from 'sonner';
import { CollectionAddDialog } from './collection-add-dialog';
import { cn } from '@/lib/utils';

interface CollectionManageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collectionId: string;
  onUpdate: () => void; // Callback to refresh parent list
}

interface CollectionItem {
  id: string; // collection item id
  fileId: string;
  filename: string;
  fileType: string;
  thumbnailUrl: string | null;
}

export function CollectionManageDialog({
  open,
  onOpenChange,
  collectionId,
  onUpdate,
}: CollectionManageDialogProps) {
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Reset selection when dialog closes or items change
  useEffect(() => {
     if (!open) {
         setSelectedIds([]);
     }
  }, [open]);

  const toggleSelect = (fileId: string) => {
    setSelectedIds(prev => 
        prev.includes(fileId) 
        ? prev.filter(id => id !== fileId)
        : [...prev, fileId]
    );
  };

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/collections/${collectionId}`);
      if (!res.ok) throw new Error('Failed to load collection');
      const data = await res.json();
      setItems(data.items || []);
    } catch (error) {
      console.error(error);
      toast.error('加载合集详情失败');
    } finally {
      setLoading(false);
    }
  }, [collectionId]);

  useEffect(() => {
    if (open && collectionId) {
      loadItems();
    }
  }, [open, collectionId, loadItems]);

  const handleRemove = async (fileId: string) => {
    setRemovingId(fileId);
    try {
      const res = await fetch(`/api/collections/${collectionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          removeFileIds: [fileId]
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to remove item');
      }
      
      setItems(prev => prev.filter(item => item.fileId !== fileId));
      toast.success('已移除文件');
      onUpdate();
    } catch (error) {
      console.error(error);
      const msg = error instanceof Error ? error.message : '移除失败';
      toast.error(msg === 'Failed to remove item' ? '移除失败' : msg);
    } finally {
      setRemovingId(null);
    }
  };

  const handleAddFiles = async (fileIds: string[]) => {
    try {
        const res = await fetch(`/api/collections/${collectionId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              addFileIds: fileIds
            }),
          });
    
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || 'Failed to add items');
          }
          
          toast.success(`已添加 ${fileIds.length} 个文件`);
          loadItems(); // Reload list
          onUpdate();
          setShowAddDialog(false);
    } catch (error) {
        console.error(error);
        const msg = error instanceof Error ? error.message : '添加失败';
        toast.error(msg === 'Failed to add items' ? '添加失败' : msg);
    }
  };

  const handleBatchRemove = async () => {
    if (selectedIds.length === 0) return;
    setRemovingId('batch'); // Lock UI
    
    try {
      const res = await fetch(`/api/collections/${collectionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          removeFileIds: selectedIds
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to remove items');
      }
      
      setItems(prev => prev.filter(item => !selectedIds.includes(item.fileId)));
      toast.success(`已移除 ${selectedIds.length} 个文件`);
      setSelectedIds([]);
      onUpdate();
    } catch (error) {
      console.error(error);
      const msg = error instanceof Error ? error.message : '移除失败';
      toast.error(msg === 'Failed to remove items' ? '移除失败' : msg);
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <>
        <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-xl dark:bg-zinc-900/95 backdrop-blur-md border-white/10 max-h-[85vh] flex flex-col">
            <DialogHeader>
            <DialogTitle>管理合集内容</DialogTitle>
            <DialogDescription>
                管理合集中的文件，或添加新文件。
            </DialogDescription>
            </DialogHeader>

            <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                    <div className="text-sm text-muted-foreground">
                       共 {items.length} 个文件
                    </div>
                    {selectedIds.length > 0 && (
                        <div className="flex items-center gap-2 ml-4">
                             <span className="text-sm text-primary font-medium">已选 {selectedIds.length} 项</span>
                             <Button 
                                variant="destructive" 
                                size="sm" 
                                className="h-7 px-2"
                                onClick={handleBatchRemove}
                                disabled={removingId !== null}
                             >
                                {removingId === 'batch' ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Trash2 className="w-3 h-3 mr-1" />}
                                批量移除
                             </Button>
                        </div>
                    )}
                </div>
                <Button size="sm" onClick={() => setShowAddDialog(true)} className="gap-1">
                    <Plus className="w-4 h-4" />
                    添加文件
                </Button>
            </div>

            <ScrollArea className="flex-1 min-h-[300px] -mx-6 px-6">
                {loading ? (
                    <div className="flex items-center justify-center h-[300px]">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                ) : items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                        <FileText className="w-12 h-12 mb-4 opacity-20" />
                        <p>暂无文件</p>
                    </div>
                ) : (
                    <div className="space-y-2 pb-4">
                        {items.map((item) => {
                            const isSelected = selectedIds.includes(item.fileId);
                            return (
                                <div 
                                    key={item.id} 
                                    className={cn(
                                        "flex items-center gap-3 p-2 rounded-lg border transition-all cursor-pointer group",
                                        isSelected 
                                            ? "bg-primary/5 border-primary/20" 
                                            : "bg-zinc-50 dark:bg-white/5 border-zinc-100 dark:border-white/5 hover:border-zinc-300 dark:hover:border-white/20"
                                    )}
                                    onClick={() => toggleSelect(item.fileId)}
                                >
                                    <div className={cn(
                                        "w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all ml-1",
                                        isSelected 
                                            ? "bg-primary border-primary text-white" 
                                            : "border-zinc-400 dark:border-zinc-600 group-hover:border-primary/50"
                                    )}>
                                        {isSelected && <Check className="w-3 h-3" />}
                                    </div>

                                    <div className="w-12 h-12 rounded-md bg-zinc-200 dark:bg-zinc-800 overflow-hidden shrink-0 flex items-center justify-center">
                                        {item.thumbnailUrl ? (
                                            /* eslint-disable-next-line @next/next/no-img-element */
                                            <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            item.fileType === 'video' ? <Video className="w-5 h-5 opacity-50" /> : <ImageIcon className="w-5 h-5 opacity-50" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-sm font-medium truncate">{item.filename}</h4>
                                        <p className="text-xs text-muted-foreground uppercase">{item.fileType}</p>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleRemove(item.fileId);
                                        }}
                                        disabled={removingId === item.fileId || removingId === 'batch'}
                                    >
                                        {removingId === item.fileId ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Trash2 className="w-4 h-4" />
                                        )}
                                    </Button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </ScrollArea>
        </DialogContent>
        </Dialog>

        <CollectionAddDialog 
            open={showAddDialog} 
            onOpenChange={setShowAddDialog}
            onAdd={handleAddFiles}
            existingFileIds={items.map(i => i.fileId)}
        />
    </>
  );
}
