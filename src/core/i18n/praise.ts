import type { PraiseTier } from '../engine/types';

export type PraiseTone = 'classic' | 'meme';
export type Lang = 'ru' | 'en';

// Несколько вариантов на тир: похвалы при разрушении не приедаются (бриф
// «больше текстов»). Наборы тонов не пересекаются — тона всегда различимы.
const PRAISES: Record<
  Lang,
  Record<PraiseTone, Record<Exclude<PraiseTier, 'none'>, readonly string[]>>
> = {
  ru: {
    classic: {
      good: ['Хорошо!', 'Чисто!', 'Точно!'],
      great: ['Отлично!', 'Красота!', 'Мощно!'],
      amazing: ['Невероятно!', 'Феноменально!', 'Вот это ход!'],
      unbelievable: ['ЛЕГЕНДА!', 'КОСМОС!', 'НЕРЕАЛЬНО!'],
    },
    meme: {
      good: ['норм', 'база', 'зачёт'],
      great: ['аура +100', 'имба ход', 'красиво живёшь'],
      amazing: ['без ума вообще', 'сигма-ход', 'ты читер?'],
      unbelievable: ['это вообще законно?!', 'админ, забань его', 'аура овер 9000'],
    },
  },
  en: {
    classic: {
      good: ['Good!', 'Clean!', 'Nice fit!'],
      great: ['Great!', 'Stylish!', 'Strong!'],
      amazing: ['Amazing!', 'Spectacular!', 'What a move!'],
      unbelievable: ['UNBELIEVABLE!', 'LEGENDARY!', 'COSMIC!'],
    },
    meme: {
      good: ['nice', 'based', 'ok that works'],
      great: ['aura +100', 'clutch move', 'living lavish'],
      amazing: ['actually insane', 'sigma play', 'are you cheating?'],
      unbelievable: ['UNREAL?!', 'mods, ban him', 'aura over 9000'],
    },
  },
};

const FIRE: Record<Lang, Record<PraiseTone, string>> = {
  ru: { classic: 'Серия x{n}!', meme: 'гори дальше 🔥' },
  en: { classic: 'Combo x{n}!', meme: 'on fire 🔥' },
};

// Имена фаз атмосферы (features/game/animation/atmosphere.ts), индекс = фаза − 1.
const ATMOSPHERE_PHASES: Record<Lang, Record<PraiseTone, readonly string[]>> = {
  ru: {
    classic: ['Разогрев!', 'Ты в потоке!', 'Шторм очков!'],
    meme: ['пошла жара', 'поймал поток', 'это уже шторм'],
  },
  en: {
    classic: ['Heating up!', 'In the flow!', 'Score storm!'],
    meme: ['cooking now', 'flow state on', 'full storm mode'],
  },
};

function pick(variants: readonly string[]): string {
  return variants[Math.floor(Math.random() * variants.length)] ?? variants[0];
}

export function praiseText(tier: PraiseTier, tone: PraiseTone, lang: Lang): string {
  if (tier === 'none') return '';
  return pick(PRAISES[lang][tone][tier]);
}

/** Все варианты тира — для тестов и превью настроек. */
export function praiseVariants(
  tier: Exclude<PraiseTier, 'none'>,
  tone: PraiseTone,
  lang: Lang,
): readonly string[] {
  return PRAISES[lang][tone][tier];
}

export function fireText(tone: PraiseTone, lang: Lang, combo: number): string {
  return FIRE[lang][tone].replace('{n}', String(combo));
}

/** Текст тоста смены фазы атмосферы; фаза 0 и неизвестные → пустая строка. */
export function atmosphereText(phase: number, tone: PraiseTone, lang: Lang): string {
  return ATMOSPHERE_PHASES[lang][tone][phase - 1] ?? '';
}
