import { NextResponse } from 'next/server';

// Inlined (Edge runtime is strict about cross-dir imports in Next 16 + Turbopack).
const AUTH_COOKIE = 'aish_auth';
const AUTH_COOKIE_VALUE = 'ok';

export function middleware(req) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(AUTH_COOKIE);
  if (cookie?.value !== AUTH_COOKIE_VALUE) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
