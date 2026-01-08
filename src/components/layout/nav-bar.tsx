'use client';

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, Image as ImageIcon, Settings, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ModeToggle } from '@/components/mode-toggle';
import { UserMenu } from './user-menu';
import { useSession } from 'next-auth/react';
import { useAdminSidebarStore } from '@/components/admin/sidebar-store';
import Image from 'next/image';

const navItems = [
  { href: '/', label: '首页', icon: Home },
  { href: '/settings', label: '存储配置', icon: Settings },
  { href: '/files', label: '文件管理', icon: ImageIcon },
];

export function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0, opacity: 0 });
  const itemsRef = useRef<(HTMLAnchorElement | null)[]>([]);
  const { toggle: toggleAdminSidebar } = useAdminSidebarStore();
  const isAdminPage = pathname.startsWith('/admin');

  useEffect(() => {
    const updatePosition = () => {
      // Find the active index, but only for '/' if not authenticated
      const activeIndex = navItems.findIndex(item => {
        const isPathMatch = item.href === pathname;
        // Only allow '/' to be active if unauthenticated
        if (status !== 'authenticated' && item.href !== '/') return false;
        return isPathMatch;
      });

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
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    
    return () => window.removeEventListener('resize', updatePosition);
  }, [pathname, status]);

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    // If unauthenticated and clicking a protected route, intercept navigation
    if (status !== 'authenticated' && href !== '/') {
      e.preventDefault();
      // Directly push to signin with callbackUrl to avoid server-side redirect flash/reload
      router.push(`/auth/signin?callbackUrl=${encodeURIComponent(href)}`);
    }
  };

  return (
    <nav className="fixed top-3 sm:top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 sm:gap-1.5 p-1.5 rounded-full bg-white/50 dark:bg-black/20 backdrop-blur-md border border-zinc-200/50 dark:border-white/10 shadow-lg max-w-[95vw] overflow-hidden">
        {/* Floating Background Pill */}
        {indicatorStyle.width > 0 && (
          <motion.div
            className="absolute bg-primary shadow-md shadow-primary/20 rounded-full z-0 pointer-events-none"
            initial={false} // Disable initial animation for smoother transitions
            animate={{
              left: indicatorStyle.left,
              width: indicatorStyle.width,
              opacity: indicatorStyle.opacity,
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

        {/* Logo Section - Hidden on Mobile and Tablet to save space */}
        <Link href="/" className="hidden lg:flex items-center gap-2 px-1.5 py-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors duration-300 z-10 ml-2">
          <Image src="/minpic.svg" alt="Logo" width={24} height={24} className="w-6 h-6 object-contain" />
        </Link>

        {/* Vertical Divider after Logo - Hidden on Mobile and Tablet */}
        <div className="hidden lg:block w-px h-4 bg-zinc-200 dark:bg-white/10 mx-1.5 z-10" />

        {navItems.map((item, index) => {
          // A path is active only if it matches AND (is home OR user is authenticated)
          const isActive = pathname === item.href && (item.href === '/' || status === 'authenticated');
          const Icon = item.icon;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              ref={el => { itemsRef.current[index] = el }}
              onClick={(e) => handleLinkClick(e, item.href)}
              className={cn(
                "relative flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full transition-colors duration-300 text-sm font-medium whitespace-nowrap outline-none z-10",
                isActive
                  ? "text-white"
                  : "text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white"
              )}
            >
              <Icon className={cn("w-4 h-4 sm:w-4.5 sm:h-4.5 shrink-0 transition-colors duration-500", isActive && "text-white")} />
              <span className={cn("hidden sm:inline transition-colors duration-500", isActive && "text-white")}>{item.label}</span>
            </Link>
          );
        })}
      
      {/* Action Divider - Always Visible */}
      <div className="w-px h-4 sm:h-5 bg-zinc-200 dark:bg-white/10 mx-1.5 z-10" />

      {/* User Menu (if logged in) */}
      {session?.user && (
        <UserMenu user={session.user} />
      )}
      
      {/* Theme Toggle */}
      <div className="shrink-0 z-10 ml-0.5">
        <ModeToggle />
      </div>

      {/* Admin Mobile Menu Toggle */}
      {isAdminPage && (
        <button
          onClick={toggleAdminSidebar}
          className="flex lg:hidden items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors shrink-0 z-10"
          aria-label="Toggle Admin Menu"
        >
          <Menu className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
        </button>
      )}
    </nav>
  );
}
