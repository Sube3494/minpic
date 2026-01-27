'use client';

import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react';
import { ReactNode, useEffect } from 'react';
import { Session } from 'next-auth';

export function SessionProvider({ children, session }: { children: ReactNode; session?: Session | null }) {
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    document.addEventListener('contextmenu', handleContextMenu);
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

  return <NextAuthSessionProvider session={session}>{children}</NextAuthSessionProvider>;
}
