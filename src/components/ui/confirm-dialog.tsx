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
import { Loader2, Database, Trash2 } from 'lucide-react';
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
  confirmDisabled?: boolean;
  cancelDisabled?: boolean;
  deleteMode?: 'full' | 'record-only';
  onDeleteModeChange?: (mode: 'full' | 'record-only') => void;
  hideCancelButton?: boolean;
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
  confirmDisabled,
  cancelDisabled,
  deleteMode,
  onDeleteModeChange,
  hideCancelButton,
}: ConfirmDialogProps) {
  // 根据删除模式动态决定按钮变体
  const activeVariant = deleteMode === 'full' ? 'destructive' : variant;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-[500px] gap-6">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl font-bold">{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="whitespace-pre-line text-base text-muted-foreground/80">
              {description}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        {/* Delete Mode Selector */}
        {deleteMode !== undefined && onDeleteModeChange && (
          <div className="space-y-3">
            <RadioGroup value={deleteMode} onValueChange={onDeleteModeChange} className="gap-3">
              {/* Record Only Option */}
              <div 
                className={cn(
                  "relative flex items-start space-x-4 p-4 rounded-xl border-2 transition-all duration-300 ease-in-out cursor-pointer group hover:bg-zinc-50 dark:hover:bg-white/5",
                  deleteMode === 'record-only' 
                    ? "border-blue-500 bg-blue-50/30 dark:bg-blue-950/10 shadow-sm" 
                    : "border-zinc-200 dark:border-zinc-800 bg-transparent opacity-80 hover:opacity-100"
                )}
                onClick={() => onDeleteModeChange('record-only')}
              >
                {/* Icon */}
                <div className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-full shrink-0 transition-colors duration-300",
                  deleteMode === 'record-only' 
                    ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" 
                    : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 group-hover:bg-blue-50 group-hover:text-blue-500 dark:group-hover:bg-white/10"
                )}>
                  <Database className="w-5 h-5" />
                </div>

                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className={cn(
                      "text-base font-bold cursor-pointer transition-colors",
                      deleteMode === 'record-only' ? "text-blue-600 dark:text-blue-400" : "text-foreground"
                    )}>
                      仅删除记录
                      <span className="ml-2 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                        推荐
                      </span>
                    </Label>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    只删除数据库记录，保留MinIO中的文件，可重新同步
                  </p>
                </div>

                {/* Hidden Radio for accessibility */}
                <RadioGroupItem value="record-only" id="record-only" className="sr-only" />
              </div>
              
              {/* Full Delete Option */}
              <div 
                className={cn(
                  "relative flex items-start space-x-4 p-4 rounded-xl border-2 transition-all duration-300 ease-in-out cursor-pointer group hover:bg-zinc-50 dark:hover:bg-white/5 overflow-hidden",
                  deleteMode === 'full' 
                    ? "border-red-500 bg-red-50/30 dark:bg-red-950/10 shadow-sm" 
                    : "border-zinc-200 dark:border-zinc-800 bg-transparent opacity-80 hover:opacity-100"
                )}
                onClick={() => onDeleteModeChange('full')}
              >
                 {/* Icon */}
                 <div className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-full shrink-0 transition-colors duration-300",
                  deleteMode === 'full' 
                    ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" 
                    : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 group-hover:bg-red-50 group-hover:text-red-500 dark:group-hover:bg-white/10"
                )}>
                  <Trash2 className="w-5 h-5" />
                </div>

                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className={cn(
                      "text-base font-bold cursor-pointer transition-colors",
                      deleteMode === 'full' ? "text-red-600 dark:text-red-400" : "text-foreground"
                    )}>
                      完全删除
                    </Label>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    同时删除数据库记录、MinIO文件和短链，<span className="font-bold text-red-500/80">无法恢复</span>
                  </p>
                </div>

                {/* Hidden Radio for accessibility */}
                <RadioGroupItem value="full" id="full" className="sr-only" />
              </div>
            </RadioGroup>
          </div>
        )}
        
        <AlertDialogFooter className="gap-3 sm:gap-4">
          {!hideCancelButton && (
            <AlertDialogCancel disabled={cancelDisabled ?? isLoading} className="rounded-full h-10 px-6 font-medium">
              {cancelText}
            </AlertDialogCancel>
          )}
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={confirmDisabled ?? isLoading}
            className={cn(
              "rounded-full h-10 px-6 font-bold shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none",
              activeVariant === 'destructive' 
                ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/20' 
                : 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/20'
            )}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
