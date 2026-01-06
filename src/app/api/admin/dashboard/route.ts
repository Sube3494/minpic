import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import { cache } from '@/lib/cache';

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
      
      // 活跃用户数(最近7天登录)
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
        take: 50,
      }),
    ]);

    // 优化: 获取用户趋势(最近7天) - 使用缓存
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const userTrend = await Promise.all(
      Array.from({ length: 7 }, async (_, i) => {
        const date = new Date(today);
        date.setDate(date.getDate() - (6 - i));
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);
        
        const dateString = date.toISOString().split('T')[0];
        const isToday = i === 6;
        
        // 对于历史日期使用缓存(数据不会变),今天的数据使用短缓存
        const cacheKey = `admin:dashboard:trend:${dateString}`;
        const cached = await cache.get<{ name: string; users: number }>(cacheKey);
        
        if (cached && !isToday) {
          return cached;
        }

        const count = await prisma.user.count({
          where: {
            lastLoginAt: {
              gte: date,
              lt: nextDate,
            },
          },
        });

        const result = {
          name: date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }),
          users: count,
        };

        // 历史数据缓存24小时,今天的数据缓存5分钟
        const ttl = isToday ? 300 : 86400;
        await cache.set(cacheKey, result, ttl);

        return result;
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
