declare const __dirname: string;

const fs = jest.requireActual<{ readFileSync(path: string, encoding: string): string }>('fs');
const read = (relativePath: string) => fs.readFileSync(`${__dirname}/${relativePath}`, 'utf8');

describe('action-driven tutorial UI', () => {
  const hints = read('../../game/components/TutorialHints.tsx');
  const pointer = read('../components/TutorialPointer.tsx');
  const game = read('../../../app/game.tsx');
  const gameStore = read('../../game/store.ts');

  it('does not advance by tapping instructional copy', () => {
    expect(hints).not.toContain('onPress={advance}');
    expect(hints).not.toContain('tutorialDone');
    expect(hints).toContain('useFtueStore');
  });

  it('uses a vector pointer and no emoji hand', () => {
    expect(pointer).toContain("from 'react-native-svg'");
    expect(pointer).toContain('<Path');
    expect(hints).not.toContain('1F446');
  });

  it('keeps guidance transparent to drag and provides an accessible 48dp skip', () => {
    expect(pointer).toContain('pointerEvents="none"');
    expect(hints).toContain('pointerEvents="none"');
    expect(hints).toContain('minWidth: 48');
    expect(hints).toContain('minHeight: 48');
    expect(hints).toContain('accessibilityRole="button"');
    expect(hints).toContain('accessibilityLabel={skipLabel}');
  });

  it('has a static reduced-motion pointer path', () => {
    expect(pointer).toContain('reducedMotion ? 1 : 0');
    expect(pointer).toContain('reducedMotion ? 0.92');
  });

  it('keeps the prepared clear separate from independent play', () => {
    expect(hints).not.toContain('placements > 0');
    expect(hints).toContain("status !== 'guided_success'");
    expect(hints).toContain('Заполни ряд или столбец');
    expect(hints).toContain('finishGuidedCelebration');
  });

  it('completes celebration only on the same persisted tutorial run', () => {
    expect(hints).toContain('ftueRunId !== classicRunId');
    expect(hints).toContain('currentFtue.runId !== currentRunId');
    expect(game).toContain('useFtueStore.getState().bindRun');
    expect(game).toContain("summary.runKind === 'tutorial'");
    expect(hints).toContain('}, 700);');
    expect(hints).toContain('syncTutorialCheckpoint');
  });

  it('shows assistance without blocking drag and only after the store requests it', () => {
    expect(game).toContain('shouldShowFtueAssistance');
    expect(hints).toContain('showAssistance && targetCells.length > 0');
    expect(hints).toContain('pointerEvents="box-none"');
  });

  it('maps tutorial target rows directly onto the board grid', () => {
    expect(game).toContain('y: boardLayout.y + row * (cellSize + cellGap)');
    expect(game).not.toContain('(row + 1) * (cellSize + cellGap)');
  });

  it('renders hints in the same coordinate space as the measured board and tray', () => {
    const ts = jest.requireActual<typeof import('typescript')>('typescript');
    const source = ts.createSourceFile('game.tsx', game, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const parents = new Map<string, import('typescript').Node>();
    const visit = (node: import('typescript').Node) => {
      if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
        const opening = ts.isJsxElement(node) ? node.openingElement : node;
        if (opening.tagName.getText(source) === 'TutorialHints') parents.set('hints', node.parent);
        const onLayout = opening.attributes.properties.find(
          (prop) => ts.isJsxAttribute(prop) && prop.name.getText(source) === 'onLayout',
        );
        if (onLayout?.getText(source) === 'onLayout={handleBoardLayout}') {
          parents.set('board', node.parent);
        }
        if (ts.isJsxElement(node) && node.children.some(
          (child) => ts.isJsxSelfClosingElement(child) && child.tagName.getText(source) === 'TrayView',
        )) parents.set('tray', node.parent);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    expect(parents.get('board')).toBeDefined();
    expect(parents.get('hints')).toBe(parents.get('board'));
    expect(parents.get('hints')).toBe(parents.get('tray'));
  });

  it('never injects a hidden recovery win when no short path exists', () => {
    expect(gameStore).not.toContain('withTutorialRecoveryPiece');
    expect(gameStore).toContain('findTutorialRecommendation');
  });
});
