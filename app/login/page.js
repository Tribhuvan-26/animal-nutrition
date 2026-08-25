'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PhotoMasonry from '@/app/components/PhotoMasonry';
import BlurText from '@/app/components/BlurText';
import SpecularButton from '@/app/components/SpecularButton';
import PixelSwap from '@/app/components/PixelSwap';
import TargetCursor from '@/app/components/TargetCursor';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [wide, setWide] = useState(false);   // photo wall is desktop-only
  const router = useRouter();

  useEffect(() => {
    const width = window.matchMedia('(min-width: 768px)');
    const sync = () => setWide(width.matches);
    sync();
    width.addEventListener('change', sync);
    return () => width.removeEventListener('change', sync);
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

      {wide && (
        <TargetCursor
          spinDuration={2}
          hideDefaultCursor
          parallaxOn
          hoverDuration={0.2}
          cursorColor="#ffffff"
          cursorColorOnTarget="#ff5a1f"
        />
      )}

      {/* Kit furniture: pastel slabs, dot clusters, scattered outlined shapes. */}
      <div className="login-deco" aria-hidden="true">
        <span className="deco-slab slab-pink" />
        <span className="deco-slab slab-yellow" />
        <span className="deco-dots dots-a" />
        <span className="deco-dots dots-b" />
        <span className="deco sq-coral" />
        <span className="deco dia-purple" />
        <span className="deco cir-teal" />
        <span className="deco sq-yellow" />
        <span className="deco dia-coral" />
        <span className="deco cir-purple" />
        <span className="deco sq-teal" />
        <span className="deco dia-yellow" />
      </div>

      <div className="login-card">
        <div className="login-chips" aria-hidden="true">
          <span className="chip chip-coral" />
          <span className="chip chip-purple" />
          <span className="chip chip-teal" />
        </div>

        <p className="login-eyebrow">Welcome back</p>
        <h1 className="login-title">
          <BlurText text="Aishwarya" delay={46} duration={640} />
        </h1>
        <p className="login-subtitle">One password, then straight to the ledger.</p>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-input-wrap">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyUp={(e) => setCapsOn(e.getModifierState?.('CapsLock') ?? false)}
              autoFocus
              required
              className="login-input cursor-target"
            />
            <button
              type="button"
              className="login-toggle cursor-target"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>

          {capsOn && <div className="login-note">⇪ Caps Lock is on</div>}
          {error && <div className="login-error" role="alert">{error}</div>}

          <SpecularButton
            type="submit"
            size="lg"
            radius={18}
            tint="#ffffff"
            tintOpacity={0}
            blur={0}
            textColor="#f5f5f5"
            lineColor="#ffffff"
            baseColor="#525252"
            intensity={1}
            shineSize={10}
            shineFade={40}
            thickness={1}
            speed={0.35}
            followMouse
            proximity={250}
            autoAnimate={false}
            disabled={loading || !password}
            className="login-specular cursor-target"
          >
            {loading ? <><span className="spinner" /> Signing in…</> : <>Sign in <span className="login-arrow">→</span></>}
          </SpecularButton>

          <p className="login-hint">
            Press <kbd>Enter</kbd> to sign in · session lasts 7 days
          </p>
        </form>

        <div className="login-swap cursor-target">
          <PixelSwap
            firstContent={
              <div className="click-prompt">
                <span>Private ledger · Gemini 2.5 Flash → Google Sheets</span>
              </div>
            }
            secondContent={
              <div className="found-message">
                <span>You found me</span>
              </div>
            }
            pixelSize={wide ? 64 : 26}
            gap={0}
            pixelRadius={0}
            pixelSpin={0}
            pixelScale={0.35}
            duration={1400}
            pixelDuration={450}
            pattern="random"
            randomness={0}
            fade
            trigger="hover"
            aspectRatio="8 / 1"
          />
        </div>
      </div>
    </main>
  );
}
