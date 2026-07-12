import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '../ui';

/**
 * One-shot scroll reveal for landing sections (motion-standard §3: entrances are
 * opacity+transform only, ≤300ms, `motion-safe:`-gated). This is a reveal-on-enter,
 * NOT scroll-linked animation — it fires once and never tracks scroll position.
 *
 * Fail-open by design: under `prefers-reduced-motion`, when IntersectionObserver is
 * unavailable (jsdom, ancient browsers), or before hydration completes, content shows
 * immediately — it can never be trapped invisible.
 */
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      setShown(true);
      return;
    }
    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }
    // Already in view on mount (above the fold) → reveal without waiting a frame.
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.1 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return { ref, shown };
}

type RevealProps = {
  children: ReactNode;
  className?: string;
};

/** Wrapper that fades+lifts its children in the first time they scroll into view. */
export function Reveal({ children, className }: RevealProps) {
  const { ref, shown } = useReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={cn(
        shown
          ? 'motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-300'
          : 'opacity-0',
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Hero-entrance stagger classes (mount-time, above the fold — sanctioned by
 * motion-standard §3.2). `fill-mode-backwards` keeps delayed items hidden until
 * their delay starts; pair with `style={{ animationDelay }}`.
 */
export const ENTRANCE =
  'motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-300 motion-safe:fill-mode-backwards';
