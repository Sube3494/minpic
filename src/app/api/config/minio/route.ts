import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import { MinioConfigItem } from '@/types/config';

export async function GET() {
  const { error, user } = await requireAuth();
  if (error) return error;

  try {
    // 获取用户的所有 MinIO 配置
    const configs = await prisma.config.findMany({
      where: {
        userId: user.id,
        key: { startsWith: 'minio_' },
        NOT: {
          key: { in: ['minio_active_id', 'minio_configs'] }
        }
      },
      orderBy: { updatedAt: 'desc' },
    });

    // 解析配置
    const parsedConfigs = configs.map(c => JSON.parse(c.value));

    // 获取活动配置 ID（如果有）
    const activeConfig = await prisma.config.findUnique({
      where: {
        userId_key: { userId: user.id, key: 'minio_active_id' }
      }
    });

    const activeId = activeConfig?.value ?? (parsedConfigs[0]?.id || '');

    return NextResponse.json({ configs: parsedConfigs, activeId });
  } catch (error) {
    console.error('[MinIO Config GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get config' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const { error, user } = await requireAuth();
  if (error) return error;

  try {
    const body = await request.json();
    const { configs, activeId } = body;

    if (!Array.isArray(configs)) {
      console.error('[MinIO Config POST] Configs is not an array:', typeof configs);
      return NextResponse.json(
        { error: 'Invalid config format: configs must be an array' },
        { status: 400 }
      );
    }

    if (configs.length === 0) {
      // If configs is empty, we just delete everything (handled below) and return
    }

    // 验证 activeId 存在于 configs 中
    if (activeId && configs.length > 0) {
      const found = configs.find((c: MinioConfigItem) => c.id === activeId);
      if (!found) {
        return NextResponse.json(
          { error: 'Active config not found in configs array' },
          { status: 400 }
        );
      }
    }

    // 删除用户的所有旧配置
    await prisma.config.deleteMany({
      where: {
        userId: user.id,
        key: { startsWith: 'minio_' },
      }
    });

    if (configs.length === 0) {
        return NextResponse.json({ success: true });
    }

    // Keep delete counts out of logs for cleaner production environment

    // 为每个配置创建独立的记录
    const createResults = [];
    for (const config of configs) {
      try {
        const created = await prisma.config.create({
          data: {
            userId: user.id,
            key: `minio_${config.id}`,
            value: JSON.stringify(config),
          }
        });
        createResults.push(created);
      } catch (err) {
        console.error('[MinIO Config POST] Failed to create config:', config.id, err);
        throw err;
      }
    }

    // 保存活动配置 ID
    const finalActiveId = activeId ?? (configs[0]?.id || '');
    await prisma.config.create({
      data: {
        userId: user.id,
        key: 'minio_active_id',
        value: finalActiveId
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[MinIO Config POST] Error:', error);
    return NextResponse.json(
      { error: 'Failed to save config', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
