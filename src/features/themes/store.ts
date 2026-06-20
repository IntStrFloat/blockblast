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

/** Установить активную тему — только если открыта (guard в progression.setActiveTheme). */
export function setActiveWorldTheme(id: string): void {
  useProgression.getState().setActiveTheme(id);
}

export { WORLD_THEMES, getWorldTheme };
export type { WorldTheme };
