import { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_CONCURRENT = 3; // 最多3个并发上传

interface UploadProgress {
  uploadedChunks: number;
  totalChunks: number;
  percentage: number;
  uploadedBytes: number;
  totalBytes: number;
}

interface MultipartUploadState {
  uploadId: string;
  filename: string;
  totalChunks: number;
  uploadedParts: Array<{ partNumber: number; etag: string }>;
}

/**
 * 大文件分片上传 Hook
 * 支持断点续传和进度追踪
 */
export function useMultipartUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress>({
    uploadedChunks: 0,
    totalChunks: 0,
    percentage: 0,
    uploadedBytes: 0,
    totalBytes: 0,
  });
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const uploadStateRef = useRef<MultipartUploadState | null>(null);

  /**
   * 分割文件为分片
   */
  const splitFile = useCallback((file: File): Blob[] => {
    const chunks: Blob[] = [];
    let offset = 0;

    while (offset < file.size) {
      const chunk = file.slice(offset, offset + CHUNK_SIZE);
      chunks.push(chunk);
      offset += CHUNK_SIZE;
    }

    return chunks;
  }, []);

  /**
   * 初始化分片上传
   */
  const initUpload = useCallback(async (file: File) => {
    const res = await fetch('/api/files/multipart/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: file.name,
        fileSize: file.size,
        mimeType: file.type,
      }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || error.error || '初始化上传失败');
    }

    return await res.json();
  }, []);

  /**
   * 上传单个分片
   */
  const uploadChunk = useCallback(
    async (
      uploadId: string,
      partNumber: number,
      chunk: Blob,
      signal?: AbortSignal
    ) => {
      const formData = new FormData();
      formData.append('uploadId', uploadId);
      formData.append('partNumber', partNumber.toString());
      formData.append('chunk', chunk);

      const res = await fetch('/api/files/multipart/upload', {
        method: 'POST',
        body: formData,
        signal,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || error.error || '上传分片失败');
      }

      return await res.json();
    },
    []
  );

  /**
   * 完成上传
   */
  const completeUpload = useCallback(
    async (uploadId: string, filename: string) => {
      const res = await fetch('/api/files/multipart/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadId, filename }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || error.error || '完成上传失败');
      }

      return await res.json();
    },
    []
  );

  /**
   * 取消上传
   */
  const abortUpload = useCallback(async (uploadId: string) => {
    try {
      await fetch('/api/files/multipart/abort', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadId }),
      });
    } catch (error) {
      console.error('Abort upload error:', error);
    }
  }, []);

  /**
   * 上传文件
   */
  const upload = useCallback(
    async (file: File, onSuccess?: (result: { fileId: string; url: string; filename: string; size: string }) => void) => {
      if (uploading) {
        toast.error('已有文件正在上传');
        return;
      }

      setUploading(true);
      abortControllerRef.current = new AbortController();

      try {
        // 1. 初始化上传
        const initResult = await initUpload(file);
        const { uploadId, totalChunks } = initResult;

        uploadStateRef.current = {
          uploadId,
          filename: file.name,
          totalChunks,
          uploadedParts: [],
        };

        // 保存到 localStorage 以支持断点续传
        localStorage.setItem(
          `upload_${uploadId}`,
          JSON.stringify(uploadStateRef.current)
        );

        // 2. 分割文件
        const chunks = splitFile(file);

        setProgress({
          uploadedChunks: 0,
          totalChunks,
          percentage: 0,
          uploadedBytes: 0,
          totalBytes: file.size,
        });

        // 3. 并发上传分片
        let uploadedChunks = 0;
        let uploadedBytes = 0;

        const uploadPromises: Promise<void>[] = [];
        let currentIndex = 0;

        const uploadNext = async (): Promise<void> => {
          if (currentIndex >= chunks.length) return;

          const index = currentIndex++;
          const partNumber = index + 1;
          const chunk = chunks[index];

          try {
            await uploadChunk(
              uploadId,
              partNumber,
              chunk,
              abortControllerRef.current?.signal
            );

            uploadedChunks++;
            uploadedBytes += chunk.size;

            setProgress({
              uploadedChunks,
              totalChunks,
              percentage: Math.round((uploadedChunks / totalChunks) * 100),
              uploadedBytes,
              totalBytes: file.size,
            });

            // 继续上传下一个分片
            await uploadNext();
          } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
              throw new Error('上传已取消');
            }
            throw error;
          }
        };

        // 启动并发上传
        for (let i = 0; i < MAX_CONCURRENT; i++) {
          uploadPromises.push(uploadNext());
        }

        await Promise.all(uploadPromises);

        // 4. 完成上传
        const result = await completeUpload(uploadId, file.name);

        // 清除 localStorage
        localStorage.removeItem(`upload_${uploadId}`);
        uploadStateRef.current = null;

        toast.success('文件上传成功');
        
        if (onSuccess) {
          onSuccess(result);
        }

        return result;
      } catch (error) {
        console.error('Upload error:', error);
        
        // 如果有 uploadId,尝试取消上传
        if (uploadStateRef.current?.uploadId) {
          await abortUpload(uploadStateRef.current.uploadId);
          localStorage.removeItem(`upload_${uploadStateRef.current.uploadId}`);
        }

        const message = error instanceof Error ? error.message : '上传失败';
        toast.error(message);
        throw error;
      } finally {
        setUploading(false);
        abortControllerRef.current = null;
      }
    },
    [uploading, initUpload, splitFile, uploadChunk, completeUpload, abortUpload]
  );

  /**
   * 取消当前上传
   */
  const cancel = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (uploadStateRef.current?.uploadId) {
      await abortUpload(uploadStateRef.current.uploadId);
      localStorage.removeItem(`upload_${uploadStateRef.current.uploadId}`);
      uploadStateRef.current = null;
    }

    setUploading(false);
    setProgress({
      uploadedChunks: 0,
      totalChunks: 0,
      percentage: 0,
      uploadedBytes: 0,
      totalBytes: 0,
    });

    toast.info('上传已取消');
  }, [abortUpload]);

  /**
   * 格式化文件大小
   */
  const formatBytes = useCallback((bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }, []);

  return {
    upload,
    cancel,
    uploading,
    progress,
    formatBytes,
  };
}
