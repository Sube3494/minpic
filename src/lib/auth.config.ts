import { NextAuthConfig, DefaultSession } from 'next-auth';
import { headers } from 'next/headers';
import GitHub from 'next-auth/providers/github';
import Credentials from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import { hashEmail } from './md5';
import { prisma } from './prisma';

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

interface GithubProfile {
  id: number;
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
      token: process.env.GITHUB_PROXY_URL ? `${process.env.GITHUB_PROXY_URL}/github/login/oauth/access_token` : undefined,
      userinfo: process.env.GITHUB_PROXY_URL ? `${process.env.GITHUB_PROXY_URL}/api/v3/user` : undefined,
      allowDangerousEmailAccountLinking: true,
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

      // 2. Determine admin email
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

        const ghProfile = profile as unknown as GithubProfile;
        let email = ghProfile.email;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let emails: any[] = [];
        
        // Fetch emails from GitHub API to handle private emails and check for admin
        if (account?.access_token) {
           try {
             const proxyUrl = process.env.GITHUB_PROXY_URL;
             const apiUrl = proxyUrl ? `${proxyUrl}/api/v3/user/emails` : 'https://api.github.com/user/emails';
             const res = await fetch(apiUrl, {
               headers: { Authorization: `Bearer ${account.access_token}` }
             });
             if (res.ok) {
               emails = await res.json();
                // If profile.email is null, try to find primary
                if (!email) {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const primary = emails.find((e: any) => e.primary && e.verified);
                  if (primary) email = primary.email;
                }
             }
           } catch (e) { console.error('Failed to fetch GitHub emails:', e); }
        }

        // Determine admin status
        let shouldBeAdmin = false;
        if (adminEmail) {
           // Check profile email
           if (email === adminEmail) shouldBeAdmin = true;
           // Check fetched verified emails
           // eslint-disable-next-line @typescript-eslint/no-explicit-any
           else if (emails.some((e: any) => e.email === adminEmail && e.verified)) {
             shouldBeAdmin = true;
           }
        }

        // Check if GitHub login is enabled in settings
        const settings = await prisma.systemSettings.findFirst();
        if (settings && !settings.githubLoginEnabled) {
          return '/auth/error?error=GithubLoginDisabled';
        }
        
        // Find by GitHub ID or Email (using the resolved email)
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

          const needsRoleUpdate = shouldBeAdmin && existingUser.role !== 'ADMIN';
          const shouldDemote = !shouldBeAdmin && existingUser.role === 'ADMIN';
          
          if (needsRoleUpdate) {
            await prisma.user.update({
              where: { id: existingUser.id },
               data: { role: 'ADMIN' }
             });
             // eslint-disable-next-line @typescript-eslint/no-explicit-any
             (user as any).role = 'ADMIN';
           } else if (shouldDemote) {
              await prisma.user.update({
               where: { id: existingUser.id },
               data: { role: 'USER' }
             });
             // eslint-disable-next-line @typescript-eslint/no-explicit-any
             (user as any).role = 'USER';
           }
          
          await prisma.user.update({
            where: { id: existingUser.id },
            data: { 
              lastLoginAt: new Date(),
              avatar: ghProfile.avatar_url,
              githubId, // Ensure githubId is linked
              ...(email ? { email } : {}) // Update email if we found a better one
            }
          });

          // Ensure Account link exists (for manual handling or cases where only email matched)
           const existingAccount = await prisma.account.findUnique({
            where: {
              provider_providerAccountId: {
                provider: 'github',
                providerAccountId: githubId
              }
            }
          });

          if (!existingAccount) {
             await prisma.account.create({
              data: {
                userId: existingUser.id,
                type: account.type,
                provider: account.provider,
                providerAccountId: githubId,
                refresh_token: account.refresh_token,
                access_token: account.access_token,
                expires_at: account.expires_at,
                token_type: account.token_type,
                scope: account.scope,
                id_token: account.id_token,
                session_state: account.session_state as string,
              }
            });
          }

          await prisma.auditLog.create({
            data: {
              userId: existingUser.id,
              action: 'USER_LOGIN',
              ipAddress: ip,
            }
          });

          return true;
        }

        // New User Registration Checks
        const registrationEnabled = settings?.registrationEnabled ?? true;
        if (!shouldBeAdmin && !registrationEnabled) {
          return '/auth/error?error=RegistrationClosed';
        }

        // Whitelist check
        if (!shouldBeAdmin && settings?.requireWhitelist) {
          const whitelistEntry = await prisma.registrationWhitelist.findFirst({
            where: {
              OR: [
                { githubId },
                ...(email ? [{ email }] : []),
                // Also check all verified emails from GitHub against whitelist
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ...emails.filter((e: any) => e.verified).map((e: any) => ({ email: e.email }))
              ]
            }
          });

          if (!whitelistEntry || whitelistEntry.used) {
            return '/auth/error?error=NotWhitelisted';
          }

          await prisma.registrationWhitelist.update({
            where: { id: whitelistEntry.id },
            data: { used: true, usedAt: new Date() }
          });
        }

        // Manually create new GitHub user and Account
        // This ensures email and proper role are set immediately
        const newUser = await prisma.user.create({
          data: {
            githubId,
            username: ghProfile.login,
            name: ghProfile.name,
            email: email, // Use resolved email
            avatar: ghProfile.avatar_url,
            role: shouldBeAdmin ? 'ADMIN' : 'USER',
            status: 'ACTIVE',
            lastLoginAt: new Date(),
            accounts: {
              create: {
                type: account.type,
                provider: account.provider,
                providerAccountId: githubId,
                refresh_token: account.refresh_token,
                access_token: account.access_token,
                expires_at: account.expires_at,
                token_type: account.token_type,
                scope: account.scope,
                id_token: account.id_token,
                session_state: account.session_state as string,
              }
            }
          }
        });

        await prisma.auditLog.create({
            data: {
              userId: newUser.id,
              action: 'USER_CREATED',
              metadata: JSON.stringify({ githubId, username: ghProfile.login, provider: 'github' }),
              ipAddress: ip,
            }
        });

        return true;
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
    }
  },
};
