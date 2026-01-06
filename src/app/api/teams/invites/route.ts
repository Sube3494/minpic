import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';

// GET /api/teams/invites - 获取团队邀请码历史
export async function GET() {
  try {
    const session = await requireAuth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    // 检查用户是否是团队主
    const team = await prisma.team.findUnique({
      where: { ownerId: userId },
    });

    if (!team) {
      return NextResponse.json(
        { error: '只有团队主可以查看邀请码列表' },
        { status: 403 }
      );
    }

    // 获取团队所有邀请码
    const invites = await prisma.inviteCode.findMany({
      where: { teamId: team.id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                name: true,
                avatar: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ invites });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: '获取邀请码列表失败' }, { status: 500 });
  }
}

// DELETE /api/teams/invites?id={id} - 删除邀请码
export async function DELETE(request: NextRequest) {
  try {
    const session = await requireAuth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '缺少邀请码ID' }, { status: 400 });
    }

    // 优化: 一次查询获取邀请码及其团队所有者信息
    const invite = await prisma.inviteCode.findUnique({
      where: { id },
      select: {
        id: true,
        teamId: true,
        team: {
          select: { ownerId: true }
        }
      }
    });

    // 验证邀请码存在且当前用户是团队所有者
    if (!invite) {
      return NextResponse.json({ error: '邀请码不存在' }, { status: 404 });
    }

    if (invite.team.ownerId !== userId) {
      return NextResponse.json({ error: '只有团队主可以删除邀请码' }, { status: 403 });
    }

    // 删除邀请码
    await prisma.inviteCode.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: '邀请码已删除' });
  } catch (error) {
    console.error('删除邀请码失败:', error);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
