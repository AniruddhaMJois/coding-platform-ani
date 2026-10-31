'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';

export default function SubmissionsPage() {
  const [submissions, setSubmissions] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'submissions' | 'drafts'
  const [activeModalItem, setActiveModalItem] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch('/api/submissions');
        const data = await res.json();
        setSubmissions(data.submissions || []);
        setDrafts(data.drafts || []);
      } catch (e) {
        console.error('Failed to load submissions and drafts:', e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Combine and sort all activity chronologically (newest first)
  const combinedList = useMemo(() => {
    const subs = submissions.map(s => ({
      ...s,
      type: 'submission',
      timestamp: new Date(s.createdAt).getTime()
    }));
    const dfts = drafts.map(d => ({
      ...d,
      type: 'draft',
      timestamp: new Date(d.updatedAt || d.createdAt).getTime()
    }));

    if (activeTab === 'submissions') return subs;
    if (activeTab === 'drafts') return dfts;

    return [...subs, ...dfts].sort((a, b) => b.timestamp - a.timestamp);
  }, [submissions, drafts, activeTab]);

  const acceptedCount = submissions.filter(s => s.status === 'Accepted').length;

  const handleCopyCode = (code) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="container">
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.4rem', color: '#fff' }}>My Submissions & Drafts</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            Review your evaluated submission results and resume uncompleted problem drafts.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Link href="/problems" className="nav-btn primary">
            Explore Problems →
          </Link>
        </div>
      </div>

      {/* Metrics Bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #3b82f6' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Total Submissions
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#fff', marginTop: '0.25rem' }}>
            {submissions.length}
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #10b981' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Accepted Solutions
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#34d399', marginTop: '0.25rem' }}>
            {acceptedCount}
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            In-Progress Drafts
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#fbbf24', marginTop: '0.25rem' }}>
            {drafts.length}
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        borderBottom: '1px solid var(--border-color)',
        paddingBottom: '0.75rem',
        marginBottom: '1.5rem'
      }}>
        <button
          onClick={() => setActiveTab('all')}
          className="nav-btn"
          style={{
            background: activeTab === 'all' ? '#2563eb' : 'transparent',
            borderColor: activeTab === 'all' ? '#3b82f6' : 'var(--border-color)',
            color: activeTab === 'all' ? '#fff' : 'var(--text-muted)',
            fontWeight: activeTab === 'all' ? 600 : 400
          }}
        >
          All Activity ({submissions.length + drafts.length})
        </button>

        <button
          onClick={() => setActiveTab('submissions')}
          className="nav-btn"
          style={{
            background: activeTab === 'submissions' ? '#2563eb' : 'transparent',
            borderColor: activeTab === 'submissions' ? '#3b82f6' : 'var(--border-color)',
            color: activeTab === 'submissions' ? '#fff' : 'var(--text-muted)',
            fontWeight: activeTab === 'submissions' ? 600 : 400
          }}
        >
          Submissions ({submissions.length})
        </button>

        <button
          onClick={() => setActiveTab('drafts')}
          className="nav-btn"
          style={{
            background: activeTab === 'drafts' ? '#f59e0b' : 'transparent',
            borderColor: activeTab === 'drafts' ? '#f59e0b' : 'var(--border-color)',
            color: activeTab === 'drafts' ? '#18181b' : 'var(--text-muted)',
            fontWeight: activeTab === 'drafts' ? 700 : 400
          }}
        >
          📝 In-Progress Drafts ({drafts.length})
        </button>
      </div>

      {/* List Body */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <p>Loading your submission history and drafts...</p>
        </div>
      ) : combinedList.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
            {activeTab === 'drafts' ? '📝' : '📂'}
          </div>
          <h3 style={{ marginBottom: '0.5rem', color: '#fff' }}>
            {activeTab === 'drafts'
              ? 'No In-Progress Drafts'
              : activeTab === 'submissions'
              ? 'No Evaluated Submissions Yet'
              : 'No Submissions or Drafts Yet'}
          </h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', maxWidth: '480px', margin: '0 auto 1.5rem' }}>
            {activeTab === 'drafts'
              ? 'You have no uncompleted drafts. Problems you are currently working on with saved code will appear here.'
              : 'Start coding to test solutions against the test suite or save drafts as you work.'}
          </p>
          <Link href="/problems" className="nav-btn primary">
            Explore Problems
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {combinedList.map((item) => {
            const isDraft = item.type === 'draft';
            const isAccepted = item.status === 'Accepted';

            let statusBadgeBg = 'rgba(239, 68, 68, 0.15)';
            let statusBadgeColor = '#f87171';
            let statusBadgeBorder = '#ef4444';
            let statusIcon = '✕';

            if (isDraft) {
              statusBadgeBg = 'rgba(245, 158, 11, 0.15)';
              statusBadgeColor = '#fbbf24';
              statusBadgeBorder = '#f59e0b';
              statusIcon = '📝';
            } else if (isAccepted) {
              statusBadgeBg = 'rgba(16, 185, 129, 0.15)';
              statusBadgeColor = '#34d399';
              statusBadgeBorder = '#10b981';
              statusIcon = '✓';
            } else if (item.status === 'Time Limit Exceeded') {
              statusBadgeBg = 'rgba(234, 179, 8, 0.15)';
              statusBadgeColor = '#facc15';
              statusBadgeBorder = '#eab308';
              statusIcon = '⏱️';
            } else if (item.status === 'Compilation Error') {
              statusBadgeBg = 'rgba(249, 115, 22, 0.15)';
              statusBadgeColor = '#fb923c';
              statusBadgeBorder = '#f97316';
              statusIcon = '⚠️';
            }

            return (
              <div
                key={`${item.type}-${item.id}`}
                className="card"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '1.25rem 1.5rem',
                  borderLeft: isDraft ? '4px solid #f59e0b' : isAccepted ? '4px solid #10b981' : '4px solid #334155',
                  flexWrap: 'wrap',
                  gap: '1rem'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                    <Link
                      href={`/problems/${item.problem?.slug}`}
                      style={{ fontWeight: 700, fontSize: '1.1rem', color: '#fff' }}
                    >
                      {item.problem?.title || 'Problem'}
                    </Link>

                    {/* Status Badge */}
                    <span
                      style={{
                        background: statusBadgeBg,
                        color: statusBadgeColor,
                        border: `1px solid ${statusBadgeBorder}`,
                        padding: '0.2rem 0.55rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                      }}
                    >
                      <span>{statusIcon}</span>
                      <span>{isDraft ? 'In-Progress Draft' : item.status}</span>
                    </span>

                    {/* Difficulty Badge */}
                    {item.problem?.difficulty && (
                      <span className={`badge ${item.problem.difficulty === 'Easy' ? 'badge-easy' : 'badge-medium'}`}>
                        {item.problem.difficulty}
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                    <span>Language: <strong style={{ color: '#cbd5e1' }}>{item.language?.toUpperCase()}</strong></span>
                    <span>&bull;</span>
                    {isDraft ? (
                      <span style={{ color: '#fbbf24' }}>
                        Uncompleted Draft &bull; Last saved {new Date(item.updatedAt || item.createdAt).toLocaleTimeString()}
                      </span>
                    ) : (
                      <>
                        <span>Score: <strong style={{ color: isAccepted ? '#34d399' : '#f87171' }}>{item.score}%</strong> ({item.passedTests}/{item.totalTests} passed)</span>
                        <span>&bull;</span>
                        <span>{new Date(item.createdAt).toLocaleTimeString()}</span>
                      </>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <button
                    onClick={() => setActiveModalItem(item)}
                    className="nav-btn"
                    style={{ fontSize: '0.82rem' }}
                  >
                    {isDraft ? '🔍 View Draft' : '🔍 View Code'}
                  </button>

                  <Link
                    href={`/problems/${item.problem?.slug}`}
                    className={`nav-btn ${isDraft ? 'primary' : isAccepted ? '' : 'primary'}`}
                    style={{
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      borderColor: isAccepted ? '#10b981' : undefined,
                      color: isAccepted ? '#6ee7b7' : undefined,
                      background: isAccepted ? 'rgba(16, 185, 129, 0.1)' : undefined
                    }}
                  >
                    {isDraft ? 'Continue Solving →' : isAccepted ? 'View Solution ✓' : 'Resume Problem →'}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Code Inspection Modal */}
      {activeModalItem && (
        <div
          onClick={() => setActiveModalItem(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '1rem'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card"
            style={{
              width: '90%',
              maxWidth: '850px',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              background: '#18181b',
              border: '1px solid #334155',
              padding: '1.5rem',
              boxShadow: '0 20px 40px rgba(0,0,0,0.6)'
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', borderBottom: '1px solid #27272a', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#fff' }}>
                  {activeModalItem.problem?.title} ({activeModalItem.language?.toUpperCase()})
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.35rem' }}>
                  <span style={{ fontSize: '0.8rem', color: activeModalItem.type === 'draft' ? '#fbbf24' : activeModalItem.status === 'Accepted' ? '#34d399' : '#f87171', fontWeight: 600 }}>
                    {activeModalItem.type === 'draft' ? '📝 Uncompleted Saved Draft' : `Submission: ${activeModalItem.status} (${activeModalItem.score}%)`}
                  </span>
                  <span style={{ color: '#52525b' }}>&bull;</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {new Date(activeModalItem.updatedAt || activeModalItem.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => handleCopyCode(activeModalItem.code)}
                  className="nav-btn"
                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
                >
                  {copied ? '✓ Copied' : '📋 Copy Code'}
                </button>
                <button
                  onClick={() => setActiveModalItem(null)}
                  className="nav-btn"
                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
                >
                  ✕ Close
                </button>
              </div>
            </div>

            {/* Code Body */}
            <div style={{ flex: 1, overflow: 'auto', background: '#09090b', borderRadius: '6px', border: '1px solid #27272a', padding: '1rem' }}>
              <pre style={{
                margin: 0,
                color: activeModalItem.type === 'draft' ? '#fef08a' : activeModalItem.status === 'Accepted' ? '#4ade80' : '#e2e8f0',
                fontSize: '0.88rem',
                fontFamily: 'monospace',
                lineHeight: '1.5',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}>
                {activeModalItem.code || '// Empty code'}
              </pre>
            </div>

            {/* Modal Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid #27272a' }}>
              <button
                onClick={() => setActiveModalItem(null)}
                className="nav-btn"
              >
                Close
              </button>
              <Link
                href={`/problems/${activeModalItem.problem?.slug}`}
                className="nav-btn primary"
              >
                {activeModalItem.type === 'draft' ? 'Continue Solving Problem →' : activeModalItem.status === 'Accepted' ? 'View Problem Details →' : 'Resume Problem →'}
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
