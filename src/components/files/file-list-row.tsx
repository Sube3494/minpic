/*
 * @Date: 2025-12-25 15:30:11
 * @Author: Sube
 * @FilePath: file-list-row.tsx
 * @LastEditTime: 2025-12-25 18:03:16
 * @Description: 
 */
import { motion } from 'framer-motion';
import { FileItem } from '@/types/file';
import Image from 'next/image';
import { CheckCircle2, Circle, Copy, Link2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn, formatFileSize } from '@/lib/utils'; 
import { FileIcon } from './file-icon'; 

interface FileListRowProps {
  file: FileItem;
  isSelected: boolean;
  toggleSelect: (id: string) => void;
  copyShortlink: (id: string, code: string | null) => void;
  deleteFile: (id: string, name: string) => void;
}

export function FileListRow({ file, isSelected, toggleSelect, copyShortlink, deleteFile }: FileListRowProps) {
  const variants = {
    hidden: { opacity: 0, x: -20 },
    show: { opacity: 1, x: 0 }
  };

  return (
    <motion.div
      layoutId={`file-${file.id}`}
      variants={variants}
      exit={{ opacity: 0, x: -20 }}
      transition={{ 
        layout: { type: "spring", stiffness: 250, damping: 30 },
      }}
      className={cn(
        "relative group cursor-pointer overflow-hidden border rounded-2xl shadow-sm bg-card p-1",
        isSelected ? "ring-2 ring-primary border-primary z-20" : "border-black/5 dark:border-white/5"
      )}
      onClick={() => toggleSelect(file.id)}
    >
      <div className="flex items-center gap-2 md:gap-4 p-2 md:p-3 relative">
        <div className="shrink-0 pl-1">
          {isSelected ? (
            <CheckCircle2 className="w-5 h-5 text-primary" />
          ) : (
            <Circle className="w-5 h-5 text-zinc-300 dark:text-zinc-800" />
          )}
        </div>

        <motion.div 
          layoutId={`thumb-${file.id}`} 
          className="w-10 h-10 md:w-14 md:h-14 bg-zinc-100 dark:bg-white/5 flex items-center justify-center relative overflow-hidden rounded-xl shrink-0 border border-black/5 dark:border-white/10"
        >
          {(file.fileType === 'image' || file.fileType === 'video') ? (
            <Image
              src={`/api/files/${file.id}/thumbnail`}
              alt={file.filename}
              fill
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="text-primary/70 scale-75 md:scale-100">
             <FileIcon fileType={file.fileType} className="w-5 h-5" />
            </div>
          )}
        </motion.div>

        <motion.div layoutId={`info-${file.id}`} className="flex-1 min-w-0 pr-1">
          <h3 className="font-bold text-xs md:text-sm truncate dark:text-zinc-100">{file.filename}</h3>
          <div className="flex items-center gap-1.5 md:gap-3 mt-0.5 text-[10px] md:text-[11px] text-zinc-600 dark:text-zinc-300 uppercase font-bold">
            <span>{formatFileSize(file.fileSize)}</span>
            <span className="opacity-30">•</span>
            <span className="truncate">{file.fileType}</span>
            <span className="opacity-30 hidden sm:inline">•</span>
            <span className="hidden sm:inline">{new Date(file.createdAt).toLocaleDateString('zh-CN')}</span>
          </div>
        </motion.div>

        <div className="flex gap-1.5 md:gap-2" onClick={e => e.stopPropagation()}>
          <Button
            size="sm"
            variant="outline"
            className="h-8 md:h-10 px-2 md:px-5 rounded-full font-bold bg-white dark:bg-white/5 border-zinc-200 dark:border-white/10 shadow-sm"
            onClick={() => copyShortlink(file.id, file.shortlinkCode)}
          >
            {file.shortlinkCode ? <Copy className="w-3.5 h-3.5 md:mr-2" /> : <Link2 className="w-3.5 h-3.5 md:mr-2" />}
            <span className="hidden sm:inline text-xs">{file.shortlinkCode ? '复制链接' : '生成链接'}</span>
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="h-8 w-8 md:h-10 md:w-auto md:px-5 rounded-full shadow-md shadow-destructive/10"
            onClick={() => deleteFile(file.id, file.filename)}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline ml-2 text-xs font-bold">删除</span>
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
