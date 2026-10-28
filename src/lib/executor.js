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
  switch (lang) {
    case 'python':
      return `
import sys, json

${userCode}

if __name__ == '__main__':
    raw = sys.stdin.read().strip()
    # Try calling detected function
    fn = globals().get('${funcName}') or globals().get('two_sum') or globals().get('reverse_string') or globals().get('is_palindrome') or globals().get('fizz_buzz') or globals().get('find_max') or globals().get('solve')
    if fn and callable(fn):
        lines = [line.strip() for line in raw.split('\\n') if line.strip()]
        try:
            # Handle standard problem formats
            if len(lines) == 1 and ',' in lines[0] and not lines[0].startswith('['):
                parts = [p.strip() for p in lines[0].split(',')]
                res = fn(*parts)
            elif len(lines) == 2:
                # Array and target or length and array
                try:
                    p1 = json.loads(lines[0])
                except:
                    p1 = [int(x) for x in lines[0].split()] if all(x.lstrip('-').isdigit() for x in lines[0].split()) else lines[0]
                try:
                    p2 = int(lines[1])
                except:
                    p2 = lines[1]
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
                    res = fn([int(x) for x in arg.split()])
                else:
                    res = fn(arg)
            else:
                res = fn(raw)
            if res is not None:
                if isinstance(res, bool):
                    print('true' if res else 'false')
                elif isinstance(res, (list, dict)):
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
    (typeof twoSum === 'function') ? twoSum :
    (typeof reverseString === 'function') ? reverseString :
    (typeof isPalindrome === 'function') ? isPalindrome :
    (typeof fizzBuzz === 'function') ? fizzBuzz :
    (typeof findMax === 'function') ? findMax : null;

  if (fn) {
    const lines = raw.split('\\n').map(l => l.trim()).filter(Boolean);
    let res;
    if (lines.length === 2) {
      let p1, p2;
      try { p1 = JSON.parse(lines[0]); } catch(e) {
        p1 = lines[0].split(' ').map(Number);
      }
      p2 = isNaN(Number(lines[1])) ? lines[1] : Number(lines[1]);
      try { res = fn(p1, p2); } catch(e) { res = fn(p1); }
    } else if (lines.length === 1) {
      const arg = lines[0];
      if (!isNaN(Number(arg)) && arg !== '') {
        res = fn(Number(arg));
      } else if (arg.startsWith('[') && arg.endsWith(']')) {
        res = fn(JSON.parse(arg));
      } else if (arg.includes(' ') && arg.split(' ').every(x => !isNaN(Number(x)))) {
        res = fn(arg.split(' ').map(Number));
      } else {
        res = fn(arg);
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
    
    // Execute via Native Fallback (or Docker when configured)
    const execRes = await runNative(language, wrappedCode, stdin, timeLimitMs);

    if (execRes.compileError) {
      results.push({
        passed: false,
        stdout: '',
        stderr: execRes.compileError,
        compileError: execRes.compileError,
        exitCode: execRes.code,
        timeMs: execRes.timeMs,
        expected: test.expected
      });
      break; // Abort remaining tests on compilation error
    }

    const actual = normalize(execRes.stdout);
    const expected = normalize(test.expected);
    const passed = (execRes.code === 0) && (actual === expected);

    results.push({
      passed,
      stdout: execRes.stdout.trim(),
      stderr: execRes.stderr.trim(),
      exitCode: execRes.code,
      timeMs: execRes.timeMs,
      expected: test.expected,
      input: test.input || stdin
    });
  }

  return results;
}

module.exports = {
  executeSubmission,
  checkDocker,
  wrapUserCode
};
