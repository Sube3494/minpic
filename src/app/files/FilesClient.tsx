'use client';

import type { FileItem } from '@/types/file';
import { FilePreviewDialog } from '@/components/files/file-preview-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { useSession } from 'next-auth/react';
import { useState, useEffect, useTransition, useCallback, useMemo } from 'react';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Server, ChevronDown, ExternalLink, Check, X } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';
import { useFiles } from '@/hooks/use-files';
import { useFileSelection } from '@/hooks/use-file-selection';
import { useConfigs } from '@/hooks/use-configs';
import { useFileUpload } from '@/hooks/use-file-upload';
import { useTeam } from '@/hooks/use-team';
import { useQuota } from '@/hooks/use-quota';
import { FileCard } from '@/components/files/file-card';
import { FileListRow } from '@/components/files/file-list-row';
import { UploadArea } from '@/components/files/upload-area';
import { FilterBar } from '@/components/files/filter-bar';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ShortlinkDialog } from '@/components/files/shortlink-dialog';
import { CollectionDialog } from '@/components/files/collection-dialog';
import { fileService } from '@/services/file.service';
import { PageWrapper } from '@/components/layout/page-wrapper';
import { toast } from 'sonner';



export function FilesClient() {
  const { 
    configs, selectedConfigId, setSelectedConfigId, configLoading 
  } = useConfigs();
  const { data: session } = useSession();
  const { teamInfo } = useTeam();
  const { quota, refreshQuota } = useQuota();

  const { 
    files, loading, isRefreshing, search, setSearch, filter, setFilter, viewMode, setViewMode,
    refreshFn, deleteFile, batchDelete,
    hasMore, loadingMore, loadMore 
  } = useFiles('all', 'grid', selectedConfigId, refreshQuota);


  const { 
    selectedIds, toggleSelect, setSelectedIds 
  } = useFileSelection();
  
  const { 
    uploading, queue, aggregateProgress, uploadFiles 
  } = useFileUpload(refreshFn, quota, refreshQuota);

  const [, startTransition] = useTransition();
  const [optimisticFilter, setOptimisticFilter] = useState(filter);

  // Sync optimistic filter with actual filter (e.g. on mount or external change)
  useEffect(() => {
    setOptimisticFilter(filter);
  }, [filter]);

  const handleFilterChange = (value: typeof filter) => {
    setOptimisticFilter(value);
    startTransition(() => {
      setFilter(value);
    });
  };

  const [deleteDialog, setDeleteDialog] = useState<{ 
    open: boolean; 
    fileId: string; 
    filename: string;
    deleteMode: 'full' | 'record-only';
  }>({ 
    open: false, 
    fileId: '', 
    filename: '',
    deleteMode: 'record-only' // 默认仅删除记录
  });
  const [isDeleting, setIsDeleting] = useState(false);

  const [shortlinkDialog, setShortlinkDialog] = useState<{
    open: boolean;
    fileId: string;
  }>({ open: false, fileId: '' });

  const [collectionDialog, setCollectionDialog] = useState(false);
  const [previewFile, setPreviewFile] = useState<typeof files[0] | null>(null);

  const [shareDialog, setShareDialog] = useState<{
    open: boolean;
    file: FileItem | null;
  }>({ open: false, file: null });

  const [shortlinkEnabled, setShortlinkEnabled] = useState(false);
  const [columns, setColumns] = useState(1);

  // 响应式列数计算
  useEffect(() => {
    if (viewMode !== 'grid') return;
    
    const updateColumns = () => {
      const width = window.innerWidth;
      if (width < 640) setColumns(2);
      else if (width < 1024) setColumns(4);
      else if (width < 1440) setColumns(5);
      else setColumns(6);
    };

    requestAnimationFrame(updateColumns);
    window.addEventListener('resize', updateColumns);
    return () => window.removeEventListener('resize', updateColumns);
  }, [viewMode]);

  // 采用贪心算法动态计算每列文件，以实现列高度平衡
  const fileColumns = useMemo(() => {
    if (viewMode !== 'grid') return [];
    
    // 初始化列和高度追踪器
    const cols = Array.from({ length: columns }, () => [] as typeof files);
    const estimatedHeights = Array.from({ length: columns }, () => 0);

    files.forEach(file => {
      // 找出当前总估算高度最小的列索引
      let shortestColIndex = 0;
      for (let i = 1; i < columns; i++) {
        if (estimatedHeights[i] < estimatedHeights[shortestColIndex]) {
          shortestColIndex = i;
        }
      }

      // 将文件分配给该列
      cols[shortestColIndex].push(file);

      // 评估并更新该列的估算高度
      // 计算长宽比 (height/width)，没有宽高数据的默认为 1 (正方形)
      const aspectRatio = (file.width && file.height) ? (file.height / file.width) : 1;
      
      // 这里的 0.2 是对卡片标题、外边距和动作按钮区域高度的粗略预估
      // 这样宽图（比例小）增加的高度少，长图（比例大）增加的高度多
      estimatedHeights[shortestColIndex] += (aspectRatio + 0.2);
    });

    return cols;
  }, [files, columns, viewMode]);

  // Load shortlink config on mount
  useEffect(() => {
    const loadShortlinkConfig = async () => {
      try {
        const config = await fileService.getShortlinkConfig();
        setShortlinkEnabled(config.enabled || false);
      } catch {
        setShortlinkEnabled(false);
      }
    };
    loadShortlinkConfig();
  }, []);

  const [isSelectingAll, setIsSelectingAll] = useState(false);
  const [totalFilesCount, setTotalFilesCount] = useState<number | null>(null);
  
  // 检查是否真正全选了所有文件(包括未加载的)
  const isAllSelected = totalFilesCount !== null && selectedIds.length === totalFilesCount && totalFilesCount > 0;

  const handleSelectAll = async () => {
    if (isAllSelected) {
      // 如果已经全选,则清空选择
      setSelectedIds([]);
      setTotalFilesCount(null);
    } else {
      // 全选所有符合过滤条件的文件
      setIsSelectingAll(true);
      try {
        const allIds = await fileService.getAllFileIds(filter, search, selectedConfigId);
        setSelectedIds(allIds);
        setTotalFilesCount(allIds.length);
        if (allIds.length > files.length) {
          toast.success(`已选中全部 ${allIds.length} 个文件`, {
            description: '包括未加载的文件'
          });
        }
      } catch (error) {
        console.error('获取文件 ID 失败:', error);
        toast.error('全选失败', {
          description: '无法获取文件列表,请重试'
        });
      } finally {
        setIsSelectingAll(false);
      }
    }
  };

  // Handlers
  const getDirectLink = useCallback(async (fileId: string) => {
    try {
      const url = await fileService.getDirectLink(fileId);
      return url;
    } catch (err) {
      console.error('获取直链失败:', err);
      throw err;
    }
  }, []);

  const handleGenerateShortlink = useCallback((fileId: string) => {
    setShortlinkDialog({ open: true, fileId });
  }, []);

  const handleShare = useCallback((file: FileItem) => {
    setShareDialog({ open: true, file });
  }, []);

  const handleConfirmShare = async (expiresIn: number, unit: 'minutes' | 'hours' | 'days') => {
    if (!shareDialog.file) return;
    
    const loadingToast = toast.loading('正在准备分享链接...');
    try {
      // 旋转 UUID 并设定期限 (复用合集逻辑)
      const updatedFile = await fileService.patchFile(shareDialog.file.id, {
          rotate: true,
          expiresIn,
          unit
      });

      // 更新本地状态中的该文件,确保 UI 同步 (如果是列表显示了有效期的话)
      refreshFn(); 

      let shareUrl = `${window.location.origin}/f/${updatedFile.shareId || updatedFile.id}`;
      
      // 如果短链功能开启,主动生成短链
      if (shortlinkEnabled) {
          try {
              toast.loading('正在生成分享短链...', { id: loadingToast });
              const shortUrl = await fileService.generateShortlink(updatedFile.id, expiresIn, unit);
              shareUrl = shortUrl;
          } catch (e) {
              console.error('自动生成短链失败,回退到原链接', e);
          }
      }

      await navigator.clipboard.writeText(shareUrl);
      
      toast.success(
        <div className="flex items-center justify-between w-full gap-4 -my-1">
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-sm text-foreground">
              {shortlinkEnabled ? '时效短链已复制' : '时效分享链接已复制'}
            </span>
            <span className="text-[11px] text-zinc-500/80 truncate max-w-[200px]">{shareUrl}</span>
          </div>
          <Button 
            size="icon" 
            variant="ghost" 
            className="h-11 w-11 rounded-2xl hover:bg-emerald-500/10 transition-all shrink-0 -mr-1"
            onClick={(e) => { e.stopPropagation(); window.open(shareUrl, '_blank'); }}
          >
            <ExternalLink className="w-6 h-6 text-emerald-500" />
          </Button>
        </div>,
        { id: loadingToast }
      );

      // 成功后关闭对话框
      setShareDialog({ open: false, file: null });
    } catch (err) {
      console.error('配置分享失败:', err);
      toast.error('操作失败,请重试', { id: loadingToast });
    }
  };

  const handleConfirmGenerateShortlink = async (expiresIn: number, unit: 'minutes' | 'hours' | 'days') => {
    const isBatch = shortlinkDialog.fileId === 'batch';
    const targets = isBatch ? selectedIds : [shortlinkDialog.fileId];
    
    if (targets.length === 0) return;

    const loadingToast = toast.loading(isBatch ? '正在准备分享链接...' : '正在生成短链...');
    
    try {
      let shareUrl = '';

      if (isBatch) {
        // 多文件合并分享逻辑 (创建无名合集作为技术容器)
        const body = {
          fileIds: targets,
          shared: true,
          expiresIn,
          unit
        };

        const res = await fetch('/api/collections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.message || errorData.error || 'Failed to create share collection');
        }
        
        const data = await res.json();
        
        // 生成统一的 /f/ 路径 (如果 shortUrl 是外部短链则用短链)
        shareUrl = data.shortUrl || `${window.location.origin}/f/${data.id}`;
      } else {
        // 单文件短链逻辑
        const id = targets[0];
        const rawUrl = await fileService.generateShortlink(id, expiresIn, unit);
        shareUrl = new URL(rawUrl).toString();
      }

      await navigator.clipboard.writeText(shareUrl);
      
      toast.success(
        <div className="flex items-center justify-between w-full gap-4 -my-1">
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-sm text-foreground font-medium">
              {isBatch ? '分享链接已复制' : '分享短链已复制'}
            </span>
            <span className="text-[11px] text-zinc-500/80 truncate max-w-[200px]">{shareUrl}</span>
          </div>
          <Button 
            size="icon" 
            variant="ghost" 
            className="h-10 w-10 rounded-xl hover:bg-emerald-500/10 transition-all shrink-0 -mr-1"
            onClick={(e) => { e.stopPropagation(); window.open(shareUrl, '_blank'); }}
          >
            <ExternalLink className="w-5 h-5 text-emerald-500" />
          </Button>
        </div>,
        { id: loadingToast }
      );

      setShortlinkDialog({ open: false, fileId: '' });
      if (isBatch) setSelectedIds([]);
    } catch (err) {
      console.error('Share generation error:', err);
      toast.error('操作失败，请重试', { id: loadingToast });
    }
  };


  const handleBatchDeleteClick = () => {
    setDeleteDialog({ open: true, fileId: 'batch', filename: `选中的 ${selectedIds.length} 个文件`, deleteMode: 'record-only' });
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    const { fileId, deleteMode } = deleteDialog;
    
    if (fileId === 'batch') {
      const success = await batchDelete(selectedIds, deleteMode);
      if (success) {
        setSelectedIds([]);
        setDeleteDialog({ open: false, fileId: '', filename: '', deleteMode: 'record-only' });
      }
    } else {
      const success = await deleteFile(fileId, deleteMode);
      if (success) {
        setDeleteDialog({ open: false, fileId: '', filename: '', deleteMode: 'record-only' });
      }
    }
    setIsDeleting(false);
  };

  const handleCreateCollection = async (name: string, shared?: boolean, expiresIn?: number, unit?: 'minutes' | 'hours' | 'days') => {
    if (selectedIds.length === 0) return;

    const loadingToast = toast.loading('正在创建合集...');

    try {
      const body: { fileIds: string[]; name?: string; shared?: boolean; expiresIn?: number; unit?: string } = {
        fileIds: selectedIds,
        name,
      };

      if (shared && expiresIn && unit) {
        body.shared = true;
        body.expiresIn = expiresIn;
        body.unit = unit;
      }

      const res = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        throw new Error('Failed to create collection');
      }

      const data = await res.json();

      const collectionUrl = data.shortUrl || `${window.location.origin}/c/${data.shareId || data.id}`;
      
      if (data.shortUrl) {
        await navigator.clipboard.writeText(data.shortUrl);
      }

      toast.success(
        <div className="flex items-center justify-between w-full gap-4 -my-1">
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-sm text-foreground font-medium">
              {data.shortUrl ? '合集已创建，分享链接已复制' : '合集已创建'}
            </span>
            {data.shortUrl && (
              <span className="text-[11px] text-zinc-500/80 truncate max-w-[200px]">{collectionUrl}</span>
            )}
          </div>
          {data.shortUrl && (
            <Button 
              size="icon" 
              variant="ghost" 
              className="h-11 w-11 rounded-2xl hover:bg-emerald-500/10 transition-all shrink-0 -mr-1"
              onClick={(e) => { e.stopPropagation(); window.open(collectionUrl, '_blank'); }}
            >
              <ExternalLink className="w-6 h-6 text-emerald-500" />
            </Button>
          )}
        </div>,
        { id: loadingToast }
      );

      setCollectionDialog(false);
      setSelectedIds([]);
    } catch (error) {
      console.error('Failed to create collection:', error);
      toast.error('创建合集失败', { id: loadingToast });
    }
  };

  // Global Paste Handler
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const clipboardFiles = e.clipboardData?.files;
      if (clipboardFiles && clipboardFiles.length > 0) {
        e.preventDefault();
        uploadFiles(clipboardFiles, selectedConfigId);
        toast.info(`正在从剪贴板上传 ${clipboardFiles.length} 个文件...`);
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [uploadFiles, selectedConfigId]);

  // 文件管理只使用当前激活的配置。连接测试成功仅代表配置可连接，
  // 不代表它已经启用，避免关闭的配置仍出现在文件库切换器中。
  const activeConfigs = configs.filter(c => c.status === 'success');
  const selectedConfig = activeConfigs.find(c => c.id === selectedConfigId);
  
  const selectedConfigName = configLoading 
    ? '加载中...' 
    : (selectedConfig?.name || (activeConfigs.length > 0 ? '选择存储源' : '未连接存储源'));

  // Check if current user is restricted (Team member with no quota)
  const isQuotaRestricted = useMemo(() => {
    if (!selectedConfig?.isTeam || !teamInfo?.team || !session?.user?.id) return false;
    
    // Check if current user is a member (not owner)
    const member = teamInfo.team.members.find(m => m.userId === session.user.id);
    const isOwner = teamInfo.team.ownerId === session.user.id;
    
    if (isOwner) return false; // Owner is never restricted
    
    // If member found, check quotas
    if (member) {
      const hasStorageQuota = member.storageQuota && Number(member.storageQuota) > 0;
      const hasFileQuota = member.fileQuota && member.fileQuota > 0;
      // If NO quota assigned at all, restrict upload
      return !hasStorageQuota && !hasFileQuota;
    }
    
    return false;
  }, [selectedConfig, teamInfo, session]);

  const isUploadDisabled = configs.filter(c => c.status === 'success').length === 0 || isQuotaRestricted;

  // 无限滚动 Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading && !isRefreshing) {
          loadMore();
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    );

    const sentinel = document.getElementById('scroll-sentinel');
    if (sentinel) observer.observe(sentinel);

    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, loadMore, isRefreshing]);

  return (
    <>
      <PageWrapper>
      <div className="min-h-screen p-4 md:p-12 pb-32 safe-area-bottom">
      <div className="max-w-7xl mx-auto space-y-6 md:space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6 mb-2 md:mb-8 mt-16">
          <div className="space-y-0.5 md:space-y-2">
            <h1 className="text-2xl md:text-4xl font-bold tracking-tight text-glow">
              <span className="bg-clip-text text-transparent bg-linear-to-r from-zinc-900 to-zinc-500 dark:from-white dark:to-white/40">
                文件管理
              </span>
            </h1>
            <p className="text-muted-foreground text-xs md:text-lg">
              查看与管理所有上传的资源
            </p>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
             <div className="flex-1 md:flex-none">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="h-10 w-full md:w-auto gap-2 border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 backdrop-blur-md hover:bg-zinc-50 dark:hover:bg-white/10 px-3 min-w-[160px] md:min-w-[200px] justify-between shadow-sm transition-all active:scale-[0.98] rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-0 group"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 group-hover:text-foreground transition-colors">
                          <Server className="w-3 h-3" />
                        </div>
                        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate max-w-[100px]">
                          {selectedConfigName}
                        </span>
                        {selectedConfig?.isTeam && (
                             <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 shrink-0">
                                <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400 leading-none">团队</span>
                             </div>
                        )}
                      </div>
                      <ChevronDown className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-500 transition-colors" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-(--radix-dropdown-menu-trigger-width) p-1.5 rounded-xl glass-strong border-zinc-200/50 dark:border-white/10 shadow-xl animate-in zoom-in-95 slide-in-from-top-2 duration-200">
                    <div className="px-2 py-1.5 mb-1">
                      <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 pl-1">切换存储源</p>
                    </div>
                    <div className="space-y-0.5">
                      {configs.filter(c => c.status === 'success').map((config) => {
                        const isSelected = selectedConfigId === config.id;
                        return (
                          <DropdownMenuItem 
                            key={config.id} 
                            onClick={async () => {
                              if (selectedConfigId !== config.id) {
                                setSelectedConfigId(config.id);
                                try {
                                  await fileService.setActiveConfig(config.id, configs);
                                  toast.success(`已切换存储源: ${config.name}`);
                                } catch {
                                  toast.error('同步存储配置失败');
                                }
                              }
                            }}
                            className={cn(
                              "relative py-2 px-2 rounded-lg cursor-pointer transition-all outline-none flex items-center justify-between group gap-3",
                              isSelected 
                                ? "bg-zinc-100 dark:bg-white/10" 
                                : "hover:bg-zinc-50 dark:hover:bg-white/5"
                            )}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={cn(
                                "flex items-center justify-center w-8 h-8 rounded-lg shrink-0 transition-colors border",
                                isSelected 
                                  ? "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 shadow-sm text-primary" 
                                  : "bg-zinc-50 dark:bg-white/5 border-transparent text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300"
                              )}>
                                <Server className="w-4 h-4" />
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className={cn(
                                  "text-sm font-medium truncate transition-colors",
                                  isSelected ? "text-foreground" : "text-zinc-600 dark:text-zinc-300 group-hover:text-foreground"
                                )}>
                                  {config.name}
                                </span>
                                {(config.endpoint || config.bucket) && (
                                  <span className="text-[10px] text-zinc-400 truncate tracking-tight opacity-80">
                                    {config.endpoint?.replace(/^https?:\/\//, '') || config.bucket}
                                  </span>
                                )}
                              </div>
                            </div>
                            {config.isTeam && (
                                <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 shrink-0">
                                    <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400 leading-none">团队</span>
                                </div>
                            )}
                            {isSelected && (
                              <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(var(--primary),0.5)] shrink-0 mr-1" />
                            )}
                          </DropdownMenuItem>
                        );
                      })}
                      {configs.filter(c => c.status === 'success').length === 0 && (
                        <div className="p-4 text-center text-xs text-muted-foreground">
                            无可用存储节点，请先前往设置页面配置并测试连接
                        </div>
                      )}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>



          </div>
        </div>

        {/* Upload Area */}
        <UploadArea 
            uploadFiles={uploadFiles} 
            uploading={uploading} 
            queue={queue} 
            aggregateProgress={aggregateProgress}
            selectedConfigId={selectedConfigId}
            disabled={isUploadDisabled}
            disabledMessage={isQuotaRestricted ? "暂无上传权限 (等待管理员分配额度)" : undefined}
        />

        {/* Filter Bar */}
        <FilterBar 
            search={search}
            setSearch={setSearch}
            filter={optimisticFilter} 
            setFilter={handleFilterChange}
            viewMode={viewMode}
            setViewMode={setViewMode}
        />

        {/* Files Grid/List */}
        <div className="relative min-h-[400px]">
          <AnimatePresence mode="wait">
            {(loading || isRefreshing) && files.length === 0 ? (
                <motion.div 
                  key="loader"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-center py-24"
                >
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                  <p className="text-muted-foreground mt-4 font-medium uppercase tracking-widest text-xs">正在载入资源...</p>
                </motion.div>
            ) : files.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card className="glass">
                    <CardContent className="p-12 text-center">
                      <p className="text-muted-foreground">暂无文件</p>
                    </CardContent>
                  </Card>
                </motion.div>
            ) : (
              <motion.div 
                key={filter + search + viewMode} 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className={cn(
                  "transition-[opacity,filter] duration-300",
                  isRefreshing ? "opacity-40 grayscale-[0.5] pointer-events-none" : "opacity-100",
                  optimisticFilter !== 'all' && "hide-type-badges",
                  viewMode === 'grid' 
                    ? "flex flex-row gap-4 items-start" 
                    : "flex flex-col gap-2"
                )}
              >
                  {viewMode === 'grid' ? (
                    Array.from({ length: columns }).map((_, colIndex: number) => (
                      <div key={colIndex} className="flex-1 flex flex-col gap-4">
                        {fileColumns[colIndex].map((file) => (
                           <FileCard 
                               key={file.id} 
                               file={file} 
                               isSelected={selectedIds.includes(file.id)} 
                               isSelectionMode={selectedIds.length > 0}
                               toggleSelect={toggleSelect} 
                               getDirectLink={getDirectLink} 
                               generateShortlink={handleGenerateShortlink}
                               shortlinkEnabled={shortlinkEnabled}
                               onPreview={setPreviewFile}
                               onShare={handleShare}
                          />
                        ))}
                      </div>
                    ))
                  ) : (
                    files.map((file) => (
                      <FileListRow 
                          key={file.id} 
                          file={file} 
                          isSelected={selectedIds.includes(file.id)} 
                          toggleSelect={toggleSelect} 
                          getDirectLink={getDirectLink} 
                          generateShortlink={handleGenerateShortlink}
                          shortlinkEnabled={shortlinkEnabled}
                          onPreview={setPreviewFile}
                          onShare={handleShare}
                      />
                    ))
                  )}
              </motion.div>
            )}
          </AnimatePresence>

        </div>

        {/* Infinite Scroll Sentinel & Loading More State */}
        <div id="scroll-sentinel" className="h-20 flex items-center justify-center">
          {loadingMore && (
             <div className="flex items-center gap-3 bg-zinc-100/50 dark:bg-white/5 px-6 py-3 rounded-full backdrop-blur-sm animate-in fade-in zoom-in duration-300">
               <Loader2 className="w-4 h-4 animate-spin text-primary" />
               <span className="text-sm font-medium text-muted-foreground">加载更多资源...</span>
             </div>
          )}
          {!hasMore && files.length > 0 && !loading && (
             <div className="text-zinc-400 dark:text-zinc-600 text-[11px] uppercase tracking-[0.2em] py-8">
               已经到底啦
             </div>
          )}
        </div>
      </div>
    </div>
  </PageWrapper>

    {/* Bulk Action Toolbar - Clean & Balanced UI */}
    {/* Bulk Action Toolbar - Unified Minimalist UI */}
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
              onClick={handleSelectAll}
            >
              {isRefreshing || isSelectingAll ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                selectedIds.length
              )}
            </div>

            {/* Desktop: Checkbox + Text */}
            <div className="hidden sm:flex items-center gap-4">
              <div 
                className="cursor-pointer transition-all hover:scale-110 active:scale-95"
                onClick={handleSelectAll}
              >
                <div className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center transition-all duration-300",
                  isAllSelected 
                    ? "bg-primary border border-primary text-white scale-110" 
                    : "bg-transparent border border-slate-300 dark:border-zinc-600 text-transparent"
                )}>
                  {isRefreshing || isSelectingAll ? (
                     <Loader2 className="w-3 h-3 animate-spin text-primary dark:text-white" />
                  ) : (
                     <Check className="w-3 h-3" strokeWidth={4} />
                  )}
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-slate-800 dark:text-zinc-100">已选择 {selectedIds.length} 项</span>
                <span className="text-[10px] text-slate-500 dark:text-zinc-500 tracking-wider uppercase">批量管理模式</span>
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1 sm:gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-9 px-3 sm:px-4 rounded-full text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors font-medium text-xs sm:text-sm"
                onClick={() => handleGenerateShortlink('batch')}
              >
                <span className="sm:hidden">分享</span>
                <span className="hidden sm:inline">批量分享</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="h-9 px-3 sm:px-4 rounded-full text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors font-medium text-xs sm:text-sm"
                onClick={() => setCollectionDialog(true)}
              >
                <span className="sm:hidden">合集</span>
                <span className="hidden sm:inline">创建合集</span>
              </Button>

            <Button
              variant="destructive"
              size="sm"
              className="h-9 px-4 sm:px-5 rounded-full font-bold bg-red-500 hover:bg-red-600 transition-all active:scale-95 text-xs sm:text-sm"
              onClick={handleBatchDeleteClick}
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "删除"}
            </Button>

            <div className="w-px h-4 bg-slate-200 dark:bg-white/10 mx-1 sm:mx-2" />

            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors shrink-0"
              onClick={() => setSelectedIds([])}
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* Delete Dialog */}
    <ConfirmDialog
      open={deleteDialog.open}
      onOpenChange={(open) => setDeleteDialog(prev => ({ ...prev, open }))}
      title={deleteDialog.fileId === 'batch' ? "确认批量删除" : "确认删除文件"}
      description={`确定要删除 "${deleteDialog.filename}" 吗？`}
      deleteMode={deleteDialog.deleteMode}
      onDeleteModeChange={(mode) => setDeleteDialog(prev => ({ ...prev, deleteMode: mode }))}
      onConfirm={confirmDelete}
      isLoading={isDeleting}
    />

    {/* Preview Dialog */}
    <FilePreviewDialog
      open={!!previewFile}
      onOpenChange={useCallback((open: boolean) => !open && setPreviewFile(null), [])}
      file={previewFile}
      getDirectLink={getDirectLink}
    />

    {/* Shortlink Dialog */}
    <ShortlinkDialog
      open={shortlinkDialog.open}
      onOpenChange={(open) => setShortlinkDialog(prev => ({ ...prev, open }))}
      onConfirm={handleConfirmGenerateShortlink}
    />

    {/* Share Config Dialog */}
    <ShortlinkDialog
      open={shareDialog.open}
      onOpenChange={(open) => setShareDialog(prev => ({ ...prev, open }))}
      onConfirm={handleConfirmShare}
      title="时效分享"
      description={
        <span className="flex flex-col gap-1">
          <span>设置分享有效期，确定后将<strong>自动更换</strong>分享链接。</span>
          <span className="text-amber-500/80 text-[11px]">注意：旧的分享链接将立即失效。</span>
        </span>
      }
    />

    {/* Collection Dialog */}
    <CollectionDialog
      open={collectionDialog}
      onOpenChange={setCollectionDialog}
      selectedCount={selectedIds.length}
      shortlinkEnabled={shortlinkEnabled}
      onConfirm={handleCreateCollection}
    />
  </>
  );
}
