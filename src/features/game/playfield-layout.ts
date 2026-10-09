import { getBoardMetrics, spacing } from '@/ui';

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
  classicMascotFlowHeight: 15,
  classicTrayMinHeight: 112,
  classicTrayMaxHeight: 150,
  minVerticalGap: 6,
  maxVerticalGap: 12,
  verticalGapRatio: 0.009,
} as const;

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
  const heightWithoutTray =
    PLAYFIELD_LAYOUT.contentTopPadding +
    PLAYFIELD_LAYOUT.classicHudHeight +
    PLAYFIELD_LAYOUT.classicMascotFlowHeight +
    boardSize +
    verticalGap * 3 +
    adReserve;

  return Math.max(
    PLAYFIELD_LAYOUT.classicTrayMinHeight,
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
  const verticalReserve =
    PLAYFIELD_LAYOUT.contentTopPadding +
    PLAYFIELD_LAYOUT.classicHudHeight +
    PLAYFIELD_LAYOUT.classicMascotFlowHeight +
    PLAYFIELD_LAYOUT.classicTrayMinHeight +
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
    trayHeight: getClassicTrayHeight({
      usableHeight,
      boardSize: boardMetrics.boardSize,
      verticalGap,
      adReserve,
    }),
  };
}
