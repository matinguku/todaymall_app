import { useEffect, useState } from 'react';

interface SplashGateOptions {
  // Minimum time the splash stays up. Even if everything resolves instantly,
  // we hold for this long so the splash doesn't flash on screen.
  minDurationMs?: number;
  // Hard cap so a hanging prefetch can never strand the user on splash.
  maxDurationMs?: number;
  // Promises to wait on (e.g. homePrefetchPromise, homeChunkPromise). Splash
  // releases when all settle OR maxDurationMs hits, whichever comes first —
  // but never before minDurationMs.
  waitFor?: Array<Promise<unknown> | undefined | null>;
}

// Returns `true` while the splash should still be visible. Combine with
// AuthContext.isLoading in the navigator: show splash if either is true.
export function useSplashGate({
  minDurationMs = 1500,
  maxDurationMs = 4000,
  waitFor = [],
}: SplashGateOptions = {}): boolean {
  const [holding, setHolding] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const start = Date.now();

    const release = () => {
      if (cancelled) return;
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, minDurationMs - elapsed);
      setTimeout(() => {
        if (!cancelled) setHolding(false);
      }, remaining);
    };

    const settled = Promise.allSettled(waitFor.filter(Boolean) as Promise<unknown>[]);
    const cap = new Promise<void>((resolve) => setTimeout(resolve, maxDurationMs));
    Promise.race([settled, cap]).then(release);

    return () => {
      cancelled = true;
    };
    // We intentionally only run once on mount — recomputing the gate when the
    // waitFor array identity changes would re-arm the timers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return holding;
}
