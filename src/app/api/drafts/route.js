import { NextResponse } from 'next/server';
const { prisma } = require('@/lib/prisma');

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET saved code draft
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const problemId = searchParams.get('problemId');
    const language = searchParams.get('language');
    const userId = searchParams.get('userId');

    if (!problemId || !language) {
      return NextResponse.json({ error: 'problemId and language required' }, { status: 400 });
    }

    let effectiveUserId = userId ? Number(userId) : null;
    if (!effectiveUserId) {
      const cookie = request.cookies.get('platform_auth');
      if (cookie?.value) {
        try { effectiveUserId = JSON.parse(cookie.value)?.id || null; } catch(e) {}
      }
    }

    if (!effectiveUserId) {
      return NextResponse.json({ error: 'Unauthorized: Please log in to view saved drafts' }, { status: 401 });
    }

    let draft = await prisma.codeDraft.findFirst({
      where: {
        problemId: Number(problemId),
        language,
        userId: effectiveUserId
      }
    });

    // If no draft exists yet, check if there is an accepted submission to show solved code
    if (!draft) {
      const accepted = await prisma.submission.findFirst({
        where: {
          problemId: Number(problemId),
          language,
          userId: effectiveUserId,
          status: 'Accepted'
        },
        orderBy: { createdAt: 'desc' }
      });
      if (accepted) {
        draft = { code: accepted.code, updatedAt: accepted.createdAt };
      }
    }

    return NextResponse.json({
      draft: draft ? { code: draft.code, updatedAt: draft.updatedAt } : null
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Save code draft explicitly
export async function POST(request) {
  try {
    const body = await request.json();
    const { problemId, language, code, userId } = body;

    if (!problemId || !language) {
      return NextResponse.json({ error: 'problemId and language required' }, { status: 400 });
    }

    const cleanCode = typeof code === 'string' ? code.trimEnd() : '';

    // Enforce 64KB max code draft size to strictly prevent database bloat
    if (cleanCode.length > 65536) {
      return NextResponse.json({ error: 'Code exceeds maximum draft size (64KB)' }, { status: 400 });
    }

    let effectiveUserId = userId ? Number(userId) : null;
    let userRole = null;
    if (!effectiveUserId) {
      const cookie = request.cookies.get('platform_auth');
      if (cookie?.value) {
        try {
          const parsed = JSON.parse(cookie.value);
          effectiveUserId = parsed?.id || null;
          userRole = parsed?.role;
        } catch(e) {}
      }
    }

    if (!effectiveUserId) {
      return NextResponse.json({ error: 'Unauthorized: Please log in to save code drafts' }, { status: 401 });
    }

    // If user has already solved this problem, disallow changing draft
    if (userRole !== 'admin') {
      const alreadySolved = await prisma.submission.findFirst({
        where: {
          problemId: Number(problemId),
          userId: effectiveUserId,
          status: 'Accepted'
        }
      });
      if (alreadySolved) {
        return NextResponse.json({ error: 'Problem already solved. Modifying code draft is disabled.' }, { status: 403 });
      }
    }

    // Check if draft already exists
    const existing = await prisma.codeDraft.findFirst({
      where: {
        problemId: Number(problemId),
        language,
        userId: effectiveUserId
      }
    });

    // If existing code is identical, return immediately without touching Postgres
    if (existing && existing.code === cleanCode) {
      return NextResponse.json({
        ok: true,
        message: 'Draft is already up to date',
        savedAt: existing.updatedAt
      });
    }

    let draft;
    if (existing) {
      draft = await prisma.codeDraft.update({
        where: { id: existing.id },
        data: {
          code: cleanCode,
          updatedAt: new Date()
        }
      });
    } else {
      draft = await prisma.codeDraft.create({
        data: {
          problemId: Number(problemId),
          language,
          code: cleanCode,
          userId: effectiveUserId
        }
      });
    }

    return NextResponse.json({
      ok: true,
      message: 'Code saved successfully',
      savedAt: draft.updatedAt
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
