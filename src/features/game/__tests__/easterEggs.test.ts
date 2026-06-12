import { eggForScore } from '../easterEggs';

describe('eggForScore', () => {
  it('срабатывает при пересечении порога', () => {
    expect(eggForScore(13_000, 13_400)).toBe('easterEgg.e13337');
    expect(eggForScore(69_000, 70_000)).toBe('easterEgg.e69420');
    expect(eggForScore(99_999, 100_001)).toBe('easterEgg.e100001');
  });

  it('не повторяется после пересечения', () => {
    expect(eggForScore(13_400, 13_500)).toBeNull();
    expect(eggForScore(13_337, 13_338)).toBeNull();
  });

  it('ниже порога — ничего', () => {
    expect(eggForScore(0, 13_336)).toBeNull();
  });

  it('двойное пересечение — самый большой порог', () => {
    expect(eggForScore(10_000, 80_000)).toBe('easterEgg.e69420');
  });

  it('точное попадание в порог срабатывает', () => {
    expect(eggForScore(13_336, 13_337)).toBe('easterEgg.e13337');
  });
});
