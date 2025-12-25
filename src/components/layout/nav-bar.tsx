'use client';

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Image, Settings, Github } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ModeToggle } from '@/components/mode-toggle';

const navItems = [
  { href: '/', label: '首页', icon: Home },
  { href: '/settings', label: '存储配置', icon: Settings },
  { href: '/files', label: '文件管理', icon: Image },
];

export function NavBar() {
  const pathname = usePathname();
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0, opacity: 0 });
  const itemsRef = useRef<(HTMLAnchorElement | null)[]>([]);

  useEffect(() => {
    const activeIndex = navItems.findIndex(item => item.href === pathname);
    const activeEl = itemsRef.current[activeIndex];

    if (activeEl) {
      setIndicatorStyle({
        left: activeEl.offsetLeft,
        width: activeEl.offsetWidth,
        opacity: 1
      });
    } else {
      setIndicatorStyle(prev => ({ ...prev, opacity: 0 }));
    }
  }, [pathname]);

  return (
    <nav className="fixed top-3 sm:top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 sm:gap-2 p-1.5 sm:p-2 rounded-full bg-white/50 dark:bg-black/20 backdrop-blur-md border border-zinc-200/50 dark:border-white/10 shadow-lg max-w-[95vw] overflow-hidden">
        {/* Floating Background Pill */}
        {/* Floating Background Pill */}
        {indicatorStyle.width > 0 && (
          <motion.div
            className="absolute bg-primary shadow-md shadow-primary/20 rounded-full z-0 pointer-events-none"
            initial={{
              left: indicatorStyle.left,
              width: indicatorStyle.width,
              opacity: indicatorStyle.opacity,
              height: 'calc(100% - 12px)'
            }}
            animate={{
              left: indicatorStyle.left,
              width: indicatorStyle.width,
              opacity: indicatorStyle.opacity,
              height: 'calc(100% - 12px)'
            }}
            style={{
                top: '6px', 
                height: 'calc(100% - 12px)'
            }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 30
            }}
          />
        )}

        {navItems.map((item, index) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              ref={el => { itemsRef.current[index] = el }}
              className={cn(
                "relative flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full transition-colors duration-300 text-xs sm:text-sm font-medium whitespace-nowrap outline-none z-10",
                isActive
                  ? "text-white"
                  : "text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white"
              )}
            >
              <Icon className={cn("w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 transition-colors duration-500", isActive && "text-white")} />
              <span className={cn("hidden sm:inline transition-colors duration-500", isActive && "text-white")}>{item.label}</span>
            </Link>
          );
        })}
      
      {/* Divider - hidden on mobile */}
      <div className="hidden sm:block w-px h-6 bg-zinc-200 dark:bg-white/10 mx-1 z-10" />
      
      {/* GitHub Link */}
      <a
        href="https://github.com/Sube3494/minpic"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center w-7 h-7 sm:w-9 sm:h-9 rounded-full text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors shrink-0 z-10"
        aria-label="GitHub Repository"
      >
        <Github className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      </a>
      
      {/* Theme Toggle */}
      <div className="shrink-0 z-10">
        <ModeToggle />
      </div>
    </nav>
  );
}
