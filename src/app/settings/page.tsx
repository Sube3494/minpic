'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Save, TestTube, Loader2, Plus, Trash2, Check, Server } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

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
  });

  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState<'minio' | 'shortlink' | null>(null);

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

  return (
    <div className="min-h-screen p-6 md:p-12 pb-32">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight text-glow">
              <span className="bg-clip-text text-transparent bg-linear-to-r from-zinc-900 to-zinc-500 dark:from-white dark:to-white/40">
                系统设置
              </span>
            </h1>
            <p className="text-muted-foreground text-lg">
              管理多图床源配置与外部服务集成
            </p>
          </div>
          <div className="flex gap-3">
             <Button 
                onClick={saveAll} 
                disabled={loading} 
                variant="outline"
                className="h-10 border-zinc-200 dark:border-white/10 bg-white/50 dark:bg-white/5 hover:bg-zinc-100 dark:hover:bg-white/10 backdrop-blur-md text-zinc-700 dark:text-zinc-200"
             >
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                保存所有更改
              </Button>
             <Button variant="outline" className="h-10 border-zinc-200 dark:border-white/10 bg-white/50 dark:bg-white/5 hover:bg-zinc-100 dark:hover:bg-white/10 backdrop-blur-md" asChild>
                <Link href="/">返回首页</Link>
             </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Sidebar: Config List */}
            <Card className="lg:col-span-4 glass-strong overflow-hidden flex flex-col h-[600px] border-zinc-200/50 dark:border-white/10 shadow-lg">
                <CardHeader className="pb-3 border-b border-zinc-200 dark:border-white/5">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">配置源列表</CardTitle>
                        <Button size="sm" variant="ghost" onClick={handleCreateConfig} className="hover:bg-zinc-200/50 dark:hover:bg-white/10">
                            <Plus className="w-4 h-4" />
                        </Button>
                    </div>
                    <CardDescription className="text-zinc-500 dark:text-zinc-400">选择一个源进行编辑</CardDescription>
                </CardHeader>

                <div className="flex-1 overflow-y-auto p-3 custom-scrollbar bg-white/30 dark:bg-transparent">
                    <div className="space-y-2">
                        {configs.map((config, index) => (
                            <div 
                                key={config.id}
                                style={{ animationDelay: `${index * 50}ms` }}
                                onClick={() => setSelectedId(config.id)}
                                className={cn(
                                    "p-3 rounded-lg border cursor-pointer transition-all duration-200 flex items-center justify-between group relative overflow-hidden animate-in slide-in-from-bottom-2 fade-in fill-mode-backwards",
                                    selectedId === config.id 
                                        ? "border-primary/50 bg-primary/10 ring-1 ring-primary/20 shadow-sm" 
                                        : "border-transparent bg-white/50 dark:bg-white/5 hover:bg-zinc-100 dark:hover:bg-white/10 hover:border-zinc-200 dark:hover:border-white/10 active:scale-[0.98]"
                                )}
                            >
                                <div className="flex items-center gap-3 overflow-hidden z-10">
                                    <div className={cn(
                                        "w-2 h-2 rounded-full shrink-0 transition-colors duration-300", 
                                        activeId === config.id 
                                            ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" 
                                            : "bg-zinc-400 dark:bg-zinc-600 group-hover:bg-zinc-500"
                                    )} />
                                    <div className="truncate">
                                        <div className={cn("font-medium truncate transition-colors text-sm", selectedId === config.id ? "text-primary font-semibold" : "text-zinc-700 dark:text-zinc-200")}>
                                            {config.name}
                                        </div>
                                        <div className={cn("text-xs truncate transition-opacity", selectedId === config.id ? "text-primary/70" : "text-zinc-500 dark:text-zinc-400 opacity-70 group-hover:opacity-100")}>
                                            {config.endpoint}
                                        </div>
                                    </div>
                                </div>
                                {activeId === config.id && (
                                    <span className="bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-500 border border-green-200 dark:border-green-500/20 px-1.5 rounded text-[10px] h-5 inline-flex items-center ml-2 shrink-0 font-medium z-10 animate-in zoom-in spin-in-3">
                                        已激活
                                    </span>
                                )}
                            </div>
                        ))}
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
                     <Card key={selectedConfig.id} className="glass-strong animate-in zoom-in-95 fade-in duration-300 border-zinc-200/50 dark:border-white/10 shadow-lg">
                        <CardHeader className="border-b border-zinc-200 dark:border-white/5 pb-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-zinc-800 dark:text-zinc-100">编辑配置</CardTitle>
                                    <CardDescription className="text-zinc-500 dark:text-zinc-400">更新 {selectedConfig.name} 的连接详情</CardDescription>
                                </div>
                                <div className="flex gap-2">
                                     {activeId !== selectedConfig.id ? (
                                        <Button size="sm" variant="secondary" onClick={() => handleActivate(selectedConfig.id)} className="hover:bg-zinc-200 dark:hover:bg-white/10">
                                            <Check className="w-4 h-4 mr-2" /> 设为激活
                                        </Button>
                                     ) : (
                                         <Button size="sm" variant="default" disabled className="bg-green-100 text-green-700 dark:bg-green-600/20 dark:text-green-500 opacity-100">
                                            <Check className="w-4 h-4 mr-2" /> 当前使用中
                                        </Button>
                                     )}
                                     
                                     <Button 
                                        size="sm" 
                                        variant="destructive" 
                                        onClick={() => handleDeleteConfig(selectedConfig.id)}
                                        disabled={configs.length <= 1 || activeId === selectedConfig.id}
                                     >
                                        <Trash2 className="w-4 h-4" />
                                     </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6 pt-6 bg-white/50 dark:bg-transparent">
                            <div className="space-y-2">
                                <Label className="text-zinc-700 dark:text-zinc-300">配置名称 (别名)</Label>
                                <Input 
                                    value={selectedConfig.name} 
                                    onChange={(e) => updateSelectedConfig({ name: e.target.value })}
                                    placeholder="例如：生产环境 MinIO"
                                    className="font-medium border-zinc-300 dark:border-white/10 bg-white dark:bg-white/5 focus-visible:ring-primary"
                                />
                            </div>
                            
                            <div className="h-px bg-zinc-200 dark:bg-white/5 my-6" />

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-zinc-700 dark:text-zinc-300">服务器地址 (Endpoint)</Label>
                                    <Input 
                                        value={selectedConfig.endpoint} 
                                        onChange={(e) => updateSelectedConfig({ endpoint: e.target.value })}
                                        placeholder="minio.example.com"
                                        className="border-zinc-300 dark:border-white/10 bg-white dark:bg-white/5"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-zinc-700 dark:text-zinc-300">端口 (Port)</Label>
                                    <Input 
                                        type="number"
                                        value={selectedConfig.port}
                                        onChange={(e) => updateSelectedConfig({ port: parseInt(e.target.value) })}
                                        placeholder="9000"
                                        className="border-zinc-300 dark:border-white/10 bg-white dark:bg-white/5"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-zinc-700 dark:text-zinc-300">Access Key</Label>
                                    <Input 
                                        value={selectedConfig.accessKey} 
                                        onChange={(e) => updateSelectedConfig({ accessKey: e.target.value })}
                                        placeholder="Access Key"
                                        className="border-zinc-300 dark:border-white/10 bg-white dark:bg-white/5"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-zinc-700 dark:text-zinc-300">Secret Key</Label>
                                    <Input 
                                        type="password"
                                        value={selectedConfig.secretKey} 
                                        onChange={(e) => updateSelectedConfig({ secretKey: e.target.value })}
                                        placeholder="Secret Key"
                                        className="border-zinc-300 dark:border-white/10 bg-white dark:bg-white/5"
                                    />
                                </div>
                            </div>

                             <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-zinc-700 dark:text-zinc-300">Bucket 名称</Label>
                                    <Input 
                                        value={selectedConfig.bucket} 
                                        onChange={(e) => updateSelectedConfig({ bucket: e.target.value })}
                                        placeholder="bucket-name"
                                        className="border-zinc-300 dark:border-white/10 bg-white dark:bg-white/5"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-zinc-700 dark:text-zinc-300">区域 (Region / 可选)</Label>
                                    <Input 
                                        value={selectedConfig.region || ''} 
                                        onChange={(e) => updateSelectedConfig({ region: e.target.value })}
                                        placeholder="us-east-1"
                                        className="border-zinc-300 dark:border-white/10 bg-white dark:bg-white/5"
                                    />
                                </div>
                            </div>

                            <div className="h-px bg-zinc-200 dark:bg-white/5 my-6" />
                            
                            {/* Advanced Settings */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-medium text-zinc-500 dark:text-muted-foreground">高级选项</h3>
                                
                                <div className="space-y-2">
                                    <Label className="text-zinc-700 dark:text-zinc-300">自定义域名 (可选)</Label>
                                    <Input 
                                        value={selectedConfig.customDomain || ''} 
                                        onChange={(e) => updateSelectedConfig({ customDomain: e.target.value })}
                                        placeholder="https://img.example.com"
                                        className="border-zinc-300 dark:border-white/10 bg-white dark:bg-white/5"
                                    />
                                    <p className="text-xs text-muted-foreground">生成的链接将使用此域名 (通常用于 CDN)。</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4 items-end">
                                    <div className="space-y-2">
                                        <Label className="text-zinc-700 dark:text-zinc-300">存放目录 (可选)</Label>
                                        <Input 
                                            value={selectedConfig.baseDir || ''} 
                                            onChange={(e) => updateSelectedConfig({ baseDir: e.target.value })}
                                            placeholder="uploads"
                                            className="border-zinc-300 dark:border-white/10 bg-white dark:bg-white/5"
                                        />
                                    </div>
                                    <div className="flex items-center space-x-2 h-10 pb-2">
                                        <label className="flex items-center space-x-2 cursor-pointer group">
                                            <div className="relative flex items-center justify-center">
                                                <input
                                                    type="checkbox"
                                                    id="autoArchive"
                                                    checked={selectedConfig.autoArchive || false}
                                                    onChange={(e) => updateSelectedConfig({ autoArchive: e.target.checked })}
                                                    className="peer appearance-none w-5 h-5 rounded-full border border-zinc-300 dark:border-white/20 bg-white dark:bg-white/5 checked:bg-primary checked:border-primary transition-all shadow-sm cursor-pointer"
                                                />
                                                <Check className="absolute w-3.5 h-3.5 text-white pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity stroke-[3px]" />
                                            </div>
                                            <span className="text-zinc-700 dark:text-zinc-300 select-none">按日期自动归档 ({'{'}YYYY{'}'}/{'{'}MM{'}'})</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                             <div className="flex items-center space-x-2 pt-2">
                                <label className="flex items-center space-x-2 cursor-pointer group">
                                    <div className="relative flex items-center justify-center">
                                        <input
                                            type="checkbox"
                                            id="useSSL"
                                            checked={selectedConfig.useSSL}
                                            onChange={(e) => updateSelectedConfig({ useSSL: e.target.checked })}
                                            className="peer appearance-none w-5 h-5 rounded-full border border-zinc-300 dark:border-white/20 bg-white dark:bg-white/5 checked:bg-primary checked:border-primary transition-all shadow-sm cursor-pointer"
                                        />
                                        <Check className="absolute w-3.5 h-3.5 text-white pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity stroke-[3px]" />
                                    </div>
                                    <span className="text-zinc-700 dark:text-zinc-300 select-none">启用 SSL (HTTPS)</span>
                                </label>
                            </div>

                            <div className="pt-4">
                                <Button 
                                    variant="outline" 
                                    className="w-full bg-white dark:bg-white/5 border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/10"
                                    onClick={() => testConnection('minio')}
                                    disabled={testing === 'minio'}
                                >
                                    {testing === 'minio' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <TestTube className="w-4 h-4 mr-2" />}
                                    测试 MinIO 连接
                                </Button>
                            </div>
                        </CardContent>
                     </Card>
                ) : (
                    <div className="h-full flex items-center justify-center p-12 border border-dashed border-zinc-300 dark:border-white/10 rounded-lg bg-zinc-50/50 dark:bg-white/5">
                        <div className="text-center text-muted-foreground">
                            <Server className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p>未选择配置。</p>
                            <Button variant="link" onClick={handleCreateConfig}>点击新建配置</Button>
                        </div>
                    </div>
                )}

                {/* Shortlink Section */}
                <Card className="glass-strong border-zinc-200/50 dark:border-white/10 shadow-lg bg-white/50 dark:bg-black/20">
                    <CardHeader className="border-b border-zinc-200 dark:border-white/5">
                        <CardTitle className="text-zinc-800 dark:text-zinc-100">短链服务</CardTitle>
                        <CardDescription className="text-zinc-500 dark:text-zinc-400">外部短链生成服务集成 (全局)</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-6">
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-zinc-700 dark:text-zinc-300">API 地址</Label>
                                <Input
                                    value={shortlinkConfig.apiUrl}
                                    onChange={(e) => setShortlinkConfig({ ...shortlinkConfig, apiUrl: e.target.value })}
                                    placeholder="https://short.link/api"
                                    className="border-zinc-300 dark:border-white/10 bg-white dark:bg-white/5"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-zinc-700 dark:text-zinc-300">API Key</Label>
                                <Input
                                    type="password"
                                    value={shortlinkConfig.apiKey}
                                    onChange={(e) => setShortlinkConfig({ ...shortlinkConfig, apiKey: e.target.value })}
                                    placeholder="API Key"
                                    className="border-zinc-300 dark:border-white/10 bg-white dark:bg-white/5"
                                />
                            </div>
                        </div>
                        <div className="flex items-center justify-between pt-2">
                             <div className="flex items-center space-x-2">
                                <label className="flex items-center space-x-2 cursor-pointer group">
                                    <div className="relative flex items-center justify-center">
                                        <input
                                            type="checkbox"
                                            id="slAuto"
                                            checked={shortlinkConfig.autoGenerate}
                                            onChange={(e) => setShortlinkConfig({ ...shortlinkConfig, autoGenerate: e.target.checked })}
                                            className="peer appearance-none w-5 h-5 rounded-full border border-zinc-300 dark:border-white/20 bg-white dark:bg-white/5 checked:bg-primary checked:border-primary transition-all shadow-sm cursor-pointer"
                                        />
                                        <Check className="absolute w-3.5 h-3.5 text-white pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity stroke-[3px]" />
                                    </div>
                                    <span className="text-zinc-700 dark:text-zinc-300 select-none">上传完成后自动生成短链</span>
                                </label>
                            </div>
                             <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => testConnection('shortlink')}
                                disabled={testing === 'shortlink'}
                                className="text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white"
                            >
                                {testing === 'shortlink' ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <TestTube className="w-3 h-3 mr-2" />}
                                测试服务
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
      </div>
    </div>
  );
}
