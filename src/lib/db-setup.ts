import { Client } from 'pg';

// Prevent multiple concurrent initializations in development/multi-RSC environment
const globalForDbSetup = globalThis as unknown as {
  initPromise: Promise<void> | undefined;
};

/**
 * Ensures that the database specified in the DATABASE_URL exists.
 * If not, it connects to the default 'postgres' database and creates it.
 */
export async function ensureDatabaseExists() {
  // Use a shared promise to ensure all concurrent callers wait for the same setup process
  if (globalForDbSetup.initPromise) {
    return globalForDbSetup.initPromise;
  }

  globalForDbSetup.initPromise = (async () => {
    let needsSchemaSync = false;

    try {
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) return;

      // Parse the connection string
      // Format: postgresql://user:password@host:port/dbname
      const regex = /postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/;
      const match = databaseUrl.match(regex);
      if (!match) return;

      const [, user, password, host, port, dbName] = match;

      // 1. Connection Pre-check
      const targetClient = new Client({
        connectionString: databaseUrl,
        connectionTimeoutMillis: 5000,
      });

      try {
        await targetClient.connect();
        
        const tableCheck = await targetClient.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'system_settings'
          );
        `);
        
        if (!tableCheck.rows[0].exists) {
          needsSchemaSync = true;
        }
        
        await targetClient.end();
      } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
        if (error.code === '3D000' || error.message.includes('does not exist')) {
          console.log(`[Database] 库 "${dbName}" 不存在，准备进入合规创建流程...`);
          
          const systemUrl = `postgresql://${user}:${password}@${host}:${port}/postgres`;
          const systemClient = new Client({ connectionString: systemUrl });

          try {
            await systemClient.connect();
            await systemClient.query(`CREATE DATABASE "${dbName}"`);
            console.log(`[Database] 库 "${dbName}" 创建成功。`);
            needsSchemaSync = true;
          } catch (createError: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
            if (createError.code === '23505' || createError.message.includes('already exists')) {
              needsSchemaSync = true;
            } else {
              throw createError;
            }
          } finally {
            await systemClient.end();
          }
        } else {
          throw error;
        }
      }

      // 2. Schema Synchronization (Programmatic CLI Call)
      if (needsSchemaSync) {
        try {
          console.log('[Database] 正在通过程序接口同步表结构 (db push)...');
          
          // 动态加载执行需要的模块，防止 Edge Runtime 扫描报错
          const { spawnSync } = await import('child_process');
          const path = await import('path');
          const fs = await import('fs');
          
          // 自动寻址 Prisma CLI: 
          // 1. 优先检查全局 PATH 中的 prisma 命令 (Docker 环境常见)
          // 2. 备选检查本地 node_modules
          let prismaCmd = 'prisma';
          let args = ['db', 'push', '--skip-generate'];
          let useNode = false;

          const localPrismaPath = path.resolve(process.cwd(), 'node_modules/prisma/build/index.js');
          if (fs.existsSync(localPrismaPath)) {
            prismaCmd = process.execPath;
            args = [localPrismaPath, 'db', 'push', '--skip-generate'];
            useNode = true;
          }

          const result = spawnSync(prismaCmd, args, {
            stdio: 'inherit',
            env: process.env,
            shell: !useNode && process.platform === 'win32' // 仅在非 node 直调且为 Windows 时开启 shell
          });

          if (result.status === 0) {
            console.log('[Database] 数据表同步完成。');
          } else {
            console.warn('[Database] 同步过程被系统中断或执行失败，可能需要手动运行: npx prisma db push');
          }
        } catch (syncError: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
          console.error('[Database] 同步逻辑执行异常:', syncError.message);
        }
      }
    } catch (topLevelError: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      console.error('[Database] 自动化流程故障:', topLevelError.message);
      // Reset promise on failure to allow retry if needed, though typically fatal during startup
      globalForDbSetup.initPromise = undefined;
      throw topLevelError;
    }
  })();

  return globalForDbSetup.initPromise;
}
