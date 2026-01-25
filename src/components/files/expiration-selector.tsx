import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface ExpirationValue {
  expiresIn: number;
  unit: 'minutes' | 'hours' | 'days';
}

interface ExpirationSelectorProps {
  value: ExpirationValue;
  onChange: (value: ExpirationValue) => void;
  className?: string;
}

const PRESETS = [
  { label: '10分钟', value: '10', unit: 'minutes' as const },
  { label: '30分钟', value: '30', unit: 'minutes' as const },
  { label: '1小时', value: '1', unit: 'hours' as const },
  { label: '3小时', value: '3', unit: 'hours' as const },
  { label: '12小时', value: '12', unit: 'hours' as const },
  { label: '1天', value: '1', unit: 'days' as const },
  { label: '3天', value: '3', unit: 'days' as const },
];

export function ExpirationSelector({ value, onChange, className }: ExpirationSelectorProps) {
  // We use a local state to track if the user EXPLICITLY chose 'custom' mode.
  // Otherwise, we try to match the prop 'value' to a preset.
  const matchedPreset = PRESETS.find(p => p.value === String(value.expiresIn) && p.unit === value.unit);
  
  // Local state for toggling between preset and custom UI
  const [isCustomMode, setIsCustomMode] = useState(!matchedPreset);

  // Sync isCustomMode if value changes to something that DOES NOT match a preset and we are not in custom mode
  // But wait, it's safer to just rely on isCustomMode state for UI toggle, and matchedPreset for the Select value.
  
  const handlePresetChange = (val: string) => {
    if (val === 'custom') {
      setIsCustomMode(true);
    } else {
      setIsCustomMode(false);
      const [v, u] = val.split('-');
      onChange({ expiresIn: parseInt(v), unit: u as 'minutes' | 'hours' | 'days' });
    }
  };

  const handleCustomValueChange = (v: string) => {
    onChange({ ...value, expiresIn: parseInt(v) || 0 });
  };

  const handleCustomUnitChange = (u: string) => {
    onChange({ ...value, unit: u as 'minutes' | 'hours' | 'days' });
  };

  const currentPresetValue = matchedPreset ? `${matchedPreset.value}-${matchedPreset.unit}` : '';

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="space-y-2">
        <Label>有效期</Label>
        <Select 
          value={isCustomMode ? 'custom' : currentPresetValue} 
          onValueChange={handlePresetChange}
        >
          <SelectTrigger className="w-full border-none bg-zinc-100/50 dark:bg-white/5 shadow-none focus:ring-1 focus:ring-white/20">
            <SelectValue placeholder="选择有效期" />
          </SelectTrigger>
          <SelectContent 
            position="popper" 
            side="bottom" 
            sideOffset={4}
            className="border border-zinc-200/50 dark:border-white/10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl text-zinc-900 dark:text-white/90 shadow-2xl min-w-(--radix-select-trigger-width) rounded-xl overflow-hidden"
          >
            {PRESETS.map((preset) => (
              <SelectItem 
                key={`${preset.value}-${preset.unit}`} 
                value={`${preset.value}-${preset.unit}`}
                className="focus:bg-zinc-100 dark:focus:bg-white/10 focus:text-zinc-950 dark:focus:text-white cursor-pointer py-2"
              >
                {preset.label}
              </SelectItem>
            ))}
            <SelectItem value="custom" className="focus:bg-zinc-100 dark:focus:bg-white/10 focus:text-zinc-950 dark:focus:text-white cursor-pointer py-2 border-t border-zinc-100 dark:border-white/5 mt-1">
              自定义时长
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isCustomMode && (
        <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <Label htmlFor="custom-duration">设置时长</Label>
          <div className="flex gap-2 items-center">
            <input
              id="custom-duration"
              type="number"
              min="1"
              value={value.expiresIn || ''}
              onChange={(e) => handleCustomValueChange(e.target.value)}
              onWheel={(e) => e.currentTarget.blur()}
              className="flex h-10 w-full rounded-lg border-none bg-zinc-100/50 dark:bg-white/5 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus:ring-1 focus:ring-white/20 disabled:cursor-not-allowed disabled:opacity-50 no-spinner"
            />
            <Select value={value.unit} onValueChange={handleCustomUnitChange}>
              <SelectTrigger className="w-[110px] rounded-lg shrink-0 border-none bg-zinc-100/50 dark:bg-white/5 shadow-none focus:ring-1 focus:ring-white/20" style={{ height: '40px' }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent 
                className="min-w-[110px] border border-zinc-200/50 dark:border-white/10 bg-white/80 dark:bg-zinc-900/90 backdrop-blur-xl text-zinc-900 dark:text-white/90 shadow-2xl rounded-xl overflow-hidden" 
                position="popper" 
                side="bottom"
                sideOffset={4}
              >
                <SelectItem value="minutes" className="focus:bg-zinc-100 dark:focus:bg-white/10 cursor-pointer py-2">分钟</SelectItem>
                <SelectItem value="hours" className="focus:bg-zinc-100 dark:focus:bg-white/10 cursor-pointer py-2">小时</SelectItem>
                <SelectItem value="days" className="focus:bg-zinc-100 dark:focus:bg-white/10 cursor-pointer py-2">天</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}
