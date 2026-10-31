import { NextResponse } from 'next/server';
const { prisma } = require('@/lib/prisma');

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
  try {
    let effectiveUserId = null;
    let isAdmin = false;

    const cookie = request.cookies.get('platform_auth');
    if (cookie?.value) {
      try {
        const u = JSON.parse(cookie.value);
        effectiveUserId = u?.id || null;
        isAdmin = u?.role === 'admin';
      } catch (e) {}
    }

    if (!effectiveUserId && !isAdmin) {
      return NextResponse.json({ error: 'Unauthorized: Please log in to view submissions' }, { status: 401 });
    }

    const where = isAdmin ? {} : { userId: Number(effectiveUserId) };

    const submissions = await prisma.submission.findMany({
      where,
      include: {
        problem: {
          select: {
            title: true,
            slug: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    return NextResponse.json({ submissions });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
