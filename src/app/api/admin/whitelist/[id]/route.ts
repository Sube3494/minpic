import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';

// DELETE /api/admin/whitelist/[id] - 删除白名单
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user: admin } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;

    // 检查白名单是否存在
    const whitelist = await prisma.registrationWhitelist.findUnique({
      where: { id },
    });

    if (!whitelist) {
      return NextResponse.json(
        { error: 'Whitelist entry not found' },
        { status: 404 }
      );
    }

    // 删除白名单
    await prisma.registrationWhitelist.delete({
      where: { id },
    });

    // 记录审计日志
    await prisma.auditLog.create({
      data: {
        userId: admin.id,
        action: 'WHITELIST_REMOVED',
        metadata: JSON.stringify({ githubId: whitelist.githubId }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting whitelist:', error);
    return NextResponse.json(
      { error: 'Failed to delete whitelist' },
      { status: 500 }
    );
  }
}
