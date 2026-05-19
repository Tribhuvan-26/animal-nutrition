'use client';

import { useEffect, useState, useRef } from 'react';

const SCRAMBLE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*';

// Continuous-loop shuffle reveal: each character cycles through random chars
// then locks in. After the full text is revealed, pauses and re-runs.
export default function ShuffleText({
  text,
  revealMs = 60,       // ms between locking each character
  scrambleMs = 30,     // ms between scramble updates
  holdMs = 1800,       // pause once fully revealed before restarting
  className = '',
}) {
  const [display, setDisplay] = useState(() => randomString(text.length));
  const timersRef = useRef([]);

  useEffect(() => {
    let cancelled = false;

    function clearTimers() {
      timersRef.current.forEach(clearTimeout);
      timersRef.current.forEach(clearInterval);
      timersRef.current = [];
    }

    function run() {
      if (cancelled) return;
      clearTimers();

      // Scrambler tick: regenerate the not-yet-locked tail every scrambleMs.
      let lockedCount = 0;
      const scrambleTimer = setInterval(() => {
        if (cancelled) return;
        setDisplay((prev) => {
          const lockedSlice = text.slice(0, lockedCount);
          const tail = randomString(text.length - lockedCount);
          return lockedSlice + tail;
        });
      }, scrambleMs);
      timersRef.current.push(scrambleTimer);

      // Lock characters one-by-one every revealMs.
      for (let i = 1; i <= text.length; i++) {
        const t = setTimeout(() => {
          if (cancelled) return;
          lockedCount = i;
          setDisplay((prev) => {
            const lockedSlice = text.slice(0, lockedCount);
            const tail = randomString(text.length - lockedCount);
            return lockedSlice + tail;
          });
          if (i === text.length) {
            clearInterval(scrambleTimer);
            const next = setTimeout(run, holdMs);
            timersRef.current.push(next);
          }
        }, i * revealMs);
        timersRef.current.push(t);
      }
    }

    run();
    return () => {
      cancelled = true;
      clearTimers();
    };
  }, [text, revealMs, scrambleMs, holdMs]);

  return <span className={className} aria-label={text}>{display}</span>;
}

function randomString(len) {
  let s = '';
  for (let i = 0; i < len; i++) {
    s += SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
  }
  return s;
}
