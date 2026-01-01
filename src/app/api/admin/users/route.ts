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

    // 构建查询条件
    const where: Prisma.UserWhereInput = {};
    
    if (search) {
      where.OR = [
        { username: { contains: search } },
        { name: { contains: search } },
        { email: { contains: search } },
        { githubId: { contains: search } },
      ];
    }

    if (role && role !== 'ALL') {
      where.role = role;
    }

    if (status && status !== 'ALL') {
      where.status = status;
    }

    // 处理排序 - 移除 storageUsed 和 fileCount 的排序支持
    const validSortFields = ['username', 'createdAt', 'role', 'status'];
    const finalSortBy = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const orderBy: Prisma.UserOrderByWithRelationInput = { [finalSortBy]: sortOrder };

    // 获取用户列表和总数
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
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
          createdAt: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    // 获取全局用户统计 (不含敏感存储数据)
    const [totalUsers, activeUsers, adminUsers] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({
        where: {
          lastLoginAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      prisma.user.count({
        where: { role: 'ADMIN' },
      }),
    ]);

    return NextResponse.json({
      users,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
      stats: {
        totalUsers,
        activeUsers,
        adminUsers,
      }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}
