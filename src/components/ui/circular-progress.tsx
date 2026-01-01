'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface CircularProgressProps {
  value: number; // 0-100
  size?: number;
  strokeWidth?: number;
  className?: string;
  showPercentage?: boolean;
  gradient?: boolean;
  padding?: number;
}

export function CircularProgress({
  value,
  size = 120,
  strokeWidth = 8,
  className,
  showPercentage = true,
  gradient = true,
  padding = 10,
}: CircularProgressProps) {
  // Add some padding to prevent clipping of the glow and outer decorative ring
  const radius = (size - strokeWidth - padding * 2) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;
  const center = size / 2;
  const uniqueId = React.useId().replace(/:/g, '');

  return (
    <div className={cn('relative inline-flex items-center justify-center group', className)}>
      <svg 
        width={size} 
        height={size} 
        viewBox={`0 0 ${size} ${size}`}
        className="transform -rotate-90 transition-transform duration-500"
      >
        <defs>
          {gradient && (
            <>
              <linearGradient id={`progress-gradient-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="var(--stop-0, hsl(var(--primary)))" />
                <stop offset="100%" stopColor="var(--stop-1, hsl(var(--primary)/0.6))" />
              </linearGradient>
              <filter id={`glow-${uniqueId}`} x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="blur" in2="SourceGraphic" operator="over" />
              </filter>
            </>
          )}
        </defs>
        
        {/* Background circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-zinc-100 dark:text-white/10"
        />
        
        {/* Progress circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={gradient ? `url(#progress-gradient-${uniqueId})` : 'currentColor'}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          filter={gradient ? `url(#glow-${uniqueId})` : undefined}
          className={cn(
            'transition-all duration-1000 ease-out',
            !gradient && 'text-primary'
          )}
        />
      </svg>
      
      {showPercentage && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="flex items-baseline gap-0.5">
            <span className="text-2xl font-semibold tracking-tighter text-zinc-800 dark:text-zinc-100">
              {Math.round(value)}
            </span>
            <span className="text-sm font-medium text-zinc-400 dark:text-zinc-500">%</span>
          </div>
        </div>
      )}
    </div>
  );
}
