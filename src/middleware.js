import { NextResponse } from 'next/server';

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // 1. Allow Next.js internals, static assets, and favicon
  if (
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|css|js|woff|woff2)$/)
  ) {
    return NextResponse.next();
  }

  // 2. Allow authentication endpoints
  if (pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  // 3. Extract and parse session user
  const authCookie = request.cookies.get('platform_auth');
  let user = null;
  if (authCookie?.value) {
    try {
      user = JSON.parse(authCookie.value);
    } catch (e) {
      user = null;
    }
  }

  // 4. Handle /login route
  if (pathname === '/login') {
    // If already logged in, redirect to user's home dashboard
    if (user) {
      if (user.role === 'admin') {
        return NextResponse.redirect(new URL('/admin', request.url));
      } else {
        return NextResponse.redirect(new URL('/problems', request.url));
      }
    }
    return NextResponse.next();
  }

  // 5. Unauthenticated guard: block all protected features
  if (!user) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Unauthorized: Please log in to access this feature' },
        { status: 401 }
      );
    }
    // Redirect unauthenticated visitors directly to /login
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // 6. Admin guard: restrict /admin and /api/admin to role === 'admin'
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    if (user.role !== 'admin') {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Forbidden: Admin privileges required' },
          { status: 403 }
        );
      }
      return NextResponse.redirect(new URL('/problems', request.url));
    }
  }

  // 7. Route logged-in visitors from root '/' to their respective dashboards
  if (pathname === '/') {
    if (user.role === 'admin') {
      return NextResponse.redirect(new URL('/admin', request.url));
    } else {
      return NextResponse.redirect(new URL('/problems', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
