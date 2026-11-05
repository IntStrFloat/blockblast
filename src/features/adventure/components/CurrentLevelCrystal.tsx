import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as THREE from 'three';

import { useReducedMotion } from '@/features/game/animation/useReducedMotion';

type DisposableResource = { dispose(): void };

function CurrentLevelCrystalFallback({ size }: { size: number }) {
  const crystalSize = size * 0.78;

  return (
    <View testID="current-level-crystal-fallback" style={styles.fallback}>
      <Svg width={crystalSize} height={crystalSize * 1.05} viewBox="0 0 100 108" fill="none">
        <Path d="M50 3 87 35 75 84 50 105 25 84 13 35 50 3Z" fill="#F3A20D" />
        <Path d="M50 3 50 105 25 84 13 35 50 3Z" fill="#E9890B" />
        <Path d="m50 3 37 32-37 14-37-14L50 3Z" fill="#FFF0A7" />
        <Path d="m50 49 37-14-12 49-25 21V49Z" fill="#FFC62E" />
        <Path d="m50 49 25 35-25 21V49Z" fill="#FFB41F" />
        <Path d="m50 3 14 37-14 9-14-9L50 3Z" fill="#FFF8C9" fillOpacity={0.82} />
      </Svg>
    </View>
  );
}

export function CurrentLevelCrystal({ size }: { size: number }) {
  const reducedMotion = useReducedMotion();
  const [rendererFailed, setRendererFailed] = useState(false);
  const frameRef = useRef<number | null>(null);
  const disposeRef = useRef<(() => void) | null>(null);
  const mountedRef = useRef(true);
  const focusedRef = useRef(false);
  const appActiveRef = useRef(AppState.currentState === 'active');
  const contextGenerationRef = useRef(0);
  const [renderSession, setRenderSession] = useState({ active: false, id: 0, reducedMotion });

  const stopRenderer = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    const dispose = disposeRef.current;
    disposeRef.current = null;
    try {
      dispose?.();
    } catch {
      // Cleanup is best-effort because some broken GL contexts throw on dispose too.
    }
  }, []);

  const markRendererFailed = useCallback(() => {
    contextGenerationRef.current += 1;
    stopRenderer();
    if (mountedRef.current) {
      setRendererFailed(true);
    }
  }, [stopRenderer]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      contextGenerationRef.current += 1;
      stopRenderer();
    };
  }, [stopRenderer]);

  const refreshRenderSession = useCallback(() => {
    const id = ++contextGenerationRef.current;
    stopRenderer();
    if (mountedRef.current) {
      setRenderSession({
        active: focusedRef.current && appActiveRef.current,
        id,
        reducedMotion,
      });
    }
  }, [reducedMotion, stopRenderer]);

  useFocusEffect(useCallback(() => {
    focusedRef.current = true;
    refreshRenderSession();
    return () => {
      focusedRef.current = false;
      refreshRenderSession();
    };
  }, [refreshRenderSession]));

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      const active = state === 'active';
      if (appActiveRef.current === active) return;
      appActiveRef.current = active;
      refreshRenderSession();
    });
    return () => subscription.remove();
  }, [refreshRenderSession]);

  const onContextCreate = useCallback((gl: ExpoWebGLRenderingContext) => {
    // Native context creation may finish after blur, backgrounding or a newer
    // GLView mount. A stale callback must not dispose or restart the current one.
    if (!mountedRef.current || !focusedRef.current || !appActiveRef.current ||
        !renderSession.active || renderSession.id !== contextGenerationRef.current) return;
    stopRenderer();

    let active = true;
    let disposed = false;
    let renderer: THREE.WebGLRenderer | null = null;
    const resources: DisposableResource[] = [];

    disposeRef.current = () => {
      active = false;
      if (disposed) {
        return;
      }
      disposed = true;

      for (const resource of resources) {
        try {
          resource.dispose();
        } catch {
          // Keep cleaning up the remaining resources after a context failure.
        }
      }
      try {
        renderer?.dispose();
      } catch {
        // A lost or partially initialized context may reject renderer disposal.
      }
    };

    try {
      const canvas = {
        width: gl.drawingBufferWidth,
        height: gl.drawingBufferHeight,
        clientHeight: gl.drawingBufferHeight,
        style: {},
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      } as unknown as HTMLCanvasElement;
      renderer = new THREE.WebGLRenderer({
        canvas,
        context: gl as unknown as WebGLRenderingContext,
        alpha: true,
        antialias: true,
      });
      renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
      renderer.setClearColor(0x000000, 0);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.26;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(30, gl.drawingBufferWidth / gl.drawingBufferHeight, 0.1, 20);
      camera.position.set(0, 0.45, 4.85);
      camera.lookAt(0, 0.03, 0);

      const crystal = new THREE.Group();
      crystal.rotation.set(0.18, 0.36, 0.14);

      const gemGeometry = new THREE.OctahedronGeometry(0.82, 0);
      resources.push(gemGeometry);
      const gemMaterial = new THREE.MeshPhysicalMaterial({
        color: 0xffba20,
        emissive: 0x4f2300,
        emissiveIntensity: 0.38,
        metalness: 0.22,
        roughness: 0.19,
        flatShading: true,
      });
      resources.push(gemMaterial);
      const gem = new THREE.Mesh(gemGeometry, gemMaterial);
      gem.scale.set(1, 0.88, 0.82);
      crystal.add(gem);

      const highlightGeometry = new THREE.OctahedronGeometry(0.825, 0);
      resources.push(highlightGeometry);
      const highlightMaterial = new THREE.MeshBasicMaterial({
        color: 0xfff5a7,
        transparent: true,
        opacity: 0.21,
        side: THREE.FrontSide,
        depthWrite: false,
      });
      resources.push(highlightMaterial);
      const highlight = new THREE.Mesh(highlightGeometry, highlightMaterial);
      highlight.scale.set(0.996, 0.875, 0.816);
      crystal.add(highlight);
      scene.add(crystal);

      scene.add(new THREE.HemisphereLight(0xfff6c2, 0xd76b03, 1.95));
      const keyLight = new THREE.DirectionalLight(0xfff3c4, 2.6);
      keyLight.position.set(-2.5, 3.6, 4.4);
      scene.add(keyLight);
      const rimLight = new THREE.PointLight(0xffc31c, 5.8, 6);
      rimLight.position.set(2.2, -0.35, 2.1);
      scene.add(rimLight);

      const startedAt = Date.now();
      const render = () => {
        if (!active) {
          return;
        }

        try {
          const elapsed = (Date.now() - startedAt) / 1000;
          if (!renderSession.reducedMotion) {
            crystal.position.y = Math.sin(elapsed * 2.15) * 0.09;
            crystal.rotation.y = 0.36 + Math.sin(elapsed * 1.05) * 0.22;
            crystal.rotation.z = 0.14 + Math.sin(elapsed * 1.62) * 0.055;
          }
          renderer?.render(scene, camera);
          gl.endFrameEXP();
          if (active && !renderSession.reducedMotion) {
            frameRef.current = requestAnimationFrame(render);
          }
        } catch {
          markRendererFailed();
        }
      };

      render();
    } catch {
      markRendererFailed();
    }
  }, [markRendererFailed, renderSession, stopRenderer]);

  return (
    <View
      pointerEvents="none"
      style={[styles.currentMarker, { width: size, height: size * 1.05 }]}
      accessibilityLabel="Текущий уровень"
    >
      {rendererFailed || !renderSession.active ? (
        <CurrentLevelCrystalFallback size={size} />
      ) : (
        <GLView key={renderSession.id} style={styles.currentMarkerCanvas} onContextCreate={onContextCreate} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  currentMarker: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  currentMarkerCanvas: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
});
