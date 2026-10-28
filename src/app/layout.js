'use client';

import './globals.css';
import Link from 'next/link';
import { useState, useEffect } from 'react';

export default function RootLayout({ children }) {
  const [violations, setViolations] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [toasts, setToasts] = useState([]);

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
            <Link href="/admin" className="nav-btn" style={{ borderColor: '#6366f1', color: '#a5b4fc' }}>Admin CMS</Link>

            {violations > 0 && (
              <span className="violations-badge">
                ⚠️ Violations: {violations}
              </span>
            )}

            <button onClick={toggleFullscreen} className="nav-btn primary">
              {isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
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
