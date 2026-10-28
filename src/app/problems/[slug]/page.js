'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Editor from '@monaco-editor/react';

export default function ProblemEditorPage({ params }) {
  const { slug } = params;

  const [problem, setProblem] = useState(null);
  const [allProblems, setAllProblems] = useState([]);
  const [language, setLanguage] = useState('javascript');
  const [code, setCode] = useState('');
  const [output, setOutput] = useState('');
  const [testResults, setTestResults] = useState([]);
  const [activeTab, setActiveTab] = useState('tests'); // 'tests' | 'output'
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [running, setRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(3600); // 1 hour

  // 1. Fetch problem and problem list
  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch('/api/problems');
        const data = await res.json();
        if (data.problems) {
          setAllProblems(data.problems);
          const current = data.problems.find(p => p.slug === slug) || data.problems[0];
          setProblem(current);

          // Restore saved draft or default template
          const savedCode = localStorage.getItem(`draft_${current.slug}_${language}`);
          if (savedCode) {
            setCode(savedCode);
          } else {
            setCode(current.templates[language] || '// Write your solution here');
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [slug]);

  // 2. Language switch handler with local draft persistence
  const handleLanguageChange = (newLang) => {
    // Save current draft
    if (problem) {
      localStorage.setItem(`draft_${problem.slug}_${language}`, code);
    }
    setLanguage(newLang);
    // Load existing draft or template
    const saved = localStorage.getItem(`draft_${problem?.slug}_${newLang}`);
    if (saved) {
      setCode(saved);
    } else if (problem?.templates?.[newLang]) {
      setCode(problem.templates[newLang]);
    }
  };

  // 3. Code change handler
  const handleCodeChange = (newCode) => {
    setCode(newCode || '');
    if (problem) {
      localStorage.setItem(`draft_${problem.slug}_${language}`, newCode || '');
    }
  };

  // 4. Timer countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // 5. Run Code (Public sample test cases only)
  const handleRunCode = async () => {
    if (!problem) return;
    setRunning(true);
    setActiveTab('tests');
    setOutput('Running public test cases...');

    try {
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problemId: problem.id,
          slug: problem.slug,
          language,
          code
        })
      });

      const data = await res.json();
      if (data.error) {
        setOutput(`Execution Error: ${data.error}`);
        setTestResults([]);
      } else {
        setTestResults(data.results || []);
        const passedCount = data.results.filter(r => r.passed).length;
        setOutput(`Tests Completed: ${passedCount}/${data.results.length} passed.`);
      }
    } catch (err) {
      setOutput(`Network Error: ${err.message}`);
    } finally {
      setRunning(false);
    }
  };

  // 6. Submit Code (Full hidden test evaluation)
  const handleSubmitCode = async () => {
    if (!problem) return;
    setSubmitting(true);
    setActiveTab('tests');
    setOutput('Grading submission against full test suite...');

    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problemId: problem.id,
          slug: problem.slug,
          language,
          code
        })
      });

      const data = await res.json();
      if (data.error) {
        setOutput(`Submission Error: ${data.error}`);
      } else {
        setTestResults(data.results || []);
        setOutput(
          `Status: ${data.status} | Score: ${data.score}% (${data.passedTests}/${data.totalTests} tests passed)\nSubmission recorded in database with ID #${data.submissionId}`
        );
      }
    } catch (err) {
      setOutput(`Network Error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !problem) {
    return (
      <div className="container" style={{ textAlign: 'center', padding: '4rem' }}>
        <h2>Loading challenge environment...</h2>
      </div>
    );
  }

  const currentIndex = allProblems.findIndex(p => p.slug === problem.slug);
  const prevProblem = currentIndex > 0 ? allProblems[currentIndex - 1] : null;
  const nextProblem = currentIndex < allProblems.length - 1 ? allProblems[currentIndex + 1] : null;

  return (
    <div className="editor-layout">
      {/* Left Pane: Problem Description */}
      <div className="problem-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Problem {currentIndex + 1} of {allProblems.length}
          </span>
          <span className={`badge ${problem.difficulty === 'Easy' ? 'badge-easy' : 'badge-medium'}`}>
            {problem.difficulty}
          </span>
        </div>

        <h1 style={{ fontSize: '1.75rem', marginBottom: '1rem', color: '#fff' }}>
          {problem.title}
        </h1>

        <p style={{ lineHeight: '1.6', color: '#cbd5e1', marginBottom: '1.5rem', whiteSpace: 'pre-line' }}>
          {problem.description}
        </p>

        <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', color: '#fff' }}>Constraints</h3>
        <ul style={{ paddingLeft: '1.25rem', marginBottom: '1.5rem', color: 'var(--text-muted)' }}>
          {problem.constraints?.map((c, i) => (
            <li key={i} style={{ marginBottom: '0.35rem' }}><code>{c}</code></li>
          ))}
        </ul>

        <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', color: '#fff' }}>Sample Input</h3>
        <pre style={{ background: '#111827', padding: '0.75rem', borderRadius: '6px', marginBottom: '1rem', color: '#38bdf8' }}>
          {problem.sampleInput}
        </pre>

        <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', color: '#fff' }}>Sample Output</h3>
        <pre style={{ background: '#111827', padding: '0.75rem', borderRadius: '6px', marginBottom: '1.5rem', color: '#4ade80' }}>
          {problem.sampleOutput}
        </pre>
      </div>

      {/* Right Pane: Code Editor & Execution Console */}
      <div className="code-panel">
        {/* Editor Toolbar */}
        <div className="editor-toolbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {prevProblem ? (
              <Link href={`/problems/${prevProblem.slug}`} className="nav-btn">
                ← Prev
              </Link>
            ) : (
              <button disabled className="nav-btn" style={{ opacity: 0.4, cursor: 'not-allowed' }}>
                ← Prev
              </button>
            )}

            {nextProblem ? (
              <Link href={`/problems/${nextProblem.slug}`} className="nav-btn">
                Next →
              </Link>
            ) : (
              <button disabled className="nav-btn" style={{ opacity: 0.4, cursor: 'not-allowed' }}>
                Next →
              </button>
            )}

            <select value={language} onChange={(e) => handleLanguageChange(e.target.value)}>
              <option value="javascript">JavaScript (Node.js)</option>
              <option value="python">Python 3</option>
              <option value="c">C (GCC)</option>
              <option value="cpp">C++ (G++)</option>
              <option value="java">Java (JDK)</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span className="timer-badge">
              ⏳ {formatTime(timeLeft)}
            </span>

            <button 
              onClick={handleRunCode} 
              disabled={running || submitting} 
              className="btn-run"
            >
              {running ? 'Running...' : 'Run Code'}
            </button>

            <button 
              onClick={handleSubmitCode} 
              disabled={running || submitting} 
              className="btn-submit"
            >
              {submitting ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </div>

        {/* Monaco Editor */}
        <div style={{ flex: 1, minHeight: '300px' }}>
          <Editor
            height="100%"
            language={language === 'c' || language === 'cpp' ? 'cpp' : language}
            theme="vs-dark"
            value={code}
            onChange={handleCodeChange}
            options={{
              fontSize: 14,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2
            }}
          />
        </div>

        {/* Execution Output Console */}
        <div className="console-panel">
          <div className="console-tabs">
            <div 
              className={`console-tab ${activeTab === 'tests' ? 'active' : ''}`}
              onClick={() => setActiveTab('tests')}
            >
              Test Results {testResults.length > 0 && `(${testResults.filter(r => r.passed).length}/${testResults.length})`}
            </div>
            <div 
              className={`console-tab ${activeTab === 'output' ? 'active' : ''}`}
              onClick={() => setActiveTab('output')}
            >
              Console Output
            </div>
          </div>

          <div className="console-content">
            {activeTab === 'tests' ? (
              <div>
                {testResults.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)' }}>
                    Click &quot;Run Code&quot; to test sample cases or &quot;Submit&quot; for complete grading.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {testResults.map((t, idx) => (
                      <div 
                        key={idx} 
                        style={{ 
                          padding: '0.5rem 0.75rem', 
                          background: t.passed ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                          border: `1px solid ${t.passed ? '#10b981' : '#ef4444'}`,
                          borderRadius: '6px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                          <span style={{ color: t.passed ? '#34d399' : '#f87171' }}>
                            Test Case #{idx + 1}: {t.passed ? 'Passed ✓' : 'Failed ✗'}
                          </span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                            {t.timeMs !== undefined ? `${t.timeMs}ms` : ''}
                          </span>
                        </div>
                        {t.stderr && (
                          <div style={{ color: '#f87171', marginTop: '0.35rem' }}>
                            {t.stderr}
                          </div>
                        )}
                        {!t.passed && t.expected && (
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                            Expected: <code>{t.expected}</code> | Got: <code>{t.stdout || 'None'}</code>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <pre style={{ color: '#e2e8f0', whiteSpace: 'pre-wrap' }}>
                {output || 'No output recorded.'}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
