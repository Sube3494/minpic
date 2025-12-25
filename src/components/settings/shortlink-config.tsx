import { ShortlinkConfig } from '@/types/config';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Link2, Loader2, Sparkles } from 'lucide-react';

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
      <CardHeader className="border-b border-zinc-200 dark:border-white/5 pb-4">
        <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-zinc-100 dark:bg-white/10 text-zinc-500 dark:text-zinc-400 shadow-sm">
                <Link2 className="w-5 h-5" />
            </div>
            <div>
                <CardTitle className="text-lg font-bold text-zinc-800 dark:text-zinc-100 tracking-tight">自定义短链</CardTitle>
                <CardDescription className="text-xs text-zinc-500 dark:text-zinc-400">配置第三方短链接口服务</CardDescription>
            </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pt-6 bg-white/30 dark:bg-transparent">
        <div className="space-y-2">
            <Label className="text-zinc-700 dark:text-zinc-300 font-semibold text-xs uppercase tracking-wider ml-1">API 地址</Label>
            <Input 
                value={config.apiUrl}
                onChange={(e) => onUpdate({ apiUrl: e.target.value })}
                placeholder="https://api.example.com/shorten"
                className="h-10 text-xs bg-white dark:bg-zinc-950/30 border-zinc-200 dark:border-white/10 focus-visible:ring-primary shadow-sm"
            />
        </div>

        <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
                <Label className="text-zinc-700 dark:text-zinc-300 font-semibold text-xs uppercase tracking-wider ml-1">API 密钥 (Key)</Label>
                <Input 
                    type="password"
                    value={config.apiKey}
                    onChange={(e) => onUpdate({ apiKey: e.target.value })}
                    placeholder="secret_token"
                    className="h-10 text-xs bg-white dark:bg-zinc-950/30 border-zinc-200 dark:border-white/10 focus-visible:ring-primary shadow-sm"
                />
            </div>
            <div className="space-y-2">
                <Label className="text-zinc-700 dark:text-zinc-300 font-semibold text-xs uppercase tracking-wider ml-1">默认有效期 (小时)</Label>
                <Input 
                    type="number"
                    value={config.expiresIn}
                    onChange={(e) => onUpdate({ expiresIn: parseInt(e.target.value) || 0 })}
                    placeholder="0 (永久)"
                    className="h-10 text-xs bg-white dark:bg-zinc-950/30 border-zinc-200 dark:border-white/10 focus-visible:ring-primary shadow-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
            </div>
        </div>

        <div className="flex items-center justify-between p-3 rounded-2xl border border-zinc-200 dark:border-white/5 bg-white dark:bg-zinc-950/20 shadow-sm hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-100 dark:bg-white/10 text-zinc-500 dark:text-zinc-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-200">自动生成短链</span>
              <span className="text-[10px] text-muted-foreground">上传后自动创建短链接</span>
            </div>
          </div>
          <Switch 
            checked={config.autoGenerate}
            onCheckedChange={(checked: boolean) => onUpdate({ autoGenerate: checked })}
            className="data-[state=checked]:bg-primary"
          />
        </div>

        <Button 
            variant="outline" 
            size="sm" 
            className="w-full h-10 border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/10 font-bold"
            onClick={onTest}
            disabled={isTesting}
        >
            {isTesting ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : "测试连接"}
        </Button>
      </CardContent>
    </Card>
  );
}
