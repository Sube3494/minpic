import { auth } from './auth';
import { NextResponse } from 'next/server';
import { hasPermission, Permission, UserRole, UserStatus } from './permissions';

export interface AuthUser {
  id: string;
  role: UserRole;
  status: UserStatus;
  username: string;
  githubId: string;
}

export async function requireAuth() {
  const session = await auth();
  
  if (!session?.user) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      user: null
    };
  }
  
  interface AuthUserSession {
    id: string;
    role: UserRole;
    status: UserStatus;
    username: string;
    githubId: string;
  }
  
  const sessionUser = session.user as AuthUserSession;
  
  const user: AuthUser = {
    id: sessionUser.id,
    role: sessionUser.role,
    status: sessionUser.status,
    username: sessionUser.username,
    githubId: sessionUser.githubId,
  };
  
  return {
    error: null,
    user
  };
}

export async function requireAdmin() {
  const { error, user } = await requireAuth();
  if (error) return { error, user: null };
  
  if (user!.role !== 'ADMIN') {
    return {
      error: NextResponse.json({ error: 'Admin access required' }, { status: 403 }),
      user: null
    };
  }
  
  return { error: null, user };
}

export async function requirePermission(permission: Permission) {
  const { error, user } = await requireAuth();
  if (error) return { error, user: null };
  
  if (!hasPermission(user!.role, user!.status, permission)) {
    return {
      error: NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 }),
      user: null
    };
  }
  
  return { error: null, user };
}
