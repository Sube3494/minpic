'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Database, Files, Globe, ShieldCheck } from 'lucide-react';
import { formatFileSize } from '@/lib/utils';

interface PersonalStorageCardProps {
  stats: {
    totalFiles: number;
    totalStorage: number;
  };
}

export function PersonalStorageCard({ stats }: PersonalStorageCardProps) {
  return (
    <Card className="glass-strong border-zinc-200/50 dark:border-white/10 shadow-lg bg-white/50 dark:bg-black/20 overflow-hidden h-full flex flex-col relative group">
      <div className="absolute inset-0 bg-linear-to-br from-emerald-500/5 via-transparent to-transparent opacity-50" />
      
      <CardHeader className="pb-3 shrink-0 relative">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg font-semibold text-zinc-800 dark:text-zinc-100 tracking-tight flex items-center gap-2">
              个人私有资源
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
            </CardTitle>
            <CardDescription className="text-xs text-zinc-500 dark:text-zinc-400">
              您通过私有 MinIO 配置管理的独立存储空间
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6 flex-1 flex flex-col justify-center py-6 relative">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 space-y-2">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <Database className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">存储用量</span>
            </div>
            <div className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              {formatFileSize(stats.totalStorage)}
            </div>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">使用您自己的云端后端</p>
          </div>

          <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 space-y-2">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
              <Files className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">文件总数</span>
            </div>
            <div className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              {stats.totalFiles}
            </div>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">独立隔离存储</p>
          </div>
        </div>

        <div className="pt-2 px-1">
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-zinc-50 dark:bg-white/5 border border-zinc-200/50 dark:border-white/5">
            <Globe className="w-4 h-4 text-zinc-400 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">无配额限制</p>
              <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                此部分文件直接对接您的私有存储，MinPic 系统不设任何存储容量或文件数量限制。
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
