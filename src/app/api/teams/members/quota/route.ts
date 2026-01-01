import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// Schema for setting member quota
const setQuotaSchema = z.object({
  userId: z.string(),
  storageQuota: z.number().optional().nullable(),
  fileQuota: z.number().int().optional().nullable(),
});

// PATCH /api/teams/members/quota - 设置成员配额
export async function PATCH(request: Request) {
  try {
    const session = await requireAuth();
    const userId = session.user.id;

    // 检查用户是否是团队主
    const team = await prisma.team.findUnique({
      where: { ownerId: userId },
    });

    if (!team) {
      return NextResponse.json(
        { error: '只有团队主可以设置成员配额' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = setQuotaSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: '参数验证失败', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { userId: targetUserId, storageQuota, fileQuota } = validation.data;

    // 验证目标用户是该团队成员
    const member = await prisma.teamMember.findFirst({
      where: {
        teamId: team.id,
        userId: targetUserId,
      },
    });

    if (!member) {
      return NextResponse.json(
        { error: '该用户不是团队成员' },
        { status: 404 }
      );
    }

    // 更新成员配额
    const updatedMember = await prisma.teamMember.update({
      where: { id: member.id },
      data: {
        storageQuota: storageQuota !== undefined ? BigInt(storageQuota) : undefined,
        fileQuota,
      },
    });

    return NextResponse.json({
      success: true,
      member: {
        ...updatedMember,
        storageQuota: updatedMember.storageQuota?.toString(),
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: '设置配额失败' }, { status: 500 });
  }
}
