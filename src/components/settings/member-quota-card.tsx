'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Database, Files, Info, AlertTriangle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { TeamMember } from '@/services/team.service';

interface MemberQuotaCardProps {
  memberInfo?: TeamMember | null;
  totalTeamStorage?: bigint;
  totalTeamFiles?: number;
  isOwner?: boolean;
  overrideStorageUsed?: bigint;
  overrideFileCount?: number;
}

export function MemberQuotaCard({ 
  memberInfo, 
  totalTeamStorage, 
  totalTeamFiles, 
  isOwner = false,
  overrideStorageUsed,
  overrideFileCount
}: MemberQuotaCardProps) {
  if (!memberInfo) return null;
  
  // Logic: 
  // 1. If explicit quota is set (and > 0), use that.
  // 2. If no explicit quota, but is Owner, use Team Total.
  // 3. If no explicit quota and not Owner, show "Waiting" (or arguably "Unlimited" if that's the policy, but let's stick to "Waiting" for members unless we know they share).
  //    Actually, for this app, usually members share team quota if not restricted? 
  //    Based on the "Waiting" message design, it implies members MUST have quota assigned. 
  //    But Owner DEFINITELY should show Team Total if not restricted (and Owner usually isn't restricted).

  // Let's assume:
  // - Owner: Defaults to Team Quota if personal quota is not set.
  // - Member: Defaults to 0 ("Waiting") if personal quota is not set. 
  
  const effectiveStorageQuota = memberInfo.storageQuota 
    ? BigInt(memberInfo.storageQuota) 
    : (isOwner ? totalTeamStorage : BigInt(0));

  const effectiveFileQuota = memberInfo.fileQuota !== null && memberInfo.fileQuota !== undefined
    ? memberInfo.fileQuota
    : (isOwner ? totalTeamFiles : 0);

  // Check if we effectively have a quota to show
  // (For owner, team quota might be 0? unlikley. If 0, then effectively no quota)
  const hasStorageQuota = effectiveStorageQuota && effectiveStorageQuota > BigInt(0);
  const hasFileQuota = effectiveFileQuota && effectiveFileQuota > 0;
  
  const hasQuota = hasStorageQuota || hasFileQuota;

  // Format bytes to MB/GB
  const formatStorageSize = (bytes: string | number | bigint | null | undefined) => {
    if (!bytes) return '0 B';
    const num = Number(bytes);
    if (isNaN(num)) return '0 B';
    
    if (num < 1024 * 1024 * 1024) {
      return `${(num / (1024 * 1024)).toFixed(2)} MB`;
    }
    return `${(num / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const actualStorageUsed = overrideStorageUsed !== undefined ? overrideStorageUsed : BigInt(memberInfo.user.storageUsed || 0);
  const actualFileCount = overrideFileCount !== undefined ? overrideFileCount : (memberInfo.user.fileCount || 0);

  const storageUsed = formatStorageSize(actualStorageUsed);
  const storageQuotaDisplay = formatStorageSize(effectiveStorageQuota);
  const storagePercent = effectiveStorageQuota && effectiveStorageQuota > BigInt(0) 
    ? (Number(actualStorageUsed) / Number(effectiveStorageQuota)) * 100 
    : 0;

  const fileCount = actualFileCount;
  const filePercent = effectiveFileQuota && effectiveFileQuota > 0 
    ? (fileCount / effectiveFileQuota) * 100 
    : 0;

  return (
    <Card className="glass-strong border-zinc-200/50 dark:border-white/10 shadow-lg bg-white/50 dark:bg-black/20 overflow-hidden h-full flex flex-col">
      <CardHeader className="pb-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg font-bold text-zinc-800 dark:text-zinc-100 tracking-tight">
              个人配额
            </CardTitle>
            <CardDescription className="text-xs text-zinc-500 dark:text-zinc-400">
              {isOwner 
                ? '您作为团队拥有者，享有团队全部剩余资源的使用权' 
                : (hasQuota ? '管理员为您分配的资源限制' : '等待管理员分配额度')}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6 flex-1 flex flex-col justify-center py-4">
        {!hasQuota ? (
          <div className="flex flex-col items-center justify-center py-4 text-center space-y-3 flex-1 h-full">
            <div className="p-3 rounded-full bg-amber-50 dark:bg-amber-900/20 mb-1">
              <Info className="w-8 h-8 text-amber-500 dark:text-amber-400" />
            </div>
            <div className="space-y-1 max-w-[280px]">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                等待分配额度
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                您当前无法上传文件。请联系团队管理员为您分配存储空间和文件数量限额。
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Storage Quota */}
            {hasStorageQuota && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                      <Database className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      存储空间
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                    {storageUsed} / {storageQuotaDisplay}
                  </span>
                </div>
                <Progress 
                  value={Math.min(storagePercent, 100)} 
                  className={cn(
                    "h-2",
                    storagePercent > 90 && "bg-red-100 dark:bg-red-950/30"
                  )}
                  indicatorClassName={cn(
                    storagePercent > 90 
                      ? "bg-red-500" 
                      : storagePercent > 70 
                        ? "bg-amber-500" 
                        : "bg-purple-500"
                  )}
                />
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {storagePercent > 90 ? (
                    <span className="text-red-600 dark:text-red-400 font-medium flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      配额即将用尽
                    </span>
                  ) : (
                    `已使用 ${storagePercent.toFixed(1)}%`
                  )}
                </p>
              </div>
            )}

            {/* File Quota */}
            {hasFileQuota && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                      <Files className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      文件数量
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                    {fileCount} / {effectiveFileQuota}
                  </span>
                </div>
                <Progress 
                  value={Math.min(filePercent, 100)} 
                  className={cn(
                    "h-2",
                    filePercent > 90 && "bg-red-100 dark:bg-red-950/30"
                  )}
                  indicatorClassName={cn(
                    filePercent > 90 
                      ? "bg-red-500" 
                      : filePercent > 70 
                        ? "bg-amber-500" 
                        : "bg-emerald-500"
                  )}
                />
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {filePercent > 90 ? (
                    <span className="text-red-600 dark:text-red-400 font-medium flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      配额即将用尽
                    </span>
                  ) : (
                    `已使用 ${filePercent.toFixed(1)}%`
                  )}
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
