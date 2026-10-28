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
      templates: JSON.stringify({
        javascript: `function twoSum(nums, target) {\n  // Write your code here\n  for (let i = 0; i < nums.length; i++) {\n    for (let j = i + 1; j < nums.length; j++) {\n      if (nums[i] + nums[j] === target) return [i, j];\n    }\n  }\n  return [];\n}`,
        python: `def two_sum(nums, target):\n    # Write your code here\n    seen = {}\n    for i, num in enumerate(nums):\n        complement = target - num\n        if complement in seen:\n            return [seen[complement], i]\n        seen[num] = i\n    return []`,
        c: `#include <stdio.h>\n#include <stdlib.h>\n\nint* twoSum(int* nums, int numsSize, int target, int* returnSize) {\n    *returnSize = 2;\n    int* res = (int*)malloc(2 * sizeof(int));\n    for (int i = 0; i < numsSize; i++) {\n        for (int j = i + 1; j < numsSize; j++) {\n            if (nums[i] + nums[j] == target) {\n                res[0] = i;\n                res[1] = j;\n                return res;\n            }\n        }\n    }\n    return res;\n}`,
        cpp: `#include <vector>\n#include <unordered_map>\nusing namespace std;\n\nclass Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums, int target) {\n        unordered_map<int, int> seen;\n        for (int i = 0; i < (int)nums.size(); i++) {\n            int diff = target - nums[i];\n            if (seen.count(diff)) return {seen[diff], i};\n            seen[nums[i]] = i;\n        }\n        return {};\n    }\n};`,
        java: `import java.util.*;\n\npublic class Solution {\n    public static int[] twoSum(int[] nums, int target) {\n        Map<Integer, Integer> map = new HashMap<>();\n        for (int i = 0; i < nums.length; i++) {\n            int complement = target - nums[i];\n            if (map.containsKey(complement)) {\n                return new int[] { map.get(complement), i };\n            }\n            map.put(nums[i], i);\n        }\n        return new int[]{};\n    }\n}`
      }),
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
      templates: JSON.stringify({
        javascript: `function reverseString(s) {\n  // Write your code here\n  return s.reverse();\n}`,
        python: `def reverse_string(s):\n    # Write your code here\n    return s[::-1]`,
        c: `#include <stdio.h>\n#include <string.h>\n\nvoid reverseString(char* s, int sSize) {\n    int l = 0, r = sSize - 1;\n    while (l < r) {\n        char t = s[l];\n        s[l] = s[r];\n        s[r] = t;\n        l++; r--;\n    }\n}`,
        cpp: `#include <vector>\n#include <algorithm>\nusing namespace std;\n\nclass Solution {\npublic:\n    void reverseString(vector<char>& s) {\n        reverse(s.begin(), s.end());\n    }\n};`,
        java: `public class Solution {\n    public static String reverseString(String s) {\n        return new StringBuilder(s).reverse().toString();\n    }\n}`
      }),
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
      templates: JSON.stringify({
        javascript: `function isPalindrome(x) {\n  if (x < 0) return false;\n  const s = String(x);\n  return s === s.split('').reverse().join('');\n}`,
        python: `def is_palindrome(x):\n    if x < 0:\n        return False\n    s = str(x)\n    return s == s[::-1]`,
        c: `#include <stdbool.h>\n\nbool isPalindrome(int x) {\n    if (x < 0) return false;\n    long long rev = 0, orig = x;\n    while (x > 0) {\n        rev = rev * 10 + (x % 10);\n        x /= 10;\n    }\n    return orig == rev;\n}`,
        cpp: `class Solution {\npublic:\n    bool isPalindrome(int x) {\n        if (x < 0) return false;\n        long long rev = 0, orig = x;\n        while (x > 0) {\n            rev = rev * 10 + (x % 10);\n            x /= 10;\n        }\n        return orig == rev;\n    }\n};`,
        java: `public class Solution {\n    public static boolean isPalindrome(int x) {\n        if (x < 0) return false;\n        int rev = 0, orig = x;\n        while (x > 0) {\n            rev = rev * 10 + (x % 10);\n            x /= 10;\n        }\n        return orig == rev;\n    }\n}`
      }),
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
      templates: JSON.stringify({
        javascript: `function fizzBuzz(n) {\n  const res = [];\n  for (let i = 1; i <= n; i++) {\n    if (i % 15 === 0) res.push("FizzBuzz");\n    else if (i % 3 === 0) res.push("Fizz");\n    else if (i % 5 === 0) res.push("Buzz");\n    else res.push(String(i));\n  }\n  return res;\n}`,
        python: `def fizz_buzz(n):\n    res = []\n    for i in range(1, n + 1):\n        if i % 15 == 0:\n            res.append("FizzBuzz")\n        elif i % 3 == 0:\n            res.append("Fizz")\n        elif i % 5 == 0:\n            res.append("Buzz")\n        else:\n            res.append(str(i))\n    return res`,
        c: `#include <stdio.h>\n#include <stdlib.h>\n#include <string.h>\n\nchar** fizzBuzz(int n, int* returnSize) {\n    *returnSize = n;\n    char** res = (char**)malloc(n * sizeof(char*));\n    for (int i = 1; i <= n; i++) {\n        res[i - 1] = (char*)malloc(16 * sizeof(char));\n        if (i % 15 == 0) strcpy(res[i - 1], "FizzBuzz");\n        else if (i % 3 == 0) strcpy(res[i - 1], "Fizz");\n        else if (i % 5 == 0) strcpy(res[i - 1], "Buzz");\n        else sprintf(res[i - 1], "%d", i);\n    }\n    return res;\n}`,
        cpp: `#include <vector>\n#include <string>\nusing namespace std;\n\nclass Solution {\npublic:\n    vector<string> fizzBuzz(int n) {\n        vector<string> res;\n        for (int i = 1; i <= n; i++) {\n            if (i % 15 == 0) res.push_back("FizzBuzz");\n            else if (i % 3 == 0) res.push_back("Fizz");\n            else if (i % 5 == 0) res.push_back("Buzz");\n            else res.push_back(to_string(i));\n        }\n        return res;\n    }\n};`,
        java: `import java.util.*;\n\npublic class Solution {\n    public static List<String> fizzBuzz(int n) {\n        List<String> res = new ArrayList<>();\n        for (int i = 1; i <= n; i++) {\n            if (i % 15 == 0) res.add("FizzBuzz");\n            else if (i % 3 == 0) res.add("Fizz");\n            else if (i % 5 == 0) res.add("Buzz");\n            else res.add(String.valueOf(i));\n        }\n        return res;\n    }\n}`
      }),
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
      templates: JSON.stringify({
        javascript: `function findMax(nums) {\n  // Write your code here\n  return Math.max(...nums);\n}`,
        python: `def find_max(nums):\n    # Write your code here\n    return max(nums)`,
        c: `#include <stdio.h>\n\nint findMax(int* nums, int numsSize) {\n    int m = nums[0];\n    for (int i = 1; i < numsSize; i++) {\n        if (nums[i] > m) m = nums[i];\n    }\n    return m;\n}`,
        cpp: `#include <vector>\n#include <algorithm>\nusing namespace std;\n\nclass Solution {\npublic:\n    int findMax(vector<int>& nums) {\n        return *max_element(nums.begin(), nums.end());\n    }\n};`,
        java: `public class Solution {\n    public static int findMax(int[] nums) {\n        int max = nums[0];\n        for (int n : nums) {\n            if (n > max) max = n;\n        }\n        return max;\n    }\n}`
      }),
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
