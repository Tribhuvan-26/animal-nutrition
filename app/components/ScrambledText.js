'use client';

import { useEffect, useRef, useState } from 'react';

const SCRAMBLE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!<>-_\\/[]{}—=+*^?#';

// Per-character scrambled-text animation inspired by reactbits.dev/text-animations/scrambled-text.
// Each letter scrambles independently with a random duration, then locks into place.
// Re-runs on hover.
export default function ScrambledText({
  text,
  speed = 40,           // ms between scramble ticks per char
  charDuration = 600,   // ms each character scrambles before locking
  stagger = 30,         // ms delay between starting each char
  triggerOnMount = true,
  triggerOnHover = true,
  className = '',
}) {
  const [chars, setChars] = useState(() =>
    text.split('').map((c) => ({ target: c, display: c }))
  );
  const animatingRef = useRef(false);

  useEffect(() => {
    if (triggerOnMount) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  function run() {
    if (animatingRef.current) return;
    animatingRef.current = true;

    const targets = text.split('');
    const finishedRefs = new Array(targets.length).fill(false);

    targets.forEach((target, i) => {
      const isLetter = /[A-Za-z0-9]/.test(target);
      if (!isLetter) {
        finishedRefs[i] = true;
        return;
      }
      const lockAt = Date.now() + i * stagger + charDuration + Math.random() * 200;
      const ticker = setInterval(() => {
        if (Date.now() >= lockAt) {
          clearInterval(ticker);
          finishedRefs[i] = true;
          setChars((prev) => {
            const next = [...prev];
            next[i] = { ...next[i], display: target };
            return next;
          });
          if (finishedRefs.every(Boolean)) animatingRef.current = false;
          return;
        }
        setChars((prev) => {
          const next = [...prev];
          next[i] = {
            ...next[i],
            display: SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)],
          };
          return next;
        });
      }, speed);
    });
  }

  return (
    <span
      className={className}
      aria-label={text}
      onMouseEnter={triggerOnHover ? run : undefined}
    >
      {chars.map((c, i) => (
        <span key={i} className="scrambled-char">{c.display}</span>
      ))}
    </span>
  );
}
