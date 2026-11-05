import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { CurrentLevelCrystal } from '../components/CurrentLevelCrystal';

const mockRendererFactory = jest.fn();
let mockFocused = true;
let mockAppState = 'active';
let mockReducedMotion = false;
const mockFocusListeners = new Set<(focused: boolean) => void>();
const mockAppStateListeners = new Set<(state: string) => void>();
const mockFrames: FrameRequestCallback[] = [];
const mockContexts: ((gl: typeof mockGl) => void)[] = [];
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
        mockContexts.push(onContextCreate);
        onContextCreate(mockGl);
      }, [onContextCreate]);

      return ReactModule.createElement('GLView', { testID: 'mock-gl-view' });
    },
  };
});

jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void | (() => void)) => {
    const ReactModule = jest.requireActual<typeof React>('react');
    ReactModule.useEffect(() => {
      let cleanup: void | (() => void);
      const focusChanged = (focused: boolean) => {
        if (focused) cleanup = callback();
        else { cleanup?.(); cleanup = undefined; }
      };
      mockFocusListeners.add(focusChanged);
      focusChanged(mockFocused);
      return () => { cleanup?.(); mockFocusListeners.delete(focusChanged); };
    }, [callback]);
  },
}));

jest.mock('react-native/Libraries/AppState/AppState', () => ({ default: {
  get currentState() { return mockAppState; },
  addEventListener: (_name: string, listener: (state: string) => void) => {
    mockAppStateListeners.add(listener);
    return { remove: () => mockAppStateListeners.delete(listener) };
  },
} }));

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
  useReducedMotion: () => mockReducedMotion,
}));

function focus(focused: boolean) {
  act(() => {
    mockFocused = focused;
    [...mockFocusListeners].forEach((listener) => listener(focused));
  });
}

function appState(state: string) {
  act(() => {
    mockAppState = state;
    [...mockAppStateListeners].forEach((listener) => listener(state));
  });
}

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
    mockFocused = true;
    mockAppState = 'active';
    mockReducedMotion = false;
    mockFocusListeners.clear();
    mockAppStateListeners.clear();
    mockFrames.length = 0;
    mockContexts.length = 0;
    jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback) => {
      mockFrames.push(callback);
      return mockFrames.length;
    });
    jest.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});
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

  it('stops and disposes the retained map renderer as soon as its route blurs', () => {
    const renderer = rendererStub();
    mockRendererFactory.mockReturnValue(renderer);
    const tree = renderCrystal();
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);

    focus(false);
    expect(renderer.dispose).toHaveBeenCalledTimes(1);
    expect(cancelAnimationFrame).toHaveBeenCalledWith(1);
    expect(tree.root.findAllByProps({ testID: 'mock-gl-view' })).toHaveLength(0);
    act(() => mockFrames[0](16));
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
    expect(renderer.dispose).toHaveBeenCalledTimes(1);
  });

  it('rejects old native context callbacks while hidden and after a fresh focus', () => {
    const first = rendererStub();
    const second = rendererStub();
    mockRendererFactory.mockReturnValueOnce(first).mockReturnValueOnce(second);
    const tree = renderCrystal();
    const staleContext = mockContexts[0];

    focus(false);
    act(() => staleContext(mockGl));
    expect(mockRendererFactory).toHaveBeenCalledTimes(1);

    focus(true);
    expect(mockRendererFactory).toHaveBeenCalledTimes(2);
    expect(second.render).toHaveBeenCalledTimes(1);
    act(() => staleContext(mockGl));
    expect(mockRendererFactory).toHaveBeenCalledTimes(2);
    expect(second.dispose).not.toHaveBeenCalled();
    act(() => tree.unmount());
    expect(second.dispose).toHaveBeenCalledTimes(1);
  });

  it('pauses in the background and resumes only when both map focus and app activity return', () => {
    const renderers: ReturnType<typeof rendererStub>[] = [];
    mockRendererFactory.mockImplementation(() => {
      const renderer = rendererStub();
      renderers.push(renderer);
      return renderer;
    });
    const tree = renderCrystal();
    appState('background');
    expect(renderers[0].dispose).toHaveBeenCalledTimes(1);
    expect(tree.root.findAllByProps({ testID: 'mock-gl-view' })).toHaveLength(0);

    focus(false);
    appState('active');
    expect(mockRendererFactory).toHaveBeenCalledTimes(1);
    focus(true);
    expect(mockRendererFactory).toHaveBeenCalledTimes(2);
    expect(renderers[1].render).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
  });

  it('does not initialize GL for an initially hidden map', () => {
    mockFocused = false;
    mockRendererFactory.mockReturnValue(rendererStub());
    const tree = renderCrystal();
    expect(mockRendererFactory).not.toHaveBeenCalled();
    expect(requestAnimationFrame).not.toHaveBeenCalled();
    act(() => tree.unmount());
  });

  it('waits for the foreground when the focused map mounts in the background', () => {
    mockAppState = 'background';
    mockRendererFactory.mockReturnValue(rendererStub());
    const tree = renderCrystal();
    expect(mockRendererFactory).not.toHaveBeenCalled();
    appState('active');
    expect(mockRendererFactory).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
  });

  it('renders reduced motion once without keeping a static GL scene on a frame loop', () => {
    mockReducedMotion = true;
    const renderer = rendererStub();
    mockRendererFactory.mockReturnValue(renderer);
    const tree = renderCrystal();
    expect(renderer.render).toHaveBeenCalledTimes(1);
    expect(mockGl.endFrameEXP).toHaveBeenCalledTimes(1);
    expect(requestAnimationFrame).not.toHaveBeenCalled();
    act(() => tree.unmount());
    expect(renderer.dispose).toHaveBeenCalledTimes(1);
  });

  it('recreates the visible context when reduced motion changes and ignores a late unmounted context', () => {
    mockReducedMotion = true;
    const renderers: ReturnType<typeof rendererStub>[] = [];
    mockRendererFactory.mockImplementation(() => {
      const renderer = rendererStub();
      renderers.push(renderer);
      return renderer;
    });
    const tree = renderCrystal();
    expect(requestAnimationFrame).not.toHaveBeenCalled();

    mockReducedMotion = false;
    act(() => tree.update(<CurrentLevelCrystal size={96} />));
    expect(mockRendererFactory).toHaveBeenCalledTimes(2);
    expect(renderers[0].dispose).toHaveBeenCalledTimes(1);
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);

    mockReducedMotion = true;
    act(() => tree.update(<CurrentLevelCrystal size={96} />));
    expect(mockRendererFactory).toHaveBeenCalledTimes(3);
    expect(renderers[1].dispose).toHaveBeenCalledTimes(1);
    expect(renderers[2].render).toHaveBeenCalledTimes(1);
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);

    const lateContext = mockContexts.at(-1)!;
    act(() => tree.unmount());
    act(() => lateContext(mockGl));
    expect(mockRendererFactory).toHaveBeenCalledTimes(3);
    expect(renderers[2].dispose).toHaveBeenCalledTimes(1);
  });
});
