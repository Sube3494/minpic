'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface CollectionEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collectionId: string;
  initialName?: string;
  initialDescription?: string;
  onUpdate: () => void;
}

export function CollectionEditDialog({
  open,
  onOpenChange,
  collectionId,
  initialName = '',
  initialDescription = '',
  onUpdate,
}: CollectionEditDialogProps) {
  const [name, setName] = useState(initialName || '');
  const [description, setDescription] = useState(initialDescription || '');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initialName || '');
      setDescription(initialDescription || '');
    }
  }, [open, initialName, initialDescription]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('合集名称不能为空');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/collections/${collectionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update collection');
      }

      toast.success('合集信息已更新');
      onUpdate();
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : '更新合集信息失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>编辑合集信息</DialogTitle>
          <DialogDescription>
            修改合集的名称和描述信息。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label htmlFor="name" className="text-sm font-medium">合集名称</label>
            <Input
              id="name"
              placeholder="请输入合集名称"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="description" className="text-sm font-medium">描述 (可选)</label>
            <Textarea
              id="description"
              placeholder="添加一些描述..."
              className="resize-none"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            保存修改
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
