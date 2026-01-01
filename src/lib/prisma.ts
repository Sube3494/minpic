/*
 * @Date: 2025-12-24 21:33:08
 * @Author: Sube
 * @FilePath: prisma.ts
 * @LastEditTime: 2026-01-02 01:59:44
 * @Description: 
 */
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
// Re-triggering IDE type re-evaluation
