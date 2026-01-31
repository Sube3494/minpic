import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

interface BackupData {
  systemSettings?: Prisma.SystemSettingsCreateInput | Prisma.SystemSettingsCreateInput[];
  users?: Prisma.UserCreateManyInput[];
  accounts?: Prisma.AccountCreateManyInput[];
  teams?: Prisma.TeamCreateManyInput[];
  teamMembers?: Prisma.TeamMemberCreateManyInput[];
  inviteCodes?: Prisma.InviteCodeCreateManyInput[];
  configs?: Prisma.ConfigCreateManyInput[];
  files?: Prisma.FileCreateManyInput[];
  collections?: Prisma.CollectionCreateManyInput[];
  collectionItems?: Prisma.CollectionItemCreateManyInput[];
  registrationWhitelist?: Prisma.RegistrationWhitelistCreateManyInput[];
}

export async function POST(req: Request) {
  const session = await auth();
  const userCount = await prisma.user.count();
  
  // 仅在系统为空，或者当前用户是管理员时允许操作
  if (userCount > 0 && (!session || session.user.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const data = await req.json() as { backup: unknown };
    if (!data.backup) {
      throw new Error('无效的备份文件');
    }

    const { backup } = data;

    // 递归助手：还原 BigInt
    const deserialize = (obj: unknown): unknown => {
      if (obj === null || typeof obj !== 'object') return obj;
      
      if (Array.isArray(obj)) {
        return (obj as unknown[]).map((v: unknown) => deserialize(v));
      }
      
      const record = obj as Record<string, unknown>;
      if ('__bigint' in record && typeof record.__bigint === 'string') {
        return BigInt(record.__bigint);
      }
      
      const newObj: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(record)) {
        newObj[key] = deserialize(value);
      }
      return newObj;
    };

    const restoredBackup = deserialize(backup) as BackupData;

    // 使用事务确保原子性
    await prisma.$transaction(async (tx) => {
      // 1. 按顺序删除所有数据（从叶子节点到根节点）
      await tx.collectionItem.deleteMany();
      await tx.collection.deleteMany();
      await tx.file.deleteMany();
      await tx.config.deleteMany();
      await tx.inviteCode.deleteMany();
      await tx.teamMember.deleteMany();
      await tx.team.deleteMany();
      await tx.account.deleteMany();
      await tx.session.deleteMany();
      await tx.auditLog.deleteMany();
      await tx.user.deleteMany();
      await tx.systemSettings.deleteMany();
      await tx.registrationWhitelist.deleteMany();
      await tx.verificationToken.deleteMany();

      // 2. 按顺序恢复数据（从根节点到叶子节点）
      
      // 系统设置
      if (restoredBackup.systemSettings) {
        // 由于存在 @updatedAt，create 会自动处理时间戳
        // 如果备份中只有一个对象而非数组
        const settings = Array.isArray(restoredBackup.systemSettings) 
          ? restoredBackup.systemSettings[0] 
          : restoredBackup.systemSettings;
        if (settings) {
          await tx.systemSettings.create({ data: settings });
        }
      }

      // 用户
      if (restoredBackup.users?.length) {
        await tx.user.createMany({ data: restoredBackup.users });
      }

      // 账号授权
      if (restoredBackup.accounts?.length) {
        await tx.account.createMany({ data: restoredBackup.accounts });
      }

      // 团队
      if (restoredBackup.teams?.length) {
        await tx.team.createMany({ data: restoredBackup.teams });
      }

      // 团队成员
      if (restoredBackup.teamMembers?.length) {
        await tx.teamMember.createMany({ data: restoredBackup.teamMembers });
      }

      // 邀请码
      if (restoredBackup.inviteCodes?.length) {
        await tx.inviteCode.createMany({ data: restoredBackup.inviteCodes });
      }

      // 存储配置
      if (restoredBackup.configs?.length) {
        await tx.config.createMany({ data: restoredBackup.configs });
      }

      // 文件
      if (restoredBackup.files?.length) {
        // 分批处理，防止文件数过多导致 pg 变量上限错误 (max 65535)
        const batchSize = 1000;
        for (let i = 0; i < restoredBackup.files.length; i += batchSize) {
          await tx.file.createMany({ 
            data: restoredBackup.files.slice(i, i + batchSize) 
          });
        }
      }

      // 收藏夹
      if (restoredBackup.collections?.length) {
        await tx.collection.createMany({ data: restoredBackup.collections });
      }

      // 收藏夹项
      if (restoredBackup.collectionItems?.length) {
        await tx.collectionItem.createMany({ data: restoredBackup.collectionItems });
      }

      // 白名单
      if (restoredBackup.registrationWhitelist?.length) {
        await tx.registrationWhitelist.createMany({ data: restoredBackup.registrationWhitelist });
      }
    }, {
      timeout: 30000 // 增加超时时间到 30秒，因为涉及全量数据操作
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('[Backup Import Error]:', error);
    const message = error instanceof Error ? error.message : '未知错误';
    return NextResponse.json({ error: '还原失败: ' + message }, { status: 500 });
  }
}
