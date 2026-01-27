export type FileType = 'image' | 'video' | 'audio' | 'other';
export type FilterType = 'all' | 'image' | 'video' | 'audio';
export type ViewMode = 'grid' | 'list';

export interface FileItem {
  id: string;
  filename: string;
  minioPath: string;
  fileSize: number;
  mimeType: string;
  fileType: string;
  thumbnailPath: string | null;
  createdAt: string;
  updatedAt?: string;
  expiresAt?: string | null; // 文件物理过期时间
  shareExpiresAt?: string | null; // 分享链接过期时间
  width?: number | null;
  height?: number | null;
  duration?: number | null;
  configId?: string | null;
  shareId?: string | null;
  shortCode?: string | null;
  shortUrl?: string | null;
}

export interface UploadTask {
  id: string;
  file: File;
  loaded: number;
  total: number;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error' | 'skipped';
  xhr?: XMLHttpRequest;
  configId?: string;
}

