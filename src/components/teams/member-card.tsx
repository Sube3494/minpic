'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn, formatFileSize } from '@/lib/utils';
import { TeamMember } from '@/services/team.service';
import { Settings2, Trash2, Database, Files, Crown } from 'lucide-react';

interface MemberCardProps {
  member: TeamMember;
  isOwner: boolean;
  currentUser: { userId: string };
  onQuotaCheck?: (userId: string, username: string, nickname: string | null, storage: number | null, files: number | null) => void;
  onRemove?: (userId: string, username: string) => void;
}

export function MemberCard({ member, isOwner, currentUser, onQuotaCheck, onRemove }: MemberCardProps) {
  const isMe = member.userId === currentUser.userId;
  const isTeamOwner = false; // Need to pass this prop if we want to visually distinguish separate from "isOwner" (viewer)

  // Calculate percentages
  const storageUsed = BigInt(member.user.storageUsed || 0);
  const storageQuota = member.storageQuota ? BigInt(member.storageQuota) : BigInt(0);
  const storagePercent = storageQuota > 0 ? Number((storageUsed * BigInt(100)) / storageQuota) : 0;
  
  const filesUsed = member.user.fileCount || 0;
  const filesQuota = member.fileQuota || 0;
  const filesPercent = filesQuota > 0 ? (filesUsed / filesQuota) * 100 : 0;

  return (
    <div className={cn(
        "group relative flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-xl transition-all duration-300",
        "bg-white dark:bg-white/5 border border-zinc-200 dark:border-white/5",
        "hover:shadow-md hover:border-zinc-300 dark:hover:border-white/10 hover:bg-zinc-50/50 dark:hover:bg-white/[0.07]"
      )}>
      
      {/* Avatar & Basic Info */}
      <div className="flex items-center gap-4 min-w-[35%]">
        <div className="relative shrink-0">
          <Avatar className="w-10 h-10 sm:w-12 sm:h-12 border-2 border-white dark:border-white/10 shadow-sm">
            <AvatarImage src={member.user.avatar || undefined} referrerPolicy="no-referrer" />
            <AvatarFallback className="text-xs bg-linear-to-br from-zinc-100 to-zinc-50 dark:from-zinc-800 dark:to-zinc-900 text-zinc-500">
              {member.user.username.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {isTeamOwner && (
             <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center border border-white dark:border-zinc-900">
                 <Crown className="w-2.5 h-2.5 text-white" />
             </div>
          )}
        </div>
        
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-sm sm:text-base text-zinc-900 dark:text-zinc-100 truncate">
               {member.user.name || member.user.username}
            </p>
            {isMe && (
              <Badge variant="secondary" className="hidden sm:inline-flex text-[10px] h-4 px-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 border-none">
                我
              </Badge>
            )}
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate font-mono">
            @{member.user.username}
          </p>
        </div>
      </div>

      {/* Stats - Compact & Visual */}
      <div className="flex-1 grid grid-cols-2 gap-4 w-full sm:w-auto mt-2 sm:mt-0 px-1 sm:px-4 border-l border-zinc-100 dark:border-white/5">
        {/* Storage */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-[10px] text-zinc-500">
            <span className="flex items-center gap-1"><Database className="w-3 h-3" /> 存储</span>
            <span className={cn("font-medium", storagePercent > 90 ? "text-red-500" : "")}>
                {formatFileSize(Number(storageUsed))}
                {member.storageQuota && <span className="text-zinc-400"> / {formatFileSize(Number(storageQuota))}</span>}
            </span>
          </div>
          <Progress value={storagePercent} className="h-1 bg-zinc-100 dark:bg-white/10" indicatorClassName={cn(storagePercent > 90 ? "bg-red-500" : "bg-blue-500")} />
        </div>

        {/* Files */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-[10px] text-zinc-500">
            <span className="flex items-center gap-1"><Files className="w-3 h-3" /> 文件</span>
            <span className={cn("font-medium", filesPercent > 90 ? "text-red-500" : "")}>
                {filesUsed}
                {member.fileQuota !== null && <span className="text-zinc-400"> / {member.fileQuota}</span>}
            </span>
          </div>
          <Progress value={filesPercent} className="h-1 bg-zinc-100 dark:bg-white/10" indicatorClassName={cn(filesPercent > 90 ? "bg-red-500" : "bg-indigo-500")} />
        </div>
      </div>

      {/* Actions (Only visible for Owner) */}
      {isOwner && (
        <div className="flex items-center justify-end gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity absolute right-2 top-2 sm:static">
            <Button
              variant="ghost" 
              size="icon"
              className="h-8 w-8 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
              onClick={() => onQuotaCheck?.(
                  member.userId, 
                  member.user.username,
                  member.user.name || '',
                  member.storageQuota ? Number(member.storageQuota) : null,
                  member.fileQuota ?? null
              )}
            >
                <Settings2 className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
              onClick={() => onRemove?.(member.userId, member.user.username)}
            >
                <Trash2 className="w-4 h-4" />
            </Button>
        </div>
      )}
    </div>
  );
}
