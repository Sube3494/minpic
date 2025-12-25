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
    <Card className="glass-card border-zinc-200/50 dark:border-white/10 shadow-lg bg-white/50 dark:bg-black/20">
      <CardHeader className="border-b border-zinc-200 dark:border-white/5 pb-4">
        <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                <Link2 className="w-5 h-5" />
            </div>
            <div>
                <CardTitle className="text-lg text-zinc-800 dark:text-zinc-100">短链服务</CardTitle>
                <CardDescription className="text-xs text-zinc-500 dark:text-zinc-400">配置 YoURLS 短链接口</CardDescription>
            </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-6 bg-white/30 dark:bg-transparent">
        <div className="space-y-2">
            <Label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">API 地址</Label>
            <Input 
                value={config.apiUrl}
                onChange={(e) => onUpdate({ apiUrl: e.target.value })}
                placeholder="https://yourls.example.com/yourls-api.php"
                className="h-9 text-xs bg-white dark:bg-zinc-950/30"
            />
        </div>

        <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
                <Label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">API 签名 (Signature)</Label>
                <Input 
                    type="password"
                    value={config.apiKey}
                    onChange={(e) => onUpdate({ apiKey: e.target.value })}
                    placeholder="secret_token"
                    className="h-9 text-xs bg-white dark:bg-zinc-950/30"
                />
            </div>
            <div className="space-y-2">
                <Label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">默认有效期 (小时)</Label>
                <Input 
                    type="number"
                    value={config.expiresIn}
                    onChange={(e) => onUpdate({ expiresIn: parseInt(e.target.value) || 0 })}
                    placeholder="0 (永久)"
                    className="h-9 text-xs bg-white dark:bg-zinc-950/30"
                />
            </div>
        </div>

        <div className="flex items-center justify-between py-1">
            <Label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-3 h-3 text-amber-500" /> 自动生成短链
            </Label>
            <Switch 
                checked={config.autoGenerate}
                onCheckedChange={(checked: boolean) => onUpdate({ autoGenerate: checked })}
            />
        </div>

        <Button 
            variant="outline" 
            size="sm" 
            className="w-full text-xs h-8 border-dashed"
            onClick={onTest}
            disabled={isTesting}
        >
            {isTesting ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> : "测试连接"}
        </Button>
      </CardContent>
    </Card>
  );
}
