/*
 * @Date: 2025-12-26 00:01:08
 * @Author: Sube
 * @FilePath: shortlink-config.tsx
 * @LastEditTime: 2025-12-26 22:17:16
 * @Description: 
 */
import { ShortlinkConfig } from '@/types/config';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Link2, Loader2, PlugZap, Info } from 'lucide-react';

interface ShortlinkConfigSectionProps {
  config: ShortlinkConfig;
  isTesting: boolean;
  onUpdate: (updates: Partial<ShortlinkConfig>) => void;
  onTest: () => void;
}

export function ShortlinkConfigSection({ 
  config, isTesting, onUpdate, onTest 
}: ShortlinkConfigSectionProps) {
  return (
    <Card className="glass-strong border-zinc-200/50 dark:border-white/10 shadow-lg bg-white/50 dark:bg-black/20">
      <CardHeader className="pb-1.5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-zinc-100 dark:bg-white/10 text-zinc-500 dark:text-zinc-400 shadow-sm">
                <Link2 className="w-5 h-5" />
            </div>
            <div>
                <CardTitle className="text-lg font-bold text-zinc-800 dark:text-zinc-100 tracking-tight">自定义短链</CardTitle>
                <CardDescription className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {config.enabled ? '上传文件时将自动生成短链接' : '配置第三方短链接口服务'}
                </CardDescription>
            </div>
          </div>
          <Switch 
            checked={config.enabled}
            onCheckedChange={(checked: boolean) => onUpdate({ enabled: checked })}
            className="data-[state=checked]:bg-primary mt-1"
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-2.5 pt-1.5 pb-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider ml-1">配置信息</span>
          <Button 
              size="icon"
              variant="ghost"
              onClick={onTest}
              disabled={isTesting || !config.enabled}
              className="h-7 w-7 hover:bg-zinc-100 dark:hover:bg-white/10"
              title="测试连接"
          >
              {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlugZap className="w-4 h-4" />}
          </Button>
        </div>
        <div className="space-y-2">
            <Label className="text-zinc-700 dark:text-zinc-300 font-semibold text-xs uppercase tracking-wider ml-1">API 地址 <span className="text-red-500">*</span></Label>
            <Input 
                value={config.apiUrl}
                onChange={(e) => onUpdate({ apiUrl: e.target.value })}
                placeholder="https://api.example.com/shorten"
                disabled={!config.enabled}
                className="h-10 text-xs bg-white dark:bg-zinc-950/30 border-zinc-200 dark:border-white/10 focus-visible:ring-primary shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            />
        </div>

        <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
                <Label className="text-zinc-700 dark:text-zinc-300 font-semibold text-xs uppercase tracking-wider ml-1">API 密钥 (Key) <span className="text-red-500">*</span></Label>
                <Input 
                    type="password"
                    value={config.apiKey}
                    onChange={(e) => onUpdate({ apiKey: e.target.value })}
                    placeholder="secret_token"
                    disabled={!config.enabled}
                    className="h-10 text-xs bg-white dark:bg-zinc-950/30 border-zinc-200 dark:border-white/10 focus-visible:ring-primary shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                />
            </div>
            <div className="space-y-2">
                <Label className="text-zinc-700 dark:text-zinc-300 font-semibold text-xs uppercase tracking-wider ml-1 flex items-center gap-2">
                  默认有效期 (小时)
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-3.5 h-3.5 text-muted-foreground/70 hover:text-primary transition-colors cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      设置短链自动过期时间，0 表示永不过期
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Input 
                    type="number"
                    value={config.expiresIn ?? ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      // Allow undefined to represent empty input
                      onUpdate({ expiresIn: val === '' ? undefined : (parseInt(val) || 0) });
                    }}
                    placeholder="0 (永久)"
                    disabled={!config.enabled}
                    className="h-10 text-xs bg-white dark:bg-zinc-950/30 border-zinc-200 dark:border-white/10 focus-visible:ring-primary shadow-sm disabled:opacity-50 disabled:cursor-not-allowed [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
            </div>
        </div>

      </CardContent>
    </Card>
  );
}
