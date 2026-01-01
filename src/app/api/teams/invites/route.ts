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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const team = await (prisma as any).team.findUnique({
      where: { ownerId: userId },
    });

    if (!team) {
      return NextResponse.json(
        { error: '只有团队主可以查看邀请码列表' },
        { status: 403 }
      );
    }

    // 获取团队所有邀请码
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const invites = await (prisma as any).inviteCode.findMany({
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

    // 检查用户是否是团队主
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const team = await (prisma as any).team.findUnique({
      where: { ownerId: userId },
    });

    if (!team) {
      return NextResponse.json(
        { error: '只有团队主可以删除邀请码' },
        { status: 403 }
      );
    }

    // 检查邀请码是否存在且属于该团队
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const invite = await (prisma as any).inviteCode.findUnique({
      where: { id },
    });

    if (!invite) {
      return NextResponse.json({ error: '邀请码不存在' }, { status: 404 });
    }

    if (invite.teamId !== team.id) {
      return NextResponse.json({ error: '无权删除此邀请码' }, { status: 403 });
    }

    // 删除邀请码
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).inviteCode.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: '邀请码已删除' });
  } catch (error) {
    console.error('删除邀请码失败:', error);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
