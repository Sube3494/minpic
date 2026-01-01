import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { randomBytes } from 'crypto';

// 生成邀请码schema
const generateInviteSchema = z.object({
  expiresInMinutes: z.number().min(1).max(10080).optional().default(1440), // 默认24小时 (1440分钟)，最大7天
  maxUses: z.number().min(1).max(100).optional().default(10), // 默认最多10次使用
});

// 加入团队schema
const joinTeamSchema = z.object({
  inviteCode: z.string().length(32),
});

// Helper function to convert BigInt to string for JSON serialization
// Helper function to convert BigInt to string for JSON serialization
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeTeam(team: any) {
  if (!team) return team;
  
  return {
    ...team,
    owner: team.owner ? {
      ...team.owner,
      storageQuota: team.owner.storageQuota?.toString(),
      storageUsed: team.owner.storageUsed?.toString(),
    } : undefined,
  };
}

// POST /api/teams/invite - 生成邀请码
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const userId = session.user.id;

    // 检查用户是否是团队主
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const team = await (prisma as any).team.findUnique({
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { error: '参数验证失败', details: (validation.error as any).errors },
        { status: 400 }
      );
    }

    const { expiresInMinutes, maxUses } = validation.data;

    // 生成32位随机邀请码
    const inviteCode = randomBytes(16).toString('hex');
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + expiresInMinutes);

    // 创建邀请码记录
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const invite = await (prisma as any).inviteCode.create({
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingMembership = await (prisma as any).teamMember.findUnique({
      where: { userId },
    });

    if (existingMembership) {
      return NextResponse.json(
        { error: '您已经是团队成员，请先退出当前团队' },
        { status: 400 }
      );
    }

    // 检查用户是否已经拥有团队
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ownedTeam = await (prisma as any).team.findUnique({
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { error: '参数验证失败', details: (validation.error as any).errors },
        { status: 400 }
      );
    }

    const { inviteCode } = validation.data;

    // 查找有效的邀请码
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const invite = await (prisma as any).inviteCode.findUnique({
      where: { code: inviteCode },
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
                storageQuota: true,
                storageUsed: true,
                fileQuota: true,
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

    // 创建团队成员记录
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const member = await (prisma as any).teamMember.create({
      data: {
        teamId: invite.teamId,
        userId,
        role: 'MEMBER',
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
                storageQuota: true,
                storageUsed: true,
                fileQuota: true,
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
            storageQuota: true,
          },
        },
      },
    });

    // 更新邀请码使用次数
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).inviteCode.update({
      where: { id: invite.id },
      data: {
        usedCount: { increment: 1 },
      },
    });

    return NextResponse.json({
      success: true,
      message: '成功加入团队',
      team: serializeTeam(member.team),
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const membership = await (prisma as any).teamMember.findUnique({
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).teamMember.delete({
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
