export async function register() {
  // Auto-cleanup disabled as per user request (Soft Expiration)
  /*
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initializeCronJobs } = await import('@/lib/cron');
    initializeCronJobs();
  }
  */
}
