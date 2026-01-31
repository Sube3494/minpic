'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Link2, Copy, ExternalLink, Loader2, FileText, Image as ImageIcon, Video, File, Music, Calendar, MousePointer2, Trash2, Check, X, RotateCcw } from 'lucide-react';
import { ShortlinkDialog } from '@/components/files/shortlink-dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { cn } from '@/lib/utils';
import { PageWrapper } from '@/components/layout/page-wrapper';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

interface ShortlinkData {
  id?: string;
  fileId?: string;
  short_code: string;
  short_url: string;
  original_url: string;
  created_at: string | number;
  click_count: number;
  filename?: string;
  thumbnail?: string;
  thumbnails?: string[];
  fileType?: string;
  dbCreatedAt?: string;
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

const getFileIcon = (type?: string) => {
  if (type === 'collection') return <Link2 className="w-12 h-12" />;
  if (!type) return <File className="w-12 h-12" />;
  if (type.startsWith('image/')) return <ImageIcon className="w-12 h-12" />;
  if (type.startsWith('video/')) return <Video className="w-12 h-12" />;
  if (type.startsWith('audio/')) return <Music className="w-12 h-12" />;
  if (type.includes('pdf') || type.includes('word') || type.includes('text')) return <FileText className="w-12 h-12" />;
  return <File className="w-12 h-12" />;
};

export function ShortlinksClient({ embedded = false }: { embedded?: boolean }) {
  const [links, setLinks] = useState<ShortlinkData[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingCode, setDeletingCode] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ShortlinkData | null>(null);
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [renewTarget, setRenewTarget] = useState<ShortlinkData | null>(null);
  const [mounted, setMounted] = useState(false);
  const isAllSelected = links.length > 0 && selectedCodes.length === links.length;

  useEffect(() => {
    setMounted(true);
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const linksRes = await fetch(`/api/shortlinks?t=${Date.now()}`);
      if (linksRes.ok) {
        const data = await linksRes.json();
        setLinks(data.shortlinks || []);
      }
    } catch {
      toast.error('加载短链列表失败', {
        description: '请检查网络连接或刷新页面'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, link: ShortlinkData) => {
    e.stopPropagation();
    setDeleteTarget(link);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    
    setDeletingCode(deleteTarget.short_code);
    try {
      const res = await fetch(`/api/shortlinks?code=${deleteTarget.short_code}`, {
        method: 'DELETE'
      });
      
      if (res.ok) {
        setLinks(prev => prev.filter(l => l.short_code !== deleteTarget.short_code));
        toast.success('分享链接已撤销');
      } else {
        throw new Error('Failed to delete');
      }
    } catch {
      toast.error('撤销分享失败，请重试');
    } finally {
      setDeletingCode(null);
      setDeleteTarget(null);
    }
  };

  const toggleSelect = (e: React.MouseEvent, code: string) => {
    e.stopPropagation();
    setSelectedCodes(prev => 
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedCodes([]);
    } else {
      setSelectedCodes(links.map(l => l.short_code));
    }
  };

  const handleBatchDelete = async () => {
    if (selectedCodes.length === 0) return;
    setDeletingCode('batch');
    
    try {
      const loadingToast = toast.loading(`正在批量撤销 ${selectedCodes.length} 个分享链接...`);
      let successCount = 0;
      
      for (const code of selectedCodes) {
        const res = await fetch(`/api/shortlinks?code=${code}`, { method: 'DELETE' });
        if (res.ok) successCount++;
      }

      setLinks(prev => prev.filter(l => !selectedCodes.includes(l.short_code)));
      setSelectedCodes([]);
      toast.success(`成功撤销 ${successCount} 个分享链接`, { id: loadingToast });
    } catch (error) {
      console.error('Batch delete error:', error);
      toast.error('部分撤销失败，请重试');
    } finally {
      setDeletingCode(null);
    }

  };

  const handleRenewClick = (e: React.MouseEvent, link: ShortlinkData) => {
    e.stopPropagation();
    setRenewTarget(link);
  };

  const confirmRenew = async (expiresIn: number, unit: 'minutes' | 'hours' | 'days') => {
    if (!renewTarget) return;
    
    // 如果是合集
    if (renewTarget.fileType === 'collection' && renewTarget.id) {
       try {
        const res = await fetch(`/api/collections/${renewTarget.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ expiresIn, unit }),
        });

        if (!res.ok) throw new Error('Failed to renew collection');
        const data = await res.json();
        const newUrl = data.shortUrl;
        
        toast.success(
          <div className="flex items-center justify-between w-full gap-4 -my-1">
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-sm text-foreground font-medium">合集分享已重新激活</span>
              <span className="text-[11px] text-zinc-500/80 truncate max-w-[200px]">{newUrl}</span>
            </div>
            <Button 
              size="icon" 
              variant="ghost" 
              className="h-10 w-10 rounded-xl hover:bg-emerald-500/10 transition-all shrink-0 -mr-1"
              onClick={(e) => { e.stopPropagation(); window.open(newUrl, '_blank'); }}
            >
              <ExternalLink className="w-5 h-5 text-emerald-500" />
            </Button>
          </div>
        );
        loadData(); // Reload list
       } catch (error) {
         console.error(error);
         toast.error('重新分享失败');
       }
    } 
    // 如果是单文件
    else if (renewTarget.fileId) {
      try {
         const res = await fetch(`/api/files/${renewTarget.fileId}`, {
           method: 'PATCH',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ 
             rotate: true,
             expiresIn,
             unit 
           })
         });

         if (!res.ok) throw new Error('Failed to update file');
         const fileData = await res.json();
         
         const slRes = await fetch('/api/shortlinks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileId: fileData.id,
              expiresIn,
              unit
            })
         });
         
         if (!slRes.ok) throw new Error('Failed to regenerate shortlink');
         const slData = await slRes.json();
         const newUrl = slData.short_url;
         
         toast.success(
           <div className="flex items-center justify-between w-full gap-4 -my-1">
             <div className="flex flex-col gap-0.5 min-w-0">
               <span className="text-sm text-foreground font-medium">文件分享已重新激活</span>
               <span className="text-[11px] text-zinc-500/80 truncate max-w-[200px]">{newUrl}</span>
             </div>
             <Button 
               size="icon" 
               variant="ghost" 
               className="h-10 w-10 rounded-xl hover:bg-emerald-500/10 transition-all shrink-0 -mr-1"
               onClick={(e) => { e.stopPropagation(); window.open(newUrl, '_blank'); }}
             >
               <ExternalLink className="w-5 h-5 text-emerald-500" />
             </Button>
           </div>
         );
         loadData();
      } catch (error) {
        console.error(error);
        toast.error('重新分享失败');
      }
    }

    setRenewTarget(null);
  };

  const copyToClipboard = async (e: React.MouseEvent, url: string) => {
    e.stopPropagation();
    let encodedUrl = url;
    try {
      encodedUrl = new URL(url).toString();
    } catch (e) {
      console.error('URL parse failed:', e);
    }
    await navigator.clipboard.writeText(encodedUrl);
    toast.success(
      <div className="flex items-center justify-between w-full gap-4 -my-1">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-sm text-foreground font-medium">链接已复制到剪贴板</span>
          <span className="text-[11px] text-zinc-500/80 truncate max-w-[200px]">{encodedUrl}</span>
        </div>
        <Button 
          size="icon" 
          variant="ghost" 
          className="h-10 w-10 rounded-xl hover:bg-emerald-500/10 transition-all shrink-0 -mr-1"
          onClick={(e) => { e.stopPropagation(); window.open(encodedUrl, '_blank'); }}
        >
          <ExternalLink className="w-5 h-5 text-emerald-500" />
        </Button>
      </div>
    );
  };


  if (loading) {
    const loader = (
      <div className="container mx-auto px-4 py-12 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
    if (embedded) return loader;
    return (
      <PageWrapper>
        <div className="pt-24">{loader}</div>
      </PageWrapper>
    );
  }

  const content = (
    <div className="container mx-auto px-4 pb-32 safe-area-bottom">
      {!embedded && (
        <div className="flex items-center justify-between mb-8 pt-24">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Link2 className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">文件分享</h1>
              <p className="text-muted-foreground text-sm mt-1">
                共 {links.length} 个活跃短链
              </p>
            </div>
          </div>
          <Button variant="outline" asChild>
            <Link href="/files">管理文件</Link>
          </Button>
        </div>
      )}

      {links.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center py-24 px-4 text-center border-2 border-dashed border-muted-foreground/20 rounded-2xl bg-muted/5"
        >
          <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-6">
            <Link2 className="w-10 h-10 text-muted-foreground/50" />
          </div>
          <h3 className="text-xl font-semibold mb-2">暂无文件分享</h3>
          <p className="text-muted-foreground max-w-md mb-8">
            你创建的单个文件分享短链会在这里显示。前往文件管理选择文件即可生成。
          </p>
          <Button asChild>
            <Link href="/files">前往文件管理</Link>
          </Button>
        </motion.div>
      ) : (
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6"
        >
          <AnimatePresence mode='popLayout'>
            {links.map((link) => (
              <motion.div
                key={link.short_code}
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
                  onClick={() => window.open(link.short_url, '_blank')}
                >
                  {/* Thumbnail area */}
                  <div className="aspect-video bg-muted relative overflow-hidden w-full">
                    {/* Grid View for Collections */}
                    {link.fileType === 'collection' && link.thumbnails && link.thumbnails.length > 0 ? (
                      <div className={cn(
                        "grid w-full h-full gap-0.5 bg-muted",
                        link.thumbnails.length === 1 ? "grid-cols-1" : 
                        link.thumbnails.length === 2 ? "grid-cols-2" :
                        link.thumbnails.length >= 3 ? "grid-cols-2 grid-rows-2" : ""
                      )}>
                        {link.thumbnails.slice(0, 4).map((thumb, idx) => (
                          <div 
                            key={idx} 
                            className={cn(
                              "relative overflow-hidden",
                              link.thumbnails!.length === 3 && idx === 0 ? "row-span-2" : ""
                            )}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={thumb}
                              alt=""
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                            />
                          </div>
                        ))}
                      </div>
                    ) : link.thumbnail ? (
                      // Single File View
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={link.thumbnail}
                        alt=""
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                          (e.target as HTMLImageElement).parentElement?.querySelector('.fallback-icon')?.classList.remove('hidden');
                        }}
                      />
                    ) : null}
                    
                    <div className={cn(
                      "fallback-icon w-full h-full flex items-center justify-center bg-secondary/50",
                      (link.thumbnails && link.thumbnails.length > 0) || link.thumbnail ? "hidden" : ""
                    )}>
                      <div className="text-muted-foreground/30 group-hover:text-primary/30 transition-colors duration-300">
                        {getFileIcon(link.fileType)}
                      </div>
                    </div>
                    
                    {/* Access count badge */}
                    {link.click_count > 0 && (
                      <Badge variant="secondary" className="absolute top-3 left-3 bg-black/60 hover:bg-black/70 text-white border-none backdrop-blur-sm shadow-sm flex items-center gap-1">
                        <MousePointer2 className="w-3 h-3" />
                        {link.click_count} 次访问
                      </Badge>
                    )}

                    {/* Selection Checkbox */}
                    <div 
                      className="absolute top-3 right-3 z-10"
                      onClick={(e) => toggleSelect(e, link.short_code)}
                    >
                    <div className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center transition-all duration-300",
                      selectedCodes.includes(link.short_code)
                        ? "bg-primary border border-primary text-white scale-110"
                        : "bg-black/20 hover:bg-black/40 border border-white/20 text-transparent"
                    )}>
                      <Check className="w-3 h-3" strokeWidth={4} />
                    </div>
                    </div>
                    
                  </div>

                  {/* Info area */}
                  <div className="p-3 flex flex-col flex-1 gap-1.5">
                    <h3 className="font-normal text-sm line-clamp-2 pl-1 text-foreground min-h-[40px]" title={link.filename || link.short_code}>
                      {link.filename || `短链: ${link.short_code}`}
                    </h3>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground/70 pl-1 mt-auto">
                      <div className="flex items-center">
                        <Calendar className="w-3.5 h-3.5 mr-1.5" />
                        <span>
                          {link.expiresAt 
                            ? (new Date(link.expiresAt) < new Date() ? (
                                <span className="text-red-500 font-medium flex items-center">
                                  已过期
                                </span>
                              ) : `到期于 ${new Date(link.expiresAt).toLocaleString('zh-CN', { 
                                year: 'numeric', 
                                month: '2-digit', 
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}`
                              )
                            : '永久有效'}
                        </span>
                      </div>
                      <Badge variant="outline" className="h-4 px-1 text-[10px] font-mono border-muted-foreground/20 text-muted-foreground/80 font-normal">
                        {link.short_code}
                      </Badge>
                    </div>

                    {/* Actions Row */}
                    <div className="flex items-center gap-1.5 pt-2 mt-auto border-t border-border/50" onClick={(e) => e.stopPropagation()}>
                      {link.expiresAt && new Date(link.expiresAt) < new Date() ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-1 h-8 px-2 text-primary hover:text-primary hover:bg-primary/10 transition-colors"
                          onClick={(e) => handleRenewClick(e, link)}
                        >
                          <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                          <span className="text-xs font-medium">重新分享</span>
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-1 h-8 px-2 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                          onClick={(e) => copyToClipboard(e, link.short_url)}
                        >
                          <Copy className="w-3.5 h-3.5 mr-1.5" />
                          <span className="text-xs font-medium">复制</span>
                        </Button>
                      )}

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 px-0 text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(link.short_url, '_blank');
                          }}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 px-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          disabled={deletingCode === link.short_code}
                          onClick={(e) => handleDeleteClick(e, link)}
                        >
                          {deletingCode === link.short_code ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* 批量操作悬浮条 - 已移至 PageWrapper 外部 */}
    </div>
  );

  // 批量操作栏定义 - 抽取为渲染函数以复用且支持 Portal
  const renderBulkActionBar = () => {
    if (!mounted) return null;
    return createPortal(
      <AnimatePresence>
        {selectedCodes.length > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))]! sm:bottom-8! left-1/2 -translate-x-1/2 z-50 px-3 sm:px-4 py-2.5 sm:py-3 w-auto sm:min-w-[320px] bg-white/90 dark:bg-[#18181b]/90 backdrop-blur-md border border-slate-200 dark:border-white/10 rounded-full shadow-[0_8px_40px_-12px_rgba(0,0,0,0.3)] dark:shadow-[0_8px_40px_-12px_rgba(0,0,0,0.8)] flex items-center justify-between gap-3 sm:gap-8 whitespace-nowrap"
          >
          {/* Left: Selection Status */}
          <div className="flex items-center gap-3 sm:gap-4 ml-1 sm:ml-2">
            <div 
              className="sm:hidden flex items-center justify-center w-8 h-8 rounded-full bg-primary text-white font-bold text-sm shadow-sm cursor-pointer active:scale-90 transition-transform"
              onClick={toggleSelectAll}
            >
              {selectedCodes.length}
            </div>

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
              <span className="text-sm font-bold text-slate-800 dark:text-zinc-100">已选择 {selectedCodes.length} 项</span>
              <span className="text-[10px] text-slate-500 dark:text-zinc-500 tracking-wider uppercase">批量管理模式</span>
            </div>
            </div>
          </div>

            <div className="flex items-center gap-2">
              <Button
                variant="destructive"
                size="sm"
                className="h-9 px-4 sm:px-5 rounded-full font-bold bg-red-500 hover:bg-red-600 transition-all active:scale-95 text-xs sm:text-sm"
                onClick={handleBatchDelete}
                disabled={deletingCode !== null}
              >
                {deletingCode === 'batch' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (
                  <>
                    <span className="sm:hidden">撤销</span>
                    <span className="hidden sm:inline">批量撤销</span>
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                onClick={() => setSelectedCodes([])}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
    );
  };

  if (embedded) return (
    <>
      {content}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="撤销分享链接"
        description={`确定要撤销「${deleteTarget?.filename || '此'}」的分享链接吗？撤销后该链接将立即失效，无法再访问。`}
        confirmText="撤销分享"
        cancelText="取消"
        onConfirm={handleConfirmDelete}
        variant="destructive"
        isLoading={!!deletingCode}
      />
      
      <ShortlinkDialog
        open={!!renewTarget}
        onOpenChange={(open) => !open && setRenewTarget(null)}
        onConfirm={confirmRenew}
        title="重新激活分享"
        description={
            <span className="flex flex-col gap-1">
              <span>设置新的有效期，将生成新的分享链接。</span>
              <span className="text-amber-500/80 text-[11px]">注意：旧的链接已失效，请使用生成的新链接。</span>
            </span>
        }
      />
      {renderBulkActionBar()}
    </>
  );

  return (
    <>
      <PageWrapper>
        {content}
      </PageWrapper>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="撤销分享链接"
        description={`确定要撤销「${deleteTarget?.filename || '此'}」的分享链接吗？撤销后该链接将立即失效，无法再访问。`}
        confirmText="撤销分享"
        cancelText="取消"
        onConfirm={handleConfirmDelete}
        variant="destructive"
        isLoading={!!deletingCode}
      />
      
      <ShortlinkDialog
        open={!!renewTarget}
        onOpenChange={(open) => !open && setRenewTarget(null)}
        onConfirm={confirmRenew}
        title="重新激活分享"
        description={
            <span className="flex flex-col gap-1">
              <span>设置新的有效期，将生成新的分享链接。</span>
              <span className="text-amber-500/80 text-[11px]">注意：旧的链接已失效，请使用生成的新链接。</span>
            </span>
        }
      />
      {renderBulkActionBar()}
    </>
  );
}
