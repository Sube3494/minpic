import { FileItem } from '@/types/file';
import { MinioConfigItem } from '@/types/config';

export const fileService = {
  async getFiles(
    filter: string = 'all', 
    search: string = '', 
    page: number = 1, 
    pageSize: number = 20,
    configId?: string
  ): Promise<{ files: FileItem[]; pagination: { total: number; totalPages: number } }> {
    const params = new URLSearchParams();
    if (filter !== 'all') params.append('fileType', filter);
    if (search) params.append('search', search);
    if (configId) params.append('configId', configId);
    params.append('page', page.toString());
    params.append('pageSize', pageSize.toString());

    const response = await fetch(`/api/files?${params}`);
    if (!response.ok) throw new Error('Failed to fetch files');
    const data = await response.json();
    return {
      files: data.files || [],
      pagination: data.pagination
    };
  },

  async getConfigs(): Promise<{ configs: MinioConfigItem[]; activeId?: string }> {
    const response = await fetch('/api/config/minio');
    if (!response.ok) throw new Error(`Failed to fetch configs (${response.status})`);
    return response.json();
  },

  async setActiveConfig(activeId: string, configs: MinioConfigItem[]): Promise<void> {
    const response = await fetch('/api/config/minio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ configs, activeId }),
    });
    if (!response.ok) throw new Error('Failed to set active config');
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

  async generateShortlink(fileId: string, expiresIn?: number, unit?: 'minutes' | 'hours' | 'days'): Promise<string> {
    const body: { fileId: string; expiresIn?: number; unit?: string } = { fileId };
    if (expiresIn !== undefined && unit) {
      body.expiresIn = expiresIn;
      body.unit = unit;
    }
    
    const response = await fetch('/api/shortlinks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) throw new Error('Failed to generate shortlink');
    const data = await response.json();
    return data.short_url;
  },

  async getDirectLink(fileId: string): Promise<string> {
    const response = await fetch(`/api/files/${fileId}/url`);
    if (!response.ok) throw new Error('Failed to get direct link');
    const data = await response.json();
    return data.url;
  },

  async getShortlinkConfig(): Promise<{ apiUrl: string; enabled?: boolean }> {
      const response = await fetch('/api/config/shortlink');
      if (!response.ok) throw new Error('Failed to fetch shortlink config');
      return response.json();
  },

  async getFilesCount(
    filter: string = 'all',
    search: string = '',
    configId?: string
  ): Promise<number> {
    const params = new URLSearchParams();
    params.append('mode', 'count');
    if (filter !== 'all') params.append('fileType', filter);
    if (search) params.append('search', search);
    if (configId) params.append('configId', configId);

    const response = await fetch(`/api/files?${params}`);
    if (!response.ok) throw new Error('Failed to fetch files count');
    const data = await response.json();
    return data.count;
  },

  async getAllFileIds(
    filter: string = 'all',
    search: string = '',
    configId?: string
  ): Promise<string[]> {
    const params = new URLSearchParams();
    params.append('mode', 'ids');
    if (filter !== 'all') params.append('fileType', filter);
    if (search) params.append('search', search);
    if (configId) params.append('configId', configId);

    const response = await fetch(`/api/files?${params}`);
    if (!response.ok) throw new Error('Failed to fetch file IDs');
    const data = await response.json();
    return data.ids;
  }
};
