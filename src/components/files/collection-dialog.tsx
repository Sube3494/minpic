import { useState } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

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
  const [presetValue, setPresetValue] = useState('3-days');
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      if (shortlinkEnabled) {
        const [val, u] = presetValue.split('-');
        await onConfirm(name, parseInt(val), u as 'minutes' | 'hours' | 'days');
      } else {
        await onConfirm(name);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const presets = [
    { label: '10分钟', value: '10-minutes' },
    { label: '30分钟', value: '30-minutes' },
    { label: '1小时', value: '1-hours' },
    { label: '3小时', value: '3-hours' },
    { label: '12小时', value: '12-hours' },
    { label: '1天', value: '1-days' },
    { label: '3天', value: '3-days' },
    { label: '7天', value: '7-days' },
  ];

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
            <div className="space-y-2">
              <Label>有效期</Label>
              <Select value={presetValue} onValueChange={setPresetValue}>
                <SelectTrigger className="w-full border-none bg-zinc-100/50 dark:bg-white/5 shadow-none focus:ring-1 focus:ring-white/20">
                  <SelectValue placeholder="选择有效期" />
                </SelectTrigger>
                <SelectContent 
                  position="popper" 
                  side="bottom" 
                  className="border-none bg-zinc-900/90 backdrop-blur-xl text-white/90 shadow-2xl min-w-(--radix-select-trigger-width)"
                >
                  {presets.map((preset) => (
                    <SelectItem 
                      key={preset.value} 
                      value={preset.value}
                      className="focus:bg-white/10 focus:text-white cursor-pointer"
                    >
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            创建并复制
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
