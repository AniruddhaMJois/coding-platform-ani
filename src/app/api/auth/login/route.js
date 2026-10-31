import { NextResponse } from 'next/server';
const { prisma } = require('@/lib/prisma');

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
    }

    const cleanUsername = String(username).trim();
    const cleanPassword = String(password).trim();

    const user = await prisma.user.findUnique({
      where: { username: cleanUsername }
    });

    if (!user || user.password !== cleanPassword) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    const userData = {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role
    };

    const response = NextResponse.json({
      ok: true,
      message: 'Login successful',
      user: userData
    });

    // Set HTTP-Only Session Cookie
    response.cookies.set('platform_auth', JSON.stringify(userData), {
      httpOnly: false, // Accessible by client JS for state management
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    });

    return response;
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
