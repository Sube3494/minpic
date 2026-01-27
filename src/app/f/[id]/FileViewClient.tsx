/* eslint-disable @next/next/no-img-element */
'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  Loader2, Play, Sun, Volume2, VolumeX, Maximize, Minimize, 
  Repeat, Repeat1
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';

interface FileInfo {
  id: string;
  filename: string;
  fileType: 'image' | 'video' | 'other';
  mimeType: string;
  fileUrl: string;
  thumbnailUrl?: string | null;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
}

interface FileViewClientProps {
  id: string;
}

export function FileViewClient({ id }: FileViewClientProps) {
  const [file, setFile] = useState<FileInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Player States
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [videoDimensions, setVideoDimensions] = useState<{width: number, height: number} | null>(null);
  const [thumbnailError, setThumbnailError] = useState(false);

  // HUD & Adjustments
  const [brightness, setBrightness] = useState(1);
  const [volume, setVolume] = useState(0);
  const [isAdjusting, setIsAdjusting] = useState<'brightness' | 'volume' | 'none'>('none');
  const [showIndicator, setShowIndicator] = useState<'brightness' | 'volume' | false>(false);
  
  const startBrightness = useRef(1);
  const startVolume = useRef(1);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const isLongPressingRef = useRef(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const controlsTimer = useRef<NodeJS.Timeout | null>(null);
  const indicatorTimer = useRef<NodeJS.Timeout | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleResize = () => {
        setIsLandscape(window.innerWidth > window.innerHeight);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    loadFile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadFile = async () => {
    try {
      const res = await fetch(`/api/files/${id}/view`);
      if (!res.ok) {
        setError(res.status === 404 ? 'not_found' : 'failed');
        return;
      }
      const data = await res.json();
      setFile(data);
    } catch (err) {
      console.error('Failed to load file:', err);
      setError('failed');
    } finally {
      setLoading(false);
    }
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    
    if (!video.paused) {
      video.pause();
      setIsPlaying(false);
    } else {
      video.play().catch(console.error);
      setIsPlaying(true);
    }
    resetControlsTimer();
  };

  const resetControlsTimer = () => {
    setShowControls(true);
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => {
      const video = videoRef.current;
      if (video && !video.paused) {
        setShowControls(false);
      }
    }, 2500);
  };

  const handleMouseMove = () => {
    resetControlsTimer();
  };

  const toggleFullScreen = () => {
    if (!playerContainerRef.current) return;
    
    if (!document.fullscreenElement) {
      playerContainerRef.current.requestFullscreen().then(() => {
        if (videoDimensions) {
            const orientation = window.screen.orientation as unknown as { lock: (o: string) => Promise<void> };
            if (orientation && typeof orientation.lock === 'function') {
                if (videoDimensions.width > videoDimensions.height) {
                    orientation.lock('landscape').catch(() => console.log('Landscape lock failed'));
                }
            }
        }
      }).catch(console.error);
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
        const isFS = !!document.fullscreenElement;
        setIsFullScreen(isFS);
        if (!isFS && window.screen.orientation && window.screen.orientation.unlock) {
            window.screen.orientation.unlock();
        }
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    startBrightness.current = brightness;
    startVolume.current = volume;
    setIsAdjusting('none');
    isLongPressingRef.current = false;
    
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
        isLongPressingRef.current = true;
    }, 400);
    
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    
    const touchY = e.touches[0].clientY;
    const deltaY = touchStartY.current - touchY;

    if (!isLongPressingRef.current && (Math.abs(deltaY) > 10 || Math.abs(touchStartX.current - e.touches[0].clientX) > 10)) {
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
    }

    if (Math.abs(deltaY) < 10 && isAdjusting === 'none') return;
    
    if (isLongPressingRef.current || isAdjusting !== 'none') {
        if (isAdjusting !== 'none' || Math.abs(deltaY) > 20) {
            setShowControls(false);
        }

        if (touchStartX.current < window.innerWidth * 0.5) {
            setIsAdjusting('brightness');
            setShowIndicator('brightness');
            if (indicatorTimer.current) clearTimeout(indicatorTimer.current);

            const change = deltaY / 200;
            setBrightness(Math.max(0.1, Math.min(1, startBrightness.current + change)));
        } else {
            setIsAdjusting('volume');
            setShowIndicator('volume');
            if (indicatorTimer.current) clearTimeout(indicatorTimer.current);

            const change = deltaY / 200;
            const newVolume = Math.max(0, Math.min(1, startVolume.current + change));
            setVolume(newVolume);
            if (videoRef.current) {
                videoRef.current.volume = newVolume;
                videoRef.current.muted = newVolume === 0;
            }
        }
    }
  };

  const handleTouchEnd = () => {
    if (isAdjusting !== 'none') {
        indicatorTimer.current = setTimeout(() => {
            setShowIndicator(false);
        }, 800);
    }
    
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    isLongPressingRef.current = false;
    
    touchStartX.current = null;
    touchStartY.current = null;
    setIsAdjusting('none');
    
    resetControlsTimer();
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      setVideoDimensions({ width: videoRef.current.videoWidth, height: videoRef.current.videoHeight });
      // Apply initial volume
      videoRef.current.volume = volume;
      videoRef.current.muted = volume === 0;
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    setCurrentTime(time);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error === 'not_found' || error === 'failed' || !file) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-white/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="text-center space-y-8 relative z-10 px-4 animate-in fade-in zoom-in duration-500">
          <div className="w-24 h-24 mx-auto rounded-full bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 flex items-center justify-center shadow-2xl ring-1 ring-white/10">
            {error === 'not_found' ? (
              <svg className="w-10 h-10 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M13.828 10.172a4 4 0 0 0-5.656 0l-4 4a4 4 0 1 0 5.656 5.656l1.102-1.101m-.758-4.899a4 4 0 0 0 5.656 0l4-4a4 4 0 0 0-5.656-5.656l-1.1 1.1" />
                <line x1="3" y1="21" x2="21" y2="3" />
              </svg>
            ) : (
              <Loader2 className="w-10 h-10 text-red-500/50" />
            )}
          </div>
          <div className="space-y-3">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white/90">
              {error === 'not_found' ? '文件未找到' : '无法加载文件'}
            </h2>
            <div className="text-base text-zinc-400 max-w-sm mx-auto leading-relaxed">
              <p>该文件可能已被删除或无权访问。</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
        className="flex flex-col h-dvh bg-black text-white notranslate overflow-hidden overscroll-none touch-none select-none" 
        translate="no"
        onMouseMove={handleMouseMove}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
    >
      <div className="flex-1 relative flex flex-col bg-zinc-950 overflow-hidden" ref={playerContainerRef}>
        <div 
          className="flex-1 relative w-full h-full overflow-hidden bg-black flex items-center justify-center"
          onClick={file.fileType === 'video' ? togglePlay : undefined}
        >
          {/* Background glow */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.25 }}
            transition={{ duration: 0.8 }}
            className="absolute inset-0 bg-cover bg-center z-0 blur-3xl scale-125 pointer-events-none"
            style={{ backgroundImage: `url(${file.thumbnailUrl || (file.fileType === 'image' ? file.fileUrl : '')})` }}
          />

          {/* HUD Indicators */}
          <div className="absolute inset-0 pointer-events-none z-50">
            <AnimatePresence>
                {showIndicator === 'brightness' && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                    className="absolute left-6 top-1/2 -translate-y-1/2 bg-zinc-900/80 border border-white/10 p-3 rounded-2xl flex flex-col items-center gap-2 shadow-2xl"
                  >
                    <div className="relative w-1 h-24 bg-white/20 rounded-full overflow-hidden">
                       <div className="absolute bottom-0 left-0 right-0 bg-white" style={{ height: `${brightness * 100}%` }} />
                    </div>
                    <Sun className="w-4 h-4 text-white" />
                  </motion.div>
                )}
                {showIndicator === 'volume' && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                    className="absolute right-6 top-1/2 -translate-y-1/2 bg-zinc-900/80 border border-white/10 p-3 rounded-2xl flex flex-col items-center gap-2 shadow-2xl"
                  >
                    <div className="relative w-1 h-24 bg-white/20 rounded-full overflow-hidden">
                       <div className="absolute bottom-0 left-0 right-0 bg-white" style={{ height: `${volume * 100}%` }} />
                    </div>
                    {volume > 0 ? <Volume2 className="w-4 h-4 text-white" /> : <VolumeX className="w-4 h-4 text-zinc-500" />}
                  </motion.div>
                )}
            </AnimatePresence>
          </div>

          <div 
            className="absolute inset-0 bg-black pointer-events-none z-20 transition-opacity duration-300"
            style={{ opacity: (1 - brightness) * 0.8 }} 
          />

          {file.fileType === 'video' ? (
            <div className="relative w-full h-full flex items-center justify-center bg-transparent overflow-hidden">
              {file.thumbnailUrl && !thumbnailError && (
                <img 
                  src={file.thumbnailUrl} 
                  onError={() => setThumbnailError(true)}
                  className={cn(
                      "absolute inset-0 w-full h-full object-contain z-10 transition-opacity duration-300",
                      isPlaying ? "opacity-0 pointer-events-none" : "opacity-100"
                  )} 
                  alt="" 
                />
              )}
              
              <video
                ref={videoRef}
                src={file.fileUrl}
                playsInline 
                autoPlay
                muted
                loop={isLooping}
                className="relative z-10 max-w-full max-h-full w-auto h-auto object-contain"
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={() => {
                    if (!isLooping) setIsPlaying(false);
                }}
              />

              {/* Center Play/Pause Feedback */}
              <AnimatePresence>
                {!isPlaying && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 0.6, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.2 }}
                    className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none"
                  >
                    <Play className="w-24 h-24 text-white fill-white drop-shadow-[0_0_20px_rgba(0,0,0,0.5)]" />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* TikTok Style: Right Sidebar Actions */}
              <div 
                className={cn(
                   "absolute flex transition-all duration-500 z-50",
                   isLandscape
                     ? "right-6 top-1/2 -translate-y-1/2 flex-col gap-1 scale-[0.85] origin-right"
                     : "right-4 bottom-28 flex-col gap-2",
                   showControls ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
                onClick={(e) => e.stopPropagation()}
              >
                  <div className="flex flex-col items-center gap-0.5 group">
                    <Button 
                      variant="ghost" size="icon" 
                      onClick={(e) => {
                         e.stopPropagation();
                         setIsLooping(!isLooping);
                      }}
                      className={cn(
                        "w-12 h-12 bg-zinc-900/80 backdrop-blur-md border border-white/20 rounded-full transition-all duration-200 active:scale-95 shadow-xl hover:bg-zinc-800 active:bg-zinc-700",
                        isLooping ? "text-white bg-zinc-800" : "text-white"
                      )}
                    >
                      {isLooping ? <Repeat1 className="w-6 h-6" /> : <Repeat className="w-6 h-6 opacity-80" />}
                    </Button>
                    <span className="text-[10px] font-bold text-white/90 drop-shadow-md group-active:text-white transition-colors">{isLooping ? '循环' : '单次'}</span>
                  </div>

                  <div className="flex flex-col items-center gap-0.5 group">
                    <Button 
                      variant="ghost" size="icon" 
                      onClick={(e) => {
                         e.stopPropagation();
                         toggleFullScreen();
                      }}
                      className={cn(
                        "w-12 h-12 bg-zinc-900/80 backdrop-blur-md border border-white/20 rounded-full transition-all duration-200 active:scale-95 shadow-xl hover:bg-zinc-800 active:bg-zinc-700",
                        isFullScreen ? "text-white bg-zinc-800" : "text-white"
                      )}
                    >
                      {isFullScreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                    </Button>
                    <span className="text-[10px] font-bold text-white/90 drop-shadow-md group-active:text-white transition-colors">{isFullScreen ? '取消' : '全屏'}</span>
                  </div>

                  <div className="flex flex-col items-center gap-0.5 group">
                    <Button 
                      variant="ghost" size="icon" 
                      onClick={(e) => {
                        e.stopPropagation();
                        const newVol = volume === 0 ? 0.5 : 0;
                        setVolume(newVol);
                        if (videoRef.current) {
                            videoRef.current.volume = newVol;
                            videoRef.current.muted = newVol === 0;
                        }
                      }}
                      className={cn(
                        "w-12 h-12 bg-zinc-900/80 backdrop-blur-md border border-white/20 rounded-full transition-all duration-200 active:scale-95 shadow-xl hover:bg-zinc-800 active:bg-zinc-700",
                        volume === 0 ? "text-white/90" : "text-white"
                      )}
                    >
                      {volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </Button>
                    <span className="text-[10px] font-bold text-white/90 drop-shadow-md group-active:text-white transition-colors">{volume === 0 ? '开音' : '静音'}</span>
                  </div>
              </div>

              {/* TikTok Style: Minimalist Bottom Progress Bar */}
              <div 
                className={cn(
                  "absolute bottom-0 left-0 right-0 z-50 h-1.5 transition-all duration-300 group/progress overflow-visible",
                  showControls ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
                onClick={(e) => e.stopPropagation()}
              >
                  <input 
                    type="range"
                    min={0}
                    max={duration || 100}
                    step={0.1}
                    value={currentTime}
                    onChange={handleSeek}
                    className="absolute inset-x-0 -top-4 -bottom-2 w-full opacity-0 z-20 cursor-pointer"
                  />
                  <div className="absolute inset-0 bg-white/10" />
                  <div 
                    className="absolute inset-y-0 left-0 bg-white shadow-[0_0_15px_rgba(255,255,255,0.6)] rounded-r-full transition-[width] duration-100"
                    style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                  />
                  <div 
                    className="absolute top-1/2 -translate-y-1/2 h-3 w-3 bg-white rounded-full shadow-2xl scale-0 group-hover/progress:scale-100 transition-transform z-10"
                    style={{ left: `calc(${(currentTime / (duration || 1)) * 100}% - 6px)` }}
                   />
               </div>
            </div>
          ) : file.fileType === 'image' ? (
            <div className="relative w-full h-full flex items-center justify-center bg-transparent max-w-full max-h-full">
              <img 
                src={file.fileUrl} 
                alt={file.filename} 
                className="relative max-w-full max-h-full object-contain shadow-[0_0_50px_rgba(0,0,0,0.5)] z-10" 
              />
            </div>
          ) : (
            <div className="text-center text-zinc-500">
              <p>不支持的文件类型</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
