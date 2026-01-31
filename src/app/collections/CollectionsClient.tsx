/* eslint-disable @next/next/no-img-element */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageWrapper } from '@/components/layout/page-wrapper';
import { Button } from '@/components/ui/button';
import {
  Loader2,
  Copy,
  Trash2,
  ExternalLink,
  FolderOpen,
  Calendar,
  MoreVertical,
  Check,
  X,
  Search,
  Edit2,
  ChevronDown,
  ListFilter,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn, formatDistanceToNow, formatFileSize } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ShortlinkDialog } from '@/components/files/shortlink-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CollectionManageDialog } from '@/components/files/collection-manage-dialog';


interface Collection {
  id: string;
  name?: string;
  description?: string;
  fileCount: number;
  totalSize: number;
  shortCode?: string;
  shortUrl?: string;
  firstThumbnail?: string;
  thumbnails?: string[];
  createdAt: string;
  expiresAt?: string;
  isShared: boolean;
  sharedAt?: string;
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

export function CollectionsClient({ embedded = false, sharedOnly = false }: { embedded?: boolean; sharedOnly?: boolean }) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUnsharing, setIsUnsharing] = useState(false);
  const [renewId, setRenewId] = useState<string | null>(null);
  const [manageId, setManageId] = useState<string | null>(null);
  const [shareId, setShareId] = useState<string | null>(null);
  const [unshareId, setUnshareId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'time' | 'size' | 'files'>('time');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const isAllSelected = collections.length > 0 && selectedIds.length === collections.length;

  const loadCollections = useCallback(async () => {
    try {
      const url = sharedOnly ? '/api/collections?shared=true' : '/api/collections';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load collections');
      const data = await res.json();
      setCollections(data.collections || []);
    } catch (error) {
      console.error('Failed to load collections:', error);
      toast.error('加载合集失败');
    } finally {
      setLoading(false);
    }
  }, [sharedOnly]);

  useEffect(() => {
    loadCollections();
  }, [loadCollections]);

  const handleCopyShortlink = (e: React.MouseEvent, shortCode: string, shortUrl?: string) => {
    e.stopPropagation();
    // 优先使用后端存入的完整 shortUrl，其次作为兜底使用本地拼接的 /c/ 路径（合集专用）
    const urlToCopy = shortUrl || `${window.location.origin}/c/${shortCode}`;
    navigator.clipboard.writeText(urlToCopy);
    toast.success(
      <div className="flex items-center justify-between w-full gap-4 -my-1">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-sm text-foreground font-medium">短链已复制</span>
          <span className="text-[11px] text-zinc-500/80 truncate max-w-[200px]">{urlToCopy}</span>
        </div>
        <Button 
          size="icon" 
          variant="ghost" 
          className="h-10 w-10 rounded-xl hover:bg-emerald-500/10 transition-all shrink-0 -mr-1"
          onClick={(e) => { e.stopPropagation(); window.open(urlToCopy, '_blank'); }}
        >
          <ExternalLink className="w-5 h-5 text-emerald-500" />
        </Button>
      </div>
    );
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeleteId(id);
  };

  const handleRenew = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setRenewId(id);
  };

  const handleShare = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setShareId(id);
  };

  const handleUnshare = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setUnshareId(id);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    const id = deleteId;

    try {
      const res = await fetch(`/api/collections/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Failed to delete');
      }

      setCollections(prev => prev.filter(c => c.id !== id));
      toast.success('合集已删除');
      setDeleteId(null);
    } catch (error) {
      console.error('Failed to delete collection:', error);
      toast.error('删除失败');
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmRenew = async (expiresIn: number, unit: 'minutes' | 'hours' | 'days') => {
    if (!renewId) return;
    const id = renewId;
    
    try {
      const res = await fetch(`/api/collections/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiresIn, unit }),
      });
      
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      
      // Update local state
      setCollections(prev => prev.map(c => 
        c.id === id 
        ? { ...c, id: data.id, expiresAt: data.expiresAt, shortCode: data.shortCode, shortUrl: data.shortUrl } 
        : c
      ));
      
      setRenewId(null);
      
      // Copy new link
      const newUrl = data.shortUrl || `${window.location.origin}/c/${data.shortCode}`;
      
      if (newUrl) {
         navigator.clipboard.writeText(newUrl);
         toast.success(
          <div className="flex items-center justify-between w-full gap-4 -my-1">
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-sm text-foreground">
                已重新生成链接并复制
              </span>
              <span className="text-[11px] text-zinc-500/80 truncate max-w-[200px]">{newUrl}</span>
            </div>
            <Button 
              size="icon" 
              variant="ghost" 
              className="h-11 w-11 rounded-2xl hover:bg-emerald-500/10 transition-all shrink-0 -mr-1"
              onClick={(e) => { e.stopPropagation(); window.open(newUrl, '_blank'); }}
            >
              <ExternalLink className="w-6 h-6 text-emerald-500" />
            </Button>
          </div>
         );
      } else {
         toast.success('已延长有效期');
      }
      
    } catch (e) {
      console.error(e);
      toast.error('重新分享失败');
    }

  };

  const confirmShare = async (expiresIn: number, unit: 'minutes' | 'hours' | 'days') => {
    if (!shareId) return;
    const id = shareId;
    
    try {
      const res = await fetch(`/api/collections/${id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiresIn, unit }),
      });
      
      if (!res.ok) throw new Error('Failed to activate sharing');
      const data = await res.json();
      
      // Update local state
      setCollections(prev => prev.map(c => 
        c.id === id 
        ? { 
            ...c, 
            isShared: true,
            sharedAt: data.sharedAt,
            shortCode: data.shortCode, 
            shortUrl: data.shortUrl, 
            expiresAt: data.expiresAt 
          } 
        : c
      ));
      
      setShareId(null);
      
      // Copy new link
      const newUrl = data.shortUrl || `${window.location.origin}/c/${id}`;
      navigator.clipboard.writeText(newUrl);
      toast.success(
        <div className="flex items-center justify-between w-full gap-4 -my-1">
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-sm text-foreground">
              分享已激活并复制链接
            </span>
            <span className="text-[11px] text-zinc-500/80 truncate max-w-[200px]">{newUrl}</span>
          </div>
          <Button 
            size="icon" 
            variant="ghost" 
            className="h-11 w-11 rounded-2xl hover:bg-emerald-500/10 transition-all shrink-0 -mr-1"
            onClick={(e) => { e.stopPropagation(); window.open(newUrl, '_blank'); }}
          >
            <ExternalLink className="w-6 h-6 text-emerald-500" />
          </Button>
        </div>
      );
    } catch (e) {
      console.error(e);
      toast.error('激活分享失败');
    }
  };

  const confirmUnshare = async () => {
    if (!unshareId) return;
    setIsUnsharing(true);
    const id = unshareId;
    
    try {
      const res = await fetch(`/api/collections/${id}/share`, {
        method: 'DELETE',
      });
      
      if (!res.ok) throw new Error('Failed to deactivate sharing');
      
      // Update local state
      setCollections(prev => prev.map(c => 
        c.id === id 
        ? { 
            ...c, 
            isShared: false,
            sharedAt: undefined,
            shortCode: undefined, 
            shortUrl: undefined, 
            expiresAt: undefined 
          } 
        : c
      ));
      
      setUnshareId(null);
      toast.success('已关闭分享');
    } catch (e) {
      console.error(e);
      toast.error('关闭分享失败');
    } finally {
      setIsUnsharing(false);
    }
  };


  const handleManage = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setManageId(id);
  };

  const toggleSelect = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(collections.map(c => c.id));
    }
  };

  const confirmBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    setIsDeleting(true);

    try {
      const loadingToast = toast.loading(`正在批量删除 ${selectedIds.length} 个合集...`);
      let successCount = 0;
      
      // 循环删除，虽然效率一般但最稳妥，且合集数量通常不多
      for (const id of selectedIds) {
        const res = await fetch(`/api/collections/${id}`, { method: 'DELETE' });
        if (res.ok) successCount++;
      }

      setCollections(prev => prev.filter(c => !selectedIds.includes(c.id)));
      setSelectedIds([]);
      toast.success(`成功删除 ${successCount} 个合集`, { id: loadingToast });
    } catch (error) {
      console.error('Batch delete error:', error);
      toast.error('部分删除失败，请刷新重试');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleView = (id: string) => {
    window.open(`/c/${id}`, '_blank');
  };

  // 搜索和排序逻辑
  const filteredAndSorted = collections
    .filter(c => 
      searchTerm === '' || 
      (c.name && c.name.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return (a.name || '').localeCompare(b.name || '');
        case 'size':
          return Number(b.totalSize) - Number(a.totalSize);
        case 'files':
          return b.fileCount - a.fileCount;
        case 'time':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

  if (loading) {
    const loadingContent = (
      <div className="container mx-auto px-4 py-12 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
    if (embedded) return loadingContent;
    return (
      <PageWrapper>
        <div className="pt-24">{loadingContent}</div>
      </PageWrapper>
    );
  }

  if (collections.length === 0) {
    const emptyContent = (
      <div className="container mx-auto px-4 pb-12">
        {!embedded && (
          <div className="flex items-center gap-3 mb-8 pt-24">
            <div className="p-2 bg-primary/10 rounded-lg">
              <FolderOpen className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">我的合集</h1>
          </div>
        )}

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center py-24 px-4 text-center border-2 border-dashed border-muted-foreground/20 rounded-2xl bg-muted/5"
        >
          <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-6">
            <FolderOpen className="w-10 h-10 text-muted-foreground/50" />
          </div>
          <h3 className="text-xl font-semibold mb-2">还没有创建任何合集</h3>
          <p className="text-muted-foreground max-w-md mb-8">
            合集允许你将多个文件打包分享。前往文件管理，选择文件后点击“合集”按钮即可创建。
          </p>
          <Button asChild>
            <Link href="/files">
              前往文件管理
            </Link>
          </Button>
        </motion.div>
      </div>
    );
    if (embedded) return emptyContent;
    return <PageWrapper>{emptyContent}</PageWrapper>;
  }

  const content = (
    <div className="container mx-auto px-4 pb-12">
      {!embedded && (
        <div className="space-y-4 mb-8 pt-24">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <FolderOpen className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">我的合集</h1>
                <p className="text-muted-foreground text-sm mt-1">
                  共 {filteredAndSorted.length} 个合集
                </p>
              </div>
            </div>
            <Button variant="outline" asChild>
              <Link href="/files">
                创建新合集
              </Link>
            </Button>
          </div>
          
          {/* 搜索和排序 */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="搜索合集名称..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-10 pl-10 pr-4 rounded-xl border border-zinc-200/50 dark:border-white/10 bg-zinc-50/50 dark:bg-white/5 text-sm transition-all hover:bg-white dark:hover:bg-white/10 focus:outline-none focus:border-primary/20 focus:ring-4 focus:ring-primary/10"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-auto min-w-[80px] sm:w-[140px] px-3 sm:px-4 h-10 justify-between bg-zinc-50/50 dark:bg-white/5 border-zinc-200/50 dark:border-white/10 hover:bg-white dark:hover:bg-white/10 rounded-xl text-muted-foreground hover:text-foreground transition-all">
                  <span className="flex items-center gap-1.5 sm:gap-2">
                    <ListFilter className="w-4 h-4 shrink-0" />
                    <span className="text-xs sm:text-sm whitespace-nowrap">
                      <span className="hidden sm:inline">
                        {sortBy === 'time' && '按创建时间'}
                        {sortBy === 'name' && '按名称'}
                        {sortBy === 'files' && '按文件数'}
                        {sortBy === 'size' && '按大小'}
                      </span>
                      <span className="sm:hidden">
                        {sortBy === 'time' && '时间'}
                        {sortBy === 'name' && '名称'}
                        {sortBy === 'files' && '数量'}
                        {sortBy === 'size' && '大小'}
                      </span>
                    </span>
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 opacity-50 shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[140px]">
                <DropdownMenuItem onClick={() => setSortBy('time')} className="justify-between">
                  按创建时间
                  {sortBy === 'time' && <Check className="w-4 h-4 ml-2" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('name')} className="justify-between">
                  按名称
                  {sortBy === 'name' && <Check className="w-4 h-4 ml-2" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('files')} className="justify-between">
                  按文件数
                  {sortBy === 'files' && <Check className="w-4 h-4 ml-2" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('size')} className="justify-between">
                  按大小
                  {sortBy === 'size' && <Check className="w-4 h-4 ml-2" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
      >
        <AnimatePresence mode='popLayout'>
          {filteredAndSorted.map((collection) => (
            <motion.div
              key={collection.id}
              variants={item}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              whileHover={{ y: -5 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            >
              <div 
                className="group overflow-hidden cursor-pointer h-full flex flex-col bg-card rounded-xl border border-border/50 hover:border-primary/50 hover:shadow-xl transition-all duration-300"
                onClick={() => handleView(collection.id)}
              >
                {/* Thumbnail Grid */}
                <div className="aspect-video bg-muted relative overflow-hidden w-full">
                  {collection.thumbnails && collection.thumbnails.length > 0 ? (
                    <div className={cn(
                      "grid w-full h-full gap-0.5 bg-muted",
                      collection.thumbnails.length === 1 ? "grid-cols-1" : 
                      collection.thumbnails.length === 2 ? "grid-cols-2" :
                      collection.thumbnails.length >= 3 ? "grid-cols-2 grid-rows-2" : ""
                    )}>
                      {collection.thumbnails.map((thumb, idx) => (
                        <div 
                          key={idx} 
                          className={cn(
                            "relative overflow-hidden",
                            collection.thumbnails!.length === 3 && idx === 0 ? "row-span-2" : ""
                          )}
                        >
                          <img
                            src={thumb}
                            alt=""
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-secondary/50">
                      <FolderOpen className="w-12 h-12 text-muted-foreground/30" />
                    </div>
                  )}

                  {/* File count badge */}
                  <Badge variant="secondary" className="absolute top-3 left-3 bg-black/60 hover:bg-black/70 text-white border-none backdrop-blur-sm shadow-sm">
                     {collection.fileCount} 个文件
                  </Badge>

                  {/* Selection Checkbox */}
                  <div 
                    className="absolute top-3 right-3 z-10"
                    onClick={(e) => toggleSelect(e, collection.id)}
                  >
                    <div className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center transition-all duration-300",
                      selectedIds.includes(collection.id)
                        ? "bg-primary border border-primary text-white scale-110"
                        : "bg-black/20 hover:bg-black/40 border border-white/20 text-transparent"
                    )}>
                      <Check className="w-3 h-3" strokeWidth={4} />
                    </div>
                  </div>
                </div>

                {/* Info */}
                <div className="p-3 flex flex-col flex-1 gap-1.5">
                  <h3 className="font-semibold text-sm truncate pl-1 text-foreground" title={collection.name || `合集 ${new Date(collection.createdAt).toLocaleDateString()}`}>
                    {collection.name || `合集 ${new Date(collection.createdAt).toLocaleDateString('zh-CN')}`}
                  </h3>
                  {collection.description && (
                    <p className="text-[11px] text-muted-foreground line-clamp-1 pl-1 mb-0.5">
                      {collection.description}
                    </p>
                  )}
                  <div className="flex items-center text-xs text-muted-foreground/70 pl-1">
                     <Calendar className="w-3.5 h-3.5 mr-1.5" />
                     <span>{formatDistanceToNow(new Date(collection.createdAt))}</span>
                     <span className="mx-2 opacity-30">|</span>
                     <span>{formatFileSize(collection.totalSize)}</span>
                     
                     {collection.expiresAt && (
                       <>
                         <span className="mx-2 opacity-30">|</span>
                         <span className={new Date(collection.expiresAt) < new Date() ? 'text-red-500 font-medium' : 'text-orange-500/80'}>
                            {new Date(collection.expiresAt) < new Date() 
                              ? '已过期' 
                              : `${new Date(collection.expiresAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 到期`}
                         </span>
                       </>
                     )}
                  </div>

                  {/* Actions Row */}
                  <div className="flex items-center gap-1 pt-2 border-t border-border/50" onClick={(e) => e.stopPropagation()}>
                     {!collection.isShared ? (
                       // Private collection: Share + Manage + Delete
                       <>
                         <Button
                           variant="ghost"
                           size="sm"
                           className="flex-1 h-8 px-2 text-primary hover:text-primary hover:bg-primary/10 transition-colors"
                           onClick={(e) => handleShare(e, collection.id)}
                         >
                           <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                           <span className="text-xs font-medium">生成分享</span>
                         </Button>
                         
                         <DropdownMenu>
                           <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                             <Button variant="ghost" size="sm" className="h-8 w-8 px-0 text-muted-foreground hover:text-foreground">
                               <MoreVertical className="w-4 h-4" />
                             </Button>
                           </DropdownMenuTrigger>
                           <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => handleManage(e, collection.id)} className="flex items-center gap-3 cursor-pointer py-2.5">
                                <Edit2 className="w-4 h-4" />
                                管理合集内容
                              </DropdownMenuItem>

                             <DropdownMenuItem onClick={(e) => handleDelete(e, collection.id)} className="flex items-center gap-3 cursor-pointer py-2.5 text-destructive focus:text-destructive">
                               <Trash2 className="w-4 h-4" />
                               删除
                             </DropdownMenuItem>
                           </DropdownMenuContent>
                         </DropdownMenu>
                       </>
                     ) : collection.expiresAt && new Date(collection.expiresAt) < new Date() ? (
                       // Shared but expired: Renew + Delete
                       <>
                         <Button
                           variant="ghost"
                           size="sm"
                           className="flex-1 h-8 px-2 text-primary hover:text-primary hover:bg-primary/10 transition-colors"
                           onClick={(e) => handleRenew(e, collection.id)}
                         >
                           <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                           <span className="text-xs font-medium">重新分享</span>
                         </Button>
                         
                         <DropdownMenu>
                           <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                             <Button variant="ghost" size="sm" className="h-8 w-8 px-0 text-muted-foreground hover:text-foreground">
                               <MoreVertical className="w-4 h-4" />
                             </Button>
                           </DropdownMenuTrigger>
                           <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => handleManage(e, collection.id)} className="flex items-center gap-3 cursor-pointer py-2.5">
                                <RotateCcw className="w-4 h-4" />
                                管理合集内容
                              </DropdownMenuItem>

                             <DropdownMenuItem onClick={(e) => handleDelete(e, collection.id)} className="flex items-center gap-3 cursor-pointer py-2.5 text-destructive focus:text-destructive">
                               <Trash2 className="w-4 h-4" />
                               删除
                             </DropdownMenuItem>
                           </DropdownMenuContent>
                         </DropdownMenu>
                       </>
                     ) : (
                       // Shared and active: Copy + Open + More (Renew, Unshare, Manage, Delete)
                       <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="flex-1 h-8 px-2 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                            onClick={(e) => handleCopyShortlink(e, collection.shortCode!, collection.shortUrl)}
                          >
                            <Copy className="w-3.5 h-3.5 mr-1.5" />
                            <span className="text-xs font-medium">复制</span>
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            className="flex-1 h-8 px-2 text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleView(collection.id);
                            }}
                          >
                            <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                            <span className="text-xs font-medium">打开</span>
                          </Button>

                          <DropdownMenu>
                           <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                             <Button variant="ghost" size="sm" className="h-8 w-8 px-0 text-muted-foreground hover:text-foreground">
                               <MoreVertical className="w-4 h-4" />
                             </Button>
                           </DropdownMenuTrigger>
                           <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => handleManage(e, collection.id)} className="flex items-center gap-3 cursor-pointer py-2.5">
                                <Edit2 className="w-4 h-4" />
                                管理合集内容
                              </DropdownMenuItem>

                             <DropdownMenuItem onClick={(e) => handleRenew(e, collection.id)} className="flex items-center gap-3 cursor-pointer py-2.5 text-orange-500 focus:text-orange-500">
                               <RotateCcw className="w-4 h-4" />
                               重置链接
                             </DropdownMenuItem>
                             <DropdownMenuItem onClick={(e) => handleUnshare(e, collection.id)} className="flex items-center gap-3 cursor-pointer py-2.5 text-yellow-600 focus:text-yellow-600">
                               <ExternalLink className="w-4 h-4" />
                               关闭分享
                             </DropdownMenuItem>
                             <DropdownMenuItem onClick={(e) => handleDelete(e, collection.id)} className="flex items-center gap-3 cursor-pointer py-2.5 text-destructive focus:text-destructive">
                               <Trash2 className="w-4 h-4" />
                               删除
                             </DropdownMenuItem>
                           </DropdownMenuContent>
                         </DropdownMenu>
                        </>
                      )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      {/* 批量操作悬浮条 - 已移至 PageWrapper 外部 */}

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="删除合集"
        description="确定要删除这个合集吗？此操作无法撤销，但不会删除其中的文件。"
        confirmText="删除"
        variant="destructive"
        onConfirm={confirmDelete}
        isLoading={isDeleting}
      />

      <ShortlinkDialog
        open={!!renewId}
        onOpenChange={(open) => !open && setRenewId(null)}
        onConfirm={confirmRenew}
        title={collections.find(c => c.id === renewId)?.expiresAt && new Date(collections.find(c => c.id === renewId)!.expiresAt!) < new Date() ? '重新分享' : '重置链接'}
        description={
            collections.find(c => c.id === renewId)?.expiresAt && new Date(collections.find(c => c.id === renewId)!.expiresAt!) < new Date() 
            ? '选择新的有效期，将生成新的分享链接' 
            : <span className="text-yellow-500 font-medium">注意：重置后原链接将立即失效，无法访问！</span>
        }
      />

      <ShortlinkDialog
        open={!!shareId}
        onOpenChange={(open) => !open && setShareId(null)}
        onConfirm={confirmShare}
        title="生成分享链接"
        description="为这个合集创建分享链接，设置有效期后即可分享给他人。"
      />

      <ConfirmDialog
        open={!!unshareId}
        onOpenChange={(open) => !open && setUnshareId(null)}
        title="关闭分享"
        description="确定要关闭这个合集的分享吗？关闭后分享链接将立即失效，无法继续访问。"
        confirmText="关闭分享"
        variant="destructive"
        onConfirm={confirmUnshare}
        isLoading={isUnsharing}
      />

      {/* Manage Dialog (Combined Edit + Manage) */}
      <CollectionManageDialog 
        open={!!manageId}
        onOpenChange={(open) => !open && setManageId(null)}
        collectionId={manageId || ''}
        onUpdate={loadCollections}
      />
    </div>
  );

  // 批量操作悬浮条
  const batchToolbar = (
    <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 z-50 px-3 sm:px-4 py-2.5 sm:py-3 w-auto sm:min-w-[320px] bg-white dark:bg-[#18181b] border border-slate-200 dark:border-white/10 rounded-full shadow-[0_8px_40px_-12px_rgba(0,0,0,0.3)] dark:shadow-[0_8px_40px_-12px_rgba(0,0,0,0.8)] flex items-center justify-between gap-4 sm:gap-8 whitespace-nowrap"
          >
          {/* Left: Selection Status */}
          <div className="flex items-center gap-4 ml-2">
            {/* Mobile: Digital Badge (Count only) */}
            <div 
              className="sm:hidden flex items-center justify-center w-8 h-8 rounded-full bg-primary text-white font-bold text-sm shadow-sm cursor-pointer active:scale-90 transition-transform"
              onClick={toggleSelectAll}
            >
              {selectedIds.length}
            </div>

            {/* Desktop: Checkbox + Text */}
            <div className="hidden sm:flex items-center gap-4">
              <div 
                className="cursor-pointer transition-all hover:scale-110 active:scale-95"
                onClick={toggleSelectAll}
              >
              <div className={cn(
                "w-5 h-5 rounded-full flex items-center justify-center transition-all duration-300",
                isAllSelected 
                  ? "bg-primary border border-primary text-white scale-110" 
                  : "bg-transparent border border-slate-300 dark:border-zinc-600 text-transparent"
              )}>
                <Check className="w-3 h-3" strokeWidth={4} />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-slate-800 dark:text-zinc-100">已选择 {selectedIds.length} 项</span>
              <span className="text-[10px] text-slate-500 dark:text-zinc-500 tracking-wider uppercase">批量管理模式</span>
            </div>
            </div>
          </div>

            <div className="flex items-center gap-2">
              <Button
                variant="destructive"
                size="sm"
                className="h-9 px-4 sm:px-5 rounded-full font-bold bg-red-500 hover:bg-red-600 transition-all active:scale-95 text-xs sm:text-sm"
                onClick={confirmBatchDelete}
                disabled={isDeleting}
              >
                {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (
                  <>
                    <span className="sm:hidden">删除</span>
                    <span className="hidden sm:inline">批量删除</span>
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                onClick={() => setSelectedIds([])}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
  );

  if (embedded) return (
    <>
      {content}
      {batchToolbar}
    </>
  );

  return (
    <>
      <PageWrapper>
        {content}
      </PageWrapper>
      {batchToolbar}
    </>
  );
}
