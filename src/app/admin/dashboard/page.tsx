'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Users, HardDrive, FileStack, Activity, TrendingUp, Crown } from 'lucide-react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { PageWrapper } from '@/components/layout/page-wrapper';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface DashboardData {
  overview: {
    totalUsers: number;
    activeUsers: number;
    totalFiles: number;
    totalStorage: string;
  };
  trends: {
    users: Array<{ date: string; count: number }>;
  };
  rankings: {
    topStorage: Array<{
      id: string;
      username: string;
      name: string | null;
      avatar: string | null;
      storageUsed: string;
      storageQuota: string;
    }>;
    topFiles: Array<{
      id: string;
      username: string;
      name: string | null;
      avatar: string | null;
      fileCount: number;
      fileQuota: number;
    }>;
  };
  recent: {
    users: Array<{
      id: string;
      username: string;
      name: string | null;
      avatar: string | null;
      createdAt: string;
    }>;
    files: Array<{
      id: string;
      filename: string;
      fileSize: number;
      createdAt: string;
      user: {
        username: string;
        name: string | null;
        avatar: string | null;
      };
    }>;
    logs: Array<{
      id: string;
      action: string;
      createdAt: string;
      user: {
        username: string;
        name: string | null;
        avatar: string | null;
      } | null;
    }>;
  };
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

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  async function fetchDashboard() {
    try {
      const res = await fetch('/api/admin/dashboard');
      if (!res.ok) throw new Error('Failed to fetch dashboard');

      const dashboardData = await res.json();
      setData(dashboardData);
    } catch {
      toast.error('加载仪表板失败');
    } finally {
      setLoading(false);
    }
  }

  const formatBytes = (bytes: number | string) => {
    const num = typeof bytes === 'string' ? Number(bytes) : bytes;
    if (num === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(num) / Math.log(k));
    return `${(num / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { duration: 0.3 }
    }
  };

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
          ) : data && (
            <motion.div
              key="content"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-8"
            >
              {/* Header */}
              <motion.div variants={itemVariants}>
                <h1 className="text-3xl font-bold tracking-tight">数据统计</h1>
                <p className="text-muted-foreground mt-2">系统运行概览与数据分析</p>
              </motion.div>

              {/* Overview Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                {[
                  { title: '总用户数', value: data.overview.totalUsers, sub: `活跃用户 ${data.overview.activeUsers} 人`, icon: Users, color: 'blue' },
                  { title: '总文件数', value: data.overview.totalFiles, sub: '系统总文件数量', icon: FileStack, color: 'green' },
                  { title: '总存储量', value: formatBytes(data.overview.totalStorage), sub: '已使用存储空间', icon: HardDrive, color: 'purple' },
                  { title: '活跃度', value: `${data.overview.totalUsers > 0 ? ((data.overview.activeUsers / data.overview.totalUsers) * 100).toFixed(1) : 0}%`, sub: '最近7天活跃率', icon: Activity, color: 'orange' },
                ].map((stat, i) => (
                  <motion.div key={i} variants={itemVariants}>
                    <Card className="glass-strong border-zinc-200/50 dark:border-white/10 shadow-lg bg-white/50 dark:bg-black/20 relative overflow-hidden group hover:translate-y-0 transition-all duration-300">
                      <div className={`absolute inset-0 bg-linear-to-br from-${stat.color}-500/5 to-transparent opacity-50 group-hover:opacity-100 transition-opacity`} />
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-6 pb-2 relative">
                        <CardTitle className="text-[10px] sm:text-sm font-medium text-muted-foreground truncate mr-2">{stat.title}</CardTitle>
                        <div className={`p-1.5 sm:p-2 rounded-lg bg-${stat.color}-500/10 text-${stat.color}-500 shrink-0`}>
                          <stat.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </div>
                      </CardHeader>
                      <CardContent className="p-3 sm:p-6 pt-0 relative">
                        <div className="text-xl sm:text-3xl font-bold truncate">{stat.value}</div>
                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1 truncate">{stat.sub}</p>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* User Trend Chart */}
                <motion.div variants={itemVariants}>
                  <Card className="glass-strong border-zinc-200/50 dark:border-white/10 shadow-lg bg-white/50 dark:bg-black/20">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-primary" />
                        用户注册趋势
                      </CardTitle>
                      <CardDescription>最近7天新增用户</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={data.trends.users} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                          <XAxis
                            dataKey="date"
                            axisLine={false}
                            tickLine={false}
                            className="text-xs"
                            tick={{ fill: 'var(--foreground)', fontSize: 12 }}
                            dy={10}
                          />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            className="text-xs"
                            tick={{ fill: 'var(--foreground)', fontSize: 12 }}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'var(--card)',
                              border: '1px solid var(--border)',
                              borderRadius: '12px',
                              boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                            }}
                            itemStyle={{ color: 'var(--primary)' }}
                          />
                          <Line
                            type="monotone"
                            dataKey="count"
                            stroke="var(--primary)"
                            strokeWidth={3}
                            dot={{ fill: 'var(--primary)', strokeWidth: 2, r: 4, stroke: 'var(--background)' }}
                            activeDot={{ r: 6, strokeWidth: 0 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Recent Users */}
                <motion.div variants={itemVariants}>
                  <Card className="glass-strong border-zinc-200/50 dark:border-white/10 shadow-lg bg-white/50 dark:bg-black/20 h-full hover:translate-y-0 transition-all duration-300">
                    <CardHeader>
                      <CardTitle>最近注册</CardTitle>
                      <CardDescription>最近7天新用户</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {data.recent.users.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-8">暂无新用户</p>
                        ) : (
                          data.recent.users.map((user) => (
                            <div key={user.id} className="flex items-center gap-3">
                              <Avatar className="w-10 h-10">
                                <AvatarImage src={user.avatar || undefined} />
                                <AvatarFallback>{user.username[0].toUpperCase()}</AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{user.name || user.username}</p>
                                <p className="text-sm text-muted-foreground">@{user.username}</p>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(user.createdAt), {
                                  addSuffix: true,
                                  locale: zhCN,
                                })}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>

              {/* Rankings */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Storage Users */}
                <motion.div variants={itemVariants}>
                  <Card className="glass-strong border-zinc-200/50 dark:border-white/10 shadow-lg bg-white/50 dark:bg-black/20">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Crown className="w-5 h-5 text-yellow-500" />
                        存储使用排行
                      </CardTitle>
                      <CardDescription>Top 5 用户</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {data.rankings.topStorage.map((user, index) => (
                          <div key={user.id} className="flex items-center gap-3">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              index === 0 ? 'bg-yellow-500 text-white' :
                              index === 1 ? 'bg-gray-400 text-white' :
                              index === 2 ? 'bg-orange-600 text-white' :
                              'bg-muted text-muted-foreground'
                            }`}>
                              {index + 1}
                            </div>
                            <Avatar className="w-8 h-8">
                              <AvatarImage src={user.avatar || undefined} />
                              <AvatarFallback>{user.username[0].toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{user.name || user.username}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatBytes(user.storageUsed)} / {formatBytes(user.storageQuota)}
                              </p>
                            </div>
                            <Badge variant="outline">
                              {((Number(user.storageUsed) / Number(user.storageQuota)) * 100).toFixed(1)}%
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Top File Users */}
                <motion.div variants={itemVariants}>
                  <Card className="glass-strong border-zinc-200/50 dark:border-white/10 shadow-lg bg-white/50 dark:bg-black/20">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Crown className="w-5 h-5 text-blue-500" />
                        文件数量排行
                      </CardTitle>
                      <CardDescription>Top 5 用户</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {data.rankings.topFiles.map((user, index) => (
                          <div key={user.id} className="flex items-center gap-3">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              index === 0 ? 'bg-blue-500 text-white' :
                              index === 1 ? 'bg-blue-400 text-white' :
                              index === 2 ? 'bg-blue-300 text-white' :
                              'bg-muted text-muted-foreground'
                            }`}>
                              {index + 1}
                            </div>
                            <Avatar className="w-8 h-8">
                              <AvatarImage src={user.avatar || undefined} />
                              <AvatarFallback>{user.username[0].toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{user.name || user.username}</p>
                              <p className="text-xs text-muted-foreground">
                                {user.fileCount} / {user.fileQuota} 个文件
                              </p>
                            </div>
                            <Badge variant="outline">
                              {((user.fileCount / user.fileQuota) * 100).toFixed(1)}%
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>

              {/* Recent Activity */}
              <motion.div variants={itemVariants}>
                <Card className="glass-strong border-zinc-200/50 dark:border-white/10 shadow-lg bg-white/50 dark:bg-black/20">
                  <CardHeader>
                    <CardTitle>最近活动</CardTitle>
                    <CardDescription>系统操作记录</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {data.recent.logs.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">暂无活动</p>
                      ) : (
                        data.recent.logs.map((log) => (
                          <div key={log.id} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors px-2 rounded-lg">
                            {log.user ? (
                              <Avatar className="w-8 h-8">
                                <AvatarImage src={log.user.avatar || undefined} />
                                <AvatarFallback>{log.user.username[0].toUpperCase()}</AvatarFallback>
                              </Avatar>
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                                <Activity className="w-4 h-4 text-muted-foreground" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm">
                                <span className="font-medium">{log.user?.name || log.user?.username || '系统'}</span>
                                {' '}
                                <span className="text-muted-foreground">{actionLabels[log.action] || log.action}</span>
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(log.createdAt), {
                                  addSuffix: true,
                                  locale: zhCN,
                                })}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageWrapper>
  );
}
