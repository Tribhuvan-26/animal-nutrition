'use client';

// BlurText: each character fades in from blurred/shifted to crisp/in-place,
// staggered per char. Inspired by reactbits.dev/text-animations/blur-text.
export default function BlurText({
  text,
  delay = 60,          // ms per character stagger
  duration = 700,      // animation duration per char (ms)
  className = '',
}) {
  return (
    <span className={className} aria-label={text}>
      {text.split('').map((c, i) => (
        <span
          key={i}
          className="blur-char"
          style={{
            animationDelay: `${i * delay}ms`,
            animationDuration: `${duration}ms`,
          }}
        >
          {c === ' ' ? ' ' : c}
        </span>
      ))}
    </span>
  );
}
