'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface User {
  id: string;
  username: string;
  name: string | null;
  role: string;
  status: string;
  storageQuota: string;
  fileQuota: number;
}

interface UserEditDialogProps {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function UserEditDialog({ user, open, onOpenChange, onSuccess }: UserEditDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    role: user?.role || 'USER',
    status: user?.status || 'ACTIVE',
    storageQuota: user ? (Number(user.storageQuota) / (1024 * 1024)).toFixed(0) : '5120',
    fileQuota: user?.fileQuota || 10000,
  });

  // Update form data when user changes
  // Update form data when user changes
  useEffect(() => {
    if (user) {
      setFormData({
        role: user.role,
        status: user.status,
        storageQuota: (Number(user.storageQuota) / (1024 * 1024)).toFixed(0),
        fileQuota: user.fileQuota,
      });
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: formData.role,
          status: formData.status,
          storageQuota: (parseFloat(formData.storageQuota) * (1024 * 1024)).toString(),
          fileQuota: formData.fileQuota,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update user');
      }

      toast.success('用户信息已更新');
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '更新失败');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>编辑用户</DialogTitle>
          <DialogDescription>
            修改 <span className="font-semibold text-foreground">@{user.username}</span> 的信息
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            {/* Role */}
            <div className="space-y-2">
              <Label htmlFor="role">角色</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value })}
                disabled={user.role === 'ADMIN'}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="USER">普通用户</SelectItem>
                  <SelectItem value="ADMIN">管理员</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label htmlFor="status">状态</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
                disabled={user.role === 'ADMIN'}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="ACTIVE">正常</SelectItem>

                  <SelectItem value="SUSPENDED">暂停</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Storage Quota */}
            <div className="space-y-2">
              <Label htmlFor="storageQuota">存储配额 (MB)</Label>
              <Input
                id="storageQuota"
                type="number"
                step="1"
                min="0"
                className="no-spinner"
                value={formData.storageQuota}
                onChange={(e) => setFormData({ ...formData, storageQuota: e.target.value })}
                onWheel={(e) => e.currentTarget.blur()}
              />
            </div>

            {/* File Quota */}
            <div className="space-y-2">
              <Label htmlFor="fileQuota">文件配额</Label>
              <Input
                id="fileQuota"
                type="number"
                min="0"
                className="no-spinner"
                value={formData.fileQuota}
                onChange={(e) => setFormData({ ...formData, fileQuota: parseInt(e.target.value) })}
                onWheel={(e) => e.currentTarget.blur()}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              取消
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
