// ... imports
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

interface ShortlinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (expiresIn: number, unit: 'minutes' | 'hours' | 'days') => Promise<void>;
}

export function ShortlinkDialog({ open, onOpenChange, onConfirm }: ShortlinkDialogProps) {
  // Mode: 'preset' or 'custom'
  const [mode, setMode] = useState<'preset' | 'custom'>('preset');
  // Preset selection value (e.g. "1-hours")
  const [presetValue, setPresetValue] = useState<string>('1-hours');
  
  // Custom values
  const [customExpiresIn, setCustomExpiresIn] = useState('1');
  const [customUnit, setCustomUnit] = useState<'minutes' | 'hours' | 'days'>('hours');
  
  const [isLoading, setIsLoading] = useState(false);

  // Initialize/Reset
  useEffect(() => {
    if (open) {
      setMode('preset');
      setPresetValue('1-hours');
      setCustomExpiresIn('1');
      setCustomUnit('hours');
    }
  }, [open]);

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      if (mode === 'preset') {
        const [val, u] = presetValue.split('-');
        await onConfirm(parseInt(val), u as 'minutes' | 'hours' | 'days');
      } else {
        await onConfirm(parseInt(customExpiresIn), customUnit);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const presets = [
    { label: '30分钟', value: '30', unit: 'minutes' as const },
    { label: '1小时', value: '1', unit: 'hours' as const },
    { label: '6小时', value: '6', unit: 'hours' as const },
    { label: '12小时', value: '12', unit: 'hours' as const },
    { label: '1天', value: '1', unit: 'days' as const },
    { label: '3天', value: '3', unit: 'days' as const },
    { label: '7天', value: '7', unit: 'days' as const },
    { label: '30天', value: '30', unit: 'days' as const },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>生成短链</DialogTitle>
          <DialogDescription>
            选择短链有效期,过期后将自动删除
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <Label>有效期</Label>
            <Select 
              value={mode === 'custom' ? 'custom' : presetValue} 
              onValueChange={(val) => {
                if (val === 'custom') {
                  setMode('custom');
                } else {
                  setMode('preset');
                  setPresetValue(val);
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="选择有效期" />
              </SelectTrigger>
              <SelectContent>
                {presets.map((preset) => (
                  <SelectItem key={`${preset.value}-${preset.unit}`} value={`${preset.value}-${preset.unit}`}>
                    {preset.label}
                  </SelectItem>
                ))}
                <SelectItem value="custom">自定义时长</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {mode === 'custom' && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
              <Label htmlFor="custom">设置时长</Label>
              <div className="flex gap-2 items-center">
                <input
                  id="custom"
                  type="number"
                  min="1"
                  value={customExpiresIn}
                  onChange={(e) => setCustomExpiresIn(e.target.value)}
                  className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
                <Select value={customUnit} onValueChange={(value: string) => setCustomUnit(value as 'minutes' | 'hours' | 'days')}>
                  <SelectTrigger className="w-[110px] rounded-xl shrink-0" style={{ height: '44px' }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="min-w-[110px]">
                    <SelectItem value="minutes" className="text-sm py-1.5">分钟</SelectItem>
                    <SelectItem value="hours" className="text-sm py-1.5">小时</SelectItem>
                    <SelectItem value="days" className="text-sm py-1.5">天</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
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
