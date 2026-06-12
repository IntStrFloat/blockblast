import { formatShareText } from '../shareScore';

describe('formatShareText', () => {
  it('ru: заголовок + счёт', () => {
    const text = formatShareText(12345, false, 'ru');
    expect(text).toContain('Мой результат в Block Blast');
    expect(text).toContain('🧱');
    expect(text).toContain('12');
    expect(text).not.toContain('рекорд');
  });

  it('ru: с рекордом — суффикс', () => {
    const text = formatShareText(999, true, 'ru');
    expect(text).toContain('личный рекорд');
    expect(text).toContain('🔥');
  });

  it('en: локализован', () => {
    const text = formatShareText(500, true, 'en');
    expect(text).toContain('My Block Blast score');
    expect(text).toContain('personal best');
  });

  it('без призыва скачать (анти-чеклист 06)', () => {
    const text = formatShareText(100, true, 'ru').toLowerCase();
    expect(text).not.toMatch(/скачай|download|install|http/);
  });
});
