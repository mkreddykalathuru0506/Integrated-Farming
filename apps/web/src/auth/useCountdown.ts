import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 1 Hz countdown for OTP resend cooldowns: `start(n)` (n = server `retryAfterSec`)
 * ticks `seconds` from n down to 0. The interval is cleared at zero, on restart
 * and on unmount.
 */
export function useCountdown() {
  const [seconds, setSeconds] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (timer.current !== null) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  const start = useCallback(
    (n: number) => {
      stop();
      setSeconds(n);
      if (n <= 0) return;
      timer.current = setInterval(() => {
        setSeconds((s) => {
          if (s <= 1) {
            stop(); // idempotent — safe under StrictMode double-invocation
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    },
    [stop],
  );

  useEffect(() => stop, [stop]);

  return { seconds, start };
}
