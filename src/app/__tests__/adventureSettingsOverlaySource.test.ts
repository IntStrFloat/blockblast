declare const __dirname: string;

const fs = jest.requireActual<{ readFileSync(path: string, encoding: string): string }>('fs');
const source = fs.readFileSync(`${__dirname}/../adventure-level.tsx`, 'utf8');

describe('Adventure in-game settings source contract', () => {
  it('keeps only the shared in-game settings control in the header', () => {
    expect(source).toContain("import { PauseOverlay } from '@/features/game/components/PauseOverlay';");
    expect(source).toContain("onPress={() => setPaused(true)}");
    expect(source).not.toContain('<ChevronIcon');
    expect(source).not.toContain("router.push('/settings'");
  });

  it('reuses Classic game controls with Adventure-specific Home and Restart actions', () => {
    expect(source).toContain('<PauseOverlay');
    expect(source).toContain('onHome={exitToHub}');
    expect(source).toContain('onRestart={confirmRestart}');
    expect(source).toContain('<ConfirmDialog');
    expect(source).toContain('onConfirm={restartCurrentLevel}');
  });
});
