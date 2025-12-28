'use client';

import { cn } from '@/lib/utils';

interface StatusIndicatorProps {
  status?: 'unknown' | 'success' | 'error';
  className?: string;
}

export function StatusIndicator({ status = 'unknown', className }: StatusIndicatorProps) {
  return (
    <div className={cn("relative flex items-center justify-center", className)}>
      <div
        className={cn(
          "w-2 h-2 rounded-full transition-all duration-300",
          status === 'success' && "bg-green-500 animate-pulse-slow shadow-[0_0_8px_rgba(34,197,94,0.6)]",
          status === 'error' && "bg-red-500 animate-pulse-slow shadow-[0_0_8px_rgba(239,68,68,0.6)]",
          status === 'unknown' && "bg-gray-400 dark:bg-gray-600"
        )}
      />
    </div>
  );
}
