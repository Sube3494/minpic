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
  shortlinkCode: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface UploadTask {
  id: string;
  file: File;
  loaded: number;
  total: number;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error';
  xhr?: XMLHttpRequest;
  configId?: string;
}

export interface MinioConfig {
  id: string;
  name: string;
}
