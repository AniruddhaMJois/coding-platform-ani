'use client';

import './globals.css';
import Link from 'next/link';
import { useState, useEffect } from 'react';

export default function RootLayout({ children }) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  const checkUser = async () => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('platform_user');
        if (cached) setCurrentUser(JSON.parse(cached));
      } catch (e) {}
    }

    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (data.user) {
        setCurrentUser(data.user);
        if (typeof window !== 'undefined') {
          localStorage.setItem('platform_user', JSON.stringify(data.user));
        }
      } else {
        setCurrentUser(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('platform_user');
        }
      }
    } catch (e) {
      setCurrentUser(null);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {}
    setCurrentUser(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('platform_user');
      localStorage.removeItem('platform_contest_end_time');
      sessionStorage.clear();
      window.dispatchEvent(new Event('auth_changed'));
      window.location.href = '/login';
    }
  };

  useEffect(() => {
    checkUser();
    window.addEventListener('auth_changed', checkUser);
    return () => window.removeEventListener('auth_changed', checkUser);
  }, []);

  // Toast notification helper
  const addToast = (message, type = 'warning') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <html lang="en">
      <head>
        <title>CodeJudge - Assessment Platform</title>
        <meta name="description" content="Next-generation immersive coding assessment and contest platform" />
      </head>
      <body>
        <header className="app-header">
          <Link href="/" className="brand">
            CodeJudge
            <span className="brand-badge">Next.js</span>
          </Link>

          <nav className="nav-links">
            {currentUser ? (
              <>
                <Link href="/contests" className="nav-btn">Contests</Link>
                <Link href="/problems" className="nav-btn">Problems</Link>
                <Link href="/submissions" className="nav-btn">My Submissions</Link>
                {currentUser.role === 'admin' && (
                  <Link href="/admin" className="nav-btn" style={{ borderColor: '#6366f1', color: '#a5b4fc' }}>
                    🛡️ Admin CMS
                  </Link>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginLeft: '0.5rem' }}>
                  <span style={{ 
                    fontSize: '0.82rem', 
                    color: '#38bdf8', 
                    background: '#0f172a', 
                    padding: '0.35rem 0.65rem', 
                    borderRadius: '6px', 
                    border: '1px solid #1e293b',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}>
                    {currentUser.role === 'admin' ? '🛡️' : '👤'} 
                    <strong>{currentUser.name || currentUser.username}</strong>
                    <span style={{ color: '#64748b', fontSize: '0.75rem' }}>({currentUser.role})</span>
                  </span>
                  <button 
                    onClick={handleLogout} 
                    className="nav-btn"
                    title="Sign out of your account"
                    style={{ 
                      borderColor: '#ef4444', 
                      color: '#f87171', 
                      background: 'rgba(239, 68, 68, 0.1)',
                      padding: '0.35rem 0.75rem', 
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem'
                    }}
                  >
                    🚪 Logout
                  </button>
                </div>

                <button onClick={toggleFullscreen} className="nav-btn" style={{ fontSize: '0.8rem' }}>
                  {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                </button>
              </>
            ) : (
              <Link href="/login" className="nav-btn primary" style={{ padding: '0.45rem 1.1rem', fontSize: '0.9rem', fontWeight: 600 }}>
                🔐 Sign In
              </Link>
            )}
          </nav>
        </header>

        <main>{children}</main>

        {/* Non-blocking in-app toasts */}
        <div className="toast-container">
          {toasts.map(t => (
            <div key={t.id} className={`toast ${t.type}`}>
              {t.message}
            </div>
          ))}
        </div>
      </body>
    </html>
  );
}
