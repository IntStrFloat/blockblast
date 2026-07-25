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

  return {
    __esModule: true,
    default: {
      View: ({ children, ...props }: { children?: React.ReactNode }) =>
        React.createElement('animated-view', props, children),
    },
    Easing: {
      in: (value: unknown) => value,
      out: (value: unknown) => value,
      quad: 'quad',
    },
    useAnimatedStyle: (factory: () => unknown) => factory(),
    useSharedValue: (initial: unknown) => ({ value: initial }),
    withDelay: (_delay: number, value: unknown) => value,
    withSequence: (...values: unknown[]) => values[values.length - 1],
    withTiming: (value: unknown) => value,
  };
});

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
  const gameEffectsPath = `${__dirname}/../effects/GameEffectsLayer.tsx`;
  const placementParticlePath = `${__dirname}/../effects/PlacementParticleLayer.tsx`;
  const boardFramePulsePath = `${__dirname}/../effects/BoardFramePulse.tsx`;
  const clearSparkPath = `${__dirname}/../effects/ClearSparkLayer.tsx`;

  it('keeps the board grid clipped while moving overflow effects into sibling layers', () => {
    expect(fs.existsSync(gameEffectsPath)).toBe(true);
    expect(fs.existsSync(placementParticlePath)).toBe(true);
    expect(fs.existsSync(boardFramePulsePath)).toBe(true);
    expect(fs.existsSync(clearSparkPath)).toBe(true);

    const gameEffectsSource = fs.readFileSync(gameEffectsPath, 'utf8');
    const placementParticleSource = fs.readFileSync(placementParticlePath, 'utf8');
    const boardFramePulseSource = fs.readFileSync(boardFramePulsePath, 'utf8');
    const clearSparkSource = fs.readFileSync(clearSparkPath, 'utf8');

    expect(boardSource).toContain("overflow: 'visible'");
    expect(boardSource).toContain("overflow: 'hidden'");
    expect(boardSource).toContain('<GameEffectsLayer');
    expect(boardSource).toContain('<ClearBurstLayer');
    expect(boardSource).toContain('<ClearDebrisLayer');
    expect(boardSource).toContain('<ClearSparkLayer');
    expect(boardSource).toContain('placementEffects=');
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
    expect(clearSparkSource).toContain('useFrameCallback');
    expect(clearSparkSource).toContain('velocityX');
    expect(clearSparkSource).toContain('gravity');
  });

  it('keeps a single destruction system: no legacy line-highlight/spark clear layers', () => {
    // Дублирование анимаций клира: легаси-слои (радужные линии, искры,
    // ClearLayer) удалены — разрушение целиком в ClearBurstLayer + крошке.
    expect(fs.existsSync(`${__dirname}/../effects/ClearLayer.tsx`)).toBe(false);
    expect(fs.existsSync(`${__dirname}/../effects/LineHighlightLayer.tsx`)).toBe(false);
    expect(boardSource).not.toContain('<ClearLayer ');
    expect(boardSource).not.toContain('LineHighlightLayer');

    const gameEffectsSource = fs.readFileSync(gameEffectsPath, 'utf8');
    expect(gameEffectsSource).not.toContain('ClearDebrisLayer');
    expect(gameEffectsSource).not.toContain('BlockCrushLayer');
  });

  it('keeps transient particles in reusable pools instead of mounting Keyframe views per event', () => {
    const hotLayerPaths = [
      `${__dirname}/../effects/ClearBurstLayer.tsx`,
      `${__dirname}/../effects/ClearDebrisLayer.tsx`,
      `${__dirname}/../effects/ClearSparkLayer.tsx`,
      `${__dirname}/../effects/PlacementParticleLayer.tsx`,
    ];

    for (const path of hotLayerPaths) {
      const source = fs.readFileSync(path, 'utf8');
      expect(source).not.toContain('Keyframe');
      expect(source).not.toContain('entering=');
      expect(source).toContain('POOL_SIZE');
      expect(source).toContain('useSharedValue');
    }
  });

  it('mounts destruction pools once: pooled layers accept presentation instances, not raw items', () => {
    const burstSource = fs.readFileSync(`${__dirname}/../effects/ClearBurstLayer.tsx`, 'utf8');
    const debrisSource = fs.readFileSync(`${__dirname}/../effects/ClearDebrisLayer.tsx`, 'utf8');
    const sparkSource = fs.readFileSync(`${__dirname}/../effects/ClearSparkLayer.tsx`, 'utf8');

    for (const source of [burstSource, debrisSource, sparkSource]) {
      expect(source).toContain('presentations: readonly ClearPresentationInstance[]');
      expect(source).toContain('fired');
    }
  });
});

describe('clear effect layer rendering', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { GameEffectsLayer } = require('../effects/GameEffectsLayer') as typeof import('../effects/GameEffectsLayer');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ClearDebrisLayer } = require('../effects/ClearDebrisLayer') as typeof import('../effects/ClearDebrisLayer');

  it('renders placement effects without clear-presentation coupling', () => {
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

    let effectsRenderer: ReturnType<typeof create> | null = null;
    act(() => {
      effectsRenderer = create(
        <GameEffectsLayer placementEffects={placementEffects as any} />,
      );
    });

    expect(effectsRenderer!.root.findAllByProps({ testID: 'placement-particle-layer' })).toHaveLength(2);
    expect(effectsRenderer!.root.findAllByProps({ testID: 'board-frame-pulse' })).toHaveLength(1);
  });

  it('keeps the debris pool mounted with a constant view count across presentations', () => {
    const presentation = {
      key: 'clear-1',
      debris: [],
      sparks: [],
      shards: [],
      centroid: { x: 0, y: 0 },
      shake: { amplitude: 0, scale: 1, durationMs: 0 },
      praiseFontSize: 0,
      reducedMotion: false,
    };

    let renderer: ReturnType<typeof create> | null = null;
    act(() => {
      renderer = create(<ClearDebrisLayer presentations={[]} />);
    });
    const emptyCount = renderer!.root.findAllByType('animated-view' as never).length;
    expect(emptyCount).toBeGreaterThan(0);

    act(() => {
      renderer!.update(
        <ClearDebrisLayer
          presentations={[
            { id: 'instance-1', presentation },
            { id: 'instance-2', presentation: { ...presentation, key: 'clear-2' } },
          ] as never}
        />,
      );
    });
    expect(renderer!.root.findAllByType('animated-view' as never)).toHaveLength(emptyCount);
  });
});
