import { NextResponse } from 'next/server';
const { prisma } = require('@/lib/prisma');
import { broadcastEvent } from '@/lib/realtime';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// POST: Add or bulk upload test cases to a problem
export async function POST(request) {
  try {
    const body = await request.json();
    const { problemId, testCases, input, stdin, expected, isHidden } = body;

    if (!problemId) {
      return NextResponse.json({ error: 'problemId is required' }, { status: 400 });
    }

    const problem = await prisma.problem.findUnique({
      where: { id: Number(problemId) }
    });

    if (!problem) {
      return NextResponse.json({ error: 'Problem not found' }, { status: 404 });
    }

    let itemsToInsert = [];

    // Support both batch testCases array or single testcase fields
    if (Array.isArray(testCases) && testCases.length > 0) {
      itemsToInsert = testCases
        .filter(tc => tc && tc.expected !== undefined && tc.expected !== '')
        .map(tc => ({
          problemId: Number(problemId),
          input: String(tc.input || ''),
          stdin: String(tc.stdin || ''),
          expected: String(tc.expected || '').trim(),
          isHidden: Boolean(tc.isHidden)
        }));
    } else if (expected !== undefined && expected !== '') {
      itemsToInsert = [{
        problemId: Number(problemId),
        input: String(input || ''),
        stdin: String(stdin || ''),
        expected: String(expected || '').trim(),
        isHidden: Boolean(isHidden)
      }];
    }

    if (itemsToInsert.length === 0) {
      return NextResponse.json({ error: 'No valid test cases provided' }, { status: 400 });
    }

    // Insert into Supabase database
    const created = [];
    for (const item of itemsToInsert) {
      const tc = await prisma.testCase.create({
        data: item
      });
      created.push(tc);
    }

    // Broadcast instant update across SSE and clients
    broadcastEvent({
      type: 'TESTCASE_UPLOADED',
      problemId: Number(problemId),
      slug: problem.slug,
      title: problem.title,
      count: created.length,
      hasPublic: created.some(c => !c.isHidden),
      timestamp: Date.now()
    });

    return NextResponse.json({
      ok: true,
      message: `Successfully uploaded ${created.length} test case(s)`,
      count: created.length,
      testCases: created
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Remove a test case
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Test case id required' }, { status: 400 });
    }

    const testCase = await prisma.testCase.findUnique({
      where: { id: Number(id) },
      include: { problem: true }
    });

    if (!testCase) {
      return NextResponse.json({ error: 'Test case not found' }, { status: 404 });
    }

    await prisma.testCase.delete({
      where: { id: Number(id) }
    });

    // Broadcast testcase deletion event
    broadcastEvent({
      type: 'TESTCASE_DELETED',
      testCaseId: Number(id),
      problemId: testCase.problemId,
      slug: testCase.problem?.slug,
      title: testCase.problem?.title,
      timestamp: Date.now()
    });

    return NextResponse.json({ ok: true, message: 'Test case deleted' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
