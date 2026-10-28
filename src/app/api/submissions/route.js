import { NextResponse } from 'next/server';
const { prisma } = require('@/lib/prisma');

export async function GET() {
  try {
    const submissions = await prisma.submission.findMany({
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
