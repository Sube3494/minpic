import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isAuthPage = req.nextUrl.pathname.startsWith('/auth');
  const isPublicPage = req.nextUrl.pathname === '/';
  const isApiAuth = req.nextUrl.pathname.startsWith('/api/auth');
  
  // Allow auth API routes
  if (isApiAuth) {
    return NextResponse.next();
  }
  
  // If on auth page and logged in, redirect to files
  if (isAuthPage && isLoggedIn) {
    return NextResponse.redirect(new URL('/files', req.url));
  }
  
  // If on auth page and not logged in, allow
  if (isAuthPage) {
    return NextResponse.next();
  }
  
  // If on public page, allow
  if (isPublicPage) {
    return NextResponse.next();
  }
  
  // If not logged in and trying to access protected page, redirect to signin
  if (!isLoggedIn) {
    return NextResponse.redirect(new URL('/auth/signin', req.url));
  }
  
  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
};
