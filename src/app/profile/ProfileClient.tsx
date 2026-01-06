/*
 * @Date: 2026-01-06 19:19:14
 * @Author: Sube
 * @FilePath: ProfileClient.tsx
 * @LastEditTime: 2026-01-07 03:06:50
 * @Description: 
 */
'use client';

import { useEffect, useState, useMemo } from 'react';
import { PageWrapper } from '@/components/layout/page-wrapper';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Shield, Calendar, Mail, User as UserIcon, Activity, BarChart3, Github, KeyRound, Loader2, Info } from 'lucide-react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { useSearchParams, useRouter } from 'next/navigation';
import { formatFileSize, cn } from '@/lib/utils';
import { useTeam } from '@/hooks/use-team';
import { TeamResourceCard } from '@/components/settings/team-resource-card';
import { PersonalStorageCard } from '@/components/settings/personal-storage-card';
import { Badge } from '@/components/ui/badge';
import { motion, Variants } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

interface UserProfile {
  id: string;
  githubId: string | null;
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
  githubLoginEnabled: boolean;
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
  const { data: session, update } = useSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();

  // Password Change State
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ oldPassword: '', newPassword: '' });

  // Unbind GitHub State
  const [unbindDialogOpen, setUnbindDialogOpen] = useState(false);
  const [unbindLoading, setUnbindLoading] = useState(false);

  // Edit Profile State
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editForm, setEditForm] = useState({ name: '' });
  
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditLoading(true);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editForm.name }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '更新失败');

      await update(); // Update next-auth session
      await fetchData(); // Refresh local data
      setEditProfileOpen(false);
      toast.success('个人资料已更新');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '更新失败');
    } finally {
      setEditLoading(false);
    }
  };

  const openEditDialog = () => {
    setEditForm({ name: profile?.name || '' });
    setEditProfileOpen(true);
  };

  const { teamInfo, leaveTeam } = useTeam();

  const handleLeaveTeam = async () => {
    try {
      await leaveTeam();
    } catch {
      // Error already handled in useTeam
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordLoading(true);

    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[^\s]{8,}$/;
    if (!passwordRegex.test(passwordForm.newPassword)) {
       toast.error('密码需包含字母和数字，且不少于 8 位');
       setPasswordLoading(false);
       return;
    }

    try {
      const res = await fetch('/api/user/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(passwordForm),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || '修改失败');
      } else {
        toast.success('密码修改成功，请重新登录');
        setPasswordDialogOpen(false);
        setPasswordForm({ oldPassword: '', newPassword: '' });
        // Force logout
        signOut({ callbackUrl: '/auth/signin' });
      }
    } catch {
      toast.error('请求失败');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleUnbindGithub = async () => {
    setUnbindLoading(true);
    try {
      const res = await fetch('/api/user/profile/unbind', { method: 'POST' });
      const data = await res.json();
      
      if (res.ok) {
        toast.success('GitHub 账户已成功解绑');
        // Force refresh all data including session to clear avatar everywhere
        await update(); // Update next-auth session
        await fetchData(); // Refresh local profile state
        setUnbindDialogOpen(false);
      } else {
        toast.error(data.error || '解绑失败');
      }
    } catch {
      toast.error('请求失败');
    } finally {
      setUnbindLoading(false);
    }
  };

  const currentMemberInfo = useMemo(() => {
    if (!teamInfo?.team || !session?.user?.id) return null;
    return teamInfo.team.members.find(m => m.userId === session.user.id);
  }, [teamInfo, session]);

  useEffect(() => {
    // Check if we just linked GitHub - Use searchParams for reliability
    if (searchParams.get('linked') === 'true') {
      toast.success('GitHub 账户绑定成功', {
        id: 'github-bind-success', // Prevent duplicates
      });
      // Clean URL without full reload
      const newParams = new URLSearchParams(window.location.search);
      newParams.delete('linked');
      const queryString = newParams.toString();
      router.replace(window.location.pathname + (queryString ? `?${queryString}` : ''));
    }
  }, [searchParams, router]);

  const fetchData = async () => {
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
  };

  useEffect(() => {
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
                      <h2 className="text-2xl sm:text-3xl font-medium tracking-tight text-zinc-900 dark:text-zinc-100">
                        {profile.name && profile.name.toLowerCase() !== profile.username.toLowerCase() 
                          ? profile.name 
                          : `@${profile.username}`}
                      </h2>
                      {profile.role === 'ADMIN' && <Badge className="bg-primary/10 text-primary border-primary/20">管理员</Badge>}
                      
                      <button 
                        onClick={openEditDialog}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-zinc-100 dark:hover:bg-white/10 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                        title="编辑资料"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-pencil"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                      </button>
                    </div>
                    {profile.name && profile.name.toLowerCase() !== profile.username.toLowerCase() && (
                      <p className="text-lg text-zinc-500 font-medium">@{profile.username}</p>
                    )}
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
                <CardContent className="pt-6 px-5 space-y-4">
                  {/* Email Row */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase tracking-widest font-semibold text-zinc-400 pl-1">注册邮箱</label>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-50/50 dark:bg-white/5 border border-zinc-100 dark:border-white/5 group transition-all hover:border-blue-500/20">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="p-2 rounded-lg bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/20 text-blue-500">
                          <Mail className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-sm text-zinc-700 dark:text-zinc-200 truncate select-all font-medium">
                          {profile.email}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* GitHub Row */}
                  {(profile.githubLoginEnabled || profile.githubId) && (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] uppercase tracking-widest font-semibold text-zinc-400 pl-1">社交关联</label>
                      <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-50/50 dark:bg-white/5 border border-zinc-100 dark:border-white/5 group transition-all hover:border-zinc-500/20">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="p-2 rounded-lg bg-zinc-500/5 dark:bg-zinc-500/10 border border-zinc-500/20 text-zinc-500">
                            <Github className="w-3.5 h-3.5" />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-[11px] text-zinc-400 font-medium">GitHub 账户</span>
                            {profile.githubId ? (
                              <Badge variant="outline" className="w-fit h-5 px-1.5 py-0 text-[10px] font-mono border-zinc-200 dark:border-white/10 bg-white/50 dark:bg-black/20 text-zinc-500">
                                {profile.githubId}
                              </Badge>
                            ) : (
                              <span className="text-[11px] text-zinc-500">尚未绑定</span>
                            )}
                          </div>
                        </div>
                        
                        {profile.githubId ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2.5 text-xs text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all rounded-lg"
                            onClick={() => setUnbindDialogOpen(true)}
                          >
                            解绑
                          </Button>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-8 px-3 text-xs bg-primary/10 hover:bg-primary/20 text-primary border-none shadow-none font-medium transition-all rounded-lg"
                            onClick={() => signIn('github', { callbackUrl: '/profile?linked=true' })}
                          >
                            立即绑定
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Last Login Row */}
                  <div className="flex flex-col gap-1.5 pt-1">
                    <label className="text-[10px] uppercase tracking-widest font-semibold text-zinc-400 pl-1">安全审计</label>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-50/50 dark:bg-white/5 border border-zinc-100 dark:border-white/5 group transition-all hover:border-emerald-500/20">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="p-2 rounded-lg bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
                          <Activity className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[11px] text-zinc-400 font-medium">上一次登录活动</span>
                          <span className="text-[11px] text-zinc-600 dark:text-zinc-300 font-medium truncate">
                            {profile.lastLoginAt ? new Date(profile.lastLoginAt).toLocaleString('zh-CN', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: false
                            }) : '刚刚'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Footer */}
                  <div className="pt-4 mt-2 border-t border-dashed border-zinc-200 dark:border-white/10">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full h-9 text-xs gap-2 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-white/10 hover:bg-zinc-50 dark:hover:bg-white/5 transition-all rounded-xl font-medium shadow-none"
                      onClick={() => setPasswordDialogOpen(true)}
                    >
                      <KeyRound className="w-3.5 h-3.5 opacity-60" /> 
                      更新账户密码
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Password Change Dialog */}
            <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
               <DialogContent className="sm:max-w-[480px]">
                  <DialogHeader className="space-y-3">
                    <DialogTitle>修改密码</DialogTitle>
                    <DialogDescription className="space-y-2.5" asChild>
                      <div>
                        <span className="block text-zinc-500 dark:text-zinc-400">
                          为了您的账号安全，请定期修改密码并确保新密码足够复杂。
                        </span>
                        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/10 text-[11px] text-amber-700 dark:text-amber-400/90 leading-relaxed">
                          <Activity className="w-3.5 h-3.5 mt-0.5 shrink-0 opacity-70" />
                          <div>
                            <p className="font-semibold mb-0.5">安全要求：</p>
                            <p>密码必须包含<span className="font-bold underline decoration-amber-500/30 underline-offset-2">字母和数字</span>，长度不少于 <span className="font-bold">8</span> 位。</p>
                          </div>
                        </div>
                      </div>
                    </DialogDescription>
                  </DialogHeader>
                 <form onSubmit={handleChangePassword} className="grid gap-4 py-4">
                   <div className="grid gap-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="oldPassword">旧密码</Label>
                        <button 
                          type="button"
                          onClick={() => {
                            setPasswordDialogOpen(false);
                            signOut({ callbackUrl: '/auth/signin?mode=forgot' });
                          }}
                          className="text-[10px] text-zinc-400 hover:text-primary transition-colors"
                        >
                          忘记旧密码？
                        </button>
                      </div>
                     <Input
                       id="oldPassword"
                       type="password"
                       value={passwordForm.oldPassword}
                       onChange={(e) => setPasswordForm({ ...passwordForm, oldPassword: e.target.value })}
                       required
                     />
                   </div>
                   <div className="grid gap-2">
                     <Label htmlFor="newPassword">新密码</Label>
                      <Input
                        id="newPassword"
                        type="password"
                        className={cn(
                          passwordForm.newPassword && !/^(?=.*[A-Za-z])(?=.*\d)[^\s]{8,}$/.test(passwordForm.newPassword) && "border-red-500/50 dark:border-red-500/50 focus-visible:ring-red-500/20"
                        )}
                        value={passwordForm.newPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                        required
                        minLength={6}
                      />
                      {passwordForm.newPassword && !/^(?=.*[A-Za-z])(?=.*\d)[^\s]{8,}$/.test(passwordForm.newPassword) && (
                        <span className="text-[10px] text-red-500 font-medium animate-in fade-in block mt-1 ml-1">
                          密码需包含字母和数字，且不少于 8 位
                        </span>
                      )}
                   </div>
                   <DialogFooter>
                     <Button type="submit" disabled={passwordLoading}>
                       {passwordLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                       确认修改
                     </Button>
                   </DialogFooter>
                 </form>
               </DialogContent>
            </Dialog>

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

        {/* Unbind GitHub Confirmation Dialog */}
        <ConfirmDialog
          open={unbindDialogOpen}
          onOpenChange={setUnbindDialogOpen}
          title="确认解绑 GitHub？"
          description={
            <div className="space-y-3">
              <p>解绑后，您将无法使用此 GitHub 账号登录。请确保您已设置登录密码。</p>
              <div className="bg-amber-50 dark:bg-amber-500/5 p-3 rounded-xl border border-amber-100 dark:border-amber-500/10 flex gap-3 text-xs text-amber-700 dark:text-amber-400">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <p>解绑不会删除您的数据或物理文件，仅移除社交账号关联。</p>
              </div>
            </div>
          }
          confirmText="确认解绑"
          cancelText="取消"
          onConfirm={handleUnbindGithub}
          isLoading={unbindLoading}
          variant="destructive"
        />
        
        <Dialog open={editProfileOpen} onOpenChange={setEditProfileOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>编辑个人资料</DialogTitle>
              <DialogDescription>
                设置一个独特的昵称，让他人更容易记住您。
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpdateProfile} className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="nickname">昵称</Label>
                <Input
                  id="nickname"
                  value={editForm.name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                  maxLength={32}
                />
                <p className="text-[10px] text-zinc-500">
                  留空则默认显示您的用户名 @{profile?.username}
                </p>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={editLoading}>
                  {editLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  保存更改
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </motion.div>
    </PageWrapper>
  );
}
