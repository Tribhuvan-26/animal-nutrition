'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TextCursor from '@/app/components/TextCursor';
import PhotoMasonry from '@/app/components/PhotoMasonry';
import BlurText from '@/app/components/BlurText';
import DotField from '@/app/components/DotField';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [calm, setCalm] = useState(false);   // reduced motion → skip the canvas entirely
  const [wide, setWide] = useState(false);   // photo wall is desktop-only
  const router = useRouter();

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const width = window.matchMedia('(min-width: 768px)');
    const sync = () => { setCalm(motion.matches); setWide(width.matches); };
    sync();
    motion.addEventListener('change', sync);
    width.addEventListener('change', sync);
    return () => { motion.removeEventListener('change', sync); width.removeEventListener('change', sync); };
  }, []);

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
      {/* Photo wall only where there's room for it; on phones it turns to mush. */}
      {wide && (
        <div className="login-bg" aria-hidden="true">
          <PhotoMasonry columns={5} />
        </div>
      )}

      {/* Drifting colour, then the React Bits dot field on top of it. */}
      <div className="login-aurora" aria-hidden="true">
        <span className="aurora-blob b1" />
        <span className="aurora-blob b2" />
        <span className="aurora-blob b3" />
      </div>

      {!calm && (
        <div className="login-dots" aria-hidden="true">
          <DotField
            dotSpacing={wide ? 18 : 22}
            dotRadius={2.4}
            cursorRadius={wide ? 420 : 260}
            bulgeStrength={wide ? 62 : 34}
            waveAmplitude={1.6}
            glowRadius={220}
            glowColor="#241f5c"
            gradientFrom="rgba(180, 190, 255, 0.6)"
            gradientTo="rgba(196, 132, 252, 0.42)"
          />
        </div>
      )}

      {wide && <TextCursor emoji="💪" spacing={80} trailLength={6} fadeMs={900} size="2rem" />}

      <div className="login-card">
        <div className="login-badge">
          <span className="login-emoji">👋</span>
        </div>

        <p className="login-eyebrow">Welcome back</p>
        <h1 className="login-title">
          <BlurText text="Aishwarya" delay={46} duration={640} />
        </h1>
        <p className="login-subtitle">One password, then straight to the ledger.</p>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-input-wrap">
            <span className="login-lock" aria-hidden="true">🔒</span>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyUp={(e) => setCapsOn(e.getModifierState?.('CapsLock') ?? false)}
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
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>

          {capsOn && <div className="login-note">⇪ Caps Lock is on</div>}
          {error && <div className="login-error" role="alert">{error}</div>}

          <button type="submit" disabled={loading || !password} className="login-button">
            {loading ? <><span className="spinner" /> Signing in…</> : <>Sign in <span className="login-arrow">→</span></>}
          </button>

          <p className="login-hint">
            Press <kbd>Enter</kbd> to sign in · session lasts 7 days
          </p>
        </form>

        <p className="login-foot">Private ledger · Gemini 2.5 Flash → Google Sheets</p>
      </div>
    </main>
  );
}
