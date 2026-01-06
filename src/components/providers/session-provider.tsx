'use client';

import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react';
import { ReactNode } from 'react';
import { Session } from 'next-auth';

export function SessionProvider({ children, session }: { children: ReactNode; session?: Session | null }) {
  return <NextAuthSessionProvider session={session}>{children}</NextAuthSessionProvider>;
}
