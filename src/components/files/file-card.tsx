import { memo, useState } from 'react';
import { motion } from 'framer-motion';
import { FileItem } from '@/types/file';
import { Check, Copy, Link2, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CopyFormatMenu } from './copy-format-menu';

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
  getDirectLink: (id: string) => Promise<string>;
  generateShortlink: (id: string) => void;
  shortlinkEnabled: boolean;
  onPreview: (file: FileItem) => void;
  onShare: (file: FileItem) => void;
}

export const FileCard = memo(function FileCard({ file, isSelected, isSelectionMode, toggleSelect, getDirectLink, generateShortlink, shortlinkEnabled, onPreview, onShare }: FileCardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
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
          ? "border-2 border-primary bg-primary/5 dark:bg-primary/10" 
          : cn(
              "bg-card shadow-sm hover:shadow-xl hover:-translate-y-1.5 border-2", 
              isMenuOpen && "shadow-xl -translate-y-1.5",
              typeBorderStyle
            )
      )}
      onClick={(e) => {
        if (isSelectionMode) {
          e.preventDefault(); // Prevent preview opening
          e.stopPropagation();
          toggleSelect(file.id);
        } else {
          onPreview(file);
        }
      }}
      onContextMenu={(e) => {
        // Desktop Right Click -> Select
        e.preventDefault();
        toggleSelect(file.id);
      }}
      // Removed complex touch timers as they often conflict with scroll
      // Reliance on long-press context menu or explicit selection button in header is better
    >
      {/* Inner Content Container - Scale Effect on Selection */}
      <div className={cn(
        "relative w-full overflow-hidden transition-all duration-300 ease-out origin-center rounded-2xl sm:rounded-3xl"
      )}>
        
        {/* Selection Check Circle - Modern Floating Badge */}
        <div 
          className={cn(
            "absolute top-0 right-0 z-30 p-2 sm:p-2.5 cursor-pointer touch-manipulation", // Increased hit area
            (isSelected || isMenuOpen) ? "opacity-100" : "opacity-0 md:group-hover:opacity-100"
          )}
          onClick={(e) => {
            e.stopPropagation();
            toggleSelect(file.id);
          }}
        >
          <div className={cn(
            "rounded-full w-5 h-5 flex items-center justify-center transition-all duration-300",
            isSelected 
              ? "bg-primary border border-primary text-white scale-110" 
              : "bg-black/20 hover:bg-black/40 border border-white/20 text-transparent"
          )}>
            <Check className="w-3 h-3" strokeWidth={4} />
          </div>
        </div>

        {/* Thumbnail / Preview Area */}
        <div className={cn(
          "w-full transition-transform duration-700",
          (!isSelected || isMenuOpen) && "group-hover:scale-105", 
          isMenuOpen && "scale-105",
          (file.fileType === 'image' || file.fileType === 'video') ? "" : "aspect-square bg-muted/30"
        )}>
          {(file.fileType === 'image' || file.fileType === 'video') ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/files/${file.id}/thumbnail?v=${new Date(file.updatedAt || file.createdAt).getTime()}`}
              alt={file.filename}
              className="w-full h-auto min-h-[100px] sm:min-h-[140px] block object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 sm:gap-3 p-3 sm:p-4 h-full min-h-[100px] sm:min-h-[140px]">
              <FileIcon fileType={file.fileType} className="w-10 h-10 sm:w-12 sm:h-12 text-primary/60" />
              <div className="flex flex-col items-center gap-0.5 sm:gap-1 min-w-0 w-full">
                <span className="text-[10px] sm:text-xs font-bold text-zinc-600 dark:text-zinc-400 truncate w-full text-center px-2">
                  {file.filename}
                </span>
                <span className="text-[8px] sm:text-[9px] font-bold text-muted-foreground/40 uppercase tracking-widest">{file.fileType}</span>
              </div>
            </div>
          )}
        </div>

        {/* Info Overlay - Scheme C */}
        {/* Info Overlay - Scheme C (Ultra Compact) */}
        <div className="absolute inset-x-0 bottom-0 z-20 pointer-events-none">
          <div className="absolute inset-x-0 bottom-0 h-20 bg-linear-to-t from-black/60 via-black/20 to-transparent opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300" />
          
          <div className={cn(
            "relative p-2 sm:p-3 flex items-center justify-between opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300 translate-y-0 md:translate-y-2 md:group-hover:translate-y-0",
            isMenuOpen && "md:opacity-100 md:translate-y-0"
          )}>
            {/* Left: Info Badges */}
            <div className="flex items-center gap-1 sm:gap-2">
                {formatExpiryTime(file.expiresAt) && (
                   <span className={cn(
                     "text-[9px] font-bold px-1.5 py-0.5 rounded-sm bg-black/30 text-white border border-white/20 shadow-sm",
                     formatExpiryTime(file.expiresAt) === '已过期' ? 'text-red-300' : 'text-amber-300'
                   )}>
                     {formatExpiryTime(file.expiresAt)}
                   </span>
                )}
                
                <span className={cn(
                    "file-type-badge",
                    "text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider border", 
                    badgeStyle
                )}>
                    {file.fileType}
                </span>
            </div>

            {/* Right: Actions */}
            <div className="flex gap-1 sm:gap-1.5 pointer-events-auto" onClick={e => e.stopPropagation()}>
              <CopyFormatMenu 
                fileId={file.id} 
                filename={file.filename}
                onGetUrl={getDirectLink}
                onOpenChange={setIsMenuOpen}
              >
                <Button 
                  size="sm" 
                  variant="secondary" 
                  className="h-6 w-6 p-0 rounded-full shadow-lg bg-white/25 hover:bg-white/40 border-white/30 text-white transition-all hover:scale-110 active:scale-90" 
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </CopyFormatMenu>
                
                {shortlinkEnabled && (
                  <Button 
                      size="sm" 
                      variant="secondary" 
                      className="h-6 w-6 p-0 rounded-full shadow-lg bg-white/25 hover:bg-white/40 border-white/30 text-white transition-all hover:scale-110 active:scale-90" 
                      onClick={() => generateShortlink(file.id)}
                  >
                      <Link2 className="w-3 h-3" />
                  </Button>
                )}
                
                <Button 
                    size="sm" 
                    variant="secondary" 
                    className="h-6 w-6 p-0 rounded-full shadow-lg bg-white/25 hover:bg-white/40 border-white/30 text-white transition-all hover:scale-110 active:scale-90" 
                    onClick={() => onShare(file)}
                >
                    <Share2 className="w-3 h-3" />
                </Button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
});
