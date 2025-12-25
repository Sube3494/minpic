import { MinioConfigItem } from '@/types/config';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Server, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ConfigListProps {
  configs: MinioConfigItem[];
  activeId: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
}

export function ConfigList({ 
  configs, activeId, selectedId, onSelect, onCreate 
}: ConfigListProps) {
  return (
    <Card className="glass-strong border-zinc-200/50 dark:border-white/10 shadow-lg bg-white/50 dark:bg-black/20 overflow-hidden flex flex-col h-full">
      <CardHeader className="border-b border-zinc-200 dark:border-white/5 pb-4 shrink-0">
        <div className="flex items-center justify-between">
            <div className="space-y-1">
                <CardTitle className="text-lg font-bold text-zinc-800 dark:text-zinc-100 tracking-tight">存储节点</CardTitle>
                <CardDescription className="text-xs text-zinc-500 dark:text-zinc-400">管理对象存储连接配置</CardDescription>
            </div>
            <Button 
                onClick={onCreate} 
                size="icon" 
                className="h-8 w-8 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
            >
                <Plus className="w-4 h-4" />
            </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0 bg-white/30 dark:bg-transparent flex-1 min-h-0">
        <ScrollArea className="h-full">
            <div className="p-3 space-y-2">
                {configs.map((config) => {
                    const isActive = config.id === activeId;
                    const isSelected = config.id === selectedId;

                    return (
                        <div
                            key={config.id}
                            onClick={() => onSelect(config.id)}
                            className={cn(
                                "group relative flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all duration-300 border",
                                isSelected 
                                    ? "bg-white dark:bg-white/10 border-primary/20 shadow-sm scale-[1.02]" 
                                    : "bg-transparent border-transparent hover:bg-zinc-100/80 dark:hover:bg-white/5 hover:border-zinc-200/50 dark:hover:border-white/5"
                            )}
                        >
                            {/* Icon Box */}
                            <div className={cn(
                                "flex items-center justify-center w-10 h-10 rounded-full transition-all duration-300 shadow-sm",
                                isActive 
                                    ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm ring-1 ring-zinc-200 dark:ring-white/10" 
                                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 group-hover:bg-white dark:group-hover:bg-zinc-700 group-hover:text-primary group-hover:shadow-md dark:shadow-none"
                            )}>
                                <Server className="w-5 h-5" />
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0 py-0.5">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <span className={cn(
                                        "font-bold text-sm truncate transition-colors",
                                        isSelected ? "text-primary" : "text-zinc-700 dark:text-zinc-200"
                                    )}>
                                        {config.name}
                                    </span>
                                    {isActive && (
                                        <Badge variant="secondary" className="h-4 px-1 text-[9px] bg-green-50/50 dark:bg-green-500/10 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800/30 shadow-none backdrop-blur-sm">
                                            ACTIVE
                                        </Badge>
                                    )}
                                </div>
                                <div className="text-xs text-zinc-500 dark:text-zinc-500 truncate flex items-center gap-1.5">
                                    <span className="text-zinc-600 dark:text-zinc-400 font-medium">{config.bucket}</span>
                                    <span className="opacity-20">|</span>
                                    <span className="opacity-70">{config.endpoint}</span>
                                </div>
                            </div>

                            {/* Chevron */}
                            <ChevronRight className={cn(
                                "w-4 h-4 text-zinc-300 transition-all duration-300",
                                isSelected ? "text-primary translate-x-0 opacity-100" : "opacity-0 -translate-x-2 group-hover:opacity-50 group-hover:translate-x-0"
                            )} />
                            
                            {/* Active Indicator Strip (Optional, maybe dot is enough) */}
                            {isSelected && (
                                <div className="absolute left-1 top-1/2 -translate-y-1/2 h-8 w-0.5 bg-primary rounded-full opacity-50" />
                            )}
                        </div>
                    );
                })}
            </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
