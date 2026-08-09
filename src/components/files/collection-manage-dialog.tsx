
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Trash2, Plus, FileText, Image as ImageIcon, Video, Layers, Settings2, Check } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { CollectionAddDialog } from './collection-add-dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn, formatFileSize } from '@/lib/utils';

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
  fileSize?: string;
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
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [savingInfo, setSavingInfo] = useState(false);
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  
  // Calculate checked state for "Select All"
  const isAllSelected = items.length > 0 && selectedIds.length === items.length;

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

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(items.map(i => i.fileId));
    } else {
      setSelectedIds([]);
    }
  };

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/collections/${collectionId}`);
      if (!res.ok) throw new Error('Failed to load collection');
      const data = await res.json();
      setItems(data.items || []);
      setName(data.name || '');
      setDescription(data.description || '');
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

  const handleUpdateInfo = async () => {
    if (!name.trim()) {
      toast.error('合集名称不能为空');
      return;
    }
    setSavingInfo(true);
    try {
      const res = await fetch(`/api/collections/${collectionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
        }),
      });

      if (!res.ok) throw new Error('Failed to update info');
      toast.success('基本信息已更新');
      setIsEditingInfo(false);
      onUpdate();
    } catch (error) {
      console.error(error);
      toast.error('保存失败');
    } finally {
      setSavingInfo(false);
    }
  };

  return (
    <>
        <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl glass-strong bg-white/90 dark:bg-zinc-950/85 backdrop-blur-3xl border-zinc-200/80 dark:border-white/10 max-h-[92vh] sm:max-h-[86vh] flex flex-col p-0 overflow-hidden shadow-2xl rounded-t-[28px] sm:rounded-[28px]">
            <div className="px-5 sm:px-7 pt-5 sm:pt-7 pb-4 border-b border-zinc-100 dark:border-white/5">
                <DialogHeader className="text-left">
                    <div className="flex items-start gap-3.5">
                        <div className="p-2.5 rounded-2xl bg-primary/10 border border-primary/15 text-primary shadow-sm">
                            <Layers className="w-5 h-5" strokeWidth={1.8} />
                        </div>
                        <div className="flex min-w-0 flex-col gap-1">
                            <DialogTitle className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-white">管理合集内容</DialogTitle>
                            <DialogDescription className="text-zinc-500 dark:text-zinc-400 text-xs leading-5">
                                管理合集中的文件，或添加新资源。
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>
            </div>

            <div className="px-5 sm:px-7 py-4">
                <div className={cn(
                    "rounded-2xl border transition-all duration-300 overflow-hidden",
                    isEditingInfo 
                        ? "bg-zinc-50/50 dark:bg-white/5 border-zinc-200/50 dark:border-white/10 p-3 sm:p-4" 
                        : "bg-transparent border-transparent p-0"
                )}>
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 text-xs font-normal text-zinc-500">
                            <Settings2 className="w-3.5 h-3.5" />
                            <span className="font-medium">合集信息</span>
                        </div>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 px-3 text-[11px] rounded-xl text-zinc-600 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-200/70 dark:hover:bg-white/15"
                            onClick={() => setIsEditingInfo(!isEditingInfo)}
                        >
                            {isEditingInfo ? '取消' : '编辑信息'}
                        </Button>
                    </div>

                    <AnimatePresence>
                        {isEditingInfo && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.3, ease: "easeInOut" }}
                                className="space-y-4 px-1 py-1"
                            >
                                <div className="space-y-1.5">
                                    <Label htmlFor="manage-name" className="text-[10px] uppercase tracking-wider text-zinc-400 ml-1">名称</Label>
                                    <Input
                                        id="manage-name"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="合集名称"
                                        className="h-9 text-sm bg-white/50 dark:bg-black/20 border-zinc-200/50 dark:border-white/10 rounded-xl focus:ring-primary/10"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="manage-desc" className="text-[10px] uppercase tracking-wider text-zinc-400 ml-1">描述</Label>
                                    <Textarea
                                        id="manage-desc"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="合集描述 (可选)"
                                        rows={2}
                                        className="text-sm bg-white/50 dark:bg-black/20 border-zinc-200/50 dark:border-white/10 rounded-xl resize-none focus:ring-primary/10"
                                    />
                                </div>
                                <Button 
                                    className="w-full h-9 rounded-xl text-xs gap-2 shadow-lg shadow-primary/10"
                                    onClick={handleUpdateInfo}
                                    disabled={savingInfo}
                                >
                                    {savingInfo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                    保存基本信息
                                </Button>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {!isEditingInfo && (
                        <div className="px-1 py-1">
                            <h4 className="text-base font-medium text-zinc-800 dark:text-zinc-100 truncate">{name || '未命名合集'}</h4>
                            <p className="text-xs text-zinc-500 mt-1 line-clamp-1">{description || '暂无描述'}</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="px-5 sm:px-7 py-3.5 flex flex-col sm:flex-row gap-3 sm:items-center justify-between border-y border-zinc-100 bg-zinc-50/30 dark:border-white/5 dark:bg-white/[0.025]">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3.5">
                        <div 
                            className="cursor-pointer transition-all hover:scale-110 active:scale-90"
                            onClick={() => toggleSelectAll(!isAllSelected)}
                        >
                            <div className={cn(
                                "w-5 h-5 rounded-full flex items-center justify-center transition-all duration-300",
                                isAllSelected 
                                    ? "bg-primary border border-primary text-white scale-110" 
                                    : "bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-white/20 text-transparent"
                            )}>
                                <Check className="w-3 h-3" strokeWidth={4} />
                            </div>
                        </div>
                        <Label 
                            htmlFor="select-all" 
                            className="text-sm font-normal text-zinc-700 dark:text-zinc-300 cursor-pointer select-none tracking-tight"
                            onClick={() => toggleSelectAll(!isAllSelected)}
                        >
                            <span className="font-medium">全选</span><span className="text-zinc-400">{items.length}</span>
                        </Label>
                    </div>
                    <AnimatePresence>
                        {selectedIds.length > 0 && (
                            <motion.div 
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                className="flex items-center gap-2 ml-4"
                            >
                                <span className="text-xs text-primary font-normal px-2 py-0.5 rounded-full bg-primary/10">已选 {selectedIds.length} 项</span>
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-7 px-3 rounded-full text-destructive hover:text-destructive hover:bg-destructive/10 text-xs font-medium transition-colors"
                                    onClick={handleBatchRemove}
                                    disabled={removingId !== null}
                                >
                                    {removingId === 'batch' ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : <Trash2 className="w-3 h-3 mr-1.5" />}
                                    批量移除
                                </Button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
                <Button 
                    size="sm" 
                    onClick={() => setShowAddDialog(true)} 
                    className="w-full sm:w-auto gap-2 rounded-xl px-4 h-9 bg-primary shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all text-xs font-medium"
                >
                    <Plus className="w-4 h-4" />
                    添加新资源
                </Button>
            </div>

            <ScrollArea className="flex-1 min-h-[400px]">
                <div className="px-3 sm:px-5 py-2 pb-6">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-[350px] gap-4">
                            <div className="relative">
                                <Loader2 className="w-10 h-10 animate-spin text-primary opacity-20" />
                                <Loader2 className="w-10 h-10 animate-spin text-primary absolute inset-0 [animation-delay:-0.5s]" />
                            </div>
                            <span className="text-sm font-normal text-zinc-500 animate-pulse">正在载入合集资源...</span>
                        </div>
                    ) : items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-[350px] text-zinc-400 dark:text-zinc-600">
                            <div className="w-20 h-20 rounded-3xl bg-zinc-100 dark:bg-white/5 flex items-center justify-center mb-6 border border-zinc-200 dark:border-white/5 shadow-inner">
                                <FileText className="w-10 h-10 opacity-20" />
                            </div>
                            <p className="text-sm font-normal">这是一个空合集</p>
                            <p className="text-xs mt-1 opacity-60 font-normal">点击上方按钮开始添加文件吧</p>
                        </div>
                    ) : (
                        <div className="space-y-1 pb-4">
                            <AnimatePresence mode="popLayout">
                                {items.map((item) => {
                                    const isSelected = selectedIds.includes(item.fileId);
                                    return (
                                        <motion.div 
                                            key={item.id} 
                                            layout
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className={cn(
                                                "group relative grid grid-cols-[auto_auto_1fr_auto] items-center gap-3 sm:gap-4 px-2.5 py-2.5 rounded-2xl cursor-pointer transition-all duration-200 border",
                                                isSelected 
                                                    ? "bg-zinc-100/80 dark:bg-white/10 border-zinc-200 dark:border-primary/20 shadow-sm" 
                                                    : "bg-transparent border-transparent hover:bg-zinc-100/50 dark:hover:bg-white/5 hover:border-zinc-200/50 dark:hover:border-white/5"
                                            )}
                                            onClick={() => toggleSelect(item.fileId)}
                                        >
                                            <div className="flex items-center justify-center pl-1" onClick={(e) => e.stopPropagation()}>
                                                <div 
                                                    className="cursor-pointer transition-all hover:scale-110 active:scale-90"
                                                    onClick={() => toggleSelect(item.fileId)}
                                                >
                                                    <div className={cn(
                                                        "w-5 h-5 rounded-full flex items-center justify-center transition-all duration-300",
                                                        isSelected 
                                                            ? "bg-primary border border-primary text-white scale-110" 
                                                            : "bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-white/20 text-transparent"
                                                    )}>
                                                        <Check className="w-3 h-3" strokeWidth={4} />
                                                    </div>
                                                </div>
                                            </div>

                                             <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-white/5 overflow-hidden flex items-center justify-center border border-zinc-200/50 dark:border-white/10 shadow-sm group-hover:scale-105 transition-transform">
                                                {item.thumbnailUrl ? (
                                                    /* eslint-disable-next-line @next/next/no-img-element */
                                                    <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        {item.fileType === 'video' ? <Video className="w-5 h-5 text-zinc-400" /> : <ImageIcon className="w-5 h-5 text-zinc-400" />}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="min-w-0 flex flex-col justify-center overflow-hidden">
                                                <h4 className={cn(
                                                    "text-sm font-normal truncate transition-colors leading-tight mb-1",
                                                    isSelected ? "text-primary" : "text-zinc-700 dark:text-zinc-200"
                                                )} title={item.filename}>
                                                    {item.filename}
                                                </h4>
                                                <div className="flex items-center gap-2 overflow-hidden">
                                                    <span className={cn(
                                                        "text-[9px] font-normal px-1.5 py-0.5 rounded-md uppercase tracking-wide leading-none shrink-0",
                                                        item.fileType === 'video' ? "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-500" : "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-500"
                                                    )}>
                                                        {item.fileType}
                                                    </span>
                                                    {item.fileSize && (
                                                        <span className="text-[11px] text-zinc-400 font-normal tabular-nums opacity-60 truncate">
                                                            {formatFileSize(BigInt(item.fileSize))}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-center w-8" onClick={(e) => e.stopPropagation()}>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 rounded-full text-zinc-400 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all active:scale-90 flex items-center justify-center"
                                                    onClick={() => handleRemove(item.fileId)}
                                                    disabled={removingId === item.fileId || removingId === 'batch'}
                                                >
                                                    {removingId === item.fileId ? (
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    ) : (
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    )}
                                                </Button>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>
                        </div>
                    )}
                </div>
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
