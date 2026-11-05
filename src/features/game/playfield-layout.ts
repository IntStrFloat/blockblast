import { getBoardMetrics, spacing } from '@/ui/theme';
import { GAME_FEEL_MOTION } from './animation/motion';

export interface PlayfieldInsets {
  top: number;
  bottom: number;
}

export const PLAYFIELD_LAYOUT = {
  minUsableHeight: 560,
  minBoardSize: 240,
  absoluteMinBoardSize: 96,
  contentTopPadding: spacing.s,
  headerHeight: 56,
  objectiveMaxHeight: 76,
  boardTopGap: spacing.l,
  boardFrameWidth: 6,
  adventureTrayHeight: 112,
  sectionGap: spacing.s,
  adReserve: 108,
  classicHudHeight: 108,
  classicMascotVisualHeight: 70,
  classicCompactHudHeight: 80,
  classicCompactMascotHeight: 48,
  classicCompactTrayMinHeight: 80,
  classicTrayMinHeight: 112,
  classicTrayMaxHeight: 150,
  minVerticalGap: 6,
  maxVerticalGap: 12,
  verticalGapRatio: 0.009,
} as const;

export function getClassicHudMetrics(width: number, compact = false) {
  const padding = 12;
  const gap = 6;
  const sideWidth = Math.max(48, Math.min(88, Math.floor(width * 0.23)));
  const centerWidth = Math.max(1, width - padding * 2 - gap * 2 - sideWidth * 2);
  const height = compact ? PLAYFIELD_LAYOUT.classicCompactHudHeight : PLAYFIELD_LAYOUT.classicHudHeight;
  const statusHeight = 28;
  return {
    padding, gap, sideWidth, centerWidth, height, statusHeight,
    scoreShellHeight: height - statusHeight,
    scoreWidth: Math.floor(centerWidth / GAME_FEEL_MOTION.scoreScaleMax),
    scoreHeight: Math.floor((height - statusHeight) / GAME_FEEL_MOTION.scoreScaleMax),
    statusWidth: Math.floor(centerWidth / 1.12),
    fontSize: compact ? 34 : 40,
    lineHeight: compact ? 40 : 46,
  };
}

/** Numeric gauges keep their full value and fit even at the pulse's peak. */
export function hudNumberFontSize(value: number | string, width: number, maximum: number) {
  return Math.max(8, Math.min(maximum, Math.floor(width / String(value).length)));
}

const bestCompactFormatters = new Map<'ru' | 'en', Intl.NumberFormat>();

/** Keep the smaller best-score gauge legible; its accessibility label stays exact. */
export function formatHudBestScore(value: number, locale: 'ru' | 'en') {
  if (value < 1_000_000) return String(value);
  let formatter = bestCompactFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 0, useGrouping: false });
    bestCompactFormatters.set(locale, formatter);
  }
  return formatter.format(value).replace(/\s/gu, '');
}

function classicSections(usableHeight: number, adReserve: number) {
  const compactHeader = usableHeight - adReserve < 640;
  return {
    compactHeader,
    hudHeight: compactHeader ? PLAYFIELD_LAYOUT.classicCompactHudHeight : PLAYFIELD_LAYOUT.classicHudHeight,
    mascotHeight: compactHeader ? PLAYFIELD_LAYOUT.classicCompactMascotHeight : PLAYFIELD_LAYOUT.classicMascotVisualHeight,
    minTrayHeight: compactHeader ? PLAYFIELD_LAYOUT.classicCompactTrayMinHeight : PLAYFIELD_LAYOUT.classicTrayMinHeight,
  };
}

export function getPlayfieldBoardMetrics(
  screenWidth: number,
  screenHeight: number,
  insets: PlayfieldInsets,
) {
  const usableHeight = Math.max(0, screenHeight - insets.top - insets.bottom);
  const verticalReserve =
    PLAYFIELD_LAYOUT.sectionGap +
    PLAYFIELD_LAYOUT.headerHeight +
    PLAYFIELD_LAYOUT.objectiveMaxHeight +
    PLAYFIELD_LAYOUT.boardTopGap +
    PLAYFIELD_LAYOUT.boardFrameWidth * 2 +
    PLAYFIELD_LAYOUT.adventureTrayHeight +
    PLAYFIELD_LAYOUT.sectionGap +
    PLAYFIELD_LAYOUT.adReserve;
  const minimumBoardSize =
    usableHeight >= PLAYFIELD_LAYOUT.minUsableHeight
      ? PLAYFIELD_LAYOUT.minBoardSize
      : PLAYFIELD_LAYOUT.absoluteMinBoardSize;
  const maxBoardSize = Math.max(
    minimumBoardSize,
    usableHeight - verticalReserve,
  );

  return {
    ...getBoardMetrics(screenWidth, maxBoardSize),
    usableHeight,
  };
}

export function getAdventurePlayfieldMetrics(
  screenWidth: number,
  playfieldHeight: number,
  insets: PlayfieldInsets,
  objectiveHeight: number = PLAYFIELD_LAYOUT.objectiveMaxHeight,
) {
  const usableHeight = Math.max(0, playfieldHeight - insets.top - insets.bottom);
  const verticalReserve =
    PLAYFIELD_LAYOUT.contentTopPadding +
    PLAYFIELD_LAYOUT.headerHeight +
    objectiveHeight +
    PLAYFIELD_LAYOUT.boardTopGap +
    PLAYFIELD_LAYOUT.boardFrameWidth * 2 +
    PLAYFIELD_LAYOUT.adventureTrayHeight +
    PLAYFIELD_LAYOUT.sectionGap;
  const maxBoardSize = Math.max(
    PLAYFIELD_LAYOUT.absoluteMinBoardSize,
    usableHeight - verticalReserve,
  );

  return {
    ...getBoardMetrics(screenWidth, maxBoardSize),
    usableHeight,
    trayHeight: PLAYFIELD_LAYOUT.adventureTrayHeight,
  };
}

export function getClassicTrayHeight({
  usableHeight,
  boardSize,
  verticalGap,
  adReserve = PLAYFIELD_LAYOUT.adReserve,
}: {
  usableHeight: number;
  boardSize: number;
  verticalGap: number;
  adReserve?: number;
}): number {
  const sections = classicSections(usableHeight, adReserve);
  const heightWithoutTray =
    PLAYFIELD_LAYOUT.contentTopPadding +
    sections.hudHeight +
    sections.mascotHeight +
    boardSize +
    verticalGap * 3 +
    adReserve;

  return Math.max(
    sections.minTrayHeight,
    Math.min(
      PLAYFIELD_LAYOUT.classicTrayMaxHeight,
      Math.floor(usableHeight - heightWithoutTray),
    ),
  );
}

export function getClassicPlayfieldMetrics(
  screenWidth: number,
  screenHeight: number,
  insets: PlayfieldInsets,
  verticalGap: number,
  reserveBanner: boolean,
) {
  const usableHeight = Math.max(0, screenHeight - insets.top - insets.bottom);
  const adReserve = reserveBanner ? PLAYFIELD_LAYOUT.adReserve : 0;
  const sections = classicSections(usableHeight, adReserve);
  const verticalReserve =
    PLAYFIELD_LAYOUT.contentTopPadding +
    sections.hudHeight +
    sections.mascotHeight +
    sections.minTrayHeight +
    verticalGap * 3 +
    adReserve;
  const maxBoardSize = Math.max(
    PLAYFIELD_LAYOUT.absoluteMinBoardSize,
    usableHeight - verticalReserve,
  );
  const boardMetrics = getBoardMetrics(screenWidth, maxBoardSize);

  return {
    ...boardMetrics,
    usableHeight,
    ...sections,
    trayHeight: getClassicTrayHeight({
      usableHeight,
      boardSize: boardMetrics.boardSize,
      verticalGap,
      adReserve,
    }),
  };
}
