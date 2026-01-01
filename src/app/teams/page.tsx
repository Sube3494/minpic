'use client';

import { useState, useEffect } from 'react';
import { Users, UserPlus, LogOut, Trash2, Copy, Check, Sliders } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PageWrapper } from '@/components/layout/page-wrapper';
import { useTeam } from '@/hooks/use-team';
import { formatFileSize } from '@/lib/utils';

export default function TeamsPage() {
  const { teamInfo, inviteCodes, loading, createTeam, deleteTeam, leaveTeam, generateInvite, joinTeam, removeMember, loadInviteCodes, setMemberQuota, deleteInviteCode } = useTeam();
  
  const [createDialog, setCreateDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [leaveDialog, setLeaveDialog] = useState(false);
  const [inviteDialog, setInviteDialog] = useState(false);
  const [joinDialog, setJoinDialog] = useState(false);
  const [removeDialog, setRemoveDialog] = useState<{ open: boolean; userId: string; username: string }>({ open: false, userId: '', username: '' });
  const [inviteManageDialog, setInviteManageDialog] = useState(false);
  const [quotaDialog, setQuotaDialog] = useState<{ open: boolean; userId: string; username: string; nickname?: string | null; currentStorageQuota: number | null; currentFileQuota: number | null }>({ open: false, userId: '', username: '', nickname: null, currentStorageQuota: null, currentFileQuota: null });
  
  const [teamName, setTeamName] = useState('');
  const [teamDescription, setTeamDescription] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [inviteCodeCopied, setInviteCodeCopied] = useState(false);
  const [joinInviteCode, setJoinInviteCode] = useState('');
  const [maxUses, setMaxUses] = useState(10);
  const [expiresInMinutes, setExpiresInMinutes] = useState(1440); // 默认24小时

  useEffect(() => {
    if (inviteManageDialog) {
      loadInviteCodes();
    }
  }, [inviteManageDialog, loadInviteCodes]);



  const handleCreateTeam = async () => {
    if (!teamName.trim()) {
      toast.error('请输入团队名称');
      return;
    }
    
    try {
      await createTeam(teamName, teamDescription);
      setCreateDialog(false);
      setTeamName('');
      setTeamDescription('');
    } catch {
      // Error already handled in hook
    }
  };

  const handleGenerateInvite = async () => {
    try {
      const result = await generateInvite(expiresInMinutes, maxUses);
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

  const isOwner = teamInfo?.role === 'OWNER';
  const isMember = teamInfo?.team && !isOwner;

  return (
    <PageWrapper>
      <div className="min-h-screen p-4 sm:p-6 md:p-12 pb-32">
        <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6 mt-12 sm:mt-16">
            <div className="space-y-1 md:space-y-2">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-glow">
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
                    <Card className="glass-strong border-zinc-200/50 dark:border-white/10 shadow-lg">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="space-y-2">
                            <CardTitle className="flex items-center gap-2">
                              {teamInfo.team.name}
                            </CardTitle>
                            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <Users className="w-4 h-4" />
                                <span>{teamInfo.team.members.length} 名成员</span>
                              </div>
                              {teamInfo.team.owner && (
                                <div className="flex gap-4 text-xs p-2 rounded-md border border-zinc-200/50 dark:border-white/10 bg-zinc-50/50 dark:bg-white/5">
                                  <span>存储: {formatFileSize(Number(teamInfo.team.owner.storageUsed || 0))} / {formatFileSize(Number(teamInfo.team.owner.storageQuota || 0))}</span>
                                  <span>文件: {teamInfo.team.owner.fileCount || 0} / {teamInfo.team.owner.fileQuota || 0}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          {isOwner && (
                            <div className="flex gap-2">
                              <Button onClick={() => setInviteManageDialog(true)} variant="outline" size="sm" className="gap-2">
                                <UserPlus className="w-4 h-4" />
                                邀请管理
                              </Button>
                              <Button onClick={() => setDeleteDialog(true)} variant="destructive" size="sm" className="gap-2">
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
                          <Label className="text-sm font-semibold">团队成员</Label>
                          <div className="space-y-2">
                            {teamInfo.team.members.map((member) => {
                              const isFounder = member.userId === teamInfo?.team?.ownerId;
                              return (
                                <div 
                                  key={member.id}
                                  className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 dark:bg-white/5 border border-zinc-200/50 dark:border-white/10"
                                >
                                  <div className="flex items-center gap-3 flex-1">
                                    <Avatar className="w-8 h-8">
                                      <AvatarImage src={member.user.avatar || undefined} />
                                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                        {member.user.username.slice(0, 2).toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1">
                                      <p className="text-sm font-medium flex items-center gap-2">
                                        {member.user.name || member.user.username}
                                        {isFounder ? (
                                          <Badge variant="default" className="text-[10px] px-1.5 py-0">
                                            团队主
                                          </Badge>
                                        ) : (
                                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                            成员
                                          </Badge>
                                        )}
                                      </p>

                                      <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                                        <span>存储: {formatFileSize(Number(member.user.storageUsed || 0))}</span>
                                        <span>文件: {member.user.fileCount || 0}</span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {isOwner && !isFounder && (
                                      <>
                                        <Button 
                                          onClick={() => setQuotaDialog({ 
                                            open: true, 
                                            userId: member.userId, 
                                            username:  member.user.username,
                                            nickname: member.user.name,
                                            currentStorageQuota: member.storageQuota ? Number(member.storageQuota) : null,
                                            currentFileQuota: member.fileQuota ?? null,
                                          })}
                                          variant="ghost" 
                                          size="sm" 
                                          className="h-8 px-2"
                                          title="设置限额"
                                        >
                                          <Sliders className="w-3.5 h-3.5" />
                                        </Button>
                                        <Button 
                                          onClick={() => setRemoveDialog({ open: true, userId: member.userId, username: member.user.username })}
                                          variant="ghost" 
                                          size="sm" 
                                          className="h-8 px-2 text-destructive hover:bg-destructive/10"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
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
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="team-name">团队名称</Label>
                  <Input
                    id="team-name"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="输入团队名称"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="team-description">团队描述（可选）</Label>
                  <Textarea
                    id="team-description"
                    value={teamDescription}
                    onChange={(e) => setTeamDescription(e.target.value)}
                    placeholder="简单介绍一下你的团队"
                    rows={3}
                  />
                </div>
              </div>
            }
            confirmText="创建"
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
              <div className="space-y-4 py-4">
                <p className="text-sm text-muted-foreground flex items-center">
                  为 <span className="mx-1 px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-foreground font-medium">@{quotaDialog.nickname || quotaDialog.username}</span> 设置配额限额。留空表示使用团队配额。
                </p>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="storage-quota">存储配额 (MB)</Label>
                      <Input
                        id="storage-quota"
                        type="number"
                        min="0"
                        step="1"
                        placeholder={`使用团队配额: ${(Number(teamInfo?.team?.owner?.storageQuota || 0) / 1024 / 1024).toFixed(0)}MB`}
                        defaultValue={quotaDialog.currentStorageQuota ? (quotaDialog.currentStorageQuota / 1024 / 1024).toFixed(0) : ''}
                        onChange={(e) => {
                          const mb = e.target.value ? parseFloat(e.target.value) : null;
                          setQuotaDialog({ ...quotaDialog, currentStorageQuota: mb ? mb * 1024 * 1024 : null });
                        }}
                        onWheel={(e) => e.currentTarget.blur()}
                        className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="file-quota">文件数配额</Label>
                      <Input
                        id="file-quota"
                        type="number"
                        min="0"
                        placeholder={`使用团队配额: ${teamInfo?.team?.owner?.fileQuota || 0}`}
                        defaultValue={quotaDialog.currentFileQuota || ''}
                        onChange={(e) => {
                          const count = e.target.value ? parseInt(e.target.value) : null;
                          setQuotaDialog({ ...quotaDialog, currentFileQuota: count });
                        }}
                        onWheel={(e) => e.currentTarget.blur()}
                        className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                  </div>
                </div>
              </div>
            }
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
                    className="font-mono"
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
              <div className="space-y-4 py-4">
                <p className="text-sm text-muted-foreground">
                  输入团队邀请码，加入已有团队
                </p>
                <div className="space-y-2">
                  <Label htmlFor="join-invite-code">邀请码</Label>
                  <Input
                    id="join-invite-code"
                    value={joinInviteCode}
                    onChange={(e) => setJoinInviteCode(e.target.value)}
                    placeholder="输入32位邀请码"
                    className="font-mono"
                    maxLength={32}
                  />
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
                    <div className="p-4 rounded-lg bg-zinc-50 dark:bg-white/5 border border-zinc-200/50 dark:border-white/10 text-center text-sm text-muted-foreground">
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
                              <span className="font-mono text-xs">{invite.code}</span>
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
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                
                {/* Generate New Invite */}
                <div className="space-y-3 pt-4 border-t border-zinc-200 dark:border-white/10">
                  <Label className="text-sm font-semibold">生成新邀请码</Label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Label htmlFor="maxUses" className="text-xs">使用次数</Label>
                      <Input
                        id="maxUses"
                        type="number"
                        min="1"
                        max="100"
                        value={maxUses}
                        onChange={(e) => setMaxUses(Number(e.target.value))}
                        onWheel={(e) => e.currentTarget.blur()}
                        className="mt-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                    <div className="flex-1">
                      <Label htmlFor="expiresInMinutes" className="text-xs">有效期(分钟)</Label>
                      <Input
                        id="expiresInMinutes"
                        type="number"
                        min="1"
                        max="10080"
                        value={expiresInMinutes}
                        onChange={(e) => setExpiresInMinutes(Number(e.target.value))}
                        onWheel={(e) => e.currentTarget.blur()}
                        className="mt-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                    <div className="flex items-end">
                      <Button onClick={async () => {
                        await handleGenerateInvite();
                        await loadInviteCodes(); // 生成后重新加载列表
                      }} className="gap-2">
                        <UserPlus className="w-4 h-4" />
                        生成
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            }
            confirmText="关闭"
            hideCancelButton
            onConfirm={() => setInviteManageDialog(false)}
          />
        </div>
      </div>
    </PageWrapper>
  );
}
