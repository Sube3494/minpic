/* eslint-disable @next/next/no-img-element */
'use client';

import { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ShortlinkDialog } from '@/components/files/shortlink-dialog';
import { RotateCcw } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CollectionManageDialog } from '@/components/files/collection-manage-dialog';
import { Settings2 } from 'lucide-react';


interface Collection {
  id: string;
  name?: string;
  fileCount: number;
  totalSize: number;
  shortCode?: string;
  shortUrl?: string;
  firstThumbnail?: string;
  createdAt: string;
  expiresAt?: string;
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

export function CollectionsClient() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [renewId, setRenewId] = useState<string | null>(null);
  const [manageId, setManageId] = useState<string | null>(null);

  useEffect(() => {
    loadCollections();
  }, []);

  const loadCollections = async () => {
    try {
      const res = await fetch('/api/collections');
      if (!res.ok) throw new Error('Failed to load collections');
      const data = await res.json();
      setCollections(data.collections || []);
    } catch (error) {
      console.error('Failed to load collections:', error);
      toast.error('加载合集失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyShortlink = (e: React.MouseEvent, shortCode: string, shortUrl?: string) => {
    e.stopPropagation();
    // 优先使用后端存入的完整 shortUrl，其次作为兜底使用本地拼接的 /c/ 路径（合集专用）
    const urlToCopy = shortUrl || `${window.location.origin}/c/${shortCode}`;
    navigator.clipboard.writeText(urlToCopy);
    toast.success('短链已复制');
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeleteId(id);
  };

  const handleRenew = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setRenewId(id);
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





  const handleManage = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setManageId(id);
  };

  const handleView = (id: string) => {
    window.open(`/c/${id}`, '_blank');
  };

  if (loading) {
    return (
      <PageWrapper>
        <div className="container mx-auto px-4 pt-24 pb-12 flex items-center justify-center min-h-[50vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </PageWrapper>
    );
  }

  if (collections.length === 0) {
    return (
      <PageWrapper>
        <div className="container mx-auto px-4 pt-24 pb-12">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-primary/10 rounded-lg">
              <FolderOpen className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">我的合集</h1>
          </div>

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
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <div className="container mx-auto px-4 pt-24 pb-12">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <FolderOpen className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">我的合集</h1>
              <p className="text-muted-foreground text-sm mt-1">
                共 {collections.length} 个合集
              </p>
            </div>
          </div>
          <Button variant="outline" asChild>
            <Link href="/files">
              创建新合集
            </Link>
          </Button>
        </div>

        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
        >
          <AnimatePresence mode='popLayout'>
            {collections.map((collection) => (
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
                  {/* Thumbnail */}
                  <div className="aspect-video bg-muted relative overflow-hidden w-full">
                    {collection.firstThumbnail ? (
                      <img
                        src={collection.firstThumbnail}
                        alt=""
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-secondary/50">
                        <FolderOpen className="w-12 h-12 text-muted-foreground/30" />
                      </div>
                    )}

                    {/* File count badge */}
                    <Badge variant="secondary" className="absolute top-3 right-3 bg-black/60 hover:bg-black/70 text-white border-none backdrop-blur-sm shadow-sm">
                       {collection.fileCount} 个文件
                    </Badge>
                  </div>

                  {/* Info */}
                  <div className="p-3 flex flex-col flex-1 gap-1.5">
                    <h3 className="font-semibold text-sm truncate pl-1 text-foreground" title={collection.name || `合集 ${new Date(collection.createdAt).toLocaleDateString()}`}>
                      {collection.name || `合集 ${new Date(collection.createdAt).toLocaleDateString('zh-CN')}`}
                    </h3>
                    <div className="flex items-center text-xs text-muted-foreground/70 pl-1">
                       <Calendar className="w-3.5 h-3.5 mr-1.5" />
                       <span>{formatDistanceToNow(new Date(collection.createdAt))}</span>
                       
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
                       {collection.expiresAt && new Date(collection.expiresAt) < new Date() ? (
                         // Expired: Renew + Delete
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
                               <DropdownMenuItem onClick={(e) => handleDelete(e, collection.id)} className="text-destructive focus:text-destructive">
                                 <Trash2 className="w-4 h-4 mr-2" />
                                 删除
                               </DropdownMenuItem>
                             </DropdownMenuContent>
                           </DropdownMenu>
                         </>
                       ) : (
                         // Active: Copy + Open + More (Reset, Delete)
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
                               <DropdownMenuItem onClick={(e) => handleRenew(e, collection.id)} className="text-orange-500 focus:text-orange-500">
                                 <RotateCcw className="w-4 h-4 mr-2" />
                                 重置链接
                               </DropdownMenuItem>
                               <DropdownMenuItem onClick={(e) => handleManage(e, collection.id)}>
                                 <Settings2 className="w-4 h-4 mr-2" />
                                 管理内容
                               </DropdownMenuItem>
                               <DropdownMenuItem onClick={(e) => handleDelete(e, collection.id)} className="text-destructive focus:text-destructive">
                                 <Trash2 className="w-4 h-4 mr-2" />
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

      </div>

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

      <CollectionManageDialog 
        open={!!manageId}
        onOpenChange={(open) => !open && setManageId(null)}
        collectionId={manageId || ''}
        onUpdate={loadCollections}
      />
    </PageWrapper>

  );
}
