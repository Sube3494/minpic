/*
 * @Date: 2026-03-04 14:20:00
 * @Author: Sube
 * @FilePath: scroll-to-top.tsx
 * @LastEditTime: 2026-03-04 14:22:00
 * @Description: 返回顶部按钮
 */
'use client';

import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 300);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <button
      onClick={scrollToTop}
      aria-label="返回顶部"
      className={cn(
        // 定位
        'fixed bottom-6 right-6 z-50',
        // 尺寸 & 形状
        'size-13 rounded-full',
        'flex items-center justify-center',
        // 浅色：白色背景 + 明显边框 + 较深阴影
        'bg-white/80 border border-black/10 shadow-xl shadow-black/10',
        // 深色：毛玻璃
        'dark:bg-white/5 dark:border-white/10 dark:shadow-lg dark:shadow-black/30',
        'backdrop-blur-xl',
        // 文字颜色
        'text-foreground/60 hover:text-foreground',
        // hover 背景
        'hover:bg-white dark:hover:bg-white/10',
        // 出入场过渡
        'transition-all duration-200',
        visible
          ? 'opacity-100 translate-y-0 pointer-events-auto'
          : 'opacity-0 translate-y-2 pointer-events-none',
        // 点击缩放
        'active:scale-90'
      )}
    >
      <ArrowUp className="size-5" />
    </button>
  );
}
