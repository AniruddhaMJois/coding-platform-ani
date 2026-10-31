const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database with clean, simple problems...');

  // 1. Wipe all participant submissions and code drafts completely
  console.log('🧹 Purging all participant submissions and code drafts...');
  await prisma.submission.deleteMany({});
  await prisma.codeDraft.deleteMany({});
  await prisma.testCase.deleteMany({});
  await prisma.problem.deleteMany({});
  await prisma.contest.deleteMany({});
  await prisma.user.deleteMany({});

  // 2. Seed Users
  console.log('👤 Seeding users...');
  await prisma.user.create({
    data: {
      username: '1',
      password: '1',
      name: 'User 1',
      role: 'participant'
    }
  });

  await prisma.user.create({
    data: {
      username: '2',
      password: '2',
      name: 'User 2',
      role: 'participant'
    }
  });

  await prisma.user.create({
    data: {
      username: 'osl-vvce',
      password: 'OSL',
      name: 'OSL Admin',
      role: 'admin'
    }
  });

  // 3. Seed Contest
  console.log('🏆 Seeding active contest...');
  const contest1 = await prisma.contest.create({
    data: {
      title: 'Practice Contest 1',
      description: 'Introductory problem-solving contest covering basic arithmetic and logic.',
      status: 'active'
    }
  });

  await prisma.contest.create({
    data: {
      title: 'Competitive Series 2 (Coming Soon)',
      description: 'Advanced challenges and algorithmic problem series.',
      status: 'upcoming'
    }
  });

  // 4. Seed Simple Problems (a + b, a * b, Even or Odd, Max, Square)
  console.log('📝 Seeding simple problems...');
  const problemsData = [
    {
      slug: 'add-two-numbers',
      title: 'Add Two Numbers',
      description: 'Given two integers a and b, return their sum (a + b).\n\nYou can implement a function `add(a, b)` or read standard input containing two space-separated integers.',
      difficulty: 'Easy',
      constraints: JSON.stringify([
        '-10^4 <= a, b <= 10^4',
        'Output must be an integer representing a + b.'
      ]),
      sampleInput: 'a = 3, b = 5',
      sampleOutput: '8',
      contestId: contest1.id,
      templates: '{}',
      testCases: [
        { input: 'a = 3, b = 5', stdin: '3 5', expected: '8', isHidden: false },
        { input: 'a = 10, b = 20', stdin: '10 20', expected: '30', isHidden: false },
        { input: 'a = -5, b = 5', stdin: '-5 5', expected: '0', isHidden: true },
        { input: 'a = 100, b = 250', stdin: '100 250', expected: '350', isHidden: true },
        { input: 'a = -15, b = -25', stdin: '-15 -25', expected: '-40', isHidden: true }
      ]
    },
    {
      slug: 'multiply-two-numbers',
      title: 'Multiply Two Numbers',
      description: 'Given two integers a and b, return their product (a * b).\n\nYou can implement a function `multiply(a, b)` or read standard input containing two space-separated integers.',
      difficulty: 'Easy',
      constraints: JSON.stringify([
        '-10^3 <= a, b <= 10^3',
        'Output must be an integer representing a * b.'
      ]),
      sampleInput: 'a = 4, b = 6',
      sampleOutput: '24',
      contestId: contest1.id,
      templates: '{}',
      testCases: [
        { input: 'a = 4, b = 6', stdin: '4 6', expected: '24', isHidden: false },
        { input: 'a = 7, b = 8', stdin: '7 8', expected: '56', isHidden: false },
        { input: 'a = 0, b = 99', stdin: '0 99', expected: '0', isHidden: true },
        { input: 'a = -3, b = 5', stdin: '-3 5', expected: '-15', isHidden: true },
        { input: 'a = -4, b = -6', stdin: '-4 -6', expected: '24', isHidden: true }
      ]
    },
    {
      slug: 'even-or-odd',
      title: 'Even or Odd',
      description: 'Given an integer n, return "Even" if the number is even, and "Odd" if the number is odd.\n\nYou can implement a function `evenOrOdd(n)` or read standard input.',
      difficulty: 'Easy',
      constraints: JSON.stringify([
        '-10^6 <= n <= 10^6',
        'Return "Even" or "Odd" (case-sensitive).'
      ]),
      sampleInput: 'n = 4',
      sampleOutput: 'Even',
      contestId: contest1.id,
      templates: '{}',
      testCases: [
        { input: 'n = 4', stdin: '4', expected: 'Even', isHidden: false },
        { input: 'n = 7', stdin: '7', expected: 'Odd', isHidden: false },
        { input: 'n = 0', stdin: '0', expected: 'Even', isHidden: true },
        { input: 'n = -3', stdin: '-3', expected: 'Odd', isHidden: true },
        { input: 'n = 1002', stdin: '1002', expected: 'Even', isHidden: true }
      ]
    },
    {
      slug: 'maximum-of-two-numbers',
      title: 'Maximum of Two Numbers',
      description: 'Given two integers a and b, return the larger of the two numbers.\n\nYou can implement a function `findMax(a, b)` or read standard input.',
      difficulty: 'Easy',
      constraints: JSON.stringify([
        '-10^9 <= a, b <= 10^9',
        'Return the maximum value between a and b.'
      ]),
      sampleInput: 'a = 12, b = 25',
      sampleOutput: '25',
      contestId: contest1.id,
      templates: '{}',
      testCases: [
        { input: 'a = 12, b = 25', stdin: '12 25', expected: '25', isHidden: false },
        { input: 'a = 50, b = 10', stdin: '50 10', expected: '50', isHidden: false },
        { input: 'a = -5, b = -20', stdin: '-5 -20', expected: '-5', isHidden: true },
        { input: 'a = 7, b = 7', stdin: '7 7', expected: '7', isHidden: true },
        { input: 'a = 0, b = -10', stdin: '0 -10', expected: '0', isHidden: true }
      ]
    },
    {
      slug: 'square-of-number',
      title: 'Square of a Number',
      description: 'Given an integer n, return its square (n * n).\n\nYou can implement a function `square(n)` or read standard input.',
      difficulty: 'Easy',
      constraints: JSON.stringify([
        '-10^4 <= n <= 10^4',
        'Output must be an integer representing n^2.'
      ]),
      sampleInput: 'n = 5',
      sampleOutput: '25',
      contestId: contest1.id,
      templates: '{}',
      testCases: [
        { input: 'n = 5', stdin: '5', expected: '25', isHidden: false },
        { input: 'n = 9', stdin: '9', expected: '81', isHidden: false },
        { input: 'n = 0', stdin: '0', expected: '0', isHidden: true },
        { input: 'n = -4', stdin: '-4', expected: '16', isHidden: true },
        { input: 'n = 12', stdin: '12', expected: '144', isHidden: true }
      ]
    }
  ];

  for (const prob of problemsData) {
    const { testCases, ...probFields } = prob;
    const createdProblem = await prisma.problem.create({
      data: {
        ...probFields,
        testCases: {
          create: testCases
        }
      }
    });
    console.log(`  ✓ Created problem: "${createdProblem.title}" (${createdProblem.slug}) with ${testCases.length} test cases`);
  }

  console.log('\n✨ Database seeding completed successfully!');
  console.log('✅ All participant submissions and drafts wiped clean (0 rows).');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
