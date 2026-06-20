import { useProgression } from '@/features/progression';

import { WORLD_THEMES, getWorldTheme, type WorldTheme } from './catalog';

/** Текущая активная тема мира (из progression.activeTheme). */
export function activeWorldTheme(): WorldTheme {
  return getWorldTheme(useProgression.getState().activeTheme);
}

/** Открытые темы (по достигнутым мирам). */
export function unlockedWorldThemes(): WorldTheme[] {
  return useProgression.getState().unlockedThemes.map(getWorldTheme);
}

/** Реактивная активная тема мира — рендер игры/лого перерисовывается при смене мира/выборе. */
export function useActiveWorldTheme(): WorldTheme {
  return useProgression((s) => getWorldTheme(s.activeTheme));
}

/** Реактивный список открытых тем — для пикера в Settings. */
export function useUnlockedWorldThemes(): WorldTheme[] {
  const ids = useProgression((s) => s.unlockedThemes);
  return ids.map(getWorldTheme);
}

/** Установить активную тему — только если открыта (guard в progression.setActiveTheme). */
export function setActiveWorldTheme(id: string): void {
  useProgression.getState().setActiveTheme(id);
}

export { WORLD_THEMES, getWorldTheme };
export type { WorldTheme };
