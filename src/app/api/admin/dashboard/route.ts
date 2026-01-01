import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    // 获取系统概览数据
    const [
      totalUsers,
      activeUsers,
      totalFiles,
      totalStorage,
      recentUsers,
      recentFiles,
      topStorageUsers,
      topFileUsers,
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
      
      // 总文件数
      prisma.file.count(),
      
      // 总存储使用量 - 直接从文件表统计
      prisma.file.aggregate({
        _sum: {
          fileSize: true,
        },
      }),
      
      // 最近注册用户（最近7天）
      prisma.user.findMany({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
        select: {
          id: true,
          username: true,
          name: true,
          avatar: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      
      // 最近上传文件
      prisma.file.findMany({
        select: {
          id: true,
          filename: true,
          fileSize: true,
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
      
      // 存储使用 Top 5 - 从文件表统计
      prisma.file.groupBy({
        by: ['userId'],
        _sum: {
          fileSize: true,
        },
        orderBy: {
          _sum: {
            fileSize: 'desc',
          },
        },
        take: 5,
      }).then(async (results) => {
        const userIds = results.map(r => r.userId);
        const users = await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: {
            id: true,
            username: true,
            name: true,
            avatar: true,
            storageQuota: true,
          },
        });
        
        return results.map(r => {
          const user = users.find(u => u.id === r.userId);
          return {
            id: user?.id || r.userId,
            username: user?.username || 'Unknown',
            name: user?.name || null,
            avatar: user?.avatar || null,
            storageUsed: (r._sum.fileSize || 0).toString(),
            storageQuota: user?.storageQuota.toString() || '0',
          };
        });
      }),
      
      // 文件数量 Top 5 - 从文件表统计
      prisma.file.groupBy({
        by: ['userId'],
        _count: {
          id: true,
        },
        orderBy: {
          _count: {
            id: 'desc',
          },
        },
        take: 5,
      }).then(async (results) => {
        const userIds = results.map(r => r.userId);
        const users = await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: {
            id: true,
            username: true,
            name: true,
            avatar: true,
            fileQuota: true,
          },
        });
        
        return results.map(r => {
          const user = users.find(u => u.id === r.userId);
          return {
            id: user?.id || r.userId,
            username: user?.username || 'Unknown',
            name: user?.name || null,
            avatar: user?.avatar || null,
            fileCount: r._count.id,
            fileQuota: user?.fileQuota || 0,
          };
        });
      }),
      
      // 最近操作日志
      prisma.auditLog.findMany({
        select: {
          id: true,
          action: true,
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

    // 获取用户注册趋势（最近7天）
    const userTrend = await Promise.all(
      Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i));
        date.setHours(0, 0, 0, 0);
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);

        return prisma.user.count({
          where: {
            createdAt: {
              gte: date,
              lt: nextDate,
            },
          },
        }).then(count => ({
          date: date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }),
          count,
        }));
      })
    );

    // 序列化 BigInt
    const serializedTopStorage = topStorageUsers.map(user => ({
      ...user,
      storageUsed: user.storageUsed.toString(),
      storageQuota: user.storageQuota.toString(),
    }));

    return NextResponse.json({
      overview: {
        totalUsers,
        activeUsers,
        totalFiles,
        totalStorage: totalStorage._sum.fileSize?.toString() || '0',
      },
      trends: {
        users: userTrend,
      },
      rankings: {
        topStorage: serializedTopStorage,
        topFiles: topFileUsers,
      },
      recent: {
        users: recentUsers,
        files: recentFiles,
        logs: recentLogs,
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
