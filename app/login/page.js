'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ShuffleText from '@/app/components/ShuffleText';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error || 'Login failed');
        setLoading(false);
        return;
      }
      router.push('/');
      router.refresh();
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <main className="login-main">
      <div className="login-card">
        <div className="login-emoji">👋</div>
        <h1 className="login-title">
          <ShuffleText text="Welcome back, Aishwarya" revealMs={70} scrambleMs={28} holdMs={2200} />
        </h1>
        <p className="login-subtitle">Enter your password to continue.</p>
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-input-wrap">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              required
              className="login-input"
            />
            <button
              type="button"
              className="login-toggle"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? '🙈' : '👁️'}
            </button>
          </div>
          {error && <div className="login-error">{error}</div>}
          <button type="submit" disabled={loading || !password} className="login-button">
            {loading ? 'Signing in...' : 'Sign in →'}
          </button>
        </form>
      </div>
    </main>
  );
}
