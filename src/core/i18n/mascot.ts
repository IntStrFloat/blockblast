import type { Lang, PraiseTone } from './praise';

const MASCOT_LOST: Record<Lang, Record<PraiseTone, string[]>> = {
  ru: {
    classic: ['я потеряяялся ((('],
    meme: ['ну и куда ты меня… теперь ищи', 'я в свободном падении ееее'],
  },
  en: {
    classic: ['I got loooost ((('],
    meme: ['bro where am i now…', 'free fallin weeee'],
  },
};

const MASCOT_INTRO: Record<Lang, Record<PraiseTone, [string, string, string, string]>> = {
  ru: {
    classic: [
      'Привет! Я Капи 🫧',
      'Живу тут — наверху 👋',
      'Ты играешь — я расту 📈',
      'Заходи каждый день — стану легендой',
    ],
    meme: [
      'йо. я Капи 🫧',
      'обитаю тут, сверху 👋',
      'ты фармишь — я левелюсь 📈',
      'залетай каждый день — стану легендой',
    ],
  },
  en: {
    classic: [
      "Hi! I'm Capi 🫧",
      'I live up here 👋',
      'You play — I grow 📈',
      'Come back daily — I will become a legend',
    ],
    meme: [
      "yo. I'm Capi 🫧",
      'i vibe up here 👋',
      'you grind — i level 📈',
      'pull up daily — legend arc',
    ],
  },
};

export function mascotLost(tone: PraiseTone, lang: Lang): string {
  const arr = MASCOT_LOST[lang][tone];
  return arr[Math.floor(Math.random() * arr.length)];
}

export function mascotIntro(beat: 0 | 1 | 2 | 3, tone: PraiseTone, lang: Lang): string {
  return MASCOT_INTRO[lang][tone][beat];
}
