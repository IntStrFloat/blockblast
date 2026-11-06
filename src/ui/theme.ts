/** Дизайн-токены (спека 04). Цвета — только отсюда. */

import { nightCandy as n } from './nightCandy';

export const colors = {
  bgTop: '#2A37B0', bgBottom: n.night900, boardBg: n.night850,
  cellEmpty: n.cell, boardLine: n.night700,
  textPrimary: n.white, textDim: n.lavender, accent: n.sun,
  danger: n.coral, overlayScrim: 'rgba(5,7,31,0.70)',
  surface: 'rgba(255,255,255,0.08)', surfacePressed: 'rgba(255,255,255,0.16)',
  cardGlass: 'rgba(20,26,92,0.72)', hairline: n.border,
  cardSolid: n.night850, cardRaised: n.night800, clayShadow: '#03051E',
  track: '#0B0F42', success: n.mint,
} as const;

/** Семантические роли luminous-clay системы. Экраны должны выбирать роль,
 * а не повторять raw-цвета: так активная цель, награда и риск остаются
 * различимыми во всех режимах. */
export const semanticColors = {
  background: { base: colors.bgBottom, elevated: colors.bgTop, game: colors.boardBg },
  surface: { low: colors.surface, default: colors.cardSolid, high: colors.cardRaised, reward: '#4A3B1A' },
  text: { primary: colors.textPrimary, secondary: colors.textDim, inverse: '#10203F', reward: '#FFE08A' },
  action: { primary: colors.accent, secondary: colors.cardRaised, danger: colors.danger },
  state: { success: colors.success, warning: colors.accent, error: colors.danger, info: '#7EE7FF' },
  mode: { classic: '#4B7BFF', daily: '#FFD23F', adventure: '#B36BFF', league: '#36D7B7' },
  motion: { fast: 140, base: 220, celebration: 380 },
  elevation: { none: 0, low: 3, medium: 6, high: 10 },
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

/** Explicit glyph-safe typography roles. System text deliberately omits fontFamily. */
export const fontFamilies = {
  display: 'Unbounded_800ExtraBold',
  score: 'Unbounded_800ExtraBold',
} as const;

export const typography = {
  title: { fontFamily: fontFamilies.display, fontSize: 24, lineHeight: 30 },
  score: { fontFamily: fontFamilies.score, fontSize: 40, lineHeight: 46 },
  body: { fontFamily: 'Nunito_700Bold', fontSize: 16, lineHeight: 22 },
  caption: { fontFamily: 'Nunito_700Bold', fontSize: 14, lineHeight: 20 },
  button: { fontFamily: 'Unbounded_700Bold', fontSize: 16, lineHeight: 22 },
  speech: { fontFamily: 'Nunito_800ExtraBold', fontSize: 16, lineHeight: 22 },
} as const;

export const radii = {
  cell: 8,
  card: 24,
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
  // Пузырь речи Капи: тёплая кремовая подложка + чернила (ink) дают контраст ≥4.5:1.
  speechBg: '#FFF7EE',
  speechBorder: '#F4D7B0',
  speechInk: '#2A1E2B',
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
export function getBoardMetrics(screenWidth: number, maxBoardSize = Number.POSITIVE_INFINITY): {
  boardSize: number;
  cellSize: number;
  cellGap: number;
} {
  const boardSize = Math.min(screenWidth - spacing.m * 2, maxBoardSize);
  const cellGap = 2;
  const cellSize = (boardSize - cellGap * 7) / 8;
  return { boardSize, cellSize, cellGap };
}
