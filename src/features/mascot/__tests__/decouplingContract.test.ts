declare const __dirname: string;

const fs = jest.requireActual<{
  readFileSync(path: string, encoding: string): string;
}>('fs');

const read = (relativePath: string) => fs.readFileSync(`${__dirname}/${relativePath}`, 'utf8');

// Спека 15: Капи — спутник-витрина. Свою XP/уровень/кормление он не держит;
// стадия/уровень/reveal приходят из Уровня Игры (progression).
describe('Capi decoupling contract', () => {
  const store = read('../store.ts');
  const chip = read('../components/MascotChip.tsx');
  const layer = read('../components/MascotLayer.tsx');
  const reveal = read('../components/LevelUpReveal.tsx');

  it('mascot store no longer owns XP / level / feeding', () => {
    expect(store).not.toContain('totalXp');
    expect(store).not.toContain('applyScore');
    expect(store).not.toContain('lastFedDay');
    expect(store).not.toContain('feed');
  });

  it('the level chip and layer derive from the Game Level (progression)', () => {
    expect(chip).toContain('useProgression');
    expect(layer).toContain('stageForLevel');
    expect(layer).toContain('useProgression((s) => s.level)');
  });

  it('the level-up reveal is owned by progression, not the mascot store', () => {
    expect(reveal).toContain('useProgression((s) => s.reveal)');
    // Reveal больше не читает стор маскота (useMascotFeedback для звука/хаптики допустим).
    expect(reveal).not.toContain("from '../store'");
  });
});
