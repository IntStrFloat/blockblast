import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { getUtcWeekWindow } from './week';

/** Keeps weekly-goal assignment reactive across Moscow Monday while mounted. */
export function useWeeklyGoalWeekKey(): string {
  const [weekKey, setWeekKey] = useState(() => getUtcWeekWindow(new Date()).weekKey);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      const now = new Date();
      const window = getUtcWeekWindow(now);
      setWeekKey(window.weekKey);
      if (timer) clearTimeout(timer);
      const untilBoundary = Math.max(
        1,
        new Date(window.weekEndIso).getTime() - now.getTime() + 50,
      );
      timer = setTimeout(schedule, Math.min(untilBoundary, 2_147_483_647));
    };
    schedule();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') schedule();
    });
    return () => {
      if (timer) clearTimeout(timer);
      subscription.remove();
    };
  }, []);

  return weekKey;
}
