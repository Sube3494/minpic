'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { FileViewClient } from './FileViewClient';
import { CollectionViewClient } from '../../c/[id]/CollectionViewClient';

interface ShareInfo {
  type: 'file' | 'collection';
  id: string;
}

export function ShareViewClient({ id }: { id: string }) {
  const [shareInfo, setShareInfo] = useState<ShareInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<'not_found' | 'failed' | 'expired' | null>(null);

  useEffect(() => {
    async function fetchShareInfo() {
      try {
        const res = await fetch(`/api/shares/${id}`);
        if (!res.ok) {
          if (res.status === 410) {
            setError('expired');
          } else if (res.status === 404) {
            setError('not_found');
          } else {
            setError('failed');
          }
          return;
        }
        const data = await res.json();
        setShareInfo(data);
      } catch (err) {
        console.error('Failed to fetch share info:', err);
        setError('failed');
      } finally {
        setLoading(false);
      }
    }

    fetchShareInfo();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !shareInfo) {
    // 复用 FileViewClient 的错误界面风格 (由于两个 Client 本身已经处理了错误，这里只处理基础路由错误)
    return <FileViewClient id={id} initialError={error || undefined} />;
  }

  if (shareInfo.type === 'file') {
    return <FileViewClient id={shareInfo.id} />;
  }

  return <CollectionViewClient id={shareInfo.id} />;
}
