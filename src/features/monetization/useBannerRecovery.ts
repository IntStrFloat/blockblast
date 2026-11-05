import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

const RETRY_DELAYS = [30_000, 60_000];

/** Recover an initial failure that the SDK cannot refresh while unattached. */
export function useBannerRecovery(active: boolean) {
  const [generation, setGeneration] = useState(0);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failed = useRef(false);
  const loaded = useRef(false);
  const retries = useRef(0);
  const lastRequestAt = useRef(Date.now());
  const enabled = useRef(active);

  const cancel = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const schedule = useCallback((delay: number) => {
    if (timer.current !== null || !enabled.current || AppState.currentState !== 'active'
      || loaded.current || !failed.current || retries.current >= RETRY_DELAYS.length) return;
    timer.current = setTimeout(() => {
      timer.current = null;
      if (!enabled.current || AppState.currentState !== 'active' || loaded.current || !failed.current) return;
      retries.current += 1;
      failed.current = false;
      loaded.current = false;
      lastRequestAt.current = Date.now();
      setGeneration((value) => value + 1);
    }, delay);
  }, []);

  useEffect(() => {
    enabled.current = active;
    failed.current = false;
    loaded.current = false;
    retries.current = 0;
    lastRequestAt.current = Date.now();
    return () => { enabled.current = false; cancel(); };
  }, [active, cancel]);

  useEffect(() => {
    let previousState = AppState.currentState;
    const subscription = AppState.addEventListener('change', (state) => {
      const returning = state === 'active'
        && (previousState === 'background' || previousState === 'inactive');
      previousState = state;
      setForeground(state === 'active');
      if (state !== 'active') cancel();
      else if (returning && failed.current && !loaded.current) {
        // A user returning later gets a fresh bounded recovery window.
        // Repeated active events must not reset the budget or request timing.
        retries.current = 0;
        schedule(Math.max(0, 30_000 - (Date.now() - lastRequestAt.current)));
      }
    });
    return () => { subscription.remove(); cancel(); };
  }, [cancel, schedule]);

  return {
    generation,
    foreground,
    onLoaded() {
      loaded.current = true;
      failed.current = false;
      retries.current = 0;
      cancel();
    },
    onFailed() {
      // An attached banner owns its refresh lifecycle; replacing it would
      // discard the current creative after an ordinary refresh failure.
      if (loaded.current) return;
      failed.current = true;
      const delay = RETRY_DELAYS[retries.current];
      if (delay !== undefined) schedule(delay);
    },
  };
}
