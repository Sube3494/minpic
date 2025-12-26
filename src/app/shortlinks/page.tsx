'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Link2, Copy, ExternalLink, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface FileWithShortlink {
  id: string;
  filename: string;
  shortlinkCode: string;
  createdAt: string;
  fileType: string;
}

export default function ShortlinksPage() {
  const [files, setFiles] = useState<FileWithShortlink[]>([]);
  const [loading, setLoading] = useState(true);
  const [shortlinkBaseUrl, setShortlinkBaseUrl] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [filesRes, configRes] = await Promise.all([
        fetch('/api/shortlinks'),
        fetch('/api/config/shortlink'),
      ]);

      if (filesRes.ok) {
        const data = await filesRes.json();
        setFiles(data.shortlinks || []);
      }

      if (configRes.ok) {
        const config = await configRes.json();
        if (config) {
          setShortlinkBaseUrl(config.apiUrl);
        }
      }
    } catch (error) {
      toast.error('加载短链列表失败', {
        description: '请检查网络连接或刷新页面'
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (code: string) => {
    const url = `${shortlinkBaseUrl}/${code}`;
    await navigator.clipboard.writeText(url);
    toast.success('短链已复制', {
      description: url
    });
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('zh-CN');
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold gradient-text">短链管理</h1>
            <p className="text-muted-foreground mt-2">查看和管理所有文件的短链</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" asChild>
              <Link href="/files">文件管理</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/">返回首页</Link>
            </Button>
          </div>
        </div>

        {/* Stats */}
        <Card className="glass-strong">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Link2 className="w-8 h-8 text-primary" />
              <div>
                <h3 className="text-2xl font-bold">{files.length}</h3>
                <p className="text-sm text-muted-foreground">个短链</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Shortlinks List */}
        {loading ? (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground mt-2">加载中...</p>
          </div>
        ) : files.length === 0 ? (
          <Card className="glass">
            <CardContent className="p-12 text-center">
              <Link2 className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">暂无短链</h3>
              <p className="text-sm text-muted-foreground mb-4">
                上传文件后会自动生成短链
              </p>
              <Button asChild>
                <Link href="/files">前往上传文件</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {files.map((file) => (
              <Card key={file.id} className="glass hover-lift">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="shrink-0">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                        <Link2 className="w-6 h-6 text-primary" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{file.filename}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="text-sm text-primary bg-primary/10 px-2 py-1 rounded">
                          {shortlinkBaseUrl}/{file.shortlinkCode}
                        </code>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(file.createdAt)}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(file.shortlinkCode)}
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        复制
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        asChild
                      >
                        <a
                          href={`${shortlinkBaseUrl}/${file.shortlinkCode}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          访问
                        </a>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
