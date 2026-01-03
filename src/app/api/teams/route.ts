import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { serializeBigInt } from '@/lib/utils';
import { cache, CacheKeys } from '@/lib/cache';

// 创建团队的Schema
const createTeamSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(200).optional(),
});

// 更新团队的Schema
const updateTeamSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.string().max(200).optional(),
  storageQuota: z.union([z.string(), z.number()]).transform((v) => BigInt(v)).optional(),
  storageQuotaMB: z.number().nonnegative().optional(), // Frontend sends MB
  fileQuota: z.number().int().nonnegative().optional(),
  autoAllocateQuota: z.boolean().optional(),
  defaultStorageQuota: z.union([z.string(), z.number()]).transform((v) => BigInt(v)).optional(),
  defaultStorageQuotaMB: z.number().nonnegative().optional(), // Frontend sends MB
  defaultFileQuota: z.number().int().nonnegative().optional(),
}).transform((data) => {
  // Convert MB to Bytes if present
  if (data.storageQuotaMB !== undefined) {
    data.storageQuota = BigInt(Math.floor(data.storageQuotaMB * 1024 * 1024));
    delete data.storageQuotaMB;
  }
  if (data.defaultStorageQuotaMB !== undefined) {
    data.defaultStorageQuota = BigInt(Math.floor(data.defaultStorageQuotaMB * 1024 * 1024));
    delete data.defaultStorageQuotaMB;
  }
  return data;
});

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
            storageUsed: true,
            fileCount: true,
          },
        },
      },
    });

    if (ownedTeam) {
      return NextResponse.json(serializeBigInt({
        team: ownedTeam,
        role: 'OWNER',
      }));
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
                storageUsed: true,
                fileCount: true,
              },
            },
          },
        },
      },
    });

    if (membership) {
      return NextResponse.json(serializeBigInt({
        team: membership.team,
        role: membership.role,
      }));
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
        { error: '参数验证失败', details: validation.error.issues },
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
            storageUsed: true,
            fileCount: true,
          },
        },
      },
    });

    return NextResponse.json(serializeBigInt({ team, role: 'OWNER' }));
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
        { error: '参数验证失败', details: validation.error.issues },
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
            storageUsed: true,
            fileCount: true,
          },
        },
      },
    });

    // Invalidate cache
    await cache.del(CacheKeys.team(team.id));
    await cache.del(CacheKeys.teamQuota(team.id));
    
    // Invalidate quota cache for all members and owner
    // Since we included members in the update response, we can use that list
    const memberIds = updatedTeam.members.map(m => m.userId);
    // Add owner if not in members list (though usually owner is a member with OWNER/ADMIN role)
    if (!memberIds.includes(updatedTeam.ownerId)) {
        memberIds.push(updatedTeam.ownerId);
    }
    
    await Promise.all(memberIds.map(uid => cache.del(CacheKeys.userQuota(uid))));

    return NextResponse.json(serializeBigInt({ team: updatedTeam }));
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
