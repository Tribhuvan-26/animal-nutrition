'use client';

import { useEffect, useRef, useState } from 'react';

// Mouse-trail cursor effect: drops an emoji at each mouse position,
// older drops fade and scale down. Inspired by reactbits.dev/text-animations/text-cursor.
export default function TextCursor({
  emoji = '💪',
  size = '1.6rem',
  spacing = 16,          // min px the mouse must move before dropping a new emoji
  trailLength = 12,      // max number of emojis on screen at once
  fadeMs = 700,          // how long each emoji takes to fade out
}) {
  const [trail, setTrail] = useState([]);
  const lastPosRef = useRef({ x: -9999, y: -9999 });
  const idRef = useRef(0);

  useEffect(() => {
    function onMove(e) {
      const { clientX: x, clientY: y } = e;
      const last = lastPosRef.current;
      const dx = x - last.x;
      const dy = y - last.y;
      if (dx * dx + dy * dy < spacing * spacing) return;
      lastPosRef.current = { x, y };
      const id = idRef.current++;
      setTrail((prev) => {
        const next = [...prev, { id, x, y, t: Date.now() }];
        return next.slice(-trailLength);
      });
      setTimeout(() => {
        setTrail((prev) => prev.filter((p) => p.id !== id));
      }, fadeMs);
    }
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [spacing, trailLength, fadeMs]);

  return (
    <div className="text-cursor-layer">
      {trail.map((p) => (
        <span
          key={p.id}
          className="text-cursor-emoji"
          style={{
            left: p.x,
            top: p.y,
            fontSize: size,
            '--fade-ms': `${fadeMs}ms`,
          }}
        >
          {emoji}
        </span>
      ))}
    </div>
  );
}
