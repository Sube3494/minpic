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
import { Link2, Loader2, PlugZap } from 'lucide-react';

interface ShortlinkConfigSectionProps {
  config: ShortlinkConfig;
  isTesting: boolean;
  isSaving: boolean;
  onUpdate: (updates: Partial<ShortlinkConfig>) => void;
  onTest: (config?: ShortlinkConfig) => Promise<boolean>;
  onSave: (updates?: Partial<ShortlinkConfig>, silent?: boolean) => Promise<void>;
}

export function ShortlinkConfigSection({ 
  config, isTesting, isSaving, onUpdate, onTest, onSave
}: ShortlinkConfigSectionProps) {

  const handleSwitchChange = async (checked: boolean) => {
    if (checked) {
      // 尝试启用：先测试连接
      const success = await onTest(config);
      if (success) {
        // 测试通过，保存并启用
        await onSave({ enabled: true });
      }
      // 测试失败，保持禁用状态 (不调用 onSave)
    } else {
      // 禁用：直接保存
      await onSave({ enabled: false });
    }
  };

  const handleBlur = () => {
    // 输入框失去焦点时，静默保存当前配置（仅保存，不改变启用状态）
    onSave(undefined, true);
  };

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
                  {config.enabled ? '用户可按需生成临时短链' : '配置第三方短链接口服务'}
                </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-1">
             <Button 
                size="icon"
                variant="ghost"
                onClick={() => onTest(config)}
                disabled={isTesting}
                className="h-7 w-7 hover:bg-zinc-100 dark:hover:bg-white/10"
                title="测试连接"
            >
                {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlugZap className="w-4 h-4" />}
            </Button>
            <Switch 
              checked={config.enabled}
              onCheckedChange={handleSwitchChange}
              disabled={isTesting || isSaving}
              className="data-[state=checked]:bg-primary"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2.5 pt-1.5 pb-1">
        <div className="space-y-2">
            <Label className="text-zinc-700 dark:text-zinc-300 font-semibold text-xs uppercase tracking-wider ml-1">API 地址 <span className="text-red-500">*</span></Label>
            <Input 
                value={config.apiUrl}
                onChange={(e) => onUpdate({ apiUrl: e.target.value })}
                onBlur={handleBlur}
                placeholder="https://api.example.com/shorten"
                // 移除 disabled，允许禁用状态下输入
                className="h-10 text-xs bg-white dark:bg-white/5 border-zinc-200 dark:border-white/10 focus-visible:ring-primary shadow-sm"
            />
        </div>

        <div className="space-y-2">
            <Label className="text-zinc-700 dark:text-zinc-300 font-semibold text-xs uppercase tracking-wider ml-1">API 密钥 (Key) <span className="text-red-500">*</span></Label>
            <Input 
                type="password"
                value={config.apiKey}
                onChange={(e) => onUpdate({ apiKey: e.target.value })}
                onBlur={handleBlur}
                placeholder="secret_token"
                // 移除 disabled
                className="h-10 text-xs bg-white dark:bg-white/5 border-zinc-200 dark:border-white/10 focus-visible:ring-primary shadow-sm"
            />
        </div>

      </CardContent>
    </Card>
  );
}
