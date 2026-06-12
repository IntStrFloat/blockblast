import type { PraiseTier } from '../engine/types';

export type PraiseTone = 'classic' | 'meme';
export type Lang = 'ru' | 'en';

const PRAISES: Record<Lang, Record<PraiseTone, Record<Exclude<PraiseTier, 'none'>, string>>> = {
  ru: {
    classic: {
      good: 'Хорошо!',
      great: 'Отлично!',
      amazing: 'Невероятно!',
      unbelievable: 'ЛЕГЕНДА!',
    },
    meme: {
      good: 'норм',
      great: 'аура +100',
      amazing: 'без ума вообще',
      unbelievable: 'это вообще законно?!',
    },
  },
  en: {
    classic: {
      good: 'Good!',
      great: 'Great!',
      amazing: 'Amazing!',
      unbelievable: 'UNBELIEVABLE!',
    },
    meme: {
      good: 'nice',
      great: 'aura +100',
      amazing: 'actually insane',
      unbelievable: 'UNREAL?!',
    },
  },
};

const FIRE: Record<Lang, Record<PraiseTone, string>> = {
  ru: { classic: 'Серия x{n}!', meme: 'гори дальше 🔥' },
  en: { classic: 'Combo x{n}!', meme: 'on fire 🔥' },
};

export function praiseText(tier: PraiseTier, tone: PraiseTone, lang: Lang): string {
  if (tier === 'none') return '';
  return PRAISES[lang][tone][tier];
}

export function fireText(tone: PraiseTone, lang: Lang, combo: number): string {
  return FIRE[lang][tone].replace('{n}', String(combo));
}
