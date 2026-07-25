import { type Href, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { t } from '@/core/i18n';
import { absoluteLevelNumber, useAdventure } from '@/features/adventure';
import { useProfileStore } from '@/features/profile';
import { useLang } from '@/features/settings';
import { AppText, ChevronIcon } from '@/ui';

const MENU_BLUE = '#4D67C8';
const ADVENTURE_BLUE = '#384D86';
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
            backgroundColor: active ? '#FFDA3C' : cleared ? '#354979' : '#2E4175',
            borderColor: active ? '#FFFFFF' : '#1D2D58',
            borderWidth: active ? 2 : 1,
          },
        ]}
      >
        <AppText
          preset="speech"
          style={{
            color: active ? '#795000' : cleared ? '#7C8DBC' : '#6879AA',
            fontFamily: 'Fredoka_500Medium',
            fontSize: Math.max(11, cell * 0.45),
            lineHeight: Math.max(12, cell * 0.48),
          }}
        >
          {firstLevel + index}
        </AppText>
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
            left: currentPosition.left - cell * 0.08,
            top: currentPosition.top - cell * 0.55,
          }}
        >
          <AdventureTrophy size={cell * 0.82} color="#FFE046" starColor="#C27A08" />
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
  const trophySize = Math.min(90, Math.max(72, mapWidth * 0.245));
  const heroTop = Math.max(22, Math.min(52, height * 0.045));

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
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('leaderboard.back', lang)}
          hitSlop={12}
          onPress={() => router.replace('/' as Href)}
          style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
        >
          <ChevronIcon size={34} direction="left" color="#C9F1FF" />
        </Pressable>
        <AppText preset="speech" style={styles.headerTitle}>{t('adventure.title', lang)}</AppText>
      </View>

      <View style={styles.stage}>
        <View style={[styles.hero, { marginTop: heroTop }]}>
          <AdventureTrophy size={trophySize} color="#132753" starColor="#0D1B3B" />
          <AppText preset="speech" style={styles.trophyHint}>{t('adventure.trophyHint', lang)}</AppText>
        </View>
        <View style={styles.mapWrap}>
          <AdventureLevelMap currentIndex={Math.min(levelIndex, MAP_LEVEL_COUNT - 1)} firstLevel={firstLevel} width={mapWidth} />
        </View>
      </View>

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t('adventure.level', lang)} ${level}`}
          onPress={startLevel}
          style={({ pressed }) => [styles.playButton, pressed && styles.playButtonPressed]}
        >
          <LinearGradient colors={['#42E21D', '#18A80B']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.playButtonFace}>
            <AppText preset="speech" style={styles.playButtonLabel}>{t('adventure.level', lang)} {level}</AppText>
          </LinearGradient>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: MENU_BLUE },
  header: {
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MENU_BLUE,
    borderBottomWidth: 3,
    borderBottomColor: '#1D3968',
    shadowColor: '#152D63',
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
  headerTitle: {
    color: '#FFFFFF',
    fontFamily: 'Fredoka_700Bold',
    fontSize: 28,
    textShadowColor: 'rgba(11,23,56,0.72)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 1,
  },
  stage: { flex: 1, alignItems: 'center', backgroundColor: ADVENTURE_BLUE, overflow: 'hidden' },
  hero: { alignItems: 'center', gap: 9 },
  trophyHint: {
    maxWidth: 280,
    color: '#EEF4FF',
    fontFamily: 'Fredoka_500Medium',
    fontSize: 17,
    lineHeight: 22,
    textAlign: 'center',
    textShadowColor: 'rgba(11,24,60,0.46)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 1,
  },
  mapWrap: { marginTop: 26, alignItems: 'center' },
  mapCell: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  footer: {
    alignItems: 'center',
    backgroundColor: MENU_BLUE,
    borderTopWidth: 2,
    borderTopColor: '#8199EC',
    paddingTop: 12,
    paddingBottom: 10,
  },
  playButton: {
    width: '60%',
    maxWidth: 300,
    borderRadius: 7,
    backgroundColor: '#087E0B',
    shadowColor: '#1B2A57',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.54,
    shadowRadius: 2,
    elevation: 5,
  },
  playButtonPressed: { transform: [{ translateY: 2 }], shadowOpacity: 0.24, elevation: 2 },
  playButtonFace: {
    minHeight: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#7EFF62',
  },
  playButtonLabel: {
    color: '#FFFFFF',
    fontFamily: 'Fredoka_700Bold',
    fontSize: 26,
    lineHeight: 31,
    textShadowColor: 'rgba(4,83,11,0.72)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 1,
  },
});
