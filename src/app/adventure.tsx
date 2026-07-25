import { type Href, useRouter } from 'expo-router';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as THREE from 'three';
import Svg, { Path } from 'react-native-svg';

import { t } from '@/core/i18n';
import { absoluteLevelNumber, useAdventure } from '@/features/adventure';
import { useReducedMotion } from '@/features/game/animation/useReducedMotion';
import { useProfileStore } from '@/features/profile';
import { useLang } from '@/features/settings';
import { AppText, ChevronIcon } from '@/ui';

const ADVENTURE_MAP_THEME = {
  headerTop: '#2548B8',
  headerBottom: '#2876D2',
  stageTop: '#2548B8',
  stageBottom: '#1998DC',
  footer: 'rgba(28, 86, 190, 0.8)',
  footerBorder: 'rgba(255, 255, 255, 0.28)',
  lockedCell: 'rgba(28, 83, 174, 0.72)',
  lockedBorder: 'rgba(191, 230, 255, 0.34)',
  lockedText: '#D5F2FF',
  clearedCell: '#4E7ED8',
  clearedBorder: '#BDEBFF',
  clearedText: '#FFFFFF',
  activeCell: '#FFB82B',
  activeBorder: '#FFF0A7',
  activeText: '#833C08',
} as const;
const MAP_ROWS = [
  { offset: 0, count: 11 },
  { offset: 1, count: 9 },
  { offset: 2, count: 8 },
  { offset: 3, count: 6 },
  { offset: 2, count: 6 },
  { offset: 2, count: 7 },
  { offset: 2, count: 8 },
  { offset: 1, count: 9 },
  { offset: 1, count: 8 },
  { offset: 1, count: 8 },
  { offset: 2, count: 7 },
  { offset: 2, count: 6 },
  { offset: 4, count: 3 },
] as const;
const MAP_LEVEL_COUNT = MAP_ROWS.reduce((total, row) => total + row.count, 0);

function AdventureTrophy({ size, color, starColor }: { size: number; color: string; starColor: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      <Path d="M34 19h52v17a26 26 0 0 1-52 0V19Z" fill={color} />
      <Path d="M33 28H15v8c0 18 12 29 26 29v-12c-7 0-13-7-13-17v-8h5v0ZM87 28h18v8c0 18-12 29-26 29v-12c7 0 13-7 13-17v-8h-5v0Z" fill={color} />
      <Path d="M54 60h12v19H54zM42 80h36v13H42z" fill={color} />
      <Path d="m60 35 5.2 10.5 11.6 1.7-8.4 8.2 2 11.6L60 61.5 49.6 67l2-11.6-8.4-8.2 11.6-1.7L60 35Z" fill={starColor} />
    </Svg>
  );
}

function CurrentLevelCrystal({ size }: { size: number }) {
  const reducedMotion = useReducedMotion();
  const frameRef = useRef<number | null>(null);
  const disposeRef = useRef<(() => void) | null>(null);

  const stopRenderer = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    disposeRef.current?.();
    disposeRef.current = null;
  }, []);

  useEffect(() => stopRenderer, [stopRenderer]);

  const onContextCreate = useCallback((gl: ExpoWebGLRenderingContext) => {
    stopRenderer();

    const canvas = {
      width: gl.drawingBufferWidth,
      height: gl.drawingBufferHeight,
      clientHeight: gl.drawingBufferHeight,
      style: {},
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    } as unknown as HTMLCanvasElement;
    const renderer = new THREE.WebGLRenderer({
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
    const gemMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffba20,
      emissive: 0x4f2300,
      emissiveIntensity: 0.38,
      metalness: 0.22,
      roughness: 0.19,
      flatShading: true,
    });
    const gem = new THREE.Mesh(gemGeometry, gemMaterial);
    gem.scale.set(1, 0.88, 0.82);
    crystal.add(gem);

    const highlightGeometry = new THREE.OctahedronGeometry(0.825, 0);
    const highlightMaterial = new THREE.MeshBasicMaterial({
      color: 0xfff5a7,
      transparent: true,
      opacity: 0.21,
      side: THREE.FrontSide,
      depthWrite: false,
    });
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
      const elapsed = (Date.now() - startedAt) / 1000;
      if (!reducedMotion) {
        crystal.position.y = Math.sin(elapsed * 2.15) * 0.09;
        crystal.rotation.y = 0.36 + Math.sin(elapsed * 1.05) * 0.22;
        crystal.rotation.z = 0.14 + Math.sin(elapsed * 1.62) * 0.055;
      }
      renderer.render(scene, camera);
      gl.endFrameEXP();
      frameRef.current = requestAnimationFrame(render);
    };
    render();

    disposeRef.current = () => {
      gemGeometry.dispose();
      gemMaterial.dispose();
      highlightGeometry.dispose();
      highlightMaterial.dispose();
      renderer.dispose();
    };
  }, [reducedMotion, stopRenderer]);

  return (
    <View
      pointerEvents="none"
      style={[styles.currentMarker, { width: size, height: size * 1.05 }]}
      accessibilityLabel="Текущий уровень"
    >
      <GLView style={styles.currentMarkerCanvas} onContextCreate={onContextCreate} />
    </View>
  );
}

function AdventureLevelMap({ currentIndex, firstLevel, width }: { currentIndex: number; firstLevel: number; width: number }) {
  const cell = width / 11;
  const height = cell * MAP_ROWS.length;
  let levelIndex = 0;
  const currentPosition = (() => {
    let index = 0;
    for (let rowIndex = 0; rowIndex < MAP_ROWS.length; rowIndex += 1) {
      const row = MAP_ROWS[rowIndex];
      for (let columnIndex = 0; columnIndex < row.count; columnIndex += 1) {
        if (index === currentIndex) {
          return {
            left: (row.offset + columnIndex) * cell,
            top: (MAP_ROWS.length - 1 - rowIndex) * cell,
          };
        }
        index += 1;
      }
    }
    return null;
  })();

  const cells = MAP_ROWS.flatMap((row, rowIndex) => Array.from({ length: row.count }, (_, columnIndex) => {
    const index = levelIndex++;
    const active = index === currentIndex;
    const cleared = index < currentIndex;
    const left = (row.offset + columnIndex) * cell;
    const top = (MAP_ROWS.length - 1 - rowIndex) * cell;

    const palette = active
      ? {
          backgroundColor: ADVENTURE_MAP_THEME.activeCell,
          borderColor: ADVENTURE_MAP_THEME.activeBorder,
          textColor: ADVENTURE_MAP_THEME.activeText,
        }
      : cleared
        ? {
            backgroundColor: ADVENTURE_MAP_THEME.clearedCell,
            borderColor: ADVENTURE_MAP_THEME.clearedBorder,
            textColor: ADVENTURE_MAP_THEME.clearedText,
          }
        : {
            backgroundColor: ADVENTURE_MAP_THEME.lockedCell,
            borderColor: ADVENTURE_MAP_THEME.lockedBorder,
            textColor: ADVENTURE_MAP_THEME.lockedText,
          };

    return (
      <View
        key={index}
        style={[
          styles.mapCell,
          {
            left,
            top,
            width: cell,
            height: cell,
            backgroundColor: palette.backgroundColor,
            borderColor: palette.borderColor,
            borderWidth: active ? 2 : 1,
          },
        ]}
      >
        <View pointerEvents="none" style={styles.mapCellHighlight} />
        <View pointerEvents="none" style={styles.mapCellLabelLayer}>
          <AppText
            preset="speech"
            allowFontScaling={false}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.66}
            style={{
              color: palette.textColor,
              fontFamily: 'Fredoka_500Medium',
              fontSize: Math.max(11, cell * 0.45),
              lineHeight: Math.max(12, cell * 0.48),
              textShadowColor: 'rgba(8, 56, 136, 0.46)',
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 1,
            }}
          >
            {firstLevel + index}
          </AppText>
        </View>
      </View>
    );
  }));

  return (
    <View
      accessible
      accessibilityLabel={`${firstLevel + currentIndex}/${firstLevel + MAP_LEVEL_COUNT - 1}`}
      pointerEvents="none"
      style={{ width, height, position: 'relative' }}
    >
      {cells}
      {currentPosition ? (
        <View
          style={{
            position: 'absolute',
            left: currentPosition.left - cell * 0.39,
            top: currentPosition.top - cell * 1.24,
            zIndex: 8,
            elevation: 8,
          }}
        >
          <CurrentLevelCrystal size={cell * 1.78} />
        </View>
      ) : null}
    </View>
  );
}

export default function AdventureScreen() {
  const router = useRouter();
  const lang = useLang();
  const { width, height } = useWindowDimensions();
  const seasonId = useAdventure((s) => s.seasonId);
  const levelIndex = useAdventure((s) => s.levelIndex);
  const syncSeasonWindow = useAdventure((s) => s.syncSeasonWindow);
  const authToken = useProfileStore((s) => s.authToken);
  const bootstrapRemote = useProfileStore((s) => s.bootstrapRemote);
  const level = absoluteLevelNumber(seasonId, levelIndex);
  const firstLevel = absoluteLevelNumber(seasonId, 0);
  const mapWidth = Math.min(width - 32, 520);
  const compactLayout = width < 280 || height < 500;
  const trophySize = Math.min(90, Math.max(58, Math.min(mapWidth * 0.245, height * 0.14)));
  const heroTop = compactLayout ? 12 : Math.max(22, Math.min(52, height * 0.045));

  useEffect(() => {
    let active = true;
    void (async () => {
      const token = authToken ?? (await bootstrapRemote())?.authToken ?? null;
      if (active && token) await syncSeasonWindow(token);
    })();
    return () => {
      active = false;
    };
  }, [authToken, bootstrapRemote, syncSeasonWindow]);

  const startLevel = () => router.push('/adventure-level' as Href);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <LinearGradient
        colors={[ADVENTURE_MAP_THEME.headerTop, ADVENTURE_MAP_THEME.headerBottom]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('leaderboard.back', lang)}
          hitSlop={12}
          onPress={() => router.replace('/' as Href)}
          style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
        >
          <ChevronIcon size={34} direction="left" color="#F4FAFF" />
        </Pressable>
        <View pointerEvents="none" style={[styles.headerTitleWrap, { maxWidth: Math.max(96, width - 88) }]}>
          <AppText
            preset="speech"
            allowFontScaling={false}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.45}
            style={styles.headerTitle}
          >
            {t('adventure.title', lang)}
          </AppText>
        </View>
      </LinearGradient>

      <View style={styles.stage}>
        <LinearGradient
          pointerEvents="none"
          colors={[ADVENTURE_MAP_THEME.stageTop, ADVENTURE_MAP_THEME.stageBottom]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <ScrollView
          contentContainerStyle={styles.mapScrollContent}
          showsVerticalScrollIndicator={false}
          style={styles.mapScroll}
        >
          <View style={[styles.hero, { marginTop: heroTop }]}>
            <AdventureTrophy size={trophySize} color="#F8FBFF" starColor="#FFE46B" />
            <AppText preset="speech" style={styles.trophyHint}>{t('adventure.trophyHint', lang)}</AppText>
          </View>
          <View style={[styles.mapWrap, compactLayout && styles.mapWrapCompact]}>
            <AdventureLevelMap currentIndex={Math.min(levelIndex, MAP_LEVEL_COUNT - 1)} firstLevel={firstLevel} width={mapWidth} />
          </View>
        </ScrollView>
      </View>

      <View style={[styles.footer, compactLayout && styles.footerCompact]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t('adventure.level', lang)} ${level}`}
          onPress={startLevel}
          style={({ pressed }) => [styles.playButton, pressed && styles.playButtonPressed]}
        >
          <LinearGradient
            colors={['#FFB82B', '#EF8B0D']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={[styles.playButtonFace, compactLayout && styles.playButtonFaceCompact]}
          >
            <AppText preset="speech" style={[styles.playButtonLabel, compactLayout && styles.playButtonLabelCompact]}>
              {t('adventure.level', lang)} {level}
            </AppText>
          </LinearGradient>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: ADVENTURE_MAP_THEME.stageBottom },
  header: {
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderBottomWidth: 3,
    borderBottomColor: 'rgba(255, 255, 255, 0.24)',
    shadowColor: '#0A3C92',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.58,
    shadowRadius: 3,
    elevation: 7,
  },
  backButton: {
    position: 'absolute',
    left: 12,
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonPressed: { opacity: 0.62 },
  headerTitleWrap: {
    zIndex: 1,
    elevation: 1,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontFamily: 'Fredoka_700Bold',
    fontSize: 28,
    textShadowColor: 'rgba(11,23,56,0.72)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 1,
  },
  stage: { flex: 1, overflow: 'hidden' },
  mapScroll: { flex: 1, width: '100%' },
  mapScrollContent: { alignItems: 'center', paddingBottom: 32 },
  hero: { alignItems: 'center', gap: 9 },
  trophyHint: {
    maxWidth: 280,
    color: '#F4FAFF',
    fontFamily: 'Fredoka_500Medium',
    fontSize: 17,
    lineHeight: 22,
    textAlign: 'center',
    textShadowColor: 'rgba(9,57,142,0.56)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 1,
  },
  mapWrap: { marginTop: 26, alignItems: 'center' },
  mapWrapCompact: { marginTop: 14 },
  mapCell: { position: 'absolute', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  mapCellHighlight: {
    position: 'absolute',
    top: 1,
    right: 1,
    left: 1,
    height: '34%',
    backgroundColor: 'rgba(255,255,255,0.16)',
    zIndex: 0,
  },
  mapCellLabelLayer: {
    zIndex: 1,
    elevation: 1,
  },
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
  footer: {
    alignItems: 'center',
    backgroundColor: ADVENTURE_MAP_THEME.footer,
    borderTopWidth: 2,
    borderTopColor: ADVENTURE_MAP_THEME.footerBorder,
    paddingTop: 12,
    paddingBottom: 10,
  },
  footerCompact: {
    paddingTop: 8,
    paddingBottom: 8,
  },
  playButton: {
    width: '60%',
    maxWidth: 300,
    borderRadius: 13,
    backgroundColor: '#A95A06',
    shadowColor: '#8A4506',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.54,
    shadowRadius: 2,
    elevation: 5,
  },
  playButtonPressed: { transform: [{ translateY: 2 }], shadowOpacity: 0.24, elevation: 2 },
  playButtonFace: {
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.42)',
  },
  playButtonFaceCompact: { minHeight: 48 },
  playButtonLabel: {
    color: '#FFFFFF',
    fontFamily: 'Fredoka_700Bold',
    fontSize: 26,
    lineHeight: 31,
    fontStyle: 'italic',
    textShadowColor: 'rgba(111,51,0,0.5)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 1,
  },
  playButtonLabelCompact: {
    fontSize: 20,
    lineHeight: 24,
  },
});
