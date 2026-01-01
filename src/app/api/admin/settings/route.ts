import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import { getClientIp } from '@/lib/utils';
import { Prisma } from '@prisma/client';

// GET /api/admin/settings - 获取系统设置
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    let settings = await prisma.systemSettings.findFirst();

    // 如果不存在，创建默认设置
    if (!settings) {
      settings = await prisma.systemSettings.create({
        data: {
          registrationEnabled: true,
          requireWhitelist: false,
        },
      });
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/settings - 更新系统设置
export async function PATCH(request: NextRequest) {
  const { error, user: admin } = await requireAdmin();
  if (error) return error;

  try {
    const body = await request.json();
    const { 
      registrationEnabled, 
      requireWhitelist,
      siteName,
      siteDescription
    } = body;

    // 获取或创建设置
    let settings = await prisma.systemSettings.findFirst();

    if (!settings) {
      settings = await prisma.systemSettings.create({
        data: {
          registrationEnabled: true,
          requireWhitelist: false,
        },
      });
    }

    // 更新设置
    const updateData: Prisma.SystemSettingsUpdateInput = {};
    if (registrationEnabled !== undefined) updateData.registrationEnabled = registrationEnabled;
    if (requireWhitelist !== undefined) updateData.requireWhitelist = requireWhitelist;
    if (siteName !== undefined) updateData.siteName = siteName;
    if (siteDescription !== undefined) updateData.siteDescription = siteDescription;

    const updatedSettings = await prisma.systemSettings.update({
      where: { id: settings.id },
      data: updateData,
    });

    // 记录审计日志
    await prisma.auditLog.create({
      data: {
        userId: admin.id,
        action: 'SETTINGS_UPDATED',
        ipAddress: getClientIp(request),
        metadata: JSON.stringify({ 
          changes: updateData
        }),
      },
    });

    return NextResponse.json(updatedSettings);
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
