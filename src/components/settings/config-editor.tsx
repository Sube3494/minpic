import { MinioConfigItem } from '@/types/config';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent, 
  DropdownMenuRadioGroup, 
  DropdownMenuRadioItem 
} from '@/components/ui/dropdown-menu';
import { Check, Trash2, RefreshCw, Loader2, Info, ChevronDown, Server } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ConfigEditorProps {
  config: MinioConfigItem;
  isActive: boolean;
  canDelete: boolean;
  isSyncing: boolean;
  isTesting: boolean;
  onUpdate: (updates: Partial<MinioConfigItem>) => void;
  onActivate: (id: string) => void;
  onDelete: (id: string) => void;
  onSync: (id: string) => void;
  onTest: () => void;
}

export function ConfigEditor({ 
  config, isActive, canDelete, isSyncing, isTesting,
  onUpdate, onActivate, onDelete, onSync, onTest 
}: ConfigEditorProps) {
  
  if (!config) {
    return (
      <motion.div 
        key="empty"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="h-full min-h-[400px] flex items-center justify-center p-12 border border-dashed border-zinc-300 dark:border-white/10 rounded-2xl bg-zinc-50/50 dark:bg-white/5 backdrop-blur-sm"
      >
        <div className="text-center text-muted-foreground">
          <Server className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="font-medium">尚未选择任何配置源</p>
        </div>
      </motion.div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={config.id}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.2 }}
      >
    <Card className="glass-strong border-zinc-200/50 dark:border-white/10 shadow-lg bg-white/50 dark:bg-black/20">
      <CardHeader className="border-b border-zinc-200 dark:border-white/5 pb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-xl md:text-2xl text-zinc-800 dark:text-zinc-100 truncate">编辑配置</CardTitle>
            <CardDescription className="text-zinc-500 dark:text-zinc-400 truncate">更新 {config.name} 的连接详情</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {!isActive ? (
              <Button size="sm" variant="secondary" onClick={() => onActivate(config.id)} className="h-8 md:h-9 hover:bg-zinc-200 dark:hover:bg-white/10 text-[10px] md:text-xs">
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
              onClick={() => onSync(config.id)}
              disabled={isSyncing}
              className="h-8 md:h-9 hover:bg-zinc-100 dark:hover:bg-white/10 text-[10px] md:text-xs"
            >
              {isSyncing ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
              同步文件库
            </Button>
             
            <Button 
              size="sm" 
              variant="destructive" 
              onClick={() => onDelete(config.id)}
              disabled={!canDelete || isActive}
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
            value={config.name} 
            onChange={(e) => onUpdate({ name: e.target.value })}
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
              value={config.endpoint} 
              onChange={(e) => onUpdate({ endpoint: e.target.value })}
              placeholder="minio.example.com"
              className="h-11 border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950/30 focus-visible:ring-primary shadow-sm"
            />
          </div>
          <div className="md:col-span-4 space-y-2">
            <Label className="text-zinc-700 dark:text-zinc-300 font-semibold text-xs uppercase tracking-wider ml-1">端口 (Port)</Label>
            <Input 
              type="number"
              value={config.port}
              onChange={(e) => onUpdate({ port: parseInt(e.target.value) || 9000 })}
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
              value={config.accessKey} 
              onChange={(e) => onUpdate({ accessKey: e.target.value })}
              placeholder="Access Key"
              className="h-11 border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950/30 focus-visible:ring-primary shadow-sm"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-zinc-700 dark:text-zinc-300 font-semibold text-xs uppercase tracking-wider ml-1">Secret Key</Label>
            <Input 
              type="password"
              value={config.secretKey} 
              onChange={(e) => onUpdate({ secretKey: e.target.value })}
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
              value={config.bucket} 
              onChange={(e) => onUpdate({ bucket: e.target.value })}
              placeholder="bucket-name"
              className="h-11 border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950/30 focus-visible:ring-primary shadow-sm"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-zinc-700 dark:text-zinc-300 font-semibold text-xs uppercase tracking-wider ml-1">区域 (Region / 可选)</Label>
            <Input 
              value={config.region || ''} 
              onChange={(e) => onUpdate({ region: e.target.value })}
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
              value={config.customDomain || ''} 
              onChange={(e) => onUpdate({ customDomain: e.target.value })}
              placeholder="https://img.example.com"
              className="h-11 border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950/30 focus-visible:ring-primary shadow-sm"
            />
            <p className="text-[10px] text-muted-foreground ml-1">生成的链接将优先使用此域名 (适用于 CDN 或反向代理)。</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label className="text-zinc-700 dark:text-zinc-300 font-semibold text-xs uppercase tracking-wider ml-1">对象存放目录 (可选)</Label>
              <Input 
                value={config.baseDir || ''} 
                onChange={(e) => onUpdate({ baseDir: e.target.value })}
                placeholder="uploads"
                className="h-11 border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950/30 focus-visible:ring-primary shadow-sm"
              />
            </div>
            <div className="flex flex-col justify-end">
              <label className="flex items-center space-x-3 cursor-pointer group p-3 rounded-2xl border border-zinc-200 dark:border-white/5 hover:bg-zinc-100 dark:hover:bg-white/10 transition-all bg-white dark:bg-zinc-950/20 h-11 shadow-sm">
                <div className="relative flex items-center justify-center shrink-0">
                  <input
                    type="checkbox"
                    checked={config.autoArchive || false}
                    onChange={(e) => onUpdate({ autoArchive: e.target.checked })}
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
                      {config.duplicateHandling === 'skip' && '跳过 (Skip)'}
                      {config.duplicateHandling === 'overwrite' && '覆盖 (Overwrite)'}
                      {config.duplicateHandling === 'keep-both' && '保留两者 (Keep Both)'}
                    </span>
                    <ChevronDown className="w-4 h-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width] glass-card">
                  <DropdownMenuRadioGroup 
                    value={config.duplicateHandling || 'keep-both'} 
                    onValueChange={(val) => onUpdate({ duplicateHandling: val as 'skip' | 'overwrite' | 'keep-both' })}
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
                    checked={config.useSSL}
                    onChange={(e) => onUpdate({ useSSL: e.target.checked })}
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
            onClick={onTest}
            disabled={isTesting}
          >
            {isTesting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            测试 MinIO 连接有效性
          </Button>
        </div>
      </CardContent>
    </Card>
      </motion.div>
    </AnimatePresence>
  );
}
