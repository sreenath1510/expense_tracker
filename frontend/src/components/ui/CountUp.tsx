import { useEffect, useRef, useState } from 'react';

interface CountUpProps {
  value: number;
  /** Formats the animated number for display (e.g. formatAmount). */
  format: (n: number) => string;
  durationMs?: number;
}

/**
 * Animates a number from its previous value to the new one with an
 * ease-out curve. Respects prefers-reduced-motion (snaps instantly).
 */
export function CountUp({ value, format, durationMs = 650 }: CountUpProps) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const from = fromRef.current;
    const to = value;
    if (reduce || from === to) {
      setDisplay(to);
      fromRef.current = to;
      return;
    }

    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setDisplay(from + (to - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs]);

  return <>{format(display)}</>;
}
