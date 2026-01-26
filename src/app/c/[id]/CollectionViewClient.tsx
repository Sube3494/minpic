/* eslint-disable @next/next/no-img-element */
'use client';

import { useState, useEffect, useRef } from 'react';
import { Loader2, ChevronLeft, ChevronRight, Play, Pause, ListVideo, ChevronUp, Sun, Volume2, VolumeX, Maximize, Minimize } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface CollectionItem {
  id: string;
  collectionId: string;
  fileId: string;
  filename: string;
  fileType: string;
  mimeType: string;
  fileUrl: string;
  thumbnailUrl?: string | null;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
  order: number;
}

interface CollectionViewClientProps {
  id: string;
}

export function CollectionViewClient({ id }: CollectionViewClientProps) {
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [showPlaylist, setShowPlaylist] = useState(false); // Enabled via swipe/button
  const [isDesktop, setIsDesktop] = useState(false);
  const [showSwipeHint, setShowSwipeHint] = useState(false);
  
  // Ref to scroll active item into view
  const activeItemRef = useRef<HTMLDivElement>(null);
  const isSwitchingRef = useRef(false);

  // Brightness Control
  const [brightness, setBrightness] = useState(1);
  const [volume, setVolume] = useState(0); // Start at 0 to ensure first video autoplays muted
  const [isAdjusting, setIsAdjusting] = useState<'brightness' | 'volume' | 'none'>('none');
  const startBrightness = useRef(1);
  const startVolume = useRef(1);
  const [showIndicator, setShowIndicator] = useState<'brightness' | 'volume' | false>(false);
  const indicatorTimer = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Custom Player States
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [swipeY, setSwipeY] = useState(0); // TikTok-style gesture offset
  const [edgeNotice, setEdgeNotice] = useState<string | null>(null);
  const edgeNoticeTimer = useRef<NodeJS.Timeout | null>(null);
  const controlsTimer = useRef<NodeJS.Timeout | null>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Helper to get the currently active video element accurately
  const getActiveVideo = () => {
    if (!playerContainerRef.current) return videoRef.current;
    // We look for the video that is not in an exiting state (Framer Motion adds attributes or we can use DOM order)
    const videos = playerContainerRef.current.querySelectorAll('video[data-active="true"]');
    if (videos.length > 1) {
        // Find the one that's actually playing or preferred. 
        // Typically the one that was most recently added is at the end.
        return (videos[videos.length - 1] as HTMLVideoElement);
    }
    return (videos[0] as HTMLVideoElement) || videoRef.current;
  };

  // Carousel Animation Config
  const carouselY = `calc(-${currentIndex * 100}% + ${swipeY}px)`;

  // Keyboard navigation
  useEffect(() => {
    if (loading || items.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
          } else {
            toast.info('已经到顶了');
          }
          break;
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault();
          if (currentIndex < items.length - 1) {
            setCurrentIndex(prev => prev + 1);
          } else {
            triggerEdgeNotice('已经到底了');
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [loading, items.length, currentIndex]);

  const triggerEdgeNotice = (msg: string) => {
    setEdgeNotice(msg);
    if (edgeNoticeTimer.current) clearTimeout(edgeNoticeTimer.current);
    edgeNoticeTimer.current = setTimeout(() => setEdgeNotice(null), 2000);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (isSwitchingRef.current) return;
    if (Math.abs(e.deltaY) < 30) return;

    if (e.deltaY > 0) {
      if (currentIndex < items.length - 1) {
        setCurrentIndex(prev => prev + 1);
        isSwitchingRef.current = true;
        setTimeout(() => isSwitchingRef.current = false, 500);
      } else {
        triggerEdgeNotice('已经到底了');
        isSwitchingRef.current = true;
        setTimeout(() => isSwitchingRef.current = false, 1000);
      }
    } else {
      if (currentIndex > 0) {
        setCurrentIndex(prev => prev - 1);
        isSwitchingRef.current = true;
        setTimeout(() => isSwitchingRef.current = false, 500);
      } else {
        triggerEdgeNotice('已经到顶了');
        isSwitchingRef.current = true;
        setTimeout(() => isSwitchingRef.current = false, 1000);
      }
    }
  };

  const jumpToIndex = (index: number) => {
    setCurrentIndex(index);
  };

  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    startBrightness.current = brightness;
    startVolume.current = volume;
    setIsAdjusting('none');
    
    // Just clear timer, don't show controls yet (wait to see if it's a tap or swipe)
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    
    const touchY = e.touches[0].clientY;
    const deltaY = touchStartY.current - touchY; // Swipe up is positive

    if (Math.abs(deltaY) < 10 && isAdjusting === 'none') return;
    
    // Hide controls if we start adjusting brightness/volume to focus on the indicator
    if (isAdjusting !== 'none') {
        setShowControls(false);
    }

    // If starting on left 25% of screen, adjust brightness
    if (touchStartX.current < window.innerWidth * 0.25) {
        setIsAdjusting('brightness');
        setShowIndicator('brightness');
        if (indicatorTimer.current) clearTimeout(indicatorTimer.current);

        const change = deltaY / 200;
        const newBrightness = Math.max(0.1, Math.min(1, startBrightness.current + change));
        setBrightness(newBrightness);
    } 
    // If starting on right 25% of screen, adjust volume
    else if (touchStartX.current > window.innerWidth * 0.75) {
        setIsAdjusting('volume');
        setShowIndicator('volume');
        if (indicatorTimer.current) clearTimeout(indicatorTimer.current);

        const change = deltaY / 200;
        const newVolume = Math.max(0, Math.min(1, startVolume.current + change));
        setVolume(newVolume);
        
        // Apply volume to video immediately if exists
        const video = getActiveVideo();
        if (video) {
            video.volume = newVolume;
            if (newVolume > 0) video.muted = false;
            else video.muted = true;
        }
    }
    // TikTok Gesture: Vertical swipe follow-finger
    else if (isAdjusting === 'none' && !isDesktop) {
        // We multiply by a factor if we want resistance at ends, but for now linear
        setSwipeY(-deltaY);
        // Hide UI during swipe for "visual silence"
        if (Math.abs(deltaY) > 20) {
            setShowControls(false);
            if (controlsTimer.current) clearTimeout(controlsTimer.current);
        }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    
    const deltaX = touchEndX - touchStartX.current;
    const deltaY = touchEndY - touchStartY.current;
    
    // Only switch if not adjusting
    if (isAdjusting === 'none') {
        // Vertical swipe for video switching
        if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 80) {
            if (deltaY < 0) {
                // Swipe Up -> Next Video
                if (currentIndex < items.length - 1) {
                  setCurrentIndex(prev => prev + 1);
                } else {
                  triggerEdgeNotice('已经到底了');
                }
            } else {
                // Swipe Down -> Prev Video
                if (currentIndex > 0) {
                  setCurrentIndex(prev => prev - 1);
                } else {
                  triggerEdgeNotice('已经到顶了');
                }
            }
        }
    }
    
    // Always reset swipe offset
    setSwipeY(0);
    
    if (isAdjusting !== 'none') {
        indicatorTimer.current = setTimeout(() => {
            setShowIndicator(false);
        }, 800);
    }
    
    touchStartX.current = null;
    touchStartY.current = null;
    setIsAdjusting('none');
    
    // Handle timer based on interaction type
    const isSwipe = Math.abs(deltaY) > 50 || Math.abs(deltaX) > 20;
    if (!isSwipe && deltaY === 0 && deltaX === 0) {
      // Very likely a tap
      resetControlsTimer();
    } else if (showControls) {
      // Swiped but controls were visible, restart the hide timer
      resetControlsTimer(true); // true means skip setShowControls(true)
    }
  };

  // Player Helpers
  const togglePlay = () => {
    const video = getActiveVideo();
    if (!video) return;
    if (isPlaying) {
      video.pause();
    } else {
      video.play().catch(console.error);
    }
  };

  const handleTimeUpdate = () => {
    const video = getActiveVideo();
    if (video) {
      setCurrentTime(video.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    const video = getActiveVideo();
    if (video) {
      setDuration(video.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    const video = getActiveVideo();
    setCurrentTime(time);
    if (video) {
      video.currentTime = time;
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const resetControlsTimer = (skipShow = false) => {
    if (!skipShow) setShowControls(true);
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => {
      const video = getActiveVideo();
      if (video && !video.paused) {
        setShowControls(false);
      }
    }, 2000);
  };

  const handleMouseMove = () => {
    resetControlsTimer();
  };

  const toggleFullScreen = () => {
    if (!playerContainerRef.current) return;
    if (!document.fullscreenElement) {
      playerContainerRef.current.requestFullscreen().catch(console.error);
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFsChange = () => setIsFullScreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Removed forced controls visibility effect to allow "Silent Switching"
  // User interaction (click, move, touch) is now the only trigger for controls visibility.

  useEffect(() => {
    // Reset player state on item change
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, [currentIndex]);
  useEffect(() => {
    loadCollection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [currentIndex]);

  // Show swipe hint on mobile after loading
  useEffect(() => {
    if (!loading && !isDesktop && items.length > 1) {
      const hasSeenHint = localStorage.getItem('hasSeenSwipeHint');
      if (!hasSeenHint) {
        setShowSwipeHint(true);
        const timer = setTimeout(() => {
          setShowSwipeHint(false);
          localStorage.setItem('hasSeenSwipeHint', 'true');
        }, 4000);
        return () => clearTimeout(timer);
      }
    }
  }, [loading, isDesktop, items.length]);

  const loadCollection = async () => {
    try {
      const res = await fetch(`/api/collections/${id}`);
      if (!res.ok) {
        setError(res.status === 404 ? 'not_found' : 'failed');
        return;
      }
      const data = await res.json();
      setItems(data.items || []);
    } catch (err) {
      console.error('Failed to load collection:', err);
      setError('failed');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error === 'not_found' || error === 'failed' || items.length === 0) {
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
              {error === 'not_found' ? '链接已失效' : '无法加载内容'}
            </h2>
            <div className="text-base text-zinc-400 max-w-sm mx-auto leading-relaxed">
              <p>该合集可能已超过有效期，或内容已被发布者移除。</p>
            </div>
          </div>
          <div className="pt-2">
             <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-zinc-900/50 border border-zinc-800/50 text-xs text-zinc-600 font-mono">
               <span>STATUS: {error === 'not_found' ? '404_NOT_FOUND' : 'CONNECTION_FAILED'}</span>
             </div>
          </div>
        </div>
      </div>
    );
  }

  const currentItem = items[currentIndex];

  return (
    <div 
      className="flex flex-col md:flex-row h-dvh bg-black text-white notranslate overflow-hidden overscroll-none touch-none select-none" 
      translate="no"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={() => setShowSwipeHint(false)}
    >
      {/* MAIN STAGE */}
      <div className="flex-1 relative flex flex-col bg-zinc-950 overflow-hidden" onWheel={handleWheel}>
        {/* Mobile Position Indicator */}
        <div className="absolute top-4 right-4 z-40 md:hidden pointer-events-none">
          <div className="bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-xs font-medium text-white/90">
             {currentIndex + 1} / {items.length}
          </div>
        </div>

        {/* Toggle Button (Desktop Only) & Mobile Playlist Toggle */}
        <div className="absolute top-4 left-4 z-50 md:right-4 md:left-auto">
           <Button 
             variant="ghost" 
             size="icon" 
             onClick={() => setShowPlaylist(!showPlaylist)}
             className="text-white/50 hover:text-white bg-black/20 hover:bg-black/40 backdrop-blur-sm rounded-full"
           >
             <ListVideo className="w-6 h-6" />
           </Button>
        </div>

        {/* Content Area */}
        <div 
          ref={playerContainerRef}
          className="flex-1 relative w-full h-full overflow-hidden bg-black"
          onMouseMove={handleMouseMove}
          onClick={() => {
             if (!showControls) {
                handleMouseMove();
             } else {
                togglePlay();
             }
          }}
        >
          {/* Persistent HUD Indicators */}
          <div className="absolute inset-0 pointer-events-none z-50">
            <AnimatePresence>
                {showIndicator === 'brightness' && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                    className="absolute left-6 top-1/2 -translate-y-1/2 bg-black/40 backdrop-blur-xl border border-white/10 p-3 rounded-2xl flex flex-col items-center gap-2"
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
                    className="absolute right-6 top-1/2 -translate-y-1/2 bg-black/40 backdrop-blur-xl border border-white/10 p-3 rounded-2xl flex flex-col items-center gap-2"
                  >
                    <div className="relative w-1 h-24 bg-white/20 rounded-full overflow-hidden">
                       <div className="absolute bottom-0 left-0 right-0 bg-white" style={{ height: `${volume * 100}%` }} />
                    </div>
                    {volume > 0 ? <Volume2 className="w-4 h-4 text-white" /> : <VolumeX className="w-4 h-4 text-zinc-500" />}
                  </motion.div>
                )}
            </AnimatePresence>
          </div>

          <div className="absolute inset-0 w-full h-full overflow-hidden bg-black">
            <motion.div 
               className="w-full h-full flex flex-col"
               animate={{ y: carouselY }}
               transition={{ type: "spring", damping: 35, stiffness: 350, mass: 1 }}
            >
              {items.map((item, index) => {
                const isActive = index === currentIndex;
                const isNearby = Math.abs(index - currentIndex) <= 1; // Only render nearby items for performance
                
                if (!isNearby) return <div key={item.id} className="w-full h-full shrink-0" />;

                return (
                  <div key={item.id} className="w-full h-full shrink-0 relative flex items-center justify-center select-none overflow-hidden bg-black">
                    {/* Premium Ambient Glow Background */}
                    {(item.thumbnailUrl || item.fileUrl) && (
                      <div 
                        className="absolute inset-0 bg-cover bg-center z-0 opacity-20 blur-3xl scale-110 pointer-events-none"
                        style={{ backgroundImage: `url(${item.thumbnailUrl || item.fileUrl})` }}
                      />
                    )}

                    {item.fileType === 'video' ? (
                      <div className="relative w-full h-full flex items-center justify-center bg-transparent overflow-hidden">
                        {/* High-res Placeholder Thumbnail */}
                        {item.thumbnailUrl && !isActive && (
                          <img src={item.thumbnailUrl} className="absolute inset-0 w-full h-full object-contain z-10 opacity-70" alt="" />
                        )}
                        
                        {/* Video Layer - Only instantiated for active or very nearby items if needed, but active is safest */}
                        {isActive && (
                          <>
                            <div 
                                className="absolute inset-0 bg-black pointer-events-none z-20 transition-opacity duration-150"
                                style={{ opacity: (1 - brightness) * 0.8 }} 
                            />
                            <video
                               ref={(el) => {
                                 if (el) {
                                    videoRef.current = el;
                                 } else if (videoRef.current === el) {
                                    videoRef.current = null;
                                 }
                               }}
                               key={item.id}
                               src={item.fileUrl}
                               data-active="true"
                               playsInline 
                               autoPlay
                               muted={volume === 0}
                               className="relative z-10 max-w-full max-h-full w-auto h-auto object-contain"
                               onEnded={() => {
                                 if (currentIndex < items.length - 1) {
                                   jumpToIndex(currentIndex + 1);
                                 }
                               }}
                               onPlay={() => setIsPlaying(true)}
                               onPause={() => setIsPlaying(false)}
                               onTimeUpdate={handleTimeUpdate}
                               onLoadedMetadata={handleLoadedMetadata}
                               onLoadedData={(e) => {
                                 const video = e.currentTarget;
                                 video.volume = volume;
                                 video.muted = volume === 0;
                                 video.playbackRate = playbackRate;
                                 video.play().catch(console.error);
                               }}
                            />
                          </>
                        )}
                      </div>
                    ) : item.fileType === 'image' ? (
                      <div className="relative w-full h-full flex items-center justify-center bg-transparent max-w-full max-h-full">
                          <img src={item.fileUrl} alt="" className="relative max-w-full max-h-full object-contain shadow-[0_0_50px_rgba(0,0,0,0.5)] z-10" />
                      </div>
                    ) : (
                      <div className="text-center text-zinc-500"><p>Unsupported</p></div>
                    )}
                  </div>
                );
              })}
            </motion.div>
          </div>

          {/* Persistent UI Overlays - Outside AnimatePresence to avoid Ref/Event issues */}
          {currentItem.fileType === 'video' && (
            <>
              {/* Mute Hint */}
              <AnimatePresence>
                {volume === 0 && Math.abs(swipeY) < 10 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      const newVol = 0.5;
                      setVolume(newVol);
                      const video = getActiveVideo();
                      if (video) {
                        video.volume = newVol;
                        video.muted = false;
                        video.play().catch(console.error);
                      }
                    }}
                    className="absolute bottom-40 left-1/2 -translate-x-1/2 z-30 pointer-events-auto bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-2xl flex items-center gap-2 cursor-pointer active:scale-95 transition-transform"
                  >
                    <VolumeX className="w-4 h-4 text-white/70" />
                    <span className="text-sm font-medium text-white/90">点击恢复声音</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Edge Notice (Center-Bottom) */}
              <AnimatePresence>
                {edgeNotice && (
                   <motion.div 
                     initial={{ opacity: 0, y: 20 }}
                     animate={{ opacity: 1, y: 0 }}
                     exit={{ opacity: 0, y: 20 }}
                     className="absolute bottom-28 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
                   >
                      <div className="bg-black/60 backdrop-blur-xl border border-white/10 px-6 py-2 rounded-full shadow-2xl">
                         <span className="text-sm font-medium text-white/90 tracking-widest">{edgeNotice}</span>
                      </div>
                   </motion.div>
                )}
              </AnimatePresence>

              {/* Center Play/Pause Feedback */}
              <AnimatePresence>
                 {!isPlaying && Math.abs(swipeY) < 10 && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.2 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePlay();
                      }}
                      className="absolute inset-0 flex items-center justify-center bg-black/5 z-10 pointer-events-auto cursor-pointer"
                    >
                       <div className="w-20 h-20 bg-white/5 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 shadow-2xl">
                          <Play className="w-10 h-10 text-white fill-white ml-1 opacity-80" />
                       </div>
                    </motion.div>
                 )}
              </AnimatePresence>

              {/* Controls Bar */}
              <div 
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  "absolute bottom-0 left-0 right-0 p-6 pt-12 bg-linear-to-t from-black/90 via-black/40 to-transparent transition-opacity duration-500 z-50",
                  showControls ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
              >
                 {/* Progress Bar */}
                 <div className="relative w-full h-1 group/progress mb-4 cursor-pointer flex items-center">
                    <input 
                      type="range"
                      min={0}
                      max={duration || 100}
                      step={0.1}
                      value={currentTime}
                      onChange={handleSeek}
                      onMouseDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      className="absolute inset-x-0 -top-3 bottom-0 w-full opacity-0 z-10 cursor-pointer"
                    />
                    <div className="absolute inset-0 bg-white/10 rounded-full" />
                    <div 
                      className="absolute inset-y-0 left-0 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                      style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                    />
                    <div 
                      className="absolute top-1/2 -translate-y-1/2 h-4 w-4 bg-white rounded-full shadow-xl scale-0 group-hover/progress:scale-110 transition-transform border-2 border-blue-500 z-5"
                      style={{ left: `calc(${(currentTime / (duration || 1)) * 100}% - 8px)` }}
                    />
                 </div>

                 <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                       <button onClick={togglePlay} className="text-white hover:text-blue-400 transition-colors">
                          {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current" />}
                       </button>

                       <div className="flex items-center gap-3">
                          <button 
                            onClick={() => {
                                const newVol = volume === 0 ? 0.5 : 0;
                                setVolume(newVol);
                                const video = getActiveVideo();
                                if (video) {
                                    video.volume = newVol;
                                    video.muted = newVol === 0;
                                }
                            }}
                            className="text-white/80 hover:text-white"
                          >
                             {volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                          </button>
                          <div className="text-xs font-mono text-white/70">
                             <span className="text-white">{formatTime(currentTime)}</span>
                             <span className="mx-1">/</span>
                             <span>{formatTime(duration)}</span>
                          </div>
                       </div>
                    </div>

                    <div className="flex items-center gap-4">
                       <DropdownMenu>
                         <DropdownMenuTrigger asChild>
                           <button className="flex items-center gap-1 bg-white/5 hover:bg-white/10 px-2 py-1 rounded text-xs font-bold text-white/70 hover:text-white transition-colors">
                             {playbackRate.toFixed(1)}x
                             <ChevronUp className="w-3 h-3 rotate-180" />
                           </button>
                         </DropdownMenuTrigger>
                         <DropdownMenuContent align="end" className="bg-zinc-900 border-white/10 text-zinc-300 min-w-[80px]">
                           {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((rate) => (
                             <DropdownMenuItem 
                               key={rate}
                               onClick={() => {
                                 setPlaybackRate(rate);
                                 const video = getActiveVideo();
                                 if (video) video.playbackRate = rate;
                               }}
                               className={cn(
                                 "text-xs justify-center focus:bg-white/10 focus:text-white cursor-pointer",
                                 playbackRate === rate && "bg-white/10 text-white font-bold"
                               )}
                             >
                               {rate.toFixed(1)}x
                             </DropdownMenuItem>
                           ))}
                         </DropdownMenuContent>
                       </DropdownMenu>

                       <button onClick={toggleFullScreen} className="text-white/80 hover:text-white transition-colors">
                          {isFullScreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-6 h-6" />}
                       </button>
                    </div>
                 </div>
              </div>
            </>
          )}

          {/* Desktop Navigation */}
          {currentIndex > 0 && (
            <button onClick={(e) => { e.stopPropagation(); jumpToIndex(currentIndex - 1); }} className="absolute left-6 top-1/2 -translate-y-1/2 p-4 rounded-full bg-black/40 text-white/50 hover:bg-black/60 hover:text-white transition-all opacity-0 group-hover:opacity-100 hidden md:flex items-center justify-center border border-white/5 z-20"><ChevronLeft className="w-8 h-8" /></button>
          )}
          {currentIndex < items.length - 1 && (
            <button onClick={(e) => { e.stopPropagation(); jumpToIndex(currentIndex + 1); }} className="absolute right-6 top-1/2 -translate-y-1/2 p-4 rounded-full bg-black/40 text-white/50 hover:bg-black/60 hover:text-white transition-all opacity-0 group-hover:opacity-100 hidden md:flex items-center justify-center border border-white/5 z-20"><ChevronRight className="w-8 h-8" /></button>
          )}
        </div>
          
        {/* Swipe Hint Overlay */}
        <AnimatePresence>
          {showSwipeHint && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 pointer-events-none z-30 flex flex-col items-center justify-end pb-24 bg-linear-to-t from-black/60 to-transparent"
            >
              <div className="flex flex-col items-center gap-2 animate-bounce">
                <ChevronUp className="w-8 h-8 text-white/80" />
                <span className="text-white/80 text-sm font-medium tracking-widest uppercase">Swipe Up</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* SIDEBAR */}
      <AnimatePresence>
        {showPlaylist && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowPlaylist(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden" />
            <motion.div 
              initial={{ 
                x: isDesktop ? '100%' : '-100%', 
                width: isDesktop ? 0 : '45vw',
                opacity: 0 
              }}
              animate={{ 
                x: 0, 
                width: isDesktop ? (window.innerWidth >= 1024 ? 384 : 320) : '45vw',
                opacity: 1 
              }}
              exit={{ 
                x: isDesktop ? '100%' : '-100%', 
                width: isDesktop ? 0 : '45vw',
                opacity: 0 
              }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className={cn(
                "fixed inset-y-0 left-0 min-w-[160px] bg-black/10 backdrop-blur-3xl border-r border-white/5",
                "md:right-0 md:left-auto md:min-w-0 md:bg-zinc-900/95 md:backdrop-blur-xl md:border-l md:border-r-0 md:border-white/10 md:relative md:flex",
                "z-50 flex flex-col shrink-0 overflow-hidden shadow-2xl"
              )}
            >
              <div className="p-4 border-b border-white/5 md:border-white/10 flex items-center justify-between bg-white/2 md:bg-zinc-900/95 backdrop-blur-md shrink-0 sticky top-0 z-10">
                <div>
                  <h3 className="font-semibold text-base text-white/90 md:text-zinc-100">合集列表</h3>
                  <p className="text-[10px] md:text-xs text-zinc-500 md:text-zinc-400 font-mono md:font-sans mt-0.5 uppercase md:normal-case tracking-wider md:tracking-normal">{currentIndex + 1} / {items.length}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setShowPlaylist(false)} className="hidden md:flex text-zinc-400 hover:text-white hover:bg-white/10 rounded-full w-8 h-8"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></Button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                <div className="space-y-2">
                  {items.map((item, index) => {
                    const isActive = index === currentIndex;
                    const thumbUrl = item.thumbnailUrl || (item.fileType === 'image' ? item.fileUrl : null);
                    
                    return (
                      <div key={item.id} ref={isActive ? activeItemRef : null} onClick={() => jumpToIndex(index)} className={cn("flex gap-3 p-2 rounded-xl cursor-pointer transition-all duration-300 group", isActive ? "bg-white/10 ring-1 ring-white/20" : "hover:bg-white/5")}>
                        <div className="relative w-16 md:w-24 aspect-video bg-zinc-800 rounded-md overflow-hidden shrink-0 shadow-sm">
                          {thumbUrl ? (
                            <img src={thumbUrl} alt="" className={cn("w-full h-full object-cover transition-opacity", isActive ? "opacity-100" : "opacity-70 group-hover:opacity-100")} />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-600">
                                {item.fileType === 'video' ? <ListVideo className="w-5 h-5 opacity-20" /> : <span className="text-xs">No img</span>}
                            </div>
                          )}
                          {isActive && item.fileType === 'video' && <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><Play className="w-6 h-6 text-white fill-white" /></div>}
                          {item.fileType === 'video' && !isActive && <div className="absolute bottom-1 right-1 bg-black/60 px-1 py-0.5 rounded text-[10px] text-white font-mono">{item.duration ? new Date(item.duration * 1000).toISOString().substr(14, 5) : 'Video'}</div>}
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                          <h4 className={cn("text-sm font-medium truncate leading-tight font-mono", isActive ? "text-white" : "text-zinc-400 group-hover:text-zinc-200")}>#{String(index + 1).padStart(2, '0')}</h4>
                          <div className="flex items-center gap-2 text-[11px] text-zinc-600">{item.fileType === 'video' && item.duration ? <span>{new Date(item.duration * 1000).toISOString().substr(14, 5)}</span> : <span className="capitalize">{item.fileType}</span>}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
