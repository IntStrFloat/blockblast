import { useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { t } from '@/core/i18n';
import { MascotFigure } from '@/features/mascot';
import { useLang } from '@/features/settings';
import { WORLD_THEMES } from '@/features/themes';
import { AppText, GameButton, colors, mascotPalette, radii, spacing } from '@/ui';

import { useOnboarding } from '../store';

const STEPS = ['level', 'worlds', 'map', 'daily', 'capi'] as const;
type StepId = (typeof STEPS)[number];

/**
 * Одноразовый онбординг меты при первом заходе после обновления (спека 10):
 * красиво представляет Уровень Игры, миры, карту достижений, дейли-бонус и Капи.
 * Само-гейтится по флагу `seen`; уважает reduce-motion. CTA листает шаги и закрывает.
 */
export function OnboardingOverlay() {
  const seen = useOnboarding((s) => s.seen);
  const lang = useLang();
  const [step, setStep] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  if (seen) return null;

  const id = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const finish = () => useOnboarding.getState().markSeen();
  const next = () => (isLast ? finish() : setStep((s) => s + 1));

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeIn.duration(220)}
      style={styles.scrim}
      pointerEvents="auto"
    >
      <Animated.View
        entering={reduceMotion ? undefined : FadeInDown.springify().damping(16)}
        style={styles.card}
      >
        <Pressable style={styles.skip} onPress={finish} hitSlop={8} accessibilityRole="button">
          <AppText preset="caption" style={{ color: colors.textDim }}>
            {t('onboarding.skip', lang)}
          </AppText>
        </Pressable>

        <View style={styles.stage}>
          <Animated.View
            key={`art-${id}`}
            entering={reduceMotion ? undefined : FadeIn.duration(260)}
            style={styles.stageInner}
          >
            <StepArt id={id} reduceMotion={reduceMotion} />
          </Animated.View>
        </View>

        <Animated.View
          key={`text-${id}`}
          entering={reduceMotion ? undefined : FadeInDown.duration(260)}
          style={styles.textBox}
        >
          <AppText preset="title" style={styles.title}>
            {t(`onboarding.${id}Title`, lang)}
          </AppText>
          <AppText preset="body" style={styles.body}>
            {t(`onboarding.${id}Body`, lang)}
          </AppText>
        </Animated.View>

        <View style={styles.dots}>
          {STEPS.map((s, i) => (
            <View key={s} style={[styles.dot, i === step && styles.dotActive]} />
          ))}
        </View>

        <GameButton
          label={isLast ? t('onboarding.start', lang) : t('onboarding.next', lang)}
          onPress={next}
        />
      </Animated.View>
    </Animated.View>
  );
}

function StepArt({ id, reduceMotion }: { id: StepId; reduceMotion: boolean }) {
  switch (id) {
    case 'level':
      return <LevelArt reduceMotion={reduceMotion} />;
    case 'worlds':
      return <WorldsArt />;
    case 'map':
      return <MapArt />;
    case 'daily':
      return <DailyArt />;
    case 'capi':
      return <CapiArt reduceMotion={reduceMotion} />;
  }
}

// --- Уровень Игры: пилюля уровня + наполняющийся бар очков ---
function LevelArt({ reduceMotion }: { reduceMotion: boolean }) {
  const fill = useSharedValue(reduceMotion ? 0.74 : 0);
  useEffect(() => {
    if (!reduceMotion) fill.value = withDelay(220, withTiming(0.74, { duration: 900 }));
  }, [reduceMotion, fill]);
  const barStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));

  return (
    <View style={art.levelWrap}>
      <View style={art.levelPill}>
        <AppText preset="score" style={art.levelNumber}>
          7
        </AppText>
      </View>
      <View style={art.barTrack}>
        <Animated.View style={[art.barFill, barStyle]} />
      </View>
      <AppText preset="button" style={{ color: colors.accent }}>
        +250
      </AppText>
    </View>
  );
}

// --- Миры: ряд палитр-превью ---
function WorldsArt() {
  return (
    <View style={art.worldsRow}>
      {WORLD_THEMES.slice(0, 5).map((theme, i) => (
        <Animated.View
          key={theme.id}
          entering={FadeInDown.delay(i * 70).springify().damping(15)}
          style={art.swatch}
        >
          {theme.cellColors.slice(0, 4).map((c) => (
            <View key={c} style={[art.swatchDot, { backgroundColor: c }]} />
          ))}
        </Animated.View>
      ))}
    </View>
  );
}

// --- Карта: дорога узлов уровней/миров ---
function MapArt() {
  const nodes = [0, 1, 2, 3, 4, 5];
  return (
    <View style={art.road}>
      {nodes.map((i) => {
        const reached = i <= 2;
        const current = i === 2;
        const world = i === 4;
        return (
          <View key={i} style={art.roadItem}>
            {i > 0 ? (
              <View
                style={[art.roadLine, { backgroundColor: reached ? colors.accent : colors.surface }]}
              />
            ) : null}
            <Animated.View
              entering={FadeInDown.delay(i * 70)}
              style={[
                art.node,
                {
                  width: world ? 24 : 15,
                  height: world ? 24 : 15,
                  borderRadius: world ? 12 : 8,
                  backgroundColor: world ? '#B36BFF' : reached ? colors.accent : colors.cellEmpty,
                  borderWidth: current ? 2 : 0,
                  borderColor: colors.textPrimary,
                },
              ]}
            />
          </View>
        );
      })}
    </View>
  );
}

// --- Дейли: лесенка стрика + множитель ---
function DailyArt() {
  return (
    <View style={art.dailyWrap}>
      <View style={art.ladder}>
        {[1, 2, 3, 4, 5, 6, 7].map((d) => (
          <Animated.View
            key={d}
            entering={FadeInDown.delay(d * 55)}
            style={[art.rung, { backgroundColor: d <= 5 ? colors.accent : colors.surface }]}
          />
        ))}
      </View>
      <View style={art.multBadge}>
        <AppText preset="button" style={{ color: '#1B2A4A' }}>
          ×2.5
        </AppText>
      </View>
    </View>
  );
}

// --- Капи: фигура с лёгким «дыханием» ---
function CapiArt({ reduceMotion }: { reduceMotion: boolean }) {
  const scale = useSharedValue(1);
  useEffect(() => {
    if (!reduceMotion) {
      scale.value = withRepeat(
        withSequence(withTiming(1.06, { duration: 760 }), withTiming(1, { duration: 760 })),
        -1,
        true,
      );
    }
  }, [reduceMotion, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[art.capiWrap, style]}>
      <MascotFigure stage={4} size={104} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlayScrim,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.l,
    zIndex: 300,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: radii.card,
    backgroundColor: 'rgba(13,22,45,0.96)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(126,231,255,0.22)',
    padding: spacing.l,
    gap: spacing.m,
    alignItems: 'center',
  },
  skip: {
    alignSelf: 'flex-end',
    minHeight: 32,
    paddingHorizontal: spacing.s,
    justifyContent: 'center',
  },
  stage: {
    height: 132,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBox: {
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 92,
  },
  title: {
    fontSize: 22,
    textAlign: 'center',
  },
  body: {
    color: colors.textDim,
    textAlign: 'center',
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: spacing.xs,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.surface,
  },
  dotActive: {
    width: 20,
    backgroundColor: colors.accent,
  },
});

const art = StyleSheet.create({
  levelWrap: {
    width: 220,
    alignItems: 'center',
    gap: spacing.s,
  },
  levelPill: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,210,63,0.14)',
    borderWidth: 2,
    borderColor: mascotPalette.block,
  },
  levelNumber: {
    color: mascotPalette.block,
    fontSize: 40,
    lineHeight: 46,
  },
  barTrack: {
    width: '100%',
    height: 10,
    borderRadius: 6,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 6,
    backgroundColor: colors.accent,
  },
  worldsRow: {
    flexDirection: 'row',
    gap: spacing.s,
    alignItems: 'center',
  },
  swatch: {
    flexDirection: 'row',
    gap: 3,
    padding: 6,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  swatchDot: {
    width: 11,
    height: 11,
    borderRadius: 3,
  },
  road: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  roadItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  roadLine: {
    width: 22,
    height: 3,
    borderRadius: 2,
  },
  node: {
    marginHorizontal: 1,
  },
  dailyWrap: {
    alignItems: 'center',
    gap: spacing.m,
  },
  ladder: {
    flexDirection: 'row',
    gap: 6,
  },
  rung: {
    width: 16,
    height: 26,
    borderRadius: 5,
  },
  multBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radii.button,
    backgroundColor: colors.accent,
  },
  capiWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
