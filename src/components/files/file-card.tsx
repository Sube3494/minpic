import { motion } from 'framer-motion';
import { FileItem } from '@/types/file';
import Image from 'next/image';
import { CheckCircle2, Circle, Copy, Link2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { formatFileSize } from '@/lib/utils';
import { FileIcon } from './file-icon';

interface FileCardProps {
  file: FileItem;
  isSelected: boolean;
  toggleSelect: (id: string) => void;
  copyShortlink: (id: string, code: string | null) => void;
  deleteFile: (id: string, name: string) => void;
}

export function FileCard({ file, isSelected, toggleSelect, copyShortlink, deleteFile }: FileCardProps) {
  const typeBorderStyle = file.fileType === 'video' 
    ? 'border-purple-500/20 dark:border-purple-500/40' 
    : file.fileType === 'audio'
    ? 'border-blue-500/20 dark:border-blue-500/40'
    : 'border-black/5 dark:border-white/5';
  
  const badgeStyle = file.fileType === 'video'
    ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300'
    : file.fileType === 'audio'
    ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300'
    : 'bg-zinc-100 text-zinc-700 dark:bg-white/10 dark:text-zinc-300';

  const variants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <motion.div
      layoutId={`file-${file.id}`}
      variants={variants}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ 
        layout: { type: "spring", stiffness: 250, damping: 30 },
      }}
      className={cn(
        "relative group cursor-pointer overflow-hidden border rounded-2xl shadow-sm bg-card p-0",
        isSelected ? "ring-2 ring-primary border-primary z-20" : typeBorderStyle
      )}
      onClick={() => toggleSelect(file.id)}
    >
      <div className="aspect-square relative w-full overflow-hidden">
        {/* Checkbox Overlay */}
        <div className={cn(
          "absolute top-2 right-2 z-30 transition-all duration-300",
          isSelected ? "opacity-100 scale-100" : "opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100"
        )}>
          <div className="bg-black/20 backdrop-blur-md rounded-full p-1 border border-white/20">
            {isSelected ? (
              <CheckCircle2 className="w-4 h-4 text-primary fill-primary/20" />
            ) : (
              <Circle className="w-4 h-4 text-white/80" />
            )}
          </div>
        </div>

        {/* Thumbnail */}
        <motion.div layoutId={`thumb-${file.id}`} className="absolute inset-0 bg-muted/50 flex items-center justify-center">
          {(file.fileType === 'image' || file.fileType === 'video') ? (
            <Image
              src={`/api/files/${file.id}/thumbnail`}
              alt={file.filename}
              fill
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="text-primary/70 text-4xl">
             <FileIcon fileType={file.fileType} className="w-8 h-8" />
            </div>
          )}
        </motion.div>

        {/* Info Overlay - Refined with Gradient for better visibility */}
        <div className="absolute inset-0 z-10 transition-opacity duration-300">
          {/* Subtle Bottom Gradient */}
          <div className="absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-black/80 via-black/40 to-transparent opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300" />
          
          <div className="absolute inset-0 flex flex-col justify-between p-2.5 md:p-3 z-20 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">
            <motion.div layoutId={`info-${file.id}`} className="drop-shadow-md">
              <h3 className="text-white text-[10px] md:text-[13px] font-bold truncate leading-tight tracking-tight">
                {file.filename}
              </h3>
              <p className="text-white/80 text-[9px] md:text-[11px] mt-0.5 font-medium">
                {formatFileSize(file.fileSize)}
              </p>
            </motion.div>
            
            <div className="flex items-center justify-between mt-auto">
              <span className={cn(
                "text-[8px] md:text-[10px] px-2 py-0.5 rounded-full shadow-sm backdrop-blur-md font-bold uppercase tracking-wider", 
                badgeStyle
              )}>
                {file.fileType}
              </span>
              <div className="flex gap-1 md:gap-1.5" onClick={e => e.stopPropagation()}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="secondary" className="h-6 w-6 md:h-7 md:w-7 p-0 shadow-lg bg-white/10 hover:bg-white/20 border-white/10 text-white backdrop-blur-md" onClick={() => copyShortlink(file.id, file.shortlinkCode)}>
                      {file.shortlinkCode ? <Copy className="w-2.5 h-2.5 md:w-3 md:h-3" /> : <Link2 className="w-2.5 h-2.5 md:w-3 md:h-3" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">{file.shortlinkCode ? '复制链接' : '生成链接'}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="destructive" className="h-6 w-6 md:h-7 md:w-7 p-0 shadow-lg" onClick={() => deleteFile(file.id, file.filename)}>
                      <Trash2 className="w-2.5 h-2.5 md:w-3 md:h-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">删除文件</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
