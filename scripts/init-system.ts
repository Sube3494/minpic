import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const prisma = new PrismaClient();

async function main() {
  console.log('开始初始化多用户系统...\n');
  
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    console.error('错误: 请在 .env 中设置 ADMIN_EMAIL');
    process.exit(1);
  }
  
  // 1. 创建或更新系统设置
  console.log('1. 初始化系统设置...');
  const settings = await prisma.systemSettings.upsert({
    where: { id: 'default' },
    update: {
      registrationEnabled: true,  // 开启注册
      requireWhitelist: false,    // 暂时关闭白名单要求
    },
    create: {
      id: 'default',
      registrationEnabled: true,
      requireWhitelist: false,
    }
  });
  console.log('✓ 系统设置已初始化');
  console.log(`  - 注册开关: ${settings.registrationEnabled ? '开启' : '关闭'}`);
  console.log(`  - 白名单要求: ${settings.requireWhitelist ? '需要' : '不需要'}\n`);
  
  // 2. 检查管理员是否已存在
  console.log('2. 检查管理员账户...');
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail }
  });
  
  if (existingAdmin) {
    console.log(`✓ 管理员账户已存在: ${existingAdmin.username || existingAdmin.email}`);
    
    // 确保是 ADMIN 角色
    if (existingAdmin.role !== 'ADMIN') {
      await prisma.user.update({
        where: { id: existingAdmin.id },
        data: { role: 'ADMIN' }
      });
      console.log('✓ 已将用户角色更新为 ADMIN\n');
    }
  } else {
    console.log('ℹ 管理员账户尚未创建');
    console.log('  请使用 GitHub 或账号密码登录，系统会自动将您设置为管理员\n');
  }
  
  console.log('初始化完成！');
  console.log('\n下一步:');
  console.log('1. 访问 http://localhost:3000');
  console.log('2. 点击"立即登录"');
  console.log('3. 使用管理员邮箱登录/注册');
  console.log('4. 系统会自动识别管理员权限');
}

main()
  .catch((error) => {
    console.error('初始化失败:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
