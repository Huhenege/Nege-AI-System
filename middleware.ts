import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login', '/signup'];

const STATIC_PREFIXES = ['/_next', '/favicon', '/icons', '/manifest'];

function isPublicOrStatic(pathname: string): boolean {
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) return true;
  if (STATIC_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  if (pathname.startsWith('/api/')) return true;
  if (pathname === '/') return true;
  if (/\.\w+$/.test(pathname)) return true;
  return false;
}

function decodePayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(b64));
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicOrStatic(pathname)) {
    const sessionToken = request.cookies.get('__session')?.value;
    if (sessionToken && PUBLIC_PATHS.some((p) => pathname === p)) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  const sessionToken = request.cookies.get('__session')?.value;

  if (!sessionToken) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith('/super-admin')) {
    const payload = decodePayload(sessionToken);
    if (!payload || payload.role !== 'super_admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  if (pathname.startsWith('/dashboard') && !pathname.startsWith('/dashboard/setup')) {
    const payload = decodePayload(sessionToken);
    const exp = payload?.exp as number | undefined;
    if (exp && exp * 1000 < Date.now()) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete('__session');
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
