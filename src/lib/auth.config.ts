import { NextAuthConfig, DefaultSession } from 'next-auth';
import { headers } from 'next/headers';
import GitHub from 'next-auth/providers/github';
import Credentials from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import { hashEmail } from './md5';
import { prisma } from './prisma';
import { getSystemSettings } from './settings';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: string;
      status: string;
      username: string;
      avatar: string | null;
      githubId: string | null;
    } & DefaultSession['user']
  }

  interface User {
    id?: string;
    role?: string;
    status?: string;
    username?: string;
    avatar?: string | null;
    githubId?: string | null;
  }
}


export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GitHub({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
      authorization: { params: { scope: "read:user user:email", prompt: "select_account" } },
      token: process.env.GITHUB_PROXY_URL ? `${process.env.GITHUB_PROXY_URL}/github/login/oauth/access_token` : undefined,
      userinfo: process.env.GITHUB_PROXY_URL ? `${process.env.GITHUB_PROXY_URL}/api/v3/user` : undefined,
      allowDangerousEmailAccountLinking: true,
      async profile(profile, tokens) {
        let email = profile.email;
        if (!email && tokens.access_token) {
          try {
            const proxyUrl = process.env.GITHUB_PROXY_URL;
            const apiUrl = proxyUrl ? `${proxyUrl}/api/v3/user/emails` : 'https://api.github.com/user/emails';
            const res = await fetch(apiUrl, {
              headers: { Authorization: `Bearer ${tokens.access_token}` }
            });
            if (res.ok) {
              const emails = await res.json();
              const primary = emails.find((e: { primary: boolean; verified: boolean; email: string }) => e.primary && e.verified);
              if (primary) email = primary.email;
            }
          } catch (e) {
            console.error('Failed to fetch GitHub emails in profile callback:', e);
          }
        }

        return {
          id: profile.id.toString(),
          githubId: profile.id.toString(),
          username: profile.login,
          name: profile.name,
          email: email,
          role: 'USER',
          status: 'ACTIVE',
        }
      }
    }),
    Credentials({
      name: 'Credentials',
      credentials: {
        account: { label: "Username or Email", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.account || !credentials?.password) return null;

        const account = credentials.account as string;
        const password = credentials.password as string;

        // Find user by username or email
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { username: account },
              { email: account }
            ]
          }
        });

        if (!user || !user.password) return null;

        // Verify password
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) return null;

        if (user.status === 'SUSPENDED') return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          username: user.username,
          role: user.role,
          status: user.status,
          avatar: user.avatar,
          githubId: user.githubId,
        };
      }
    })
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
    async signIn({ account, profile, user }) {
      // 1. Get client IP
      const headersList = await headers();
      const forwardedFor = headersList.get('x-forwarded-for');
      let ip = forwardedFor ? forwardedFor.split(',')[0].trim() : (headersList.get('x-real-ip') || '127.0.0.1');
      if (ip === '::1') ip = '127.0.0.1';

      // 2. Check for active session (Binding Mode)
      // If user is already logged in, they will have a session cookie.
      // In this case, we allow the sign-in to proceed (NextAuth will handle the linking).
      try {
        const { cookies } = await import('next/headers'); // Dynamic import to avoid edge issues if any
        const cookieStore = await cookies();
        const hasSession = 
          cookieStore.has('authjs.session-token') || 
          cookieStore.has('__Secure-authjs.session-token') ||
          cookieStore.has('next-auth.session-token') || 
          cookieStore.has('__Secure-next-auth.session-token');
        
        if (hasSession) return true;
      } catch {
        // Ignore cookie read errors
      }

      // 3. Determine admin email
      const adminEmail = process.env.ADMIN_EMAIL;

      if (account?.provider === 'credentials') {
        if (!user) return false;
        
        // Auto-promote to ADMIN if email matches
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (user.email && adminEmail && user.email === adminEmail && (user as any).role !== 'ADMIN') {
          await prisma.user.update({
            where: { id: user.id! },
            data: { role: 'ADMIN' }
          });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (user as any).role = 'ADMIN';
        }

        // Audit log for login
        await prisma.auditLog.create({
          data: {
            userId: user.id!,
            action: 'USER_LOGIN',
            ipAddress: ip,
          }
        });

        // Update last login and avatar if missing
        await prisma.user.update({
          where: { id: user.id! },
          data: { 
            lastLoginAt: new Date(),
            ...(!user.avatar ? { avatar: `https://www.gravatar.com/avatar/${hashEmail(user.email!)}?d=404` } : {})
          }
        });

        return true;
      }

      if (account?.provider === 'github') {
        const githubId = profile?.id?.toString();
        if (!githubId) return false;

        const email = user.email; // Already resolved in profile() callback

        // Determine if this user should be admin based on email
        const shouldBeAdmin = !!(email && adminEmail && email === adminEmail);

        // Check if GitHub login is enabled in settings
        const settings = await getSystemSettings();
        if (settings && !settings.githubLoginEnabled) {
          return '/auth/error?error=GithubLoginDisabled';
        }

        // With allowDangerousEmailAccountLinking: true and the email resolved in profile(),
        // the adapter will find the existing user by email if githubId doesn't match yet.
        
        // Find existing user by githubId or email to enrich the session
        const existingUser = await prisma.user.findFirst({
          where: {
            OR: [
              { githubId },
              ...(email ? [{ email }] : [])
            ]
          }
        });

        if (existingUser) {
          if (existingUser.status === 'SUSPENDED') {
            return '/auth/error?error=AccountSuspended';
          }

          // Update profile-related info
          await prisma.user.update({
            where: { id: existingUser.id },
            data: { 
              lastLoginAt: new Date(),
              githubId, // Ensure it's linked
              role: shouldBeAdmin ? 'ADMIN' : undefined // Promote if adminEmail matches
            }
          });

          // Session enrichment - database info takes priority
          user.id = existingUser.id;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (user as any).role = shouldBeAdmin ? 'ADMIN' : existingUser.role;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (user as any).status = existingUser.status;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (user as any).username = existingUser.username;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (user as any).githubId = githubId;

          await prisma.auditLog.create({
            data: {
              userId: existingUser.id,
              action: 'USER_LOGIN',
              ipAddress: ip,
            }
          });

          return true;
        }

        // If no user found, redirect to registration page with email pre-filled
        const params = new URLSearchParams();
        params.set('authMode', 'register');
        if (email) params.set('email', email);
        
        return `/auth/signin?${params.toString()}`;
      }

      return false;
    },
    
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        token.role = (user as any).role;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        token.status = (user as any).status;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        token.username = (user as any).username;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        token.avatar = (user as any).avatar;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        token.githubId = (user as any).githubId;
        token.email = user.email;

        // Gravatar Fallback
        if (!token.avatar && token.email) {
          const hash = hashEmail(token.email);
          token.avatar = `https://www.gravatar.com/avatar/${hash}?d=404`;
        }

        // Double check admin status by email as a fail-safe
        const adminEmail = process.env.ADMIN_EMAIL;
        if (token.email && adminEmail && token.email === adminEmail) {
          token.role = 'ADMIN';
        }
      }

      // Handle session updates (e.g. profiling updates)
      if (trigger === "update" && session) {
        token.username = session.user.username;
        token.avatar = session.user.avatar;
      }

      return token;
    },
    
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.status = token.status as string;
        session.user.username = token.username as string;
        session.user.avatar = token.avatar as string;
        session.user.image = token.avatar as string; // Sync standard image field
        session.user.githubId = token.githubId as string;
        session.user.email = token.email as string;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      // Allows relative callback URLs
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      // Allows callback URLs on the same origin
      else if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    }
  },
  events: {
    async linkAccount({ user, account }) {
      // Ensure githubId is synced to User table when account is linked
      if (account.provider === 'github' && account.providerAccountId && user.id) {
        await prisma.user.update({
          where: { id: user.id },
          data: { githubId: account.providerAccountId }
        });
      }
    },
    async createUser({ user }) {
      // Sync lastLoginAt for newly created users
      if (user.id) {
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() }
        });
      }
    }
  },
};
