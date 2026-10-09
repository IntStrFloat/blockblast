import type { AdventureSeasonWindow } from '@/features/leaderboard/types';

import { ADVENTURE_CONFIG } from './config';

/**
 * Скины игровой зоны испытания. Календарный сезон меняет только оформление;
 * до первой синхронизации используем скин по сквозному номеру уровня.
 * Дизайн: фон + доска + рамка + цвет блока. Палитры тёплые/уютные в духе испытания;
 * цвет блока всегда насыщённый (не золото/белый), чтобы кристаллы оставались
 * читаемыми поверх него. Список циклится, когда уровни кончаются.
 */
export interface AdventureSkin {
  /** i18n-независимая метка для отладки/аналитики. */
  id: string;
  bgTop: string;
  bgBottom: string;
  boardBg: string;
  boardFrame: string;
  boardShadow: string;
  cellEmpty: string;
  /** Единый цвет блоков этого скина. */
  blockColor: string;
  /** Палитра компактного прогресс-бара цели для этого мира. */
  progressGradient: readonly [string, string, string, string];
  progressTrack: string;
  progressBadge: string;
  progressBorder: string;
  progressBadgeText: string;
}

export const ADVENTURE_SKINS: AdventureSkin[] = [
  // 0 — Луг капибары (исходная тема испытания, уровни 1–10).
  {
    id: 'meadow',
    bgTop: '#A76E48',
    bgBottom: '#875235',
    boardBg: '#6A3F29',
    boardFrame: '#835131',
    boardShadow: '#4A2A18',
    cellEmpty: '#563522',
    blockColor: '#4DB96A',
    progressGradient: ['#F4A8F9', '#8DEB85', '#FFE360', '#FFAB6B'],
    progressTrack: '#5B382C',
    progressBadge: '#F3A4CD',
    progressBorder: '#623B65',
    progressBadgeText: '#FFF8FF',
  },
  // 1 — Ягодная роща.
  {
    id: 'berry',
    bgTop: '#A76A86',
    bgBottom: '#834F68',
    boardBg: '#5E3A4E',
    boardFrame: '#774A61',
    boardShadow: '#3C2333',
    cellEmpty: '#4E3141',
    blockColor: '#FF5D7A',
    progressGradient: ['#FFC1E6', '#FF83B1', '#FF77C1', '#FBA7DF'],
    progressTrack: '#4A2D42',
    progressBadge: '#FF96C5',
    progressBorder: '#6B3155',
    progressBadgeText: '#FFFFFF',
  },
  // 2 — Тихая бухта.
  {
    id: 'cove',
    bgTop: '#4F978F',
    bgBottom: '#377872',
    boardBg: '#2C5B56',
    boardFrame: '#3A716A',
    boardShadow: '#163C38',
    cellEmpty: '#244C48',
    blockColor: '#5FE3D2',
    progressGradient: ['#A6DFFF', '#71F3DA', '#9DEB9B', '#72C7FC'],
    progressTrack: '#1F504B',
    progressBadge: '#8BDCF4',
    progressBorder: '#215B67',
    progressBadgeText: '#FFFFFF',
  },
  // 3 — Медовые дюны.
  {
    id: 'dunes',
    bgTop: '#C89A5A',
    bgBottom: '#A6783E',
    boardBg: '#7C5A2C',
    boardFrame: '#987134',
    boardShadow: '#543A16',
    cellEmpty: '#684C22',
    blockColor: '#FF7A52',
    progressGradient: ['#FFE7A1', '#FFC45A', '#FF8F5A', '#FFB26A'],
    progressTrack: '#66471A',
    progressBadge: '#FFC06D',
    progressBorder: '#794218',
    progressBadgeText: '#50320F',
  },
  // 4 — Лавандовый сад.
  {
    id: 'lavender',
    bgTop: '#8B78AE',
    bgBottom: '#6B5A90',
    boardBg: '#4B3D6A',
    boardFrame: '#61517C',
    boardShadow: '#2F2344',
    cellEmpty: '#41345C',
    blockColor: '#C79BFF',
    progressGradient: ['#F2B5FF', '#C59CFF', '#9DB8FF', '#F6A9E9'],
    progressTrack: '#36284F',
    progressBadge: '#E0A8FA',
    progressBorder: '#51366C',
    progressBadgeText: '#FFFFFF',
  },
  // 5 — Сосновый бор.
  {
    id: 'forest',
    bgTop: '#6E9A56',
    bgBottom: '#517A3F',
    boardBg: '#37542C',
    boardFrame: '#476A38',
    boardShadow: '#22391A',
    cellEmpty: '#2F4A25',
    blockColor: '#9BE86A',
    progressGradient: ['#B8F48E', '#79DB72', '#FFE27B', '#BFEF89'],
    progressTrack: '#294221',
    progressBadge: '#A9E77D',
    progressBorder: '#375F30',
    progressBadgeText: '#24401A',
  },
  // 6 — Закатная глина.
  {
    id: 'clay',
    bgTop: '#C87A64',
    bgBottom: '#A65A48',
    boardBg: '#7E3E30',
    boardFrame: '#9A4E3D',
    boardShadow: '#572319',
    cellEmpty: '#6A3327',
    blockColor: '#FF6FA8',
    progressGradient: ['#FFB5CF', '#FF81A8', '#FF9C6A', '#FFC280'],
    progressTrack: '#5A2A22',
    progressBadge: '#FF9CBF',
    progressBorder: '#783548',
    progressBadgeText: '#FFFFFF',
  },
  // 7 — Тёплые сумерки.
  {
    id: 'dusk',
    bgTop: '#6E77B0',
    bgBottom: '#545C90',
    boardBg: '#3A4070',
    boardFrame: '#4A5185',
    boardShadow: '#232748',
    cellEmpty: '#313763',
    blockColor: '#7FB0FF',
    progressGradient: ['#B7C9FF', '#7EB7FF', '#90E7E0', '#E0ACFF'],
    progressTrack: '#2A2E57',
    progressBadge: '#A8B9FF',
    progressBorder: '#4C5088',
    progressBadgeText: '#FFFFFF',
  },
];

/** Индекс скина по сквозному (1-based) номеру уровня, циклично. */
export function adventureSkinIndex(absoluteLevel: number): number {
  const block = Math.floor(Math.max(0, absoluteLevel - 1) / ADVENTURE_CONFIG.skinEveryLevels);
  return ((block % ADVENTURE_SKINS.length) + ADVENTURE_SKINS.length) % ADVENTURE_SKINS.length;
}

/** Calendar setting, with the existing level palette as the unsynced fallback. */
export function adventureSkinFor(
  absoluteLevel: number,
  seasonWindow: Pick<AdventureSeasonWindow, 'seasonId'> | null = null,
): AdventureSkin {
  const index = seasonWindow
    ? (Math.max(1, seasonWindow.seasonId) - 1) % ADVENTURE_SKINS.length
    : adventureSkinIndex(absoluteLevel);
  return ADVENTURE_SKINS[index];
}
