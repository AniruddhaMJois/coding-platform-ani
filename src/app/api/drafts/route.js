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

    // Check if draft already exists
    const existing = await prisma.codeDraft.findFirst({
      where: {
        problemId: Number(problemId),
        language,
        userId: userId ? Number(userId) : null
      }
    });

    let draft;
    if (existing) {
      draft = await prisma.codeDraft.update({
        where: { id: existing.id },
        data: {
          code: code || '',
          updatedAt: new Date()
        }
      });
    } else {
      draft = await prisma.codeDraft.create({
        data: {
          problemId: Number(problemId),
          language,
          code: code || '',
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
