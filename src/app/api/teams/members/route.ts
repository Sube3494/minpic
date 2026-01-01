import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// 更新成员角色的Schema
const updateMemberRoleSchema = z.object({
  role: z.enum(['ADMIN', 'MEMBER']),
});

// GET /api/teams/members - 获取团队成员列表
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const userId = session.user.id;

    // 检查用户的团队（作为团队主或成员）
    const ownedTeam = await prisma.team.findUnique({
      where: { ownerId: userId },
      include: {
        members: {
          include: {
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
          orderBy: { joinedAt: 'asc' },
        },
      },
    });

    if (ownedTeam) {
      const sortedMembers = ownedTeam.members.sort((a, b) => {
        if (a.userId === userId) return -1;
        if (b.userId === userId) return 1;
        return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
      });
      return NextResponse.json({ members: sortedMembers });
    }

    const membership = await prisma.teamMember.findUnique({
      where: { userId },
      include: {
        team: {
          include: {
            members: {
              include: {
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
            },
          },
        },
      },
    });

    if (membership) {
      const ownerId = membership.team.ownerId;
      const sortedMembers = membership.team.members.sort((a, b) => {
        if (a.userId === ownerId) return -1;
        if (b.userId === ownerId) return 1;
        return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
      });
      return NextResponse.json({ members: sortedMembers });
    }

    return NextResponse.json({ error: '您不在任何团队中' }, { status: 404 });
  } catch (error) {
    console.error('获取成员列表失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// DELETE /api/teams/members?userId={userId} - 移除团队成员
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const currentUserId = session.user.id;
    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('userId');

    if (!targetUserId) {
      return NextResponse.json(
        { error: '缺少用户ID参数' },
        { status: 400 }
      );
    }

    // 检查当前用户是否是团队主
    const team = await prisma.team.findUnique({
      where: { ownerId: currentUserId },
    });

    if (!team) {
      return NextResponse.json(
        { error: '只有团队主可以移除成员' },
        { status: 403 }
      );
    }

    // 不能移除自己
    if (targetUserId === currentUserId) {
      return NextResponse.json(
        { error: '不能移除自己，请使用解散团队功能' },
        { status: 400 }
      );
    }

    // 检查目标用户是否在团队中
    const memberToRemove = await prisma.teamMember.findUnique({
      where: { userId: targetUserId },
    });

    if (!memberToRemove || memberToRemove.teamId !== team.id) {
      return NextResponse.json(
        { error: '该用户不在您的团队中' },
        { status: 404 }
      );
    }

    // 移除成员
    await prisma.teamMember.delete({
      where: { userId: targetUserId },
    });

    return NextResponse.json({ 
      success: true, 
      message: '成员已移除' 
    });
  } catch (error) {
    console.error('移除成员失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// PATCH /api/teams/members?userId={userId} - 更新成员角色
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const currentUserId = session.user.id;
    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('userId');

    if (!targetUserId) {
      return NextResponse.json(
        { error: '缺少用户ID参数' },
        { status: 400 }
      );
    }

    // 检查当前用户是否是团队主
    const team = await prisma.team.findUnique({
      where: { ownerId: currentUserId },
    });

    if (!team) {
      return NextResponse.json(
        { error: '只有团队主可以修改成员角色' },
        { status: 403 }
      );
    }

    // 不能修改自己的角色
    if (targetUserId === currentUserId) {
      return NextResponse.json(
        { error: '不能修改自己的角色' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validation = updateMemberRoleSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: '参数验证失败', details: validation.error.issues },
        { status: 400 }
      );
    }

    // 检查目标用户是否在团队中
    const memberToUpdate = await prisma.teamMember.findUnique({
      where: { userId: targetUserId },
    });

    if (!memberToUpdate || memberToUpdate.teamId !== team.id) {
      return NextResponse.json(
        { error: '该用户不在您的团队中' },
        { status: 404 }
      );
    }

    // 更新角色
    const updatedMember = await prisma.teamMember.update({
      where: { userId: targetUserId },
      data: { role: validation.data.role },
      include: {
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

    return NextResponse.json({ member: updatedMember });
  } catch (error) {
    console.error('更新成员角色失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
