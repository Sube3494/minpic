import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { serializeBigInt } from '@/lib/utils';
import { cache, CacheKeys } from '@/lib/cache';

// 生成邀请码schema
const generateInviteSchema = z.object({
  expiresInMinutes: z.number().min(1).max(10080).optional().default(1440), // 默认24小时 (1440分钟)，最大7天
  maxUses: z.number().min(1).max(100).optional().default(10), // 默认最多10次使用
});

// 加入团队schema
const joinTeamSchema = z.object({
  inviteCode: z.string().length(32),
});

// 移除 SerializedUser, SerializedTeam 和 serializeTeam

// POST /api/teams/invite - 生成邀请码
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const userId = session.user.id;

    // 检查用户是否是团队主
    const team = await prisma.team.findUnique({
      where: { ownerId: userId },
    });

    if (!team) {
      return NextResponse.json(
        { error: '只有团队主可以生成邀请码' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = generateInviteSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: '参数验证失败', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { expiresInMinutes, maxUses } = validation.data;

    // 生成32位随机邀请码
    const inviteCode = randomBytes(16).toString('hex');
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + expiresInMinutes);

    // 创建邀请码记录
    const invite = await prisma.inviteCode.create({
      data: {
        code: inviteCode,
        teamId: team.id,
        createdBy: userId,
        expiresAt,
        maxUses,
      },
    });

    return NextResponse.json({
      inviteCode: invite.code,
      expiresAt: invite.expiresAt,
      maxUses: invite.maxUses,
      teamName: team.name,
    });
  } catch (error) {
    console.error('生成邀请码失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// PUT /api/teams/invite - 通过邀请码加入团队
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const userId = session.user.id;

    // 检查用户是否已经在团队中
    const existingMembership = await prisma.teamMember.findUnique({
      where: { userId },
    });

    if (existingMembership) {
      return NextResponse.json(
        { error: '您已经是团队成员，请先退出当前团队' },
        { status: 400 }
      );
    }

    // 检查用户是否已经拥有团队
    const ownedTeam = await prisma.team.findUnique({
      where: { ownerId: userId },
    });

    if (ownedTeam) {
      return NextResponse.json(
        { error: '您已经拥有一个团队，无法加入其他团队' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validation = joinTeamSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: '参数验证失败', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { inviteCode } = validation.data;

    // 查找有效的邀请码，加入团队配额设置
    const invite = await prisma.inviteCode.findUnique({
      where: { code: inviteCode },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            autoAllocateQuota: true,
            defaultStorageQuota: true,
            defaultFileQuota: true,
            owner: {
              select: {
                id: true,
                username: true,
                name: true,
                avatar: true,
                githubId: true,
                storageUsed: true,
                fileCount: true,
              },
            },
          },
        },
      },
    });

    // 验证邀请码
    if (!invite) {
      return NextResponse.json(
        { error: '邀请码无效' },
        { status: 400 }
      );
    }

    if (new Date(invite.expiresAt) < new Date()) {
      return NextResponse.json(
        { error: '邀请码已过期' },
        { status: 400 }
      );
    }

    if (invite.usedCount >= invite.maxUses) {
      return NextResponse.json(
        { error: '邀请码已达使用上限' },
        { status: 400 }
      );
    }

    // 计算初始配额
    let initialStorageQuota: bigint | null = null;
    let initialFileQuota: number | null = null;

    if (invite.team.autoAllocateQuota) {
      initialStorageQuota = invite.team.defaultStorageQuota;
      initialFileQuota = invite.team.defaultFileQuota;
    }

    // 创建团队成员记录
    const member = await prisma.teamMember.create({
      data: {
        teamId: invite.teamId,
        userId,
        role: 'MEMBER',
        storageQuota: initialStorageQuota,
        fileQuota: initialFileQuota,
      },
      include: {
        team: {
          include: {
            owner: {
              select: {
                id: true,
                username: true,
                name: true,
                avatar: true,
                githubId: true,
                storageUsed: true,
                fileCount: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            avatar: true,
            githubId: true,
          },
        },
      },
    });
    
    // Invalidate user quota cache to ensure new settings take effect immediately
    await cache.del(CacheKeys.userQuota(userId));
// 更新邀请码使用次数
    await prisma.inviteCode.update({
      where: { id: invite.id },
      data: {
        usedCount: { increment: 1 },
      },
    });

    return NextResponse.json({
      success: true,
      message: '成功加入团队',
      team: serializeBigInt(member.team),
    });
  } catch (error) {
    console.error('加入团队失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// DELETE /api/teams/invite - 退出团队
export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const userId = session.user.id;

    // 检查用户是否是团队成员
    const membership = await prisma.teamMember.findUnique({
      where: { userId },
      include: { team: true },
    });

    if (!membership) {
      return NextResponse.json(
        { error: '您不在任何团队中' },
        { status: 404 }
      );
    }

    // 团队主不能通过此接口退出，必须解散团队
    if (membership.team.ownerId === userId) {
      return NextResponse.json(
        { error: '团队主不能退出团队，请使用解散团队功能' },
        { status: 400 }
      );
    }

    // 删除成员记录
    await prisma.teamMember.delete({
      where: { userId },
    });

    return NextResponse.json({
      success: true,
      message: '已退出团队',
    });
  } catch (error) {
    console.error('退出团队失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
