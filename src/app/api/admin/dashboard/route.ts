import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    // 获取系统概览数据 (仅保留非敏感的基础统计)
    const [
      totalUsers,
      activeUsers,
      adminUsers,
      recentLogs,
    ] = await Promise.all([
      // 总用户数
      prisma.user.count(),
      
      // 活跃用户数（最近7天登录）
      prisma.user.count({
        where: {
          lastLoginAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      
      // 管理员数量
      prisma.user.count({
        where: { role: 'ADMIN' },
      }),
      
      // 最近操作日志
      prisma.auditLog.findMany({
        select: {
          id: true,
          action: true,
          metadata: true,
          createdAt: true,
          user: {
            select: {
              username: true,
              name: true,
              avatar: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    // 获取用户注册趋势（最近7天）- 合并为活跃趋势逻辑
    const userTrend = await Promise.all(
      Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i));
        date.setHours(0, 0, 0, 0);
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);

        return prisma.user.count({
          where: {
            lastLoginAt: {
              gte: date,
              lt: nextDate,
            },
          },
        }).then(count => ({
          name: date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }),
          users: count,
        }));
      })
    );

    return NextResponse.json({
      stats: {
        totalUsers,
        activeUsers,
        adminUsers,
        weeklyTrend: userTrend,
      },
      recent: {
        activities: recentLogs,
      },
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}
