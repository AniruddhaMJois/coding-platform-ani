'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function SubmissionsPage() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCode, setActiveCode] = useState(null);

  useEffect(() => {
    async function loadSubmissions() {
      try {
        const res = await fetch('/api/submissions');
        const data = await res.json();
        setSubmissions(data.submissions || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadSubmissions();
  }, []);

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>My Submissions</h1>
          <p style={{ color: 'var(--text-muted)' }}>
            Real-time evaluation history saved directly in the platform database.
          </p>
        </div>
        <Link href="/problems" className="nav-btn primary">
          Solve More Problems →
        </Link>
      </div>

      {loading ? (
        <p>Loading submission history...</p>
      ) : submissions.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <h3 style={{ marginBottom: '0.5rem' }}>No Submissions Yet</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            Submit code on any problem to view grading scores and test results here.
          </p>
          <Link href="/problems" className="nav-btn primary">
            Explore Problems
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {submissions.map((sub) => (
            <div 
              key={sub.id} 
              className="card"
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem' }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
                  <Link href={`/problems/${sub.problem.slug}`} style={{ fontWeight: 700, fontSize: '1.1rem', color: '#fff' }}>
                    {sub.problem.title}
                  </Link>
                  <span className={`badge ${sub.status === 'Accepted' ? 'badge-easy' : 'badge-medium'}`}>
                    {sub.status}
                  </span>
                </div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Language: <strong>{sub.language.toUpperCase()}</strong> • Score: <strong>{sub.score}%</strong> ({sub.passedTests}/{sub.totalTests} passed) • {new Date(sub.createdAt).toLocaleTimeString()}
                </span>
              </div>

              <button onClick={() => setActiveCode(sub)} className="nav-btn">
                View Code
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Code Modal */}
      {activeCode && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
          <div className="card" style={{ width: '85%', maxWidth: '800px', maxHeight: '80vh', overflow: 'auto', background: '#1e1e1e' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3>Submitted Code ({activeCode.problem.title} - {activeCode.language.toUpperCase()})</h3>
              <button onClick={() => setActiveCode(null)} className="nav-btn">
                ✕ Close
              </button>
            </div>
            <pre style={{ color: '#4ade80', fontSize: '0.85rem', overflowX: 'auto', padding: '1rem', background: '#111', borderRadius: '6px' }}>
              {activeCode.code}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
