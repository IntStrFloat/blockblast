// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'scripts/*', 'jest-setup.js'],
  },
  {
    rules: {
      // Запись в sharedValue.value внутри колбэков — канонический паттерн
      // Reanimated; react-compiler-правила дают на нём ложные срабатывания.
      'react-hooks/immutability': 'off',
      'react-hooks/purity': 'off',
    },
  },
]);
