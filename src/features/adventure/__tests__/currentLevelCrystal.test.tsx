import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { CurrentLevelCrystal } from '../components/CurrentLevelCrystal';

const mockRendererFactory = jest.fn();
const mockGl = {
  drawingBufferWidth: 96,
  drawingBufferHeight: 96,
  endFrameEXP: jest.fn(),
};

jest.mock('expo-gl', () => {
  const ReactModule = jest.requireActual<typeof React>('react');

  return {
    GLView: ({ onContextCreate }: { onContextCreate(gl: typeof mockGl): void }) => {
      ReactModule.useEffect(() => {
        onContextCreate(mockGl);
      }, [onContextCreate]);

      return ReactModule.createElement('GLView', { testID: 'mock-gl-view' });
    },
  };
});

jest.mock('three', () => {
  const actual = jest.requireActual<typeof import('three')>('three');

  return {
    ...actual,
    WebGLRenderer: function WebGLRenderer(options: unknown) {
      return mockRendererFactory(options);
    },
  };
});

jest.mock('@/features/game/animation/useReducedMotion', () => ({
  useReducedMotion: () => false,
}));

function rendererStub(render = jest.fn()) {
  return {
    setSize: jest.fn(),
    setClearColor: jest.fn(),
    render,
    dispose: jest.fn(),
    toneMapping: 0,
    toneMappingExposure: 0,
  };
}

function renderCrystal(): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(<CurrentLevelCrystal size={96} />);
  });
  return tree;
}

describe('CurrentLevelCrystal WebGL fallback', () => {
  beforeEach(() => {
    mockRendererFactory.mockReset();
    mockGl.endFrameEXP.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('falls back to SVG when Three.js cannot initialize the GL context', () => {
    mockRendererFactory.mockImplementation(() => {
      throw new TypeError("Cannot read property 'precision' of undefined");
    });

    const tree = renderCrystal();

    expect(tree.root.findByProps({ testID: 'current-level-crystal-fallback' })).toBeTruthy();
    act(() => tree.unmount());
  });

  it('falls back and disposes the renderer when a render frame fails', () => {
    const renderer = rendererStub(jest.fn(() => {
      throw new Error('render failed');
    }));
    mockRendererFactory.mockReturnValue(renderer);

    const tree = renderCrystal();

    expect(tree.root.findByProps({ testID: 'current-level-crystal-fallback' })).toBeTruthy();
    expect(renderer.dispose).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
    expect(renderer.dispose).toHaveBeenCalledTimes(1);
  });

  it('does not re-arm a queued frame after unmount', () => {
    const queuedFrames: ((time: number) => void)[] = [];
    const requestFrame = jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback) => {
      queuedFrames.push(callback);
      return queuedFrames.length;
    });
    const renderer = rendererStub();
    mockRendererFactory.mockReturnValue(renderer);

    const tree = renderCrystal();
    expect(requestFrame).toHaveBeenCalledTimes(1);

    act(() => tree.unmount());
    queuedFrames[0](16);

    expect(requestFrame).toHaveBeenCalledTimes(1);
    expect(renderer.dispose).toHaveBeenCalledTimes(1);
  });
});
