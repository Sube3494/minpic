import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

// GET /api/admin/audit/export - 导出审计日志
export async function GET(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || '';
    const userId = searchParams.get('userId') || '';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const format = searchParams.get('format') || 'csv';

    // 构建查询条件说明
    const where: Prisma.AuditLogWhereInput = {};
    if (action) where.action = action;
    if (userId) where.userId = userId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            username: true,
            name: true,
          },
        },
      },
    });

    if (format === 'json') {
      return NextResponse.json(logs);
    }

    // 默认导出 CSV
    const headers = ['ID', 'Time', 'User', 'Action', 'Target Type', 'Target ID', 'Metadata', 'IP Address'];
    const rows = logs.map(log => [
      log.id,
      log.createdAt.toISOString(),
      log.user?.name || log.user?.username || 'System',
      log.action,
      log.targetType || '',
      log.targetId || '',
      log.metadata ? log.metadata.replace(/"/g, '""') : '',
      log.ipAddress || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename=audit_logs_${new Date().toISOString().split('T')[0]}.csv`,
      },
    });
  } catch (error) {
    console.error('Error exporting audit logs:', error);
    return NextResponse.json(
      { error: 'Failed to export audit logs' },
      { status: 500 }
    );
  }
}
