import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import { getClientIp } from '@/lib/utils';

// GET /api/admin/whitelist - 获取白名单列表
export async function GET(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';

    const skip = (page - 1) * limit;

    // 构建查询条件
    const where: {
      OR?: Array<{
        githubId?: { contains: string };
        reason?: { contains: string };
      }>;
    } = {};
    
    if (search) {
      where.OR = [
        { githubId: { contains: search } },
        { reason: { contains: search } },
      ];
    }

    // 获取白名单列表和总数
    const [whitelist, total] = await Promise.all([
      prisma.registrationWhitelist.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.registrationWhitelist.count({ where }),
    ]);

    return NextResponse.json({
      whitelist,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching whitelist:', error);
    return NextResponse.json(
      { error: 'Failed to fetch whitelist' },
      { status: 500 }
    );
  }
}

// POST /api/admin/whitelist - 添加白名单
export async function POST(request: NextRequest) {
  const { error, user: admin } = await requireAdmin();
  if (error) return error;

  try {
    const body = await request.json();
    const { githubIds, note } = body;

    if (!githubIds || !Array.isArray(githubIds) || githubIds.length === 0) {
      return NextResponse.json(
        { error: 'GitHub IDs are required' },
        { status: 400 }
      );
    }

    // 批量创建白名单
    const results = await Promise.allSettled(
      githubIds.map((githubId: string) =>
        prisma.registrationWhitelist.create({
          data: {
            githubId: githubId.trim(),
            username: githubId.trim(),
            addedBy: admin.id,
            reason: note || undefined,
          },
        })
      )
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    // 记录审计日志
    await prisma.auditLog.create({
      data: {
        userId: admin.id,
        action: 'WHITELIST_ADDED',
        ipAddress: getClientIp(request),
        metadata: JSON.stringify({ 
          count: successful,
          failed,
          githubIds 
        }),
      },
    });

    return NextResponse.json({
      success: true,
      added: successful,
      failed,
    });
  } catch (error) {
    console.error('Error adding whitelist:', error);
    return NextResponse.json(
      { error: 'Failed to add whitelist' },
      { status: 500 }
    );
  }
}
