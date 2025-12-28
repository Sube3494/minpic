/*
 * @Date: 2025-12-28 17:14:44
 * @Author: Sube
 * @FilePath: status-indicator.tsx
 * @LastEditTime: 2025-12-28 22:10:18
 * @Description: 
 */
'use client';

import { cn } from '@/lib/utils';

interface StatusIndicatorProps {
  status?: 'unknown' | 'success' | 'error';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function StatusIndicator({ status = 'unknown', size = 'md', className }: StatusIndicatorProps) {
  const sizeClasses = {
    sm: "w-1.5 h-1.5",
    md: "w-2 h-2",
    lg: "w-3 h-3"
  };

  return (
    <div className={cn("relative flex items-center justify-center", className)}>
      <div
        className={cn(
          "rounded-full transition-all duration-300",
          sizeClasses[size],
          status === 'success' && "bg-green-500 animate-pulse-slow shadow-[0_0_8px_rgba(34,197,94,0.6)]",
          status === 'error' && "bg-red-500 animate-pulse-slow shadow-[0_0_8px_rgba(239,68,68,0.6)]",
          status === 'unknown' && "bg-gray-400 dark:bg-gray-600"
        )}
      />
    </div>
  );
}
