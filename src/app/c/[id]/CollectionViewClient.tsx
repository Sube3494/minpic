/* eslint-disable @next/next/no-img-element */
'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Loader2, ChevronLeft, ChevronRight, Play, ListVideo, Sun, Volume2, VolumeX, Maximize, Minimize, Repeat, Repeat1, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';


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

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

export function CollectionViewClient({ id }: CollectionViewClientProps) {
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [showPlaylist, setShowPlaylist] = useState(false); // Enabled via swipe/button
  const [isDesktop, setIsDesktop] = useState(false);
  
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
  const [isTransitioning, setIsTransitioning] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [swipeY, setSwipeY] = useState(0); // TikTok-style gesture offset
  const [edgeNotice, setEdgeNotice] = useState<string | null>(null);
  const [showPageIndicator, setShowPageIndicator] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [videoDimensions, setVideoDimensions] = useState<{width: number, height: number} | null>(null);
  const [showSwipeHint, setShowSwipeHint] = useState(false);
  const edgeNoticeTimer = useRef<NodeJS.Timeout | null>(null);
  const pageIndicatorTimer = useRef<NodeJS.Timeout | null>(null);
  const controlsTimer = useRef<NodeJS.Timeout | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isLongPressingRef = useRef(false);
  const swipeHintTimer = useRef<NodeJS.Timeout | null>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  
  // Detect collection type for smart button visibility
  const collectionType = useMemo(() => {
    if (items.length === 0) return 'unknown';
    const hasVideo = items.some(item => item.fileType === 'video');
    const hasImage = items.some(item => item.fileType === 'image');
    
    if (hasVideo && !hasImage) return 'video-only';
    if (hasImage && !hasVideo) return 'image-only';
    return 'mixed';
  }, [items]);
  
  // Determine button visibility based on collection type and current item
  const currentItem = items[currentIndex];
  const isCurrentVideo = currentItem?.fileType === 'video';
  const shouldShowVideoControls = collectionType === 'video-only' || (collectionType === 'mixed' && isCurrentVideo);
  
  useEffect(() => {
    const handleResize = () => {
        setIsDesktop(window.innerWidth >= 768);
        setIsLandscape(window.innerWidth > window.innerHeight);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Initialize swipe hint on mobile (every time collection opens)
  useEffect(() => {
    if (!isDesktop && items.length > 0) {
      // Show hint after a brief delay to let video load
      const initTimer = setTimeout(() => {
        setShowSwipeHint(true);
      }, 500);
      
      // Auto-hide after 3 seconds
      if (swipeHintTimer.current) clearTimeout(swipeHintTimer.current);
      swipeHintTimer.current = setTimeout(() => {
        setShowSwipeHint(false);
      }, 3500); // 500ms delay + 3000ms display
      
      return () => {
        clearTimeout(initTimer);
        if (swipeHintTimer.current) clearTimeout(swipeHintTimer.current);
      };
    }
  }, [isDesktop, items.length]);


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
            setCurrentIndex((prev: number) => prev - 1);
          } else {
            toast.info('已经到顶了');
          }
          break;
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault();
          if (currentIndex < items.length - 1) {
            setCurrentIndex((prev: number) => prev + 1);
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
    // Hide swipe hint on any touch
    if (showSwipeHint) {
      setShowSwipeHint(false);
      if (swipeHintTimer.current) clearTimeout(swipeHintTimer.current);
    }
    
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    startBrightness.current = brightness;
    startVolume.current = volume;
    setIsAdjusting('none');
    isLongPressingRef.current = false;
    
    // Start long press timer
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
        isLongPressingRef.current = true;
        // Optionally provide haptic/visual feedback here
    }, 400); // 400ms for long press
    
    // Just clear timer, don't show controls yet (wait to see if it's a tap or swipe)
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    
    const touchY = e.touches[0].clientY;
    const deltaY = touchStartY.current - touchY; // Swipe up is positive

    // If moved significantly before timer, it's a swipe, not a long-press
    if (!isLongPressingRef.current && (Math.abs(deltaY) > 10 || Math.abs(touchStartX.current - e.touches[0].clientX) > 10)) {
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
    }

    if (Math.abs(deltaY) < 10 && isAdjusting === 'none') return;
    
    // If long pressing, allowed to adjust HUD
    if (isLongPressingRef.current || isAdjusting !== 'none') {
        // Hide controls if we start adjusting brightness/volume to focus on the indicator
        if (isAdjusting !== 'none' || Math.abs(deltaY) > 20) {
            setShowControls(false);
        }

        // If starting on left 50% of screen, adjust brightness
        if (touchStartX.current < window.innerWidth * 0.5) {
            // Brightness adjustment removed: keep the source video's native brightness.
        } 
        // If starting on right 50% of screen, adjust volume
        else {
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
    }
    // TikTok Gesture: Vertical swipe follow-finger (Only if NOT long-pressing)
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
        if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 40) {
            if (deltaY < 0) {
                // Swipe Up -> Next Video
                if (currentIndex < items.length - 1) {
                  setCurrentIndex((prev: number) => prev + 1);
                } else {
                  triggerEdgeNotice('已经到底了');
                }
            } else {
                // Swipe Down -> Prev Video
                if (currentIndex > 0) {
                  setCurrentIndex((prev: number) => prev - 1);
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
    
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    isLongPressingRef.current = false;
    
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
    
    if (!video.paused) {
      video.pause();
      setIsPlaying(false);
    } else {
      video.playbackRate = 1;
      video.loop = isLooping;
      video.play().catch(console.error);
      setIsPlaying(true);
    }
    resetControlsTimer();
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
      setVideoDimensions({ width: video.videoWidth, height: video.videoHeight });
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
      playerContainerRef.current.requestFullscreen().then(() => {
        // Smart Orientation: 
        if (videoDimensions) {
            const orientation = window.screen.orientation as unknown as { lock: (o: string) => Promise<void> };
            if (orientation && typeof orientation.lock === 'function') {
                if (videoDimensions.width > videoDimensions.height) {
                    // Landscape video -> Rotate to landscape
                    orientation.lock('landscape').catch(() => console.log('Landscape lock failed'));
                }
                // For portrait videos, don't lock orientation - keep device's current orientation

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

  // Removed forced controls visibility effect to allow "Silent Switching"
  // User interaction (click, move, touch) is now the only trigger for controls visibility.

  useEffect(() => {
    // Reset player state on item change
    setIsTransitioning(true);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);

    // Sync metadata from the new active video if it's already preloaded
    const video = getActiveVideo();
    if (video) {
        video.playbackRate = 1;
        video.loop = isLooping;
        if (video.readyState >= 1) { // HAVE_METADATA or more
            setDuration(video.duration);
            setCurrentTime(video.currentTime);
            setVideoDimensions({ width: video.videoWidth, height: video.videoHeight });
        }
        // Force play if it was pre-mounted but paused
        video.play().catch(() => {
            setIsTransitioning(false);
        });
    }

    // Trigger Top Page Indicator
    setShowPageIndicator(true);
    if (pageIndicatorTimer.current) clearTimeout(pageIndicatorTimer.current);
    pageIndicatorTimer.current = setTimeout(() => {
        setShowPageIndicator(false);
    }, 2000);

  }, [currentIndex, isLooping]);

  useEffect(() => {
    const video = getActiveVideo();
    if (video) {
        video.playbackRate = 1;
        video.loop = isLooping;
        video.volume = volume;
        video.muted = volume === 0;
    }
  }, [isLooping, volume, currentIndex]);

  useEffect(() => {
    loadCollection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (showPlaylist && activeItemRef.current) {
      activeItemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [currentIndex, showPlaylist]);


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


  return (
    <div 
      className="flex flex-col md:flex-row h-dvh bg-black text-white notranslate overflow-hidden overscroll-none touch-none select-none" 
      translate="no"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={() => {}}
    >
      {/* MAIN STAGE */}
      <div className="flex-1 relative flex flex-col bg-zinc-950 overflow-hidden" onWheel={handleWheel} style={{ touchAction: 'none' }}>
        {/* Mobile Position Indicator */}
        {/* Note: Top labels removed for cleaner TikTok look */}

        {/* Content Area */}
        <div 
          ref={playerContainerRef}
          className="flex-1 relative w-full h-full overflow-hidden bg-black"
          onMouseMove={handleMouseMove}
          onClick={() => {
             togglePlay();
             handleMouseMove();
          }}
        >
          {/* Persistent HUD Indicators */}
          <div className="absolute inset-0 pointer-events-none z-50">
            <AnimatePresence>
                {showIndicator === 'brightness' && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                    className="absolute left-6 top-1/2 -translate-y-1/2 bg-zinc-950/40 backdrop-blur-md border border-white/10 p-3 rounded-2xl flex flex-col items-center gap-2 shadow-2xl"
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
                    className="absolute right-6 top-1/2 -translate-y-1/2 bg-zinc-950/40 backdrop-blur-md border border-white/10 p-3 rounded-2xl flex flex-col items-center gap-2 shadow-2xl"
                  >
                    <div className="relative w-1 h-24 bg-white/20 rounded-full overflow-hidden">
                       <div className="absolute bottom-0 left-0 right-0 bg-white" style={{ height: `${volume * 100}%` }} />
                    </div>
                    {volume > 0 ? <Volume2 className="w-4 h-4 text-white" /> : <VolumeX className="w-4 h-4 text-zinc-500" />}
                  </motion.div>
                )}
            </AnimatePresence>
          </div>

          {/* Persistent Shared Ambient Glow Background */}
          {items.map((item: CollectionItem, index: number) => (
             <motion.div
               key={`glow-${item.id}`}
               initial={{ opacity: 0 }}
               animate={{ opacity: index === currentIndex ? 0.25 : 0 }}
               transition={{ duration: 0.8 }}
               className="absolute inset-0 bg-cover bg-center z-0 blur-3xl scale-125 pointer-events-none"
               style={{ backgroundImage: `url(${item.thumbnailUrl || (item.fileType === 'image' ? item.fileUrl : '')})` }}
             />
          ))}

          <div className="absolute inset-0 w-full h-full overflow-hidden">
            <motion.div 
               className="w-full h-full flex flex-col"
               animate={{ y: carouselY }}
                transition={swipeY !== 0
                  ? { duration: 0 }
                  : { type: "spring", damping: 34, stiffness: 360, mass: 0.8 }}
            >
              {items.map((item: CollectionItem, index: number) => {
                const isActive = index === currentIndex;
                const isNearby = Math.abs(index - currentIndex) <= 1; // Only render nearby items for performance
                
                if (!isNearby) return <div key={item.id} className="w-full h-full shrink-0" />;

                return (
                  <div key={item.id} className="w-full h-full shrink-0 relative flex items-center justify-center select-none overflow-hidden">
                    {/* Background removed here, moved to persistent shared layer above */}

                    {item.fileType === 'video' ? (
                      <div className="relative w-full h-full flex items-center justify-center bg-transparent overflow-hidden">
                        {/* High-res Placeholder Thumbnail - Show when not playing or loading */}
                        {item.thumbnailUrl && (
                          <img 
                            src={item.thumbnailUrl} 
                            className={cn(
                                "absolute inset-0 w-full h-full object-contain z-10 transition-opacity duration-300",
                                (isActive && !isTransitioning) ? "opacity-0 pointer-events-none" : "opacity-100"
                            )} 
                            alt="" 
                          />
                        )}
                        
                        {/* Video Layer - Keep nearby videos mounted for seamless slide */}
                        {isNearby && (
                          <>
                            <div 
                                className="absolute inset-0 bg-black pointer-events-none z-20 transition-opacity duration-150"
                                style={{ opacity: 0 }} 
                            />
                            <video
                               ref={(el) => {
                                 if (el && isActive) {
                                    videoRef.current = el;
                                 }
                               }}
                               key={item.id}
                               src={item.fileUrl}
                               data-active={isActive ? "true" : "false"}
                               playsInline 
                               autoPlay={isActive}
                               muted={!isActive || volume === 0}
                               loop={isLooping}
                               className="relative z-10 max-w-full max-h-full w-auto h-auto object-contain"
                               onEnded={() => {
                                 if (isActive && !isLooping && currentIndex < items.length - 1) {
                                   jumpToIndex(currentIndex + 1);
                                 }
                               }}
                               onPlay={() => {
                                 if (isActive) {
                                     setIsPlaying(true);
                                 }
                               }}
                               onPlaying={() => {
                                 if (isActive) {
                                     setIsTransitioning(false);
                                 }
                               }}
                               onPause={() => {
                                 if (isActive) setIsPlaying(false);
                               }}
                               onTimeUpdate={isActive ? handleTimeUpdate : undefined}
                               onLoadedMetadata={isActive ? handleLoadedMetadata : undefined}
                               onLoadedData={(e) => {
                                 const video = e.currentTarget;
                                 if (isActive) {
                                     video.volume = volume;
                                     video.muted = volume === 0;
                                     video.playbackRate = 1;
                                     video.play().catch(() => {
                                        setIsTransitioning(false);
                                     });
                                 } else {
                                     video.pause();
                                 }
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

          {/* Persistent UI Overlays - Moved out of video check for universal availability */}
          {items.length > 0 && (
            <>
              {/* Edge Notice (Center-Bottom) */}
              <AnimatePresence>
                {edgeNotice && (
                   <motion.div 
                     initial={{ opacity: 0, y: 20 }}
                     animate={{ opacity: 1, y: 0 }}
                     exit={{ opacity: 0, y: 20 }}
                     className="absolute bottom-28 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
                   >
                      <span className="text-sm font-normal text-white/90 tracking-widest drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] uppercase">{edgeNotice}</span>
                   </motion.div>
                )}
              </AnimatePresence>

               {/* Center Play/Pause Feedback */}
              <AnimatePresence>
                 {!isPlaying && !isTransitioning && Math.abs(swipeY) < 10 && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 0.6, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.2 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePlay();
                      }}
                      className="absolute inset-0 flex items-center justify-center z-10 pointer-events-auto cursor-pointer"
                    >
                       <Play className="w-24 h-24 text-white fill-white drop-shadow-[0_0_20px_rgba(0,0,0,0.5)]" />
                    </motion.div>
                 )}
              </AnimatePresence>

              {/* TikTok Style: Right Sidebar Actions */}
              <div 
                className={cn(
                   "absolute flex transition-all duration-500 z-50",
                   // Avoid layout break in landscape regardless of video orientation
                   isLandscape
                     ? "right-6 top-1/2 -translate-y-1/2 flex-col gap-1 scale-[0.85] origin-right" // Extra Compact Landscape
                     : "right-4 bottom-28 flex-col gap-1.5 scale-90 origin-right", // Compact Vertical Bottom-Right
                   showControls ? "opacity-100" : "opacity-0"
                )}
                onClick={(e) => e.stopPropagation()}
              >
                  <div className="flex flex-col items-center gap-0.5 group">
                    <Button 
                      variant="ghost" size="icon" 
                      onClick={(e) => {
                         e.stopPropagation();
                         e.preventDefault();
                         setShowPlaylist(!showPlaylist);
                      }}
                       className="w-12 h-12 bg-zinc-900/90 backdrop-blur-sm border border-white/20 rounded-full text-white transition-all duration-200 shadow-xl hover:bg-zinc-800/95 hover:border-white/30 active:scale-95 active:bg-zinc-800/90 focus:ring-0 focus-visible:ring-0 focus:outline-none focus:bg-zinc-900/90"
                    >
                      <ListVideo className="w-6 h-6" />
                    </Button>
                    <span className="text-[10px] font-medium text-white/90 drop-shadow-md transition-colors">列表</span>
                 </div>


                  {shouldShowVideoControls && (
                    <div className="flex flex-col items-center gap-0.5 group">
                      <Button 
                        variant="ghost" size="icon" 
                        onClick={(e) => {
                           e.stopPropagation();
                           e.preventDefault();
                           setIsLooping(!isLooping);
                        }}
                        className={cn(
                          "w-12 h-12 bg-zinc-900/90 backdrop-blur-sm border rounded-full text-white transition-all duration-200 shadow-xl hover:bg-zinc-800/95 hover:border-white/30 active:scale-95 active:bg-zinc-800/90 focus:ring-0 focus-visible:ring-0 focus:outline-none",
                          isLooping ? "border-white/40 bg-zinc-800/95 focus:bg-zinc-800/95" : "border-white/20 focus:bg-zinc-900/90"
                        )}
                      >
                        {isLooping ? <Repeat1 className="w-6 h-6" /> : <Repeat className="w-6 h-6" />}
                      </Button>
                      <span className="text-[10px] font-medium text-white/90 drop-shadow-sm transition-colors">{isLooping ? '循环' : '顺序'}</span>
                   </div>
                  )}

                  <div className="flex flex-col items-center gap-0.5 group">
                    <Button 
                      variant="ghost" size="icon" 
                      onClick={(e) => {
                         e.stopPropagation();
                         e.preventDefault();
                         toggleFullScreen();
                      }}
                      className={cn(
                        "w-12 h-12 bg-zinc-900/90 backdrop-blur-sm border rounded-full text-white transition-all duration-200 shadow-xl hover:bg-zinc-800/95 hover:border-white/30 active:scale-95 active:bg-zinc-800/90 focus:ring-0 focus-visible:ring-0 focus:outline-none",
                        isFullScreen ? "border-white/40 bg-zinc-800/95 focus:bg-zinc-800/95" : "border-white/20 focus:bg-zinc-900/90"
                      )}
                    >
                      {isFullScreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                    </Button>
                    <span className="text-[10px] font-medium text-white/90 drop-shadow-sm transition-colors">{isFullScreen ? '取消' : '全屏'}</span>
                 </div>

                  {shouldShowVideoControls && (
                    <div className="flex flex-col items-center gap-0.5 group">
                      <Button 
                        variant="ghost" size="icon" 
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          const newVol = volume === 0 ? 0.5 : 0;
                          setVolume(newVol);
                          const video = getActiveVideo();
                          if (video) {
                              video.volume = newVol;
                              video.muted = newVol === 0;
                          }
                        }}
                        className={cn(
                          "w-12 h-12 bg-zinc-900/90 backdrop-blur-sm border rounded-full text-white transition-all duration-200 shadow-xl hover:bg-zinc-800/95 hover:border-white/30 active:scale-95 active:bg-zinc-800/90",
                          volume === 0 ? "border-white/10" : "border-white/20"
                        )}
                      >
                        {volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                      </Button>
                      <span className="text-[10px] font-medium text-white/90 drop-shadow-sm transition-colors">{volume === 0 ? '开音' : '静音'}</span>
                   </div>
                  )}
              </div>



              {/* High-contrast progress bar with an always-visible seek thumb */}
              <div 
                className={cn(
                  "absolute bottom-0 left-3 right-3 z-50 h-7 pb-2 transition-all duration-300 group/progress overflow-visible",
                  showControls && !isPlaying ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
                onClick={(e) => e.stopPropagation()}
              >
                  <div className="absolute inset-x-0 bottom-2 h-1.5">
                    <div
                      className="absolute inset-0 rounded-full"
                      style={{ background: `linear-gradient(to right, rgba(255,255,255,0.95) ${(currentTime / (duration || 1)) * 100}%, rgba(255,255,255,0.4) ${(currentTime / (duration || 1)) * 100}%)` }}
                    />
                    <input
                      type="range"
                      min={0}
                      max={duration || 100}
                      step={0.1}
                      value={currentTime}
                      onChange={handleSeek}
                      onPointerDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      className="absolute inset-x-0 -top-1.5 z-10 h-4 w-full cursor-pointer opacity-0"
                      aria-label="视频进度"
                    />
                    <span
                      className="pointer-events-none absolute top-1/2 z-20 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.65)]"
                      style={{ left: `${(currentTime / (duration || 1)) * 100}%` }}
                    />
                  </div>
                  <span className="absolute left-1/2 bottom-8 -translate-x-1/2 text-2xl font-medium tabular-nums tracking-wide text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>
             </>
           )}
        </div>
      </div>

      {/* Desktop Navigation */}
          {currentIndex > 0 && (
            <button onClick={(e) => { e.stopPropagation(); jumpToIndex(currentIndex - 1); }} className="absolute left-6 top-1/2 -translate-y-1/2 p-4 rounded-full bg-black/40 text-white/50 hover:bg-black/60 hover:text-white transition-all opacity-0 group-hover:opacity-100 hidden md:flex items-center justify-center border border-white/5 z-20"><ChevronLeft className="w-8 h-8" /></button>
          )}
          {currentIndex < items.length - 1 && (
            <button onClick={(e) => { e.stopPropagation(); jumpToIndex(currentIndex + 1); }} className="absolute right-6 top-1/2 -translate-y-1/2 p-4 rounded-full bg-black/40 text-white/50 hover:bg-black/60 hover:text-white transition-all opacity-0 group-hover:opacity-100 hidden md:flex items-center justify-center border border-white/5 z-20"><ChevronRight className="w-8 h-8" /></button>
          )}
          
        {/* Swipe Hint Overlay */}
        <AnimatePresence>
          {showSwipeHint && !isDesktop && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.4 }}
              className="absolute bottom-32 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
            >
              <div className="flex flex-col items-center gap-3">
                {/* Animated Arrow Icons */}
                <motion.div
                  animate={{ 
                    y: [0, -15, 0],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  className="flex flex-col items-center"
                >
                  {/* Double Upward Arrows */}
                  <ChevronUp className="w-10 h-10 text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.6)]" strokeWidth={3} />
                  <ChevronUp className="w-10 h-10 text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.6)] -mt-4" strokeWidth={3} />
                </motion.div>
                
                {/* Text Hint */}
                <motion.div
                  animate={{ 
                    opacity: [0.7, 1, 0.7]
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  className="bg-zinc-900/90 backdrop-blur-sm px-4 py-2 rounded-full border border-white/20"
                >
                  <span className="text-sm font-medium text-white/90 tracking-wide">向上滑动</span>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
              transition={{ type: 'tween', duration: 0.25, ease: [0.21, 0.47, 0.32, 0.98] }}
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
                  {items.map((item: CollectionItem, index: number) => {
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
