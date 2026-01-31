'use client';

import { useState, useEffect } from 'react';
import { PageWrapper } from '@/components/layout/page-wrapper';
import { Share2, RotateCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ShortlinksClient } from '../shortlinks/ShortlinksClient';

export function SharesClient() {
  const [stats, setStats] = useState({ shortlinks: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    loadStats();
  }, [refreshKey]); // Reload stats when key changes

  const loadStats = async () => {
    try {
      const res = await fetch('/api/shortlinks');
      if (res.ok) {
        const data = await res.json();
        setStats({ shortlinks: data.shortlinks?.length || 0 });
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setLoading(true);
    setRefreshKey(prev => prev + 1);
  };

  return (
    <PageWrapper>
      <div className="container mx-auto px-4 pt-24 pb-12">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Share2 className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">分享管理</h1>
              <p className="text-muted-foreground text-sm mt-1">
                管理你的单文件时效分享链接
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline" 
              size="sm"
              onClick={handleRefresh}
              className="h-9 rounded-full px-4 gap-2 border-zinc-200/50 dark:border-white/10 bg-white/50 dark:bg-white/5 backdrop-blur-md hover:bg-zinc-100 dark:hover:bg-white/10 transition-all font-medium shadow-sm"
              disabled={loading}
              title="刷新列表"
            >
              <RotateCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
              <span>刷新</span>
            </Button>
            
            {!loading && stats.shortlinks > 0 && (
              <Badge 
                variant="outline" 
                className="h-9 px-4 rounded-full text-sm font-medium border-zinc-200/50 dark:border-white/10 bg-white/50 dark:bg-white/5 backdrop-blur-md shadow-sm"
              >
                共 {stats.shortlinks} 个链接
              </Badge>
            )}
          </div>
        </div>

        <div className="mt-8">
          <ShortlinksClient key={refreshKey} embedded={true} />
        </div>
      </div>
    </PageWrapper>
  );
}
