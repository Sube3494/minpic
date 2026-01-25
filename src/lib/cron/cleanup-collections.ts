import { prisma } from '@/lib/prisma';

export async function cleanupExpiredCollections() {
  const now = new Date();
  
  try {
    // Find expired collections
    const expired = await prisma.collection.findMany({
      where: {
        expiresAt: {
          lte: now,
        },
      },
      select: { id: true },
    });

    if (expired.length > 0) {
      // Delete collections (cascade will delete CollectionItems)
      await prisma.collection.deleteMany({
        where: {
          id: { in: expired.map((c) => c.id) },
        },
      });

      console.log(`[Cleanup] Deleted ${expired.length} expired collections`);
    }

    return { deleted: expired.length };
  } catch (error) {
    console.error('[Cleanup] Error cleaning up expired collections:', error);
    throw error;
  }
}
