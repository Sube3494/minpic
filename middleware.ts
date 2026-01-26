import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isAuthPage = req.nextUrl.pathname.startsWith('/auth');
  const isPublicPage = req.nextUrl.pathname === '/';
  const isCollectionPage = req.nextUrl.pathname.startsWith('/c/');
  const isApiAuth = req.nextUrl.pathname.startsWith('/api/auth');
  const isPublicApi = req.nextUrl.pathname.startsWith('/api/collections/') || req.nextUrl.pathname.includes('/thumbnail');

  // Allow auth API routes
  if (isApiAuth || isPublicApi) {
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
  if (isPublicPage || isCollectionPage) {
    return NextResponse.next();
  }
  
  // If not logged in and trying to access protected page, redirect to signin with callbackUrl
  if (!isLoggedIn) {
    const callbackUrl = encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(new URL(`/auth/signin?callbackUrl=${callbackUrl}`, req.url));
  }
  
  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)).*)']
};
