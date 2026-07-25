import { type Href, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/core/i18n';
import {
  seasonRewardCosmetic,
  FailOverlay,
  JewelBoardLayer,
  JewelIcon,
  LevelResultView,
  LevelUpBanner,
  ObjectivePanel,
  absoluteLevelNumber,
  adventureSkinFor,
  levelFor,
  useAdventure,
} from '@/features/adventure';
import { useAnalyticsStore } from '@/features/analytics';
import {
  BoardView,
  DragProvider,
  EMPTY_MASK,
  PraiseBanner,
  TrayView,
  useGameFeedback,
  useGameStore,
} from '@/features/game';
import type { DragCtx } from '@/features/game';
import { PauseOverlay } from '@/features/game/components/PauseOverlay';
import {
  AdBanner,
  MONETIZATION,
  getAds,
  loadAdsMeta,
  recordAdventureFail,
  recordAdventureLevelWin,
  recordInterstitialShown,
  saveAdsMeta,
  shouldShowInterstitial,
  useEntitlements,
} from '@/features/monetization';
import type { InterstitialCounter } from '@/features/monetization';
import { useMascot } from '@/features/mascot';
import { recordMeaningfulSessionForPush } from '@/features/notifications';
import { useFtueStore } from '@/features/onboarding';
import { useProfileStore } from '@/features/profile';
import { useScores } from '@/features/scores';
import { useLang } from '@/features/settings';
import { todayISO, useStreak } from '@/features/streak';
import { AppText, ConfirmDialog, GearIcon, getBoardMetrics, spacing } from '@/ui';

type Phase = 'playing' | 'levelup' | 'result' | 'failed';
// Рамка BoardView: сетка клеток начинается с этим отступом от угла обёртки,
// оверлей кристаллов обязан учитывать его, иначе джевелы уползают к углу клетки.
const BOARD_FRAME_WIDTH = 6;
// Вертикальный бюджет экрана: доска ужимается так, чтобы хедер, панель цели,
// трей и рекламный баннер поместились без наезда (иначе фигуры трея вылезали
// «под пространство» и на баннер). Значения — приблизительные габариты чрома.
const HEADER_HEIGHT = 56;
const OBJECTIVE_HEIGHT = 76;
const TRAY_HEIGHT = 150;
// Резерв под sticky-баннер Яндекса (реальная высота ~50–90) + запас.
const AD_RESERVE = 108;
// Пауза перед празднованием «уровень пройден»: даём радужному бару цели
// (текущему, не новому) добежать до 100% на глазах у игрока.
const LEVEL_WIN_FILL_MS = 480;
const EMPTY_JEWEL_MARKERS: NonNullable<ReturnType<typeof useGameStore.getState>['adventure']>['jewelsInTray'] = [];

export default function AdventureLevelScreen() {
  const router = useRouter();
  const lang = useLang();
  const gamesPlayed = useScores((state) => state.gamesPlayed);
  const ftueStatus = useFtueStore((state) => state.status);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const seasonId = useAdventure((s) => s.seasonId);
  const levelIndex = useAdventure((s) => s.levelIndex);
  const syncSeasonWindow = useAdventure((s) => s.syncSeasonWindow);
  const authToken = useProfileStore((s) => s.authToken);
  const bootstrapRemote = useProfileStore((s) => s.bootstrapRemote);
  const spec = useMemo(() => levelFor(seasonId, levelIndex), [seasonId, levelIndex]);
  // Скин игровой зоны меняется каждые ADVENTURE_CONFIG.skinEveryLevels уровней по
  // сквозному номеру (спека 17): фон + доска + рамка + цвет блока.
  const skin = useMemo(
    () => adventureSkinFor(absoluteLevelNumber(seasonId, levelIndex)),
    [seasonId, levelIndex],
  );
  const [phase, setPhase] = useState<Phase>('playing');
  const [attempt, setAttempt] = useState(0);
  const [paused, setPaused] = useState(false);
  const [restartOpen, setRestartOpen] = useState(false);
  const [adBusy, setAdBusy] = useState(false);
  const handledOutcome = useRef(false);
  const [wonLevelNumber, setWonLevelNumber] = useState(absoluteLevelNumber(seasonId, levelIndex));
  const removeAds = useEntitlements((s) => s.removeAds);

  const insets = useSafeAreaInsets();
  // Доска ограничена и по ширине (getBoardMetrics), и по вертикальному бюджету:
  // на высоких экранах остаётся крупной (во всю ширину), на низких — ужимается,
  // чтобы трей и баннер не наезжали друг на друга и не уходили за нижний край.
  const usableHeight = Math.max(560, screenHeight - insets.top - insets.bottom);
  const verticalReserve =
    spacing.s + HEADER_HEIGHT + OBJECTIVE_HEIGHT + spacing.l + BOARD_FRAME_WIDTH * 2 +
    TRAY_HEIGHT + spacing.s + AD_RESERVE;
  const boardSizeMax = Math.max(240, usableHeight - verticalReserve);
  const { boardSize, cellGap: baseCellGap } = getBoardMetrics(screenWidth, boardSizeMax);
  const cellGap = Math.min(baseCellGap, 2);
  const cellSize = (boardSize - cellGap * 7) / 8;
  const geom = useMemo(() => ({ boardSize, cell: cellSize, gap: cellGap, pad: 0 }), [boardSize, cellGap, cellSize]);
  // Реальный слот трея: он центрирован (maxWidth 390) внутри горизонтального
  // паддинга контента, поэтому фактическая ширина слота уже, чем (экран−16)/3.
  // Передаём её и высоту трея в drag-контекст, чтобы фигуры не налезали на
  // соседей (ширина) и не вылезали за трей (высота).
  const trayOuterWidth = Math.min(screenWidth - spacing.m * 2, 390);
  const traySlotWidth = (trayOuterWidth - 16) / 3;
  const trayFit = useMemo(
    () => ({ slotWidth: traySlotWidth, slotHeight: TRAY_HEIGHT }),
    [traySlotWidth],
  );
  const boardOrigin = useSharedValue({ x: 0, y: 0 });
  const boardMeasureRef = useRef<(() => void) | null>(null);
  const boardMirror = useSharedValue<number[]>(new Array(64).fill(0));
  const preview = useSharedValue<number[]>(EMPTY_MASK);
  const previewColor = useSharedValue(0);
  const dragActive = useSharedValue(0);
  const dragOwner = useSharedValue(-1);
  const { onGrab, onInvalidDrop } = useGameFeedback();
  const tray = useGameStore((s) => s.game.tray);
  const gameEpoch = useGameStore((s) => s.epoch);
  const runStatus = useGameStore((s) => s.adventure?.status);
  const jewelMarkers = useGameStore((s) => s.adventure?.jewelsInTray ?? EMPTY_JEWEL_MARKERS);

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

  useEffect(() => {
    if (phase !== 'playing') return;
    handledOutcome.current = false;
    const store = useGameStore.getState();
    const current = store.adventure;
    if (
      current?.status === 'playing' &&
      current.attempt === attempt &&
      current.level.seasonId === spec.seasonId &&
      current.level.levelIndex === spec.levelIndex &&
      current.level.objective.type === spec.objective.type &&
      current.level.objective.target === spec.objective.target
    ) {
      return;
    }
    // Холодный вход (процесс убит или экран размонтирован системной «назад»):
    // сперва пробуем продолжить сохранённый ран этого же уровня (FR-7).
    if (!current) {
      const resumed = store.resumeSavedAdventure(spec);
      if (resumed) {
        if (resumed.attempt !== attempt) {
          setTimeout(() => setAttempt(resumed.attempt), 0);
        }
        return;
      }
    }
    store.newAdventureGame(spec, attempt);
  }, [attempt, phase, spec]);

  // Системная кнопка «назад» минует exitToHub: отцепляем ран от стора, чтобы
  // Endless-партия не продолжила играть по adventure-доске. Снапшот в MMKV
  // остаётся — уровень восстановится при следующем входе.
  useEffect(() => () => useGameStore.getState().suspendAdventure(), []);

  useEffect(() => {
    if (!runStatus || runStatus === 'playing' || handledOutcome.current) return;
    const state = useGameStore.getState().adventure;
    if (!state) return;
    // Исход читаем СВЕЖИМ из стора, а не из render-захваченного runStatus:
    // recordWin двигает levelIndex → spec пересчитывается → стартовый эффект
    // выше в ЭТОМ ЖЕ коммите сбрасывает handledOutcome и пересоздаёт ран
    // следующего уровня. Устаревший runStatus='won' при совпавшем уровне
    // свежего рана записывал победу дважды (счётчики ×2, скип уровней).
    if (state.status === 'playing') return;
    if (state.level.seasonId !== spec.seasonId || state.level.levelIndex !== spec.levelIndex) return;
    handledOutcome.current = true;

    if (state.status === 'won') {
      const completedLevelNumber = absoluteLevelNumber(state.level.seasonId, state.level.levelIndex);
      saveAdsMeta(recordAdventureLevelWin(loadAdsMeta()));
      useAdventure.getState().recordWin(todayISO());
      useStreak.getState().markPlayedToday();
      const sessionId = useAnalyticsStore.getState().context?.session_id;
      if (sessionId) recordMeaningfulSessionForPush(sessionId);
      useAnalyticsStore.getState().track('adventure_level_win', {
        seasonId: state.level.seasonId,
        levelIndex: state.level.levelIndex,
        attempt: state.attempt,
        consecutive: useAdventure.getState().consecutive,
      });
      const completedSeason = useAdventure.getState().lastWinCompletedSeason;
      if (completedSeason !== null) {
        useAnalyticsStore.getState().track('adventure_season_complete', { seasonId: state.level.seasonId });
        // Сезонная награда — эксклюзивная косметика Капи (retention фаза 3).
        const seasonCosmetic = seasonRewardCosmetic(completedSeason);
        if (seasonCosmetic !== null) {
          useMascot.getState().unlock(seasonCosmetic);
          useAnalyticsStore.getState().track('season_reward_granted', {
            seasonId: completedSeason,
            cosmeticId: seasonCosmetic,
          });
        }
      }
      // Не открываем празднование сразу: сперва радужный бар цели (текущий,
      // тот же что весь уровень) добегает до 100% на глазах у игрока, и только
      // потом — конфетти. Никакого нового прогресс-бара.
      setTimeout(() => {
        setWonLevelNumber(completedLevelNumber);
        setPhase('levelup');
      }, LEVEL_WIN_FILL_MS);
    } else {
      saveAdsMeta(recordAdventureFail(loadAdsMeta()));
      useAdventure.getState().recordFail();
      useAnalyticsStore.getState().track('adventure_level_fail', {
        seasonId: state.level.seasonId,
        levelIndex: state.level.levelIndex,
        attempt: state.attempt,
      });
      setTimeout(() => setPhase('failed'), 0);
    }
  }, [runStatus, spec.levelIndex, spec.seasonId]);

  const onDrop = useCallback(
    (trayIndex: number, row: number, col: number) =>
      useGameStore.getState().placePiece(trayIndex, row, col) !== null,
    [],
  );

  const dragCtx: DragCtx = useMemo(
    () => ({
      geom,
      trayFit,
      boardOrigin,
      boardMeasureRef,
      boardMirror,
      preview,
      previewColor,
      dragActive,
      dragOwner,
      cellColors: [skin.blockColor],
      boardBg: skin.boardBg,
      cellEmpty: skin.cellEmpty,
      cellRadius: 3,
      onDrop,
      onGrab,
      onInvalidDrop,
    }),
    // Shared values are stable; реактивные входы — геометрия, скин и колбэки.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [geom, trayFit, skin, onDrop, onGrab, onInvalidDrop],
  );

  const exitToHub = useCallback(() => {
    useGameStore.getState().exitAdventure();
    router.replace('/adventure' as Href);
  }, [router]);

  const exitToHome = useCallback(() => {
    useGameStore.getState().exitAdventure();
    router.replace('/' as Href);
  }, [router]);

  const startCurrentLevel = useCallback(
    (nextAttempt = 0) => {
      useGameStore.getState().newAdventureGame(spec, nextAttempt);
    },
    [spec],
  );

  const confirmRestart = useCallback(() => {
    setPaused(false);
    setRestartOpen(true);
  }, []);

  const restartCurrentLevel = useCallback(() => {
    setRestartOpen(false);
    setAttempt((currentAttempt) => {
      const nextAttempt = currentAttempt + 1;
      startCurrentLevel(nextAttempt);
      return nextAttempt;
    });
  }, [startCurrentLevel]);

  const runAfterInterstitial = useCallback(
    async (counter: InterstitialCounter, after: () => void) => {
      if (adBusy) return;
      setAdBusy(true);
      try {
        const meta = loadAdsMeta();
        const show = shouldShowInterstitial(
          meta,
          {
            enabled: MONETIZATION.adsEnabled,
            removeAds,
            nowMs: Date.now(),
          },
          counter,
        );
        if (show) {
          const result = await getAds().showInterstitial(counter);
          if (result === 'shown') {
            saveAdsMeta(recordInterstitialShown(meta, Date.now(), counter));
          }
        }
      } finally {
        setAdBusy(false);
        after();
      }
    },
    [adBusy, removeAds],
  );

  if (phase === 'result') {
    return (
      <LevelResultView
        disabled={adBusy}
        onNext={() => void runAfterInterstitial('adventure_level', () => {
          startCurrentLevel(0);
          setAttempt(0);
          setPhase('playing');
        })}
        onExit={() => void runAfterInterstitial('adventure_level', exitToHub)}
      />
    );
  }

  return (
    <DragProvider value={dragCtx}>
      <SafeAreaView style={{ flex: 1, backgroundColor: skin.bgBottom }} edges={['top', 'bottom']}>
        <LinearGradient
          colors={[skin.bgTop, skin.bgBottom]}
          style={{ position: 'absolute', inset: 0 }}
        />
        <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: spacing.m, paddingTop: spacing.s }}>
          <View style={{ width: '100%', maxWidth: 390, height: 56, position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
            <View
              pointerEvents="none"
              style={{
                maxWidth: 205,
                minHeight: 42,
                paddingHorizontal: 14,
                borderRadius: 18,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(255,226,191,0.16)',
                borderWidth: 1,
                borderColor: 'rgba(255,238,210,0.38)',
              }}
            >
              <AppText preset="speech" numberOfLines={1} style={{ color: '#FFF6E9', fontFamily: 'Fredoka_700Bold', fontSize: 16 }}>
                {t('adventure.title', lang)} · {absoluteLevelNumber(seasonId, levelIndex)}
              </AppText>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('settings.title', lang)}
              hitSlop={14}
              onPress={() => setPaused(true)}
              style={({ pressed }) => [{
                position: 'absolute',
                right: 0,
                width: 48,
                height: 48,
                borderRadius: 18,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(107, 60, 33, 0.66)',
                borderWidth: 1,
                borderColor: 'rgba(255,238,210,0.42)',
                opacity: pressed ? 0.7 : 1,
              }]}
            >
              <GearIcon size={31} color="#FFEADA" />
            </Pressable>
          </View>

          <ObjectivePanel />

          <View
            key={`${spec.id}-${attempt}-${gameEpoch}`}
            style={{
              position: 'relative',
              marginTop: spacing.l,
              // ТОЛЬКО iOS-тень. Никакого elevation на обёртке доски: на Android
              // elevation поднимает всю доску над треем (он — следующий сосед), и
              // фигура при перетаскивании уезжает ЗА полотно. Endless не ставит
              // elevation на доску — именно поэтому там этого бага нет.
              shadowColor: skin.boardShadow,
              shadowOffset: { width: 0, height: 5 },
              shadowOpacity: 0.28,
              shadowRadius: 6,
            }}
          >
            {/* Рамка доски — ровное кольцо со всех сторон через padding+фон.
                Раньше рамка задавалась бордюром на самом BoardView, но его
                внутренний слой в полный boardSize перекрывал бордюр по правому и
                нижнему краю — коричневая рамка оставалась видна только в углах. */}
            <View
              style={{
                padding: BOARD_FRAME_WIDTH,
                borderRadius: 10 + BOARD_FRAME_WIDTH,
                backgroundColor: skin.boardFrame,
                borderWidth: 2,
                borderColor: 'rgba(255, 239, 211, 0.38)',
              }}
            >
              <BoardView style={{ borderRadius: 10 }} />
            </View>
            <JewelBoardLayer cell={cellSize} gap={cellGap} offset={BOARD_FRAME_WIDTH} />
            <PraiseBanner />
          </View>

          <View style={{ width: '100%', maxWidth: 390, height: TRAY_HEIGHT, marginTop: 'auto', marginBottom: spacing.s, position: 'relative' }}>
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: 8,
                right: 8,
                top: 14,
                bottom: 10,
                borderRadius: 28,
                backgroundColor: 'rgba(91, 49, 29, 0.28)',
                borderWidth: 1,
                borderColor: 'rgba(255, 234, 202, 0.26)',
              }}
            />
            <TrayView
              tray={tray}
              style={{ width: '100%', height: '100%' }}
              renderPieceCellOverlay={(slot, cellIndex, size) =>
                jewelMarkers.some((m) => m.slot === slot && m.cell === cellIndex) ? (
                  <View pointerEvents="none" style={{ position: 'absolute', inset: 0 }}>
                    <JewelIcon size={size} />
                  </View>
                ) : null
              }
            />
          </View>
        </View>

        {phase === 'levelup' ? (
          <LevelUpBanner fromLevel={wonLevelNumber - 1} onDone={() => setPhase('result')} />
        ) : null}
        {phase === 'failed' ? (
          <FailOverlay
            disabled={adBusy}
            onRetry={() => void runAfterInterstitial('adventure_fail', () => {
              setAttempt((value) => {
                const nextAttempt = value + 1;
                startCurrentLevel(nextAttempt);
                return nextAttempt;
              });
              setPhase('playing');
            })}
            onExit={() => void runAfterInterstitial('adventure_fail', exitToHub)}
          />
        ) : null}
        <AdBanner
          placement="game"
          ftueComplete={ftueStatus === 'complete' || ftueStatus === 'skipped'}
          gamesPlayed={gamesPlayed}
        />

        {paused ? (
          <PauseOverlay
            onClose={() => setPaused(false)}
            onRestart={confirmRestart}
            onHome={exitToHome}
          />
        ) : null}

        <ConfirmDialog
          visible={restartOpen}
          title={t('pause.restart', lang)}
          message={t('home.newGameConfirm', lang)}
          confirmLabel={t('pause.restart', lang)}
          cancelLabel={t('settings.cancel', lang)}
          destructive
          onConfirm={restartCurrentLevel}
          onCancel={() => setRestartOpen(false)}
        />
      </SafeAreaView>
    </DragProvider>
  );
}
