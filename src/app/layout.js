'use client';

import './globals.css';
import Link from 'next/link';
import { useState, useEffect } from 'react';

export default function RootLayout({ children }) {
  const [violations, setViolations] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  const checkUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      setCurrentUser(data.user || null);
    } catch (e) {
      setCurrentUser(null);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setCurrentUser(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('platform_user');
        window.location.href = '/login';
      }
    } catch (e) {}
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
    // 1. BroadcastChannel for Multi-Tab sync
    let channel;
    try {
      channel = new BroadcastChannel('exam_integrity_channel');
      channel.onmessage = (event) => {
        if (event.data?.type === 'VIOLATION') {
          setViolations(event.data.count);
          addToast(`Violation detected across tabs (${event.data.reason})`, 'error');
        }
      };
    } catch (e) {}

    const broadcastViolation = (reason) => {
      setViolations(prev => {
        const next = prev + 1;
        if (channel) {
          channel.postMessage({ type: 'VIOLATION', count: next, reason });
        }
        return next;
      });
      addToast(reason, 'error');
    };

    // 2. Anti-cheat listeners
    const handleVisibilityChange = () => {
      if (document.hidden) {
        broadcastViolation('Tab switching or window minimized');
      }
    };

    const handleContextMenu = (e) => {
      e.preventDefault();
      broadcastViolation('Right-click context menu is restricted');
    };

    const handleCopyPaste = (e) => {
      // Prevent unauthorized copy/paste
      if (e.type === 'paste') {
        broadcastViolation('External paste detected');
      }
    };

    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('paste', handleCopyPaste);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('paste', handleCopyPaste);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      if (channel) channel.close();
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
            <Link href="/" className="nav-btn">Home</Link>
            <Link href="/contests" className="nav-btn">Contests</Link>
            <Link href="/problems" className="nav-btn">Problems</Link>
            <Link href="/submissions" className="nav-btn">My Submissions</Link>
            {currentUser?.role === 'admin' && (
              <Link href="/admin" className="nav-btn" style={{ borderColor: '#6366f1', color: '#a5b4fc' }}>
                🛡️ Admin CMS
              </Link>
            )}

            {currentUser ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', color: '#38bdf8', background: '#0f172a', padding: '0.3rem 0.6rem', borderRadius: '4px', border: '1px solid #1e293b' }}>
                  {currentUser.role === 'admin' ? '🛡️' : '👤'} {currentUser.name}
                </span>
                <button 
                  onClick={handleLogout} 
                  className="nav-btn"
                  style={{ borderColor: '#ef4444', color: '#f87171', padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                >
                  Logout
                </button>
              </div>
            ) : (
              <Link href="/login" className="nav-btn primary" style={{ padding: '0.35rem 0.85rem' }}>
                🔐 Login
              </Link>
            )}

            {violations > 0 && (
              <span className="violations-badge">
                ⚠️ Violations: {violations}
              </span>
            )}

            <button onClick={toggleFullscreen} className="nav-btn" style={{ fontSize: '0.8rem' }}>
              {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            </button>
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
