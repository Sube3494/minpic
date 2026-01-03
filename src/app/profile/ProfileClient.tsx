'use client';

import { useEffect, useState, useMemo } from 'react';
import { PageWrapper } from '@/components/layout/page-wrapper';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Shield, Calendar, Mail, User as UserIcon, Activity, BarChart3, Github } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { formatFileSize, cn } from '@/lib/utils';
import { useTeam } from '@/hooks/use-team';
import { TeamResourceCard } from '@/components/settings/team-resource-card';
import { PersonalStorageCard } from '@/components/settings/personal-storage-card';
import { Badge } from '@/components/ui/badge';
import { motion, Variants } from 'framer-motion';

interface UserProfile {
  id: string;
  githubId: string;
  username: string;
  name: string | null;
  email: string | null;
  avatar: string | null;
  role: string;
  status: string;
  storageUsed: string;   // BigInt serialized as string
  fileCount: number;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface UserStats {
  totalFiles: number;
  totalStorage: number;
  personalStats: { totalFiles: number; totalStorage: number };
  teamStats: { totalFiles: number; totalStorage: number };
  personalConfigCount: number;
  recentFiles: number;
  fileTypeDistribution: Array<{ type: string; count: number }>;
}

export function ProfileClient() {
  const { data: session } = useSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { teamInfo, leaveTeam } = useTeam();

  const handleLeaveTeam = async () => {
    try {
      await leaveTeam();
    } catch {
      // Error already handled in useTeam
    }
  };

  const currentMemberInfo = useMemo(() => {
    if (!teamInfo?.team || !session?.user?.id) return null;
    return teamInfo.team.members.find(m => m.userId === session.user.id);
  }, [teamInfo, session]);

  useEffect(() => {
    async function fetchData() {
      try {
        const [profileRes, statsRes] = await Promise.all([
          fetch('/api/user/profile', { cache: 'no-store' }),
          fetch(`/api/user/stats?t=${Date.now()}`, { cache: 'no-store' }),
        ]);

        if (!profileRes.ok) throw new Error('Failed to fetch profile');
        if (!statsRes.ok) throw new Error('Failed to fetch stats');

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
          <p className="text-destructive text-lg font-medium">{error || '无法加载用户信息'}</p>
          <button onClick={() => window.location.reload()} className="px-4 py-2 bg-primary text-white rounded-lg">
            重新加载
          </button>
        </div>
      </PageWrapper>
    );
  }

  const displayName = profile.name || profile.username || 'User';
  const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 15,
        mass: 1
      }
    }
  };

  return (
    <PageWrapper>
      <motion.div 
        className="container mx-auto space-y-10 pt-28 pb-20 px-4 sm:px-8 max-w-7xl"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div className="space-y-1.5 px-1" variants={itemVariants}>
          <h1 className="text-3xl sm:text-4xl font-medium tracking-tight text-zinc-900 dark:text-zinc-100">个人资料</h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm sm:text-base">管理您的账户信息与系统资源使用配额</p>
        </motion.div>

        {/* User Header Card */}
        <motion.div variants={itemVariants}>
          <Card className="glass-strong border-zinc-200/50 dark:border-white/10 shadow-lg bg-white/50 dark:bg-black/20 overflow-hidden relative group">
            <div className="absolute inset-0 bg-linear-to-br from-primary/5 via-transparent to-transparent opacity-50" />
            <CardContent className="p-8 sm:p-10 relative">
              <div className="flex flex-col md:flex-row items-center gap-10">
                <div className="relative">
                  <Avatar className="w-28 h-28 ring-4 ring-zinc-50 dark:ring-white/5 shadow-xl">
                    <AvatarImage 
                      src={profile.avatar || session?.user?.image || undefined} 
                      alt={displayName}
                      referrerPolicy="no-referrer"
                    />
                    <AvatarFallback className="text-3xl bg-primary/5 text-primary font-medium">{initials}</AvatarFallback>
                  </Avatar>
                  {profile.role === 'ADMIN' && (
                    <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-primary text-white rounded-full flex items-center justify-center border-2 border-white dark:border-zinc-900">
                      <Shield className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
                
                <div className="flex-1 text-center md:text-left space-y-5">
                  <div className="space-y-1">
                    <div className="flex items-center justify-center md:justify-start gap-3">
                      <h2 className="text-2xl sm:text-3xl font-medium tracking-tight text-zinc-900 dark:text-zinc-100">{displayName}</h2>
                      {profile.role === 'ADMIN' && <Badge className="bg-primary/10 text-primary border-primary/20">管理员</Badge>}
                    </div>
                    <p className="text-lg text-zinc-500 font-medium">@{profile.username}</p>
                  </div>
                  
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 text-xs">
                    {profile.email && (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-white/5 border border-zinc-200/50 dark:text-zinc-400 font-medium text-zinc-600">
                        <Mail className="w-3.5 h-3.5 opacity-70" /> {profile.email}
                      </div>
                    )}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-white/5 border border-zinc-200/50 dark:text-zinc-400 font-medium text-zinc-600">
                      <Calendar className="w-3.5 h-3.5 opacity-70" /> 加入于 {new Date(profile.createdAt).toLocaleDateString('zh-CN')}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Resources Layout - The Central Hub */}
        <motion.div variants={itemVariants}>
          {(() => {
            const hasTeamCard = !!teamInfo?.team;
            const hasPersonalCard = stats.personalConfigCount > 0 || stats.personalStats.totalFiles > 0;
            
            return (
              <div className={cn(
                "grid gap-8",
                (hasTeamCard && hasPersonalCard) 
                  ? "grid-cols-1 lg:grid-cols-2" 
                  : "grid-cols-1 w-full"
              )}>
                {/* Team Integrated Card */}
                {hasTeamCard && (
                  <TeamResourceCard 
                    teamInfo={teamInfo}
                    memberInfo={currentMemberInfo}
                    isOwner={teamInfo.role === 'OWNER'}
                    usage={{
                      storageUsed: BigInt(stats.teamStats.totalStorage),
                      fileCount: stats.teamStats.totalFiles
                    }}
                    onLeave={handleLeaveTeam}
                  />
                )}

                {/* Personal Storage Card */}
                {hasPersonalCard && (
                  <PersonalStorageCard stats={stats.personalStats} />
                )}
              </div>
            );
          })()}
        </motion.div>

        {/* Secondary Info Grid */}
        <motion.div className="grid grid-cols-1 lg:grid-cols-3 gap-8" variants={itemVariants}>
           {/* Account Details */}
           <div className="lg:col-span-1">
             <Card className="glass-strong border-zinc-200/50 dark:border-white/10 shadow-lg bg-white/50 dark:bg-black/20 h-full overflow-hidden">
               <CardHeader className="pb-3 border-b border-zinc-100 dark:border-white/5">
                 <CardTitle className="flex items-center gap-2.5 text-sm font-medium tracking-wide text-zinc-600 dark:text-zinc-400">
                   <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400">
                     <UserIcon className="w-4 h-4" />
                   </div>
                   账户详情
                 </CardTitle>
               </CardHeader>
               <CardContent className="pt-6 space-y-1">
                 <div className="flex justify-between items-center group/item hover:bg-zinc-50 dark:hover:bg-white/5 p-2 rounded-lg -mx-2 transition-all cursor-default">
                    <span className="text-sm text-zinc-500 dark:text-zinc-400 flex items-center gap-2.5">
                      <Github className="w-3.5 h-3.5" /> GitHub ID
                    </span>
                    <span className="text-sm text-zinc-700 dark:text-zinc-200 select-all">{profile.githubId}</span>
                 </div>
                 <div className="flex justify-between items-center group/item hover:bg-zinc-50 dark:hover:bg-white/5 p-2 rounded-lg -mx-2 transition-all cursor-default">
                    <span className="text-sm text-zinc-500 dark:text-zinc-400 flex items-center gap-2.5">
                      <Shield className="w-3.5 h-3.5" /> 权限等级
                    </span>
                    <span className="text-sm text-zinc-700 dark:text-zinc-200 font-medium">
                      {profile.role === 'ADMIN' ? '管理员' : '普通用户'}
                    </span>
                 </div>
                 <div className="flex justify-between items-center group/item hover:bg-zinc-50 dark:hover:bg-white/5 p-2 rounded-lg -mx-2 transition-all cursor-default">
                    <span className="text-sm text-zinc-500 dark:text-zinc-400 flex items-center gap-2.5">
                      <Activity className="w-3.5 h-3.5" /> 账号状态
                    </span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">活跃中</span>
                    </div>
                 </div>
               </CardContent>
             </Card>
           </div>

           {/* Activity & Distribution */}
           <div className="lg:col-span-2">
             <Card className="glass-strong border-zinc-200/50 dark:border-white/10 shadow-lg bg-white/50 dark:bg-black/20 h-full overflow-hidden flex flex-col">
               <CardHeader className="pb-3 border-b border-zinc-100 dark:border-white/5 shrink-0">
                 <CardTitle className="flex items-center gap-2.5 text-xs font-medium uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                   <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
                     <BarChart3 className="w-3.5 h-3.5" />
                   </div>
                   活动统计与文件分布
                 </CardTitle>
               </CardHeader>
               <CardContent className="pt-8 px-8 pb-10 flex-1 flex flex-col gap-10">
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-12 sm:gap-0">
                   {/* Left: Stats */}
                   <div className="flex gap-16">
                     <div className="space-y-1">
                       <p className="text-[10px] uppercase tracking-widest font-medium text-zinc-400">近期上传</p>
                       <div className="flex items-baseline gap-1">
                         <span className="text-4xl font-medium text-zinc-900 dark:text-zinc-100">+{stats.recentFiles}</span>
                       </div>
                     </div>
                     <div className="space-y-1 border-l border-zinc-100 dark:border-white/5 pl-12 flex-1">
                       <p className="text-[10px] uppercase tracking-widest font-medium text-zinc-400">数据总量</p>
                       <div className="flex items-baseline gap-1.5">
                         {(() => {
                           const formatted = formatFileSize(stats.totalStorage);
                           const [val, unit] = formatted.split(' ');
                           return (
                             <>
                               <span className="text-4xl font-medium text-zinc-900 dark:text-zinc-100">{val}</span>
                               <span className="text-sm font-medium text-zinc-400 uppercase tracking-tighter">{unit}</span>
                             </>
                           );
                         })()}
                       </div>
                     </div>
                   </div>

                   {/* Right: Distribution Visualization */}
                   <div className="space-y-4">
                     <div className="flex items-center justify-between">
                        <p className="text-[10px] uppercase tracking-widest font-medium text-zinc-400">文件类型占比</p>
                        <p className="text-[10px] font-medium text-zinc-400">共 {stats.totalFiles} 个文件</p>
                     </div>
                     <div className="h-2 w-full bg-zinc-100 dark:bg-white/5 rounded-full overflow-hidden flex">
                       {stats.fileTypeDistribution.map((item, idx) => {
                         const percent = (item.count / stats.totalFiles) * 100;
                         return (
                           <div 
                             key={item.type}
                             className={cn(
                               "h-full transition-all duration-1000",
                               idx === 0 ? "bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.2)]" : 
                               idx === 1 ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.2)]" : "bg-zinc-400"
                             )}
                             style={{ width: `${percent}%` }}
                           />
                         );
                       })}
                     </div>
                     <div className="flex flex-wrap gap-x-5 gap-y-2">
                       {stats.fileTypeDistribution.map((item, idx) => (
                         <div key={item.type} className="flex items-center gap-2 group cursor-default">
                           <div className={cn(
                             "w-1.5 h-1.5 rounded-full ring-2 ring-offset-1 ring-transparent group-hover:ring-offset-background transition-all",
                             idx === 0 ? "bg-indigo-500 group-hover:ring-indigo-500/50" : 
                             idx === 1 ? "bg-emerald-500 group-hover:ring-emerald-500/50" : "bg-zinc-400 group-hover:ring-zinc-400/50"
                           )} />
                           <span className="text-[10px] font-medium text-zinc-600 dark:text-zinc-300 capitalize">{item.type}</span>
                           <span className="text-[10px] font-mono font-medium text-zinc-400">{item.count}</span>
                         </div>
                       ))}
                     </div>
                   </div>
                 </div>
               </CardContent>
             </Card>
           </div>
        </motion.div>
      </motion.div>
    </PageWrapper>
  );
}
