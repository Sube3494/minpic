import { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';

import { cn } from '@/lib/utils';
import { Search, Grid3x3, List, ImageIcon, Video, Music } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { FilterType, ViewMode } from '@/types/file';

interface FilterBarProps {
  search: string;
  setSearch: (value: string) => void;
  filter: FilterType;
  setFilter: (value: FilterType) => void;
  viewMode: ViewMode;
  setViewMode: (value: ViewMode) => void;
}

const FILTER_OPTIONS = [
  { id: 'all', label: '全部', icon: null },
  { id: 'image', label: '图片', icon: ImageIcon },
  { id: 'video', label: '视频', icon: Video },
  { id: 'audio', label: '音频', icon: Music },
] as const;

export function FilterBar({ search, setSearch, filter, setFilter, viewMode, setViewMode }: FilterBarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<Map<string, HTMLButtonElement>>(new Map());

  useEffect(() => {
    const activeItem = itemsRef.current.get(filter);
    if (activeItem && containerRef.current) {
      activeItem.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center'
      });
    }
  }, [filter]);

  return (
    <div className="flex flex-col space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-primary transition-colors" />
          <Input
            placeholder="搜索文件..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-11 h-11 bg-white/50 dark:bg-white/5 border-zinc-200 dark:border-white/10 rounded-full outline-none focus-visible:ring-4 focus-visible:ring-primary/10 transition-all"
          />
        </div>
      </div>
      <div className="flex items-center justify-between gap-4">
        <div 
          ref={containerRef}
          className="relative flex items-center gap-1 p-1 bg-muted/50 rounded-full border border-zinc-200/50 dark:border-white/10 overflow-x-auto scrollbar-none max-w-[70vw] md:max-w-none shadow-inner"
        >
          {FILTER_OPTIONS.map((option) => {
            const isActive = filter === option.id;
            return (
              <button
                key={option.id}
                ref={(el) => {
                  if (el) itemsRef.current.set(option.id, el);
                  else itemsRef.current.delete(option.id);
                }}
                onClick={() => setFilter(option.id)}
                className={cn(
                  "relative px-3 py-1.5 rounded-full text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/20 whitespace-nowrap shrink-0",
                  isActive ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeFilter"
                    className="absolute inset-0 bg-primary shadow-md shadow-primary/20 rounded-full"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center">
                  {option.icon && <option.icon className="w-3.5 h-3.5 mr-1" />}
                  {option.label}
                </span>
              </button>
            );
          })}
        </div>
        <div className="relative flex gap-1 border rounded-full p-1 bg-muted/50 shrink-0 shadow-inner">
          {/* Sliding background indicator */}
          <div 
            className="absolute top-1 bottom-1 w-8 bg-primary rounded-full transition-all duration-300 ease-out shadow-md shadow-primary/20"
            style={{
              left: viewMode === 'grid' ? '4px' : 'calc(50% + 2px)',
            }}
          />
          
          <button
            onClick={() => setViewMode('grid')}
            className={cn(
              "relative z-10 h-8 w-8 rounded-full flex items-center justify-center transition-colors duration-200",
              viewMode === 'grid' ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Grid3x3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={cn(
              "relative z-10 h-8 w-8 rounded-full flex items-center justify-center transition-colors duration-200",
              viewMode === 'list' ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
