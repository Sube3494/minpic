'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { Upload, Search, Image as ImageIcon, Video, Music, Trash2, Link2, Copy, Loader2, Server, ChevronDown, Grid3x3, List, CheckCircle2, Circle, X, Check } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import Link from 'next/link';
import Image from 'next/image';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

interface FileItem {
  id: string;
  filename: string;
  minioPath: string;
  fileSize: number;
  mimeType: string;
  fileType: string;
  thumbnailPath: string | null;
  shortlinkCode: string | null;
  createdAt: string;
}

export default function FilesPage() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'image' | 'video' | 'audio'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; fileId: string; filename: string }>({ 
    open: false, 
    fileId: '', 
    filename: '' 
  });

  const [configs, setConfigs] = useState<{ id: string; name: string }[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string>('');

  useEffect(() => {
    loadFiles();
    loadConfigs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, search, selectedConfigId]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === files.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(files.map(f => f.id));
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    
    // Using the original delete dialog state with a flag or title update
    setDeleteDialog({ 
      open: true, 
      fileId: 'batch', 
      filename: `选中的 ${selectedIds.length} 个文件` 
    });
  };

  const loadConfigs = async () => {
    try {
      const response = await fetch('/api/config/minio');
      if (response.ok) {
        const data = await response.json();
        setConfigs(data.configs || []);
        if (data.activeId) {
            setSelectedConfigId(data.activeId);
        } else if (data.configs && data.configs.length > 0) {
            setSelectedConfigId(data.configs[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to load configs', error);
    }
  };

  const loadFiles = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.append('fileType', filter);
      if (search) params.append('search', search);

      const response = await fetch(`/api/files?${params}`);
      const data = await response.json();
      setFiles(data.files || []);
    } catch {
      toast.error('加载文件列表失败');
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------
  // Upload Logic with Global Queue
  // ---------------------------------------------------------
  interface UploadTask {
    id: string;
    file: File;
    loaded: number;
    total: number;
    status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error';
    xhr?: XMLHttpRequest;
  }

  const [queue, setQueue] = useState<UploadTask[]>([]);

  // Compute aggregate progress across the entire active queue
  const aggregateProgress = (() => {
    const activeTasks = queue.filter(t => t.status !== 'completed' || t.loaded < t.total);
    if (activeTasks.length === 0) return { loaded: 0, total: 0, percent: 0, isProcessing: false };
    
    // We only care about the progress of currently relevant tasks
    const total = activeTasks.reduce((acc, t) => acc + t.total, 0);
    const loaded = activeTasks.reduce((acc, t) => acc + t.loaded, 0);
    const percent = Math.min(99, Math.round((loaded / total) * 100));
    const isProcessing = activeTasks.every(t => t.status === 'processing' || t.status === 'completed');
    
    return { loaded, total, percent, isProcessing };
  })();

  const uploadFiles = async (selectedFiles: FileList) => {
    if (!selectedFiles || selectedFiles.length === 0) return;

    const newTasks: UploadTask[] = Array.from(selectedFiles).map(file => ({
      id: Math.random().toString(36).substring(7),
      file,
      loaded: 0,
      total: file.size,
      status: 'pending'
    }));

    setQueue(prev => [...prev, ...newTasks]);
    setUploading(true);
  };

  // Effect to process the queue
  useEffect(() => {
    const CONCURRENCY_LIMIT = 3;
    const activeCount = queue.filter(t => t.status === 'uploading' || t.status === 'processing').length;
    
    if (activeCount < CONCURRENCY_LIMIT) {
      const nextTask = queue.find(t => t.status === 'pending');
      if (nextTask) {
        startUploadTask(nextTask.id);
      }
    }

    // When everything is done, wait a bit then reset uploading state and refresh list
    if (queue.length > 0 && queue.every(t => t.status === 'completed' || t.status === 'error')) {
      const timer = setTimeout(() => {
        setUploading(false);
        setQueue([]);
        loadFiles();
        if (fileInputRef.current) fileInputRef.current.value = '';
      }, 1500);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue]);

  const startUploadTask = (taskId: string) => {
    const task = queue.find(t => t.id === taskId);
    if (!task) return;

    const formData = new FormData();
    formData.append('file', task.file);
    if (selectedConfigId) formData.append('configId', selectedConfigId);

    const xhr = new XMLHttpRequest();
    
    // Update status to uploading
    setQueue(prev => prev.map(t => t.id === taskId ? { ...t, status: 'uploading', xhr } : t));

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        setQueue(prev => prev.map(t => t.id === taskId ? { ...t, loaded: e.loaded } : t));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        toast.success(`${task.file.name} 上传成功`);
        setQueue(prev => prev.map(t => t.id === taskId ? { ...t, status: 'completed', loaded: task.total } : t));
      } else {
        try {
          const errorData = JSON.parse(xhr.responseText);
          if (errorData.message?.includes('FILE_EXISTS')) {
            toast.info(`${task.file.name} 已存在`);
          } else {
            toast.error(`${task.file.name} 上传失败`);
          }
        } catch {
          toast.error(`${task.file.name} 上传失败`);
        }
        setQueue(prev => prev.map(t => t.id === taskId ? { ...t, status: 'error' } : t));
      }
    });

    xhr.addEventListener('error', () => {
      toast.error(`${task.file.name} 网络错误`);
      setQueue(prev => prev.map(t => t.id === taskId ? { ...t, status: 'error' } : t));
    });

    // Special status: when upload finishes but server is processing (e.g. video thumbnails)
    xhr.upload.addEventListener('load', () => {
      setQueue(prev => prev.map(t => t.id === taskId ? { ...t, status: 'processing', loaded: task.total } : t));
    });

    xhr.open('POST', '/api/files');
    xhr.send(formData);
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (selectedFiles) {
      await uploadFiles(selectedFiles);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles) {
      await uploadFiles(droppedFiles);
    }
  };

  const deleteFile = async (fileId: string, filename: string) => {
    setDeleteDialog({ open: true, fileId, filename });
  };

  const confirmDelete = async () => {
    const { fileId } = deleteDialog;
    setIsDeleting(true);

    try {
      if (fileId === 'batch') {
        const response = await fetch('/api/files', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: selectedIds }),
        });
        if (response.ok) {
          toast.success(`成功删除 ${selectedIds.length} 个文件`);
          setSelectedIds([]);
          loadFiles();
          setDeleteDialog({ open: false, fileId: '', filename: '' });
        } else {
          toast.error('批量删除失败');
        }
      } else {
        const response = await fetch(`/api/files/${fileId}`, { method: 'DELETE' });
        if (response.ok) {
          toast.success('文件已删除');
          loadFiles();
          setSelectedIds(prev => prev.filter(id => id !== fileId));
          setDeleteDialog({ open: false, fileId: '', filename: '' });
        } else {
          toast.error('删除失败');
        }
      }
    } catch {
      toast.error('删除失败');
    } finally {
      setIsDeleting(false);
    }
  };

  const copyShortlink = async (fileId: string, shortlinkCode: string | null) => {
    if (!shortlinkCode) {
      // Generate shortlink
      try {
        const response = await fetch('/api/shortlinks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileId }),
        });

        if (response.ok) {
          const data = await response.json();
          await navigator.clipboard.writeText(data.short_url);
          toast.success('短链已生成并复制');
          loadFiles();
        } else {
          toast.error('生成短链失败');
        }
      } catch {
        toast.error('生成短链失败');
      }
    } else {
      // Copy existing shortlink
      const shortlinkConfig = await fetch('/api/config/shortlink').then(r => r.json());
      if (shortlinkConfig) {
        const shortUrl = `${shortlinkConfig.apiUrl}/${shortlinkCode}`;
        await navigator.clipboard.writeText(shortUrl);
        toast.success('短链已复制');
      }
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  };

  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case 'image': return <ImageIcon className="w-5 h-5" />;
      case 'video': return <Video className="w-5 h-5" />;
      case 'audio': return <Music className="w-5 h-5" />;
      default: return <ImageIcon className="w-5 h-5" />;
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-12 pb-32 safe-area-bottom">
      <div className="max-w-7xl mx-auto space-y-6 md:space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6 mb-2 md:mb-8">
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
                          {configs.find(c => c.id === selectedConfigId)?.name || '加载中...'}
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
        <Card className="glass-strong">
          <CardContent className="p-3 md:p-6">
            <div 
              className={`border-2 border-dashed rounded-lg p-6 md:p-8 text-center transition-all ${
                isDragging 
                  ? 'border-primary bg-primary/10 dark:bg-primary/20 scale-[1.02]' 
                  : 'border-border bg-white/50 dark:bg-white/5 hover:bg-white/60 dark:hover:bg-white/10'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <Upload className={`w-8 h-8 md:w-12 md:h-12 mx-auto mb-3 md:mb-4 opacity-80 transition-colors ${
                isDragging ? 'text-primary' : 'text-primary'
              }`} />
              <h3 className="text-base md:text-lg font-semibold mb-1 md:mb-2 text-zinc-800 dark:text-white">
                {isDragging ? '松开鼠标上传' : '上传文件'}
              </h3>
              <p className="text-[10px] md:text-sm text-muted-foreground mb-4 md:mb-6">
                {isDragging ? '拖放文件到此处' : '支持拖拽文件或点击选择'}
              </p>

              {uploading && aggregateProgress.total > 0 && (
                <div className="mb-6 space-y-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                       {aggregateProgress.isProcessing ? (
                         <Loader2 className="w-4 h-4 animate-spin text-primary" />
                       ) : (
                         <Upload className="w-4 h-4 text-primary animate-bounce" />
                       )}
                       <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        {aggregateProgress.isProcessing ? '正在处理(优化文件中)...' : '正在上传...'}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-primary">
                      {aggregateProgress.percent}%
                    </span>
                  </div>
                  <div className="w-full bg-zinc-200 dark:bg-zinc-700/50 rounded-full h-2.5 overflow-hidden backdrop-blur-sm">
                    <div 
                      className={`h-full transition-all duration-500 ease-out shadow-[0_0_10px_rgba(var(--primary),0.5)] ${
                        aggregateProgress.isProcessing ? 'bg-primary/60 animate-pulse' : 'bg-primary'
                      }`}
                      style={{ width: `${Math.max(2, aggregateProgress.percent)}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-[10px] text-muted-foreground">
                      共 {queue.filter(t => t.status !== 'completed').length} 个文件待完成
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatFileSize(aggregateProgress.loaded)} / {formatFileSize(aggregateProgress.total)}
                    </p>
                  </div>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*,audio/*"
                onChange={handleUpload}
                className="hidden"
                id="file-upload"
              />
              <Button asChild disabled={uploading} className="rounded-full px-8 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-shadow">
                <label htmlFor="file-upload" className="cursor-pointer">
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {aggregateProgress.isProcessing ? '正在后端处理...' : `总进度 ${aggregateProgress.percent}%`}
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      选择文件上传
                    </>
                  )}
                </label>
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col space-y-4 md:space-y-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-primary transition-colors" />
              <Input
                placeholder="搜索文件..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-11 h-11 bg-white/50 dark:bg-white/5 border-zinc-200 dark:border-white/10 rounded-full outline-none focus-visible:ring-4 focus-visible:ring-primary/10 transition-all"
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none flex-1">
              <Button
                variant={filter === 'all' ? 'default' : 'outline'}
                onClick={() => setFilter('all')}
                size="sm"
                className="rounded-full px-4 shrink-0"
              >
                全部
              </Button>
              <Button
                variant={filter === 'image' ? 'default' : 'outline'}
                onClick={() => setFilter('image')}
                size="sm"
                className="rounded-full px-4 shrink-0"
              >
                <ImageIcon className="w-3.5 h-3.5 mr-1.5" />
                图片
              </Button>
              <Button
                variant={filter === 'video' ? 'default' : 'outline'}
                onClick={() => setFilter('video')}
                size="sm"
                className="rounded-full px-4 shrink-0"
              >
                <Video className="w-3.5 h-3.5 mr-1.5" />
                视频
              </Button>
              <Button
                variant={filter === 'audio' ? 'default' : 'outline'}
                onClick={() => setFilter('audio')}
                size="sm"
                className="rounded-full px-4 shrink-0"
              >
                <Music className="w-3.5 h-3.5 mr-1.5" />
                音频
              </Button>
            </div>
            <div className="flex gap-1 border rounded-full p-1 bg-muted/50 shrink-0 shadow-inner">
              <Button
                size="sm"
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                onClick={() => setViewMode('grid')}
                className="h-8 w-8 p-0 rounded-full"
              >
                <Grid3x3 className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                onClick={() => setViewMode('list')}
                className="h-8 w-8 p-0 rounded-full"
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        <LayoutGroup>
          {loading ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12"
            >
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
              <p className="text-muted-foreground mt-2">加载中...</p>
            </motion.div>
          ) : files.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <Card className="glass">
                <CardContent className="p-12 text-center">
                  <p className="text-muted-foreground">暂无文件</p>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <motion.div 
              layout 
              className={cn(
                viewMode === 'grid' 
                  ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3 md:gap-4" 
                  : "flex flex-col gap-2"
              )}
            >
              <AnimatePresence mode="popLayout" initial={false}>
                {files.map((file) => {
                  const isSelected = selectedIds.includes(file.id);
                  const typeBorderStyle = file.fileType === 'video' 
                    ? 'border-purple-500/20 dark:border-purple-500/40' 
                    : file.fileType === 'audio'
                    ? 'border-blue-500/20 dark:border-blue-500/40'
                    : 'border-black/5 dark:border-white/5';
                  
                  const badgeStyle = file.fileType === 'video'
                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300'
                    : file.fileType === 'audio'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300'
                    : 'bg-zinc-100 text-zinc-700 dark:bg-white/10 dark:text-zinc-300';

                  return (
                    <motion.div
                      key={file.id}
                      layoutId={`file-${file.id}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ 
                        layout: { type: "spring", stiffness: 250, damping: 30 },
                        opacity: { duration: 0.2 }
                      }}
                      className={cn(
                        "relative group cursor-pointer overflow-hidden border rounded-2xl shadow-sm",
                        viewMode === 'list' 
                          ? "bg-white dark:bg-black/20 p-1" 
                          : "bg-card p-0",
                        isSelected ? "ring-2 ring-primary border-primary z-20" : typeBorderStyle
                      )}
                      onClick={() => toggleSelect(file.id)}
                    >
                      {viewMode === 'grid' ? (
                        <div className="aspect-square relative w-full overflow-hidden">
                          {/* Checkbox Overlay */}
                          <div className={cn(
                            "absolute top-2 right-2 z-30 transition-all duration-300",
                            isSelected ? "opacity-100 scale-100" : "opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100"
                          )}>
                            <div className="bg-black/20 backdrop-blur-md rounded-full p-1 border border-white/20">
                              {isSelected ? (
                                <CheckCircle2 className="w-4 h-4 text-primary fill-primary/20" />
                              ) : (
                                <Circle className="w-4 h-4 text-white/80" />
                              )}
                            </div>
                          </div>

                          {/* Thumbnail */}
                          <motion.div layoutId={`thumb-${file.id}`} className="absolute inset-0 bg-muted/50 flex items-center justify-center">
                            {(file.fileType === 'image' || file.fileType === 'video') ? (
                              <Image
                                src={`/api/files/${file.id}/thumbnail`}
                                alt={file.filename}
                                fill
                                className="object-cover"
                                unoptimized
                              />
                            ) : (
                              <div className="text-primary/70 text-4xl">
                                {getFileIcon(file.fileType)}
                              </div>
                            )}
                          </motion.div>

                          {/* Info Overlay */}
                          <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 md:group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-3">
                            <motion.div layoutId={`info-${file.id}`} className="drop-shadow-lg">
                              <h3 className="text-white text-[10px] md:text-xs font-bold truncate leading-tight">{file.filename}</h3>
                              <p className="text-white/70 text-[8px] md:text-[10px] mt-0.5">{formatFileSize(file.fileSize)}</p>
                            </motion.div>
                            
                            <div className="flex items-center justify-between mt-auto">
                              <span className={cn("text-[8px] md:text-[9px] px-1.5 md:px-2 py-0.5 md:py-1 rounded-full shadow-lg backdrop-blur-md font-bold uppercase tracking-wider", badgeStyle)}>
                                {file.fileType}
                              </span>
                              <div className="flex gap-1 md:gap-1.5" onClick={e => e.stopPropagation()}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button size="sm" variant="secondary" className="h-6 w-6 md:h-7 md:w-7 p-0 shadow-lg" onClick={() => copyShortlink(file.id, file.shortlinkCode)}>
                                      {file.shortlinkCode ? <Copy className="w-2.5 h-2.5 md:w-3 md:h-3" /> : <Link2 className="w-2.5 h-2.5 md:w-3 md:h-3" />}
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top">复制链接</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button size="sm" variant="destructive" className="h-6 w-6 md:h-7 md:w-7 p-0 shadow-lg" onClick={() => deleteFile(file.id, file.filename)}>
                                      <Trash2 className="w-2.5 h-2.5 md:w-3 md:h-3" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top">删除文件</TooltipContent>
                                </Tooltip>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* List View Item Content */
                        <div className="flex items-center gap-2 md:gap-4 p-2 md:p-3 relative">
                          <div className="shrink-0 pl-1">
                            {isSelected ? (
                              <CheckCircle2 className="w-5 h-5 text-primary" />
                            ) : (
                              <Circle className="w-5 h-5 text-zinc-300 dark:text-zinc-800" />
                            )}
                          </div>

                          <motion.div 
                            layoutId={`thumb-${file.id}`} 
                            className="w-10 h-10 md:w-14 md:h-14 bg-zinc-100 dark:bg-white/5 flex items-center justify-center relative overflow-hidden rounded-xl shrink-0 border border-black/5 dark:border-white/10"
                          >
                            {(file.fileType === 'image' || file.fileType === 'video') ? (
                              <Image
                                src={`/api/files/${file.id}/thumbnail`}
                                alt={file.filename}
                                fill
                                className="object-cover"
                                unoptimized
                              />
                            ) : (
                              <div className="text-primary/70 scale-75 md:scale-100">
                                {getFileIcon(file.fileType)}
                              </div>
                            )}
                          </motion.div>

                          <motion.div layoutId={`info-${file.id}`} className="flex-1 min-w-0 pr-1">
                            <h3 className="font-bold text-xs md:text-sm truncate dark:text-zinc-100">{file.filename}</h3>
                            <div className="flex items-center gap-1.5 md:gap-3 mt-0.5 text-[8px] md:text-[10px] text-muted-foreground uppercase tracking-tight font-bold">
                              <span>{formatFileSize(file.fileSize)}</span>
                              <span className="opacity-30">•</span>
                              <span className="truncate">{file.fileType}</span>
                              <span className="opacity-30 hidden sm:inline">•</span>
                              <span className="hidden sm:inline">{new Date(file.createdAt).toLocaleDateString('zh-CN')}</span>
                            </div>
                          </motion.div>

                          <div className="flex gap-1.5 md:gap-2" onClick={e => e.stopPropagation()}>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 md:h-10 px-2 md:px-5 rounded-full font-bold bg-white dark:bg-white/5 border-zinc-200 dark:border-white/10 shadow-sm"
                              onClick={() => copyShortlink(file.id, file.shortlinkCode)}
                            >
                              {file.shortlinkCode ? <Copy className="w-3.5 h-3.5 md:mr-2" /> : <Link2 className="w-3.5 h-3.5 md:mr-2" />}
                              <span className="hidden sm:inline text-xs">{file.shortlinkCode ? '复制链接' : '生成链接'}</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-8 w-8 md:h-10 md:w-auto md:px-5 rounded-full shadow-md shadow-destructive/10"
                              onClick={() => deleteFile(file.id, file.filename)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline ml-2 text-xs font-bold">删除</span>
                            </Button>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </motion.div>
          )}
        </LayoutGroup>
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
                variant="ghost" 
                size="sm" 
                className="text-white/80 hover:text-white hover:bg-white/10 h-8 md:h-9 px-3 md:px-4 rounded-full text-[10px] md:text-xs whitespace-nowrap"
                onClick={toggleSelectAll}
              >
                {selectedIds.length === files.length ? '取消' : '全选'}
              </Button>
              <Button 
                variant="destructive" 
                size="sm" 
                className="h-8 md:h-10 px-4 md:px-6 rounded-full shadow-lg shadow-destructive/20 hover:scale-105 transition-transform text-[10px] md:text-sm font-bold"
                onClick={handleBatchDelete}
              >
                <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1.5 md:mr-2" />
                批量删除
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => !isDeleting && !open && setDeleteDialog({ open: false, fileId: '', filename: '' })}
        title="删除文件"
        description={deleteDialog.fileId === 'batch' ? `确定要批量删除这 ${selectedIds.length} 个文件吗?` : `确定要删除 "${deleteDialog.filename}" 吗?\n\n此操作不可恢复。`}
        confirmText={isDeleting ? '正在删除...' : '确认删除'}
        cancelText="取消"
        variant="destructive"
        onConfirm={confirmDelete}
        isLoading={isDeleting}
      />
    </div>
  );
}
