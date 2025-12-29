import { memo } from 'react';
import { motion } from 'framer-motion';
import { FileItem } from '@/types/file';
import { Check, Copy, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

import { cn } from '@/lib/utils';
import { FileIcon } from './file-icon';

// 格式化过期时间
function formatExpiryTime(expiresAt: string | null | undefined): string | null {
  if (!expiresAt) return null;
  
  const expireDate = new Date(expiresAt);
  const now = new Date();
  const diffMs = expireDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return '已过期';
  if (diffDays === 0) return '今天过期';
  if (diffDays === 1) return '明天过期';
  if (diffDays <= 7) return `${diffDays} 天后过期`;
  if (diffDays <= 30) return `${Math.ceil(diffDays / 7)} 周后过期`;
  return `${Math.ceil(diffDays / 30)} 个月后过期`;
}

interface FileCardProps {
  file: FileItem;
  isSelected: boolean;
  isSelectionMode: boolean;
  toggleSelect: (id: string) => void;
  copyDirectLink: (id: string) => void;
  generateShortlink: (id: string) => void;
  shortlinkEnabled: boolean;
}

export const FileCard = memo(function FileCard({ file, isSelected, isSelectionMode, toggleSelect, copyDirectLink, generateShortlink, shortlinkEnabled }: FileCardProps) {
  const typeBorderStyle = file.fileType === 'video' 
    ? 'border-purple-500/20 dark:border-purple-500/40' 
    : file.fileType === 'audio'
    ? 'border-blue-500/20 dark:border-blue-500/40'
    : 'border-black/5 dark:border-white/5';
  
  const badgeStyle = file.fileType === 'video'
    ? 'text-purple-300 border-purple-500/30 bg-purple-500/10'
    : file.fileType === 'audio'
    ? 'text-blue-300 border-blue-500/30 bg-blue-500/10'
    : 'text-zinc-200 border-white/10 bg-white/5';


  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "relative group cursor-pointer border rounded-3xl p-0 transition-all duration-300",
        // Selected: background becomes primary tint, border becomes clean primary
        // Unselected: standard hover lift
        isSelected 
          ? "bg-primary/10 border-primary/50 shadow-none scale-[0.98]" 
          : cn("bg-card shadow-sm hover:shadow-xl hover:-translate-y-1.5", typeBorderStyle)
      )}
      onClick={(e) => {
        if (isSelectionMode) {
          e.stopPropagation();
          toggleSelect(file.id);
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        toggleSelect(file.id);
      }}
    >
      {/* Inner Content Container - Scale Effect on Selection */}
      <div className={cn(
        "relative w-full overflow-hidden transition-all duration-300 ease-out origin-center",
        isSelected ? "scale-[0.92] rounded-2xl shadow-sm" : "rounded-3xl"
      )}>
        
        {/* Selection Check Circle - Modern Floating Badge */}
        <div 
          className={cn(
            "absolute top-2 right-2 z-30 transition-all duration-300 cursor-pointer w-10 h-10 flex items-center justify-center", // Increased hit area
            isSelected ? "opacity-100 scale-100" : "opacity-0 scale-75 md:group-hover:opacity-100 md:group-hover:scale-100"
          )}
          onClick={(e) => {
            e.stopPropagation();
            toggleSelect(file.id);
          }}
        >
          <div className={cn(
            "rounded-full w-6 h-6 flex items-center justify-center transition-all duration-200 shadow-lg backdrop-blur-md ring-1 ring-white/20 dark:ring-white/10",
            isSelected 
              ? "bg-primary border border-primary text-white scale-110" 
              : "bg-black/20 hover:bg-black/40 border border-white/50 text-transparent"
          )}>
            <Check className="w-3.5 h-3.5" strokeWidth={3} />
          </div>
        </div>

        {/* Thumbnail / Preview Area */}
        <div className={cn(
          "w-full transition-transform duration-700",
          !isSelected && "group-hover:scale-105", // Only zoom hover when not selected to avoid conflict
          (file.fileType === 'image' || file.fileType === 'video') ? "" : "aspect-square bg-muted/30"
        )}>
          {(file.fileType === 'image' || file.fileType === 'video') ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/files/${file.id}/thumbnail?v=${new Date(file.updatedAt || file.createdAt).getTime()}`}
              alt={file.filename}
              className="w-full h-auto min-h-[140px] block object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 py-10 h-full">
              <FileIcon fileType={file.fileType} className="w-12 h-12 text-primary/60" />
              <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">{file.fileType}</span>
            </div>
          )}
        </div>

        {/* Info Overlay - Scheme C */}
        {/* Info Overlay - Scheme C (Ultra Compact) */}
        <div className="absolute inset-x-0 bottom-0 z-20 pointer-events-none">
          <div className="absolute inset-x-0 bottom-0 h-16 bg-linear-to-t from-black/80 via-black/40 to-transparent opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300" />
          
          <div className="relative p-3 flex items-center justify-between opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300 translate-y-0 md:translate-y-2 md:group-hover:translate-y-0">
            {/* Left: Info Badges */}
            <div className="flex items-center gap-2">
                {formatExpiryTime(file.expiresAt) && (
                   <span className={cn(
                     "text-[9px] font-bold px-1.5 py-0.5 rounded-sm bg-black/40 text-white backdrop-blur-md border border-white/10",
                     formatExpiryTime(file.expiresAt) === '已过期' ? 'text-red-300' : 'text-amber-300'
                   )}>
                     {formatExpiryTime(file.expiresAt)}
                   </span>
                )}
                
                <span className={cn(
                    "file-type-badge",
                    "text-[9px] px-1.5 py-0.5 rounded-md backdrop-blur-md font-bold uppercase tracking-wider border", 
                    badgeStyle
                )}>
                    {file.fileType}
                </span>
            </div>

            {/* Right: Actions */}
            <div className="flex gap-1.5 pointer-events-auto" onClick={e => e.stopPropagation()}>
                <Button 
                size="sm" 
                variant="secondary" 
                className="h-6 w-6 p-0 rounded-full shadow-lg bg-white/20 hover:bg-white/40 border-white/20 text-white backdrop-blur-md transition-all hover:scale-110 active:scale-90" 
                onClick={() => copyDirectLink(file.id)}
                >
                <Copy className="w-3 h-3" />
                </Button>
                
                {shortlinkEnabled && (
                  <Button 
                      size="sm" 
                      variant="secondary" 
                      className="h-6 w-6 p-0 rounded-full shadow-lg bg-white/20 hover:bg-white/40 border-white/20 text-white backdrop-blur-md transition-all hover:scale-110 active:scale-90" 
                      onClick={() => generateShortlink(file.id)}
                  >
                      <Link2 className="w-3 h-3" />
                  </Button>
                )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
});
