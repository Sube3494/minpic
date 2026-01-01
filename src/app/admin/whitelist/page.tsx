'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PageWrapper } from '@/components/layout/page-wrapper';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface WhitelistEntry {
  id: string;
  githubId: string;
  note: string | null;
  used: boolean;
  usedAt: Date | null;
  createdAt: Date;
}

export default function WhitelistPage() {
  const [whitelist, setWhitelist] = useState<WhitelistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [githubIds, setGithubIds] = useState('');
  const [note, setNote] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    fetchWhitelist();
  }, []);

  async function fetchWhitelist() {
    try {
      const res = await fetch('/api/admin/whitelist');
      if (!res.ok) throw new Error('Failed to fetch whitelist');
      const data = await res.json();
      setWhitelist(data.whitelist);
    } catch {
      toast.error('加载白名单失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    const ids = githubIds.split('\n').map(id => id.trim()).filter(Boolean);
    if (ids.length === 0) {
      toast.error('请输入至少一个 GitHub ID');
      return;
    }

    try {
      const res = await fetch('/api/admin/whitelist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ githubIds: ids, note }),
      });

      if (!res.ok) throw new Error('Failed to add whitelist');
      
      const data = await res.json();
      toast.success(`成功添加 ${data.added} 个白名单`);
      setGithubIds('');
      setNote('');
      setDialogOpen(false);
      fetchWhitelist();
    } catch {
      toast.error('添加白名单失败');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('确定要删除这个白名单吗？')) return;

    try {
      const res = await fetch(`/api/admin/whitelist/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete whitelist');
      
      toast.success('删除成功');
      fetchWhitelist();
    } catch {
      toast.error('删除失败');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <PageWrapper>
      <div className="space-y-8">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center min-h-[400px]"
            >
              <div className="text-center space-y-4">
                <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-muted-foreground">加载中...</p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-8"
            >
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-linear-to-r from-foreground to-foreground/70 w-fit">白名单管理</h1>
                  <p className="text-muted-foreground">管理允许注册或登录系统的 GitHub 用户 ID</p>
                </div>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="shadow-lg shadow-primary/20">
                      <Plus className="w-4 h-4 mr-2" />
                      添加白名单
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="glass-strong border-0 shadow-2xl w-[90vw] max-w-lg">
                    <DialogHeader>
                      <DialogTitle>添加白名单</DialogTitle>
                      <DialogDescription>
                        输入一个或多个 GitHub 用户 ID (每行一个)，这些用户将不受注册限制。
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">GitHub ID</label>
                        <Textarea
                          placeholder="例如：&#10;99887766&#10;Antigravity-AI"
                          value={githubIds}
                          onChange={(e) => setGithubIds(e.target.value)}
                          rows={5}
                          className="bg-zinc-50/50 dark:bg-white/5 border-zinc-200/50 dark:border-white/10 hover:bg-white dark:hover:bg-white/10 transition-all focus:border-primary/20 focus:ring-4 focus:ring-primary/10 resize-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">备注 (可选)</label>
                        <Input
                          placeholder="例如：核心团队成员"
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          className="bg-zinc-50/50 dark:bg-white/5 border-zinc-200/50 dark:border-white/10 hover:bg-white dark:hover:bg-white/10 transition-all focus:border-primary/20 focus:ring-4 focus:ring-primary/10"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="ghost" onClick={() => setDialogOpen(false)}>
                        取消
                      </Button>
                      <Button onClick={handleAdd} className="shadow-lg shadow-primary/20">添加至白名单</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Whitelist Table */}
              <Card className="glass-strong border-zinc-200/50 dark:border-white/10 shadow-lg bg-white/50 dark:bg-black/20 overflow-hidden hover:translate-y-0 transition-all duration-300">
                <CardHeader className="border-b border-border/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>白名单列表</CardTitle>
                      <CardDescription>当前系统共有 {whitelist.length} 条有效记录</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <div className="relative overflow-x-auto min-h-[200px]">
                  <AnimatePresence mode="wait">
                    {whitelist.length === 0 ? (
                      <motion.div
                        key="empty"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-center py-20"
                      >
                         <div className="bg-zinc-100 dark:bg-zinc-800/50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                           <Plus className="w-8 h-8 text-muted-foreground/50 rotate-45" />
                        </div>
                        <h3 className="text-lg font-medium text-foreground">暂无记录</h3>
                        <p className="text-muted-foreground mt-1">点击右上角按钮添加 GitHub 用户 ID</p>
                      </motion.div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent border-border/50">
                            <TableHead className="w-[200px]">GitHub ID</TableHead>
                            <TableHead>备注</TableHead>
                            <TableHead className="text-center">状态</TableHead>
                            <TableHead className="text-center">添加时间</TableHead>
                            <TableHead className="text-right pr-6">操作</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <AnimatePresence mode="popLayout">
                            {whitelist.map((entry) => (
                              <motion.tr
                                layout
                                key={entry.id}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="group hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50 transition-colors border-b border-border/50"
                              >
                                <TableCell className="font-medium py-4">
                                  {entry.githubId}
                                </TableCell>
                                <TableCell className="text-sm">
                                  <span className={entry.note ? "text-foreground" : "text-muted-foreground/50 italic"}>
                                    {entry.note || '无备注'}
                                  </span>
                                </TableCell>
                                <TableCell className="text-center">
                                  <div className="flex items-center justify-center gap-2">
                                    <div className={cn("w-2 h-2 rounded-full", entry.used ? "bg-zinc-400" : "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]")} />
                                    <span className={cn("text-xs font-semibold", entry.used ? "text-muted-foreground" : "text-green-600 dark:text-green-400")}>
                                      {entry.used ? '已注册' : '待注册'}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-center text-xs text-muted-foreground tabular-nums">
                                  {new Date(entry.createdAt).toLocaleDateString('zh-CN', {
                                    year: 'numeric',
                                    month: '2-digit',
                                    day: '2-digit'
                                  })}
                                </TableCell>
                                <TableCell className="text-right pr-6">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all opacity-0 group-hover:opacity-100"
                                    onClick={() => handleDelete(entry.id)}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </TableCell>
                              </motion.tr>
                            ))}
                          </AnimatePresence>
                        </TableBody>
                      </Table>
                    )}
                  </AnimatePresence>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageWrapper>
  );
}
