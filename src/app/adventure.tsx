import { type Href, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KEYS, getJSON, setJSON } from '@/core/storage';
import {
  recordNotificationTargetAction,
  recordNotificationTargetViewed,
} from '@/features/analytics';
import {
  absoluteLevelNumber,
  levelFor,
  useAdventure,
} from '@/features/adventure';
import { getSavedAdventureSummary } from '@/features/game/store';
import { useLang } from '@/features/settings';
import {
  AppText,
  BottomNav,
  CandyBackground,
  CandyCapy,
  CandyIcon,
  CandyProgress,
  GameButton,
  nightCandy as n,
} from '@/ui';
import { CandyChip, CandyRoundButton } from '@/ui/primitives/CandyControls';

// The supplied first 21 nodes continue upward with the same authored tower rhythm.
const MAP_ROWS = [
  ...Array.from({ length: 4 }, () => [
    { offset: 0, count: 5 },
    { offset: 1, count: 5 },
    { offset: 0, count: 4 },
    { offset: 1, count: 4 },
    { offset: 0.5, count: 3 },
  ]).flat(),
  { offset: 0, count: 5 },
  { offset: 1, count: 4 },
  { offset: 0.5, count: 3 },
];
const MAP_LEVEL_COUNT = 96;
interface AdventureMapScrollState {
  version: 7;
  seasonId: number;
  levelIndex: number;
  offsetY: number;
}

export function adventureMapCellPosition(index: number, width: number) {
  // The widest staggered row spans 394 design pixels, including its inset.
  // Fit the entire tower, not just the currently selected node, into the viewport.
  const step = width * 66 / 400;
  const cell = (step * 58) / 66;
  let cursor = 0;
  for (let row = 0; row < MAP_ROWS.length; row++) {
    const spec = MAP_ROWS[row];
    for (let col = 0; col < spec.count; col++) {
      if (cursor++ === index)
        return {
          left: step * (spec.offset + col) + (step * 6) / 66,
          top: (MAP_ROWS.length - 1 - row) * (step + (step * 8) / 66),
          cell,
        };
    }
  }
  return null;
}

function AdventureLevelMap({
  currentIndex,
  firstLevel,
  width,
  onPlay,
}: {
  currentIndex: number;
  firstLevel: number;
  width: number;
  onPlay: () => void;
}) {
  const top = adventureMapCellPosition(0, width)!;
  return (
    <View
      style={{
        width,
        height: top.top + top.cell + 24,
        position: 'relative',
      }}
    >
      {Array.from({ length: MAP_LEVEL_COUNT }, (_, index) => {
        const position = adventureMapCellPosition(index, width)!;
        const active = index === currentIndex;
        const cleared = index < currentIndex;
        const chest = (firstLevel + index) % 10 === 0;
        const color = active ? n.sun : cleared ? n.mint : n.night950;
        return (
          <Pressable
            key={index}
            disabled={!active}
            accessible
            accessibilityRole="button"
            accessibilityLabel={`${firstLevel + index}${active ? ', текущий уровень' : cleared ? ', пройден' : ', закрыт'}`}
            accessibilityState={{ disabled: !active }}
            onPress={onPlay}
            style={{
              position: 'absolute',
              zIndex: active ? 2 : 0,
              left: position.left,
              top: position.top,
              width: position.cell,
              height: position.cell,
              borderRadius: 18,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: color,
              borderWidth: active || cleared ? 0 : 2,
              borderStyle: active || cleared ? 'solid' : 'dashed',
              borderColor: chest ? n.mandarin : 'rgba(157,166,240,0.4)',
              boxShadow: active
                ? '0px 6px 0px #D99A00, 0px 0px 0px 4px rgba(255,201,60,0.35), 0px 0px 28px rgba(255,201,60,0.5)'
                : cleared
                  ? '0px 6px 0px #149E6E'
                  : 'none',
            }}
          >
            {active || cleared ? (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 4,
                  borderTopLeftRadius: 18,
                  borderTopRightRadius: 18,
                  backgroundColor: 'rgba(255,255,255,0.5)',
                }}
              />
            ) : null}
            {chest && !active && !cleared ? (
              <>
                <CandyIcon name="chest" size={28} color={n.mandarin} />
                <View
                  style={{
                    position: 'absolute',
                    bottom: -7,
                    backgroundColor: n.mandarin,
                    borderRadius: 99,
                    paddingHorizontal: 8,
                  }}
                >
                  <AppText
                    style={{ fontFamily: 'Nunito_900Black', fontSize: 12, color: '#3A1600' }}
                  >
                    {firstLevel + index}
                  </AppText>
                </View>
              </>
            ) : (
              <AppText
                style={{
                  fontFamily: 'Unbounded_900Black',
                  fontSize: 21,
                  color: active ? n.sunInk : cleared ? '#064530' : n.muted,
                }}
              >
                {firstLevel + index}
              </AppText>
            )}
            {active ? (
              <View pointerEvents="none" style={{ position: 'absolute', top: -43 }}>
                <CandyCapy size={44} />
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export default function AdventureScreen() {
  const router = useRouter();
  const lang = useLang();
  const ru = lang === 'ru';
  const { width, height } = useWindowDimensions();
  const seasonId = useAdventure((s) => s.seasonId);
  const levelIndex = useAdventure((s) => s.levelIndex);
  useEffect(() => {
    recordNotificationTargetViewed('/adventure');
  }, []);
  const level = absoluteLevelNumber(seasonId, levelIndex);
  const firstLevel = absoluteLevelNumber(seasonId, 0);
  const mapWidth = Math.min(width - 32, 520);
  const currentMapIndex = Math.min(levelIndex, MAP_LEVEL_COUNT - 1);
  const chapter = Math.floor((level - 1) / 12) + 1;
  const parts = levelIndex % 12;
  const spec = levelFor(seasonId, levelIndex);
  const saved = getSavedAdventureSummary();
  const canContinue = saved.kind === 'active' &&
    saved.seasonId === seasonId && saved.levelIndex === levelIndex;
  const compactResume = canContinue && width < 440;
  const objective =
    saved.kind === 'active' &&
    saved.seasonId === seasonId &&
    saved.levelIndex === levelIndex &&
    saved.objectiveType &&
    saved.objectiveTarget != null
      ? { type: saved.objectiveType, target: saved.objectiveTarget }
      : spec.objective;
  const mapScrollRef = useRef<ScrollView>(null);
  const mapTopRef = useRef<number | null>(null);
  const viewportHeightRef = useRef(0);
  const contentHeightRef = useRef(0);
  const manualScrollStartedRef = useRef(false);
  const [initialContentOffset] = useState(() => {
    const saved = getJSON<AdventureMapScrollState>(KEYS.adventureMapScroll);
    const position = adventureMapCellPosition(currentMapIndex, mapWidth);
    const estimatedViewportHeight = Math.max(1, height - 350);
    const estimatedMapTop = 20;
    return saved?.version === 7 && saved.seasonId === seasonId && saved.levelIndex === levelIndex
      ? saved.offsetY
      : Math.max(
          0,
          estimatedMapTop +
            (position?.top ?? 0) -
            estimatedViewportHeight +
            (position?.cell ?? 0) +
            16,
        );
  });

  const startLevel = () => {
    recordNotificationTargetAction('start_adventure_level');
    router.push('/adventure-level' as Href);
  };

  const scrollToCurrentOrSaved = useCallback(() => {
    if (manualScrollStartedRef.current) return;
    requestAnimationFrame(() => {
      if (
        manualScrollStartedRef.current ||
        mapTopRef.current === null ||
        viewportHeightRef.current <= 0 ||
        contentHeightRef.current <= 0
      )
        return;
      const saved = getJSON<AdventureMapScrollState>(KEYS.adventureMapScroll);
      const position = adventureMapCellPosition(currentMapIndex, mapWidth);
      if (!position) return;
      const desired =
        saved?.version === 7 && saved.seasonId === seasonId && saved.levelIndex === levelIndex
          ? saved.offsetY
          : mapTopRef.current + position.top - viewportHeightRef.current + position.cell + 16;
      const maxOffset = Math.max(0, contentHeightRef.current - viewportHeightRef.current);
      mapScrollRef.current?.scrollTo({
        y: Math.max(0, Math.min(maxOffset, desired)),
        animated: false,
      });
    });
  }, [currentMapIndex, levelIndex, mapWidth, seasonId]);

  useEffect(() => {
    manualScrollStartedRef.current = false;
    scrollToCurrentOrSaved();
  }, [levelIndex, scrollToCurrentOrSaved, seasonId]);

  const persistMapOffset = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      setJSON(KEYS.adventureMapScroll, {
        version: 7,
        seasonId,
        levelIndex,
        offsetY: Math.max(0, event.nativeEvent.contentOffset.y),
      } satisfies AdventureMapScrollState);
    },
    [levelIndex, seasonId],
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: n.night900 }} edges={['top']}>
      <CandyBackground />
      <View style={styles.header}>
        <CandyRoundButton
          icon="back"
          label={ru ? 'Назад' : 'Back'}
          onPress={() => router.replace('/')}
        />
        <AppText numberOfLines={1} adjustsFontSizeToFit style={styles.title}>
          {ru ? 'Приключение' : 'Adventure'}
        </AppText>
        <CandyChip icon="flag" color={n.mint} label={`${ru ? 'Ур.' : 'Lv.'} ${level}`} />
      </View>
      <View style={styles.chapter}>
        <CandyIcon name="trophy" color={n.sun} size={26} />
        <View style={{ flex: 1, gap: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <AppText style={styles.chapterText}>
              {ru ? `Глава ${chapter} · картина` : `Chapter ${chapter} · picture`}
            </AppText>
            <AppText style={[styles.chapterText, { color: n.lavender }]}>{parts} / 12</AppText>
          </View>
          <CandyProgress value={parts / 12} color={n.mint} height={10} />
          <AppText style={{ color: n.muted, fontFamily: 'Nunito_700Bold', fontSize: 12 }}>
            {ru ? 'Следующий уровень — после победы. Прогресс сохраняется.' : 'Win to unlock the next level. Your progress stays.'}
          </AppText>
        </View>
      </View>
      <ScrollView
        ref={mapScrollRef}
        contentOffset={{ x: 0, y: initialContentOffset }}
        contentContainerStyle={{ alignItems: 'center', paddingTop: 20, paddingBottom: 12 }}
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
        onLayout={(event) => {
          viewportHeightRef.current = event.nativeEvent.layout.height;
          scrollToCurrentOrSaved();
        }}
        onContentSizeChange={(_width, contentHeight) => {
          contentHeightRef.current = contentHeight;
          scrollToCurrentOrSaved();
        }}
        onScrollEndDrag={persistMapOffset}
        onMomentumScrollEnd={persistMapOffset}
        onScrollBeginDrag={() => {
          manualScrollStartedRef.current = true;
        }}
      >
        <View
          onLayout={(event) => {
            mapTopRef.current = event.nativeEvent.layout.y;
            scrollToCurrentOrSaved();
          }}
        >
          <AdventureLevelMap
            currentIndex={currentMapIndex}
            firstLevel={firstLevel}
            width={mapWidth}
            onPlay={startLevel}
          />
        </View>
      </ScrollView>
      <View style={[styles.footer, compactResume && { flexDirection: 'column', alignItems: 'stretch' }]}>
        <View style={{ flex: compactResume ? 0 : 1, gap: 4 }}>
          <AppText style={{ fontFamily: 'Unbounded_900Black', fontSize: 20 }}>
            {ru ? 'Уровень' : 'Level'} {level}
          </AppText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <CandyIcon
              name={objective.type === 'jewels' ? 'gem' : 'chart'}
              color={n.sky}
              size={16}
            />
            <AppText
              style={{
                color: n.lavender,
                fontFamily: 'Nunito_900Black',
                fontSize: 14,
                flexShrink: 1,
              }}
            >
              {ru
                ? objective.type === 'jewels'
                  ? `Собери ${objective.target} кристаллов`
                  : `Набери ${objective.target} очков`
                : `Target: ${objective.target}`}
            </AppText>
          </View>
        </View>
        <GameButton
          label={canContinue ? (ru ? 'Продолжить' : 'Continue') : (ru ? 'Играть' : 'Play')}
          onPress={startLevel}
          icon={<CandyIcon name="play" color={n.sunInk} size={20} />}
        />
      </View>
      <BottomNav active="adventure" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    width: '100%',
    maxWidth: 552,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  title: { flex: 1, fontFamily: 'Unbounded_900Black', fontSize: 22, letterSpacing: -0.22 },
  chapter: {
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: n.border,
    borderRadius: 22,
    backgroundColor: 'rgba(7,10,42,0.5)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  chapterText: { fontFamily: 'Nunito_900Black', fontSize: 14 },
  footer: {
    margin: 16,
    marginTop: 12,
    marginBottom: 24,
    padding: 16,
    borderRadius: 24,
    backgroundColor: n.night800,
    borderWidth: 2,
    borderColor: 'rgba(255,201,60,0.45)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
