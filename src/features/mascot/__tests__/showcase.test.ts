import { parseShowcase, serializeShowcase } from '../logic/showcase';

describe('serializeShowcase', () => {
  it('кодирует стадию и слоты в порядке skin|hat|face|accessory|aura', () => {
    expect(serializeShowcase(2, { skin: 'skin-mint', face: 'face-glasses' })).toBe(
      '2|skin-mint||face-glasses||',
    );
  });

  it('пустая экипировка — только стадия и разделители', () => {
    expect(serializeShowcase(1, {})).toBe('1|||||');
  });
});

describe('parseShowcase', () => {
  it('обратен сериализации', () => {
    const raw = serializeShowcase(3, { hat: 'hat-panama', accessory: 'acc-scarf' });
    expect(parseShowcase(raw)).toEqual({
      stage: 3,
      equipped: { hat: 'hat-panama', accessory: 'acc-scarf' },
    });
  });

  it('неизвестный id или id не того слота отбрасывается послотно', () => {
    expect(parseShowcase('2|hat-panama||||')).toEqual({ stage: 2, equipped: {} }); // hat в слоте skin
    expect(parseShowcase('2|skin-mint|hat-fake|||')).toEqual({
      stage: 2,
      equipped: { skin: 'skin-mint' },
    });
  });

  it('мусор целиком → null', () => {
    expect(parseShowcase('')).toBeNull();
    expect(parseShowcase('abc')).toBeNull();
    expect(parseShowcase('9|||||')).toBeNull(); // стадии 9 нет
    expect(parseShowcase(null)).toBeNull();
    expect(parseShowcase(undefined)).toBeNull();
    expect(parseShowcase('2|' + 'x'.repeat(200))).toBeNull(); // длина за пределами
  });
});
