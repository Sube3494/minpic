import { useRef, useState, useEffect } from 'react';
import { Upload, Loader2, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UploadTask } from '@/types/file';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface UploadAreaProps {
  uploadFiles: (files: FileList, configId: string) => Promise<void>;
  uploading: boolean;
  queue: UploadTask[];
  aggregateProgress: { 
    loaded: number; 
    total: number; 
    percent: number; 
    isProcessing: boolean;
    isAllDone: boolean;
    successCount: number;
    errorCount: number;
    totalCount: number;
  };
  selectedConfigId: string;
  disabled?: boolean;
  disabledMessage?: string;
}

export function UploadArea({ uploadFiles, uploading, queue, aggregateProgress, selectedConfigId, disabled, disabledMessage }: UploadAreaProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Debounce effect for progress bar to prevent jumps on fast failures
  // 极致简洁：如果这一批任务中有任何一个报错，进度条就不再显示（由 Toast 反馈）。
  // 仅在所有任务都正常（Pending, Uploading, Processing, Completed）时显示。
  const isActive = queue.length > 0 && 
                   !queue.some(t => t.status === 'error') && 
                   queue.some(t => t.status !== 'skipped');

  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (isActive) {
      if (!showProgress) {
        // Delay showing progress bar by 200ms
        timer = setTimeout(() => {
          setShowProgress(true);
        }, 200);
      }
    } else {
      // Hide immediately when queue is empty
      // Wrap in setTimeout to avoid "synchronous setState in effect" warning
      timer = setTimeout(() => {
        setShowProgress(false);
      }, 0);
    }
    return () => clearTimeout(timer);
  }, [isActive, showProgress]);

  const handlePasteInput = (e: React.ClipboardEvent) => {
    if (disabled) return;
    const items = e.clipboardData?.items;
// ... (omitting unchanged parts for brevity if possible, but replace needs context)
// Wait, I can't omit parts in replace_file_content effectively if they are not contiguous or if I'm replacing a large block.
// I will replace the Interface and component signature first.
// Actually, let's use multi_replace for this.

    let hasImage = false;
    
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          hasImage = true;
          break;
        }
      }
    }

    if (!hasImage) {
       // Allow default behavior for text (maybe they want to paste a URL later), 
       // but for now let's just warn if it looks like they expected an upload.
       // actually, checking files is better.
       const files = e.clipboardData?.files;
       if (files && files.length > 0) {
           e.preventDefault();
           e.stopPropagation(); // Stop global listener from firing twice if needed, though global uses document
           uploadFiles(files, selectedConfigId);
           toast.info(`已捕获粘贴板文件: ${files[0].name}`);
       } else {
           // Text was pasted?
           toast.info('暂仅支持粘贴图片文件', {
             description: '请使用截图工具或选择文件上传'
           });
       }
    } else {
       // It has image, let the logic above (files check) handle it, or handle items directly.
       const files = e.clipboardData?.files;
       if (files && files.length > 0) {
          e.preventDefault();
          e.stopPropagation();
           uploadFiles(files, selectedConfigId);
           toast.info('正在上传粘贴板图片', {
             description: `${files.length} 个文件已添加到队列`
           });
       }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles) {
      await uploadFiles(droppedFiles, selectedConfigId);
    }
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const selectedFiles = event.target.files;
    if (selectedFiles) {
      await uploadFiles(selectedFiles, selectedConfigId);
    }
    // 重置输入框，以便再次选择同一个文件时能触发 onChange
    event.target.value = '';
  };

  return (
    <Card className={`glass-strong ${disabled ? 'opacity-60 pointer-events-none' : ''}`}>
      <CardContent className="p-3 md:p-6">
        <div 
          className={`border-2 border-dashed rounded-lg p-6 md:p-10 text-center transition-all ${
            disabled
               ? 'border-zinc-200 bg-zinc-50 dark:border-white/5 dark:bg-white/5 cursor-not-allowed'
               : isDragging 
                  ? 'border-primary bg-primary/10 dark:bg-primary/20 scale-[1.02]' 
                  : 'border-border bg-white/50 dark:bg-white/5 hover:bg-white/60 dark:hover:bg-white/10'
          }`}
          onDragOver={!disabled ? handleDragOver : undefined}
          onDragLeave={!disabled ? handleDragLeave : undefined}
          onDrop={!disabled ? handleDrop : undefined}
        >
          <Upload className="w-8 h-8 md:w-12 md:h-12 mx-auto mb-3 md:mb-4 text-primary opacity-80" />
          <h3 className="text-base md:text-lg font-semibold mb-1 md:mb-2 text-zinc-800 dark:text-white">
            {isDragging ? '松开鼠标上传' : '上传文件'}
          </h3>
          <p className="text-[10px] md:text-sm text-muted-foreground mb-4 md:mb-8">
            {isDragging ? '拖放文件到此处' : '支持拖拽、粘贴 (Ctrl+V) 或点击选择'}
          </p>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*,audio/*"
            onChange={handleUpload}
            className="hidden"
            id="file-upload"
            disabled={disabled}
          />
          
          <div className="flex flex-col items-center justify-center gap-4 w-full max-w-sm mx-auto">
            <Button 
                asChild 
                disabled={uploading || disabled} 
                className={`w-full rounded-full shadow-lg transition-all relative overflow-hidden group h-12 border-none ${
                    uploading 
                        ? (aggregateProgress.isAllDone && aggregateProgress.errorCount === 0) 
                            ? 'bg-emerald-500 shadow-emerald-500/20 text-white hover:bg-emerald-600' 
                            : 'bg-muted text-muted-foreground'
                        : 'bg-primary text-primary-foreground shadow-primary/20 hover:shadow-primary/30'
                }`}
            >
              <label htmlFor="file-upload" className={disabled ? "cursor-not-allowed" : "cursor-pointer"}>
                {/* Progress background fill - using solid Primary for contrast */}
                <AnimatePresence>
                    {uploading && isActive && !(aggregateProgress.isAllDone && aggregateProgress.errorCount === 0) && (
                        <motion.div 
                            key="progress-bg"
                            className="absolute inset-y-0 left-0 z-0 bg-primary/60 overflow-hidden"
                            initial={{ width: '0%' }}
                            animate={{ width: `${Math.max(1, aggregateProgress.percent)}%` }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.4, ease: "easeOut" }}
                        >
                            {/* Animated glowing leading edge */}
                            <motion.div 
                                className="absolute top-0 bottom-0 right-0 w-[60px] bg-linear-to-r from-transparent via-white/40 to-transparent"
                                animate={{ 
                                    x: ['-100%', '200%'],
                                }}
                                transition={{ 
                                    duration: 1.5, 
                                    repeat: Infinity,
                                    ease: "linear"
                                }}
                            />
                            {/* Visual Progress Cap */}
                            <div className="absolute top-0 bottom-0 right-0 w-1 bg-white/50 blur-[1px] shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
                        </motion.div>
                    )}
                </AnimatePresence>
                
                <div className="relative z-10 flex items-center justify-center w-full h-full">
                    {uploading ? (
                      (aggregateProgress.isAllDone && aggregateProgress.errorCount === 0) ? (
                        <>
                          <CheckCircle2 className="w-5 h-5 mr-2" />
                          <span className="text-sm md:text-base tracking-wide">全部上传成功</span>
                        </>
                      ) : (
                        <>
                          <Loader2 className={`w-4 h-4 mr-2 animate-spin ${aggregateProgress.errorCount > 0 ? 'text-rose-500' : 'text-primary'}`} />
                          <span className="text-sm">
                            {aggregateProgress.isProcessing 
                                ? '正在处理...' 
                                : `正在上传 ${aggregateProgress.percent}% (${aggregateProgress.successCount + aggregateProgress.errorCount}/${aggregateProgress.totalCount})`}
                          </span>
                        </>
                      )
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        <span className="font-medium text-sm md:text-base">
                            {disabled ? (disabledMessage || '暂无可用存储配置') : '选择文件上传'}
                        </span>
                      </>
                    )}
                </div>
              </label>
            </Button>

            <div className="relative group w-full">
              <div className={`absolute inset-0 bg-primary/20 blur-xl rounded-full transition-opacity duration-500 ${isFocused ? 'opacity-100' : 'opacity-0'}`} />
              <div className="relative flex items-center">
                  <Input 
                    placeholder={disabled ? (disabledMessage || "请先配置存储源...") : "在此处按下 Ctrl + V 粘贴截图..."}
                    className="rounded-full h-10 border-zinc-200 dark:border-white/10 bg-white/50 dark:bg-black/20 pr-10 shadow-sm focus-visible:ring-primary transition-all text-center text-xs"
                    onPaste={handlePasteInput}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    disabled={disabled}
                  />
                  <div className="absolute right-1 top-1 bottom-1 aspect-square p-1 hidden md:block">
                      <Button size="icon" variant="ghost" className="w-full h-full rounded-full hover:bg-zinc-100 dark:hover:bg-white/10 text-muted-foreground" disabled={disabled}>
                          <ArrowRight className="w-3 h-3" />
                      </Button>
                  </div>
              </div>
            </div>
          </div>

        </div>
      </CardContent>
    </Card>
  );
}
