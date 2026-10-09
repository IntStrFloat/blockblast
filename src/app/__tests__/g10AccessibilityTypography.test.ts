declare const __dirname: string;

const fs = jest.requireActual<{ readFileSync(path: string, encoding: string): string }>('fs');
const read = (path: string) => fs.readFileSync(`${__dirname}/${path}`, 'utf8');

function luminance(hex: string): number {
  const values = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const [r, g, b] = values.map((value) =>
    value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4),
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe('G10 typography and accessibility contract', () => {
  it('uses explicit Cyrillic-safe AppText roles without Fredoka fallback', () => {
    const appText = read('../../ui/AppText.tsx');
    const theme = read('../../ui/theme.ts');
    expect(theme).toContain('export const fontFamilies');
    expect(theme).toContain("display: 'Unbounded_700Bold'");
    expect(theme).toContain("speech: { fontSize: 15");
    expect(appText).not.toContain('Fredoka');
  });

  it('keeps functional Home and Adventure CTAs non-italic and responsive', () => {
    const home = read('../index.tsx');
    const adventure = read('../adventure.tsx');
    const adventureLevel = read('../adventure-level.tsx');
    const result = read('../../features/adventure/components/LevelResultView.tsx');
    expect(home).toContain('numberOfLines={2}');
    expect(home).toContain("maxWidth: 330");
    expect(home).toContain('goalAnchor');
    expect(home.slice(home.indexOf('menuButtonLabel:'), home.indexOf('seasonRibbon:')))
      .not.toContain("fontStyle: 'italic'");
    expect(adventure.slice(adventure.indexOf('playButtonLabel:'), adventure.indexOf('playButtonLabelCompact:')))
      .not.toContain("fontStyle: 'italic'");
    expect(adventureLevel).toContain('adjustsFontSizeToFit');
    expect(adventureLevel).toContain('minimumFontScale={0.55}');
    expect(result).toContain('<ScrollView');
    expect(result).toContain('<MosaicView');
    expect(result).toContain('<RewardProgressSummary earnedXp={earnedXp} lifetimePoints={lifetimePoints} light />');
    expect(result).toContain("label={t('adventure.nextLevel', lang)}");
    expect(result).toContain('onPress={onNext}');
    expect(result).not.toContain("t('adventure.seasonHint', lang)");
  });

  it('gives buttons and switches explicit semantics and 48dp targets', () => {
    const button = read('../../ui/primitives/GameButton.tsx');
    const settings = read('../settings.tsx');
    const pause = read('../../features/game/components/PauseOverlay.tsx');
    expect(button).toContain('accessibilityRole="button"');
    expect(button).toContain('accessibilityState={{ disabled }}');
    expect(button).toContain('minHeight: 48');
    expect(settings.match(/accessibilityRole="switch"/g)).toHaveLength(4);
    expect(settings).toContain('accessibilityState={{ checked: settings.sound }}');
    expect(pause).toContain('accessibilityState={{ checked: value }}');
  });

  it('localizes /capy and Back labels in both languages', () => {
    const capy = read('../capy.tsx');
    const ru = read('../../core/i18n/ru.ts');
    const en = read('../../core/i18n/en.ts');
    expect(capy).toContain("t('capy.title', lang)");
    expect(capy).toContain("backLabel={t('leaderboard.back', lang)}");
    expect(ru).toContain("wardrobe: 'Открыть гардероб'");
    expect(en).toContain("wardrobe: 'Open wardrobe'");
  });

  it('meets 4.5:1 for ordinary semantic and functional text pairs', () => {
    expect(contrast('#B7C9EA', '#243B6E')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#173C4D', '#EF8B0D')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#173C4D', '#82C958')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#FFFFFF', '#9E1F19')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#FFFFFF', '#137A22')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#062842', '#1998DC')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#062842', '#1B96E3')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#EAF4FF', '#123B85')).toBeGreaterThanOrEqual(4.5);
  });

  it('centers or restores the current Adventure level while cells remain noninteractive', () => {
    const adventure = read('../adventure.tsx');
    expect(adventure).toContain('scrollToCurrentOrSaved');
    expect(adventure).toContain('KEYS.adventureMapScroll');
    expect(adventure).toContain('onMomentumScrollEnd={persistMapOffset}');
    expect(adventure).toContain('pointerEvents="none"');
    expect(adventure).not.toContain('mapCellButton');
  });

  it('marks major overlays as modal so accessibility focus cannot escape', () => {
    for (const path of [
      '../../features/game/components/PauseOverlay.tsx',
      '../../features/profile/components/ProfileOverlay.tsx',
      '../../features/mascot/components/Wardrobe.tsx',
      '../../ui/primitives/Overlay.tsx',
    ]) {
      const source = read(path);
      expect(source).toContain('accessibilityViewIsModal');
      expect(source).toContain('importantForAccessibility="yes"');
    }
    expect(read('../game.tsx')).toContain("importantForAccessibility={paused ? 'no-hide-descendants' : 'auto'}");
    expect(read('../adventure-level.tsx')).toContain("importantForAccessibility={overlayBlocksPlayfield ? 'no-hide-descendants' : 'auto'}");
  });
});
