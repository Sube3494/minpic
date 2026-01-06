/*
 * @Date: 2026-01-07 00:22:33
 * @Author: Sube
 * @FilePath: settings.ts
 * @LastEditTime: 2026-01-07 00:36:25
 * @Description: 
 */
import { prisma } from './prisma';

/**
 * 获取系统设置，如果不存在则自动初始化默认设置
 * 替代了之前手动运行 init-system.ts 的步骤
 */
export async function getSystemSettings() {
  try {
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
      } catch (upsertError: unknown) {
        // 如果是因为并发导致唯一键冲突(P2002)，说明另一个请求已经创建好了，直接再次查询即可
        if (upsertError && typeof upsertError === 'object' && 'code' in upsertError && upsertError.code === 'P2002') {
          return await prisma.systemSettings.findFirst() || {
            id: 'default',
            registrationEnabled: true,
            requireWhitelist: false,
            siteName: 'MinPic',
            siteDescription: '简单好用的图床系统',
            githubLoginEnabled: true,
            uploadRateLimit: 100,
            updatedAt: new Date(),
          };
        }
        throw upsertError;
      }
    }
    
    return settings;
  } catch (error) {
    console.error('获取系统设置失败:', error);
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
}
