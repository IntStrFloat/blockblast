/* In-memory мок MMKV: тесты сторов не требуют нативного модуля */
jest.mock('react-native-mmkv', () => {
  class MMKV {
    constructor() {
      this.map = new Map();
    }
    set(key, value) {
      this.map.set(key, value);
    }
    getString(key) {
      const v = this.map.get(key);
      return typeof v === 'string' ? v : undefined;
    }
    getNumber(key) {
      const v = this.map.get(key);
      return typeof v === 'number' ? v : undefined;
    }
    getBoolean(key) {
      const v = this.map.get(key);
      return typeof v === 'boolean' ? v : undefined;
    }
    remove(key) {
      return this.map.delete(key);
    }
    contains(key) {
      return this.map.has(key);
    }
    getAllKeys() {
      return [...this.map.keys()];
    }
    clearAll() {
      this.map.clear();
    }
  }
  return { MMKV, createMMKV: () => new MMKV() };
});

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'ru', languageTag: 'ru-RU' }],
}));
