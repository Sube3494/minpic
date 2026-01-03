'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Users, UserPlus, LogOut, Trash2, Copy, Check, Settings2, AlertTriangle, CheckCircle2, HardDrive, File as FileIcon } from 'lucide-react';
import { motion, AnimatePresence, Variants } from 'framer-motion';

import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialogFooter } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PageWrapper } from '@/components/layout/page-wrapper';
import { useTeam } from '@/hooks/use-team';
import { formatFileSize, cn } from '@/lib/utils';
import { MemberCard } from '@/components/teams/member-card';

export default function TeamsPage() {
  const { data: session } = useSession();
  const { teamInfo, inviteCodes, loading, createTeam, updateTeam, deleteTeam, leaveTeam, generateInvite, joinTeam, removeMember, loadInviteCodes, setMemberQuota, deleteInviteCode } = useTeam();
  
  const [createDialog, setCreateDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [leaveDialog, setLeaveDialog] = useState(false);
  const [inviteDialog, setInviteDialog] = useState(false);
  const [joinDialog, setJoinDialog] = useState(false);
  const [removeDialog, setRemoveDialog] = useState<{ open: boolean; userId: string; username: string }>({ open: false, userId: '', username: '' });
  const [inviteManageDialog, setInviteManageDialog] = useState(false);
  const [quotaDialog, setQuotaDialog] = useState<{ open: boolean; userId: string; username: string; nickname?: string | null; currentStorageQuota: number | null; currentFileQuota: number | null }>({ open: false, userId: '', username: '', nickname: null, currentStorageQuota: null, currentFileQuota: null });
  const [editDialog, setEditDialog] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    storageQuotaMB: '',
    fileQuota: '',
    autoAllocateQuota: false,
    defaultStorageQuotaMB: '',
    defaultFileQuota: ''
  });
  const [updating, setUpdating] = useState(false);
  
  const [teamName, setTeamName] = useState('');
  const [teamDescription, setTeamDescription] = useState('');
  const [teamStorageQuotaMB, setTeamStorageQuotaMB] = useState<number | string>(500); // 默认 500MB
  const [teamFileQuota, setTeamFileQuota] = useState<number | string>(1000); // 默认1000文件
  const [inviteCode, setInviteCode] = useState('');
  const [inviteCodeCopied, setInviteCodeCopied] = useState(false);
  const [joinInviteCode, setJoinInviteCode] = useState('');
  const [maxUses, setMaxUses] = useState<number | string>(5);
  const [expiresInMinutes, setExpiresInMinutes] = useState<number | string>(1440); // 默认24小时

  useEffect(() => {
    if (inviteManageDialog) {
      loadInviteCodes();
    }
  }, [inviteManageDialog, loadInviteCodes]);

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.3
      }
    }
  };



  const handleCreateTeam = async () => {
    if (!teamName.trim()) {
      toast.error('请输入团队名称');
      return;
    }
    
    const storageMB = Number(teamStorageQuotaMB);
    const fileQuotaNum = Number(teamFileQuota);
    
    if (!storageMB || storageMB <= 0) {
      toast.error('请设置有效的存储配额');
      return;
    }
    
    if (!fileQuotaNum || fileQuotaNum <= 0) {
      toast.error('请设置有效的文件数配额');
      return;
    }
    
    try {
      await createTeam(teamName, teamDescription, storageMB, fileQuotaNum);
      setCreateDialog(false);
      setTeamName('');
      setTeamDescription('');
      setTeamStorageQuotaMB(500);
      setTeamFileQuota(1000);
    } catch {
      // Error already handled in hook
    }
  };

  const handleGenerateInvite = async () => {
    try {
      // Use defaults if input is empty
      const finalExpires = expiresInMinutes === '' ? 1440 : Number(expiresInMinutes);
      const finalMaxUses = maxUses === '' ? 5 : Number(maxUses);
      
      const result = await generateInvite(finalExpires, finalMaxUses);
      setInviteCode(result.inviteCode);
      setInviteDialog(true);
    } catch {
      // Error already handled in hook
    }
  };

  const handleRemoveMember = async () => {
    try {
      await removeMember(removeDialog.userId);
      setRemoveDialog({ open: false, userId: '', username: '' });
    } catch {
      // Error already handled in hook
    }
  };

  const copyInviteCode = () => {
    navigator.clipboard.writeText(inviteCode);
    setInviteCodeCopied(true);
    toast.success('邀请码已复制');
    setTimeout(() => setInviteCodeCopied(false), 2000);
  };

  const handleJoinTeam = async () => {
    if (!joinInviteCode.trim()) {
      toast.error('请输入邀请码');
      return;
    }
    
    try {
      await joinTeam(joinInviteCode);
      setJoinDialog(false);
      setJoinInviteCode('');
    } catch {
      // Error already handled in hook
    }
  };

  const handleEditClick = () => {
    if (!teamInfo?.team) return;
    setEditForm({
      name: teamInfo.team.name,
      description: teamInfo.team.description || '',
      storageQuotaMB: teamInfo.team.storageQuota ? (Number(teamInfo.team.storageQuota) / (1024 * 1024)).toString() : '500', 
      fileQuota: teamInfo.team.fileQuota.toString(),
      autoAllocateQuota: teamInfo.team.autoAllocateQuota || false,
      defaultStorageQuotaMB: teamInfo.team.defaultStorageQuota ? (Number(teamInfo.team.defaultStorageQuota) / (1024 * 1024)).toString() : '',
      defaultFileQuota: teamInfo.team.defaultFileQuota ? teamInfo.team.defaultFileQuota.toString() : ''
    });
    setEditDialog(true);
  };

  const handleUpdateTeam = async () => {
    setUpdating(true);
    try {
      await updateTeam(
        editForm.name, 
        editForm.description, 
        Number(editForm.storageQuotaMB), 
        Number(editForm.fileQuota),
        editForm.autoAllocateQuota,
        Number(editForm.defaultStorageQuotaMB),
        Number(editForm.defaultFileQuota)
      );
      setEditDialog(false);
    } catch {
      // Toast handled by hook
    } finally {
      setUpdating(false);
    }
  };

  const isOwner = teamInfo?.role === 'OWNER';
  const isMember = teamInfo?.team && !isOwner;

  return (
    <PageWrapper>
      <div className="min-h-screen p-4 sm:p-6 md:p-12 pb-32">
        <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6 mt-12 sm:mt-16">
            <div className="space-y-1 md:space-y-2">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight text-glow">
                <span className="bg-clip-text text-transparent bg-linear-to-r from-zinc-900 to-zinc-500 dark:from-white dark:to-white/40">
                  团队管理
                </span>
              </h1>
              <p className="text-muted-foreground text-xs sm:text-sm md:text-lg">
                共享存储配置和配额，文件独立隔离
              </p>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="skeleton"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <Skeleton className="h-64 w-full rounded-2xl" />
              </motion.div>
            ) : (
              <motion.div
                key="content"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {!teamInfo?.team ? (
                  // No Team State
                  <Card className="glass-strong border-zinc-200/50 dark:border-white/10 shadow-lg">
                    <CardContent className="p-12 flex flex-col items-center text-center space-y-6">
                      <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="w-10 h-10 text-primary" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-xl font-bold">您还没有团队</h3>
                        <p className="text-sm text-muted-foreground max-w-md">
                          创建团队后，成员可以共享您的存储配置和配额，同时保持文件完全隔离
                        </p>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <Button onClick={() => setCreateDialog(true)} size="lg" className="gap-2">
                          <UserPlus className="w-4 h-4" />
                          创建团队
                        </Button>
                        <Button onClick={() => setJoinDialog(true)} size="lg" variant="outline" className="gap-2">
                          <Users className="w-4 h-4" />
                          加入团队
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  // Has Team State
                  <div className="space-y-6">
                    {/* Team Info Card */}
                    <Card className="glass-strong border-zinc-200/50 dark:border-white/10 shadow-lg bg-white/50 dark:bg-black/20">
                      <CardHeader>
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                          <div className="space-y-2">
                            <CardTitle className="flex items-center gap-2 font-semibold">
                              {teamInfo.team.name}
                              {(() => {
                                const owner = teamInfo.team.members.find(m => m.userId === teamInfo.team?.ownerId);
                                if (!owner) return null;
                                return (
                                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20">
                                    <Avatar className="w-4 h-4">
                                      <AvatarImage src={owner.user.avatar || undefined} />
                                      <AvatarFallback className="text-[8px] bg-amber-500/10 text-amber-600 dark:text-amber-400">
                                        {owner.user.username.slice(0, 2).toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400">{owner.user.name || owner.user.username}</span>
                                  </div>
                                );
                              })()}
                            </CardTitle>
                            {teamInfo.team.description && (
                              <p className="text-sm text-muted-foreground">{teamInfo.team.description}</p>
                            )}
                            
                            <div className="flex flex-wrap items-center gap-3 mt-3">
                              <Badge variant="secondary" className="bg-violet-50 text-violet-600 border-violet-200/50 dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-500/20 gap-1.5 px-2.5 py-1 h-7 rounded-full hover:bg-violet-100 dark:hover:bg-violet-900/20 border transition-colors">
                                <Users className="w-3.5 h-3.5" />
                                <span>{teamInfo.team.members.length} 成员</span>
                              </Badge>

                              {teamInfo?.team && (() => {
                                // 只统计普通成员的使用量，排除团队主
                                const totalStorageUsed = teamInfo?.team?.members.reduce((acc, m) => {
                                  if (m.userId === teamInfo.team?.ownerId) return acc;
                                  return acc + BigInt(m.user.storageUsed || 0);
                                }, BigInt(0)) || BigInt(0);
                                const totalFileCount = teamInfo?.team?.members.reduce((acc, m) => {
                                  if (m.userId === teamInfo.team?.ownerId) return acc;
                                  return acc + (m.user.fileCount || 0);
                                }, 0) || 0;
                                
                                const storageRatio = Number(totalStorageUsed) / Number(teamInfo.team.storageQuota || 1);
                                const fileRatio = totalFileCount / (teamInfo.team.fileQuota || 1);
                                const isStorageWarning = storageRatio > 0.9;
                                const isFileWarning = fileRatio > 0.9;

                                return (
                                  <>
                                    <div className={cn(
                                      "flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-colors h-7",
                                      isStorageWarning 
                                        ? "bg-red-50 text-red-600 border-red-100 dark:bg-red-900/10 dark:text-red-400 dark:border-red-900/20" 
                                        : "bg-emerald-50 text-emerald-600 border-emerald-200/50 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
                                    )}>
                                      <HardDrive className="w-3.5 h-3.5 opacity-70" />
                                      <span>
                                        {formatFileSize(Number(totalStorageUsed))} 
                                        <span className="opacity-40 mx-1">/</span> 
                                        {formatFileSize(Number(teamInfo.team.storageQuota || 0))}
                                      </span>
                                    </div>

                                    <div className={cn(
                                      "flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-colors h-7",
                                      isFileWarning 
                                        ? "bg-red-50 text-red-600 border-red-100 dark:bg-red-900/10 dark:text-red-400 dark:border-red-900/20" 
                                        : "bg-blue-50 text-blue-600 border-blue-200/50 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20"
                                    )}>
                                      <FileIcon className="w-3.5 h-3.5 opacity-70" />
                                      <span>
                                        {totalFileCount} 
                                        <span className="opacity-40 mx-1">/</span> 
                                        {teamInfo.team.fileQuota || 0}
                                      </span>
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                          {isOwner && (
                            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                              <Button onClick={handleEditClick} variant="outline" size="sm" className="gap-2 flex-1 sm:flex-none">
                                <Settings2 className="w-4 h-4" />
                                编辑团队
                              </Button>
                              <Button onClick={() => setInviteManageDialog(true)} variant="outline" size="sm" className="gap-2 flex-1 sm:flex-none">
                                <UserPlus className="w-4 h-4" />
                                邀请管理
                              </Button>
                              <Button onClick={() => setDeleteDialog(true)} variant="destructive" size="sm" className="gap-2 flex-1 sm:flex-none">
                                <Trash2 className="w-4 h-4" />
                                解散团队
                              </Button>
                            </div>
                          )}
                          {isMember && (
                            <Button onClick={() => setLeaveDialog(true)} variant="outline" size="sm" className="gap-2">
                              <LogOut className="w-4 h-4" />
                              退出团队
                            </Button>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Members List */}
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">团队成员</Label>
                          <motion.div 
                            className="space-y-2"
                            variants={containerVariants}
                            initial="hidden"
                            animate="visible"
                          >
                            <AnimatePresence mode="popLayout">
                              {teamInfo.team && teamInfo.team.members
                                .filter(member => member.userId !== teamInfo.team?.ownerId) // 过滤掉创始人
                                .map((member) => (
                                  <motion.div 
                                    key={member.id}
                                    variants={itemVariants}
                                    layout
                                    exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                                  >
                                    <MemberCard 
                                      member={member}
                                      isOwner={isOwner}
                                      currentUser={{ userId: session?.user?.id || '' }}
                                      onQuotaCheck={(userId, username, nickname, storage, files) => 
                                        setQuotaDialog({ 
                                          open: true, 
                                          userId, 
                                          username,
                                          nickname,
                                          currentStorageQuota: storage,
                                          currentFileQuota: files,
                                        })
                                      }
                                      onRemove={(userId, username) => 
                                        setRemoveDialog({ open: true, userId, username })
                                      }
                                    />
                                  </motion.div>
                                ))}
                            </AnimatePresence>
                          </motion.div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Create Team Dialog */}
          <ConfirmDialog
            open={createDialog}
            onOpenChange={setCreateDialog}
            title="创建团队"
            description={
              <div className="flex flex-col items-center space-y-8 py-4">
                {/* Compact Floating Icon */}
                <div className="relative">
                  <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full scale-125 opacity-40" />
                  <div className="relative flex items-center justify-center">
                    <div className="absolute inset-0 bg-linear-to-tr from-primary/20 to-blue-500/20 blur-sm rounded-xl rotate-3" />
                    <div className="relative w-12 h-12 rounded-xl bg-white dark:bg-white/5 border border-zinc-200 dark:border-white/10 flex items-center justify-center shadow-lg">
                      <Users className="w-6 h-6 text-primary" />
                    </div>
                  </div>
                </div>

                <div className="w-full space-y-6">
                  {/* Basic Info Section */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="team-name" className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80 ml-1">
                        团队名称 <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="team-name"
                        value={teamName}
                        onChange={(e) => setTeamName(e.target.value)}
                        placeholder="给你的团队起个名字"
                        className="h-11 rounded-xl bg-white dark:bg-white/5 border-zinc-200 dark:border-white/5 focus-visible:ring-primary/20 transition-all font-medium text-foreground px-4"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="team-description" className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80 ml-1">
                        团队描述 (可选)
                      </Label>
                      <Textarea
                        id="team-description"
                        value={teamDescription}
                        onChange={(e) => setTeamDescription(e.target.value)}
                        placeholder="简单介绍一下您的团队..."
                        rows={3}
                        className="rounded-xl bg-white dark:bg-white/5 border-zinc-200 dark:border-white/5 focus:ring-primary/20 shadow-xs transition-all resize-none p-3 text-foreground"
                      />
                    </div>
                  </div>
                  
                  {/* Quota Settings Section */}
                  <div className="pt-6 border-t border-zinc-200 dark:border-white/5 space-y-5">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      <span className="text-xs font-medium tracking-tight text-foreground/80">团队资源配额设置</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="storage-quota" className="text-[10px] font-medium uppercase text-muted-foreground/90">
                          存储配额 (MB) <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="storage-quota"
                          type="number"
                          min="1"
                          value={teamStorageQuotaMB}
                          onChange={(e) => setTeamStorageQuotaMB(e.target.value)}
                          onWheel={(e) => e.currentTarget.blur()}
                          className="h-11 w-full rounded-xl bg-white dark:bg-white/5 border-zinc-200 dark:border-white/10 focus:border-primary/30 focus-visible:[box-shadow:none] transition-all no-spinner text-sm text-foreground"
                        />
                        <p className="text-[10px] text-muted-foreground/60 leading-tight">
                          总团队成员使用量上限
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="file-quota" className="text-[10px] font-medium uppercase text-muted-foreground/90">
                          文件数配额 <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="file-quota"
                          type="number"
                          min="1"
                          value={teamFileQuota}
                          onChange={(e) => setTeamFileQuota(e.target.value)}
                          onWheel={(e) => e.currentTarget.blur()}
                          className="h-11 rounded-xl bg-white dark:bg-white/5 border-zinc-200 dark:border-white/10 focus:border-primary/30 focus-visible:[box-shadow:none] transition-all no-spinner text-sm text-zinc-900 dark:text-zinc-100"
                        />
                        <p className="text-[10px] text-muted-foreground/60 leading-tight">
                          总团队成员文件数上限
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            }
            confirmText="立即创建团队"
            onConfirm={handleCreateTeam}
          />

          {/* Delete Team Dialog */}
          <ConfirmDialog
            open={deleteDialog}
            onOpenChange={setDeleteDialog}
            title="解散团队"
            description="确定要解散团队吗？所有成员将被移除，此操作不可撤销。"
            confirmText="确认解散"
            variant="destructive"
            onConfirm={async () => {
              await deleteTeam();
              setDeleteDialog(false);
            }}
          />

          {/* Leave Team Dialog */}
          <ConfirmDialog
            open={leaveDialog}
            onOpenChange={setLeaveDialog}
            title="退出团队"
            description="确定要退出团队吗？您将失去访问团队配置的权限。"
            confirmText="确认退出"
            variant="destructive"
            onConfirm={async () => {
              await leaveTeam();
              setLeaveDialog(false);
            }}
          />

          {/* Remove Member Dialog */}
          <ConfirmDialog
            open={removeDialog.open}
            onOpenChange={(open) => setRemoveDialog({ ...removeDialog, open })}
            title="移除成员"
            description={`确定要将 @${removeDialog.username} 移出团队吗？此操作不可撤销。`}
            confirmText="确认移除"
            variant="destructive"
            onConfirm={handleRemoveMember}
          />

          {/* Set Quota Dialog */}
          <ConfirmDialog
            open={quotaDialog.open}
            onOpenChange={(open) => setQuotaDialog({ ...quotaDialog, open })}
            title="设置成员配额"
            description={
              (() => {
                const teamStorageTotal = BigInt(teamInfo?.team?.storageQuota || 0);
                const teamFilesTotal = teamInfo?.team?.fileQuota || 0;

                // 只统计普通成员的配额分配，排除团队主
                const totalAllocatedStorage = teamInfo?.team?.members.reduce((acc, m) => {
                  // 跳过团队主
                  if (m.userId === teamInfo.team?.ownerId) return acc;
                  
                  const quotaVal = m.userId === quotaDialog.userId 
                                  ? quotaDialog.currentStorageQuota 
                                  : Number(m.storageQuota);
                  return acc + BigInt(quotaVal || 0);
                }, BigInt(0)) || BigInt(0);

                const totalAllocatedFiles = teamInfo?.team?.members.reduce((acc, m) => {
                  // 跳过团队主
                  if (m.userId === teamInfo.team?.ownerId) return acc;
                  
                  const quotaVal = m.userId === quotaDialog.userId 
                                  ? quotaDialog.currentFileQuota 
                                  : m.fileQuota;
                  return acc + (quotaVal || 0);
                }, 0) || 0;

                const isStorageWarning = totalAllocatedStorage > teamStorageTotal;
                const isFilesWarning = totalAllocatedFiles > teamFilesTotal;

                // 计算其他成员已分配的配额（排除当前编辑的成员和团队主）
                const sumOtherStorage = teamInfo?.team?.members.reduce((acc, m) => {
                  if (m.userId === quotaDialog.userId || m.userId === teamInfo.team?.ownerId) return acc;
                  return acc + BigInt(m.storageQuota || 0);
                }, BigInt(0)) || BigInt(0);
                const maxMB = Number((teamStorageTotal - sumOtherStorage) / BigInt(1024 * 1024));

                const sumOtherFiles = teamInfo?.team?.members.reduce((acc, m) => {
                  if (m.userId === quotaDialog.userId || m.userId === teamInfo.team?.ownerId) return acc;
                  return acc + (m.fileQuota || 0);
                }, 0) || 0;
                const maxFiles = Number(teamFilesTotal - sumOtherFiles);

                return (
                  <div className="space-y-4 py-4">
                    <p className="text-sm text-muted-foreground flex items-center">
                      正在为 <span className="mx-1 px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-foreground font-medium">@{quotaDialog.nickname || quotaDialog.username}</span> 分配资源
                    </p>
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="storage-quota" className="flex justify-between items-center">
                          <span>存储配额 (MB)</span>
                          <span className={cn(
                            "text-[10px] font-medium px-2 py-0.5 rounded-full",
                            isStorageWarning ? "bg-red-500/10 text-red-500" : "bg-emerald-500/10 text-emerald-500"
                          )}>
                            最大可用: {maxMB} MB
                          </span>
                        </Label>
                        <Input
                          id="storage-quota"
                          type="number"
                          min="0"
                          max={maxMB}
                          step="1"
                          placeholder="留空即为未分配（无法上传）"
                          defaultValue={quotaDialog.currentStorageQuota ? (quotaDialog.currentStorageQuota / 1024 / 1024).toFixed(0) : ''}
                          onChange={(e) => {
                            const mb = e.target.value ? parseFloat(e.target.value) : null;
                            setQuotaDialog({ ...quotaDialog, currentStorageQuota: mb ? mb * 1024 * 1024 : null });
                          }}
                          onWheel={(e) => e.currentTarget.blur()}
                          className={cn(
                            "bg-white dark:bg-white/5 border-zinc-200 dark:border-white/10 no-spinner text-sm focus-visible:ring-primary/20",
                            isStorageWarning && "border-red-500 focus-visible:ring-red-500"
                          )}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="file-quota" className="flex justify-between items-center">
                          <span>文件数配额</span>
                          <span className={cn(
                            "text-[10px] font-medium px-2 py-0.5 rounded-full",
                            isFilesWarning ? "bg-red-500/10 text-red-500" : "bg-emerald-500/10 text-emerald-500"
                          )}>
                            最大可用: {maxFiles}
                          </span>
                        </Label>
                        <Input
                          id="file-quota"
                          type="number"
                          min="0"
                          max={maxFiles}
                          placeholder="留空即为未分配（无法上传）"
                          defaultValue={quotaDialog.currentFileQuota || ''}
                          onChange={(e) => {
                            const count = e.target.value ? parseInt(e.target.value) : null;
                            setQuotaDialog({ ...quotaDialog, currentFileQuota: count });
                          }}
                          onWheel={(e) => e.currentTarget.blur()}
                          className={cn(
                            "bg-white dark:bg-white/5 border-zinc-200 dark:border-white/10 no-spinner text-sm focus-visible:ring-primary/20 text-foreground",
                            isFilesWarning && "border-red-500 focus-visible:ring-red-500"
                          )}
                        />
                      </div>

                      {/* Allocation Summary Hint */}
                      <div className={cn(
                        "p-3 rounded-xl border text-[11px] space-y-2 transition-colors",
                        (isStorageWarning || isFilesWarning) 
                          ? "bg-red-500/5 border-red-500/20 text-red-600 dark:text-red-400" 
                          : "bg-emerald-500/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                      )}>
                        <div className="flex items-center gap-2">
                          {isStorageWarning || isFilesWarning ? <AlertTriangle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                          <span className="font-semibold uppercase tracking-wider">分配状态面板（仅成员限额，不含团队主）</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 opacity-90">
                          <div>
                            <p className="opacity-70 mb-0.5">预估占用存储</p>
                            <p className="text-xs">{formatFileSize(Number(totalAllocatedStorage))} / {formatFileSize(Number(teamStorageTotal))}</p>
                          </div>
                          <div>
                            <p className="opacity-70 mb-0.5">预估占用文件数</p>
                            <p className="text-xs">{totalAllocatedFiles} / {teamFilesTotal}</p>
                          </div>
                        </div>
                        {(isStorageWarning || isFilesWarning) && (
                          <p className="pt-1 mt-1 border-t border-red-500/10 text-[10px] italic">
                            警告：总分配额度已超过您的账户容量上限，保存将失败。
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()
            }
            confirmDisabled={(() => {
              const teamStorageTotal = BigInt(teamInfo?.team?.storageQuota || 0);
              const teamFilesTotal = teamInfo?.team?.fileQuota || 0;

              // 只统计普通成员的配额分配，排除团队主
              const totalAllocatedStorage = teamInfo?.team?.members.reduce((acc, m) => {
                // 跳过团队主
                if (m.userId === teamInfo.team?.ownerId) return acc;
                
                const quotaVal = m.userId === quotaDialog.userId 
                                ? quotaDialog.currentStorageQuota 
                                : Number(m.storageQuota);
                return acc + BigInt(quotaVal || 0);
              }, BigInt(0)) || BigInt(0);

              const totalAllocatedFiles = teamInfo?.team?.members.reduce((acc, m) => {
                // 跳过团队主
                if (m.userId === teamInfo.team?.ownerId) return acc;
                
                const quotaVal = m.userId === quotaDialog.userId 
                                ? quotaDialog.currentFileQuota 
                                : m.fileQuota;
                return acc + (quotaVal || 0);
              }, 0) || 0;

              return totalAllocatedStorage > teamStorageTotal || totalAllocatedFiles > teamFilesTotal;
            })()}
            confirmText="确认设置"
            onConfirm={async () => {
              await setMemberQuota(quotaDialog.userId, quotaDialog.currentStorageQuota, quotaDialog.currentFileQuota);
              setQuotaDialog({ open: false, userId: '', username: '', nickname: null, currentStorageQuota: null, currentFileQuota: null });
            }}
          />

          {/* Invite Code Dialog */}
          <ConfirmDialog
            open={inviteDialog}
            onOpenChange={setInviteDialog}
            title="团队邀请码"
            description={
              <div className="space-y-4 py-4">
                <p className="text-sm text-muted-foreground">
                  分享此邀请码，其他用户可通过此码加入您的团队（24小时内有效）
                </p>
                <div className="flex items-center gap-2">
                  <Input 
                    value={inviteCode} 
                    readOnly 
                    className="bg-zinc-50 dark:bg-white/5"
                  />
                  <Button onClick={copyInviteCode} variant="outline" size="icon">
                    {inviteCodeCopied ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            }
            confirmText="关闭"
            hideCancelButton
            onConfirm={() => setInviteDialog(false)}
          />

          {/* Join Team Dialog */}
          <ConfirmDialog
            open={joinDialog}
            onOpenChange={setJoinDialog}
            title="加入团队"
            description={
              <div className="flex flex-col items-center space-y-8 py-4">
                {/* Compact Floating Icon */}
                <div className="relative">
                  <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full scale-125 opacity-40" />
                  <div className="relative flex items-center justify-center">
                    <div className="absolute inset-0 bg-linear-to-tr from-primary/20 to-blue-500/20 blur-sm rounded-xl rotate-3" />
                    <div className="relative w-12 h-12 rounded-xl bg-white dark:bg-white/5 border border-zinc-200 dark:border-white/10 flex items-center justify-center shadow-lg">
                      <UserPlus className="w-6 h-6 text-primary" />
                    </div>
                  </div>
                </div>
                
                <div className="w-full space-y-6">
                  <div className="space-y-2 text-center">
                    <h4 className="text-base font-semibold tracking-tight">输入邀请码加入</h4>
                    <p className="text-xs text-muted-foreground/80 font-medium leading-relaxed px-4">
                      输入团队验证码，即可与团队成员共享资源并开始协作
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="relative group max-w-[280px] mx-auto">
                      {/* Subtler Border Effect - Using border instead of background to prevent center bleed */}
                      <div className="absolute -inset-[2px] border-2 border-primary/40 rounded-xl opacity-0 group-focus-within:opacity-100 blur-[2px] transition-opacity duration-300 pointer-events-none" />
                      <Input
                        id="join-invite-code"
                        value={joinInviteCode}
                        onChange={(e) => setJoinInviteCode(e.target.value)}
                        placeholder="•••• •••• •••• ••••"
                        className="relative h-11 text-center text-base tracking-[0.2em] bg-white dark:bg-white/5 border-zinc-200 dark:border-white/5 focus-visible:ring-0 focus-visible:border-primary/30 focus-visible:[box-shadow:none] transition-all rounded-lg placeholder:text-muted-foreground/50 placeholder:tracking-normal text-foreground"
                        maxLength={32}
                      />
                    </div>
                    <p className="text-[10px] text-center text-muted-foreground/60">
                      邀请码通常由管理员生成，有效期为 24 小时
                    </p>
                  </div>
                </div>
              </div>
            }
            confirmText="加入团队"
            onConfirm={handleJoinTeam}
          />

          {/* Invite Management Dialog */}
          <ConfirmDialog
            open={inviteManageDialog}
            onOpenChange={setInviteManageDialog}
            title="邀请码管理"
            description={
              <div className="space-y-4 py-4">
                {/* Invite codes list */}
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {inviteCodes.length === 0 ? (
                    <div className="p-4 rounded-lg bg-white dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-center text-sm text-muted-foreground">
                      暂无邀请码
                    </div>
                  ) : (
                    inviteCodes.map((invite) => {
                      const isExpired = new Date(invite.expiresAt) < new Date();
                      const isMaxedOut = invite.usedCount >= invite.maxUses;
                      const isValid = !isExpired && !isMaxedOut;
                      
                      return (
                        <div key={invite.id} className="p-4 rounded-lg bg-zinc-50 dark:bg-white/5 border border-zinc-200/50 dark:border-white/10 space-y-3">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <Badge variant={isValid ? 'default' : 'secondary'} className="text-xs">
                                {isValid ? '有效' : isExpired ? '已过期' : '已用完'}
                              </Badge>
                            </div>
                            <div className="flex gap-2">
                              {isValid && (
                                <Button 
                                  onClick={() => {
                                    navigator.clipboard.writeText(invite.code);
                                    toast.success('邀请码已复制');
                                  }}
                                  variant="outline" 
                                  size="sm"
                                  className="h-7"
                                >
                                  <Copy className="w-3.5 h-3.5 mr-2" />
                                  复制
                                </Button>
                              )}
                              <Button
                                onClick={async () => {
                                  await deleteInviteCode(invite.id);
                                }}
                                variant="destructive"
                                size="sm"
                                className="h-7"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">邀请码</span>
                              <span className="text-xs">{invite.code}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">使用次数</span>
                              <span>{invite.usedCount} / {invite.maxUses}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">创建时间</span>
                              <span className="text-xs">{new Date(invite.createdAt).toLocaleString('zh-CN')}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">过期时间</span>
                              <span className="text-xs">{new Date(invite.expiresAt).toLocaleString('zh-CN')}</span>
                            </div>

                            {/* 已邀请成员 */}
                            {invite.members && invite.members.length > 0 && (
                              <div className="pt-3 border-t border-zinc-200/50 dark:border-white/5 space-y-2">
                                <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
                                  已邀请成员 ({invite.members.length})
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {invite.members.map((m) => (
                                    <div key={m.id} className="flex items-center gap-1.5 bg-white/50 dark:bg-white/5 px-2 py-1 rounded-full border border-zinc-200/50 dark:border-white/5">
                                      <Avatar className="w-4 h-4">
                                        <AvatarImage src={m.user.avatar || undefined} />
                                        <AvatarFallback className="text-[8px]">{m.user.name?.[0] || m.user.username?.[0]}</AvatarFallback>
                                      </Avatar>
                                      <span className="text-[10px] font-medium">{m.user.name || m.user.username}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                
                {/* Generate New Invite */}
                <div className="space-y-3 pt-4 border-t border-zinc-200 dark:border-white/10">
                  <Label className="text-sm font-medium">生成新邀请码</Label>
                  <div className="flex gap-2">
                      <div className="flex-1 space-y-2">
                        <Label htmlFor="maxUses" className="text-[10px] font-medium uppercase text-muted-foreground/90">可使用次数</Label>
                        <Input
                          id="maxUses"
                          type="number"
                          min="1"
                          max="100"
                          placeholder="默认为 5 次"
                          value={maxUses}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '') {
                              setMaxUses('');
                            } else {
                              const num = parseInt(val);
                              if (!isNaN(num)) setMaxUses(num);
                            }
                          }}
                          onWheel={(e) => e.currentTarget.blur()}
                          className="h-11 rounded-xl bg-white dark:bg-white/5 border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-zinc-100 no-spinner"
                        />
                      </div>
                    <div className="flex-1 space-y-2">
                      <Label htmlFor="expiresInMinutes" className="text-[10px] font-medium uppercase text-muted-foreground/90">有效期(分钟)</Label>
                      <Input
                        id="expiresInMinutes"
                        type="number"
                        min="1"
                        max="10080"
                        placeholder="默认为 24 小时"
                        value={expiresInMinutes}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '') {
                            setExpiresInMinutes('');
                          } else {
                            const num = parseInt(val);
                            if (!isNaN(num)) setExpiresInMinutes(num);
                          }
                        }}
                        onWheel={(e) => e.currentTarget.blur()}
                        className="h-11 rounded-xl bg-white dark:bg-white/5 border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-zinc-100 no-spinner"
                      />
                    </div>
                  </div>
                </div>
              </div>
            }
            footer={
              <AlertDialogFooter className="pt-0 sm:justify-end gap-3 sm:gap-4">
                <Button 
                  onClick={() => setInviteManageDialog(false)} 
                  variant="outline" 
                  className="rounded-full h-9 px-6 font-medium"
                >
                  关闭
                </Button>
                <Button 
                  onClick={async () => {
                    await handleGenerateInvite();
                    await loadInviteCodes();
                  }} 
                  className="rounded-full h-9 px-6 font-bold shadow-lg shadow-primary/20"
                >
                  生成
                </Button>
              </AlertDialogFooter>
            }
            hideCancelButton
          />

          {/* Edit Team Dialog */}
          <Dialog open={editDialog} onOpenChange={setEditDialog}>
            <DialogContent className="w-[90vw] max-w-lg">
              <DialogHeader>
                <DialogTitle>编辑团队信息</DialogTitle>
                <DialogDescription>
                  修改团队的基本信息和配额限制
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>团队名称</Label>
                  <Input 
                    value={editForm.name} 
                    onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="请输入团队名称"
                  />
                </div>
                <div className="space-y-2">
                  <Label>描述</Label>
                  <Textarea 
                    value={editForm.description} 
                    onChange={e => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="团队描述..."
                    className="resize-none h-20"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <HardDrive className="w-3 h-3 text-zinc-500" />
                      总存储配额 (MB)
                    </Label>
                    <Input 
                      type="number"
                      value={editForm.storageQuotaMB} 
                      onChange={e => setEditForm(prev => ({ ...prev, storageQuotaMB: e.target.value }))}
                      placeholder="500"
                      className="no-spinner text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <FileIcon className="w-3 h-3 text-zinc-500" />
                      总文件数配额
                    </Label>
                    <Input 
                      type="number"
                      value={editForm.fileQuota} 
                      onChange={e => setEditForm(prev => ({ ...prev, fileQuota: e.target.value }))}
                      placeholder="1000"
                      className="no-spinner text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between space-x-2 py-2">
                  <div className="space-y-0.5">
                    <Label className="text-base">自动分配配额</Label>
                    <p className="text-xs text-muted-foreground">
                      新成员加入时自动设置默认配额
                    </p>
                  </div>
                  <Switch
                    checked={editForm.autoAllocateQuota}
                    onCheckedChange={checked => setEditForm(prev => ({ ...prev, autoAllocateQuota: checked }))}
                  />
                </div>

                {editForm.autoAllocateQuota && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-zinc-100 dark:border-white/5">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-xs">
                        默认存储配额 (MB)
                      </Label>
                      <Input 
                        type="number"
                        value={editForm.defaultStorageQuotaMB} 
                        onChange={e => setEditForm(prev => ({ ...prev, defaultStorageQuotaMB: e.target.value }))}
                        placeholder="100"
                        className="no-spinner h-9 text-zinc-900 dark:text-zinc-100"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-xs">
                        默认文件数配额
                      </Label>
                      <Input 
                        type="number"
                        value={editForm.defaultFileQuota} 
                        onChange={e => setEditForm(prev => ({ ...prev, defaultFileQuota: e.target.value }))}
                        placeholder="500"
                        className="no-spinner h-9 text-zinc-900 dark:text-zinc-100"
                      />
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                 <Button variant="outline" onClick={() => setEditDialog(false)} className="rounded-full px-6">取消</Button>
                 <Button onClick={handleUpdateTeam} disabled={updating} className="bg-primary text-primary-foreground rounded-full px-6">
                   {updating ? '保存中...' : '保存修改'}
                 </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </PageWrapper>
  );
}
