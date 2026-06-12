import { praiseText, resolveLang, t } from '../index';

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
