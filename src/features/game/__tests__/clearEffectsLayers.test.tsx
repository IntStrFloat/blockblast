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
    cancelAnimation: jest.fn(),
    Easing: {
      bezier: () => (value: number) => value,
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
  const boardAuraFramePath = `${__dirname}/../effects/BoardAuraFrame.tsx`;
  const clearSparkPath = `${__dirname}/../effects/ClearSparkLayer.tsx`;
  const clearChoreographyPath = `${__dirname}/../effects/ClearChoreographyLayer.tsx`;
  const comboAuraPath = `${__dirname}/../effects/ComboAuraFrame.tsx`;

  it('keeps the board grid clipped while moving overflow effects into sibling layers', () => {
    expect(fs.existsSync(gameEffectsPath)).toBe(true);
    expect(fs.existsSync(placementParticlePath)).toBe(true);
    expect(fs.existsSync(boardFramePulsePath)).toBe(true);
    expect(fs.existsSync(boardAuraFramePath)).toBe(true);
    expect(fs.existsSync(clearSparkPath)).toBe(true);
    expect(fs.existsSync(clearChoreographyPath)).toBe(true);
    expect(fs.existsSync(comboAuraPath)).toBe(true);

    const gameEffectsSource = fs.readFileSync(gameEffectsPath, 'utf8');
    const placementParticleSource = fs.readFileSync(placementParticlePath, 'utf8');
    const boardFramePulseSource = fs.readFileSync(boardFramePulsePath, 'utf8');
    const boardAuraFrameSource = fs.readFileSync(boardAuraFramePath, 'utf8');
    const clearSparkSource = fs.readFileSync(clearSparkPath, 'utf8');

    expect(boardSource).toContain("overflow: 'visible'");
    expect(boardSource).toContain("overflow: 'hidden'");
    expect(boardSource).toContain('<GameEffectsLayer');
    expect(boardSource).toContain('<ClearBurstLayer');
    expect(boardSource).toContain('<ClearDebrisLayer');
    expect(boardSource).toContain('<ClearSparkLayer');
    expect(boardSource).toContain('<ClearChoreographyLayer');
    expect(boardSource).toContain('<ComboAuraFrame');
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
    expect(boardAuraFrameSource).not.toContain('ATMOSPHERE.frameOpacityPerPhase[phase]');
    expect(boardAuraFrameSource).toContain('const target = recordIntensity * 0.56');
    expect(clearSparkSource).toContain('useFrameCallback');
    expect(clearSparkSource).toContain('velocityX');
    expect(clearSparkSource).toContain('gravity');
    expect(boardSource).toContain('<ClearBurstLayer presentations={renderedClearPresentations} />');
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

    const choreographySource = fs.readFileSync(clearChoreographyPath, 'utf8');
    expect(choreographySource).toContain('presentation.sequence.beams');
    expect(choreographySource).toContain('presentation.sequence.motes');
    expect(choreographySource).toContain('POOL_SIZE');
    expect(choreographySource).toContain('useSharedValue');
    expect(choreographySource).toContain('useLayoutEffect');
    expect(choreographySource).not.toContain('Keyframe');
    expect(choreographySource).not.toContain('entering=');
    expect(choreographySource).not.toContain('ClearBurstShard');
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

    const burstSource = fs.readFileSync(
      `${__dirname}/../effects/ClearBurstLayer.tsx`,
      'utf8',
    );
    expect(burstSource).toContain('useLayoutEffect');
    expect(burstSource).toContain('opacity.value = 1');
  });

  it('phase-locks high-combo streaks to clear event identity instead of an ambient loop', () => {
    const comboAuraSource = fs.readFileSync(comboAuraPath, 'utf8');
    expect(comboAuraSource).toContain('eventId');
    expect(comboAuraSource).not.toContain('withRepeat');
    expect(comboAuraSource).toContain('EFFECT_SEQUENCE_TIMING');
  });

  it('keeps secondary destruction pools mounted and presentation-driven', () => {
    const debrisSource = fs.readFileSync(`${__dirname}/../effects/ClearDebrisLayer.tsx`, 'utf8');
    const sparkSource = fs.readFileSync(`${__dirname}/../effects/ClearSparkLayer.tsx`, 'utf8');

    for (const source of [debrisSource, sparkSource]) {
      expect(source).toContain('presentations: readonly ClearPresentationInstance[]');
      expect(source).toContain('fired');
    }
  });

  it('keeps pooled spark frame callbacks dormant outside an active presentation', () => {
    const sparkSource = fs.readFileSync(clearSparkPath, 'utf8');

    expect(sparkSource).toContain('}, [stopIfCurrent]), false)');
    expect(sparkSource).toContain('setActive(true)');
    expect(sparkSource).toContain('setActive(false)');
    expect(sparkSource).toContain('scheduleOnRN(stopIfCurrent, generation.value)');
    expect(sparkSource).toContain('generation.value !== completedGeneration');
    expect(sparkSource).toContain("AppState.addEventListener('change'");
  });
});

describe('clear effect layer rendering', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { GameEffectsLayer } = require('../effects/GameEffectsLayer') as typeof import('../effects/GameEffectsLayer');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ClearDebrisLayer } = require('../effects/ClearDebrisLayer') as typeof import('../effects/ClearDebrisLayer');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ClearChoreographyLayer } = require('../effects/ClearChoreographyLayer') as typeof import('../effects/ClearChoreographyLayer');

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

  it('keeps the choreography pool mounted with a constant view count across presentations', () => {
    const presentation = {
      key: 'clear-1',
      sequence: {
        tier: 'line_2',
        stages: [],
        segments: [
          {
            id: 'segment-1',
            axis: 'row',
            row: 0,
            col: 0,
            x: 10,
            y: 20,
            width: 30,
            height: 30,
            color: '#FFAA00',
          },
        ],
        beams: [
          {
            id: 'beam-1',
            axis: 'row',
            x: 0,
            y: 32,
            width: 120,
            height: 6,
            color: '#FFAA00',
          },
        ],
        motes: [
          {
            id: 'mote-1',
            x: 45,
            y: 42,
            dx: 18,
            dy: -12,
            size: 8,
            delayMs: 0,
            durationMs: 180,
            color: '#FFFFFF',
            rotationDeg: 45,
          },
        ],
        impact: {
          x: 60,
          y: 60,
          size: 24,
          color: '#FFAA00',
        },
        reducedMotion: false,
      },
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
      renderer = create(<ClearChoreographyLayer presentations={[]} />);
    });
    const emptyCount = renderer!.root.findAllByType('animated-view' as never).length;
    expect(emptyCount).toBeGreaterThan(0);

    act(() => {
      renderer!.update(
        <ClearChoreographyLayer
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
