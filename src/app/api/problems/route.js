import { NextResponse } from 'next/server';
const { prisma } = require('@/lib/prisma');

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');
    const where = slug ? { slug } : {};

    const problems = await prisma.problem.findMany({
      where,
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        difficulty: true,
        constraints: true,
        sampleInput: true,
        sampleOutput: true,
        templates: true,
        testCases: {
          where: { isHidden: false }, // Only expose public sample cases!
          select: {
            id: true,
            input: true,
            stdin: true,
            expected: true,
            isHidden: true
          },
          orderBy: { id: 'asc' }
        }
      },
      orderBy: { id: 'asc' }
    });

    const formatted = problems.map(p => ({
      ...p,
      constraints: JSON.parse(p.constraints || '[]'),
      templates: JSON.parse(p.templates || '{}')
    }));

    if (slug) {
      if (formatted.length === 0) {
        return NextResponse.json({ error: 'Problem not found' }, { status: 404 });
      }
      return NextResponse.json({ problem: formatted[0] });
    }

    return NextResponse.json(
      { problems: formatted },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
        }
      }
    );
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
