'use client';

import { useEffect, useRef, useState } from 'react';

const SCRAMBLE_CHARS = '!<>-_\\/[]{}—=+*^?#';

// Reactive scrambled-text — letters within `radius` of the mouse cursor
// scramble live, letters outside the radius render as their target glyph.
// Inspired by reactbits.dev/text-animations/scrambled-text.
export default function ScrambledText({
  text,
  radius = 110,    // px from cursor where scramble is active
  speed = 50,      // ms between scramble updates
  className = '',
}) {
  const charsRef = useRef([]);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const [display, setDisplay] = useState(() => text.split(''));

  useEffect(() => {
    function onMove(e) {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    }
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  useEffect(() => {
    const tick = setInterval(() => {
      setDisplay(
        text.split('').map((c, i) => {
          const el = charsRef.current[i];
          if (!el || /\s/.test(c)) return c;
          const rect = el.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          const dx = mouseRef.current.x - cx;
          const dy = mouseRef.current.y - cy;
          const dist = Math.hypot(dx, dy);
          if (dist < radius) {
            return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
          }
          return c;
        })
      );
    }, speed);
    return () => clearInterval(tick);
  }, [text, radius, speed]);

  return (
    <span className={className} aria-label={text}>
      {display.map((c, i) => (
        <span
          key={i}
          ref={(el) => { charsRef.current[i] = el; }}
          className="scrambled-char"
        >
          {c}
        </span>
      ))}
    </span>
  );
}
