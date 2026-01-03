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
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  variant?: 'default' | 'destructive';
  isLoading?: boolean;
  confirmDisabled?: boolean;
  cancelDisabled?: boolean;
  deleteMode?: 'full' | 'record-only';
  onDeleteModeChange?: (mode: 'full' | 'record-only') => void;
  hideCancelButton?: boolean;
  footer?: React.ReactNode;
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
  footer,
}: ConfirmDialogProps) {
  // 根据删除模式动态决定按钮变体
  const activeVariant = deleteMode === 'full' ? 'destructive' : variant;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="w-[90vw] sm:max-w-[500px] gap-6">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl font-semibold">{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="whitespace-pre-line text-base text-muted-foreground/80">
              {description}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        {/* Delete Mode Selector */}
        {deleteMode !== undefined && onDeleteModeChange && (
          <div className="space-y-3">
            <div 
              className={cn(
                "flex items-center justify-between p-4 rounded-xl border transition-all duration-200 cursor-pointer group",
                deleteMode === 'full'
                  ? "bg-red-50/50 border-red-200 dark:bg-red-500/10 dark:border-red-500/20"
                  : "bg-zinc-50 dark:bg-white/5 border-zinc-100 dark:border-white/5 hover:bg-zinc-100 dark:hover:bg-white/10"
              )}
              onClick={() => onDeleteModeChange(deleteMode === 'full' ? 'record-only' : 'full')}
            >
              <div className="grid gap-1">
                <label
                  htmlFor="delete-physical"
                  className={cn(
                    "text-sm font-medium cursor-pointer transition-colors",
                    deleteMode === 'full' ? "text-red-700 dark:text-red-300" : "text-zinc-700 dark:text-zinc-200"
                  )}
                  style={{ pointerEvents: 'none' }}
                >
                  同时删除 MinIO 中的物理文件
                </label>
                <p className="text-[13px] text-muted-foreground leading-relaxed pr-4">
                  默认仅移除记录。勾选则彻底删除文件且 <span className="text-red-600 dark:text-red-400 font-medium">无法恢复</span>。
                </p>
              </div>
              <Checkbox 
                id="delete-physical" 
                checked={deleteMode === 'full'}
                onCheckedChange={(checked) => onDeleteModeChange(checked ? 'full' : 'record-only')}
                className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500 transition-colors shrink-0"
                onClick={(e) => e.stopPropagation()} 
              />
            </div>
          </div>
        )}
        
        {footer ? footer : (
          <AlertDialogFooter className="gap-3 sm:gap-4">
            {!hideCancelButton && (
              <AlertDialogCancel disabled={cancelDisabled ?? isLoading} className="rounded-full h-9 px-6 font-medium">
                {cancelText}
              </AlertDialogCancel>
            )}
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                onConfirm?.();
              }}
              disabled={confirmDisabled ?? isLoading}
              className={cn(
                "rounded-full h-9 px-6 font-medium shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none",
                activeVariant === 'destructive' 
                  ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/20' 
                  : 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/20'
              )}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {confirmText}
            </AlertDialogAction>
          </AlertDialogFooter>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
