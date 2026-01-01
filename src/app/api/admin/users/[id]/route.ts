import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import { getClientIp } from '@/lib/utils';

// PATCH /api/admin/users/[id] - 更新用户
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user: admin } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json();
    const { role, status, storageQuota, fileQuota } = body;

    // 检查用户是否存在
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // 防止管理员修改自己的角色
    if (id === admin.id && role && role !== user.role) {
      return NextResponse.json(
        { error: 'Cannot change your own role' },
        { status: 403 }
      );
    }

    // 更新用户
    const updateData: any = {};
    if (role !== undefined) updateData.role = role;
    if (status !== undefined) updateData.status = status;
    if (storageQuota !== undefined) updateData.storageQuota = BigInt(storageQuota);
    if (fileQuota !== undefined) updateData.fileQuota = fileQuota;

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
    });

    // 记录审计日志
    await prisma.auditLog.create({
      data: {
        userId: admin.id,
        action: 'USER_UPDATED',
        targetType: 'User',
        targetId: id,
        ipAddress: getClientIp(request),
        metadata: JSON.stringify({ 
          changes: {
            ...updateData,
            storageQuota: updateData.storageQuota?.toString()
          } 
        }),
      },
    });

    // 序列化 BigInt
    const serializedUser = {
      ...updatedUser,
      storageQuota: updatedUser.storageQuota.toString(),
      storageUsed: updatedUser.storageUsed.toString(),
    };

    return NextResponse.json(serializedUser);
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/users/[id] - 删除用户
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user: admin } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;

    // 防止管理员删除自己
    if (id === admin.id) {
      return NextResponse.json(
        { error: 'Cannot delete yourself' },
        { status: 403 }
      );
    }

    // 检查用户是否存在
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // 删除用户及其关联数据
    await prisma.$transaction([
      // 删除用户的文件
      prisma.file.deleteMany({ where: { userId: id } }),
      // 删除用户的配置
      prisma.config.deleteMany({ where: { userId: id } }),
      // 删除用户的审计日志
      prisma.auditLog.deleteMany({ where: { userId: id } }),
      // 删除用户
      prisma.user.delete({ where: { id } }),
    ]);

    // 记录审计日志
    await prisma.auditLog.create({
      data: {
        userId: admin.id,
        action: 'USER_DELETED',
        targetType: 'User',
        targetId: id,
        ipAddress: getClientIp(request),
        metadata: JSON.stringify({ username: user.username }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    );
  }
}
