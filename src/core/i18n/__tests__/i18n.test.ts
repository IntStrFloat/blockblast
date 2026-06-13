import { praiseText, resolveLang, t, mascotLost, mascotIntro } from '../index';

describe('t()', () => {
  it('возвращает строки ru и en', () => {
    expect(t('home.newGame', 'ru')).toBe('Новая игра');
    expect(t('home.newGame', 'en')).toBe('New game');
  });

  it('неизвестный ключ возвращается как есть (fallback)', () => {
    expect(t('no.such.key', 'ru')).toBe('no.such.key');
  });
});

describe('resolveLang', () => {
  it('явный выбор побеждает', () => {
    expect(resolveLang('en')).toBe('en');
    expect(resolveLang('ru')).toBe('ru');
  });

  it('system берёт локаль устройства (в тестах ru из мока)', () => {
    expect(resolveLang('system')).toBe('ru');
  });
});

describe('praiseText', () => {
  const tiers = ['good', 'great', 'amazing', 'unbelievable'] as const;

  it('все тиры обоих тонов на обоих языках непустые', () => {
    for (const lang of ['ru', 'en'] as const) {
      for (const tone of ['classic', 'meme'] as const) {
        for (const tier of tiers) {
          expect(praiseText(tier, tone, lang).length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('тона различаются', () => {
    expect(praiseText('great', 'classic', 'ru')).not.toBe(praiseText('great', 'meme', 'ru'));
  });

  it('none → пустая строка', () => {
    expect(praiseText('none', 'classic', 'ru')).toBe('');
  });
});

describe('mascotIntro', () => {
  it('beat 0, classic, ru начинается с «Привет»', () => {
    expect(mascotIntro(0, 'classic', 'ru')).toMatch(/^Привет/);
  });

  it('beat 3, meme, en — непустая строка', () => {
    expect(mascotIntro(3, 'meme', 'en').length).toBeGreaterThan(0);
  });

  it('для каждого lang × tone интро содержит ровно 4 бита', () => {
    for (const lang of ['ru', 'en'] as const) {
      for (const tone of ['classic', 'meme'] as const) {
        const beats = ([0, 1, 2, 3] as const).map((b) => mascotIntro(b, tone, lang));
        expect(beats).toHaveLength(4);
        beats.forEach((s) => expect(s.length).toBeGreaterThan(0));
      }
    }
  });
});

describe('mascotLost', () => {
  const LOST_RU_MEME = ['ну и куда ты меня… теперь ищи', 'я в свободном падении ееее'];

  it('mascotLost meme ru возвращает один из допустимых вариантов', () => {
    for (let i = 0; i < 20; i++) {
      expect(LOST_RU_MEME).toContain(mascotLost('meme', 'ru'));
    }
  });

  it('для каждого lang × tone массив lost непустой', () => {
    for (const lang of ['ru', 'en'] as const) {
      for (const tone of ['classic', 'meme'] as const) {
        // call multiple times to ensure we always get a non-empty string
        for (let i = 0; i < 5; i++) {
          expect(mascotLost(tone, lang).length).toBeGreaterThan(0);
        }
      }
    }
  });
});
