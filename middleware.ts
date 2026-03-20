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
      const payload = decodePayload(sessionToken);
      const exp = payload?.exp as number | undefined;
      const isExpired = exp && exp * 1000 < Date.now();
      // Only redirect to dashboard if token is valid, user has a company, and is admin/manager (not employee)
      if (!isExpired && payload && (payload.companyId || payload.role === 'super_admin') && payload.role !== 'employee') {
        const target = payload.role === 'super_admin' ? '/super-admin' : '/dashboard';
        return NextResponse.redirect(new URL(target, request.url));
      }
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

    // Require companyId for dashboard access (super_admin is exempt)
    if (payload && payload.role !== 'super_admin' && !payload.companyId) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('error', 'no_company');
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete('__session');
      return response;
    }

    // Block employee role from accessing dashboard (company_super_admin/admin/manager only)
    if (payload && payload.role === 'employee') {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('error', 'employee_no_access');
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
