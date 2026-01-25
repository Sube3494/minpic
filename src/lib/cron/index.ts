import cron from 'node-cron';
import { cleanupExpiredCollections } from './cleanup-collections';

export function initializeCronJobs() {
  // Run collection cleanup every hour
  cron.schedule('0 * * * *', async () => {
    console.log('[Cron] Running collection cleanup...');
    try {
      const result = await cleanupExpiredCollections();
      console.log('[Cron] Cleanup completed:', result);
    } catch (error) {
      console.error('[Cron] Cleanup failed:', error);
    }
  });

  console.log('[Cron] Collection cleanup job scheduled (every hour)');
}
