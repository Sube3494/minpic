/*
 * @Date: 2026-01-31 22:21:13
 * @Author: Sube
 * @FilePath: route.ts
 * @LastEditTime: 2026-01-31 22:35:04
 * @Description: 
 */
import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { encryptBackup } from '@/lib/backup-encryption';
import { serializeBigInt } from '@/lib/utils';

export async function GET(req: NextRequest) {
  const session = await auth();
  const { searchParams } = new URL(req.url);
  const password = searchParams.get('pwd');
  
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [
      users,
      accounts,
      systemSettings,
      registrationWhitelist,
      configs,
      files,
      teams,
      teamMembers,
      inviteCodes,
      collections,
      collectionItems
    ] = await Promise.all([
      prisma.user.findMany(),
      prisma.account.findMany(),
      prisma.systemSettings.findFirst(),
      prisma.registrationWhitelist.findMany(),
      prisma.config.findMany(),
      prisma.file.findMany(),
      prisma.team.findMany(),
      prisma.teamMember.findMany(),
      prisma.inviteCode.findMany(),
      prisma.collection.findMany(),
      prisma.collectionItem.findMany(),
    ]);

    const data = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      backup: {
        users,
        accounts,
        systemSettings,
        registrationWhitelist,
        configs,
        files,
        teams,
        teamMembers,
        inviteCodes,
        collections,
        collectionItems,
      }
    };

    const now = new Date();
    const dateStr = now.getFullYear().toString() + 
                   (now.getMonth() + 1).toString().padStart(2, '0') + 
                   now.getDate().toString().padStart(2, '0');
    const timeStr = now.getHours().toString().padStart(2, '0') + 
                   now.getMinutes().toString().padStart(2, '0') + 
                   now.getSeconds().toString().padStart(2, '0');
    const fileName = `minpic-backup-${dateStr}-${timeStr}.json`;
    let finalData = JSON.stringify(serializeBigInt(data));

    // 如果提供了密码，则加密
    if (password) {
      const encrypted = await encryptBackup(finalData, password);
      finalData = JSON.stringify(encrypted);
    }

    return new NextResponse(finalData, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: unknown) {
    console.error('[Backup Export Error]:', error);
    const message = error instanceof Error ? error.message : '未知错误';
    return NextResponse.json({ error: '导出失败: ' + message }, { status: 500 });
  }
}
