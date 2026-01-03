'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Crown, Shield, Users, Database, Files, LogOut, Info } from 'lucide-react';
import { formatFileSize, cn } from '@/lib/utils';
import { TeamInfo, TeamMember } from '@/services/team.service';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface TeamResourceCardProps {
  teamInfo: TeamInfo;
  memberInfo?: TeamMember | null;
  isOwner: boolean;
  usage: {
    storageUsed: bigint;
    fileCount: number;
  };
  onLeave: () => void;
}

export function TeamResourceCard({ teamInfo, memberInfo, isOwner, usage, onLeave }: TeamResourceCardProps) {
  if (!teamInfo.team) return null;

  const { team } = teamInfo;
  
  // 配额逻辑
  const storageQuota = memberInfo?.storageQuota ? BigInt(memberInfo.storageQuota) : (isOwner ? BigInt(team.storageQuota || 0) : BigInt(0));
  const fileQuota = memberInfo?.fileQuota ?? (isOwner ? (team.fileQuota || 0) : 0);

  const hasQuota = storageQuota > BigInt(0) || fileQuota > 0;
  const storagePercent = storageQuota > BigInt(0) ? (Number(usage.storageUsed) / Number(storageQuota)) * 100 : 0;
  const filePercent = fileQuota > 0 ? (usage.fileCount / fileQuota) * 100 : 0;

  return (
    <Card className="glass-strong border-zinc-200/50 dark:border-white/10 shadow-lg bg-white/50 dark:bg-black/20 overflow-hidden h-full flex flex-col relative group">
      <div className="absolute inset-0 bg-linear-to-br from-blue-500/5 via-transparent to-transparent opacity-50" />
      
      <CardHeader className="pb-4 shrink-0 relative">
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
                {team.name}
              </CardTitle>
              <Badge variant="secondary" className={cn(
                "px-2 py-0 border",
                isOwner 
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" 
                  : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-transparent"
              )}>
                {isOwner ? <Crown className="w-3 h-3 mr-1" /> : <Users className="w-3 h-3 mr-1" />}
                {isOwner ? '创始人' : '团队成员'}
              </Badge>
            </div>
            <CardDescription className="text-xs text-zinc-500 dark:text-zinc-400 max-w-[280px] line-clamp-1">
              {team.description || '暂无团队描述'}
            </CardDescription>
          </div>
          
          <div className="flex flex-col items-end gap-2">
            {!isOwner && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button className="p-2 rounded-full hover:bg-red-500/10 text-zinc-400 hover:text-red-500 transition-colors">
                    <LogOut className="w-4 h-4" />
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                   <AlertDialogHeader>
                    <AlertDialogTitle>确认退出团队?</AlertDialogTitle>
                    <AlertDialogDescription>退出后将无法访问该团队的共享存储配置。</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction onClick={onLeave} className="bg-red-600">确认退出</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6 flex-1 relative">
        {/* 成员聚合展示 */}
        <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-white/5">
          <div className="flex items-center gap-4">
             {/* 头像叠放 */}
             <div className="flex -space-x-2">
               {team.members.slice(0, 5).map((member) => (
                 <Avatar key={member.userId} className="w-8 h-8 ring-2 ring-white dark:ring-zinc-900 border-none">
                   <AvatarImage src={member.user.avatar || undefined} />
                   <AvatarFallback className="text-[10px] bg-zinc-100 dark:bg-white/5">
                     {member.user.name?.[0] || member.user.username?.[0] || '?'}
                   </AvatarFallback>
                 </Avatar>
               ))}
               {team.members.length > 5 && (
                 <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-white/5 flex items-center justify-center text-[10px] text-zinc-500 ring-2 ring-white dark:ring-zinc-900">
                   +{team.members.length - 5}
                 </div>
               )}
             </div>
             
             <div className="space-y-0.5">
               <p className="text-[11px] font-medium text-zinc-900 dark:text-zinc-100">团队成员</p>
               <p className="text-[10px] text-zinc-500">共 {team.members.length} 位协作伙伴</p>
             </div>
          </div>

          <div className="text-right">
             <p className="text-[10px] text-zinc-400">创建于</p>
             <p className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400">
               {new Date(team.createdAt).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })}
             </p>
          </div>
        </div>

        {/* 配额展示区 */}
        <div className="space-y-5">
          {isOwner ? (
            <div className="py-2 px-1 text-center space-y-2">
              <div className="inline-flex p-2 rounded-full bg-blue-500/10 text-blue-500 mb-1">
                <Shield className="w-5 h-5" />
              </div>
              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">无配额限制</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 px-4">
                您管理着此团队，不受限于分配配额。
              </p>
            </div>
          ) : !hasQuota ? (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10 text-amber-600">
              <Info className="w-4 h-4 shrink-0" />
              <p className="text-xs font-medium">等待管理员配置您的可用额度</p>
            </div>
          ) : (
            <>
              {/* Storage */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-semibold text-zinc-600 dark:text-zinc-400">
                    <Database className="w-3 h-3" /> 存储空间
                  </span>
                  <span className="">{formatFileSize(usage.storageUsed)} / {formatFileSize(storageQuota)}</span>
                </div>
                <Progress value={Math.min(storagePercent, 100)} className="h-1.5" />
              </div>

              {/* Files */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-semibold text-zinc-600 dark:text-zinc-400">
                    <Files className="w-3 h-3" /> 文件数量
                  </span>
                  <span className="">{usage.fileCount} / {fileQuota}</span>
                </div>
                <Progress value={Math.min(filePercent, 100)} className="h-1.5" />
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
