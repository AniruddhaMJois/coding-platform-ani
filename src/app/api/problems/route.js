import { NextResponse } from 'next/server';
const { prisma } = require('@/lib/prisma');

export async function GET(request) {
  try {
    const problems = await prisma.problem.findMany({
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
          }
        }
      },
      orderBy: { id: 'asc' }
    });

    const formatted = problems.map(p => ({
      ...p,
      constraints: JSON.parse(p.constraints || '[]'),
      templates: JSON.parse(p.templates || '{}')
    }));

    return NextResponse.json({ problems: formatted });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
