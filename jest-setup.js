/* react-native-reanimated + worklets: мок для unit-тестов без нативного слоя */
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));

/* react-native-rustore-push (GitFlic 6.x): нативный модуль без node-сборки —
   мок, чтобы импорт rustorePush.native.ts не падал в jest (логику тестируем через Noop). */
jest.mock('react-native-rustore-push', () => ({
  __esModule: true,
  default: {
    createPushEmitter: jest.fn(),
    deletePushEmitter: jest.fn(),
    getToken: jest.fn(() => Promise.resolve('')),
    deleteToken: jest.fn(() => Promise.resolve(true)),
    checkPushAvailability: jest.fn(() => Promise.resolve(false)),
    getInitialNotification: jest.fn(() => Promise.resolve(null)),
  },
  eventEmitter: { addListener: jest.fn(() => ({ remove: jest.fn() })) },
  PushEvents: {
    ON_NEW_TOKEN: 'ON_NEW_TOKEN',
    ON_MESSAGE_RECEIVED: 'ON_MESSAGE_RECEIVED',
    ON_DELETED_MESSAGES: 'ON_DELETED_MESSAGES',
    ON_ERROR: 'ON_ERROR',
    ON_OPENED: 'ON_OPENED',
  },
}), { virtual: true });

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

/* react-native-svg: лёгкие host-стабы, чтобы UI-импорты (иконки) грузились в jest. */
jest.mock('react-native-svg', () => {
  const React = require('react');
  const stub = (name) => {
    const Comp = ({ children, ...props }) => React.createElement(name, props, children);
    Comp.displayName = name;
    return Comp;
  };
  const Svg = stub('Svg');
  return {
    __esModule: true,
    default: Svg,
    Svg,
    Path: stub('Path'),
    G: stub('G'),
    Circle: stub('Circle'),
    Rect: stub('Rect'),
    Defs: stub('Defs'),
    LinearGradient: stub('LinearGradient'),
    RadialGradient: stub('RadialGradient'),
    Stop: stub('Stop'),
    Polygon: stub('Polygon'),
    Line: stub('Line'),
  };
});
