'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e?.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();
      if (res.ok && data.user) {
        // Broadcast login state
        if (typeof window !== 'undefined') {
          sessionStorage.clear();
          localStorage.removeItem('platform_contest_end_time');
          localStorage.setItem('platform_user', JSON.stringify(data.user));
          window.dispatchEvent(new Event('auth_changed'));
        }

        if (data.user.role === 'admin') {
          router.push('/admin');
        } else {
          router.push('/problems');
        }
      } else {
        setError(data.error || 'Invalid credentials');
      }
    } catch (err) {
      setError(`Login failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fillCredentials = (u, p) => {
    setUsername(u);
    setPassword(p);
    setError(null);
  };

  return (
    <div className="container" style={{ maxWidth: '440px', marginTop: '3rem', paddingBottom: '3rem' }}>
      <div className="card" style={{ padding: '2.5rem 2rem', background: '#131b2e', border: '1px solid #1e293b' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🔐</div>
          <h1 style={{ fontSize: '1.75rem', color: '#fff', margin: 0 }}>Contest Login</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
            Enter your credentials to access the assessment environment.
          </p>
        </div>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid #ef4444',
            color: '#fca5a5',
            padding: '0.75rem 1rem',
            borderRadius: '6px',
            marginBottom: '1.25rem',
            fontSize: '0.85rem'
          }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.35rem' }}>
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="e.g. 1, 2, or osl-vvce"
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                background: '#0a0f1d',
                border: '1px solid #334155',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '0.95rem'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.35rem' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter password"
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                background: '#0a0f1d',
                border: '1px solid #334155',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '0.95rem'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="nav-btn primary"
            style={{ padding: '0.75rem', fontSize: '1rem', marginTop: '0.5rem', width: '100%' }}
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        {/* Quick Demo Credentials */}
        <div style={{ marginTop: '2rem', borderTop: '1px solid #1e293b', paddingTop: '1.25rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.75rem', textAlign: 'center' }}>
            Quick Credentials (Click to Auto-Fill):
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div
              onClick={() => fillCredentials('1', '1')}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.5rem 0.75rem',
                background: '#0a0f1d',
                borderRadius: '6px',
                border: '1px solid #1e293b',
                cursor: 'pointer',
                fontSize: '0.8rem'
              }}
            >
              <span style={{ color: '#38bdf8' }}>👤 User 1 (Participant)</span>
              <span style={{ color: 'var(--text-muted)' }}>1 / 1</span>
            </div>

            <div
              onClick={() => fillCredentials('2', '2')}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.5rem 0.75rem',
                background: '#0a0f1d',
                borderRadius: '6px',
                border: '1px solid #1e293b',
                cursor: 'pointer',
                fontSize: '0.8rem'
              }}
            >
              <span style={{ color: '#38bdf8' }}>👤 User 2 (Participant)</span>
              <span style={{ color: 'var(--text-muted)' }}>2 / 2</span>
            </div>

            <div
              onClick={() => fillCredentials('osl-vvce', 'OSL')}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.5rem 0.75rem',
                background: '#0a0f1d',
                borderRadius: '6px',
                border: '1px solid #6366f1',
                cursor: 'pointer',
                fontSize: '0.8rem'
              }}
            >
              <span style={{ color: '#a5b4fc' }}>🛡️ OSL Admin</span>
              <span style={{ color: 'var(--text-muted)' }}>osl-vvce / OSL</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
