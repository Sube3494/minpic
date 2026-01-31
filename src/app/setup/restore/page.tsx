'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Database, Upload, AlertTriangle, ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Label } from '@/components/ui/label';

export default function RestorePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isEmpty, setIsEmpty] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [showPasswordInput, setShowPasswordInput] = useState(false);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const res = await fetch('/api/admin/backup/status');
      const data = await res.json();
      setIsEmpty(data.isEmpty);
      
      // 如果系统不为空且未登录，API 会拦截 import 操作，
      // 但在这里我们先做个前端提示
      if (!data.isEmpty) {
        // 交给 API 鉴权，但如果用户进到这里发现不为空，可能已经登录了
      }
    } catch {
      toast.error('获取系统状态失败');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setShowConfirm(true);
    setShowPasswordInput(false);
    setPassword('');
    e.target.value = '';
  };

  const confirmImport = async () => {
    if (!pendingFile) return;
    setImporting(true);
    setShowConfirm(false);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const content = JSON.parse(event.target?.result as string);
          // 只要是有效的 JSON 即可，具体结构（加密或非加密）由 API 侧验证
          if (typeof content !== 'object' || content === null) {
            throw new Error('无效的备份文件');
          }

          const res = await fetch('/api/admin/backup/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              backup: content.backup || content, 
              password 
            }),
          });

          const result = await res.json();

          if (!res.ok) {
            if (result.error === 'THIS_IS_ENCRYPTED') {
              setShowPasswordInput(true);
              setShowConfirm(true);
              toast.info('该备份已加密，请输入密码');
            } else {
              throw new Error(result.error || '还原失败');
            }
            setImporting(false);
            return;
          }

          toast.success('系统还原成功！即将引导至登录页面');
          setTimeout(() => router.push('/auth/signin'), 2000);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : '还原失败';
          toast.error(message);
          setImporting(false);
        }
      };
      reader.readAsText(pendingFile);
    } catch {
      toast.error('文件读取失败');
      setImporting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 blur-[120px] rounded-full animate-blob" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-500/10 blur-[120px] rounded-full animate-blob animation-delay-2000" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full"
      >
        <Card className="glass-strong border-zinc-200/50 dark:border-white/10 shadow-2xl">
          <CardHeader className="space-y-1 text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-primary/10 rounded-2xl">
                <Database className="w-8 h-8 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">从备份恢复系统</CardTitle>
            <CardDescription>
              {isEmpty ? '检测到新安装的系统，您可以选择导入备份文件以恢复所有数据。' : '正在对现有系统进行还原，这会覆盖所有现有数据。'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                还原操作将清空当前数据库。请确保备份文件来源可靠，且为本系统导出的标准 JSON 格式。
              </p>
            </div>

            <div className="relative group">
              <Input
                type="file"
                accept=".backup"
                onChange={handleFileChange}
                disabled={importing}
                className="opacity-0 absolute inset-0 w-full h-full cursor-pointer z-10"
              />
              <Button 
                variant="outline" 
                className="w-full h-12 gap-2 bg-white/50 dark:bg-white/5 border-dashed border-2 group-hover:border-primary group-hover:bg-primary/5 transition-all"
                disabled={importing}
              >
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {importing ? '系统还原中...' : '选择备份文件 (.backup)'}
              </Button>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="w-full gap-2 text-muted-foreground hover:text-foreground"
              onClick={() => router.back()}
              disabled={importing}
            >
              <ArrowLeft className="w-4 h-4" /> 返回
            </Button>
          </CardContent>
        </Card>

        <div className="mt-8 flex items-center justify-center gap-2 text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
          <Sparkles className="w-3 h-3 text-primary" />
          Powered by MinPic Disaster Recovery
        </div>
      </motion.div>

      <ConfirmDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        title="确认要覆盖当前系统吗？"
        description={
            <div className="space-y-4 py-4">
                <p className="text-sm text-muted-foreground">
                    您选择的文件：<span className="font-mono text-foreground font-bold">{pendingFile?.name}</span>
                </p>
                
                {showPasswordInput && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                        <Label className="text-xs font-bold uppercase tracking-wider opacity-70">解密密码</Label>
                        <Input
                            type="password"
                            placeholder="请输入备份加密密码"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                            autoFocus
                        />
                    </div>
                )}

                <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-100 dark:border-red-900/20 text-xs text-red-600 dark:text-red-400">
                    警告：此操作不可撤销。所有当前用户、配置及文件记录将被永久删除。
                </div>
            </div>
        }
        confirmText="确认还原"
        cancelText="取消"
        onConfirm={confirmImport}
        variant="destructive"
      />
    </div>
  );
}
