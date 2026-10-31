import { NextResponse } from 'next/server';
const { prisma } = require('@/lib/prisma');

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
  try {
    const cookie = request.cookies.get('platform_auth');
    if (!cookie?.value) {
      return NextResponse.json({ error: 'Unauthorized: Please log in to view problems' }, { status: 401 });
    }

    let effectiveUserId = null;
    let userRole = null;
    try {
      const parsed = JSON.parse(cookie.value);
      effectiveUserId = parsed?.id ? Number(parsed.id) : null;
      userRole = parsed?.role;
    } catch (e) {}

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

    let solvedProblemIds = new Set();
    let acceptedSubmissionsMap = {};
    if (effectiveUserId && userRole !== 'admin') {
      const solvedSubmissions = await prisma.submission.findMany({
        where: {
          userId: effectiveUserId,
          status: 'Accepted'
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          problemId: true,
          code: true,
          language: true,
          score: true,
          createdAt: true
        }
      });
      for (const sub of solvedSubmissions) {
        solvedProblemIds.add(sub.problemId);
        if (!acceptedSubmissionsMap[sub.problemId]) {
          acceptedSubmissionsMap[sub.problemId] = sub;
        }
      }
    }

    const formatted = problems.map(p => ({
      ...p,
      constraints: JSON.parse(p.constraints || '[]'),
      templates: JSON.parse(p.templates || '{}'),
      isSolved: solvedProblemIds.has(p.id),
      acceptedSubmission: acceptedSubmissionsMap[p.id] || null
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
