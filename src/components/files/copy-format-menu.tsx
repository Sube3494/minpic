import { useState } from 'react';
import { Link2, FileCode, Code2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from 'sonner';

interface CopyFormatMenuProps {
  children: React.ReactNode;
  fileId: string;
  filename: string;
  onGetUrl: (fileId: string) => Promise<string>;
  onOpenChange?: (open: boolean) => void;
}

export function CopyFormatMenu({ children, fileId, filename, onGetUrl, onOpenChange }: CopyFormatMenuProps) {
  const [loading, setLoading] = useState(false);

  const handleCopy = async (format: 'url' | 'markdown' | 'html' | 'bbcode') => {
    setLoading(true);
    try {
      const rawUrl = await onGetUrl(fileId);
      // Use URL constructor to safely normalize and encode the URI (handles Chinese chars, spaces, etc.)
      let url = rawUrl;
      try {
        url = new URL(rawUrl).toString();
      } catch (e) {
        console.error('URL parse failed, using raw link:', e);
      }
      
      let textToCopy = url;
      let toastMessage = '链接已复制';

      switch (format) {
        case 'markdown':
          textToCopy = `![${filename}](${url})`;
          toastMessage = 'Markdown 格式已复制';
          break;
        case 'html':
          textToCopy = `<img src="${url}" alt="${filename}" />`;
          toastMessage = 'HTML 格式已复制';
          break;
        case 'bbcode':
          textToCopy = `[img]${url}[/img]`;
          toastMessage = 'BBCode 格式已复制';
          break;
      }

      await navigator.clipboard.writeText(textToCopy);
      toast.success(
        <div className="flex items-center justify-between w-full gap-4 -my-1">
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-sm text-foreground">{toastMessage}</span>
            <span className="text-[11px] text-zinc-500/80 truncate max-w-[240px]">
              {textToCopy.length > 50 ? textToCopy.substring(0, 50) + '...' : textToCopy}
            </span>
          </div>
          <Button 
            size="icon" 
            variant="ghost" 
            className="h-11 w-11 rounded-2xl hover:bg-emerald-500/10 transition-all shrink-0 -mr-1"
            onClick={(e) => { e.stopPropagation(); window.open(url, '_blank'); }}
          >
            <ExternalLink className="w-6 h-6 text-emerald-500" />
          </Button>
        </div>
      );
    } catch (err) {
      console.error('获取链接失败:', err);
      toast.error('获取链接失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 bg-white/60 dark:bg-zinc-900/50 backdrop-blur-2xl border border-zinc-200/50 dark:border-white/10 shadow-xl">
        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleCopy('url'); }} disabled={loading}>
          <Link2 className="w-4 h-4 mr-2" />
          <span>原始链接</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleCopy('markdown'); }} disabled={loading}>
          <FileCode className="w-4 h-4 mr-2" />
          <span>Markdown</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleCopy('html'); }} disabled={loading}>
          <Code2 className="w-4 h-4 mr-2" />
          <span>HTML</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleCopy('bbcode'); }} disabled={loading}>
          <div className="w-4 h-4 mr-2 font-mono text-[10px] border border-current rounded flex items-center justify-center">BB</div>
          <span>BBCode</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
