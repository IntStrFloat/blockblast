import { PLAYFIELD_LAYOUT } from '@/features/game';

declare const __dirname: string;

const fs = jest.requireActual<{ readFileSync(path: string, encoding: string): string }>('fs');
const read = (path: string) => fs.readFileSync(`${__dirname}/${path}`, 'utf8');

describe('G13 helper controls decoupling', () => {
  const controls = read('../components/HelperControls.tsx');
  const mascot = read('../components/MascotLayer.tsx');
  const game = read('../../../app/game.tsx');
  const adventure = read('../../../app/adventure-level.tsx');
  const hint = read('../components/HelperHint.tsx');
  const swap = read('../components/HelperSwap.tsx');

  it('mounts functional helpers in the stable Classic control layer only', () => {
    expect(game).toContain('<HelperControls active={!ftueActive} />');
    expect(adventure).not.toContain('HelperControls');
    expect(controls).toContain('<HelperHint');
    expect(controls).toContain('<HelperSwap');
    expect(controls).not.toContain('showMascot');
    expect(controls).not.toContain('useMascot(');
    expect(controls).not.toContain('useSettings(');
    expect(mascot).not.toContain("from './HelperHint'");
    expect(mascot).not.toContain("from './HelperSwap'");
  });

  it('returns the fallen mascot in the same run and retains epoch recovery', () => {
    expect(mascot).toContain('}, 1_400);');
    expect(mascot).toContain('useMascot.getState().recover()');
    expect(mascot).toContain('const epoch = useGameStore((s) => s.epoch)');
  });

  it('shows charge balance, use result, and funnel events independently of mascot art', () => {
    for (const source of [hint, swap]) {
      expect(source).toContain("t('mascot.charges', lang)");
      expect(source).toContain("t('mascot.helperUsed', lang)");
      expect(source).toContain("'helper_funnel'");
      expect(source).toContain("stage: 'used'");
    }
    expect(hint).toContain('if (pressLockRef.current) return;');
    expect(swap).toContain('if (pendingRef.current) return;');
    expect(swap).toContain("outcome === 'commit'");
    expect(swap).toContain('commitPendingSwap(true)');
    expect(controls).toContain("flexDirection: 'row'");
    expect(controls).toContain('minHeight: 44');
  });

  it('fits one horizontal 44dp helper row above the Classic board at 360x640', () => {
    const helperBottomRelativeToBoard =
      PLAYFIELD_LAYOUT.classicMascotFlowHeight -
      PLAYFIELD_LAYOUT.classicMascotVisualHeight +
      44;
    expect(helperBottomRelativeToBoard).toBeLessThanOrEqual(0);
  });
});
