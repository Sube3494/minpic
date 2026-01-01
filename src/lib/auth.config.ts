import { NextAuthConfig, DefaultSession } from 'next-auth';
import { headers } from 'next/headers';
import GitHub from 'next-auth/providers/github';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from './prisma';
import type { User as PrismaUser } from '@prisma/client';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: string;
      status: string;
      username: string;
      avatar: string;
      githubId: string;  // 新增
    } & DefaultSession['user']
  }
}

interface GithubProfile {
  login: string;
  name: string;
  email: string;
  avatar_url: string;
}

export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GitHub({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
      authorization: { params: { scope: "read:user user:email", prompt: "select_account" } },
      allowDangerousEmailAccountLinking: true,  // 允许邮箱账号关联
      profile(profile) {
        return {
          id: profile.id.toString(),
          githubId: profile.id.toString(),
          username: profile.login,
          name: profile.name,
          email: profile.email,
          avatar: profile.avatar_url,
          role: 'USER',
          status: 'ACTIVE',
        };
      },
    }),
  ],
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== 'github') return false;
      
      const githubId = profile?.id?.toString();
      if (!githubId) return false;

      // Get client IP
      const headersList = await headers();
      const forwardedFor = headersList.get('x-forwarded-for');
      let ip = forwardedFor ? forwardedFor.split(',')[0].trim() : (headersList.get('x-real-ip') || '127.0.0.1');
      if (ip === '::1') ip = '127.0.0.1';
      
      // Default fallback settings for fresh/reset databases
      const DEFAULT_SETTINGS = {
        registrationEnabled: true,
        requireWhitelist: false,
        defaultStorageQuota: BigInt(5368709120), // 5GB
        defaultFileQuota: 10000,
      };

      // Check if user exists
      const existingUser = await prisma.user.findUnique({
        where: { githubId }
      });
      
      if (existingUser) {
        // Check user status

        if (existingUser.status === 'SUSPENDED') {
          return '/auth/error?error=AccountSuspended';
        }
        
        // Check if user should be upgraded to admin
        const shouldBeAdmin = process.env.ADMIN_GITHUB_ID === githubId;
        const needsRoleUpdate = shouldBeAdmin && existingUser.role !== 'ADMIN';
        
        // Update last login and role if needed
        await prisma.user.update({
          where: { id: existingUser.id },
          data: { 
            lastLoginAt: new Date(),
            ...(needsRoleUpdate && { role: 'ADMIN' })
          }
        });
        
        // Log audit
        await prisma.auditLog.create({
          data: {
            userId: existingUser.id,
            action: 'USER_LOGIN',
            ipAddress: ip,
          }
        });
        
        return true;
      }
      
      // Pre-check if user should be admin
      const isAdmin = process.env.ADMIN_GITHUB_ID === githubId;
      
      // Get system settings with default fallback
      const dbSettings = await prisma.systemSettings.findFirst();
      const settings = dbSettings || DEFAULT_SETTINGS;
      
      // If user is admin, allow bypass registration checks (crucial for first setup/reset)
      if (!isAdmin) {
        // Check if registration is enabled
        if (!settings.registrationEnabled) {
          return '/auth/error?error=RegistrationClosed';
        }
        
        // Check whitelist
        if (settings.requireWhitelist) {
          const whitelistEntry = await prisma.registrationWhitelist.findUnique({
            where: { githubId }
          });
          
          if (!whitelistEntry || whitelistEntry.used) {
            return '/auth/error?error=NotWhitelisted';
          }
          
          // Mark whitelist as used
          await prisma.registrationWhitelist.update({
            where: { githubId },
            data: { 
              used: true,
              usedAt: new Date()
            }
          });
        }
      }
      
      const ghProfile = profile as unknown as GithubProfile;
      
      // Create new user
      const newUser = await prisma.user.create({
        data: {
          githubId,
          username: ghProfile.login,
          name: ghProfile.name,
          email: ghProfile.email,
          avatar: ghProfile.avatar_url,
          role: isAdmin ? 'ADMIN' : 'USER',
          status: 'ACTIVE',
          storageQuota: settings.defaultStorageQuota,
          fileQuota: settings.defaultFileQuota,
          lastLoginAt: new Date(),
        }
      });
      
      // Log audit
      await prisma.auditLog.create({
        data: {
          userId: newUser.id,
          action: 'USER_CREATED',
          metadata: JSON.stringify({ githubId, username: ghProfile.login }),
          ipAddress: ip,
        }
      });
      
      return true;
    },
    
    async jwt({ token, user }) {
      if (user) {
        const prismaUser = user as unknown as PrismaUser;
        const dbUser = await prisma.user.findUnique({
          where: { githubId: prismaUser.githubId }
        });
        
        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role;
          token.status = dbUser.status;
          token.username = dbUser.username;
          token.avatar = dbUser.avatar;
          token.githubId = dbUser.githubId;  // 新增
        }
      }
      return token;
    },
    
    async session({ session, token }) {
      if (session.user) {
        const user = session.user as unknown as PrismaUser & { image?: string | null };
        user.id = token.id as string;
        user.role = token.role as string;
        user.status = token.status as string;
        user.username = token.username as string;
        user.image = token.avatar as string;
        user.avatar = token.avatar as string;
        user.githubId = token.githubId as string;  // 新增
      }
      return session;
    }
  },
};
