import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { FileItem } from "@/types/file";
import { formatFileSize } from "@/lib/utils";
import { useEffect, useState, memo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Loader2, Pause, Play, Volume2, VolumeX, Maximize, MoreVertical } from "lucide-react";
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

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
          setIsPlaying(false);
          setProgress(0);
          setDuration(0);
        }
      });
    }

    return () => {
      ignore = true;
    };
  }, [open, file, getDirectLink]);

  if (!file) return null;

  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds)) return '00:00';
    const minutes = Math.floor(seconds / 60);
    const remaining = Math.floor(seconds % 60);
    return `${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`;
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => undefined);
    else video.pause();
  };

  const seek = (value: number) => {
    const video = videoRef.current;
    if (!video || !duration) return;
    video.currentTime = value;
    setProgress(value);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    if (!video.muted && video.volume === 0) video.volume = volume || 1;
    setVolume(video.muted ? 0 : video.volume);
  };

  const toggleFullscreen = () => {
    const video = videoRef.current;
    if (!video) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    else video.requestFullscreen?.().catch(() => undefined);
  };

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
                {/* Contrast Scrim - Top-down gradient - Increased height for smoother transition */}
                <div className="absolute inset-x-0 top-0 h-48 bg-linear-to-b from-black/30 to-transparent -z-10" />
                
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
                    <div className="relative group/video max-w-full max-h-[90vh] rounded-lg overflow-hidden bg-black shadow-[0_0_50px_rgba(0,0,0,0.5)] ring-1 ring-white/10">
                    <motion.video
                      ref={videoRef}
                      src={url}
                      autoPlay
                      muted
                      preload="auto"
                      playsInline
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2 }}
                      onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                      onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime)}
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      onClick={togglePlay}
                      className="block max-w-full max-h-[90vh]"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-4 pb-3 pt-8 opacity-0 transition-opacity group-hover/video:opacity-100">
                      <input
                        type="range"
                        min={0}
                        max={duration || 0}
                        step={0.1}
                        value={progress}
                        onChange={(e) => seek(Number(e.target.value))}
                        aria-label="视频进度"
                        className="mb-2 h-1 w-full cursor-pointer accent-white"
                      />
                      <div className="flex items-center gap-3 text-white">
                        <button type="button" onClick={togglePlay} aria-label={isPlaying ? '暂停' : '播放'}>
                          {isPlaying ? <Pause className="h-4 w-4 fill-white" /> : <Play className="h-4 w-4 fill-white" />}
                        </button>
                        <span className="text-xs tabular-nums">{formatTime(progress)} / {formatTime(duration)}</span>
                        <button type="button" onClick={toggleMute} aria-label={volume ? '静音' : '取消静音'} className="ml-auto">
                          {volume ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                        </button>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.05}
                          value={volume}
                          onChange={(e) => {
                            const next = Number(e.target.value);
                            setVolume(next);
                            if (videoRef.current) {
                              videoRef.current.volume = next;
                              videoRef.current.muted = next === 0;
                            }
                          }}
                          aria-label="音量"
                          className="hidden w-16 cursor-pointer accent-white sm:block"
                        />
                        <button type="button" onClick={toggleFullscreen} aria-label="全屏">
                          <Maximize className="h-4 w-4" />
                        </button>
                        <MoreVertical className="h-4 w-4 opacity-70" />
                      </div>
                    </div>
                    </div>
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
