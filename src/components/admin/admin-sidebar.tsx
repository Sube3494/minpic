'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useEffect, useRef } from 'react';
import { 
  Users, 
  Shield, 
  Settings, 
  FileText,
  LayoutDashboard,
  ChevronRight,
  BarChart3
} from 'lucide-react';
import { useAdminSidebarStore } from './sidebar-store';

const navItems = [
  {
    title: '数据统计',
    href: '/admin/dashboard',
    icon: BarChart3,
  },
  {
    title: '用户管理',
    href: '/admin/users',
    icon: Users,
  },
  {
    title: '白名单',
    href: '/admin/whitelist',
    icon: Shield,
  },
  {
    title: '系统设置',
    href: '/admin/settings',
    icon: Settings,
  },
  {
    title: '审计日志',
    href: '/admin/audit',
    icon: FileText,
  },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { isOpen, setOpen } = useAdminSidebarStore();
  
  // Refs for position calculation
  const navRef = useRef<HTMLElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLAnchorElement>>(new Map());

  // Update pill position when pathname changes
  useEffect(() => {
    // Find active item based on pathname (handling sub-routes)
    const activeNav = navItems.find(item => 
      pathname === item.href || pathname.startsWith(item.href + '/')
    );
    
    const activeItem = activeNav ? itemRefs.current.get(activeNav.href) : null;

    if (activeItem && pillRef.current) {
      // Use offsetTop for stable calculation regardless of parent transforms
      const offsetY = activeItem.offsetTop;
      
      pillRef.current.style.transform = `translateY(${offsetY}px)`;
      pillRef.current.style.opacity = '1';
    } else if (pillRef.current) {
      pillRef.current.style.opacity = '0';
    }
    
    
    // Auto close sidebar on mobile when route changes
    // Wait for animation to complete
    const timer = setTimeout(() => {
      setOpen(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [pathname, setOpen]);

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={cn(
          // Mobile: Centered floating panel
          "fixed left-1/2 top-24 -translate-x-1/2 z-50 w-[88vw] max-w-[360px] h-auto max-h-[80vh] transition-all duration-300 ease-out",
          "rounded-3xl shadow-2xl lg:shadow-lg border border-zinc-200/50 dark:border-white/10 glass-strong bg-white/50 dark:bg-black/50 backdrop-blur-xl",
          // Mobile Open State
          isOpen ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none lg:opacity-100 lg:scale-100 lg:pointer-events-auto",
          // Desktop: Sticky positioning
          "lg:sticky lg:top-28 lg:left-0 lg:h-[calc(100vh-14rem)] lg:bg-white/50 lg:dark:bg-black/20 lg:z-0 lg:w-72 lg:translate-x-0 lg:translate-y-0"
        )}
      >
        <div className="flex flex-col h-full p-6 overflow-y-auto custom-scrollbar">
        {/* Header */}
        <div className="space-y-2 mb-8 px-2">
          <div className="flex items-center gap-3 text-primary">
            <div className="p-2.5 rounded-xl bg-linear-to-br from-primary/20 to-primary/5 text-primary ring-1 ring-primary/20 shadow-lg shadow-primary/10">
              <LayoutDashboard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight bg-clip-text text-transparent bg-linear-to-r from-foreground to-foreground/70">
                管理后台
              </h2>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                System Admin
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav ref={navRef} className="space-y-2 flex-1 relative">
          {/* Active Background Pill - Pure CSS */}
          <div
            ref={pillRef}
            className="absolute top-0 left-0 right-0 h-12 bg-linear-to-r from-primary to-primary/90 shadow-lg shadow-primary/25 rounded-xl pointer-events-none opacity-0 transition-all duration-300 ease-out"
            style={{ willChange: 'transform, opacity' }}
          />
          
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            const Icon = item.icon;
            
            return (
              <Link
                key={item.href}
                href={item.href}
                scroll={false}
                ref={(el) => {
                  if (el) {
                    itemRefs.current.set(item.href, el);
                  }
                }}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl transition-colors duration-200 group relative h-12',
                  isActive
                    ? 'text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-zinc-100/80 dark:hover:bg-white/5'
                )}
              >
                <Icon className={cn(
                  'w-5 h-5 relative z-10 transition-colors duration-200',
                  isActive ? 'text-white' : 'group-hover:text-foreground'
                )} />
                <span className="relative z-10 font-medium">{item.title}</span>
                
                {/* Arrow */}
                <div className={cn(
                  "ml-auto relative z-10 w-4 h-4 transition-all duration-200",
                  isActive ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2"
                )}>
                  <ChevronRight className={cn(
                    "w-4 h-4",
                    isActive ? "text-primary-foreground" : "text-muted-foreground"
                  )} />
                </div>
              </Link>
            );
          })}
        </nav>


        </div>
      </aside>
    </>
  );
}
