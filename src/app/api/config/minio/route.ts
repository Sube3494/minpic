import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MinioConfig } from '@/lib/minio';

// Extended config with ID and name for UI management
interface MinioConfigItem extends MinioConfig {
  id: string;
  name: string;
}

export async function GET() {
  try {
    const [configListRes, activeIdRes, defaultRes] = await Promise.all([
      prisma.config.findUnique({ where: { key: 'minio_configs' } }),
      prisma.config.findUnique({ where: { key: 'minio_active_id' } }),
      prisma.config.findUnique({ where: { key: 'minio_default' } }),
    ]);

    let configs: MinioConfigItem[] = [];
    let activeId = '';

    if (configListRes && configListRes.value) {
      configs = JSON.parse(configListRes.value);

      // Fix: Check if activeId record exists, otherwise fallback to first config
      // We must allow empty string (deactivated state) if the record exists
      if (activeIdRes) {
        activeId = activeIdRes.value;
      } else {
        activeId = configs[0]?.id || '';
      }
    } else if (defaultRes && defaultRes.value) {
      // Migration: Create list from single default config
      const defaultConfig = JSON.parse(defaultRes.value);
      const newId = 'default-' + Date.now();
      configs = [{
        ...defaultConfig,
        id: newId,
        name: 'Default MinIO',
      }];
      activeId = newId;
    }

    return NextResponse.json({ configs, activeId });
  } catch (error) {
    console.error('Error getting MinIO config:', error);
    return NextResponse.json(
      { error: 'Failed to get config' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { configs, activeId } = body;

    console.log('Received MinIO config save request:', {
      configsCount: Array.isArray(configs) ? configs.length : 'not array',
      activeId,
      firstConfig: configs?.[0],
    });

    if (!Array.isArray(configs)) {
       console.error('Validation failed:', { 
         isArray: Array.isArray(configs), 
         configsLength: configs?.length,
         activeId,
       });
       return NextResponse.json(
        { error: 'Invalid config format' },
        { status: 400 }
      );
    }

    // If activeId is provided, validate it exists in configs
    if (activeId && !configs.find((c: MinioConfigItem) => c.id === activeId)) {
      console.error('Active ID not found in configs:', { activeId, configIds: configs.map((c: MinioConfigItem) => c.id) });
      return NextResponse.json(
        { error: 'Active config not found' },
        { status: 400 }
      );
    }

    // Use activeId as is (can be empty string if no config is active)
    const finalActiveId = activeId || '';

    // Save list and active ID
    await Promise.all([
      prisma.config.upsert({
        where: { key: 'minio_configs' },
        update: { value: JSON.stringify(configs) },
        create: { key: 'minio_configs', value: JSON.stringify(configs) },
      }),
      prisma.config.upsert({
        where: { key: 'minio_active_id' },
        update: { value: finalActiveId },
        create: { key: 'minio_active_id', value: finalActiveId },
      }),
    ]);

    // Sync active config to minio_default for compatibility
    const activeConfig = configs.find((c: MinioConfigItem) => c.id === finalActiveId);
    if (activeConfig) {
      // Remove UI-only fields before saving to default
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, name, ...serviceConfig } = activeConfig;
      const configValue = JSON.stringify(serviceConfig);
      
      await prisma.config.upsert({
        where: { key: 'minio_default' },
        update: { value: configValue },
        create: { key: 'minio_default', value: configValue },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving MinIO config:', error);
    return NextResponse.json(
      { error: 'Failed to save config' },
      { status: 500 }
    );
  }
}
