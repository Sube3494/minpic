'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Save, Loader2, Plus, Trash2, Check, Server, RefreshCw, ChevronDown, Info } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

// Types
interface MinioConfigItem {
  id: string;
  name: string;
  endpoint: string;
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  bucket: string;
  region?: string;
  customDomain?: string;
  duplicateHandling?: 'skip' | 'overwrite' | 'keep-both';
  baseDir?: string;
  autoArchive?: boolean;
}

const DEFAULT_CONFIG: Omit<MinioConfigItem, 'id' | 'name'> = {
  endpoint: 'localhost',
  port: 9000,
  useSSL: false,
  accessKey: '',
  secretKey: '',
  bucket: 'minpic',
  region: '',
  customDomain: '',
  duplicateHandling: 'keep-both',
  baseDir: '',
  autoArchive: false,
};

export default function SettingsPage() {
  const [configs, setConfigs] = useState<MinioConfigItem[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [selectedId, setSelectedId] = useState<string>('');
  
  const [shortlinkConfig, setShortlinkConfig] = useState({
    apiUrl: '',
    apiKey: '',
    autoGenerate: true,
    expiresIn: 0, // 0 表示永久
  });

  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState<'minio' | 'shortlink' | null>(null);
  const [syncing, setSyncing] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [syncProgress, setSyncProgress] = useState<{total: number; imported: number; skipped: number} | null>(null);
  const [syncDialog, setSyncDialog] = useState<{ open: boolean; configId: string }>({ open: false, configId: '' });

  // Load configs on mount
  useEffect(() => {
    loadConfigs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadConfigs = async () => {
    try {
      const [minioRes, shortlinkRes] = await Promise.all([
        fetch('/api/config/minio'),
        fetch('/api/config/shortlink'),
      ]);

      if (minioRes.ok) {
        const data = await minioRes.json();
        setConfigs(data.configs || []);
        setActiveId(data.activeId || '');
        if (data.configs?.length > 0) {
            // If already selecting something, keep it unless it's gone
            // But initially we want to select something if nothing selected
            if (!selectedId) {
                setSelectedId(data.activeId || data.configs[0].id);
            }
        }
      }

      if (shortlinkRes.ok) {
        const data = await shortlinkRes.json();
        if (data) setShortlinkConfig(data);
      }
    } catch (error) {
      console.error('Error loading configs:', error);
      toast.error('无法加载配置信息');
    }
  };

  const handleCreateConfig = () => {
    const newId = `config-${Date.now()}`;
    const newConfig: MinioConfigItem = {
      ...DEFAULT_CONFIG,
      id: newId,
      name: '新配置',
    };
    setConfigs([...configs, newConfig]);
    setSelectedId(newId);
  };

  const handleDeleteConfig = (id: string) => {
    if (configs.length <= 1) {
      toast.error('无法删除最后一个配置');
      return;
    }
    if (id === activeId) {
      toast.error('无法删除当前激活的配置');
      return;
    }
    
    const newConfigs = configs.filter(c => c.id !== id);
    setConfigs(newConfigs);
    if (selectedId === id) {
      setSelectedId(newConfigs[0].id);
    }
  };

  const updateSelectedConfig = (updates: Partial<MinioConfigItem>) => {
    setConfigs(configs.map(c => c.id === selectedId ? { ...c, ...updates } : c));
  };

  const selectedConfig = configs.find(c => c.id === selectedId);

  const saveAll = async () => {
    setLoading(true);
    try {
      // Save MinIO Configs
      const minioRes = await fetch('/api/config/minio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configs, activeId }),
      });

      if (!minioRes.ok) throw new Error('Failed to save MinIO configs');

      // Save Shortlink Config
      const shortlinkRes = await fetch('/api/config/shortlink', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shortlinkConfig),
      });

      if (!shortlinkRes.ok) throw new Error('Failed to save shortlink config');

      toast.success('所有配置已成功保存');
    } catch (error) {
       console.error(error);
      toast.error('保存失败，请检查网络或日志');
    } finally {
      setLoading(false);
    }
  };
  
  const handleActivate = (id: string) => {
      setActiveId(id);
      toast.info('已设为激活状态，由于尚未保存，请点击右上角"保存所有更改"以生效。');
  };

  const testConnection = async (type: 'minio' | 'shortlink') => {
    setTesting(type);
    try {
      let config;
      if (type === 'minio') {
          if (!selectedConfig) return;
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { id, name, ...rest } = selectedConfig;
          config = { type, ...rest };
      } else {
          config = { type, ...shortlinkConfig };
      }

      const response = await fetch('/api/config/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      const data = await response.json();
      if (data.success) {
        toast.success('连接测试成功！');
      } else {
        toast.error('连接测试失败，请检查配置信息。');
      }
    } catch (error) {
       console.error(error);
      toast.error('连接测试发生错误');
    } finally {
      setTesting(null);
    }
  };

  const syncFiles = async (configId: string) => {
    setSyncDialog({ open: true, configId });
  };

  const confirmSync = async () => {
    const { configId } = syncDialog;
    setSyncDialog({ open: false, configId: '' });

    setSyncing(true);
    setSyncProgress(null);

    try {
      const response = await fetch('/api/files/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configId }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSyncProgress({
          total: data.total,
          imported: data.imported,
          skipped: data.skipped,
        });
        toast.success(`同步完成！共 ${data.total} 个文件，导入 ${data.imported} 个，跳过 ${data.skipped} 个`);
        
        // Reload page to see new files
        setTimeout(() => {
          window.location.href = '/files';
        }, 2000);
      } else {
        toast.error(data.error || '同步失败');
      }
    } catch (error) {
      console.error(error);
      toast.error('同步时发生错误');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="min-h-screen p-6 md:p-12 pb-32">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1 md:space-y-2">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-glow">
              <span className="bg-clip-text text-transparent bg-linear-to-r from-zinc-900 to-zinc-500 dark:from-white dark:to-white/40">
                系统设置
              </span>
            </h1>
            <p className="text-muted-foreground text-sm md:text-lg">
              管理多图床源配置与外部服务集成
            </p>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
             <Button 
                onClick={saveAll} 
                disabled={loading} 
                className="h-9 md:h-11 rounded-full px-4 md:px-6 bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all text-xs md:text-sm font-bold"
             >
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                保存更改
              </Button>
             <Button variant="outline" className="h-9 md:h-11 rounded-full px-4 md:px-6 border-zinc-200 dark:border-white/10 bg-white/50 dark:bg-white/5 hover:bg-zinc-100 dark:hover:bg-white/10 backdrop-blur-md text-xs md:text-sm active:scale-95 transition-all" asChild>
                <Link href="/">返回</Link>
             </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Sidebar: Config List */}
            <Card className="lg:col-span-4 glass-strong overflow-hidden flex flex-col h-fit lg:max-h-[800px] border-zinc-200/50 dark:border-white/10 shadow-lg bg-white/50 dark:bg-black/20">
                <CardHeader className="pb-3 border-b border-zinc-200 dark:border-white/5">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">配置源列表</CardTitle>
                        <Button size="sm" variant="ghost" onClick={handleCreateConfig} className="hover:bg-zinc-200/50 dark:hover:bg-white/10">
                            <Plus className="w-4 h-4" />
                        </Button>
                    </div>
                    <CardDescription className="text-zinc-500 dark:text-zinc-400">选择一个源进行编辑</CardDescription>
                </CardHeader>

                <div className="flex-1 overflow-y-auto max-h-[40vh] lg:max-h-none p-3 custom-scrollbar">
                    <div className="space-y-2">
                        {configs.map((config, index) => {
                          const isActive = activeId === config.id;
                          const isSelected = selectedId === config.id;
                          
                          return (
                            <div 
                                key={config.id}
                                style={{ animationDelay: `${index * 50}ms` }}
                                onClick={() => setSelectedId(config.id)}
                                className={cn(
                                    "p-4 rounded-2xl border cursor-pointer transition-all duration-300 flex items-center justify-between group relative overflow-hidden animate-in slide-in-from-bottom-2 fade-in fill-mode-backwards active:scale-[0.98]",
                                    isSelected 
                                        ? "border-zinc-200 dark:border-white/20 bg-white dark:bg-white/10 shadow-md shadow-black/5 ring-1 ring-black/5 dark:ring-white/5" 
                                        : "border-transparent bg-white/40 dark:bg-white/5 hover:bg-zinc-100/50 dark:hover:bg-white/10"
                                )}
                            >
                                <div className="flex items-center gap-3 overflow-hidden z-10 w-full">
                                    <div className={cn(
                                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all duration-500", 
                                        isActive 
                                            ? "bg-primary/10 text-primary shadow-[0_0_15px_rgba(var(--primary),0.3)]" 
                                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 group-hover:text-zinc-600"
                                    )}>
                                        <Server className={cn("w-5 h-5", isActive ? "animate-pulse" : "")} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className={cn("font-bold truncate transition-colors text-sm", isSelected ? "text-zinc-900 dark:text-white" : "text-zinc-600 dark:text-zinc-300")}>
                                            {config.name}
                                        </div>
                                        <div className={cn("text-[10px] truncate transition-opacity flex items-center gap-1.5 mt-0.5", isSelected ? "text-zinc-500/80 dark:text-zinc-400" : "text-zinc-500/70 hover:text-zinc-500")}>
                                            <span className="truncate">{config.endpoint}</span>
                                        </div>
                                    </div>

                                    {isActive && (
                                        <div className="shrink-0 flex items-center justify-center ml-2">
                                          <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse" />
                                        </div>
                                    )}
                                </div>
                            </div>
                          );
                        })}
                    </div>
                </div>

                <CardFooter className="pt-3 border-t border-zinc-200 dark:border-white/5">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 text-center w-full font-medium">
                        已配置 {configs.length} 个源
                    </p>
                </CardFooter>
            </Card>

            {/* Right: Config Form */}
            <div className="lg:col-span-8 space-y-8">
                {selectedConfig ? (
                     <Card key={selectedConfig.id} className="glass-strong animate-in zoom-in-95 fade-in duration-300 border-zinc-200/50 dark:border-white/10 shadow-lg bg-white/50 dark:bg-black/20">
                        <CardHeader className="border-b border-zinc-200 dark:border-white/5 pb-6">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="min-w-0 flex-1">
                                    <CardTitle className="text-xl md:text-2xl text-zinc-800 dark:text-zinc-100 truncate">编辑配置</CardTitle>
                                    <CardDescription className="text-zinc-500 dark:text-zinc-400 truncate">更新 {selectedConfig.name} 的连接详情</CardDescription>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 shrink-0">
                                     {activeId !== selectedConfig.id ? (
                                        <Button size="sm" variant="secondary" onClick={() => handleActivate(selectedConfig.id)} className="h-8 md:h-9 hover:bg-zinc-200 dark:hover:bg-white/10 text-[10px] md:text-xs">
                                            <Check className="w-3.5 h-3.5 mr-1.5" /> 设为激活
                                        </Button>
                                     ) : (
                                         <Button size="sm" variant="default" disabled className="h-8 md:h-9 bg-green-100 text-green-700 dark:bg-green-600/20 dark:text-green-500 opacity-100 text-[10px] md:text-xs">
                                            <Check className="w-3.5 h-3.5 mr-1.5" /> 当前使用中
                                        </Button>
                                     )}
                                     
                                     <Button 
                                        size="sm" 
                                        variant="outline"
                                        onClick={() => syncFiles(selectedConfig.id)}
                                        disabled={syncing}
                                        className="h-8 md:h-9 hover:bg-zinc-100 dark:hover:bg-white/10 text-[10px] md:text-xs"
                                     >
                                        {syncing ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
                                        同步文件库
                                     </Button>
                                     
                                     <Button 
                                        size="sm" 
                                        variant="destructive" 
                                        onClick={() => handleDeleteConfig(selectedConfig.id)}
                                        disabled={configs.length <= 1 || activeId === selectedConfig.id}
                                        className="h-8 w-8 md:h-9 md:w-9 p-0"
                                     >
                                        <Trash2 className="w-3.5 h-3.5" />
                                     </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6 pt-6 bg-white/50 dark:bg-transparent">
                            {/* Alias */}
                            <div className="space-y-2">
                                <Label className="text-zinc-700 dark:text-zinc-300 font-semibold text-xs uppercase tracking-wider ml-1">配置名称 (别名)</Label>
                                <Input 
                                    value={selectedConfig.name} 
                                    onChange={(e) => updateSelectedConfig({ name: e.target.value })}
                                    placeholder="例如：生产环境 MinIO"
                                    className="h-11 font-medium border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950/30 focus-visible:ring-primary shadow-sm"
                                />
                            </div>
                            
                            <div className="h-px bg-zinc-200 dark:bg-white/5 my-6" />

                            {/* Server & Port */}
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                                <div className="md:col-span-8 space-y-2">
                                    <Label className="text-zinc-700 dark:text-zinc-300 font-semibold text-xs uppercase tracking-wider ml-1">服务器地址 (Endpoint)</Label>
                                    <Input 
                                        value={selectedConfig.endpoint} 
                                        onChange={(e) => updateSelectedConfig({ endpoint: e.target.value })}
                                        placeholder="minio.example.com"
                                        className="h-11 border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950/30 focus-visible:ring-primary shadow-sm"
                                    />
                                </div>
                                <div className="md:col-span-4 space-y-2">
                                    <Label className="text-zinc-700 dark:text-zinc-300 font-semibold text-xs uppercase tracking-wider ml-1">端口 (Port)</Label>
                                    <Input 
                                        type="number"
                                        value={selectedConfig.port}
                                        onChange={(e) => updateSelectedConfig({ port: parseInt(e.target.value) || 9000 })}
                                        placeholder="9000"
                                        className="h-11 border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950/30 focus-visible:ring-primary shadow-sm"
                                    />
                                </div>
                            </div>

                            {/* Keys */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <Label className="text-zinc-700 dark:text-zinc-300 font-semibold text-xs uppercase tracking-wider ml-1">Access Key</Label>
                                    <Input 
                                        value={selectedConfig.accessKey} 
                                        onChange={(e) => updateSelectedConfig({ accessKey: e.target.value })}
                                        placeholder="Access Key"
                                        className="h-11 border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950/30 focus-visible:ring-primary shadow-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-zinc-700 dark:text-zinc-300 font-semibold text-xs uppercase tracking-wider ml-1">Secret Key</Label>
                                    <Input 
                                        type="password"
                                        value={selectedConfig.secretKey} 
                                        onChange={(e) => updateSelectedConfig({ secretKey: e.target.value })}
                                        placeholder="Secret Key"
                                        className="h-11 border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950/30 focus-visible:ring-primary shadow-sm"
                                    />
                                </div>
                            </div>

                            {/* Bucket & Region */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <Label className="text-zinc-700 dark:text-zinc-300 font-semibold text-xs uppercase tracking-wider ml-1">Bucket 名称</Label>
                                    <Input 
                                        value={selectedConfig.bucket} 
                                        onChange={(e) => updateSelectedConfig({ bucket: e.target.value })}
                                        placeholder="bucket-name"
                                        className="h-11 border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950/30 focus-visible:ring-primary shadow-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-zinc-700 dark:text-zinc-300 font-semibold text-xs uppercase tracking-wider ml-1">区域 (Region / 可选)</Label>
                                    <Input 
                                        value={selectedConfig.region || ''} 
                                        onChange={(e) => updateSelectedConfig({ region: e.target.value })}
                                        placeholder="us-east-1"
                                        className="h-11 border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950/30 focus-visible:ring-primary shadow-sm"
                                    />
                                </div>
                            </div>

                            <div className="h-px bg-zinc-200 dark:bg-white/5 my-6" />
                            
                            {/* Advanced Settings */}
                            <div className="space-y-6">
                                <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500 ml-1">高级配置选项</h3>
                                
                                <div className="space-y-2">
                                    <Label className="text-zinc-700 dark:text-zinc-300 font-semibold text-xs uppercase tracking-wider ml-1">自定义访问域名 (可选)</Label>
                                    <Input 
                                        value={selectedConfig.customDomain || ''} 
                                        onChange={(e) => updateSelectedConfig({ customDomain: e.target.value })}
                                        placeholder="https://img.example.com"
                                        className="h-11 border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950/30 focus-visible:ring-primary shadow-sm"
                                    />
                                    <p className="text-[10px] text-muted-foreground ml-1">生成的链接将优先使用此域名 (适用于 CDN 或反向代理)。</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div className="space-y-2">
                                        <Label className="text-zinc-700 dark:text-zinc-300 font-semibold text-xs uppercase tracking-wider ml-1">对象存放目录 (可选)</Label>
                                        <Input 
                                            value={selectedConfig.baseDir || ''} 
                                            onChange={(e) => updateSelectedConfig({ baseDir: e.target.value })}
                                            placeholder="uploads"
                                            className="h-11 border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950/30 focus-visible:ring-primary shadow-sm"
                                        />
                                    </div>
                                    <div className="flex flex-col justify-end">
                                        <label className="flex items-center space-x-3 cursor-pointer group p-3 rounded-2xl border border-zinc-200 dark:border-white/5 hover:bg-zinc-100 dark:hover:bg-white/10 transition-all bg-white dark:bg-zinc-950/20 h-11 shadow-sm">
                                            <div className="relative flex items-center justify-center shrink-0">
                                                <input
                                                    type="checkbox"
                                                    id="autoArchive"
                                                    checked={selectedConfig.autoArchive || false}
                                                    onChange={(e) => updateSelectedConfig({ autoArchive: e.target.checked })}
                                                    className="peer appearance-none w-5 h-5 rounded-full border border-zinc-300 dark:border-white/20 bg-white dark:bg-white/5 checked:bg-primary checked:border-primary transition-all shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] cursor-pointer"
                                                />
                                                <Check className="absolute w-3 h-3 text-white pointer-events-none opacity-0 peer-checked:opacity-100 transition-all scale-50 peer-checked:scale-100 stroke-[3px]" />
                                            </div>
                                            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-200 select-none">开启日期自动归档</span>
                                        </label>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div className="space-y-3">
                                        <Label className="text-zinc-700 dark:text-zinc-300 font-semibold text-xs uppercase tracking-wider ml-1 flex items-center gap-2">
                                          同名文件冲突策略
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              选择当上传的文件在存储桶中已存在时的操作
                                            </TooltipContent>
                                          </Tooltip>
                                        </Label>
                                        
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <Button 
                                              variant="outline" 
                                              className="w-full justify-between border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950/30 h-11 px-3 font-normal shadow-sm"
                                            >
                                              <span className="text-sm">
                                                {selectedConfig.duplicateHandling === 'skip' && '跳过 (Skip)'}
                                                {selectedConfig.duplicateHandling === 'overwrite' && '覆盖 (Overwrite)'}
                                                {selectedConfig.duplicateHandling === 'keep-both' && '保留两者 (Keep Both)'}
                                              </span>
                                              <ChevronDown className="w-4 h-4 opacity-50" />
                                            </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width] glass-card">
                                            <DropdownMenuRadioGroup 
                                              value={selectedConfig.duplicateHandling} 
                                              onValueChange={(val) => updateSelectedConfig({ duplicateHandling: val as 'skip' | 'overwrite' | 'keep-both' })}
                                            >
                                              <DropdownMenuRadioItem value="skip" className="cursor-pointer">跳过 (Skip)</DropdownMenuRadioItem>
                                              <DropdownMenuRadioItem value="overwrite" className="cursor-pointer">覆盖 (Overwrite)</DropdownMenuRadioItem>
                                              <DropdownMenuRadioItem value="keep-both" className="cursor-pointer">保留两者 (Keep Both)</DropdownMenuRadioItem>
                                            </DropdownMenuRadioGroup>
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>

                                    <div className="flex flex-col justify-end">
                                        <label className="flex items-center space-x-3 cursor-pointer group p-3 rounded-2xl border border-zinc-200 dark:border-white/5 hover:bg-zinc-100 dark:hover:bg-white/10 transition-all bg-white dark:bg-zinc-950/20 h-11 shadow-sm">
                                            <div className="relative flex items-center justify-center shrink-0">
                                                <input
                                                    type="checkbox"
                                                    id="useSSL"
                                                    checked={selectedConfig.useSSL}
                                                    onChange={(e) => updateSelectedConfig({ useSSL: e.target.checked })}
                                                    className="peer appearance-none w-5 h-5 rounded-full border border-zinc-300 dark:border-white/20 bg-white dark:bg-white/5 checked:bg-primary checked:border-primary transition-all shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] cursor-pointer"
                                                />
                                                <Check className="absolute w-3 h-3 text-white pointer-events-none opacity-0 peer-checked:opacity-100 transition-all scale-50 peer-checked:scale-100 stroke-[3px]" />
                                            </div>
                                            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-200 select-none">启用 SSL 安全连接</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4">
                                <Button 
                                    variant="outline" 
                                    className="w-full h-11 bg-white dark:bg-white/10 border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/20 active:scale-[0.99] transition-all font-bold shadow-sm"
                                    onClick={() => testConnection('minio')}
                                    disabled={testing === 'minio'}
                                >
                                    {testing === 'minio' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                    测试 MinIO 连接有效性
                                </Button>
                            </div>
                        </CardContent>
                     </Card>
                ) : (
                    <div className="h-full min-h-[400px] flex items-center justify-center p-12 border border-dashed border-zinc-300 dark:border-white/10 rounded-2xl bg-zinc-50/50 dark:bg-white/5 backdrop-blur-sm">
                        <div className="text-center text-muted-foreground">
                            <Server className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p className="font-medium">尚未选择任何配置源</p>
                            <Button variant="link" onClick={handleCreateConfig} className="text-primary mt-2">点击新建配置源</Button>
                        </div>
                    </div>
                )}

                {/* Shortlink Section */}
                <Card className="glass-strong border-zinc-200/50 dark:border-white/10 shadow-lg bg-white/50 dark:bg-black/20">
                    <CardHeader className="border-b border-zinc-200 dark:border-white/5 pb-5">
                        <CardTitle className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">短链服务集成</CardTitle>
                        <CardDescription className="text-zinc-500 dark:text-zinc-400">外部短链生成服务配置 (全局生效)</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5 pt-6">
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="space-y-2">
                                <Label className="text-zinc-700 dark:text-zinc-300 font-semibold text-xs uppercase tracking-wider ml-1">API 接口地址</Label>
                                <Input
                                    value={shortlinkConfig.apiUrl}
                                    onChange={(e) => setShortlinkConfig({ ...shortlinkConfig, apiUrl: e.target.value })}
                                    placeholder="https://short.link/api"
                                    className="h-11 border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950/30 focus-visible:ring-primary shadow-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-zinc-700 dark:text-zinc-300 font-semibold text-xs uppercase tracking-wider ml-1">鉴权 API Key</Label>
                                <Input
                                    type="password"
                                    value={shortlinkConfig.apiKey}
                                    onChange={(e) => setShortlinkConfig({ ...shortlinkConfig, apiKey: e.target.value })}
                                    placeholder="API Key"
                                    className="h-11 border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950/30 focus-visible:ring-primary shadow-sm"
                                />
                            </div>
                         </div>
                         
                         <div className="space-y-2">
                             <Label className="text-zinc-700 dark:text-zinc-300 font-semibold text-xs uppercase tracking-wider ml-1">链接有效期 (小时)</Label>
                             <Input
                                 type="number"
                                 min="0"
                                 value={shortlinkConfig.expiresIn || 0}
                                 onChange={(e) => setShortlinkConfig({ ...shortlinkConfig, expiresIn: parseInt(e.target.value) || 0 })}
                                 placeholder="0"
                                 className="h-11 border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950/30 focus-visible:ring-primary shadow-sm"
                             />
                             <p className="text-[10px] text-muted-foreground ml-1">设置为 0 表示永久有效。</p>
                         </div>
                         
                           <div className="space-y-4 pt-4 border-t border-zinc-200 dark:border-white/5">
                               <label className="flex items-center space-x-3 cursor-pointer group p-3 rounded-2xl border border-zinc-200 dark:border-white/5 hover:bg-zinc-100 dark:hover:bg-white/10 transition-all bg-white dark:bg-zinc-950/20 h-11 shadow-sm w-full">
                                   <div className="relative flex items-center justify-center shrink-0">
                                       <input
                                           type="checkbox"
                                           id="slAuto"
                                           checked={shortlinkConfig.autoGenerate}
                                           onChange={(e) => setShortlinkConfig({ ...shortlinkConfig, autoGenerate: e.target.checked })}
                                           className="peer appearance-none w-5 h-5 rounded-full border border-zinc-300 dark:border-white/20 bg-white dark:bg-white/5 checked:bg-primary checked:border-primary transition-all shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] cursor-pointer"
                                       />
                                       <Check className="absolute w-3 h-3 text-white pointer-events-none opacity-0 peer-checked:opacity-100 transition-all scale-50 peer-checked:scale-100 stroke-[3px]" />
                                   </div>
                                   <span className="text-xs font-bold text-zinc-700 dark:text-zinc-200 select-none">上传成功后自动生成短链</span>
                               </label>

                               <Button 
                                 variant="outline" 
                                 onClick={() => testConnection('shortlink')}
                                 disabled={testing === 'shortlink'}
                                 className="w-full h-11 bg-white dark:bg-white/10 border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/20 active:scale-[0.99] transition-all font-bold shadow-sm"
                              >
                                 {testing === 'shortlink' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                 测试短链服务连接有效性
                             </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
        
        <ConfirmDialog
            open={syncDialog.open}
            onOpenChange={(open) => !open && setSyncDialog({ open: false, configId: '' })}
            title="同步文件库"
            description="确定要扫描并同步此配置的所有文件吗？\n\n此操作将:\n• 扫描 MinIO 存储桶中的所有文件\n• 自动识别文件类型并生成缩略图\n• 批量导入到数据库\n• 跳过已存在的文件\n\n⚠️ 这可能需要一些时间,特别是如果存储桶中有大量文件。"
            confirmText="开始同步"
            cancelText="取消"
            onConfirm={confirmSync}
        />
      </div>
    </div>
  );
}
