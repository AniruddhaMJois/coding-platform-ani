'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Editor from '@monaco-editor/react';

const CONTEST_DURATION_SECONDS = 3600; // 1 hour

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
  const [draftSavedNotice, setDraftSavedNotice] = useState(false);
  const [liveNotice, setLiveNotice] = useState(null);

  // User, Anti-Cheat & Timer states
  const [currentUser, setCurrentUser] = useState(null);
  const [timeLeft, setTimeLeft] = useState(CONTEST_DURATION_SECONDS);
  const [isExpired, setIsExpired] = useState(false);
  const [violations, setViolations] = useState(0);
  const [showViolationModal, setShowViolationModal] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isSolved, setIsSolved] = useState(false);
  const [antiCheatToast, setAntiCheatToast] = useState(null);

  // Keep a ref to latest code & language for auto-submit
  const currentLangRef = useRef(language);
  currentLangRef.current = language;
  const currentCodeRef = useRef(code);
  currentCodeRef.current = code;
  const isLockedRef = useRef(isLocked);
  isLockedRef.current = isLocked;
  const isExpiredRef = useRef(isExpired);
  isExpiredRef.current = isExpired;

  // 1. Initialize Active User & Coding Session Timer
  useEffect(() => {
    async function initUserAndSession() {
      let user = null;
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem('platform_user');
        if (cached) {
          try {
            user = JSON.parse(cached);
            setCurrentUser(user);
          } catch (e) {}
        }
      }

      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (data.user) {
          user = data.user;
          setCurrentUser(user);
        }
      } catch (e) {}

      // If user is Admin, they are evaluating/managing problems: timer & locks do not apply
      if (user?.role === 'admin') {
        setTimeLeft(CONTEST_DURATION_SECONDS);
        return;
      }

      // If Participant: load active session remaining seconds from sessionStorage
      const userKey = user?.id ? `_${user.id}` : '';
      const savedTime = sessionStorage.getItem(`platform_session_time${userKey}`);
      let remaining = savedTime !== null ? parseInt(savedTime, 10) : CONTEST_DURATION_SECONDS;
      if (isNaN(remaining) || remaining < 0) remaining = CONTEST_DURATION_SECONDS;

      setTimeLeft(remaining);
      if (remaining <= 0) {
        setIsExpired(true);
      }

      const savedViolations = parseInt(sessionStorage.getItem(`platform_tab_violations${userKey}`) || '0', 10);
      setViolations(savedViolations);
      if (savedViolations >= 3) {
        setIsLocked(true);
      }
    }

    initUserAndSession();
  }, []);

  // 2. Active Coding Session Countdown: ONLY ticks while on this page, NEVER in the background
  useEffect(() => {
    // Only countdown if participant is logged in and active in this coding session
    if (!currentUser || currentUser.role !== 'participant' || isLocked || isExpired) {
      return;
    }

    const userKey = currentUser?.id ? `_${currentUser.id}` : '';

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsExpired(true);
          sessionStorage.setItem(`platform_session_time${userKey}`, '0');
          return 0;
        }
        const next = prev - 1;
        sessionStorage.setItem(`platform_session_time${userKey}`, next.toString());
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentUser, isLocked, isExpired]);

  // 3. Initial Load of Problem & Saved Draft from Supabase
  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch('/api/problems', { cache: 'no-store' });
        const data = await res.json();
        if (data.problems) {
          setAllProblems(data.problems);
          const current = data.problems.find(p => p.slug === slug) || data.problems[0];
          setProblem(current);

          if (current.isSolved) {
            setIsSolved(true);
          }

          // Fetch explicit draft from database
          const draftRes = await fetch(`/api/drafts?problemId=${current.id}&language=${currentLangRef.current}`);
          const draftData = await draftRes.json();

          if (draftData.draft?.code) {
            setCode(draftData.draft.code);
            setLastSavedTime(new Date(draftData.draft.updatedAt).toLocaleTimeString());
            setHasUnsavedChanges(false);
          } else if (current.acceptedSubmission?.code) {
            setCode(current.acceptedSubmission.code);
            if (current.acceptedSubmission.language) {
              setLanguage(current.acceptedSubmission.language);
            }
            setLastSavedTime(new Date(current.acceptedSubmission.createdAt).toLocaleTimeString());
            setHasUnsavedChanges(false);
          } else {
            setCode(''); // Clean empty editor - no pre-existing code
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

  // 4. Real-time background sync for test cases and problem data
  const refreshProblemData = async (noticeText = null) => {
    try {
      const res = await fetch(`/api/problems?slug=${slug}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.problem) {
        if (data.problem.isSolved) {
          setIsSolved(true);
        }
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
    // A. Server-Sent Events (SSE)
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

    // B. BroadcastChannel
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

    // C. Fallback Polling every 4 seconds
    const interval = setInterval(() => {
      refreshProblemData(null);
    }, 4000);

    return () => {
      if (eventSource) eventSource.close();
      if (bc) bc.close();
      clearInterval(interval);
    };
  }, [slug]);

  // 5. Anti-Cheat: Copy/Paste Interception (Set ALLOW_COPY_PASTE to true/false)
  const ALLOW_COPY_PASTE = true; // Set to false when re-enabling anti-cheat enforcement

  useEffect(() => {
    if (ALLOW_COPY_PASTE) return; // Copy & paste allowed for testing
    if (!currentUser || currentUser.role !== 'participant') return;

    const handlePaste = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setAntiCheatToast('🚫 Copy & Paste is strictly disabled during this contest!');
      setTimeout(() => setAntiCheatToast(null), 3500);
    };

    const handleCopyCut = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setAntiCheatToast('🚫 Copying code out of the contest editor is disabled!');
      setTimeout(() => setAntiCheatToast(null), 3500);
    };

    const handleKeyDown = (e) => {
      // Intercept Ctrl+V / Cmd+V / Ctrl+C / Cmd+C / Ctrl+X / Cmd+X
      const isCmdOrCtrl = e.ctrlKey || e.metaKey;
      if (isCmdOrCtrl && (e.key === 'v' || e.key === 'V')) {
        e.preventDefault();
        e.stopPropagation();
        setAntiCheatToast('🚫 Pasting (Ctrl+V / Cmd+V) is blocked by the anti-cheat system!');
        setTimeout(() => setAntiCheatToast(null), 3500);
      } else if (isCmdOrCtrl && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        e.stopPropagation();
        setAntiCheatToast('🚫 Copying (Ctrl+C / Cmd+C) is blocked by the anti-cheat system!');
        setTimeout(() => setAntiCheatToast(null), 3500);
      } else if (isCmdOrCtrl && (e.key === 'x' || e.key === 'X')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener('paste', handlePaste, true);
    window.addEventListener('copy', handleCopyCut, true);
    window.addEventListener('cut', handleCopyCut, true);
    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.removeEventListener('paste', handlePaste, true);
      window.removeEventListener('copy', handleCopyCut, true);
      window.removeEventListener('cut', handleCopyCut, true);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [currentUser]);

  // 6. Auto-submit handler (called on Timeout or 3rd Strike)
  const handleAutoSubmit = useCallback(async (reason) => {
    if (!problem) return;
    try {
      await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problemId: problem.id,
          slug: problem.slug,
          language: currentLangRef.current,
          code: currentCodeRef.current
        })
      });
      setOutput(`Auto-submitted: ${reason}`);
    } catch (e) {
      console.error(e);
    }
  }, [problem]);

  // 7. Anti-Cheat: Tab Switching ONLY for Participants inside active coding session
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'participant') return;

    const userKey = currentUser?.id ? `_${currentUser.id}` : '';

    const handleVisibilityChange = () => {
      if (document.hidden && !isLockedRef.current && !isExpiredRef.current) {
        setViolations(prev => {
          const nextCount = prev + 1;
          sessionStorage.setItem(`platform_tab_violations${userKey}`, nextCount.toString());
          setShowViolationModal(true);

          if (nextCount >= 3) {
            setIsLocked(true);
            // Auto submit on 3rd violation strike
            handleAutoSubmit('Disqualified: 3 tab switch violations detected.');
          }
          return nextCount;
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [currentUser, handleAutoSubmit]);

  // 8. Warn before closing or navigating away if unsaved changes exist
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges && !isSolved) {
        e.preventDefault();
        e.returnValue = 'You have unsaved code. Please click Save Draft before leaving.';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges, isSolved]);

  // Handle Timeout trigger
  useEffect(() => {
    if (isExpired && !isLocked) {
      handleAutoSubmit('Contest time has expired.');
    }
  }, [isExpired, isLocked, handleAutoSubmit]);

  // 9. Language switch handler (loads explicitly saved draft or template)
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
        setCode(''); // Keep empty
        setLastSavedTime(null);
        setHasUnsavedChanges(false);
      }
    } catch (e) {
      setCode('');
    }
  };

  // 10. Code change handler - flags unsaved changes
  const handleCodeChange = (newCode) => {
    if (isLocked || isExpired || isSolved) return;
    setCode(newCode || '');
    setHasUnsavedChanges(true);
  };

  // 11. Explicit Save Code Handler (Efficient DB persistence)
  const handleSaveCode = async () => {
    if (!problem || isLocked || isExpired || isSolved) return;
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
        setDraftSavedNotice(true);
        setTimeout(() => setDraftSavedNotice(false), 3000);
        setOutput(`Code draft saved successfully to database at ${timeStr}`);
      } else {
        alert(`Failed to save draft: ${data.error}`);
        if (data.error?.includes('already solved')) {
          setIsSolved(true);
        }
      }
    } catch (err) {
      alert(`Save error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // 12. Run Code (Public sample test cases only)
  const handleRunCode = async () => {
    if (!problem || isLocked || isExpired || isSolved) return;
    setRunning(true);
    setActiveTab('tests');
    setOutput('Running public test cases in isolated sandbox...');

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
        if (data.isSolved) {
          setIsSolved(true);
        }
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

  // 13. Submit Code (Full hidden test evaluation)
  const handleSubmitCode = async () => {
    if (!problem || isLocked || isExpired || isSolved) return;
    setSubmitting(true);
    setActiveTab('tests');
    setOutput('Grading submission against full test suite in cloud sandbox...');

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
        if (data.isSolved) {
          setIsSolved(true);
        }
      } else {
        setTestResults(data.results || []);
        setHasUnsavedChanges(false);
        if (data.status === 'Accepted' || data.isSolved) {
          setIsSolved(true);
          setOutput(
            `🎉 Status: Accepted (100% Score) — Congratulations! You have successfully solved this challenge.\n` +
            `Further attempts on this challenge are disabled. Submission recorded with ID #${data.submissionId}`
          );
        } else {
          setOutput(
            `Status: ${data.status} | Score: ${data.score}% (${data.passedTests}/${data.totalTests} tests passed)\nSubmission recorded in database with ID #${data.submissionId}`
          );
        }
      }
    } catch (err) {
      setOutput(`Network Error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
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
      {/* Anti-Cheat Toast Alert */}
      {antiCheatToast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'linear-gradient(90deg, #b91c1c, #991b1b)',
          color: '#fee2e2',
          padding: '0.75rem 1.5rem',
          borderRadius: '8px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          zIndex: 9999,
          fontWeight: 600,
          fontSize: '0.9rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          border: '1px solid #f87171'
        }}>
          <span>{antiCheatToast}</span>
        </div>
      )}

      {/* Tab Switch Warning / Disqualification Modal */}
      {showViolationModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '1rem'
        }}>
          <div className="card" style={{
            maxWidth: '520px',
            width: '100%',
            textAlign: 'center',
            padding: '2rem',
            background: '#18181b',
            border: `2px solid ${violations >= 3 ? '#ef4444' : '#f59e0b'}`
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
              {violations >= 3 ? '🚨' : '⚠️'}
            </div>
            <h2 style={{ color: violations >= 3 ? '#ef4444' : '#f59e0b', marginBottom: '0.75rem' }}>
              {violations >= 3 ? 'Contest Disqualified' : `Tab Switch Warning (${violations}/3)`}
            </h2>
            <p style={{ color: '#cbd5e1', lineHeight: '1.6', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
              {violations >= 3 ? (
                'You have exceeded the maximum of 3 tab switch violations. Your editor has been locked and your current code has been automatically submitted.'
              ) : (
                `Leaving the contest window or switching tabs is recorded as an anti-cheat violation. You have ${3 - violations} strike(s) remaining before automatic disqualification.`
              )}
            </p>
            {violations < 3 ? (
              <button
                onClick={() => setShowViolationModal(false)}
                className="nav-btn primary"
                style={{ padding: '0.75rem 1.75rem', fontSize: '0.95rem' }}
              >
                I Understand & Resume Contest
              </button>
            ) : (
              <div style={{ color: '#ef4444', fontWeight: 600 }}>
                Editor Locked &bull; Auto-Submitted
              </div>
            )}
          </div>
        </div>
      )}

      {/* Time Expired Modal */}
      {isExpired && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '1rem'
        }}>
          <div className="card" style={{
            maxWidth: '480px',
            width: '100%',
            textAlign: 'center',
            padding: '2rem',
            background: '#18181b',
            border: '2px solid #ef4444'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⌛</div>
            <h2 style={{ color: '#ef4444', marginBottom: '0.75rem' }}>Time is Up!</h2>
            <p style={{ color: '#cbd5e1', lineHeight: '1.6', marginBottom: '1.5rem' }}>
              The contest duration has expired. Your current code solution has been submitted to the judge.
            </p>
            <Link href="/submissions" className="nav-btn primary" style={{ padding: '0.75rem 1.5rem' }}>
              View Submission Results
            </Link>
          </div>
        </div>
      )}

      {/* Left Pane: Problem Description & Live Test Cases */}
      <div className="problem-panel">
        {/* Problem Solved Celebratory Banner */}
        {isSolved && (
          <div 
            style={{ 
              background: 'linear-gradient(90deg, rgba(6, 78, 59, 0.45), rgba(4, 120, 87, 0.35))', 
              border: '1px solid #10b981', 
              color: '#d1fae5', 
              padding: '0.85rem 1.15rem', 
              borderRadius: '8px', 
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.2)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.5rem' }}>🎉</span>
              <div>
                <div style={{ fontWeight: 700, color: '#34d399', fontSize: '0.95rem' }}>
                  Problem Solved (Accepted)
                </div>
                <div style={{ fontSize: '0.82rem', color: '#d1fae5' }}>
                  You have successfully solved this challenge with 100% test score! Further attempts are disabled.
                </div>
              </div>
            </div>
            <span style={{
              background: '#065f46',
              color: '#6ee7b7',
              padding: '0.35rem 0.75rem',
              borderRadius: '9999px',
              fontSize: '0.8rem',
              fontWeight: 700,
              border: '1px solid #059669',
              whiteSpace: 'nowrap'
            }}>
              Completed ✓
            </span>
          </div>
        )}

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
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)'
            }}
          >
            <span>{liveNotice}</span>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Problem {currentIndex + 1} of {allProblems.length}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {isSolved && (
              <span style={{ fontSize: '0.75rem', color: '#34d399', background: 'rgba(16, 185, 129, 0.15)', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid #10b981', fontWeight: 600 }}>
                ✓ Solved
              </span>
            )}
            {violations > 0 && (
              <span style={{ fontSize: '0.75rem', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid #f59e0b' }}>
                ⚠️ {violations}/3 Strikes
              </span>
            )}
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

            <select value={language} onChange={(e) => handleLanguageChange(e.target.value)} disabled={isLocked || isExpired || isSolved}>
              <option value="javascript">JavaScript (Node.js)</option>
              <option value="python">Python 3</option>
              <option value="c">C (GCC)</option>
              <option value="cpp">C++ (G++)</option>
              <option value="java">Java (JDK)</option>
            </select>

            {/* Explicit Save Button & Status */}
            <button 
              onClick={handleSaveCode}
              disabled={saving || isLocked || isExpired || isSolved}
              className="nav-btn"
              style={{
                borderColor: draftSavedNotice ? '#10b981' : hasUnsavedChanges ? '#f59e0b' : '#334155',
                color: draftSavedNotice ? '#34d399' : hasUnsavedChanges ? '#fbbf24' : '#94a3b8',
                background: draftSavedNotice ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                opacity: isSolved ? 0.5 : 1,
                cursor: isSolved ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.8rem',
                padding: '0.35rem 0.65rem'
              }}
            >
              {saving ? '⏳ Saving...' : draftSavedNotice ? '✓ Saved!' : '💾 Save Draft'}
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
            <span 
              className="timer-badge" 
              style={{
                color: currentUser?.role === 'admin' ? '#a5b4fc' : timeLeft < 300 ? '#f87171' : timeLeft < 900 ? '#fbbf24' : '#38bdf8',
                borderColor: currentUser?.role === 'admin' ? '#6366f1' : timeLeft < 300 ? '#ef4444' : timeLeft < 900 ? '#f59e0b' : '#0284c7'
              }}
            >
              ⏳ {currentUser?.role === 'admin' ? 'Admin Preview' : formatTime(timeLeft)}
            </span>

            <button 
              onClick={handleRunCode} 
              disabled={running || submitting || isLocked || isExpired || isSolved} 
              className="btn-run"
              style={isSolved ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
            >
              {isSolved ? 'Solved ✓' : running ? 'Running...' : 'Run Code'}
            </button>

            <button 
              onClick={handleSubmitCode} 
              disabled={running || submitting || isLocked || isExpired || isSolved} 
              className="btn-submit"
              style={isSolved ? { opacity: 0.7, cursor: 'not-allowed', background: '#059669', borderColor: '#10b981' } : {}}
            >
              {isSolved ? 'Solved ✓' : submitting ? 'Submitting...' : 'Submit'}
            </button>

            <button 
              onClick={async () => {
                if (confirm('Are you sure you want to log out of the assessment? Any unsaved changes will be lost.')) {
                  try {
                    await fetch('/api/auth/logout', { method: 'POST' });
                  } catch (e) {}
                  localStorage.removeItem('platform_user');
                  window.dispatchEvent(new Event('auth_changed'));
                  window.location.href = '/login';
                }
              }}
              className="nav-btn"
              title="Logout of contest assessment"
              style={{
                borderColor: '#ef4444',
                color: '#f87171',
                background: 'rgba(239, 68, 68, 0.1)',
                fontSize: '0.8rem',
                padding: '0.35rem 0.65rem'
              }}
            >
              🚪 Logout
            </button>
          </div>
        </div>

        {/* Monaco Editor (Copy-Paste & Context Menu allowed when ALLOW_COPY_PASTE is true) */}
        <div 
          style={{ flex: 1, minHeight: '300px' }}
          onContextMenu={(e) => {
            if (!ALLOW_COPY_PASTE) {
              e.preventDefault();
              setAntiCheatToast('🚫 Context menu is disabled to prevent copy/paste.');
              setTimeout(() => setAntiCheatToast(null), 3000);
            }
          }}
        >
          <Editor
            height="100%"
            language={language === 'c' || language === 'cpp' ? 'cpp' : language}
            theme="vs-dark"
            value={code}
            onChange={handleCodeChange}
            onMount={(editor) => {
              editor.onDidChangeModelContent(() => {
                const val = editor.getValue();
                currentCodeRef.current = val;
                setCode(val);
                setHasUnsavedChanges(true);
              });
            }}
            options={{
              fontSize: 14,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              contextmenu: ALLOW_COPY_PASTE, // Enabled when ALLOW_COPY_PASTE is true
              readOnly: isLocked || isExpired || isSolved
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
                            {t.isHidden ? `🔒 Hidden Evaluation Case #${idx + 1}` : `Test Case #${idx + 1}`}: {t.passed ? 'Passed ✓' : 'Failed ✗'}
                          </span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                            {t.timeMs !== undefined ? `${t.timeMs}ms` : ''}
                          </span>
                        </div>
                        {t.isHidden ? (
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.25rem', fontStyle: 'italic' }}>
                            🔒 Evaluation test case — test inputs, expected values, and execution logs are hidden.
                          </div>
                        ) : (
                          <>
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
                          </>
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
