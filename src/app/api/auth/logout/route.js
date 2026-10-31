import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function clearAuthCookie(response) {
  response.cookies.set('platform_auth', '', {
    path: '/',
    maxAge: 0,
    expires: new Date(0)
  });
  return response;
}

export async function POST() {
  const response = NextResponse.json({ ok: true, message: 'Logged out successfully' });
  return clearAuthCookie(response);
}

export async function GET(request) {
  const url = new URL('/login', request.url);
  const response = NextResponse.redirect(url);
  return clearAuthCookie(response);
}
