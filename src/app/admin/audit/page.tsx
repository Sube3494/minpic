'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { PageWrapper } from '@/components/layout/page-wrapper';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  RefreshCcw, 
  Filter,
  Eraser,
  FileDown,
  Check,
  ShieldAlert,
  FileText
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DatePicker } from '@/components/ui/date-picker';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, formatFileSize } from '@/lib/utils';
import { Copy } from 'lucide-react';


interface AuditLog {
  id: string;
  userId: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: string | null;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
  user: {
    id: string;
    username: string;
    name: string | null;
    avatar: string | null;
  } | null;
}

const actionLabels: Record<string, string> = {
  USER_LOGIN: '用户登录',
  USER_CREATED: '用户注册',
  USER_UPDATED: '更新用户',
  USER_DELETED: '删除用户',
  FILE_UPLOADED: '上传文件',
  FILE_DELETED: '删除文件',
  WHITELIST_ADDED: '添加白名单',
  WHITELIST_REMOVED: '删除白名单',
  SETTINGS_UPDATED: '更新设置',
};

const fieldLabels: Record<string, string> = {
  // Settings
  registrationEnabled: '开放注册',
  requireWhitelist: '白名单验证',
  defaultStorageQuota: '默认存储配额',
  defaultFileQuota: '默认文件数量',
  siteName: '站点名称',
  siteDescription: '站点描述',
  icpBeian: 'ICP 备案号',
  
  // Whitelist
  count: '处理数量',
  success: '成功数量',
  failed: '失败数量',
  githubIds: 'GitHub ID 列表',
  note: '备注',
  
  // User
  username: '用户名',
  role: '角色',
  status: '状态',
  storageQuota: '存储配额',
  fileQuota: '文件配额',
  
  // Common
  ipAddress: 'IP 地址',
  userAgent: '用户代理',
};

const formatValue = (key: string, value: unknown): string => {
  if (value === true) return '已开启';
  if (value === false) return '已关闭';
  if (value === null || value === undefined) return '-';
  
  const lowerKey = key.toLowerCase();

  // Handle storage quotas (bytes)
  if (lowerKey.includes('storage')) {
    const num = typeof value === 'string' ? parseInt(value) : typeof value === 'number' ? value : NaN;
    if (!isNaN(num)) return formatFileSize(num);
  }

  // Handle counts/quantities
  if (lowerKey.includes('filequota') || lowerKey.includes('count') || lowerKey.includes('success') || lowerKey.includes('failed')) {
    return `${value} 个`;
  }
  
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  
  return String(value);
};

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [actionFilter, setActionFilter] = useState('');

  const fetchLogs = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      else setRefreshing(true);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });

      if (startDate) params.append('startDate', startDate.toISOString());
      if (endDate) params.append('endDate', endDate.toISOString());
      if (actionFilter) params.append('action', actionFilter);

      const res = await fetch(`/api/admin/audit?${params}`);
      if (!res.ok) throw new Error('Failed to fetch logs');

      const data = await res.json();
      setLogs(data.logs);
      setTotal(data.pagination.total);
    } catch {
      toast.error('加载审计日志失败');
    } finally {
      if (isInitial) setLoading(false);
      else setRefreshing(false);
    }
  }, [page, startDate, endDate, actionFilter]);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate.toISOString());
      if (endDate) params.append('endDate', endDate.toISOString());
      if (actionFilter) params.append('action', actionFilter);

      window.location.href = `/api/admin/audit/export?${params}`;
      toast.success('正在导出日志...');
    } catch {
      toast.error('导出失败');
    } finally {
      setIsExporting(false);
    }
  };

  const handleClear = async () => {
    try {
      setIsClearing(true);
      const params = new URLSearchParams();
      if (startDate && endDate) {
        params.append('startDate', startDate.toISOString());
        params.append('endDate', endDate.toISOString());
      } else {
        params.append('all', 'true');
      }

      const res = await fetch(`/api/admin/audit?${params}`, { method: 'DELETE' });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      toast.success(`成功清理 ${data.count} 条日志`);
      setIsClearDialogOpen(false);
      setPage(1);
      fetchLogs();
    } catch (err) {
      const message = err instanceof Error ? err.message : '清理失败';
      toast.error(message);
    } finally {
      setIsClearing(false);
    }
  };

  const resetFilters = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setActionFilter('');
    setPage(1);
  };

  useEffect(() => {
    fetchLogs(logs.length === 0);
  }, [fetchLogs, logs.length]);

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
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-linear-to-r from-foreground to-foreground/70 w-fit">审计日志</h1>
            <p className="text-muted-foreground text-sm">系统级操作记录与安全审计</p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="outline"
              onClick={handleExport}
              disabled={isExporting || logs.length === 0}
              className="h-10 px-4 border-zinc-200/50 dark:border-white/10 bg-white/50 dark:bg-white/5 backdrop-blur-md hover:bg-zinc-100 dark:hover:bg-white/10 rounded-xl transition-all"
            >
              <FileDown className="w-4 h-4 mr-2" />
              导出数据
            </Button>
            <Button 
              variant="destructive"
              onClick={() => setIsClearDialogOpen(true)}
              disabled={logs.length === 0}
              className="h-10 px-4 rounded-xl shadow-lg shadow-red-500/20"
            >
              <Eraser className="w-4 h-4 mr-2" />
              清理日志
            </Button>
          </div>
        </div>

        {/* Filters */}
        {/* Filters */}
        <Card className="p-5 border-zinc-200/50 dark:border-white/10 bg-white/50 dark:bg-white/5 backdrop-blur-xl rounded-2xl shadow-sm hover:translate-y-0 transition-all">
          <div className="space-y-4">
            {/* Filter Header */}
            <div className="flex items-center gap-2 pb-2 border-b border-zinc-100 dark:border-white/5">
              <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                <Filter className="w-3.5 h-3.5" />
              </div>
              <span className="text-sm font-bold text-foreground tracking-wide">筛选条件</span>
            </div>

            {/* Inputs Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Date Range Group */}
              <div className="lg:col-span-5 flex items-center gap-2">
                <div className="flex-1">
                  <DatePicker 
                    date={startDate}
                    setDate={setStartDate}
                    placeholder="起始日期"
                  />
                </div>
                <span className="text-sm text-muted-foreground font-medium">至</span>
                <div className="flex-1">
                  <DatePicker 
                    date={endDate}
                    setDate={setEndDate}
                    placeholder="截止日期"
                  />
                </div>
              </div>

              {/* Action Filter */}
              <div className="lg:col-span-3">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full h-10 justify-between border-zinc-200/50 dark:border-white/10 bg-white/50 dark:bg-white/5 rounded-xl font-normal overflow-hidden hover:bg-zinc-50 dark:hover:bg-white/10 transition-colors">
                      <span className="truncate text-sm">{actionFilter ? actionLabels[actionFilter] : '所有操作类型'}</span>
                      <Filter className="w-3.5 h-3.5 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 p-1.5 border-zinc-200/50 dark:border-white/10 bg-white/90 dark:bg-white/5 backdrop-blur-2xl rounded-2xl shadow-xl">
                    <DropdownMenuLabel className="px-3 py-2 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">选择操作类型</DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-zinc-100 dark:bg-white/5 mx-1" />
                    <div className="max-h-64 overflow-y-auto custom-scrollbar">
                      <DropdownMenuItem 
                        onClick={() => setActionFilter('')}
                        className={cn(
                          "flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 mb-0.5",
                          !actionFilter ? "bg-primary/10 text-primary font-medium" : "hover:bg-zinc-100 dark:hover:bg-white/5 text-zinc-600 dark:text-zinc-300"
                        )}
                      >
                        <span className="text-sm">所有操作</span>
                        {!actionFilter && <Check className="w-4 h-4" />}
                      </DropdownMenuItem>
                      {Object.entries(actionLabels).map(([key, label]) => (
                        <DropdownMenuItem 
                          key={key}
                          onClick={() => setActionFilter(key)}
                          className={cn(
                            "flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 mb-0.5",
                            actionFilter === key ? "bg-primary/10 text-primary font-medium" : "hover:bg-zinc-100 dark:hover:bg-white/5 text-zinc-600 dark:text-zinc-300"
                          )}
                        >
                          <span className="text-sm">{label}</span>
                          {actionFilter === key && <Check className="w-4 h-4" />}
                        </DropdownMenuItem>
                      ))}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Action Buttons */}
              <div className="lg:col-span-4 flex items-center justify-end gap-3">
                {(startDate || endDate || actionFilter) && (
                  <Button 
                    variant="ghost" 
                    onClick={resetFilters}
                    className="h-10 px-4 text-zinc-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all"
                  >
                    <RefreshCcw className="w-3.5 h-3.5 mr-2" />
                    重置
                  </Button>
                )}
                <Button 
                  onClick={() => { setPage(1); fetchLogs(); }}
                  className="h-10 px-8 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-95 w-full sm:w-auto"
                >
                  查询
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Logs Table Area */}
        <Card className="glass-strong border-zinc-200/50 dark:border-white/10 shadow-lg bg-white/50 dark:bg-black/20 overflow-hidden relative hover:translate-y-0">
          {/* Refresh Overlay */}
          <AnimatePresence>
            {refreshing && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-10 bg-white/10 dark:bg-black/10 backdrop-blur-[2px] flex items-center justify-center"
              >
                <div className="flex flex-col items-center gap-2">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-medium text-muted-foreground">更新中...</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <CardHeader className="border-b border-border/50">
            <CardTitle>操作记录</CardTitle>
            <CardDescription>共 {total} 条记录</CardDescription>
          </CardHeader>
          <div className="relative overflow-x-auto min-h-[300px]">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-muted-foreground">加载中...</p>
                </div>
              </div>
            ) : (
              <Table className="table-fixed w-full min-w-[800px]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border/50">
                    <TableHead className="w-[20%] text-center pl-6">时间</TableHead>
                    <TableHead className="w-[25%] text-center">用户</TableHead>
                    <TableHead className="w-[20%] text-center">操作</TableHead>
                    <TableHead className="w-[10%] text-center">详情</TableHead>
                    <TableHead className="w-[25%] text-center">IP 地址</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence>
                    {logs.map((log) => (
                      <motion.tr 
                        key={log.id} 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50 transition-colors border-b border-border/50 group"
                      >
                        <TableCell className="w-[20%] text-sm text-muted-foreground text-center tabular-nums font-medium pl-6">
                          {format(new Date(log.createdAt), 'yyyy-MM-dd HH:mm:ss')}
                        </TableCell>
                        <TableCell className="w-[25%]">
                          {log.user ? (
                            <div className="flex items-center justify-center gap-3">
                              <Avatar className="w-8 h-8 ring-1 ring-transparent group-hover:ring-primary/10 transition-all">
                                <AvatarImage src={log.user.avatar || undefined} />
                                <AvatarFallback className="text-[10px]">{log.user.username[0].toUpperCase()}</AvatarFallback>
                              </Avatar>
                              <div className="flex flex-col items-start transition-all">
                                <span className="text-sm font-medium text-foreground">{log.user.name || log.user.username}</span>
                                <span className="text-[10px] text-muted-foreground">@{log.user.username}</span>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-2 text-muted-foreground">
                              <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                                <ShieldAlert className="w-4 h-4 opacity-50" />
                              </div>
                              <span className="text-sm italic">系统 / 已删除用户</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="w-[20%] text-center">
                          <Badge variant="outline" className={cn(
                            "font-medium border-0 px-2 py-0.5 rounded-md",
                            log.action.includes('DELETE') ? "bg-red-500/10 text-red-500" :
                            log.action.includes('UPLOAD') ? "bg-green-500/10 text-green-500" :
                            log.action.includes('LOGIN') ? "bg-blue-500/10 text-blue-500" :
                            "bg-zinc-500/10 text-zinc-500"
                          )}>
                            {actionLabels[log.action] || log.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="w-[10%] text-center">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary transition-colors">
                                <FileText className="h-4 w-4" />
                                <span className="sr-only">查看详情</span>
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="glass-strong border-0 shadow-2xl w-[90vw] sm:w-full max-w-2xl rounded-2xl gap-6">
                              <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                  <FileText className="w-5 h-5 text-primary" />
                                  操作详情
                                </DialogTitle>
                                <DialogDescription>
                                  查看本次操作的完整结构化数据
                                </DialogDescription>
                              </DialogHeader>
                              <div className="mt-4 max-h-[60vh] overflow-y-auto scrollbar-none space-y-4 px-1">
                                {(() => {
                                  try {
                                    const content = log.details || log.metadata;
                                    if (!content) return <div className="text-muted-foreground text-sm text-center py-8">暂无详细信息</div>;
                                    
                                    const data = JSON.parse(content);
                                    
                                    // Handle "changes" specially (for updates)
                                    if (data.changes) {
                                      return (
                                        <div className="space-y-4">
                                          <div className="rounded-xl border border-zinc-200/50 dark:border-white/10 overflow-hidden bg-zinc-50/50 dark:bg-white/5">
                                            <div className="px-4 py-2 border-b border-zinc-200/50 dark:border-white/10 flex items-center justify-between">
                                              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">变更明细</span>
                                            </div>
                                            <div className="divide-y divide-zinc-200/50 dark:divide-white/10">
                                              {Object.entries(data.changes).map(([key, value]) => (
                                                <div key={key} className="flex items-center justify-between px-4 py-3 text-sm">
                                                  <span className="text-muted-foreground shrink-0">{fieldLabels[key] || key}</span>
                                                  <span className="truncate ml-4 text-right max-w-[70%]" title={String(value)}>{formatValue(key, value)}</span>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                          
                                          {/* Show raw data in a collapsed/secondary view if needed, or just regular parsed data */}
                                          <div className="space-y-2">
                                            <div className="flex items-center gap-2">
                                              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">原始数据</span>
                                            </div>
                                            <div className="p-4 rounded-xl bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-xs overflow-auto max-h-[200px]">
                                              <pre className="text-zinc-600 dark:text-zinc-400">{JSON.stringify(data, null, 2)}</pre>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    }

                                    // Handle standard object display
                                    return (
                                      <div className="space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                          {Object.entries(data).map(([key, value]) => {
                                            if (typeof value === 'object' && value !== null) return null; // Skip complex objects for grid
                                            return (
                                              <div key={key} className="bg-zinc-50/50 dark:bg-white/5 p-3 rounded-xl border border-zinc-200/50 dark:border-white/10">
                                                <div className="text-xs text-muted-foreground mb-1">{fieldLabels[key] || key}</div>
                                                <div className="text-sm truncate">{formatValue(key, value)}</div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                        
                                        <div className="space-y-2">
                                           <div className="flex items-center justify-between">
                                              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">完整数据</span>
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-muted-foreground hover:text-primary"
                                                onClick={() => {
                                                  navigator.clipboard.writeText(JSON.stringify(data, null, 2));
                                                  toast.success('已复制到剪贴板');
                                                }}
                                              >
                                                <Copy className="h-3 w-3" />
                                              </Button>
                                           </div>
                                           <div className="p-4 rounded-xl bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-xs overflow-auto max-h-[300px]">
                                             <pre className="text-zinc-600 dark:text-zinc-400">{JSON.stringify(data, null, 2)}</pre>
                                           </div>
                                        </div>
                                      </div>
                                    );
                                  } catch {
                                    // Fallback for non-JSON strings
                                    return (
                                      <div className="p-4 rounded-xl bg-zinc-950 text-xs overflow-auto">
                                        <pre className="text-blue-400">{log.details || log.metadata || '无详细信息'}</pre>
                                      </div>
                                    );
                                  }
                                })()}
                              </div>
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                        <TableCell className="w-[25%] text-center text-xs text-muted-foreground tabular-nums font-medium">
                          {log.ipAddress || '-'}
                        </TableCell>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </TableBody>
              </Table>
            )}
          </div>

          {/* Pagination */}
          <div className="p-4 border-t border-border/50 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              显示 {(page - 1) * 20 + 1} - {Math.min(page * 20, total)} 条，共 {total} 条
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="hover:bg-primary/5 hover:text-primary transition-colors"
              >
                上一页
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage(p => p + 1)}
                disabled={page * 20 >= total}
                className="hover:bg-primary/5 hover:text-primary transition-colors"
              >
                下一页
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={isClearDialogOpen}
        onOpenChange={setIsClearDialogOpen}
        title="清理审计日志"
        description={
          (startDate && endDate) 
            ? `确定要清理 ${format(startDate, "yyyy-MM-dd")} 至 ${format(endDate, "yyyy-MM-dd")} 之间的审计日志吗？\n此操作不可恢复。`
            : "确定要清理所有的审计日志吗？\n此操作将永久删除系统当前的所有操作记录，不可恢复。"
        }
        confirmText={isClearing ? '正在清理...' : '执行清理'}
        cancelText="取消"
        onConfirm={handleClear}
        variant="destructive"
        isLoading={isClearing}
      />
    </PageWrapper>
  );
}
