import { FileItem, MinioConfig } from '@/types/file';

export const fileService = {
  async getFiles(filter: string = 'all', search: string = ''): Promise<FileItem[]> {
    const params = new URLSearchParams();
    if (filter !== 'all') params.append('fileType', filter);
    if (search) params.append('search', search);

    const response = await fetch(`/api/files?${params}`);
    if (!response.ok) throw new Error('Failed to fetch files');
    const data = await response.json();
    return data.files || [];
  },

  async getConfigs(): Promise<{ configs: MinioConfig[]; activeId?: string }> {
    const response = await fetch('/api/config/minio');
    if (!response.ok) throw new Error('Failed to fetch configs');
    return response.json();
  },

  async deleteFile(id: string, deleteMode: 'full' | 'record-only' = 'record-only'): Promise<void> {
    const response = await fetch(`/api/files/${id}?deleteMode=${deleteMode}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to delete file');
  },

  async batchDeleteFiles(ids: string[], deleteMode: 'full' | 'record-only' = 'record-only'): Promise<void> {
    const response = await fetch(`/api/files?deleteMode=${deleteMode}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    if (!response.ok) throw new Error('Failed to batch delete files');
  },

  async generateShortlink(fileId: string): Promise<string> {
    const response = await fetch('/api/shortlinks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileId }),
    });

    if (!response.ok) throw new Error('Failed to generate shortlink');
    const data = await response.json();
    return data.short_url;
  },

  async getShortlinkConfig(): Promise<{ apiUrl: string }> {
      const response = await fetch('/api/config/shortlink');
      if (!response.ok) throw new Error('Failed to fetch shortlink config');
      return response.json();
  }
};
