import { t, type Lang } from '@/core/i18n';

import type { LeaderboardViewState, WeeklyLeaderboardSnapshot } from './types';

export function weeklyStatusLabel(
  viewState: LeaderboardViewState,
  source: WeeklyLeaderboardSnapshot['source'] | undefined,
  lang: Lang,
): string | null {
  if (viewState === 'cached') return t('leaderboard.savedResults', lang);
  if (source !== 'remote') return t('leaderboard.offline', lang);
  return null;
}
