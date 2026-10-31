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

    // 1. Fetch evaluated submissions
    const submissions = await prisma.submission.findMany({
      where,
      include: {
        problem: {
          select: {
            id: true,
            title: true,
            slug: true,
            difficulty: true
          }
        },
        user: {
          select: {
            id: true,
            name: true,
            username: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    // 2. Identify problems that are completed (status === 'Accepted')
    let solvedProblemIds = new Set();
    if (effectiveUserId) {
      const solvedSubmissions = await prisma.submission.findMany({
        where: {
          userId: Number(effectiveUserId),
          status: 'Accepted'
        },
        select: { problemId: true }
      });
      solvedProblemIds = new Set(solvedSubmissions.map(s => s.problemId));
    }

    // 3. Fetch saved code drafts
    const draftWhere = isAdmin ? {} : { userId: Number(effectiveUserId) };
    const allDrafts = await prisma.codeDraft.findMany({
      where: draftWhere,
      include: {
        problem: {
          select: {
            id: true,
            title: true,
            slug: true,
            difficulty: true
          }
        },
        user: {
          select: {
            id: true,
            name: true,
            username: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    // Filter drafts: Only include problems the participant DID NOT complete (not solved)
    let uncompletedDrafts;
    if (isAdmin) {
      const allAccepted = await prisma.submission.findMany({
        where: { status: 'Accepted' },
        select: { problemId: true, userId: true }
      });
      const solvedSet = new Set(allAccepted.map(a => `${a.userId}_${a.problemId}`));
      uncompletedDrafts = allDrafts.filter(d => !solvedSet.has(`${d.userId}_${d.problemId}`));
    } else {
      uncompletedDrafts = allDrafts.filter(d => !solvedProblemIds.has(d.problemId));
    }

    const formattedDrafts = uncompletedDrafts.map(d => ({
      id: d.id,
      problemId: d.problemId,
      language: d.language,
      code: d.code,
      updatedAt: d.updatedAt,
      createdAt: d.createdAt,
      problem: d.problem,
      user: d.user,
      isDraft: true,
      status: 'Draft'
    }));

    return NextResponse.json({
      submissions,
      drafts: formattedDrafts
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
