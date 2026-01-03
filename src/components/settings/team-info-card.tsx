'use client';
import { useState } from 'react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Users, Crown, Shield, Calendar, Settings, HardDrive, File as FileIcon, LogOut } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { TeamInfo } from '@/services/team.service';
import { cn } from '@/lib/utils';

interface TeamInfoCardProps {
  teamInfo: TeamInfo;
  onLeave: () => void;
  onUpdate?: (name?: string, description?: string, storageQuotaMB?: number, fileQuota?: number) => Promise<void>;
}

export function TeamInfoCard({ teamInfo, onLeave, onUpdate }: TeamInfoCardProps) {
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    storageQuotaMB: '',
    fileQuota: ''
  });
  const [updating, setUpdating] = useState(false);

  if (!teamInfo.team || !teamInfo.role) return null;

  const { team, role } = teamInfo;
  const isOwner = role === 'OWNER';
  const isAdmin = role === 'ADMIN';

  const handleEditClick = () => {
    setEditForm({
      name: team.name,
      description: team.description || '',
      storageQuotaMB: team.storageQuota ? (Number(team.storageQuota) / (1024 * 1024)).toString() : '500', 
      fileQuota: team.fileQuota.toString()
    });
    setEditOpen(true);
  };

  const handleUpdate = async () => {
    if (!onUpdate) return;
    setUpdating(true);
    try {
      await onUpdate(
        editForm.name, 
        editForm.description, 
        Number(editForm.storageQuotaMB), 
        Number(editForm.fileQuota)
      );
      setEditOpen(false);
    } catch {
      // Toast handled by hook
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Card className="glass-strong border-zinc-200/50 dark:border-white/10 shadow-lg bg-white/50 dark:bg-black/20 overflow-hidden relative group">
       <div className="absolute inset-0 bg-linear-to-br from-indigo-500/5 via-transparent to-transparent opacity-50" />
      
      <CardHeader className="pb-4 relative">
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
             <div className="flex items-center gap-2">
                <CardTitle className="text-xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                  {team.name}
                </CardTitle>
                <Badge 
                  variant="secondary"
                  className={cn(
                    "text-[10px] px-2 py-0.5 border-none",
                    isOwner ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : 
                    isAdmin ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" :
                    "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                  )}
                >
                  {isOwner && <Crown className="w-3 h-3 mr-1" />}
                  {isAdmin && <Shield className="w-3 h-3 mr-1" />}
                  {isOwner ? '所有者' : isAdmin ? '管理员' : '成员'}
                </Badge>
             </div>
            <CardDescription className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 max-w-[280px]">
              {team.description || '暂无团队描述'}
            </CardDescription>
          </div>
          
          {isOwner && onUpdate && (
             <Button 
               size="icon" 
               variant="ghost" 
               className="h-8 w-8 rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/10" 
               onClick={handleEditClick}
             >
               <Settings className="w-4 h-4" />
             </Button>
          )}
        </div>
      </CardHeader>
      
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
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
            <div className="grid grid-cols-2 gap-4">
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
                />
              </div>
            </div>
          </div>
          <DialogFooter>
             <Button variant="outline" onClick={() => setEditOpen(false)}>取消</Button>
             <Button onClick={handleUpdate} disabled={updating} className="bg-primary text-primary-foreground">
               {updating ? '保存中...' : '保存修改'}
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <CardContent className="space-y-6 relative">

        {/* Info Grid */}
        <div className="grid grid-cols-1 gap-4">
          
           {/* Owner Row */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-50/50 dark:bg-white/5 border border-zinc-100 dark:border-white/5">
                <Avatar className="w-10 h-10 ring-2 ring-white dark:ring-white/5 shadow-xs">
                  <AvatarImage src={team.owner.avatar || undefined} />
                  <AvatarFallback className="text-xs bg-indigo-50 text-indigo-500 dark:bg-indigo-900/20 dark:text-indigo-400">
                    {team.owner.name?.[0] || team.owner.username[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                   <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-0.5">创建者</p>
                   <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                     {team.owner.name || team.owner.username}
                   </p>
                </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 gap-3">
               <div className="flex flex-col gap-1 p-3 rounded-xl bg-zinc-50/50 dark:bg-white/5 border border-zinc-100 dark:border-white/5">
                  <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                     <Users className="w-3.5 h-3.5" />
                     <span className="text-xs font-medium">团队规模</span>
                  </div>
                  <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mt-1">
                    {team.members.length} <span className="text-xs font-normal text-zinc-400">人</span>
                  </p>
               </div>
               
               <div className="flex flex-col gap-1 p-3 rounded-xl bg-zinc-50/50 dark:bg-white/5 border border-zinc-100 dark:border-white/5">
                  <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                     <Calendar className="w-3.5 h-3.5" />
                     <span className="text-xs font-medium">成立时间</span>
                  </div>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mt-auto">
                    {format(new Date(team.createdAt), 'yyyy-MM-dd', { locale: zhCN })}
                  </p>
               </div>
            </div>

        </div>

        {/* Leave Team Button - Only for non-owners */}
        {!isOwner && (
          <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogTrigger asChild>
              <button
                className="w-full p-3 rounded-xl bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 flex items-center justify-center gap-2 text-red-600 dark:text-red-400 hover:bg-red-100/50 dark:hover:bg-red-900/20 transition-colors group/btn"
              >
                <LogOut className="w-4 h-4 group-hover/btn:-translate-x-0.5 transition-transform" />
                <span className="text-sm font-medium">退出团队</span>
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认退出团队?</AlertDialogTitle>
                <AlertDialogDescription>
                  您确定要退出团队 <span className="font-bold text-foreground">{team.name}</span> 吗？
                  <br />
                  退出后，您将无法访问团队共享的资源，且需要重新加入才能恢复权限。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={onLeave}
                  className="bg-red-600 hover:bg-red-700 text-white border-red-600"
                >
                  确认退出
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </CardContent>
    </Card>
  );
}
