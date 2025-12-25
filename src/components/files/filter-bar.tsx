import { Search, Grid3x3, List, ImageIcon, Video, Music } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FilterType, ViewMode } from '@/types/file';

interface FilterBarProps {
  search: string;
  setSearch: (value: string) => void;
  filter: FilterType;
  setFilter: (value: FilterType) => void;
  viewMode: ViewMode;
  setViewMode: (value: ViewMode) => void;
}

export function FilterBar({ search, setSearch, filter, setFilter, viewMode, setViewMode }: FilterBarProps) {
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
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none flex-1">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            onClick={() => setFilter('all')}
            size="sm"
            className="rounded-full px-4 shrink-0"
          >
            全部
          </Button>
          <Button
            variant={filter === 'image' ? 'default' : 'outline'}
            onClick={() => setFilter('image')}
            size="sm"
            className="rounded-full px-4 shrink-0"
          >
            <ImageIcon className="w-3.5 h-3.5 mr-1.5" />
            图片
          </Button>
          <Button
            variant={filter === 'video' ? 'default' : 'outline'}
            onClick={() => setFilter('video')}
            size="sm"
            className="rounded-full px-4 shrink-0"
          >
            <Video className="w-3.5 h-3.5 mr-1.5" />
            视频
          </Button>
          <Button
            variant={filter === 'audio' ? 'default' : 'outline'}
            onClick={() => setFilter('audio')}
            size="sm"
            className="rounded-full px-4 shrink-0"
          >
            <Music className="w-3.5 h-3.5 mr-1.5" />
            音频
          </Button>
        </div>
        <div className="flex gap-1 border rounded-full p-1 bg-muted/50 shrink-0 shadow-inner">
          <Button
            size="sm"
            variant={viewMode === 'grid' ? 'default' : 'ghost'}
            onClick={() => setViewMode('grid')}
            className="h-8 w-8 p-0 rounded-full"
          >
            <Grid3x3 className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            onClick={() => setViewMode('list')}
            className="h-8 w-8 p-0 rounded-full"
          >
            <List className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
