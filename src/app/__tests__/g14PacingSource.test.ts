declare const __dirname: string;

const fs = jest.requireActual<{ readFileSync(path: string, encoding: string): string }>('fs');
const read = (path: string) => fs.readFileSync(`${__dirname}/${path}`, 'utf8');

describe('G14 pacing contract', () => {
  it('keeps the committed next tray interactive while clear effects finish', () => {
    const delayedTray = read('../../features/game/animation/useDelayedTray.ts');
    expect(delayedTray).toContain('return 0;');
    expect(delayedTray).toContain('return committedTrayFor(tray);');
    expect(delayedTray).not.toContain('EMPTY_TRAY');
    expect(delayedTray).not.toContain('setTimeout');
  });

  it('uses one bounded Adventure outcome lifecycle with a reduced path and explicit skip', () => {
    const screen = read('../adventure-level.tsx');
    const timing = read('../../features/game/animation/effectSequence.ts');
    expect(screen).toContain('EFFECT_SEQUENCE_TIMING.adventureOutcomeReadyMs');
    expect(screen).toContain('EFFECT_SEQUENCE_TIMING.adventureOutcomeReducedMs');
    expect(screen).toContain('EFFECT_SEQUENCE_TIMING.adventureOutcomeFallbackMs');
    expect(screen).toContain("t('adventure.showResult', lang)");
    expect(screen).toContain('resultAcceleratedRef.current = true');
    expect(timing).toContain('adventureOutcomeReadyMs: 520');
    expect(timing).toContain('adventureOutcomeReducedMs: 120');
  });

  it('records input readiness, result readiness, and conflicting presentation budgets', () => {
    const game = read('../game.tsx');
    const trayPiece = read('../../features/game/components/TrayPiece.tsx');
    expect(game).toContain("track('turn_input_ready'");
    expect(game).toContain("readiness_source: 'native_layout'");
    expect(game).toContain('onInteractiveReady={handleTrayInteractiveReady}');
    expect(game).toContain("game.status === 'playing' && !event.gameOver");
    expect(read('../adventure-level.tsx')).toContain("adventure?.status === 'playing'");
    expect(game).toContain('pendingTrayReadyRef.current = null');
    expect(trayPiece).toContain('measureInWindow');
    expect(trayPiece).toContain('onInteractiveReady(trayIndex, readyToken)');
    expect(read('../adventure-level.tsx')).toContain("'adventure_result_ready'");
    expect(read('../../features/game/components/BoardView.tsx')).toContain("'effect_conflict'");
  });
});
