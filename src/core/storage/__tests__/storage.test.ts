import {
  KEYS,
  getJSON,
  getString,
  removeKey,
  setJSON,
  setString,
  storage,
} from '../index';

describe('storage (mmkv json)', () => {
  it('roundtrips JSON', () => {
    setJSON(KEYS.settings, { sound: true, n: 5 });
    expect(getJSON(KEYS.settings)).toEqual({ sound: true, n: 5 });
  });

  it('returns null for a missing key', () => {
    expect(getJSON('no.such.key')).toBeNull();
  });

  it('removes persisted values', () => {
    setJSON(KEYS.adsMeta, { shown: 1 });
    removeKey(KEYS.adsMeta);
    expect(getJSON(KEYS.adsMeta)).toBeNull();
  });

  it('treats unavailable browser storage as empty during server rendering', () => {
    const getStringSpy = jest.spyOn(storage, 'getString').mockImplementation(() => {
      throw new Error('localStorage unavailable');
    });

    expect(getJSON(KEYS.settings)).toBeNull();
    expect(getString(KEYS.profileAuth)).toBeNull();

    getStringSpy.mockRestore();
  });

  it('does not crash server rendering when persistence is unavailable', () => {
    const setSpy = jest.spyOn(storage, 'set').mockImplementation(() => {
      throw new Error('localStorage unavailable');
    });
    const removeSpy = jest.spyOn(storage, 'remove').mockImplementation(() => {
      throw new Error('localStorage unavailable');
    });

    expect(() => setJSON(KEYS.settings, { sound: true })).not.toThrow();
    expect(() => setString(KEYS.profileAuth, 'token')).not.toThrow();
    expect(() => removeKey(KEYS.profileAuth)).not.toThrow();

    setSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
