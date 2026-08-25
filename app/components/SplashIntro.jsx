'use client';

import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import './SplashIntro.css';

// Name pop and out — under a second, start to finish. Letters snap in, one hit
// against the offset ghost, shutter leaves. Nothing else.
export default function SplashIntro({ word = 'RUDRA', bars = 7 }) {
  const root = useRef(null);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setGone(true); return; }

    const q = gsap.utils.selector(root.current);
    document.body.style.overflow = 'hidden';

    const tl = gsap.timeline({
      onComplete: () => { document.body.style.overflow = ''; setGone(true); },
    });

    tl
      .from(q('.splash-letter'), { yPercent: 115, duration: 0.28, ease: 'steps(4)', stagger: 0.06 })
      .from(q('.splash-dot'), { scale: 0, duration: 0.16, ease: 'steps(2)' }, '-=0.1')
      // one hit: ghost kicks out, both snap back on the same frame
      .to(q('.splash-lockup'), { scale: 1.11, duration: 0.24, ease: 'power4.in' }, '+=0.1')
      .to(q('.splash-ghost'), { x: 18, y: 18, duration: 0.24, ease: 'power4.in' }, '<')
      .set(q('.splash-lockup'), { scale: 1 })
      .set(q('.splash-ghost'), { x: 0, y: 0 })
      .to(q('.splash-bar'), { yPercent: -100, duration: 0.4, ease: 'power3.inOut', stagger: 0.035 })
      .set(q('.splash-lockup'), { opacity: 0 }, '<0.04');

    return () => { tl.kill(); document.body.style.overflow = ''; };
  }, []);

  if (gone) return null;

  return (
    <div className="splash" ref={root} aria-hidden="true">
      <div className="splash-curtain">
        {Array.from({ length: bars }, (_, i) => <span className="splash-bar" key={i} />)}
      </div>

      <div className="splash-lockup">
        <span className="splash-ghost" aria-hidden="true">{word}<i className="splash-dot-ghost" /></span>
        <span className="splash-front">
          {word.split('').map((c, i) => <span className="splash-letter" key={i}>{c}</span>)}
          <i className="splash-dot" />
        </span>
      </div>
    </div>
  );
}
