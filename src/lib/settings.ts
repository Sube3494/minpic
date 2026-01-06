/*
 * @Date: 2026-01-07 00:22:33
 * @Author: Sube
 * @FilePath: settings.ts
 * @LastEditTime: 2026-01-07 00:24:12
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
      return await prisma.systemSettings.upsert({
        where: { id: 'default' },
        update: {},
        create: {
          id: 'default',
          registrationEnabled: true,
          requireWhitelist: false,
          siteName: 'MinPic',
          githubLoginEnabled: true,
          uploadRateLimit: 100,
        },
      });
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
      siteDescription: '简单好用的图床系统',
      githubLoginEnabled: true,
      uploadRateLimit: 100,
      updatedAt: new Date(),
    };
  }
}
