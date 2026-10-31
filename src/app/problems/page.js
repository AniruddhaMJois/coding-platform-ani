'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function ProblemsPage() {
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [liveNotification, setLiveNotification] = useState(null);

  const fetchProblems = async () => {
    try {
      const res = await fetch('/api/problems', { cache: 'no-store' });
      const data = await res.json();
      if (data.problems) {
        setProblems(data.problems);
      }
    } catch (e) {
      console.error('Failed to load problems:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProblems();

    // 1. Listen via Server-Sent Events (cross-browser / cross-device)
    let es;
    try {
      es = new EventSource('/api/events');
      es.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'TESTCASE_UPLOADED') {
            fetchProblems();
            setLiveNotification(`⚡ Instructor uploaded test cases for "${payload.title || 'a problem'}". Catalog updated.`);
            setTimeout(() => setLiveNotification(null), 5000);
          } else if (payload.type === 'TESTCASE_DELETED') {
            fetchProblems();
          } else if (payload.type === 'CMS_UPDATE') {
            fetchProblems();
            setLiveNotification(`⚡ Contest problem list updated by instructor.`);
            setTimeout(() => setLiveNotification(null), 5000);
          }
        } catch (err) {}
      };
    } catch (e) {}

    // 2. Real-time synchronization via BroadcastChannel (same-browser instant)
    let channel;
    try {
      channel = new BroadcastChannel('platform_cms_channel');
      channel.onmessage = (event) => {
        if (event.data?.type === 'CMS_UPDATE' || event.data?.type === 'TESTCASE_UPLOADED' || event.data?.type === 'TESTCASE_DELETED') {
          fetchProblems();
          setLiveNotification(`⚡ New updates from instructor: ${event.data.title || event.data.message || 'Problems refreshed'}`);
          setTimeout(() => setLiveNotification(null), 5000);
        }
      };
    } catch (e) {}

    // 3. Polling fallback every 4 seconds to guarantee consistency
    const interval = setInterval(fetchProblems, 4000);

    return () => {
      clearInterval(interval);
      if (es) es.close();
      if (channel) channel.close();
    };
  }, []);

  return (
    <div className="container">
      {liveNotification && (
        <div 
          style={{ 
            background: 'linear-gradient(90deg, #1e1b4b, #312e81)', 
            border: '1px solid #6366f1', 
            color: '#c7d2fe', 
            padding: '0.75rem 1.25rem', 
            borderRadius: '8px', 
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            animation: 'slideIn 0.3s ease'
          }}
        >
          <span>✨</span>
          <span>{liveNotification}</span>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Practice Problems</h1>
          <p style={{ color: 'var(--text-muted)' }}>
            Solve algorithmic challenges with instant compiler feedback across 5 languages.
          </p>
        </div>
        <Link href="/contests" className="nav-btn">
          ← Back to Contests
        </Link>
      </div>

      {loading ? (
        <p>Loading problems...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {problems.map((p, idx) => (
            <div 
              key={p.id} 
              className="card"
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-muted)', width: '2rem' }}>
                  #{idx + 1}
                </span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem' }}>
                    <Link href={`/problems/${p.slug}`} style={{ color: '#fff' }}>
                      {p.title}
                    </Link>
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Slug: <code>{p.slug}</code> • {p.testCases?.length || 0} Sample Tests
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span className={`badge ${p.difficulty === 'Easy' ? 'badge-easy' : 'badge-medium'}`}>
                  {p.difficulty}
                </span>
                <Link href={`/problems/${p.slug}`} className="nav-btn primary">
                  Solve Challenge →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
