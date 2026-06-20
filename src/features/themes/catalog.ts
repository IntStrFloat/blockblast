/**
 * Каталог тем миров (спека 12). Самодостаточные данные для рескина поля/блоков/juice.
 * id совпадают с PROGRESSION_CONFIG.worldThemeId. Миры 1–2 повторяют палитры 04 (classic / y2k).
 * Применение к рендеру игры — отдельный шаг интеграции (см. спеку 12, раздел «Применение»).
 */
export interface WorldTheme {
  id: string;
  /** i18n-ключ названия мира. */
  nameKey: string;
  bgTop: string;
  bgBottom: string;
  boardBg: string;
  cellEmpty: string;
  /** Цвета блоков по colorId (6). */
  cellColors: string[];
  /** Цвета вспышек/частиц очистки. */
  juiceColors: string[];
  /** Акцент текста похвал. */
  praiseAccent: string;
}

export const WORLD_THEMES: WorldTheme[] = [
  {
    id: 'classic',
    nameKey: 'themes.classic',
    bgTop: '#1B2A4A',
    bgBottom: '#0F1B33',
    boardBg: '#142142',
    cellEmpty: '#1E2F55',
    cellColors: ['#FF4D6D', '#FF9F1C', '#FFD23F', '#3DDC84', '#3FA7FF', '#B36BFF'],
    juiceColors: ['#FFD23F', '#3FA7FF', '#FF4D6D'],
    praiseAccent: '#FFC93C',
  },
  {
    id: 'neon',
    nameKey: 'themes.neon',
    bgTop: '#1A1A26',
    bgBottom: '#101018',
    boardBg: '#181826',
    cellEmpty: '#232336',
    cellColors: ['#F2A6D8', '#FFE39B', '#9BE8E0', '#B9B4F2', '#A7C8FF', '#C9D6E8'],
    juiceColors: ['#F2A6D8', '#9BE8E0', '#B9B4F2'],
    praiseAccent: '#9BE8E0',
  },
  {
    id: 'sunset',
    nameKey: 'themes.sunset',
    bgTop: '#2A1A2E',
    bgBottom: '#181020',
    boardBg: '#2A1C30',
    cellEmpty: '#3A2540',
    cellColors: ['#FF6B6B', '#FF9E4F', '#FFD166', '#F7B267', '#F4845F', '#F25C54'],
    juiceColors: ['#FF6B6B', '#FFD166', '#FF9E4F'],
    praiseAccent: '#FFD166',
  },
  {
    id: 'mono',
    nameKey: 'themes.mono',
    bgTop: '#1C1F26',
    bgBottom: '#0F1116',
    boardBg: '#1A1D24',
    cellEmpty: '#262A33',
    cellColors: ['#E6EAF2', '#C2CADD', '#9AA6C2', '#7682A3', '#586187', '#454E70'],
    juiceColors: ['#E6EAF2', '#9AA6C2', '#7682A3'],
    praiseAccent: '#C2CADD',
  },
  {
    id: 'aqua',
    nameKey: 'themes.aqua',
    bgTop: '#0E2A33',
    bgBottom: '#07171C',
    boardBg: '#0F2A33',
    cellEmpty: '#163942',
    cellColors: ['#5EEAD4', '#2DD4BF', '#22D3EE', '#38BDF8', '#60A5FA', '#34D399'],
    juiceColors: ['#5EEAD4', '#22D3EE', '#38BDF8'],
    praiseAccent: '#22D3EE',
  },
  {
    id: 'galaxy',
    nameKey: 'themes.galaxy',
    bgTop: '#1A1330',
    bgBottom: '#0C0820',
    boardBg: '#1B1640',
    cellEmpty: '#2A2150',
    cellColors: ['#A78BFA', '#C084FC', '#818CF8', '#F0ABFC', '#7DD3FC', '#F472B6'],
    juiceColors: ['#A78BFA', '#F0ABFC', '#7DD3FC'],
    praiseAccent: '#C084FC',
  },
  {
    id: 'gold',
    nameKey: 'themes.gold',
    bgTop: '#2A220E',
    bgBottom: '#161204',
    boardBg: '#2A2310',
    cellEmpty: '#3A3018',
    cellColors: ['#FFD700', '#FFC93C', '#F6C453', '#E9B949', '#FFE08A', '#D4AF37'],
    juiceColors: ['#FFD700', '#FFE08A', '#F6C453'],
    praiseAccent: '#FFD700',
  },
];

export function getWorldTheme(id: string): WorldTheme {
  return WORLD_THEMES.find((t) => t.id === id) ?? WORLD_THEMES[0];
}
