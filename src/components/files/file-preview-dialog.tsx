import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { FileItem } from "@/types/file";
import { formatFileSize } from "@/lib/utils";
import { useEffect, useState, memo } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Loader2 } from "lucide-react";
import { CopyFormatMenu } from "./copy-format-menu";
import { motion, AnimatePresence } from "framer-motion";

interface FilePreviewDialogProps {
  file: FileItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  getDirectLink: (id: string) => Promise<string>;
}

export const FilePreviewDialog = memo(function FilePreviewDialog({ file, open, onOpenChange, getDirectLink }: FilePreviewDialogProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    let ignore = false;
    
    if (open && file) {
      // Use queueMicrotask to avoid synchronous setState warning in effect
      queueMicrotask(() => {
        if (!ignore) setLoading(true);
      });
      getDirectLink(file.id)
        .then((newUrl) => {
          if (!ignore) {
            setUrl(newUrl);
            setLoading(false);
          }
        })
        .catch((err) => {
          console.error(err);
          if (!ignore) setLoading(false);
        });
    } else {
      queueMicrotask(() => {
        if (!ignore) {
          setUrl(null);
          setIsMenuOpen(false);
          setLoading(false);
        }
      });
    }

    return () => {
      ignore = true;
    };
  }, [open, file, getDirectLink]);

  if (!file) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-w-[95vw] sm:max-w-7xl w-fit p-0 overflow-hidden bg-transparent border-none shadow-none flex flex-col items-center justify-center focus:outline-none focus:ring-0">
        {/* Hidden Title for Accessibility */}
        <DialogTitle className="sr-only">预览: {file.filename}</DialogTitle>
        <DialogDescription className="sr-only">文件预览详情</DialogDescription>

        <AnimatePresence>
          {open && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ 
                duration: 0.15,
                ease: "easeOut"
              }}
              className="relative group max-h-[90vh] flex items-center justify-center overflow-hidden rounded-lg"
            >
              {/* Top Overlays - Hidden by default, visible on hover or when menu is open */}
              <motion.div 
                className={cn(
                  "absolute inset-x-0 top-0 z-20 flex flex-col pointer-events-none transition-opacity duration-300",
                  (isMenuOpen || loading) ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                )}
              >
                {/* Contrast Scrim - Top-down gradient */}
                <div className="absolute inset-x-0 top-0 h-32 bg-linear-to-b from-black/40 to-transparent -z-10" />
                
                <div className="p-6 flex items-start justify-between gap-4">
                  {/* Left: Info Overlay - Pure Text */}
                  <div className="flex flex-col gap-0.5 pointer-events-auto flex-1 min-w-0 text-left">
                    <span className="text-white/90 text-sm font-medium tracking-tight drop-shadow-md truncate w-full block">
                      {file.filename}
                    </span>
                    <div className="flex items-center gap-2 text-[10px] text-white/50 font-medium drop-shadow-md">
                      <span>{formatFileSize(file.fileSize)}</span>
                      <span className="opacity-30">•</span>
                      <span className="uppercase tracking-wider">{file.fileType}</span>
                      <span className="opacity-30">•</span>
                      <span>{new Date(file.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Right: Actions Overlay - Match FileCard Style */}
                  <div className="pointer-events-auto">
                    <CopyFormatMenu 
                      fileId={file.id} 
                      filename={file.filename}
                      onGetUrl={getDirectLink}
                      onOpenChange={setIsMenuOpen}
                    >
                      <Button 
                        size="sm" 
                        variant="secondary" 
                        className={cn(
                          "h-6 w-6 p-0 rounded-full shadow-lg transition-all hover:scale-110 active:scale-90 focus-visible:ring-0 focus-visible:ring-offset-0",
                          isMenuOpen 
                            ? "bg-white/40 border-white/40 text-white" 
                            : "bg-white/25 hover:bg-white/40 border-white/30 text-white"
                        )} 
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </CopyFormatMenu>
                  </div>
                </div>
              </motion.div>

              <div className="flex items-center justify-center min-h-[200px] min-w-[200px]">
                {loading ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.1 }}
                  >
                    <Loader2 className="w-10 h-10 text-white/50 animate-spin" />
                  </motion.div>
                ) : url ? (
                  file.fileType === 'image' ? (
                    <motion.img
                      src={url}
                      alt={file.filename}
                      loading="eager"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2 }}
                      className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-[0_0_50px_rgba(0,0,0,0.5)] ring-1 ring-white/10"
                    />
                  ) : file.fileType === 'video' ? (
                    <motion.video
                      src={url}
                      controls
                      autoPlay
                      muted
                      preload="auto"
                      playsInline
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2 }}
                      className="max-w-full max-h-[90vh] rounded-lg shadow-[0_0_50px_rgba(0,0,0,0.5)] ring-1 ring-white/10"
                    />
                  ) : (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-background/80 backdrop-blur-xl p-8 rounded-3xl border border-border/50 text-center space-y-4"
                    >
                      <p className="text-muted-foreground">暂不支持预览此类型文件</p>
                      <Button variant="outline" onClick={() => window.open(url, '_blank')}>
                        直接打开
                      </Button>
                    </motion.div>
                  )
                ) : (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-white/50 font-medium"
                  >
                    加载失败
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
});
