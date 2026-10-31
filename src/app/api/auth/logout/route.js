import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST() {
  const response = NextResponse.json({ ok: true, message: 'Logged out successfully' });
  response.cookies.delete('platform_auth');
  return response;
}
