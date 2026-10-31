import { NextResponse } from 'next/server';
const { prisma } = require('@/lib/prisma');
const { executeSubmission } = require('@/lib/executor');

export async function POST(request) {
  try {
    const cookie = request.cookies.get('platform_auth');
    if (!cookie?.value) {
      return NextResponse.json({ error: 'Unauthorized: Please log in to run code' }, { status: 401 });
    }

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

    let effectiveUserId = null;
    let userRole = null;
    try {
      const parsed = JSON.parse(cookie.value);
      effectiveUserId = parsed?.id ? Number(parsed.id) : null;
      userRole = parsed?.role;
    } catch (e) {}

    // If user is a participant and has already solved this problem, disallow running code
    if (userRole !== 'admin' && effectiveUserId) {
      const alreadySolved = await prisma.submission.findFirst({
        where: {
          problemId: problem.id,
          userId: effectiveUserId,
          status: 'Accepted'
        }
      });

      if (alreadySolved) {
        return NextResponse.json(
          { error: 'Problem already solved. Further attempts are disabled.', isSolved: true },
          { status: 403 }
        );
      }
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
