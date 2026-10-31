import { NextResponse } from 'next/server';
const { prisma } = require('@/lib/prisma');
const { executeSubmission } = require('@/lib/executor');

export async function POST(request) {
  try {
    const { problemId, slug, language, code, userId } = await request.json();

    if (!language || !code) {
      return NextResponse.json({ error: 'language and code are required' }, { status: 400 });
    }

    // Retrieve ALL test cases (especially hidden evaluation cases) from database
    const problem = await prisma.problem.findFirst({
      where: problemId ? { id: Number(problemId) } : { slug },
      include: {
        testCases: true // Full evaluation set including hidden
      }
    });

    if (!problem) {
      return NextResponse.json({ error: 'Problem not found' }, { status: 404 });
    }

    const results = await executeSubmission({
      language,
      code,
      tests: problem.testCases,
      timeLimitMs: 3000
    });

    const passedCount = results.filter(r => r.passed).length;
    const totalCount = problem.testCases.length;
    const score = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0;
    
    let status = 'Accepted';
    if (results.some(r => r.compileError)) {
      status = 'Compilation Error';
    } else if (results.some(r => r.timeMs >= 3000)) {
      status = 'Time Limit Exceeded';
    } else if (passedCount < totalCount) {
      status = 'Wrong Answer';
    }

    let effectiveUserId = userId ? Number(userId) : null;
    if (!effectiveUserId) {
      const cookie = request.cookies.get('platform_auth');
      if (cookie?.value) {
        try { effectiveUserId = JSON.parse(cookie.value)?.id || null; } catch(e) {}
      }
    }

    // Persist submission in database
    const submission = await prisma.submission.create({
      data: {
        problemId: problem.id,
        userId: effectiveUserId,
        language,
        code,
        score,
        status,
        passedTests: passedCount,
        totalTests: totalCount,
        output: JSON.stringify(results.map(r => ({ passed: r.passed, timeMs: r.timeMs, stderr: r.stderr })))
      }
    });

    const sanitizedResults = results.map((r, idx) => ({
      testIndex: idx + 1,
      passed: r.passed,
      timeMs: r.timeMs,
      isHidden: Boolean(r.isHidden),
      input: r.isHidden ? null : r.input,
      expected: r.isHidden ? null : r.expected,
      stdout: r.isHidden ? null : r.stdout,
      stderr: r.isHidden ? (r.passed ? null : 'Evaluation failed on hidden test case.') : r.stderr
    }));

    return NextResponse.json({
      ok: true,
      submissionId: submission.id,
      score,
      status,
      passedTests: passedCount,
      totalTests: totalCount,
      results: sanitizedResults
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
