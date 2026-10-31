import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
  try {
    const cookie = request.cookies.get('platform_auth');
    if (!cookie?.value) {
      return NextResponse.json({ user: null });
    }

    const user = JSON.parse(cookie.value);
    return NextResponse.json({ user });
  } catch (e) {
    return NextResponse.json({ user: null });
  }
}
