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
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Check, RefreshCw, Loader2, Info, ChevronDown, Server, PlugZap, Settings2, Save } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

import { motion, AnimatePresence } from 'framer-motion';

interface ConfigEditorProps {
  config: MinioConfigItem;
  isSyncing: boolean;
  isTesting: boolean;
  isSaving: boolean;
  canEdit?: boolean;
  onUpdate: (updates: Partial<MinioConfigItem>) => void;
  onSync: (id: string) => void;
  onTest: () => void;
  onSave: () => void;
}

export function ConfigEditor({ 
  config, isSyncing, isTesting, isSaving, canEdit = true,
  onUpdate, onSync, onTest, onSave
}: ConfigEditorProps) {
  const [isAdvancedExpanded, setIsAdvancedExpanded] = useState(false);
  const advancedRef = useRef<HTMLDivElement>(null);

  // Auto-scroll when advanced options expand
  useEffect(() => {
    if (isAdvancedExpanded && advancedRef.current) {
      // Use a slightly longer delay to ensure the animation has meaningful progress
      const timer = setTimeout(() => {
        advancedRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isAdvancedExpanded]);
  
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
        transition={{ 
          duration: 0.2
        }}
      >
    <Card className="glass-strong border-zinc-200/50 dark:border-white/10 shadow-lg bg-white/50 dark:bg-black/20">
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-xl md:text-2xl text-zinc-800 dark:text-zinc-100 truncate">
              {canEdit ? '编辑配置' : '查看配置'}
            </CardTitle>
            <CardDescription className="text-zinc-500 dark:text-zinc-400 truncate">
              {!canEdit ? '只读模式 (团队成员无编辑权限)' : `更新 ${config.name} 的连接详情`}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="inline-block">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => onSync(config.id)}
                    disabled={isSyncing || config.status !== 'success'}
                    className={cn(
                      "h-9 transition-all text-xs",
                      config.status === 'success' 
                        ? "hover:bg-zinc-100 dark:hover:bg-white/10" 
                        : "opacity-50 cursor-not-allowed bg-zinc-100/50 dark:bg-white/5"
                    )}
                  >
                    {isSyncing ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1.5" />}
                    同步文件库
                  </Button>
                </div>
              </TooltipTrigger>
              {config.status !== 'success' && (
                <TooltipContent>
                  请先测试连接成功后再同步
                </TooltipContent>
              )}
            </Tooltip>
             
            {canEdit && (
              <>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={onTest}
                  disabled={isTesting}
                  className="h-9 hover:bg-zinc-100 dark:hover:bg-white/10 text-xs"
                >
                  {isTesting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <PlugZap className="w-4 h-4 mr-1.5" />}
                  测试连接
                </Button>
                
                <Button 
                  size="sm"
                  onClick={() => onSave()}
                  disabled={isSaving}
                  className="h-9 border border-transparent bg-primary hover:bg-primary/90 text-primary-foreground text-xs"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
                  保存配置
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-2">
        {/* Alias */}
        <div className="space-y-2">
          <Label className="text-zinc-700 dark:text-zinc-300 font-semibold text-xs uppercase tracking-wider ml-1">配置名称 (别名) <span className="text-red-500">*</span></Label>
          <Input 
            value={config.name} 
            onChange={(e) => onUpdate({ name: e.target.value })}
            placeholder="例如：生产环境 MinIO"
            disabled={!canEdit}
            className="h-11 font-medium border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 focus-visible:ring-primary shadow-sm disabled:opacity-60"
          />
        </div>
        
        <div className="h-px bg-zinc-200 dark:bg-white/5 my-6" />

        {/* Server & Port & SSL */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          <div className="md:col-span-6 space-y-2">
            <Label className="text-zinc-700 dark:text-zinc-300 font-semibold text-xs uppercase tracking-wider ml-1">服务器地址 (Endpoint) <span className="text-red-500">*</span></Label>
            <Input 
              value={config.endpoint} 
              onChange={(e) => onUpdate({ endpoint: e.target.value })}
              placeholder="minio.example.com"
              disabled={!canEdit}
              className={`h-11 border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 focus-visible:ring-primary shadow-sm disabled:opacity-60 ${!canEdit ? 'blur-[6px] select-none pointer-events-none' : ''}`}
            />
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label className="text-zinc-700 dark:text-zinc-300 font-semibold text-xs uppercase tracking-wider ml-1">端口 (Port)</Label>
            <Input 
              type="number"
              value={config.port ?? ''}
              onChange={(e) => {
                const val = e.target.value;
                onUpdate({ port: val === '' ? undefined : (parseInt(val) || 9000) });
              }}
              placeholder="9000"
              disabled={!canEdit}
              onWheel={(e) => e.currentTarget.blur()}
              className={`h-11 border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 focus-visible:ring-primary shadow-sm no-spinner disabled:opacity-60 ${!canEdit ? 'blur-[6px] select-none pointer-events-none' : ''}`}
            />
          </div>
          <div className="md:col-span-4 space-y-2">
            <Label className="text-zinc-700 dark:text-zinc-300 font-semibold text-xs uppercase tracking-wider ml-1">安全连接 (SSL)</Label>
            <div className={`flex items-center justify-between px-3 h-11 rounded-md border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 shadow-sm ${!canEdit ? 'blur-[6px] select-none pointer-events-none' : ''}`}>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-zinc-700 dark:text-zinc-200">SSL / HTTPS</span>
                </div>
                <Switch
                  checked={config.useSSL}
                  onCheckedChange={(checked: boolean) => onUpdate({ useSSL: checked })}
                  disabled={!canEdit}
                  className="data-[state=checked]:bg-primary scale-90 disabled:opacity-60"
                />
            </div>
          </div>
        </div>

        {/* Keys */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-2">
            <Label className="text-zinc-700 dark:text-zinc-300 font-semibold text-xs uppercase tracking-wider ml-1">Access Key <span className="text-red-500">*</span></Label>
            <Input 
              value={config.accessKey} 
              onChange={(e) => onUpdate({ accessKey: e.target.value })}
              placeholder="Access Key"
              disabled={!canEdit}
              className={`h-11 border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 focus-visible:ring-primary shadow-sm disabled:opacity-60 ${!canEdit ? 'blur-[6px] select-none pointer-events-none' : ''}`}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-zinc-700 dark:text-zinc-300 font-semibold text-xs uppercase tracking-wider ml-1">Secret Key <span className="text-red-500">*</span></Label>
            <Input 
              type="password"
              value={config.secretKey} 
              onChange={(e) => onUpdate({ secretKey: e.target.value })}
              placeholder="Secret Key"
              disabled={!canEdit}
              className={`h-11 border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 focus-visible:ring-primary shadow-sm disabled:opacity-60 ${!canEdit ? 'blur-[6px] select-none pointer-events-none' : ''}`}
            />
          </div>
        </div>

        {/* Bucket & Region */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-2">
            <Label className="text-zinc-800 dark:text-zinc-200 font-semibold text-xs uppercase tracking-wider ml-1">Bucket 名称 <span className="text-red-500">*</span></Label>
            <Input 
              value={config.bucket} 
              onChange={(e) => onUpdate({ bucket: e.target.value })}
              placeholder="bucket-name"
              disabled={!canEdit}
              className={`h-11 border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 focus-visible:ring-primary shadow-sm disabled:opacity-60 ${!canEdit ? 'blur-[6px] select-none pointer-events-none' : ''}`}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-zinc-800 dark:text-zinc-200 font-semibold text-xs uppercase tracking-wider ml-1">区域 (Region / 可选)</Label>
            <Input 
              value={config.region || ''} 
              onChange={(e) => onUpdate({ region: e.target.value })}
              placeholder="us-east-1"
              disabled={!canEdit}
              className={`h-11 border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 focus-visible:ring-primary shadow-sm disabled:opacity-60 ${!canEdit ? 'blur-[6px] select-none pointer-events-none' : ''}`}
            />
          </div>
        </div>

        <div className="h-px bg-zinc-200 dark:bg-white/5 my-6" />
        
        {/* Advanced Settings */}
        <div className="space-y-4" ref={advancedRef}>
          <button 
            onClick={() => setIsAdvancedExpanded(!isAdvancedExpanded)}
            disabled={!canEdit}
            className="group flex items-center justify-between w-full p-1.5 rounded-xl hover:bg-zinc-100/50 dark:hover:bg-white/5 transition-all duration-300 border border-transparent hover:border-zinc-200/50 dark:hover:border-white/5 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-zinc-100 dark:bg-white/10 text-zinc-500 dark:text-zinc-400 group-hover:bg-primary/10 group-hover:text-primary transition-all duration-300">
                <Settings2 className="w-4 h-4" />
              </div>
              <div className="flex flex-col items-start">
                <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400 tracking-wide">高级配置</span>
                <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-medium tracking-tight">自定义域名、归档与策略</span>
              </div>
            </div>
            <div className="flex items-center gap-2 pr-1">
              <span className="text-[10px] font-bold text-zinc-400 group-hover:text-primary transition-colors">
                {isAdvancedExpanded ? '收起详情' : '展开选项'}
              </span>
              <div className="flex items-center justify-center w-5 h-5 rounded-full border border-zinc-200 dark:border-white/10 group-hover:border-primary/30 transition-colors">
                <motion.div
                  animate={{ rotate: isAdvancedExpanded ? 180 : 0 }}
                  transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                >
                  <ChevronDown className="w-3 h-3 text-zinc-400 group-hover:text-primary" />
                </motion.div>
              </div>
            </div>
          </button>
        </div>

        <div className="relative">
          <AnimatePresence initial={false}>
            {isAdvancedExpanded && (
              <motion.div
                key="advanced"
                initial="collapsed"
                animate="expanded"
                exit="collapsed"
                variants={{
                  expanded: { maxHeight: 2000, opacity: 1 },
                  collapsed: { maxHeight: 0, opacity: 0 }
                }}
                transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
                className="overflow-hidden"
              >
                <div className="space-y-8 pt-4 pb-2 px-1">
                  
                  {/* Access Settings Group */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 px-1">
                       <div className="h-3.5 w-1 rounded-full bg-primary" />
                       <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">访问设置</h4>
                    </div>

                    <div className="grid grid-cols-1 gap-5">
                        <div className="space-y-2">
                            <Label className="text-zinc-800 dark:text-zinc-200 font-semibold text-xs uppercase tracking-wider ml-1 flex items-center gap-2">
                            自定义访问域名 (可选)
                            <Tooltip>
                                <TooltipTrigger asChild>
                                <Info className="w-3.5 h-3.5 text-muted-foreground/70 hover:text-primary transition-colors cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent>
                                生成的链接将优先使用此域名 (适用于 CDN 或反向代理)
                                </TooltipContent>
                            </Tooltip>
                            </Label>
                            <Input 
                            value={config.customDomain || ''} 
                            onChange={(e) => onUpdate({ customDomain: e.target.value })}
                            placeholder="https://img.example.com"
                            disabled={!canEdit}
                            className={`h-11 border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 focus-visible:ring-primary shadow-sm disabled:opacity-60 ${!canEdit ? 'blur-[6px] select-none pointer-events-none' : ''}`}
                            />
                        </div>
                    </div>
                  </div>

                  {/* Storage Settings Group */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 px-1">
                       <div className="h-3.5 w-1 rounded-full bg-primary" />
                       <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">存储设置</h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Base Directory */}
                        <div className="space-y-2">
                        <Label className="text-zinc-800 dark:text-zinc-200 font-semibold text-xs uppercase tracking-wider ml-1 flex items-center gap-2">
                            对象存放目录 (可选)
                            <Tooltip>
                            <TooltipTrigger asChild>
                                <Info className="w-3.5 h-3.5 text-muted-foreground/70 hover:text-primary transition-colors cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                                指定文件上传到 MinIO 存储桶中的子目录
                            </TooltipContent>
                            </Tooltip>
                        </Label>
                        <Input 
                            value={config.baseDir || ''} 
                            onChange={(e) => onUpdate({ baseDir: e.target.value })}
                            placeholder="uploads"
                            disabled={!canEdit}
                            className={`h-11 border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 focus-visible:ring-primary shadow-sm disabled:opacity-60 ${!canEdit ? 'blur-[6px] select-none pointer-events-none' : ''}`}
                        />
                        </div>

                        {/* Archive Strategy */}
                        <div className="space-y-2">
                            <Label className="text-zinc-800 dark:text-zinc-200 font-semibold text-xs uppercase tracking-wider ml-1">归档设置</Label>
                            <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button 
                                variant="outline"
                                disabled={!canEdit}
                                className="w-full justify-between border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 h-11 px-3 font-normal shadow-sm group disabled:opacity-60"
                                >
                                <span className="text-sm text-zinc-700 dark:text-zinc-200">
                                    {config.archiveStrategy === 'none' && '不归档'}
                                    {config.archiveStrategy === 'year' && '按年归档 (YYYY)'}
                                    {config.archiveStrategy === 'month' && '按月归档 (YYYY/MM)'}
                                    {config.archiveStrategy === 'day' && '按日归档 (YYYY/MM/DD)'}
                                    {!config.archiveStrategy && '不归档'}
                                </span>
                                <ChevronDown className="w-4 h-4 text-zinc-400 transition-transform group-data-[state=open]:rotate-180" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent 
                                align="start" 
                                sideOffset={4}
                                style={{ width: 'var(--radix-dropdown-menu-trigger-width)' }}
                                className="border border-zinc-200/50 dark:border-white/10 p-1.5 shadow-2xl bg-white/80 dark:bg-white/5 backdrop-blur-2xl rounded-xl"
                            >
                                {[
                                { value: 'none', label: '不归档', desc: '文件直接存放在根目录或指定目录' },
                                { value: 'year', label: '按年归档', desc: '例如: 2023/filename.jpg' },
                                { value: 'month', label: '按月归档', desc: '例如: 2023/12/filename.jpg' },
                                { value: 'day', label: '按日归档', desc: '例如: 2023/12/26/filename.jpg' },
                                ].map((item) => (
                                <DropdownMenuItem 
                                    key={item.value}
                                    onClick={() => onUpdate({ archiveStrategy: item.value as 'none' | 'year' | 'month' | 'day' })}
                                    className="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer focus:bg-zinc-100 dark:focus:bg-white/10 transition-colors"
                                >
                                    <div className="flex flex-col flex-1">
                                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">{item.label}</span>
                                    <span className="text-[10px] text-zinc-500">{item.desc}</span>
                                    </div>
                                    {(config.archiveStrategy === item.value || (!config.archiveStrategy && item.value === 'none')) && <Check className="w-4 h-4 text-primary" />}
                                </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                        
                        {/* Expiration Days */}
                        <div className="space-y-2">
                        <Label className="text-zinc-800 dark:text-zinc-200 font-semibold text-xs uppercase tracking-wider ml-1 flex items-center gap-2">
                            文件过期天数
                            <Tooltip>
                            <TooltipTrigger asChild>
                                <Info className="w-3.5 h-3.5 text-muted-foreground/70 hover:text-primary transition-colors cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                                设置文件自动过期时间，0 表示永不过期
                            </TooltipContent>
                            </Tooltip>
                        </Label>
                        <Input 
                            type="number"
                            min="0"
                            value={config.expirationDays ?? ''} 
                            onChange={(e) => {
                            const val = e.target.value;
                            // Allow undefined to represent empty input
                            onUpdate({ expirationDays: val === '' ? undefined : (parseInt(val) || 0) });
                            }}
                            placeholder="0"
                            disabled={!canEdit}
                            onWheel={(e) => e.currentTarget.blur()}
                            className="h-11 border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 focus-visible:ring-primary shadow-sm no-spinner disabled:opacity-60"
                        />
                        </div>

                        {/* Duplicate Handling */}
                        <div className="space-y-2">
                        <Label className="text-zinc-800 dark:text-zinc-200 font-semibold text-xs uppercase tracking-wider ml-1 flex items-center gap-2">
                            同名文件冲突策略
                            <Tooltip>
                            <TooltipTrigger asChild>
                                <Info className="w-3.5 h-3.5 text-muted-foreground/70 hover:text-primary transition-colors cursor-help" />
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
                                disabled={!canEdit}
                                className="w-full justify-between border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 h-11 px-3 font-normal shadow-sm group disabled:opacity-60"
                            >
                                <span className="text-sm text-zinc-700 dark:text-zinc-200">
                                    {(config.duplicateHandling === 'skip' || !config.duplicateHandling) && '跳过'}
                                    {config.duplicateHandling === 'overwrite' && '覆盖'}
                                    {config.duplicateHandling === 'keep-both' && '保留两者'}
                                </span>
                                <ChevronDown className="w-4 h-4 text-zinc-400 transition-transform group-data-[state=open]:rotate-180" />
                            </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent 
                            align="start" 
                            sideOffset={4}
                            style={{ width: 'var(--radix-dropdown-menu-trigger-width)' }}
                            className="border border-zinc-200/50 dark:border-white/10 p-1.5 shadow-2xl bg-white/80 dark:bg-white/5 backdrop-blur-2xl rounded-xl"
                            >
                                <DropdownMenuItem 
                                    onClick={() => onUpdate({ duplicateHandling: 'skip' })}
                                    className="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer focus:bg-zinc-100 dark:focus:bg-white/10 transition-colors"
                                >
                                    <div className="flex flex-col flex-1">
                                        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">跳过</span>
                                        <span className="text-[10px] text-zinc-500">如果文件已存在，则不进行上传</span>
                                    </div>
                                    {(config.duplicateHandling === 'skip' || !config.duplicateHandling) && <Check className="w-4 h-4 text-primary" />}
                                </DropdownMenuItem>

                                <DropdownMenuItem 
                                    onClick={() => onUpdate({ duplicateHandling: 'overwrite' })}
                                    className="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer focus:bg-zinc-100 dark:focus:bg-white/10 transition-colors"
                                >
                                    <div className="flex flex-col flex-1">
                                        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">覆盖</span>
                                        <span className="text-[10px] text-zinc-500">强制覆盖已存在的同名文件</span>
                                    </div>
                                    {config.duplicateHandling === 'overwrite' && <Check className="w-4 h-4 text-primary" />}
                                </DropdownMenuItem>

                                <DropdownMenuItem 
                                    onClick={() => onUpdate({ duplicateHandling: 'keep-both' })}
                                    className="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer focus:bg-zinc-100 dark:focus:bg-white/10 transition-colors"
                                >
                                    <div className="flex flex-col flex-1">
                                        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">保留两者</span>
                                        <span className="text-[10px] text-zinc-500">自动重命名新文件以避免冲突</span>
                                    </div>
                                    {config.duplicateHandling === 'keep-both' && <Check className="w-4 h-4 text-primary" />}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </CardContent>
    </Card>
      </motion.div>
    </AnimatePresence>
  );
}
