import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// 创建团队的Schema
const createTeamSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(200).optional(),
});

// 更新团队的Schema
const updateTeamSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.string().max(200).optional(),
});

// Helper function to convert BigInt to string for JSON serialization
function serializeTeam(team: any) {
  if (!team) return team;
  
  return {
    ...team,
    owner: team.owner ? {
      ...team.owner,
      storageQuota: team.owner.storageQuota?.toString(),
      storageUsed: team.owner.storageUsed?.toString(),
      // fileQuota and fileCount are Int, not BigInt, so they don't need serialization
    } : undefined,
    members: team.members?.map((member: any) => ({
      ...member,
      storageQuota: member.storageQuota?.toString(),
      user: member.user ? {
        ...member.user,
        storageUsed: member.user.storageUsed?.toString(),
        // fileCount is Int, not BigInt
      } : undefined,
    })),
  };
}

// GET /api/teams - 获取当前用户的团队信息
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const userId = session.user.id;

    // 检查用户是否是团队主
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
                storageUsed: true,
                fileCount: true,
              },
            },
          },
        },
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
    });

    if (ownedTeam) {
      console.log('Owner data:', ownedTeam.owner); // Debug log
      return NextResponse.json({
        team: serializeTeam(ownedTeam),
        role: 'OWNER',
      });
    }

    // 检查用户是否是团队成员
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
                    storageUsed: true,
                    fileCount: true,
                  },
                },
              },
            },
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

    if (membership) {
      return NextResponse.json({
        team: serializeTeam(membership.team),
        role: membership.role,
      });
    }

    // 用户不在任何团队中
    return NextResponse.json({ team: null, role: null });
  } catch (error) {
    console.error('获取团队信息失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// POST /api/teams - 创建团队
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const userId = session.user.id;

    // 检查用户是否已经拥有团队
    const existingOwnedTeam = await prisma.team.findUnique({
      where: { ownerId: userId },
    });

    if (existingOwnedTeam) {
      return NextResponse.json(
        { error: '您已经创建了一个团队' },
        { status: 400 }
      );
    }

    // 检查用户是否已经是其他团队的成员
    const existingMembership = await prisma.teamMember.findUnique({
      where: { userId },
    });

    if (existingMembership) {
      return NextResponse.json(
        { error: '您已经是其他团队的成员，请先退出' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validation = createTeamSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: '参数验证失败', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { name, description } = validation.data;

    // 创建团队和团队主的成员记录
    const team = await prisma.team.create({
      data: {
        name,
        description,
        ownerId: userId,
        members: {
          create: {
            userId,
            role: 'ADMIN',
          },
        },
      },
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
    });

    return NextResponse.json({ team: serializeTeam(team), role: 'OWNER' });
  } catch (error) {
    console.error('创建团队失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// PATCH /api/teams - 更新团队信息
export async function PATCH(request: NextRequest) {
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
        { error: '您不是团队主，无权修改团队信息' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = updateTeamSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: '参数验证失败', details: validation.error.errors },
        { status: 400 }
      );
    }

    const updatedTeam = await prisma.team.update({
      where: { id: team.id },
      data: validation.data,
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
    });

    return NextResponse.json({ team: serializeTeam(updatedTeam) });
  } catch (error) {
    console.error('更新团队失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// DELETE /api/teams - 解散团队
export async function DELETE() {
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
        { error: '您不是团队主，无权解散团队' },
        { status: 403 }
      );
    }

    // 删除团队（会级联删除所有成员记录）
    await prisma.team.delete({
      where: { id: team.id },
    });

    return NextResponse.json({ success: true, message: '团队已解散' });
  } catch (error) {
    console.error('解散团队失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
