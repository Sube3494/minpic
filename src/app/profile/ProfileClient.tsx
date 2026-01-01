'use client';

import { useEffect, useState } from 'react';
import { PageWrapper } from '@/components/layout/page-wrapper';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CircularProgress } from '@/components/ui/circular-progress';
import { Shield, Calendar, HardDrive, FileText, Clock, Mail, User as UserIcon, Activity, BarChart3, Github } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { formatFileSize, cn } from '@/lib/utils';

interface UserProfile {
  id: string;
  githubId: string;
  username: string;
  name: string | null;
  email: string | null;
  avatar: string | null;
  role: string;
  status: string;
  storageQuota: string;  // BigInt serialized as string
  storageUsed: string;   // BigInt serialized as string
  fileQuota: number;
  fileCount: number;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface UserStats {
  totalFiles: number;
  totalStorage: number;
  recentFiles: number;
  fileTypeDistribution: Array<{ type: string; count: number }>;
}

export function ProfileClient() {
  const { data: session } = useSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [profileRes, statsRes] = await Promise.all([
          fetch('/api/user/profile'),
          fetch('/api/user/stats'),
        ]);

        if (!profileRes.ok) {
          const errorData = await profileRes.json();
          throw new Error(errorData.error || 'Failed to fetch profile');
        }

        if (!statsRes.ok) {
          const errorData = await statsRes.json();
          throw new Error(errorData.error || 'Failed to fetch stats');
        }

        const profileData = await profileRes.json();
        const statsData = await statsRes.json();
        setProfile(profileData);
        setStats(statsData);
      } catch (err) {
        console.error('Failed to fetch user data:', err);
        setError(err instanceof Error ? err.message : '加载失败');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <PageWrapper>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-muted-foreground">加载中...</p>
          </div>
        </div>
      </PageWrapper>
    );
  }

  if (error || !profile || !stats) {
    return (
      <PageWrapper>
        <div className="text-center py-12 space-y-4">
          <p className="text-destructive text-lg font-semibold">
            {error || '无法加载用户信息'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            重新加载
          </button>
        </div>
      </PageWrapper>
    );
  }

  const storagePercentage = (stats.totalStorage / Number(profile.storageQuota)) * 100;
  const filePercentage = (stats.totalFiles / profile.fileQuota) * 100;
  const displayName = profile.name || profile.username || 'User';
  const initials = displayName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <PageWrapper>
      <div className="container mx-auto space-y-10 pt-28 pb-20 px-4 sm:px-8 max-w-7xl">
        {/* Page Title - More Compact */}
        <div className="space-y-1.5 px-1">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            个人设置
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm sm:text-base">
            管理您的账户信息与系统资源使用配额
          </p>
        </div>

        {/* User Header Card - Refined Simplification */}
        <Card className="border-zinc-200/50 dark:border-white/10 shadow-lg bg-white dark:bg-black/20 overflow-hidden relative group">
          <div className="absolute inset-0 bg-linear-to-br from-primary/5 via-transparent to-transparent opacity-50" />
          <CardContent className="p-8 sm:p-10 relative">
            <div className="flex flex-col md:flex-row items-center gap-10">
              <div className="relative">
                <Avatar className="w-28 h-28 ring-4 ring-zinc-50 dark:ring-white/5 shadow-xl">
                  <AvatarImage src={profile.avatar || session?.user?.image || undefined} alt={displayName} />
                  <AvatarFallback className="text-3xl bg-primary/5 text-primary font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-primary text-white rounded-full flex items-center justify-center border-2 border-white dark:border-zinc-900 shadow-sm">
                  <Shield className="w-3.5 h-3.5" />
                </div>
              </div>
              
              <div className="flex-1 text-center md:text-left space-y-5">
                <div className="space-y-1">
                  <div className="flex items-center justify-center md:justify-start gap-3">
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">{displayName}</h2>
                    {profile.role === 'ADMIN' && (
                      <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-bold border border-primary/20">
                        管理员
                      </span>
                    )}
                  </div>
                  <p className="text-lg text-zinc-500 font-medium">@{profile.username}</p>
                </div>
                
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 text-xs">
                  {profile.email && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-white/5 border border-zinc-200/50 dark:border-white/5 text-zinc-600 dark:text-zinc-400 font-medium">
                      <Mail className="w-3.5 h-3.5 opacity-70" />
                      {profile.email}
                    </div>
                  )}
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-white/5 border border-zinc-200/50 dark:border-white/5 text-zinc-600 dark:text-zinc-400 font-medium">
                    <Calendar className="w-3.5 h-3.5 opacity-70" />
                    加入于 {new Date(profile.createdAt).toLocaleDateString('zh-CN')}
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold">
                    <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                    账户活跃
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Info Grid - Balanced Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {/* Account Info Card */}
          <Card className="border-zinc-200/50 dark:border-white/10 shadow-lg bg-white dark:bg-black/20 group hover:border-primary/20 transition-all duration-300">
            <CardHeader className="pb-3 border-b border-zinc-100 dark:border-white/5">
              <CardTitle className="flex items-center gap-2.5 text-sm font-medium tracking-wide text-zinc-600 dark:text-zinc-400">
                <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <UserIcon className="w-4 h-4" />
                </div>
                账户详情
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="flex justify-between items-center group/item hover:bg-zinc-50 dark:hover:bg-white/5 p-2 rounded-lg -mx-2 transition-all cursor-default">
                <span className="text-sm text-zinc-600 dark:text-zinc-400 flex items-center gap-2.5">
                  <div className="p-1.5 rounded-md bg-zinc-500/10 text-zinc-500">
                    <Github className="w-3.5 h-3.5" />
                  </div>
                  GitHub ID
                </span>
                <span className="text-sm font-mono text-zinc-700 dark:text-zinc-200 select-all tracking-tight">{profile.githubId}</span>
              </div>

              <div className="flex justify-between items-center group/item hover:bg-zinc-50 dark:hover:bg-white/5 p-2 rounded-lg -mx-2 transition-all cursor-default">
                <span className="text-sm text-zinc-600 dark:text-zinc-400 flex items-center gap-2.5">
                  <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-500">
                    <Shield className="w-3.5 h-3.5" />
                  </div>
                  权限等级
                </span>
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 tracking-tight">{profile.role === 'ADMIN' ? '管理员' : '普通用户'}</span>
              </div>

              <div className="flex justify-between items-center group/item hover:bg-zinc-50 dark:hover:bg-white/5 p-2 rounded-lg -mx-2 transition-all cursor-default">
                <span className="text-sm text-zinc-600 dark:text-zinc-400 flex items-center gap-2.5">
                  <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-500">
                    <Activity className="w-3.5 h-3.5" />
                  </div>
                  账号状态
                </span>
                <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400 tracking-tight">活跃中</span>
              </div>
            </CardContent>
          </Card>

          {/* Storage Quota Card */}
          <Card className="border-zinc-200/50 dark:border-white/10 shadow-lg bg-white dark:bg-black/20 group hover:border-primary/20 transition-all duration-300">
            <CardHeader className="pb-3 border-b border-zinc-100 dark:border-white/5">
              <CardTitle className="flex items-center gap-2.5 text-sm font-medium tracking-wide text-zinc-600 dark:text-zinc-400">
                <div className="p-1.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <HardDrive className="w-4 h-4" />
                </div>
                存储空间
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center pt-8 pb-4 min-h-[260px]">
              <CircularProgress
                value={storagePercentage}
                size={130}
                strokeWidth={8}
                gradient
                className="[--stop-0:#8b5cf6] [--stop-1:#c4b5fd]"
              />
              <div className="mt-6 text-center space-y-1">
                 <div className="flex items-baseline justify-center gap-1">
                   <span className="text-xl font-medium text-zinc-900 dark:text-zinc-100 tracking-tight">
                    {formatFileSize(stats.totalStorage)}
                   </span>
                   <span className="text-sm text-zinc-400">
                    / {formatFileSize(Number(profile.storageQuota))}
                   </span>
                </div>
                <p className="text-xs text-zinc-400 font-medium">已用空间配额</p>
              </div>
            </CardContent>
          </Card>

          {/* File Quota Card */}
          <Card className="border-zinc-200/50 dark:border-white/10 shadow-lg bg-white dark:bg-black/20 group hover:border-primary/20 transition-all duration-300">
            <CardHeader className="pb-3 border-b border-zinc-100 dark:border-white/5">
              <CardTitle className="flex items-center gap-2.5 text-sm font-medium tracking-wide text-zinc-600 dark:text-zinc-400">
                <div className="p-1.5 rounded-md bg-pink-500/10 text-pink-600 dark:text-pink-400">
                  <FileText className="w-4 h-4" />
                </div>
                文件概览
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center pt-8 pb-4 min-h-[260px]">
              <CircularProgress
                value={filePercentage}
                size={130}
                strokeWidth={8}
                gradient
                className="[--stop-0:#f43f5e] [--stop-1:#fb7185]"
              />
              <div className="mt-6 text-center space-y-1">
                 <div className="flex items-baseline justify-center gap-1">
                   <span className="text-xl font-medium text-zinc-900 dark:text-zinc-100 tracking-tight">
                    {stats.totalFiles}
                   </span>
                   <span className="text-sm text-zinc-400">
                    / {profile.fileQuota}
                   </span>
                </div>
                <p className="text-xs text-zinc-400 font-medium">已传文件数量</p>
              </div>
            </CardContent>
          </Card>

          {/* Statistics Card */}
          <Card className="border-zinc-200/50 dark:border-white/10 shadow-lg bg-white dark:bg-black/20 group hover:border-primary/20 transition-all duration-300">
            <CardHeader className="pb-3 border-b border-zinc-100 dark:border-white/5">
              <CardTitle className="flex items-center gap-2.5 text-sm font-medium tracking-wide text-zinc-600 dark:text-zinc-400">
                <div className="p-1.5 rounded-md bg-orange-500/10 text-orange-600 dark:text-orange-400">
                <BarChart3 className="w-4 h-4" />
                </div>
                活动统计
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="flex justify-between items-center group/item hover:bg-zinc-50 dark:hover:bg-white/5 p-2 rounded-lg -mx-2 transition-all cursor-default">
                <span className="text-sm text-zinc-600 dark:text-zinc-400 flex items-center gap-2.5">
                  <div className="p-1.5 rounded-md bg-orange-500/10 text-orange-500">
                    <Clock className="w-3.5 h-3.5" />
                  </div>
                  近期上传
                </span>
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 tracking-tight">+ {stats.recentFiles}</span>
              </div>

              <div className="flex justify-between items-center group/item hover:bg-zinc-50 dark:hover:bg-white/5 p-2 rounded-lg -mx-2 transition-all cursor-default">
                <span className="text-sm text-zinc-600 dark:text-zinc-400 flex items-center gap-2.5">
                  <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-500">
                    <Activity className="w-3.5 h-3.5" />
                  </div>
                  数据总量
                </span>
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 tracking-tight">{formatFileSize(stats.totalStorage)}</span>
              </div>

              {stats.fileTypeDistribution && stats.fileTypeDistribution.length > 0 && (
                <div className="pt-2 space-y-3">
                  <div className="px-1 text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-600">
                    文件分布
                  </div>
                  <div className="space-y-1">
                    {stats.fileTypeDistribution.slice(0, 3).map((item, idx) => (
                      <div key={item.type} className="flex justify-between items-center py-1.5 group/sub">
                        <span className="text-xs text-zinc-500 dark:text-zinc-500 flex items-center gap-2">
                          <span className={cn(
                            "w-1.5 h-1.5 rounded-full shrink-0",
                            idx === 0 ? "bg-pink-500" : idx === 1 ? "bg-purple-500" : "bg-blue-500"
                          )} />
                          {item.type}
                        </span>
                        <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageWrapper>
  );
}
