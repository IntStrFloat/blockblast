/** Дизайн-токены (спека 04). Цвета — только отсюда. */

export const colors = {
  bgTop: '#1B2A4A',
  bgBottom: '#0F1B33',
  boardBg: '#142142',
  cellEmpty: '#1E2F55',
  boardLine: '#0E1830',
  textPrimary: '#FFFFFF',
  textDim: '#8FA3C8',
  accent: '#FFC93C',
  danger: '#FF5A5F',
  overlayScrim: 'rgba(8,14,28,0.72)',
  surface: 'rgba(255,255,255,0.08)',
  surfacePressed: 'rgba(255,255,255,0.16)',
  cardGlass: 'rgba(22,36,68,0.5)',
  hairline: 'rgba(255,255,255,0.12)',
} as const;

export interface BlockTheme {
  id: string;
  /** i18n-ключ названия */
  nameKey: string;
  /** Цвета блоков по colorId (индекс colorId - 1) */
  cellColors: string[];
  bgTop: string;
  bgBottom: string;
  boardBg: string;
  cellEmpty: string;
}

export const BLOCK_THEMES: BlockTheme[] = [
  {
    id: 'classic',
    nameKey: 'settings.themeClassic',
    cellColors: ['#FF4D6D', '#FF9F1C', '#FFD23F', '#3DDC84', '#3FA7FF', '#B36BFF'],
    bgTop: colors.bgTop,
    bgBottom: colors.bgBottom,
    boardBg: colors.boardBg,
    cellEmpty: colors.cellEmpty,
  },
  {
    id: 'y2k',
    nameKey: 'settings.themeY2k',
    cellColors: ['#F2A6D8', '#FFE39B', '#9BE8E0', '#B9B4F2', '#A7C8FF', '#C9D6E8'],
    bgTop: '#1A1A26',
    bgBottom: '#101018',
    boardBg: '#181826',
    cellEmpty: '#232336',
  },
];

export function getBlockTheme(id: string): BlockTheme {
  return BLOCK_THEMES.find((t) => t.id === id) ?? BLOCK_THEMES[0];
}

export const spacing = {
  xs: 4,
  s: 8,
  m: 16,
  l: 24,
  xl: 32,
} as const;

export const radii = {
  cell: 4,
  card: 20,
  button: 16,
} as const;

export const mascotPalette = {
  body0: '#F0C08A',
  body1: '#C98650',
  furLight: '#FFD4A0',
  furMid: '#C98650',
  furShadow: '#7A4B31',
  innerEar: '#F29CA8',
  muzzle: '#F7D8B4',
  blush: '#F28CA8',
  ink: '#2A1E2B',
  eyeSpark: '#FFFFFF',
  block: '#FFD23F',
  crown1: '#FF9F1C',
  crown2: '#3DDC84',
  blockTint: 'rgba(255,210,63,0.12)',
  hatBlue: '#4B7BFF',
  hatDeep: '#1E2E66',
  hatOrange: '#FF9F1C',
  hatPurple: '#8E66FF',
  glasses: '#171C2F',
  lens: '#7EE7FF',
  scarf: '#FF5A7A',
  cape: '#7B4DFF',
  accessoryTeal: '#36D7B7',
  metal: '#BFD5E8',
  chrome: '#DDE8F6',
  obsidian: '#20243A',
  skinMint0: '#A7F3D0',
  skinMint1: '#34D399',
  skinCoral0: '#FDBA9A',
  skinCoral1: '#F97372',
  auraBlue: '#7EE7FF',
  auraPink: '#F2A6D8',
  auraGold: '#FFD23F',
  auraFire: '#FF5A3D',
} as const;

/** Геометрия доски от ширины экрана (спека 04). */
export function getBoardMetrics(screenWidth: number): {
  boardSize: number;
  cellSize: number;
  cellGap: number;
} {
  const boardSize = screenWidth - spacing.m * 2;
  const cellGap = 2;
  const cellSize = (boardSize - cellGap * 7) / 8;
  return { boardSize, cellSize, cellGap };
}
