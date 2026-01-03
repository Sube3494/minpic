import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { cache, CacheKeys } from '@/lib/cache';

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
        { error: '只有团队主可以设置成员配额' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = setQuotaSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: '参数验证失败', details: validation.error.issues },
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
      include: {
        user: {
          select: { storageUsed: true, fileCount: true }
        }
      }
    });

    if (!member) {
      return NextResponse.json(
        { error: '该用户不是团队成员' },
        { status: 404 }
      );
    }

    // 获取团队配额和所有成员的配额状态
    const teamWithMembers = await prisma.team.findUnique({
      where: { id: team.id },
      select: {
        storageQuota: true,
        fileQuota: true,
        owner: {
          select: { storageUsed: true, fileCount: true }
        }
      }
    });

    if (!teamWithMembers) throw new Error('Team not found');

    const allMembers = await prisma.teamMember.findMany({
      where: { teamId: team.id },
      select: { userId: true, storageQuota: true, fileQuota: true }
    });

    const formatSize = (bytes: bigint) => {
      const g = Number(bytes) / (1024 * 1024 * 1024);
      if (g >= 1) return `${g.toFixed(2)} GB`;
      return `${(Number(bytes) / (1024 * 1024)).toFixed(2)} MB`;
    };

      // 1. 验证存储限额
    if (storageQuota !== undefined) {
      const newStorageVal = storageQuota === null ? null : BigInt(storageQuota);
      
      let oldTotalStorage = BigInt(teamWithMembers.owner.storageUsed || 0);
      let newTotalStorage = BigInt(teamWithMembers.owner.storageUsed || 0);

      for (const m of allMembers) {
        // 只统计显式设置的成员配额
        const currentMQuota = m.storageQuota || BigInt(0);
        oldTotalStorage += BigInt(currentMQuota);
        
        if (m.userId === targetUserId) {
          const nextMQuota = newStorageVal || BigInt(0);
          newTotalStorage += BigInt(nextMQuota);
        } else {
          newTotalStorage += BigInt(currentMQuota);
        }
      }

      const totalPool = BigInt(teamWithMembers.storageQuota);
      if (newTotalStorage > totalPool && newTotalStorage > oldTotalStorage) {
        return NextResponse.json({
          error: '分配失败：存储空间超出团队总额',
          message: `您的总容量为 ${formatSize(totalPool)}。当前已通过显式限额分配了 ${formatSize(newTotalStorage)} (含个人占用)，超过了总容量。请先调低其他成员的限额或清理空间。`
        }, { status: 400 });
      }
    }

    // 2. 验证文件数量限额
    if (fileQuota !== undefined) {
      let oldTotalFiles = Number(teamWithMembers.owner.fileCount || 0);
      let newTotalFiles = Number(teamWithMembers.owner.fileCount || 0);

      for (const m of allMembers) {
        // 只统计显式设置的成员配额
        const currentFQuota = m.fileQuota || 0;
        oldTotalFiles += currentFQuota;
        
        if (m.userId === targetUserId) {
          const nextFQuota = fileQuota || 0;
          newTotalFiles += nextFQuota;
        } else {
          newTotalFiles += currentFQuota;
        }
      }

      if (newTotalFiles > teamWithMembers.fileQuota && newTotalFiles > oldTotalFiles) {
        return NextResponse.json({
          error: '分配失败：文件数量超出团队总额',
          message: `您的总文件配额为 ${teamWithMembers.fileQuota}。目前显式分配已达 ${newTotalFiles} (含个人占用)，超过了上限。`
        }, { status: 400 });
      }
    }

    // 更新成员配额
    const updatedMember = await prisma.teamMember.update({
      where: { id: member.id },
      data: {
        storageQuota: storageQuota !== undefined ? (storageQuota === null ? null : BigInt(storageQuota)) : undefined,
        fileQuota,
      },
    });

    // Invalidate user quota cache
    await cache.del(CacheKeys.userQuota(targetUserId));

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
