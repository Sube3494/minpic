'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, Activity, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { PageWrapper } from '@/components/layout/page-wrapper';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface DashboardData {
  stats: {
    totalUsers: number;
    activeUsers: number;
    adminUsers: number;
    weeklyTrend: Array<{ name: string; users: number }>;
  };
  recent: {
    activities: Array<{
      id: string;
      action: string;
      metadata: string | null;
      createdAt: string;
      user: {
        username: string;
        name: string | null;
        avatar: string | null;
      };
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
                <p className="text-muted-foreground mt-2">系统运行概览与用户活跃分析</p>
              </motion.div>

              {/* Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { title: '总用户数', value: data.stats.totalUsers.toString(), icon: Users, color: 'blue', sub: '系统注册用户总数' },
                  { title: '活跃用户', value: data.stats.activeUsers.toString(), icon: Activity, color: 'green', sub: '最近7天活跃用户' },
                  { title: '管理员', value: data.stats.adminUsers.toString(), icon: ShieldCheck, color: 'purple', sub: '拥有管理权限的用户' },
                ].map((stat, i) => (
                  <motion.div key={i} variants={itemVariants}>
                    <Card className="glass-strong border-zinc-200/50 dark:border-white/10 shadow-lg bg-white/50 dark:bg-black/20 relative overflow-hidden group hover:translate-y-0 transition-all duration-300">
                      <div className={`absolute inset-0 bg-linear-to-br from-${stat.color}-500/5 to-transparent opacity-50 group-hover:opacity-100 transition-opacity`} />
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-6 pb-2 relative">
                        <CardTitle className="text-sm font-medium text-muted-foreground truncate mr-2">{stat.title}</CardTitle>
                        <div className={`p-2 rounded-lg bg-${stat.color}-500/10 text-${stat.color}-500 shrink-0`}>
                          <stat.icon className="w-4 h-4" />
                        </div>
                      </CardHeader>
                      <CardContent className="p-6 pt-0 relative">
                        <div className="text-3xl font-bold truncate">{stat.value}</div>
                        <p className="text-xs text-muted-foreground mt-1 truncate">{stat.sub}</p>
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
                        <Activity className="w-5 h-5 text-primary" />
                        用户活跃趋势
                      </CardTitle>
                      <CardDescription>最近7天系统用户活动频率</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={data.stats.weeklyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                          <XAxis
                            dataKey="name"
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
                            dataKey="users"
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

                {/* Recent Activity */}
                <motion.div variants={itemVariants}>
                  <Card className="glass-strong border-zinc-200/50 dark:border-white/10 shadow-lg bg-white/50 dark:bg-black/20 h-full overflow-hidden">
                    <CardHeader>
                      <CardTitle>最近活动</CardTitle>
                      <CardDescription>系统实时操作记录</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1">
                        {data.recent.activities.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-12">暂无活动记录</p>
                        ) : (
                          data.recent.activities.map((log) => (
                            <div key={log.id} className="flex items-center gap-3 py-3 border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors px-2 rounded-lg">
                              <Avatar className="w-8 h-8 shrink-0">
                                <AvatarImage src={log.user.avatar || undefined} />
                                <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
                                  {log.user.username[0].toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm truncate">
                                  <span className="font-semibold">{log.user.name || log.user.username}</span>
                                  <span className="text-muted-foreground ml-2">{actionLabels[log.action] || log.action}</span>
                                </p>
                                <p className="text-[10px] text-muted-foreground">
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
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageWrapper>
  );
}
