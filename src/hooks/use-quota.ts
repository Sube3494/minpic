import { useState, useEffect, useCallback } from 'react';
import { readApiResponse } from '@/lib/api-response';


export interface UserQuota {
  storageQuota?: string | null;
  storageUsed: string;
  fileQuota?: number | null;
  fileCount: number;
}

export function useQuota() {
  const [quota, setQuota] = useState<UserQuota | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchQuota = useCallback(async () => {
    try {
      const res = await fetch('/api/user/profile');
      if (res.ok) {
        const data = await readApiResponse<UserQuota>(res);
        setQuota({
          storageQuota: data.storageQuota,
          storageUsed: data.storageUsed,
          fileQuota: data.fileQuota,
          fileCount: data.fileCount,
        });
      }
    } catch (error) {
      console.error('Failed to fetch quota:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuota();
  }, [fetchQuota]);

  return { quota, loading, refreshQuota: fetchQuota };
}
