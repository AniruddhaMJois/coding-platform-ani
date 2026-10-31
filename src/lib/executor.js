const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execSync } = require('child_process');

function execSpawn(cmd, args, opts = {}, stdinData = null, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let child;
    try {
      child = spawn(cmd, args, opts);
    } catch (err) {
      return resolve({
        code: 1,
        stdout: '',
        stderr: err.message,
        timeMs: 0,
        killed: false
      });
    }

    let stdout = '';
    let stderr = '';
    let finished = false;

    const timer = setTimeout(() => {
      if (!finished) {
        finished = true;
        try {
          child.kill('SIGKILL');
        } catch (e) {}
        resolve({
          code: 124,
          stdout,
          stderr: 'Time Limit Exceeded (execution timed out)',
          timeMs: timeoutMs,
          killed: true
        });
      }
    }, timeoutMs);

    if (stdinData && child.stdin) {
      try {
        child.stdin.write(stdinData);
        child.stdin.end();
      } catch (e) {}
    }

    if (child.stdout) child.stdout.on('data', d => stdout += d.toString());
    if (child.stderr) child.stderr.on('data', d => stderr += d.toString());

    child.on('error', (err) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve({
        code: 1,
        stdout,
        stderr: err.message,
        timeMs: Date.now() - startTime,
        killed: false
      });
    });

    child.on('close', (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve({
        code: code ?? 0,
        stdout,
        stderr,
        timeMs: Date.now() - startTime,
        killed: false
      });
    });
  });
}

// Check if Docker is available
let isDockerAvailable = null;
function checkDocker() {
  if (isDockerAvailable !== null) return isDockerAvailable;
  try {
    execSync('docker info', { stdio: 'ignore', timeout: 2000 });
    isDockerAvailable = true;
  } catch (e) {
    isDockerAvailable = false;
  }
  return isDockerAvailable;
}

// Wrap user code to handle execution
function wrapUserCode(language, userCode, funcName = null) {
  const lang = (language || '').toLowerCase();

  // If user code contains its own entry point / standard I/O, run directly without wrapping
  if (lang === 'python' && (userCode.includes('if __name__') || userCode.includes('sys.stdin'))) {
    return userCode;
  }
  if ((lang === 'javascript' || lang === 'js') && (userCode.includes('fs.readFileSync') || userCode.includes('readline') || userCode.includes('process.stdin'))) {
    return userCode;
  }
  if ((lang === 'c' || lang === 'cpp' || lang === 'c++') && userCode.includes('main(')) {
    return userCode;
  }
  if (lang === 'java' && userCode.includes('public static void main')) {
    return userCode;
  }

  switch (lang) {
    case 'python':
      return `
import sys, json

${userCode}

if __name__ == '__main__':
    raw = sys.stdin.read().strip()
    # Try calling detected function
    fn = (globals().get('${funcName}') or 
          globals().get('add') or globals().get('add_two_numbers') or 
          globals().get('multiply') or globals().get('multiply_two_numbers') or 
          globals().get('even_or_odd') or globals().get('is_even_or_odd') or globals().get('is_even') or 
          globals().get('find_max') or globals().get('max') or globals().get('maximum_of_two_numbers') or 
          globals().get('square') or globals().get('square_of_number') or 
          globals().get('solve') or globals().get('two_sum') or globals().get('reverse_string') or 
          globals().get('is_palindrome') or globals().get('fizz_buzz'))
    if fn and callable(fn):
        lines = [line.strip() for line in raw.split('\\n') if line.strip()]
        try:
            # 3 lines: e.g. length, array, target (Two Sum)
            if len(lines) == 3:
                nums = [int(x) for x in lines[1].split()]
                target = int(lines[2])
                try:
                    res = fn(nums, target)
                except TypeError:
                    res = fn(int(lines[0]), nums, target)
            elif len(lines) == 2:
                try:
                    p1 = json.loads(lines[0])
                except:
                    p1 = [int(x) for x in lines[0].split()] if (lines[0].split() and all(x.lstrip('-').isdigit() for x in lines[0].split())) else (int(lines[0]) if lines[0].lstrip('-').isdigit() else lines[0])
                try:
                    p2 = json.loads(lines[1])
                except:
                    p2 = [int(x) for x in lines[1].split()] if (lines[1].split() and all(x.lstrip('-').isdigit() for x in lines[1].split())) else (int(lines[1]) if lines[1].lstrip('-').isdigit() else lines[1])

                if isinstance(p1, int) and isinstance(p2, list):
                    try:
                        res = fn(p2)
                    except TypeError:
                        res = fn(p1, p2)
                else:
                    try:
                        res = fn(p1, p2)
                    except TypeError:
                        res = fn(p1)
            elif len(lines) == 1:
                arg = lines[0]
                if arg.lstrip('-').isdigit():
                    res = fn(int(arg))
                elif arg.startswith('[') and arg.endswith(']'):
                    res = fn(json.loads(arg))
                elif ' ' in arg and all(x.lstrip('-').isdigit() for x in arg.split()):
                    nums = [int(x) for x in arg.split()]
                    try:
                        res = fn(*nums)
                    except TypeError:
                        res = fn(nums)
                else:
                    try:
                        res = fn(list(arg))
                    except:
                        res = fn(arg)
            else:
                res = fn(raw)

            if res is not None:
                if isinstance(res, bool):
                    print('true' if res else 'false')
                elif isinstance(res, (list, tuple)):
                    print(json.dumps(list(res), separators=(',', ':')))
                elif isinstance(res, dict):
                    print(json.dumps(res, separators=(',', ':')))
                else:
                    print(res)
        except Exception as e:
            sys.stderr.write(str(e) + '\\n')
            sys.exit(1)
`;

    case 'javascript':
    case 'js':
      return `
const fs = require('fs');

${userCode}

try {
  const raw = fs.readFileSync(0, 'utf8').trim();
  const fn = (typeof ${funcName || 'undefined'} === 'function') ? ${funcName} :
    (typeof add === 'function') ? add :
    (typeof addTwoNumbers === 'function') ? addTwoNumbers :
    (typeof multiply === 'function') ? multiply :
    (typeof multiplyTwoNumbers === 'function') ? multiplyTwoNumbers :
    (typeof evenOrOdd === 'function') ? evenOrOdd :
    (typeof isEvenOrOdd === 'function') ? isEvenOrOdd :
    (typeof isEven === 'function') ? isEven :
    (typeof findMax === 'function') ? findMax :
    (typeof max === 'function') ? max :
    (typeof maximumOfTwoNumbers === 'function') ? maximumOfTwoNumbers :
    (typeof square === 'function') ? square :
    (typeof squareOfNumber === 'function') ? squareOfNumber :
    (typeof solve === 'function') ? solve :
    (typeof solution === 'function') ? solution :
    (typeof twoSum === 'function') ? twoSum :
    (typeof reverseString === 'function') ? reverseString :
    (typeof isPalindrome === 'function') ? isPalindrome :
    (typeof fizzBuzz === 'function') ? fizzBuzz : null;

  if (fn) {
    const lines = raw.split('\\n').map(l => l.trim()).filter(Boolean);
    let res;
    if (lines.length === 3) {
      const nums = lines[1].split(' ').map(Number);
      const target = Number(lines[2]);
      try { res = fn(nums, target); } catch(e) { res = fn(Number(lines[0]), nums, target); }
    } else if (lines.length === 2) {
      let p1, p2;
      try { p1 = JSON.parse(lines[0]); } catch(e) {
        p1 = lines[0].split(' ').length > 1 ? lines[0].split(' ').map(Number) : (isNaN(Number(lines[0])) ? lines[0] : Number(lines[0]));
      }
      try { p2 = JSON.parse(lines[1]); } catch(e) {
        p2 = lines[1].split(' ').length > 1 ? lines[1].split(' ').map(Number) : (isNaN(Number(lines[1])) ? lines[1] : Number(lines[1]));
      }
      if (typeof p1 === 'number' && Array.isArray(p2)) {
        try { res = fn(p2); } catch(e) { res = fn(p1, p2); }
      } else {
        try { res = fn(p1, p2); } catch(e) { res = fn(p1); }
      }
    } else if (lines.length === 1) {
      const arg = lines[0];
      if (!isNaN(Number(arg)) && arg !== '') {
        res = fn(Number(arg));
      } else if (arg.startsWith('[') && arg.endsWith(']')) {
        res = fn(JSON.parse(arg));
      } else if (arg.includes(' ') && arg.split(' ').every(x => !isNaN(Number(x)))) {
        const nums = arg.split(' ').map(Number);
        try { res = fn(...nums); } catch(e) { res = fn(nums); }
      } else {
        try {
          res = fn(arg.split(''));
        } catch(e) {
          res = fn(arg);
        }
      }
    } else {
      res = fn(raw);
    }
    if (res !== undefined && res !== null) {
      if (typeof res === 'object') {
        console.log(JSON.stringify(res));
      } else {
        console.log(String(res));
      }
    }
  }
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
`;

    case 'java':
      return `
import java.util.*;
import java.io.*;

${userCode}

public class Main {
    public static void main(String[] args) throws Exception {
        BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));
        StringBuilder sb = new StringBuilder();
        String line;
        while ((line = reader.readLine()) != null) {
            sb.append(line).append("\\n");
        }
        String input = sb.toString().trim();
        Solution sol = new Solution();
        
        // Output handled by user code or invoked method
        System.out.println(input);
    }
}
`;

    case 'c':
    case 'cpp':
    case 'c++':
      return `
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdbool.h>

${userCode}

int main() {
    // Basic runner stub
    return 0;
}
`;

    default:
      return userCode;
  }
}

// Native execution fallback
async function runNative(language, code, stdin, timeLimitMs) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exec-'));
  const lang = language.toLowerCase();

  try {
    if (lang === 'javascript' || lang === 'js') {
      const filePath = path.join(tmpDir, 'solution.js');
      fs.writeFileSync(filePath, code, 'utf8');
      return await execSpawn('node', [filePath], { cwd: tmpDir }, stdin, timeLimitMs);
    }

    if (lang === 'python') {
      const filePath = path.join(tmpDir, 'solution.py');
      fs.writeFileSync(filePath, code, 'utf8');
      return await execSpawn('python3', [filePath], { cwd: tmpDir }, stdin, timeLimitMs);
    }

    if (lang === 'c') {
      const filePath = path.join(tmpDir, 'solution.c');
      const binPath = path.join(tmpDir, 'solution');
      fs.writeFileSync(filePath, code, 'utf8');
      const compile = await execSpawn('gcc', ['-O2', '-o', binPath, filePath], { cwd: tmpDir }, null, 10000);
      if (compile.code !== 0) {
        return { ...compile, compileError: compile.stderr };
      }
      return await execSpawn(binPath, [], { cwd: tmpDir }, stdin, timeLimitMs);
    }

    if (lang === 'cpp' || lang === 'c++') {
      const filePath = path.join(tmpDir, 'solution.cpp');
      const binPath = path.join(tmpDir, 'solution');
      fs.writeFileSync(filePath, code, 'utf8');
      const compile = await execSpawn('g++', ['-O2', '-o', binPath, filePath], { cwd: tmpDir }, null, 10000);
      if (compile.code !== 0) {
        return { ...compile, compileError: compile.stderr };
      }
      return await execSpawn(binPath, [], { cwd: tmpDir }, stdin, timeLimitMs);
    }

    if (lang === 'java') {
      const filePath = path.join(tmpDir, 'Main.java');
      fs.writeFileSync(filePath, code, 'utf8');
      const compile = await execSpawn('javac', [filePath], { cwd: tmpDir }, null, 15000);
      if (compile.code !== 0) {
        return { ...compile, compileError: compile.stderr };
      }
      return await execSpawn('java', ['Main'], { cwd: tmpDir }, stdin, timeLimitMs);
    }

    return { code: 1, stdout: '', stderr: `Unsupported language: ${language}`, timeMs: 0 };
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

// Judge0 CE Language IDs (open standard sandbox)
const JUDGE0_LANGUAGE_IDS = {
  python: 92, // Python 3.11.2
  javascript: 93, // Node.js 18.15.0
  js: 93,
  c: 103, // GCC 14.1.0
  cpp: 105, // G++ 14.1.0
  'c++': 105,
  java: 91 // JDK 17.0.6
};

// Execute code in remote isolated Linux sandbox (works on Vercel, any cloud, and any OS)
async function runJudge0(language, code, stdin, timeLimitMs = 2000) {
  const langKey = (language || '').toLowerCase();
  const langId = JUDGE0_LANGUAGE_IDS[langKey];
  if (!langId) {
    throw new Error(`Unsupported language for sandbox: ${language}`);
  }

  const endpoint = process.env.JUDGE0_URL || 'https://ce.judge0.com';
  const cpuTimeLimit = Math.max(1, Math.min(10, Math.ceil(timeLimitMs / 1000)));

  const res = await fetch(`${endpoint}/submissions?base64_encoded=false&wait=true`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.JUDGE0_API_KEY ? { 'X-RapidAPI-Key': process.env.JUDGE0_API_KEY } : {})
    },
    body: JSON.stringify({
      source_code: code,
      language_id: langId,
      stdin: stdin || '',
      cpu_time_limit: cpuTimeLimit,
      memory_limit: 128000 // 128 MB max memory
    })
  });

  if (!res.ok) {
    throw new Error(`Judge0 API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const stdout = data.stdout || '';
  const stderr = data.stderr || data.compile_output || '';
  const isCompileError = data.status?.id === 6; // Compilation Error
  const isTLE = data.status?.id === 5; // Time Limit Exceeded

  return {
    code: data.status?.id === 3 ? 0 : (data.exit_code ?? 1),
    stdout,
    stderr: isTLE ? 'Time Limit Exceeded (execution timed out)' : stderr,
    compileError: isCompileError ? stderr : null,
    timeMs: data.time ? Math.round(parseFloat(data.time) * 1000) : 0,
    memoryKb: data.memory,
    isTLE
  };
}

// Normalize output for matching
function normalize(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\[\s+/g, '[')
    .replace(/\s+\]/g, ']')
    .replace(/,\s+/g, ',');
}

// Main execution function
async function executeSubmission({ language, code, tests = [], timeLimitMs = 2000, funcName = null }) {
  const wrappedCode = wrapUserCode(language, code, funcName);
  const results = [];

  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    const stdin = test.stdin || (typeof test.input === 'string' ? test.input : JSON.stringify(test.input)) || '';
    
    let execRes;
    // Primary: Run in cloud sandbox (Vercel-ready, 100% OS-independent, safe from malicious scripts)
    try {
      execRes = await runJudge0(language, wrappedCode, stdin, timeLimitMs);
    } catch (sandboxErr) {
      // Fallback: If offline or remote sandbox fails, run locally via native process if available
      try {
        execRes = await runNative(language, wrappedCode, stdin, timeLimitMs);
      } catch (nativeErr) {
        execRes = { code: 1, stdout: '', stderr: `Execution failed: ${sandboxErr.message}`, timeMs: 0 };
      }
    }

    const isHidden = Boolean(test.isHidden);

    if (execRes.compileError) {
      results.push({
        passed: false,
        stdout: '',
        stderr: execRes.compileError,
        compileError: execRes.compileError,
        exitCode: execRes.code,
        timeMs: execRes.timeMs,
        expected: isHidden ? null : test.expected,
        input: isHidden ? null : (test.input || stdin),
        isHidden
      });
      break; // Abort remaining tests on compilation error
    }

    const actual = normalize(execRes.stdout);
    const expected = normalize(test.expected);
    const passed = (execRes.code === 0) && (actual === expected);

    results.push({
      passed,
      stdout: isHidden ? '[Hidden Evaluation Case]' : execRes.stdout.trim(),
      stderr: isHidden ? (execRes.stderr ? 'Runtime exception on hidden case' : '') : execRes.stderr.trim(),
      exitCode: execRes.code,
      timeMs: execRes.timeMs,
      expected: isHidden ? null : test.expected,
      input: isHidden ? null : (test.input || stdin),
      isHidden
    });
  }

  return results;
}

module.exports = {
  executeSubmission,
  checkDocker,
  wrapUserCode,
  runJudge0
};
