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

    const draft = await prisma.codeDraft.findFirst({
      where: {
        problemId: Number(problemId),
        language,
        userId: userId ? Number(userId) : null
      }
    });

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

    // Check if draft already exists
    const existing = await prisma.codeDraft.findFirst({
      where: {
        problemId: Number(problemId),
        language,
        userId: userId ? Number(userId) : null
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
          userId: userId ? Number(userId) : null
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
