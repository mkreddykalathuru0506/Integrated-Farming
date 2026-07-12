import { useEffect, useRef, useState } from 'react';

/**
 * Motion helpers — IFM motion standard (slice 11.10, motion-standard.md).
 * CSS animations are killed globally under prefers-reduced-motion (index.css);
 * these helpers cover the JS-driven side (Recharts entrances, rAF count-ups).
 */

/** True when the user asked for reduced motion. For JS-driven animation only —
 *  CSS is already handled globally in index.css. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

/**
 * Animates toward `target` over `ms` (default 600) with easeOutExpo via rAF.
 * Respects prefers-reduced-motion (jumps straight to target). Render the result
 * inside an element that keeps the `.tabular` class so digits never jitter.
 *
 * Money rule (§0): only ever animate a display-only number and re-format —
 * `fmtInrCompact(BigInt(Math.round(useCountUp(Number(paise)))))`. Never feed the
 * animated value back into any calculation.
 */
export function useCountUp(target: number, ms = 600): number {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    if (prefersReducedMotion() || !Number.isFinite(target)) {
      from.current = target;
      setValue(target);
      return;
    }
    // Anchor to the FIRST frame's timestamp (not performance.now()): rAF timestamps
    // are only guaranteed to share an origin with each other, not with the caller's
    // clock (jsdom differs; browsers agree — either way t starts at exactly 0).
    let start: number | null = null;
    const v0 = from.current;
    let raf = requestAnimationFrame(function tick(now: number) {
      if (start === null) start = now;
      const t = Math.min(1, (now - start) / ms);
      setValue(v0 + (target - v0) * easeOutExpo(t));
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    });
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}
