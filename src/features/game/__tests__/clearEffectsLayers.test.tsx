import React from 'react';
import { act, create } from 'react-test-renderer';

declare const __dirname: string;

const fs = jest.requireActual<{
  existsSync(path: string): boolean;
  readFileSync(path: string, encoding: string): string;
}>('fs');

jest.mock('react-native-reanimated', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');

  class MockKeyframe {
    duration() {
      return this;
    }

    delay() {
      return this;
    }
  }

  return {
    __esModule: true,
    default: {
      View: ({ children, ...props }: { children?: React.ReactNode }) =>
        React.createElement('animated-view', props, children),
    },
    Keyframe: MockKeyframe,
  };
});

jest.mock('../effects/BlockCrushLayer', () => ({
  BlockCrushLayer: () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const React = require('react');
    return React.createElement('block-crush-layer', { testID: 'block-crush-layer' });
  },
}));

jest.mock('../effects/LineHighlightLayer', () => ({
  LineHighlightLayer: () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const React = require('react');
    return React.createElement('line-highlight-layer', { testID: 'line-highlight-layer' });
  },
}));

jest.mock('../effects/ClearDebrisLayer', () => ({
  ClearDebrisLayer: () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const React = require('react');
    return React.createElement('clear-debris-layer', { testID: 'clear-debris-layer' });
  },
}));

jest.mock('../effects/PlacementParticleLayer', () => ({
  PlacementParticleLayer: () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const React = require('react');
    return React.createElement('placement-particle-layer', { testID: 'placement-particle-layer' });
  },
}));

jest.mock('../effects/BoardFramePulse', () => ({
  BoardFramePulse: () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const React = require('react');
    return React.createElement('board-frame-pulse', { testID: 'board-frame-pulse' });
  },
}));

describe('clear effects layer source contract', () => {
  const boardSource = fs.readFileSync(`${__dirname}/../components/BoardView.tsx`, 'utf8');
  const clearLayerSource = fs.readFileSync(`${__dirname}/../effects/ClearLayer.tsx`, 'utf8');
  const gameEffectsPath = `${__dirname}/../effects/GameEffectsLayer.tsx`;
  const placementParticlePath = `${__dirname}/../effects/PlacementParticleLayer.tsx`;
  const boardFramePulsePath = `${__dirname}/../effects/BoardFramePulse.tsx`;

  it('keeps the board grid clipped while moving overflow effects into a sibling layer', () => {
    expect(fs.existsSync(gameEffectsPath)).toBe(true);
    expect(fs.existsSync(placementParticlePath)).toBe(true);
    expect(fs.existsSync(boardFramePulsePath)).toBe(true);

    const gameEffectsSource = fs.readFileSync(gameEffectsPath, 'utf8');
    const placementParticleSource = fs.readFileSync(placementParticlePath, 'utf8');
    const boardFramePulseSource = fs.readFileSync(boardFramePulsePath, 'utf8');

    expect(boardSource).toContain("overflow: 'visible'");
    expect(boardSource).toContain("overflow: 'hidden'");
    expect(boardSource).toContain('<ClearLayer');
    expect(boardSource).toContain('<GameEffectsLayer');
    expect(boardSource).toContain('placementEffects=');
    expect(clearLayerSource).not.toContain('ClearDebrisLayer');
    expect(gameEffectsSource).toContain('ClearDebrisLayer');
    expect(gameEffectsSource).toContain('PlacementParticleLayer');
    expect(gameEffectsSource).toContain('BoardFramePulse');
    expect(gameEffectsSource).toContain('pointerEvents="none"');
    expect(gameEffectsSource).toContain("overflow: 'visible'");
    expect(placementParticleSource).toContain('pointerEvents="none"');
    expect(placementParticleSource).toContain('opacity');
    expect(placementParticleSource).toContain('transform');
    expect(placementParticleSource).not.toContain('layout=');
    expect(boardFramePulseSource).toContain('pointerEvents="none"');
    expect(boardFramePulseSource).toContain('opacity');
    expect(boardFramePulseSource).toContain('transform');
    expect(boardFramePulseSource).not.toContain('layout=');
  });
});

describe('clear effect layer rendering', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ClearLayer } = require('../effects/ClearLayer') as typeof import('../effects/ClearLayer');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { GameEffectsLayer } = require('../effects/GameEffectsLayer') as typeof import('../effects/GameEffectsLayer');

  it('renders local and external effects for each active presentation without cross-layer duplication', () => {
    const firstPresentation = {
      key: 'clear-1',
      lines: [],
      intersections: [],
      fragments: [],
      debris: [],
      fallingFragments: [],
      sparks: [],
      centroid: { x: 0, y: 0 },
      shake: { amplitude: 0, scale: 1, durationMs: 0 },
      praiseFontSize: 0,
      reducedMotion: false,
    };
    const secondPresentation = {
      ...firstPresentation,
      key: 'clear-2',
      centroid: { x: 12, y: 16 },
    };
    const presentations = [
      { id: 'instance-1', presentation: firstPresentation },
      { id: 'instance-2', presentation: secondPresentation },
    ];
    const placementEffects = [
      {
        id: 'placement-1',
        placement: {
          anchor: { x: 24, y: 36 },
          particles: [],
          burstScale: 1.08,
          flashAlpha: 0.22,
          scoreScale: 1.1,
          reducedMotion: false,
        },
        comboFrame: {
          intensity: 0.45,
          lineStrength: 0.5,
          boardClearStrength: 0,
          shakeAmplitude: 0,
          shakeDurationMs: 0,
          scale: 1,
          reducedMotion: false,
        },
        color: '#ff4d67',
      },
      {
        id: 'placement-2',
        placement: {
          anchor: { x: 44, y: 52 },
          particles: [],
          burstScale: 1.02,
          flashAlpha: 0.16,
          scoreScale: 1,
          reducedMotion: true,
        },
        comboFrame: {
          intensity: 0,
          lineStrength: 0,
          boardClearStrength: 0,
          shakeAmplitude: 0,
          shakeDurationMs: 0,
          scale: 1,
          reducedMotion: true,
        },
        color: '#ffc93c',
      },
    ];

    let clearRenderer: ReturnType<typeof create> | null = null;
    let effectsRenderer: ReturnType<typeof create> | null = null;
    act(() => {
      clearRenderer = create(<ClearLayer presentations={presentations as any} />);
      effectsRenderer = create(
        <GameEffectsLayer presentations={presentations as any} placementEffects={placementEffects as any} />,
      );
    });

    expect(clearRenderer!.root.findAllByProps({ testID: 'block-crush-layer' })).toHaveLength(2);
    expect(clearRenderer!.root.findAllByProps({ testID: 'line-highlight-layer' })).toHaveLength(2);
    expect(clearRenderer!.root.findAllByProps({ testID: 'clear-debris-layer' })).toHaveLength(0);
    expect(effectsRenderer!.root.findAllByProps({ testID: 'block-crush-layer' })).toHaveLength(2);
    expect(effectsRenderer!.root.findAllByProps({ testID: 'clear-debris-layer' })).toHaveLength(2);
    expect(effectsRenderer!.root.findAllByProps({ testID: 'placement-particle-layer' })).toHaveLength(2);
    expect(effectsRenderer!.root.findAllByProps({ testID: 'board-frame-pulse' })).toHaveLength(1);
  });
});
