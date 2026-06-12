import { KEYS, getJSON, removeKey, setJSON } from '../index';

describe('storage (mmkv json)', () => {
  it('roundtrip JSON', () => {
    setJSON(KEYS.settings, { sound: true, n: 5 });
    expect(getJSON(KEYS.settings)).toEqual({ sound: true, n: 5 });
  });

  it('отсутствующий ключ → null', () => {
    expect(getJSON('no.such.key')).toBeNull();
  });

  it('removeKey удаляет', () => {
    setJSON(KEYS.adsMeta, { shown: 1 });
    removeKey(KEYS.adsMeta);
    expect(getJSON(KEYS.adsMeta)).toBeNull();
  });
});
