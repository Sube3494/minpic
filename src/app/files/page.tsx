'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Upload, Search, Image as ImageIcon, Video, Music, Trash2, Link2, Copy, Download, Loader2, Server, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";

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
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'image' | 'video' | 'audio'>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [configs, setConfigs] = useState<{ id: string; name: string }[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string>('');

  useEffect(() => {
    loadFiles();
    loadConfigs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, search]);

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

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    setUploading(true);
    const uploadPromises = Array.from(selectedFiles).map(async (file) => {
      const formData = new FormData();
      formData.append('file', file);
      if (selectedConfigId) {
        formData.append('configId', selectedConfigId);
      }

      try {
        const response = await fetch('/api/files', {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          toast.success(`${file.name} 上传成功`);
          return true;
        } else {
          toast.error(`${file.name} 上传失败`);
          return false;
        }
      } catch {
        toast.error(`${file.name} 上传失败`);
        return false;
      }
    });

    await Promise.all(uploadPromises);
    setUploading(false);
    loadFiles();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const deleteFile = async (id: string, filename: string) => {
    if (!confirm(`确定要删除 ${filename} 吗？`)) return;

    try {
      const response = await fetch(`/api/files/${id}`, { method: 'DELETE' });
      if (response.ok) {
        toast.success('文件已删除');
        loadFiles();
      } else {
        toast.error('删除失败');
      }
    } catch {
      toast.error('删除失败');
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
    <div className="min-h-screen p-6 md:p-12 pb-32">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight text-glow">
              <span className="bg-clip-text text-transparent bg-linear-to-r from-zinc-900 to-zinc-500 dark:from-white dark:to-white/40">
                文件管理
              </span>
            </h1>
            <p className="text-muted-foreground text-lg">
              查看与管理所有上传的资源
            </p>
          </div>
          <div className="flex items-center gap-3">
             <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="h-10 gap-2 border-zinc-200 dark:border-white/10 bg-white/50 dark:bg-white/5 hover:bg-zinc-100 dark:hover:bg-white/10 backdrop-blur-md px-4 min-w-[140px] justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <Server className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                        {configs.find(c => c.id === selectedConfigId)?.name || '加载中...'}
                      </span>
                    </div>
                    <ChevronDown className="w-4 h-4 text-zinc-500 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 glass-card">
                  <DropdownMenuLabel className="text-xs text-muted-foreground">选择存储源</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuRadioGroup value={selectedConfigId} onValueChange={setSelectedConfigId}>
                    {configs.map((config) => (
                      <DropdownMenuRadioItem key={config.id} value={config.id} className="text-xs cursor-pointer">
                        {config.name}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
             </DropdownMenu>

            <Button variant="outline" className="border-zinc-200 dark:border-white/10 bg-white/50 dark:bg-white/5 hover:bg-zinc-100 dark:hover:bg-white/10 backdrop-blur-md h-10" asChild>
              <Link href="/">返回首页</Link>
            </Button>
          </div>
        </div>

        {/* Upload Area */}
        <Card className="glass-strong">
          <CardContent className="p-6">
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center bg-white/50 dark:bg-white/5 transition-colors hover:bg-white/60 dark:hover:bg-white/10">
              <Upload className="w-12 h-12 mx-auto mb-4 text-primary opacity-80" />
              <h3 className="text-lg font-semibold mb-2 text-zinc-800 dark:text-white">上传文件</h3>
              <p className="text-sm text-muted-foreground mb-6">
                支持图片、视频和音频文件
              </p>

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
                      正在上传...
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

        {/* Filters */}
        <div className="flex gap-4 items-center">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="搜索文件..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              onClick={() => setFilter('all')}
            >
              全部
            </Button>
            <Button
              variant={filter === 'image' ? 'default' : 'outline'}
              onClick={() => setFilter('image')}
            >
              <ImageIcon className="w-4 h-4 mr-2" />
              图片
            </Button>
            <Button
              variant={filter === 'video' ? 'default' : 'outline'}
              onClick={() => setFilter('video')}
            >
              <Video className="w-4 h-4 mr-2" />
              视频
            </Button>
            <Button
              variant={filter === 'audio' ? 'default' : 'outline'}
              onClick={() => setFilter('audio')}
            >
              <Music className="w-4 h-4 mr-2" />
              音频
            </Button>
          </div>
        </div>

        {/* Files Grid */}
        {loading ? (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground mt-2">加载中...</p>
          </div>
        ) : files.length === 0 ? (
          <Card className="glass">
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground">暂无文件</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {files.map((file) => (
              <Card key={file.id} className="glass hover-lift overflow-hidden">
                <div className="aspect-square bg-muted flex items-center justify-center relative">
                  {file.fileType === 'image' && file.thumbnailPath ? (
                    <Image
                      src={`/api/files/${file.id}/download`}
                      alt={file.filename}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="text-primary">
                      {getFileIcon(file.fileType)}
                    </div>
                  )}
                </div>
                <CardContent className="p-4 space-y-3">
                  <div>
                    <h3 className="font-semibold truncate" title={file.filename}>
                      {file.filename}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(file.fileSize)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => copyShortlink(file.id, file.shortlinkCode)}
                    >
                      {file.shortlinkCode ? <Copy className="w-3 h-3" /> : <Link2 className="w-3 h-3" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      asChild
                    >
                      <a href={`/api/files/${file.id}/download`} download>
                       <Download className="w-3 h-3" />
                      </a>
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteFile(file.id, file.filename)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
