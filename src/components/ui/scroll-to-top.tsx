'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.scrollY > 300) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener('scroll', toggleVisibility);

    return () => window.removeEventListener('scroll', toggleVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.5, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.5, y: 20 }}
          className="fixed bottom-32 sm:bottom-10 right-5 z-10001 md:right-10"
        >
          <Button
            size="icon"
            onClick={scrollToTop}
            className={cn(
              "h-10 w-10 md:h-12 md:w-12 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)]",
              "bg-white/95 dark:bg-zinc-800/95 backdrop-blur-md",
              "border border-zinc-200 dark:border-white/10", 
              "text-primary hover:bg-white dark:hover:bg-zinc-800",
              "transition-all duration-300 hover:scale-110 active:scale-95"
            )}
          >
            <ArrowUp className="w-5 h-5 md:w-6 md:h-6" strokeWidth={3} />
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
