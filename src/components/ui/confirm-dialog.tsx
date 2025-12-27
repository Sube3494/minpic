import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Loader2 } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  variant?: 'default' | 'destructive';
  isLoading?: boolean;
  deleteMode?: 'full' | 'record-only';
  onDeleteModeChange?: (mode: 'full' | 'record-only') => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = '确定',
  cancelText = '取消',
  onConfirm,
  variant = 'default',
  isLoading = false,
  deleteMode,
  onDeleteModeChange,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="whitespace-pre-line">
              {description}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        {/* Delete Mode Selector */}
        {/* Delete Mode Selector */}
        {/* Delete Mode Selector */}
        {deleteMode !== undefined && onDeleteModeChange && (
          <div className="py-4 space-y-3">
            <RadioGroup value={deleteMode} onValueChange={onDeleteModeChange}>
              {/* Record Only Option */}
              <div 
                className={cn(
                  "flex items-start space-x-3 p-3 rounded-lg border transition-all duration-300 ease-in-out cursor-pointer relative",
                  deleteMode === 'record-only' 
                    ? "border-blue-500 bg-blue-50/50 ring-1 ring-blue-500/20 dark:bg-blue-900/20 dark:border-blue-400 shadow-sm shadow-blue-500/10" 
                    : "border-border hover:bg-accent/50 hover:border-blue-500/30"
                )}
                onClick={() => onDeleteModeChange('record-only')}
              >
                <div className={cn("transition-all duration-300 ease-in-out", deleteMode === 'record-only' ? "scale-100" : "scale-100 opacity-70")}>
                   <RadioGroupItem value="record-only" id="record-only" className={cn("mt-0.5 shrink-0 transition-all duration-300", deleteMode === 'record-only' && "border-blue-500 text-blue-500")} />
                </div>
                <div className="flex-1 transition-all duration-300">
                  <Label htmlFor="record-only" className={cn(
                    "text-base font-bold cursor-pointer block mb-1 transition-colors duration-300",
                    deleteMode === 'record-only' ? "text-blue-600 dark:text-blue-400" : "text-foreground"
                  )}>
                    仅删除记录（推荐）
                  </Label>
                  <p className={cn(
                    "text-sm leading-relaxed font-medium transition-colors duration-300",
                    deleteMode === 'record-only' ? "text-blue-600/80 dark:text-blue-300/90" : "text-gray-500 dark:text-gray-400"
                  )}>
                    只删除数据库记录，保留MinIO中的文件，可重新同步
                  </p>
                </div>
              </div>
              
              {/* Full Delete Option */}
              <div 
                className={cn(
                  "flex items-start space-x-3 p-3 rounded-lg border transition-all duration-300 ease-in-out cursor-pointer relative",
                  deleteMode === 'full' 
                    ? "border-red-500 bg-red-50/50 ring-1 ring-red-500/20 dark:bg-red-900/20 dark:border-red-400 shadow-sm shadow-red-500/10" 
                    : "border-border hover:bg-destructive/5 hover:border-red-500/30"
                )}
                onClick={() => onDeleteModeChange('full')}
              >
                <div className={cn("transition-all duration-300 ease-in-out", deleteMode === 'full' ? "scale-100" : "scale-100 opacity-70")}>
                  <RadioGroupItem value="full" id="full" className={cn("mt-0.5 shrink-0 transition-all duration-300", deleteMode === 'full' ? "border-red-500 text-red-500" : "border-gray-400")} />
                </div>
                <div className="flex-1 transition-all duration-300">
                  <Label htmlFor="full" className={cn(
                    "text-base font-bold cursor-pointer block mb-1 transition-colors duration-300",
                    deleteMode === 'full' ? "text-red-600 dark:text-red-400" : "text-foreground"
                  )}>
                    完全删除
                  </Label>
                  <p className={cn(
                    "text-sm leading-relaxed font-medium transition-colors duration-300",
                    deleteMode === 'full' ? "text-red-600/80 dark:text-red-300/90" : "text-gray-500 dark:text-gray-400"
                  )}>
                    同时删除数据库记录、MinIO文件和短链，无法恢复
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>
        )}
        
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>{cancelText}</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isLoading}
            className={variant === 'destructive' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
