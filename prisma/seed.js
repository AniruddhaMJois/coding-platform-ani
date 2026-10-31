const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Clean existing data
  await prisma.submission.deleteMany({});
  await prisma.testCase.deleteMany({});
  await prisma.problem.deleteMany({});
  await prisma.contest.deleteMany({});
  await prisma.user.deleteMany({});

  // Seed Users
  const adminUser = await prisma.user.create({
    data: {
      name: 'Contest Admin',
      email: 'admin@platform.local',
      role: 'admin'
    }
  });

  const participantUser = await prisma.user.create({
    data: {
      name: 'John Doe',
      email: 'john@student.edu',
      role: 'participant'
    }
  });

  // Seed Contests
  const contest1 = await prisma.contest.create({
    data: {
      title: 'Practice Contest 1',
      description: 'Introductory problem-solving contest covering basic algorithms and data structures.',
      status: 'active'
    }
  });

  await prisma.contest.create({
    data: {
      title: 'Competitive Series 2 (Coming Soon)',
      description: 'Advanced graph algorithms and dynamic programming challenges.',
      status: 'upcoming'
    }
  });

  // Seed Problems
  const problemsData = [
    {
      slug: 'two-sum',
      title: 'Two Sum',
      description: 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target. You may assume that each input would have exactly one solution, and you may not use the same element twice.',
      difficulty: 'Easy',
      constraints: JSON.stringify([
        '2 <= nums.length <= 10^4',
        '-10^9 <= nums[i] <= 10^9',
        '-10^9 <= target <= 10^9',
        'Only one valid answer exists.'
      ]),
      sampleInput: 'nums = [2,7,11,15], target = 9',
      sampleOutput: '[0,1]',
      contestId: contest1.id,
      templates: '{}',
      testCases: [
        // Public sample test cases
        { input: 'nums = [2,7,11,15], target = 9', stdin: '4\n2 7 11 15\n9', expected: '[0,1]', isHidden: false },
        { input: 'nums = [3,2,4], target = 6', stdin: '3\n3 2 4\n6', expected: '[1,2]', isHidden: false },
        // Hidden test cases
        { input: 'nums = [3,3], target = 6', stdin: '2\n3 3\n6', expected: '[0,1]', isHidden: true },
        { input: 'nums = [1,5,8,12], target = 13', stdin: '4\n1 5 8 12\n13', expected: '[1,2]', isHidden: true },
        { input: 'nums = [-3,4,3,90], target = 0', stdin: '4\n-3 4 3 90\n0', expected: '[0,2]', isHidden: true }
      ]
    },
    {
      slug: 'reverse-string',
      title: 'Reverse String',
      description: 'Write a function that reverses an array of characters in-place without returning a new array.',
      difficulty: 'Easy',
      constraints: JSON.stringify([
        '1 <= s.length <= 10^5',
        's[i] is a printable ASCII character.'
      ]),
      sampleInput: 's = ["h","e","l","l","o"]',
      sampleOutput: '["o","l","l","e","h"]',
      contestId: contest1.id,
      templates: '{}',
      testCases: [
        // Public sample cases
        { input: 's = ["h","e","l","l","o"]', stdin: 'hello', expected: '["o","l","l","e","h"]', isHidden: false },
        { input: 's = ["H","a","n","n","a","h"]', stdin: 'Hannah', expected: '["h","a","n","n","a","H"]', isHidden: false },
        // Hidden test cases
        { input: 's = ["a"]', stdin: 'a', expected: '["a"]', isHidden: true },
        { input: 's = ["c","o","d","e"]', stdin: 'code', expected: '["e","d","o","c"]', isHidden: true },
        { input: 's = ["1","2","3","4","5"]', stdin: '12345', expected: '["5","4","3","2","1"]', isHidden: true }
      ]
    },
    {
      slug: 'palindrome-number',
      title: 'Palindrome Number',
      description: 'Given an integer x, return true if x is a palindrome, and false otherwise. An integer is a palindrome when it reads the same forward and backward (e.g. 121 is a palindrome, whereas 123 is not).',
      difficulty: 'Easy',
      constraints: JSON.stringify([
        '-2^31 <= x <= 2^31 - 1'
      ]),
      sampleInput: 'x = 121',
      sampleOutput: 'true',
      contestId: contest1.id,
      templates: '{}',
      testCases: [
        // Public sample test cases
        { input: 'x = 121', stdin: '121', expected: 'true', isHidden: false },
        { input: 'x = -121', stdin: '-121', expected: 'false', isHidden: false },
        { input: 'x = 10', stdin: '10', expected: 'false', isHidden: false },
        // Hidden test cases
        { input: 'x = 0', stdin: '0', expected: 'true', isHidden: true },
        { input: 'x = 1221', stdin: '1221', expected: 'true', isHidden: true },
        { input: 'x = 1234321', stdin: '1234321', expected: 'true', isHidden: true }
      ]
    },
    {
      slug: 'fizz-buzz',
      title: 'Fizz Buzz',
      description: 'Given an integer n, return an array where answer[i] is "FizzBuzz" if i is divisible by 3 and 5, "Fizz" if divisible by 3, "Buzz" if divisible by 5, or the number as a string otherwise (1-indexed).',
      difficulty: 'Easy',
      constraints: JSON.stringify([
        '1 <= n <= 10^4'
      ]),
      sampleInput: 'n = 5',
      sampleOutput: '["1","2","Fizz","4","Buzz"]',
      contestId: contest1.id,
      templates: '{}',
      testCases: [
        // Public sample test cases
        { input: 'n = 3', stdin: '3', expected: '["1","2","Fizz"]', isHidden: false },
        { input: 'n = 5', stdin: '5', expected: '["1","2","Fizz","4","Buzz"]', isHidden: false },
        // Hidden test cases
        { input: 'n = 15', stdin: '15', expected: '["1","2","Fizz","4","Buzz","Fizz","7","8","Fizz","Buzz","11","Fizz","13","14","FizzBuzz"]', isHidden: true },
        { input: 'n = 1', stdin: '1', expected: '["1"]', isHidden: true }
      ]
    },
    {
      slug: 'find-maximum',
      title: 'Find Maximum in Array',
      description: 'Given an array of integers nums, find and return the maximum value in the array.',
      difficulty: 'Easy',
      constraints: JSON.stringify([
        '1 <= nums.length <= 10^5',
        '-10^9 <= nums[i] <= 10^9'
      ]),
      sampleInput: 'nums = [1, 9, 3, 7, 2]',
      sampleOutput: '9',
      contestId: contest1.id,
      templates: '{}',
      testCases: [
        // Public sample cases
        { input: 'nums = [1, 9, 3, 7, 2]', stdin: '5\n1 9 3 7 2', expected: '9', isHidden: false },
        { input: 'nums = [-5, -2, -10]', stdin: '3\n-5 -2 -10', expected: '-2', isHidden: false },
        // Hidden test cases
        { input: 'nums = [100]', stdin: '1\n100', expected: '100', isHidden: true },
        { input: 'nums = [0, 0, 0]', stdin: '3\n0 0 0', expected: '0', isHidden: true },
        { input: 'nums = [-1000, 500, 250, 999]', stdin: '4\n-1000 500 250 999', expected: '999', isHidden: true }
      ]
    }
  ];

  for (const p of problemsData) {
    const { testCases, ...problemFields } = p;
    const problem = await prisma.problem.create({
      data: problemFields
    });

    for (const tc of testCases) {
      await prisma.testCase.create({
        data: {
          problemId: problem.id,
          input: tc.input,
          stdin: tc.stdin,
          expected: tc.expected,
          isHidden: tc.isHidden
        }
      });
    }
  }

  console.log(`Seeded ${problemsData.length} problems with public and hidden test cases.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
