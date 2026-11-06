import {
  getCandyPlayfieldMetrics,
  getAdventurePlayfieldMetrics,
  getClassicPlayfieldMetrics,
  getClassicTrayHeight,
  getPlayfieldBoardMetrics,
  PLAYFIELD_LAYOUT,
} from '../playfield-layout';

describe('shared playfield layout', () => {
  it.each([
    {
      name: 'API 29 Adventure with measured objective and banner dock',
      screenWidth: 411,
      playfieldHeight: 610,
      objectiveHeight: 68,
      expectedBoardSize: 322,
    },
    {
      name: 'tall Adventure phone',
      screenWidth: 411,
      playfieldHeight: 800,
      objectiveHeight: 60,
      expectedBoardSize: 379,
    },
  ])('uses the measured Adventure area on $name', ({
    screenWidth,
    playfieldHeight,
    objectiveHeight,
    expectedBoardSize,
  }) => {
    const metrics = getAdventurePlayfieldMetrics(
      screenWidth,
      playfieldHeight,
      { top: 0, bottom: 0 },
      objectiveHeight,
    );
    const contentHeight =
      PLAYFIELD_LAYOUT.contentTopPadding +
      PLAYFIELD_LAYOUT.headerHeight +
      objectiveHeight +
      PLAYFIELD_LAYOUT.boardTopGap +
      PLAYFIELD_LAYOUT.boardFrameWidth * 2 +
      metrics.boardSize +
      metrics.trayHeight +
      PLAYFIELD_LAYOUT.sectionGap;

    expect(metrics.boardSize).toBe(expectedBoardSize);
    expect(metrics.trayHeight).toBe(112);
    expect(contentHeight).toBeLessThanOrEqual(metrics.usableHeight);
  });

  it.each([
    {
      name: 'compact Android',
      screenWidth: 360,
      screenHeight: 720,
      insets: { top: 24, bottom: 24 },
      expectedBoardSize: 268,
    },
    {
      name: 'regular Android',
      screenWidth: 360,
      screenHeight: 800,
      insets: { top: 24, bottom: 24 },
      expectedBoardSize: 328,
    },
    {
      name: 'notched phone',
      screenWidth: 390,
      screenHeight: 844,
      insets: { top: 47, bottom: 34 },
      expectedBoardSize: 358,
    },
    {
      name: 'Pixel 8',
      screenWidth: 412,
      screenHeight: 915,
      insets: { top: 43, bottom: 24 },
      expectedBoardSize: 380,
    },
  ])('preserves the Adventure board size on $name', ({
    screenWidth,
    screenHeight,
    insets,
    expectedBoardSize,
  }) => {
    expect(getPlayfieldBoardMetrics(screenWidth, screenHeight, insets).boardSize)
      .toBe(expectedBoardSize);
  });

  it.each([
    {
      screenWidth: 360,
      screenHeight: 720,
      insets: { top: 24, bottom: 24 },
      expectedTrayHeight: 82,
    },
    {
      screenWidth: 360,
      screenHeight: 800,
      insets: { top: 24, bottom: 24 },
      expectedTrayHeight: 112,
    },
    {
      screenWidth: 412,
      screenHeight: 915,
      insets: { top: 43, bottom: 24 },
      expectedTrayHeight: 150,
    },
  ])('fits Classic above the reserved bottom banner', ({
    screenWidth,
    screenHeight,
    insets,
    expectedTrayHeight,
  }) => {
    const verticalGap = Math.max(
      PLAYFIELD_LAYOUT.minVerticalGap,
      Math.min(
        PLAYFIELD_LAYOUT.maxVerticalGap,
        Math.round(screenHeight * PLAYFIELD_LAYOUT.verticalGapRatio),
      ),
    );
    const metrics = getClassicPlayfieldMetrics(screenWidth, screenHeight, insets, verticalGap, true);
    const trayHeight = getClassicTrayHeight({
      usableHeight: metrics.usableHeight,
      boardSize: metrics.boardSize,
      verticalGap,
    });
    const contentHeight =
      PLAYFIELD_LAYOUT.contentTopPadding +
      metrics.hudHeight +
      metrics.mascotHeight +
      metrics.boardSize +
      trayHeight +
      verticalGap * 3;

    expect(trayHeight).toBe(expectedTrayHeight);
    expect(contentHeight + PLAYFIELD_LAYOUT.adReserve)
      .toBeLessThanOrEqual(metrics.usableHeight);
  });

  it.each([
    {
      name: 'compact Android',
      screenWidth: 360,
      screenHeight: 720,
      insets: { top: 24, bottom: 24 },
      expectedBoardSize: 328,
      expectedTrayHeight: 140,
    },
    {
      name: 'API 29 emulator',
      screenWidth: 411,
      screenHeight: 621,
      insets: { top: 0, bottom: 0 },
      expectedBoardSize: 379,
      expectedTrayHeight: 88,
    },
    {
      name: 'API 29 emulator with a 50 dp banner dock',
      screenWidth: 411,
      screenHeight: 571,
      insets: { top: 0, bottom: 0 },
      expectedBoardSize: 337,
      expectedTrayHeight: 80,
    },
  ])('uses the measured Classic height on $name', ({
    screenWidth,
    screenHeight,
    insets,
    expectedBoardSize,
    expectedTrayHeight,
  }) => {
    const verticalGap = Math.max(
      PLAYFIELD_LAYOUT.minVerticalGap,
      Math.min(
        PLAYFIELD_LAYOUT.maxVerticalGap,
        Math.round(screenHeight * PLAYFIELD_LAYOUT.verticalGapRatio),
      ),
    );
    const metrics = getClassicPlayfieldMetrics(
      screenWidth,
      screenHeight,
      insets,
      verticalGap,
      false,
    );

    expect(metrics.boardSize).toBe(expectedBoardSize);
    expect(metrics.trayHeight).toBe(expectedTrayHeight);
  });

  it('keeps a usable Classic tray in the measured height after a banner docks', () => {
    const screenWidth = 411;
    const screenHeight = 621;
    const insets = { top: 0, bottom: 0 };
    const verticalGap = 6;
    const metrics = getClassicPlayfieldMetrics(
      screenWidth,
      screenHeight,
      insets,
      verticalGap,
      false,
    );
    const contentHeight =
      PLAYFIELD_LAYOUT.contentTopPadding +
      metrics.hudHeight +
      metrics.mascotHeight +
      metrics.boardSize +
      metrics.trayHeight +
      verticalGap * 3;

    expect(metrics.boardSize).toBe(379);
    expect(metrics.trayHeight).toBe(88);
    expect(contentHeight).toBeLessThanOrEqual(metrics.usableHeight);
  });

  it('uses the actual compact height instead of inventing vertical space', () => {
    const metrics = getPlayfieldBoardMetrics(
      720,
      360,
      { top: 24, bottom: 24 },
    );

    expect(metrics.usableHeight).toBe(312);
    expect(metrics.boardSize).toBeGreaterThan(0);
    expect(metrics.boardSize).toBeLessThan(PLAYFIELD_LAYOUT.minBoardSize);
    expect(metrics.cellSize).toBeGreaterThan(0);
  });
});

// A compact Android must retain every interactive row without clipping the tray.
it('fits the candy board, helpers and tray on a short portrait screen', () => {
  const m = getCandyPlayfieldMetrics(320, 568, { top: 24, bottom: 24 });
  const occupied = 8 + m.hudHeight + m.boardTopGap + m.frameSize + 17 + m.helperHeight + 14 + m.trayHeight;
  expect(m.frameSize).toBeLessThanOrEqual(320 - 32);
  expect(occupied).toBeLessThanOrEqual(m.usableHeight);
  expect(m.cellSize).toBeGreaterThanOrEqual(24);
});
