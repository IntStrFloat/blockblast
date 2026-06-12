import { DEFAULT_CONFIG } from '../config';
import { praiseFor, scorePlacement } from '../scoring';

const cfg = DEFAULT_CONFIG.scoring;

describe('scorePlacement (формула оригинала, спека 03)', () => {
  it('без очистки — только клетки фигуры', () => {
    expect(scorePlacement(4, 0, 0, 0, false, cfg)).toBe(4);
    expect(scorePlacement(1, 0, 0, 0, false, cfg)).toBe(1);
  });

  it('1 строка: 8 клеток ×10 + бонус 10 = 90 (плюс размещение)', () => {
    expect(scorePlacement(3, 8, 1, 1, false, cfg)).toBe(3 + 90);
  });

  it('2 линии: 16 клеток ×10 + бонус 20 = 180', () => {
    expect(scorePlacement(4, 16, 2, 1, false, cfg)).toBe(4 + 180);
  });

  it('3 линии: бонус 60', () => {
    // 3 строки = 24 клетки
    expect(scorePlacement(5, 24, 3, 1, false, cfg)).toBe(5 + 240 + 60);
  });

  it('6+ линий: бонус 300 (потолок таблицы)', () => {
    expect(scorePlacement(5, 40, 6, 1, false, cfg)).toBe(5 + 400 + 300);
    expect(scorePlacement(5, 40, 7, 1, false, cfg)).toBe(5 + 400 + 300);
  });

  it('комбо-множитель: combo=3 → ×2', () => {
    expect(scorePlacement(3, 8, 1, 3, false, cfg)).toBe(3 + 180);
  });

  it('полная очистка доски: +360 после множителя', () => {
    expect(scorePlacement(1, 8, 1, 1, true, cfg)).toBe(1 + 90 + 360);
  });
});

describe('praiseFor', () => {
  it('тиры по числу линий', () => {
    expect(praiseFor(0)).toBe('none');
    expect(praiseFor(1)).toBe('good');
    expect(praiseFor(2)).toBe('great');
    expect(praiseFor(3)).toBe('amazing');
    expect(praiseFor(4)).toBe('unbelievable');
    expect(praiseFor(6)).toBe('unbelievable');
  });
});
