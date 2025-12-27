'use client';

import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Server, ChevronDown, Check, X } from 'lucide-react';
import Link from 'next/link';
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
import { FileCard } from '@/components/files/file-card';
import { FileListRow } from '@/components/files/file-list-row';
import { UploadArea } from '@/components/files/upload-area';
import { FilterBar } from '@/components/files/filter-bar';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { fileService } from '@/services/file.service';
import { PageWrapper } from '@/components/layout/page-wrapper';
import { toast } from 'sonner';

export default function FilesPage() {
  const { 
    files, loading, search, setSearch, filter, setFilter, viewMode, setViewMode, 
    refreshFn, deleteFile, batchDelete 
  } = useFiles();
  
  const { 
    selectedIds, toggleSelect, setSelectedIds 
  } = useFileSelection();

  const { 
    configs, selectedConfigId, setSelectedConfigId 
  } = useConfigs();

  const { 
    uploading, queue, aggregateProgress, uploadFiles 
  } = useFileUpload(refreshFn);

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

  // Handlers
  const handleCopyShortlink = async (fileId: string, shortlinkCode: string | null) => {
    if (!shortlinkCode) {
      // Generate and copy shortlink
      const loadingToast = toast.loading('正在生成短链...');
      try {
        const url = await fileService.generateShortlink(fileId);
        await navigator.clipboard.writeText(url);
        refreshFn();
        toast.success('短链已生成并复制到剪贴板', { id: loadingToast });
      } catch (err) {
        console.error('生成短链失败:', err);
        toast.error('生成短链失败，请检查短链服务配置', { id: loadingToast });
      }
    } else {
      // Copy existing shortlink
      try {
        const config = await fileService.getShortlinkConfig();
        const shortUrl = `${config.apiUrl}/${shortlinkCode}`;
        await navigator.clipboard.writeText(shortUrl);
        toast.success('短链已复制到剪贴板');
      } catch (err) {
        console.error('复制短链失败:', err);
        toast.error('获取短链配置失败');
      }
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    setDeleteDialog({ open: true, fileId: id, filename: name, deleteMode: 'record-only' });
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

  // Derived state
  const selectedConfigName = configs.find(c => c.id === selectedConfigId)?.name || '加载中...';

  return (
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
                      className="h-10 w-full md:w-auto gap-2 border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950/30 hover:bg-zinc-100 dark:hover:bg-white/10 px-4 min-w-[120px] md:min-w-[140px] justify-between shadow-sm transition-all active:scale-[0.98] rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-0"
                    >
                      <div className="flex items-center gap-2">
                        <Server className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                        <span className="text-xs md:text-sm font-bold text-zinc-700 dark:text-zinc-200">
                          {selectedConfigName}
                        </span>
                      </div>
                      <ChevronDown className="w-4 h-4 text-zinc-400" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 p-2 rounded-2xl glass-strong border-zinc-200/50 dark:border-white/10 shadow-2xl animate-in zoom-in-95 duration-200">
                    <div className="px-2 py-1.5 mb-1">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">选择存储源</p>
                    </div>
                    <div className="space-y-1">
                      {configs.map((config) => {
                        const isSelected = selectedConfigId === config.id;
                        return (
                          <DropdownMenuItem 
                            key={config.id} 
                            onClick={() => setSelectedConfigId(config.id)}
                            className={cn(
                              "text-xs py-2.5 px-4 rounded-xl cursor-pointer transition-all focus:bg-zinc-100 dark:focus:bg-white/10 flex items-center justify-between group",
                              isSelected ? "bg-primary/5 text-primary font-bold dark:bg-primary/10" : "text-zinc-600 dark:text-zinc-300"
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <Server className={cn("w-3.5 h-3.5", isSelected ? "text-primary" : "text-zinc-400")} />
                              {config.name}
                            </div>
                            {isSelected && <Check className="w-3.5 h-3.5 animate-in zoom-in-50 duration-300" />}
                          </DropdownMenuItem>
                        );
                      })}
                    </div>
                  </DropdownMenuContent>
               </DropdownMenu>
             </div>

            <Button variant="outline" className="border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950/30 hover:bg-zinc-100 dark:hover:bg-white/10 h-10 rounded-full px-4 md:px-6 outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-0 shadow-sm transition-all active:scale-[0.98] shrink-0" asChild>
              <Link href="/">返回首页</Link>
            </Button>
          </div>
        </div>

        {/* Upload Area */}
        <UploadArea 
            uploadFiles={uploadFiles} 
            uploading={uploading} 
            queue={queue} 
            aggregateProgress={aggregateProgress}
            selectedConfigId={selectedConfigId}
        />

        {/* Filter Bar */}
        <FilterBar 
            search={search}
            setSearch={setSearch}
            filter={filter}
            setFilter={setFilter}
            viewMode={viewMode}
            setViewMode={setViewMode}
        />

        {/* Files Grid/List */}
        <AnimatePresence mode="wait">
          {loading ? (
              <motion.div 
                key="loader"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="text-center py-12"
              >
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                <p className="text-muted-foreground mt-2">加载中...</p>
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
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className={cn(
                viewMode === 'grid' 
                  ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3 md:gap-4" 
                  : "flex flex-col gap-2"
              )}
            >
                {files.map((file) => {
                   const isSelected = selectedIds.includes(file.id);
                   return viewMode === 'grid' ? (
                       <FileCard 
                           key={file.id} 
                           file={file} 
                           isSelected={isSelected} 
                           toggleSelect={toggleSelect} 
                           copyShortlink={handleCopyShortlink} 
                           deleteFile={handleDeleteClick} 
                       />
                   ) : (
                       <FileListRow 
                           key={file.id} 
                           file={file} 
                           isSelected={isSelected} 
                           toggleSelect={toggleSelect} 
                           copyShortlink={handleCopyShortlink} 
                           deleteFile={handleDeleteClick} 
                       />
                   );
                })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Bulk Action Toolbar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 md:bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300 w-max max-w-[95vw]">
          <div className="bg-zinc-900/90 dark:bg-zinc-800/95 backdrop-blur-xl border border-white/10 rounded-2xl md:rounded-full px-4 md:px-6 py-2.5 md:py-3 shadow-2xl flex items-center justify-between gap-4 md:gap-6">
            <div className="flex items-center gap-2 md:gap-3 pr-2 md:pr-4 border-r border-white/10">
              <span className="text-white font-bold text-xs md:text-sm whitespace-nowrap">已选 {selectedIds.length} 项</span>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 w-6 md:h-8 md:w-8 p-0 text-white/60 hover:text-white hover:bg-white/10 rounded-full"
                onClick={() => setSelectedIds([])}
              >
                <X className="w-3.5 h-3.5 md:w-5 md:h-5" />
              </Button>
            </div>

            <div className="flex items-center gap-1.5 md:gap-2">
               <Button
                variant="destructive"
                size="sm"
                className="rounded-full h-8 md:h-9 px-3 md:px-5 font-bold text-xs md:text-sm shadow-lg shadow-red-500/20"
                onClick={handleBatchDeleteClick}
                disabled={isDeleting}
              >
                {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '批量删除'}
              </Button>
            </div>
          </div>
        </div>
      )}

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
    </div>
    </PageWrapper>
  );
}
