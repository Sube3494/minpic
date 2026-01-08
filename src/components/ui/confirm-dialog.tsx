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
      <AlertDialogContent className="w-[90vw] sm:max-w-[520px] gap-5 p-6">
        <AlertDialogHeader className="space-y-3">
          <AlertDialogTitle className="text-2xl font-bold tracking-tight">{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">
              {description}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        {/* Delete Mode Selector */}
        {deleteMode !== undefined && onDeleteModeChange && (
          <div className="-mt-1">
            <div 
              className={cn(
                "flex items-start gap-4 p-4 rounded-2xl border-2 transition-all duration-200 cursor-pointer group",
                deleteMode === 'full'
                  ? "bg-red-50 border-red-300 dark:bg-red-950/20 dark:border-red-800/40 shadow-sm shadow-red-100 dark:shadow-red-950/10"
                  : "border-zinc-200 dark:border-white/10 bg-white/50 dark:bg-white/5 backdrop-blur-sm hover:border-zinc-300 dark:hover:border-zinc-700"
              )}
              onClick={() => onDeleteModeChange(deleteMode === 'full' ? 'record-only' : 'full')}
            >
              <Checkbox 
                id="delete-physical" 
                checked={deleteMode === 'full'}
                onCheckedChange={(checked) => onDeleteModeChange(checked ? 'full' : 'record-only')}
                className={cn(
                  "mt-0.5 shrink-0 transition-all rounded-full w-5 h-5 bg-transparent! dark:bg-transparent!",
                  deleteMode === 'full' 
                    ? "data-[state=checked]:bg-transparent! dark:data-[state=checked]:bg-transparent! data-[state=checked]:border-red-600 data-[state=checked]:text-red-600 border-2" 
                    : "border-zinc-400 dark:border-zinc-600 hover:border-zinc-500 dark:hover:border-zinc-500"
                )}
                onClick={(e) => e.stopPropagation()} 
              />
              <div className="flex-1 grid gap-1.5">
                <label
                  htmlFor="delete-physical"
                  className={cn(
                    "text-[15px] font-semibold cursor-pointer transition-colors leading-tight",
                    deleteMode === 'full' ? "text-red-700 dark:text-red-400" : "text-zinc-800 dark:text-zinc-200"
                  )}
                  style={{ pointerEvents: 'none' }}
                >
                  同时删除 MinIO 中的物理文件
                </label>
                <p className="text-[13px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  默认仅移除记录。勾选则彻底删除文件且 <span className="text-red-600 dark:text-red-500 font-semibold">无法恢复</span>。
                </p>
              </div>
            </div>
          </div>
        )}
        
        {footer ? footer : (
          <AlertDialogFooter className="gap-3 sm:gap-3 mt-2">
            {!hideCancelButton && (
              <AlertDialogCancel 
                disabled={cancelDisabled ?? isLoading} 
                className="rounded-full h-11 px-6 font-semibold text-[15px] border-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
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
                "rounded-full h-11 px-6 font-bold text-[15px] shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none",
                activeVariant === 'destructive' 
                  ? 'bg-linear-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-red-500/30' 
                  : 'bg-linear-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 text-white shadow-primary/30'
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
