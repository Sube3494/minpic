import { MinioConfigItem } from '@/types/config';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Server } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';

interface ConfigListProps {
  configs: MinioConfigItem[];
  activeId: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onActivate: (id: string) => void;
}

export function ConfigList({ 
  configs, activeId, selectedId, onSelect, onCreate, onActivate 
}: ConfigListProps) {
  const [indicatorStyle, setIndicatorStyle] = useState({ top: 0, height: 0, opacity: 0 });
  const itemsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const updatePosition = () => {
      if (configs.length === 0 || !selectedId) {
        setIndicatorStyle({ top: 0, height: 0, opacity: 0 });
        return;
      }

      const activeIndex = configs.findIndex(config => config.id === selectedId);
      const activeEl = itemsRef.current[activeIndex];

      if (activeEl && activeIndex !== -1) {
        setIndicatorStyle({
          top: activeEl.offsetTop,
          height: activeEl.offsetHeight,
          opacity: 1
        });
      } else {
        setIndicatorStyle({ top: 0, height: 0, opacity: 0 });
      }
    };

    const rafId = requestAnimationFrame(updatePosition);
    return () => cancelAnimationFrame(rafId);
  }, [selectedId, configs]);

  return (
    <Card className="glass-strong border-zinc-200/50 dark:border-white/10 shadow-lg bg-white/50 dark:bg-black/20 overflow-hidden flex flex-col h-full">
      <CardHeader className="pb-2 shrink-0">
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
      <CardContent className="p-0 flex-1 min-h-0">
        <ScrollArea className="h-full">
            <div className="p-3 space-y-2 relative">
                {/* Animated Selection Indicator */}
                {indicatorStyle.height > 0 && (
                  <motion.div
                    className="absolute left-3 right-3 bg-white dark:bg-white/10 border border-primary/20 shadow-sm rounded-2xl pointer-events-none z-0"
                    initial={{
                      top: indicatorStyle.top,
                      height: indicatorStyle.height,
                      opacity: indicatorStyle.opacity
                    }}
                    animate={{
                      top: indicatorStyle.top,
                      height: indicatorStyle.height,
                      opacity: indicatorStyle.opacity
                    }}
                    transition={{
                      type: "spring",
                      stiffness: 300,
                      damping: 30
                    }}
                  />
                )}

                {configs.map((config, index) => {
                    const isActive = config.id === activeId;
                    const isSelected = config.id === selectedId;

                    return (
                        <div
                            key={config.id}
                            ref={el => { itemsRef.current[index] = el }}
                            onClick={() => onSelect(config.id)}
                            className={cn(
                                "group relative flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all duration-300 border z-10",
                                isSelected 
                                    ? "border-transparent scale-[1.02]" 
                                    : "bg-transparent border-transparent hover:bg-zinc-100/80 dark:hover:bg-white/5 hover:border-zinc-200/50 dark:hover:border-white/5"
                            )}
                        >
                            {/* Icon Box */}
                            <div className={cn(
                                "flex items-center justify-center w-10 h-10 rounded-full transition-all duration-300 shadow-sm",
                                isSelected
                                    ? "bg-primary/10 text-primary shadow-md ring-1 ring-primary/20"
                                    : isActive 
                                        ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm ring-1 ring-zinc-200 dark:ring-white/10" 
                                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 group-hover:bg-white dark:group-hover:bg-zinc-700 group-hover:shadow-md dark:shadow-none"
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
                                </div>
                                <div className="text-xs text-zinc-500 dark:text-zinc-500 truncate flex items-center gap-1.5">
                                    <span className="text-zinc-600 dark:text-zinc-400 font-medium">{config.bucket}</span>
                                    <span className="opacity-20">|</span>
                                    <span className="opacity-70">{config.endpoint}</span>
                                </div>
                            </div>

                            {/* Activate Button */}
                            <Button
                                size="sm"
                                variant={isActive ? "default" : "outline"}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onActivate(config.id);
                                }}
                                className={cn(
                                    "h-7 px-3 text-[10px] font-medium transition-all shrink-0",
                                    isActive 
                                        ? "bg-green-100 text-green-700 dark:bg-green-600/20 dark:text-green-500 hover:bg-green-200 dark:hover:bg-green-600/30" 
                                        : "hover:bg-zinc-100 dark:hover:bg-white/10"
                                )}
                            >
                                {isActive ? "已激活" : "激活"}
                            </Button>
                        </div>
                    );
                })}
            </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
