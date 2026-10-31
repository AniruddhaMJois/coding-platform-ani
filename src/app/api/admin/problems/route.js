import { NextResponse } from 'next/server';
const { prisma } = require('@/lib/prisma');
import { broadcastEvent } from '@/lib/realtime';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const problems = await prisma.problem.findMany({
      include: {
        testCases: true
      },
      orderBy: { id: 'asc' }
    });

    const parsed = problems.map(p => ({
      ...p,
      constraints: JSON.parse(p.constraints || '[]'),
      templates: JSON.parse(p.templates || '{}')
    }));

    return NextResponse.json({ problems: parsed });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { title, slug, description, difficulty, constraints, sampleInput, sampleOutput, templates, testCases } = body;

    if (!title || !slug) {
      return NextResponse.json({ error: 'title and slug are required' }, { status: 400 });
    }

    const problem = await prisma.problem.create({
      data: {
        title,
        slug,
        description: description || '',
        difficulty: difficulty || 'Easy',
        constraints: JSON.stringify(constraints || []),
        sampleInput: sampleInput || '',
        sampleOutput: sampleOutput || '',
        templates: JSON.stringify(templates || {}),
        testCases: {
          create: (testCases || []).map(tc => ({
            input: tc.input || '',
            stdin: tc.stdin || '',
            expected: tc.expected || '',
            isHidden: Boolean(tc.isHidden)
          }))
        }
      },
      include: {
        testCases: true
      }
    });

    broadcastEvent({
      type: 'CMS_UPDATE',
      action: 'create',
      problemId: problem.id,
      slug: problem.slug,
      title: problem.title,
      timestamp: Date.now()
    });

    return NextResponse.json({ ok: true, problem });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const problem = await prisma.problem.findUnique({
      where: { id: Number(id) }
    });

    await prisma.problem.delete({
      where: { id: Number(id) }
    });

    broadcastEvent({
      type: 'CMS_UPDATE',
      action: 'delete',
      problemId: Number(id),
      slug: problem?.slug,
      title: problem?.title,
      timestamp: Date.now()
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
