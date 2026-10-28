import { NextResponse } from 'next/server';
const { prisma } = require('@/lib/prisma');
const { executeSubmission } = require('@/lib/executor');

export async function POST(request) {
  try {
    const { problemId, slug, language, code, funcName } = await request.json();

    if (!language || !code) {
      return NextResponse.json({ error: 'language and code are required' }, { status: 400 });
    }

    // Retrieve public sample test cases from database
    const problem = await prisma.problem.findFirst({
      where: problemId ? { id: Number(problemId) } : { slug },
      include: {
        testCases: {
          where: { isHidden: false } // Only run sample cases on "Run Code"
        }
      }
    });

    if (!problem) {
      return NextResponse.json({ error: 'Problem not found' }, { status: 404 });
    }

    const results = await executeSubmission({
      language,
      code,
      tests: problem.testCases,
      timeLimitMs: 3000,
      funcName
    });

    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
