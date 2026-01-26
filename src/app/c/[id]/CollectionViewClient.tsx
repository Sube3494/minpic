/* eslint-disable @next/next/no-img-element */
'use client';

import { useState, useEffect, useRef } from 'react';
import { Loader2, ChevronLeft, ChevronRight, Play, ListVideo, ChevronUp } from 'lucide-react';
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

export function CollectionViewClient({ id }: CollectionViewClientProps) {
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [direction, setDirection] = useState(0); // 1 for next, -1 for prev
  const [showPlaylist, setShowPlaylist] = useState(false); // Enabled via swipe/button
  const [isDesktop, setIsDesktop] = useState(false);
  const [showSwipeHint, setShowSwipeHint] = useState(false);
  
  // Ref to scroll active item into view
  const activeItemRef = useRef<HTMLDivElement>(null);
  const isSwitchingRef = useRef(false);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Animation variants
  const slideVariants = {
    enter: (direction: number) => ({
      y: direction > 0 ? '100%' : '-100%',
      opacity: 0,
      scale: 1, // Remove scale effect for pure slide
    }),
    center: {
      zIndex: 1,
      y: 0,
      opacity: 1,
      scale: 1,
    },
    exit: (direction: number) => ({
      zIndex: 0,
      y: direction < 0 ? '100%' : '-100%',
      opacity: 0,
      scale: 1, // Remove scale effect for pure slide
    })
  };

  // Keyboard navigation
  useEffect(() => {
    if (loading || items.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          if (currentIndex > 0) {
            setDirection(-1);
            setCurrentIndex(prev => prev - 1);
          } else {
            toast.info('已经到顶了');
          }
          break;
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault();
          if (currentIndex < items.length - 1) {
            setDirection(1);
            setCurrentIndex(prev => prev + 1);
          } else {
            toast.info('已经到底了');
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [loading, items.length, currentIndex]);

  const handleWheel = (e: React.WheelEvent) => {
    if (isSwitchingRef.current) return;
    if (Math.abs(e.deltaY) < 30) return;

    if (e.deltaY > 0) {
      if (currentIndex < items.length - 1) {
        setDirection(1);
        setCurrentIndex(prev => prev + 1);
        isSwitchingRef.current = true;
        setTimeout(() => isSwitchingRef.current = false, 500);
      } else {
        toast.info('已经到底了');
        isSwitchingRef.current = true;
        setTimeout(() => isSwitchingRef.current = false, 1000);
      }
    } else {
      if (currentIndex > 0) {
        setDirection(-1);
        setCurrentIndex(prev => prev - 1);
        isSwitchingRef.current = true;
        setTimeout(() => isSwitchingRef.current = false, 500);
      } else {
        toast.info('已经到顶了');
        isSwitchingRef.current = true;
        setTimeout(() => isSwitchingRef.current = false, 1000);
      }
    }
  };

  const jumpToIndex = (index: number) => {
    setDirection(index > currentIndex ? 1 : -1);
    setCurrentIndex(index);
  };

  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    
    const deltaX = touchEndX - touchStartX.current;
    const deltaY = touchEndY - touchStartY.current;
    
    // Vertical swipe for video switching
    if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 50) {
      if (deltaY < 0) {
        // Swipe Up -> Next Video
        if (currentIndex < items.length - 1) {
          setDirection(1);
          setCurrentIndex(prev => prev + 1);
        } else {
          toast.info('已经到底了');
        }
      } else {
        // Swipe Down -> Prev Video
        if (currentIndex > 0) {
          setDirection(-1);
          setCurrentIndex(prev => prev - 1);
        } else {
          toast.info('已经到顶了');
        }
      }
    }
    
    // Horizontal swipe logic removed to avoid back gesture conflict
    
    touchStartX.current = null;
    touchStartY.current = null;
  };

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
        <div className="flex-1 relative w-full h-full overflow-hidden">
          <AnimatePresence initial={false} custom={direction} mode="popLayout">
            <motion.div
              key={currentIndex}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                y: { type: "spring", stiffness: 300, damping: 30 },
                opacity: { duration: 0.2 },
                scale: { duration: 0.4 }
              }}
              className="absolute inset-0 flex items-center justify-center p-0 md:p-8 w-full h-full select-none"
            >
               {currentItem.fileType === 'video' ? (
                 <video
                    key={currentItem.id}
                    src={currentItem.fileUrl}
                    controls
                    autoPlay
                    controlsList="nodownload"
                    onContextMenu={(e) => e.preventDefault()}
                    className="max-w-full max-h-full w-auto h-auto object-contain shadow-2xl focus:outline-none"
                    style={{ maxHeight: '100%' }}
                    onEnded={() => {
                      if (currentIndex < items.length - 1) {
                        jumpToIndex(currentIndex + 1);
                      }
                    }}
                 />
               ) : currentItem.fileType === 'image' ? (
                 <div className="relative w-full h-full flex items-center justify-center">
                     <div 
                       className="absolute inset-0 opacity-20 blur-3xl pointer-events-none"
                       style={{ backgroundImage: `url(${currentItem.thumbnailUrl || currentItem.fileUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                     />
                     <img key={currentItem.id} src={currentItem.fileUrl} alt="" className="relative max-w-full max-h-full object-contain shadow-2xl z-10" onContextMenu={(e) => e.preventDefault()} />
                 </div>
               ) : (
                 <div className="text-center text-zinc-500"><p>Unsupported media type</p></div>
               )}
            </motion.div>
          </AnimatePresence>

          {/* Desktop Navigation */}
          {currentIndex > 0 && (
            <button onClick={() => jumpToIndex(currentIndex - 1)} className="absolute left-6 top-1/2 -translate-y-1/2 p-4 rounded-full bg-black/40 text-white/50 hover:bg-black/60 hover:text-white transition-all opacity-0 group-hover:opacity-100 hidden md:flex items-center justify-center border border-white/5 z-20"><ChevronLeft className="w-8 h-8" /></button>
          )}
          {currentIndex < items.length - 1 && (
            <button onClick={() => jumpToIndex(currentIndex + 1)} className="absolute right-6 top-1/2 -translate-y-1/2 p-4 rounded-full bg-black/40 text-white/50 hover:bg-black/60 hover:text-white transition-all opacity-0 group-hover:opacity-100 hidden md:flex items-center justify-center border border-white/5 z-20"><ChevronRight className="w-8 h-8" /></button>
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
                    return (
                      <div key={item.id} ref={isActive ? activeItemRef : null} onClick={() => jumpToIndex(index)} className={cn("flex gap-3 p-2 rounded-xl cursor-pointer transition-all duration-300 group", isActive ? "bg-white/10 ring-1 ring-white/20" : "hover:bg-white/5")}>
                        <div className="relative w-16 md:w-24 aspect-video bg-zinc-800 rounded-md overflow-hidden shrink-0 shadow-sm">
                          {(item.thumbnailUrl || item.fileUrl) ? <img src={item.thumbnailUrl || item.fileUrl} alt="" className={cn("w-full h-full object-cover transition-opacity", isActive ? "opacity-100" : "opacity-70 group-hover:opacity-100")} /> : <div className="w-full h-full flex items-center justify-center text-zinc-600"><span className="text-xs">No img</span></div>}
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
