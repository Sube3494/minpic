import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

import { ExpirationSelector, ExpirationValue } from './expiration-selector';

interface CollectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  shortlinkEnabled: boolean;
  onConfirm: (name: string, shared?: boolean, expiresIn?: number, unit?: 'minutes' | 'hours' | 'days') => Promise<void>;
  defaultShare?: boolean;
}

export function CollectionDialog({
  open,
  onOpenChange,
  selectedCount,
  shortlinkEnabled,
  onConfirm,
}: CollectionDialogProps) {
  const [name, setName] = useState('');
  const [shareImmediately, setShareImmediately] = useState(false);
  const [expiration, setExpiration] = useState<ExpirationValue>({
    expiresIn: 3,
    unit: 'days',
  });
  const [isLoading, setIsLoading] = useState(false);

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setName('');
      setShareImmediately(false);
      setExpiration({
        expiresIn: 3,
        unit: 'days',
      });
    }
  }, [open]);

  const handleConfirm = async () => {
    if (!name.trim()) {
      toast.error('请填写合集名称');
      return;
    }

    setIsLoading(true);
    try {
      if (shareImmediately && shortlinkEnabled) {
        await onConfirm(name, true, expiration.expiresIn, expiration.unit);
      } else {
        await onConfirm(name, false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md dark:bg-white/5 backdrop-blur-md border-none">
        <DialogHeader>
          <DialogTitle>创建媒体合集</DialogTitle>
          <DialogDescription>
            将 {selectedCount} 个文件组织为合集，方便您统一管理
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="collection-name">合集名称</Label>
            <Input
              id="collection-name"
              placeholder="为此合集命名..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border-none bg-zinc-100/50 dark:bg-white/5 shadow-none focus-visible:ring-1 focus-visible:ring-white/20"
            />
          </div>

          {shortlinkEnabled && (
            <div className="pt-2">
              <div 
                className="flex items-center space-x-3 py-2 cursor-pointer group select-none"
                onClick={() => setShareImmediately(!shareImmediately)}
              >
                <div className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center transition-all duration-300",
                  shareImmediately
                    ? "bg-primary border border-primary text-white scale-110"
                    : "bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-transparent group-hover:border-primary/50"
                )}>
                  <Check className="w-3 h-3" strokeWidth={4} />
                </div>
                <Label 
                  className="text-sm font-medium cursor-pointer"
                >
                  立即生成分享链接
                </Label>
              </div>

              {shareImmediately && (
                <ExpirationSelector 
                  value={expiration}
                  onChange={setExpiration}
                />
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="border-none"
          >
            取消
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading}>
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {shareImmediately ? '创建并复制链接' : '确认创建'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
