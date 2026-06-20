import type { Lang } from './praise';

/**
 * Строки прогрессии/карты достижений. Отдельный namespace (как mascot.ts/praise.ts),
 * чтобы не трогать общий словарь en.ts/ru.ts. Доступ — через progressionText().
 */
const STRINGS: Record<Lang, Record<string, string>> = {
  ru: {
    mapTitle: 'Карта достижений',
    level: 'Уровень',
    lvlShort: 'ур.',
    world: 'Мир',
    toNext: 'до следующего уровня',
    current: 'ты здесь',
    worldReward: 'Новый дизайн',
    capiStyle: 'Стиль Капи',
    helper: 'Помощник',
    nothing: 'Уровень без приза',
    approaching: 'приближается новый мир',
  },
  en: {
    mapTitle: 'Achievements map',
    level: 'Level',
    lvlShort: 'lvl',
    world: 'World',
    toNext: 'to next level',
    current: 'you are here',
    worldReward: 'New design',
    capiStyle: 'Capi style',
    helper: 'Helper',
    nothing: 'No reward',
    approaching: 'a new world approaches',
  },
};

export function progressionText(key: string, lang: Lang): string {
  return STRINGS[lang][key] ?? key;
}
