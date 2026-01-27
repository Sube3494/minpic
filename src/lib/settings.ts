/*
 * @Date: 2026-01-07 00:22:33
 * @Author: Sube
 * @FilePath: settings.ts
 * @LastEditTime: 2026-01-07 02:08:02
 * @Description: 
 */
import { prisma } from './prisma';

// 共享 Promise 锁，确保并发请求下初始化逻辑只运行一次
const globalForSettings = globalThis as unknown as {
  settingsInitPromise: Promise<any> | undefined; // eslint-disable-line @typescript-eslint/no-explicit-any
};

/**
 * 清除系统设置缓存，强制下次请求重新从数据库加载
 */
export function clearSettingsCache() {
  globalForSettings.settingsInitPromise = undefined;
}

/**
 * 获取系统设置，如果不存在则自动初始化默认设置
 * 替代了之前手动运行 init-system.ts 的步骤
 */
export async function getSystemSettings() {
  if (globalForSettings.settingsInitPromise) {
    return globalForSettings.settingsInitPromise;
  }

  globalForSettings.settingsInitPromise = (async () => {
    try {
      // 1. 确保数据库本身已创建
      // 只有在 Node.js 运行时才执行（Middleware 是 Edge 运行时，不支持 child_process 等模块）
      if (process.env.NEXT_RUNTIME === 'nodejs') {
        const { ensureDatabaseExists } = await import('./db-setup');
        await ensureDatabaseExists();
      }
      
      const settings = await prisma.systemSettings.findFirst();
      
      if (!settings) {
        console.log('检测到系统配置缺失，正在自动初始化默认设置...');
        try {
          return await prisma.systemSettings.upsert({
            where: { id: 'default' },
            update: {},
            create: {
              id: 'default',
              registrationEnabled: true,
              requireWhitelist: false,
              siteName: 'MinPic',
              siteDescription: '体验对数字资产的 **极致掌控**\n无缝集成 MinIO 对象存储与自定义短链服务',
              githubLoginEnabled: true,
              uploadRateLimit: 100,
            },
          });
        } catch (upsertError: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
          // 如果是因为并发导致唯一键冲突(P2002)，说明另一个请求已经创建好了，直接再次查询即可
          if (upsertError?.code === 'P2002') {
            return await prisma.systemSettings.findFirst();
          }
          throw upsertError;
        }
      }
      
      return settings;
    } catch (error) {
      console.error('获取系统设置失败:', error);
      // 发生严重错误时重置锁，允许下次请求重试
      globalForSettings.settingsInitPromise = undefined;
      
      // 返回一个硬编码的默认对象，防止应用因数据库错误彻底崩溃
      return {
        id: 'default',
        registrationEnabled: true,
        requireWhitelist: false,
        siteName: 'MinPic',
        siteDescription: '体验对数字资产的 **极致掌控**\n无缝集成 MinIO 对象存储与自定义短链服务',
        githubLoginEnabled: true,
        uploadRateLimit: 100,
        updatedAt: new Date(),
      };
    }
  })();

  return globalForSettings.settingsInitPromise;
}
