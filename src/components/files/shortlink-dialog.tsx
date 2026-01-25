// ... imports
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

import { ExpirationSelector, ExpirationValue } from './expiration-selector';

interface ShortlinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (expiresIn: number, unit: 'minutes' | 'hours' | 'days') => Promise<void>;
}

export function ShortlinkDialog({ open, onOpenChange, onConfirm }: ShortlinkDialogProps) {
  const [expiration, setExpiration] = useState<ExpirationValue>({
    expiresIn: 1,
    unit: 'hours',
  });
  
  const [isLoading, setIsLoading] = useState(false);

  // Initialize/Reset
  useEffect(() => {
    if (open) {
      setExpiration({
        expiresIn: 1,
        unit: 'hours',
      });
    }
  }, [open]);

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      await onConfirm(expiration.expiresIn, expiration.unit);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md dark:bg-white/5 backdrop-blur-md border-none">
        <DialogHeader>
          <DialogTitle>生成短链</DialogTitle>
          <DialogDescription>
            选择短链有效期,过期后将自动删除
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <ExpirationSelector 
            value={expiration}
            onChange={setExpiration}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading} className="border-none">
            取消
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading}>
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            生成并复制
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
