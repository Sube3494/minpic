import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

// GET /api/admin/users - 获取用户列表
export async function GET(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const role = searchParams.get('role') || '';
    const status = searchParams.get('status') || '';
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';

    const skip = (page - 1) * limit;

    // 构建查询条件
    const where: Prisma.UserWhereInput = {};
    
    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { githubId: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (role && role !== 'ALL') {
      where.role = role;
    }

    if (status && status !== 'ALL') {
      where.status = status;
    }

    // 处理排序
    let orderBy: Prisma.UserOrderByWithRelationInput = {};
    const validSortFields = ['username', 'createdAt', 'role', 'status', 'storageUsed', 'fileCount'];
    if (validSortFields.includes(sortBy)) {
      orderBy = { [sortBy as keyof Prisma.UserOrderByWithRelationInput]: sortOrder };
    } else {
      orderBy = { createdAt: 'desc' }; // 默认排序
    }

    // 获取用户列表、总数和统计数据
    const [users, total, totalUsers, activeUsers, adminUsers, totalStorageSum] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: {
          id: true,
          githubId: true,
          username: true,
          name: true,
          email: true,
          avatar: true,
          role: true,
          status: true,
          storageQuota: true,
          storageUsed: true,
          fileQuota: true,
          fileCount: true,
          lastLoginAt: true,
          createdAt: true,
        },
      }),
      prisma.user.count({ where }),
      prisma.user.count(),
      prisma.user.count({ where: { status: 'ACTIVE' } }),
      prisma.user.count({ where: { role: 'ADMIN' } }),
      // 总存储使用量 - 从文件表统计
      prisma.file.aggregate({
        _sum: {
          fileSize: true,
        },
      }),
    ]);

    // 序列化 BigInt
    const serializedUsers = users.map(user => ({
      ...user,
      storageQuota: user.storageQuota.toString(),
      storageUsed: user.storageUsed.toString(),
      fileCount: user.fileCount,
    }));

    return NextResponse.json({
      users: serializedUsers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        totalUsers,
        activeUsers,
        adminUsers,
        totalStorage: totalStorageSum._sum.fileSize?.toString() || '0',
      },
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}
