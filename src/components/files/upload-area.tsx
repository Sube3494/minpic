import { useRef, useState } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UploadTask } from '@/types/file';
import { formatFileSize } from '@/lib/utils';

interface UploadAreaProps {
  uploadFiles: (files: FileList, configId: string) => Promise<void>;
  uploading: boolean;
  queue: UploadTask[];
  aggregateProgress: { loaded: number; total: number; percent: number; isProcessing: boolean };
  selectedConfigId: string;
}

export function UploadArea({ uploadFiles, uploading, queue, aggregateProgress, selectedConfigId }: UploadAreaProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    const selectedFiles = event.target.files;
    if (selectedFiles) {
      await uploadFiles(selectedFiles, selectedConfigId);
    }
  };

  return (
    <Card className="glass-strong">
      <CardContent className="p-3 md:p-6">
        <div 
          className={`border-2 border-dashed rounded-lg p-6 md:p-8 text-center transition-all ${
            isDragging 
              ? 'border-primary bg-primary/10 dark:bg-primary/20 scale-[1.02]' 
              : 'border-border bg-white/50 dark:bg-white/5 hover:bg-white/60 dark:hover:bg-white/10'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Upload className={`w-8 h-8 md:w-12 md:h-12 mx-auto mb-3 md:mb-4 opacity-80 transition-colors ${
            isDragging ? 'text-primary' : 'text-primary'
          }`} />
          <h3 className="text-base md:text-lg font-semibold mb-1 md:mb-2 text-zinc-800 dark:text-white">
            {isDragging ? '松开鼠标上传' : '上传文件'}
          </h3>
          <p className="text-[10px] md:text-sm text-muted-foreground mb-4 md:mb-6">
            {isDragging ? '拖放文件到此处' : '支持拖拽文件或点击选择'}
          </p>

          {uploading && aggregateProgress.total > 0 && (
            <div className="mb-6 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                   {aggregateProgress.isProcessing ? (
                     <Loader2 className="w-4 h-4 animate-spin text-primary" />
                   ) : (
                     <Upload className="w-4 h-4 text-primary animate-bounce" />
                   )}
                   <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    {aggregateProgress.isProcessing ? '正在处理(优化文件中)...' : '正在上传...'}
                  </span>
                </div>
                <span className="text-sm font-bold text-primary">
                  {aggregateProgress.percent}%
                </span>
              </div>
              <div className="w-full bg-zinc-200 dark:bg-zinc-700/50 rounded-full h-2.5 overflow-hidden backdrop-blur-sm">
                <div 
                  className={`h-full transition-all duration-500 ease-out shadow-[0_0_10px_rgba(var(--primary),0.5)] ${
                    aggregateProgress.isProcessing ? 'bg-primary/60 animate-pulse' : 'bg-primary'
                  }`}
                  style={{ width: `${Math.max(2, aggregateProgress.percent)}%` }}
                />
              </div>
              <div className="flex justify-between items-center">
                <p className="text-[10px] text-muted-foreground">
                  共 {queue.filter(t => t.status !== 'completed').length} 个文件待完成
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {formatFileSize(aggregateProgress.loaded)} / {formatFileSize(aggregateProgress.total)}
                </p>
              </div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*,audio/*"
            onChange={handleUpload}
            className="hidden"
            id="file-upload"
          />
          <Button asChild disabled={uploading} className="rounded-full px-8 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-shadow">
            <label htmlFor="file-upload" className="cursor-pointer">
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {aggregateProgress.isProcessing ? '正在后端处理...' : `总进度 ${aggregateProgress.percent}%`}
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  选择文件上传
                </>
              )}
            </label>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
