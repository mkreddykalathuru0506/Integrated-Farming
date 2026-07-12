import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { prefersReducedMotion, useCountUp } from './motion';

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('prefersReducedMotion', () => {
  it('is false when matchMedia is unavailable (jsdom) — animation stays enabled', () => {
    expect(prefersReducedMotion()).toBe(false);
  });

  it('reflects the media query when available', () => {
    stubMatchMedia(true);
    expect(prefersReducedMotion()).toBe(true);
    stubMatchMedia(false);
    expect(prefersReducedMotion()).toBe(false);
  });
});

describe('useCountUp', () => {
  it('starts at the target (no phantom zero on first paint)', () => {
    const { result } = renderHook(() => useCountUp(300));
    expect(result.current).toBe(300);
  });

  it('under prefers-reduced-motion, jumps straight to a new target', async () => {
    stubMatchMedia(true);
    const { result, rerender } = renderHook(({ target }) => useCountUp(target), {
      initialProps: { target: 100 },
    });
    rerender({ target: 900 });
    await waitFor(() => expect(result.current).toBe(900));
  });

  it('animates toward a changed target and settles exactly on it', async () => {
    const { result, rerender } = renderHook(({ target }) => useCountUp(target, 120), {
      initialProps: { target: 0 },
    });
    rerender({ target: 1000 });
    // easeOutExpo is monotonic — the hook must land exactly on the target when done.
    await waitFor(() => expect(result.current).toBe(1000), { timeout: 2000 });
  });

  it('non-finite targets short-circuit instead of running rAF forever', () => {
    const { result } = renderHook(() => useCountUp(Number.NaN));
    expect(Number.isNaN(result.current)).toBe(true);
  });
});
