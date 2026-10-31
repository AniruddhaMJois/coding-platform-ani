'use client';

import { useState, useEffect, useRef } from 'react';
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
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState(null);
  const [timeLeft, setTimeLeft] = useState(3600); // 1 hour
  const [liveNotice, setLiveNotice] = useState(null);

  // Keep a ref to current language and problem id for background sync
  const currentLangRef = useRef(language);
  currentLangRef.current = language;

  // 1. Initial Load
  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch('/api/problems', { cache: 'no-store' });
        const data = await res.json();
        if (data.problems) {
          setAllProblems(data.problems);
          const current = data.problems.find(p => p.slug === slug) || data.problems[0];
          setProblem(current);

          // Check if user has an explicitly saved draft in DB for this problem & language
          const draftRes = await fetch(`/api/drafts?problemId=${current.id}&language=${currentLangRef.current}`);
          const draftData = await draftRes.json();

          if (draftData.draft?.code) {
            setCode(draftData.draft.code);
            setLastSavedTime(new Date(draftData.draft.updatedAt).toLocaleTimeString());
            setHasUnsavedChanges(false);
          } else {
            setCode(current.templates[currentLangRef.current] || '// Write your solution here');
            setLastSavedTime(null);
            setHasUnsavedChanges(false);
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

  // 2. Real-time background sync for test cases and problem data
  const refreshProblemData = async (noticeText = null) => {
    try {
      const res = await fetch(`/api/problems?slug=${slug}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.problem) {
        setProblem(prev => {
          if (!prev) return data.problem;
          return {
            ...prev,
            ...data.problem,
            testCases: data.problem.testCases
          };
        });

        if (noticeText) {
          setLiveNotice(noticeText);
          setTimeout(() => setLiveNotice(null), 6000);
        }
      }
    } catch (e) {
      console.error('Failed to sync problem data:', e);
    }
  };

  useEffect(() => {
    // A. Listen via Server-Sent Events (cross-device & cross-browser real-time)
    let eventSource;
    try {
      eventSource = new EventSource('/api/events');
      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'TESTCASE_UPLOADED' || payload.type === 'TESTCASE_DELETED') {
            if (payload.slug === slug || !payload.slug) {
              const msg = payload.type === 'TESTCASE_UPLOADED'
                ? `⚡ Instructor uploaded ${payload.count || 1} new test case(s)! Live test suite updated.`
                : `⚡ Test cases updated by instructor!`;
              refreshProblemData(msg);
            }
          } else if (payload.type === 'CMS_UPDATE') {
            refreshProblemData('⚡ Problem refreshed by instructor.');
          }
        } catch (err) {}
      };
    } catch (e) {}

    // B. Listen via BroadcastChannel (same-browser instant cross-tab sync)
    let bc;
    try {
      bc = new BroadcastChannel('platform_cms_channel');
      bc.onmessage = (event) => {
        if (event.data?.type === 'TESTCASE_UPLOADED' || event.data?.type === 'TESTCASE_DELETED' || event.data?.type === 'CMS_UPDATE') {
          if (event.data.slug === slug || !event.data.slug) {
            refreshProblemData(event.data.message || '⚡ Test case update received from instructor!');
          }
        }
      };
    } catch (e) {}

    // C. Lightweight fallback polling every 3.5 seconds
    const interval = setInterval(() => {
      refreshProblemData(null);
    }, 3500);

    return () => {
      if (eventSource) eventSource.close();
      if (bc) bc.close();
      clearInterval(interval);
    };
  }, [slug]);

  // 3. Language switch handler (loads explicitly saved draft or template)
  const handleLanguageChange = async (newLang) => {
    setLanguage(newLang);
    if (!problem) return;

    try {
      const draftRes = await fetch(`/api/drafts?problemId=${problem.id}&language=${newLang}`);
      const draftData = await draftRes.json();

      if (draftData.draft?.code) {
        setCode(draftData.draft.code);
        setLastSavedTime(new Date(draftData.draft.updatedAt).toLocaleTimeString());
        setHasUnsavedChanges(false);
      } else {
        setCode(problem.templates?.[newLang] || '// Write your solution here');
        setLastSavedTime(null);
        setHasUnsavedChanges(false);
      }
    } catch (e) {
      setCode(problem.templates?.[newLang] || '// Write your solution here');
    }
  };

  // 4. Code change handler - flags unsaved changes
  const handleCodeChange = (newCode) => {
    setCode(newCode || '');
    setHasUnsavedChanges(true);
  };

  // 5. Explicit Save Code Handler (Saves to Database only on click)
  const handleSaveCode = async () => {
    if (!problem) return;
    setSaving(true);

    try {
      const res = await fetch('/api/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problemId: problem.id,
          language,
          code
        })
      });

      const data = await res.json();
      if (res.ok) {
        setHasUnsavedChanges(false);
        const timeStr = new Date(data.savedAt).toLocaleTimeString();
        setLastSavedTime(timeStr);
        setOutput(`Code draft saved successfully at ${timeStr}`);
      } else {
        alert(`Failed to save draft: ${data.error}`);
      }
    } catch (err) {
      alert(`Save error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // 6. Timer countdown
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

  // 7. Run Code (Public sample test cases only)
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

  // 8. Submit Code (Full hidden test evaluation)
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
      {/* Left Pane: Problem Description & Live Test Cases */}
      <div className="problem-panel">
        {/* Real-time Notification Banner */}
        {liveNotice && (
          <div 
            style={{ 
              background: 'linear-gradient(90deg, #1e1b4b, #312e81)', 
              border: '1px solid #818cf8', 
              color: '#c7d2fe', 
              padding: '0.65rem 1rem', 
              borderRadius: '8px', 
              marginBottom: '1rem',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
              animation: 'pulse 2s infinite'
            }}
          >
            <span>{liveNotice}</span>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Problem {currentIndex + 1} of {allProblems.length}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
              Live Sync
            </span>
            <span className={`badge ${problem.difficulty === 'Easy' ? 'badge-easy' : 'badge-medium'}`}>
              {problem.difficulty}
            </span>
          </div>
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

        {/* Public Sample Test Cases with Instant Live Sync */}
        <div style={{ marginTop: '1.5rem', borderTop: '1px solid #1f293d', paddingTop: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '1.05rem', margin: 0, color: '#fff' }}>
              Public Test Cases ({problem.testCases?.length || 0})
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#38bdf8' }}>
              Reflects updates instantly
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {problem.testCases && problem.testCases.length > 0 ? (
              problem.testCases.map((tc, idx) => (
                <div 
                  key={tc.id || idx} 
                  style={{ 
                    background: '#111827', 
                    borderRadius: '6px', 
                    padding: '0.75rem', 
                    border: '1px solid #1f2937' 
                  }}
                >
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#818cf8', marginBottom: '0.25rem' }}>
                    Case #{idx + 1}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '0.2rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Input:</span> <code>{tc.input || tc.stdin}</code>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#4ade80' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Expected:</span> <code>{tc.expected}</code>
                  </div>
                </div>
              ))
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No public test cases uploaded yet.
              </p>
            )}
          </div>
        </div>
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

            {/* Explicit Save Button & Status */}
            <button 
              onClick={handleSaveCode}
              disabled={saving}
              className="nav-btn"
              style={{
                borderColor: hasUnsavedChanges ? '#f59e0b' : '#334155',
                color: hasUnsavedChanges ? '#fbbf24' : '#94a3b8',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.8rem',
                padding: '0.35rem 0.65rem'
              }}
            >
              💾 {saving ? 'Saving...' : 'Save Draft'}
            </button>

            {hasUnsavedChanges ? (
              <span style={{ fontSize: '0.75rem', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                ● Unsaved
              </span>
            ) : lastSavedTime ? (
              <span style={{ fontSize: '0.75rem', color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                ✓ Saved ({lastSavedTime})
              </span>
            ) : null}
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
