/* eslint-disable @next/next/no-img-element */
'use client';

import { useState, useEffect, useRef } from 'react';
import { Loader2, ChevronLeft, ChevronRight, Play, ListVideo } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface CollectionItem {
  id: string;
// ... (keep interface)
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
  const [showPlaylist, setShowPlaylist] = useState(true); // Toggle playlist on mobile
  
  // Ref to scroll active item into view
  const activeItemRef = useRef<HTMLDivElement>(null);
  const isSwitchingRef = useRef(false);

  // Keyboard navigation
  useEffect(() => {
    if (loading || items.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowUp': // Playlist navigation
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
            toast.info('已经到底了');
          }
          break;
        case ' ': // Space to pause? (Native behavior might be enough)
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [loading, items.length, currentIndex]); // Added currentIndex dependency

  const handleWheel = (e: React.WheelEvent) => {
    if (isSwitchingRef.current) return;
    
    // Threshold to prevent accidental small scrolls
    if (Math.abs(e.deltaY) < 30) return;

    if (e.deltaY > 0) {
      // Scroll Down -> Next
      if (currentIndex < items.length - 1) {
        setCurrentIndex(prev => prev + 1);
        isSwitchingRef.current = true;
        setTimeout(() => isSwitchingRef.current = false, 500);
      } else {
        toast.info('已经到底了');
        isSwitchingRef.current = true;
        setTimeout(() => isSwitchingRef.current = false, 1000); // 1s debounce for toast
      }
    } else {
      // Scroll Up -> Prev
      if (currentIndex > 0) {
        setCurrentIndex(prev => prev - 1);
        isSwitchingRef.current = true;
        setTimeout(() => isSwitchingRef.current = false, 500);
      } else {
        toast.info('已经到顶了');
        isSwitchingRef.current = true;
        setTimeout(() => isSwitchingRef.current = false, 1000); // 1s debounce for toast
      }
    }
  };

  useEffect(() => {
    loadCollection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Scroll active item into view when index changes
  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [currentIndex]);

  const loadCollection = async () => {
    try {
      const res = await fetch(`/api/collections/${id}`);
      if (!res.ok) {
        if (res.status === 404) {
          setError('not_found');
        } else {
          setError('failed');
        }
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
        {/* Ambient Bg */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-white/5 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="text-center space-y-8 relative z-10 px-4 animate-in fade-in zoom-in duration-500">
          {/* Icon */}
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
          
          {/* Text */}
          <div className="space-y-3">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white/90">
              {error === 'not_found' ? '链接已失效' : '无法加载内容'}
            </h2>
            <div className="text-base text-zinc-400 max-w-sm mx-auto leading-relaxed">
              <p>该合集可能已超过有效期，或内容已被发布者移除。</p>
            </div>
          </div>

          {/* Code */}
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
    <div className="flex flex-col md:flex-row h-screen bg-black text-white notranslate overflow-hidden" translate="no">
      {/* 
        MAIN STAGE (Left/Top) 
      */}
      <div className="flex-1 relative flex flex-col bg-zinc-950 overflow-hidden" onWheel={handleWheel}>
        
        {/* Toggle Playlist Button */}
        <div className="absolute top-4 right-4 z-50">
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
        <div className="flex-1 relative flex items-center justify-center p-0 md:p-4 w-full h-full select-none">
           {currentItem.fileType === 'video' ? (
             <video
                key={currentItem.id}
                src={currentItem.fileUrl}
                controls
                autoPlay
                controlsList="nodownload"
                onContextMenu={(e) => e.preventDefault()}
                className="max-w-full max-h-full w-auto h-auto object-contain shadow-2xl focus:outline-none"
                style={{ maxHeight: 'calc(100vh - 32px)' }}
                onEnded={() => {
                  if (currentIndex < items.length - 1) {
                    setCurrentIndex(currentIndex + 1);
                  }
                }}
             />
           ) : currentItem.fileType === 'image' ? (
             <div className="relative w-full h-full flex items-center justify-center">
                 {/* Blurred Background */}
                 <div 
                   className="absolute inset-0 opacity-20 blur-3xl pointer-events-none"
                   style={{ 
                     backgroundImage: `url(${currentItem.thumbnailUrl || currentItem.fileUrl})`, 
                     backgroundSize: 'cover', 
                     backgroundPosition: 'center' 
                   }}
                 />
                 <img
                    key={currentItem.id}
                    src={currentItem.fileUrl}
                    alt=""
                    className="relative max-w-full max-h-full object-contain shadow-2xl z-10"
                    onContextMenu={(e) => e.preventDefault()}
                 />
             </div>
           ) : (
             <div className="text-center text-zinc-500">
               <p>Unsupported media type</p>
             </div>
           )}

           {/* Navigation Arrows (Desktop Overlay) */}
           {currentIndex > 0 && (
             <button
               onClick={() => setCurrentIndex(currentIndex - 1)}
               className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/50 text-white/50 hover:bg-black/80 hover:text-white hover:scale-110 transition-all opacity-0 group-hover:opacity-100 hidden md:block"
             >
               <ChevronLeft className="w-8 h-8" />
             </button>
           )}
           {currentIndex < items.length - 1 && (
             <button
               onClick={() => setCurrentIndex(currentIndex + 1)}
               className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/50 text-white/50 hover:bg-black/80 hover:text-white hover:scale-110 transition-all opacity-0 group-hover:opacity-100 hidden md:block"
             >
               <ChevronRight className="w-8 h-8" />
             </button>
           )}
        </div>
      </div>

      {/* 
        PLAYLIST SIDEBAR (Right/Bottom)
      */}
      <div className={cn(
        "bg-zinc-900 border-l border-white/10 flex flex-col shrink-0 transition-all duration-300 z-20 overflow-hidden",
        showPlaylist 
          ? "w-full h-[30vh] md:w-80 lg:w-96 md:h-full opacity-100" 
          : "w-full h-0 md:w-0 md:h-full opacity-0 border-none px-0"
      )}>
         {/* Playlist Header */}
         <div className="p-4 border-b border-white/10 flex items-center justify-between bg-zinc-900/95 backdrop-blur-sm shrink-0 sticky top-0 z-10">
            <div>
              <h3 className="font-semibold text-base text-zinc-100">合集列表</h3>
              <p className="text-xs text-zinc-400 mt-0.5">{currentIndex + 1} / {items.length}</p>
            </div>
            {/* Maybe a toggle button for mobile? */}
         </div>

         {/* Playlist Items */}
         <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
            <div className="space-y-2">
              {items.map((item, index) => {
                const isActive = index === currentIndex;
                return (
                  <div
                    key={item.id}
                    ref={isActive ? activeItemRef : null}
                    onClick={() => setCurrentIndex(index)}
                    className={cn(
                      "flex gap-3 p-2 rounded-lg cursor-pointer transition-all duration-200 group",
                      isActive 
                        ? "bg-white/10 border border-white/10" 
                        : "hover:bg-white/5 border border-transparent"
                    )}
                  >
                    {/* Thumbnail */}
                    <div className="relative w-24 aspect-video bg-zinc-800 rounded-md overflow-hidden shrink-0">
                      {(item.thumbnailUrl || item.fileUrl) ? (
                        <img
                          src={item.thumbnailUrl || item.fileUrl}
                          alt=""
                          className={cn(
                            "w-full h-full object-cover transition-opacity",
                            isActive ? "opacity-100" : "opacity-70 group-hover:opacity-100"
                          )}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-600">
                          <span className="text-xs">No img</span>
                        </div>
                      )}
                      
                      {/* Playing Indicator */}
                      {isActive && item.fileType === 'video' && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                           <Play className="w-6 h-6 text-white fill-white" />
                        </div>
                      )}
                      {/* Video Badge */}
                      {item.fileType === 'video' && !isActive && (
                         <div className="absolute bottom-1 right-1 bg-black/60 px-1 py-0.5 rounded text-[10px] text-white font-mono">
                           {item.duration ? new Date(item.duration * 1000).toISOString().substr(14, 5) : 'Video'}
                         </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                       <h4 className={cn(
                         "text-sm font-medium truncate leading-tight font-mono",
                         isActive ? "text-white" : "text-zinc-400 group-hover:text-zinc-200"
                       )}>
                         #{String(index + 1).padStart(2, '0')}
                       </h4>
                       <div className="flex items-center gap-2 text-[11px] text-zinc-600">
                          {item.fileType === 'video' && item.duration ? (
                             <span>{new Date(item.duration * 1000).toISOString().substr(14, 5)}</span>
                          ) : (
                             <span className="capitalize">{item.fileType}</span>
                          )}
                       </div>
                    </div>
                  </div>
                );
              })}
            </div>
         </div>
      </div>
    </div>
  );
}
