import { create } from 'zustand';

import { resolveLang } from '@/core/i18n';
import type { Lang, LangSetting, PraiseTone } from '@/core/i18n';
import { KEYS, getJSON, setJSON } from '@/core/storage';

interface SettingsData {
  sound: boolean;
  haptics: boolean;
  praiseTone: PraiseTone;
  themeId: string;
  lang: LangSetting;
}

interface SettingsState extends SettingsData {
  update: (patch: Partial<SettingsData>) => void;
}

const DEFAULTS: SettingsData = {
  sound: true,
  haptics: true,
  praiseTone: 'classic',
  themeId: 'classic',
  lang: 'system',
};

const saved = getJSON<Partial<SettingsData>>(KEYS.settings);

export const useSettings = create<SettingsState>((set, get) => ({
  ...DEFAULTS,
  ...saved,
  update: (patch) => {
    set(patch);
    const { sound, haptics, praiseTone, themeId, lang } = get();
    setJSON(KEYS.settings, { sound, haptics, praiseTone, themeId, lang });
  },
}));

/** Текущий язык UI с учётом настройки и локали устройства. */
export function useLang(): Lang {
  return useSettings((s) => resolveLang(s.lang));
}
