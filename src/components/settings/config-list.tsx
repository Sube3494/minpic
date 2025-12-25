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
    <Card className="glass-card border-zinc-200/50 dark:border-white/10 shadow-lg bg-white/50 dark:bg-black/20 overflow-hidden">
      <CardHeader className="border-b border-zinc-200 dark:border-white/5 pb-4">
        <div className="flex items-center justify-between">
            <div className="space-y-1">
                <CardTitle className="text-lg text-zinc-800 dark:text-zinc-100">配置列表</CardTitle>
                <CardDescription className="text-xs text-zinc-500 dark:text-zinc-400">管理你的存储源</CardDescription>
            </div>
            <Button 
                onClick={onCreate} 
                size="sm" 
                className="h-8 w-8 p-0 rounded-full bg-primary shadow-md shadow-primary/20 hover:scale-110 active:scale-95 transition-all"
            >
                <Plus className="w-4 h-4 text-white" />
            </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0 bg-white/30 dark:bg-transparent">
        <ScrollArea className="h-[300px] sm:h-[400px]">
            <div className="p-3 space-y-2">
                {configs.map((config) => {
                    const isActive = config.id === activeId;
                    const isSelected = config.id === selectedId;

                    return (
                        <div
                            key={config.id}
                            onClick={() => onSelect(config.id)}
                            className={cn(
                                "group relative flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200 border",
                                isSelected 
                                    ? "bg-white dark:bg-white/10 border-primary/30 shadow-sm" 
                                    : "bg-transparent border-transparent hover:bg-zinc-100 dark:hover:bg-white/5 hover:border-zinc-200 dark:hover:border-white/5"
                            )}
                        >
                            {/* Icon Box */}
                            <div className={cn(
                                "flex items-center justify-center w-10 h-10 rounded-full transition-colors",
                                isActive 
                                    ? "bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400" 
                                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 group-hover:bg-white dark:group-hover:bg-zinc-700"
                            )}>
                                <Server className="w-5 h-5" />
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <span className={cn(
                                        "font-medium text-sm truncate transition-colors",
                                        isSelected ? "text-primary" : "text-zinc-700 dark:text-zinc-200"
                                    )}>
                                        {config.name}
                                    </span>
                                    {isActive && (
                                        <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400 border-green-200 dark:border-green-800 shadow-none">
                                            当前使用
                                        </Badge>
                                    )}
                                </div>
                                <div className="text-xs text-zinc-500 dark:text-zinc-500 truncate">
                                    <span className="text-zinc-700 dark:text-zinc-400 font-semibold">{config.bucket}</span>
                                    <span className="mx-1.5 opacity-30">|</span>
                                    {config.endpoint}
                                </div>
                            </div>

                            {/* Chevron */}
                            <ChevronRight className={cn(
                                "w-4 h-4 text-zinc-400 transition-transform",
                                isSelected ? "text-primary translate-x-0.5" : "opacity-0 group-hover:opacity-50"
                            )} />
                            
                            {/* Active Indicator Strip */}
                            {isSelected && (
                                <div className="absolute left-0 top-3 bottom-3 w-1 bg-primary rounded-r-full" />
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
