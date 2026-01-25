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
import { Loader2 } from 'lucide-react';

import { ExpirationSelector, ExpirationValue } from './expiration-selector';

interface CollectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  shortlinkEnabled: boolean;
  onConfirm: (name: string, expiresIn?: number, unit?: 'minutes' | 'hours' | 'days') => Promise<void>;
}

export function CollectionDialog({
  open,
  onOpenChange,
  selectedCount,
  shortlinkEnabled,
  onConfirm,
}: CollectionDialogProps) {
  const [name, setName] = useState('');
  const [expiration, setExpiration] = useState<ExpirationValue>({
    expiresIn: 3,
    unit: 'days',
  });
  const [isLoading, setIsLoading] = useState(false);

  // Reset name when dialog opens
  useEffect(() => {
    if (open) {
      setName('');
      setExpiration({
        expiresIn: 3,
        unit: 'days',
      });
    }
  }, [open]);

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      if (shortlinkEnabled) {
        await onConfirm(name, expiration.expiresIn, expiration.unit);
      } else {
        await onConfirm(name);
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
            {shortlinkEnabled 
              ? `将创建包含 ${selectedCount} 个文件的合集（自动生成分享短链）`
              : `将创建包含 ${selectedCount} 个文件的合集`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="collection-name">合集名称 (可选)</Label>
            <Input
              id="collection-name"
              placeholder="命名此合集..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border-none bg-zinc-100/50 dark:bg-white/5 shadow-none focus-visible:ring-1 focus-visible:ring-white/20"
            />
          </div>

          {shortlinkEnabled && (
            <ExpirationSelector 
              value={expiration}
              onChange={setExpiration}
            />
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
            创建并复制
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
