import { getLocales } from 'expo-localization';

import { en } from './en';
import { ru } from './ru';
import type { Lang } from './praise';

export { praiseText, fireText } from './praise';
export type { Lang, PraiseTone } from './praise';
export { mascotLost, mascotIntro } from './mascot';

export type LangSetting = 'system' | Lang;

const DICTS: Record<Lang, unknown> = { ru, en };

export function deviceLang(): Lang {
  const code = getLocales()[0]?.languageCode;
  return code === 'ru' ? 'ru' : 'en';
}

export function resolveLang(setting: LangSetting): Lang {
  return setting === 'system' ? deviceLang() : setting;
}

/** Достаёт строку по ключу вида 'home.newGame'; нет ключа → возвращает ключ. */
export function t(key: string, lang: Lang): string {
  let node: unknown = DICTS[lang];
  for (const part of key.split('.')) {
    if (node && typeof node === 'object' && part in (node as Record<string, unknown>)) {
      node = (node as Record<string, unknown>)[part];
    } else {
      return key;
    }
  }
  return typeof node === 'string' ? node : key;
}
