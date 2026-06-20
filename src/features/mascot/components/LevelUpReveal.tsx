import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { t } from '@/core/i18n';
import { Confetti } from '@/features/game';
import { useProgression } from '@/features/progression';
import { useLang } from '@/features/settings';
import { AppText, colors, radii, spacing } from '@/ui';

import { useMascotFeedback } from '../hooks/useMascotFeedback';
import { GiftGlyph, MascotMark } from './MascotArt';

/**
 * Сюрприз-распаковка косметики при левел-апе Уровня Игры (владелец reveal — координатор, спека 15 §4).
 * Монтируется в MascotLayer (сиблингом слоя), само скрывается при reveal === null.
 * Авто-закрытие через 1300мс, тап закрывает мгновенно.
 */
export function LevelUpReveal() {
  const reveal = useProgression((s) => s.reveal);
  const clearReveal = useProgression((s) => s.clearReveal);
  const lang = useLang();
  const { onLevelUp } = useMascotFeedback();

  // Timer ref — читается/пишется только в effect/handler, не при рендере.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (reveal === null) return;

    // Фанфара левел-апа (звук+хаптика, гейтятся настройками).
    onLevelUp();

    // Анимация подарка: появление + подскок
    scale.value = withSequence(
      withSpring(1.2, { damping: 8, stiffness: 240 }),
      withDelay(200, withSpring(1, { damping: 12, stiffness: 200 })),
    );
    opacity.value = withTiming(1, { duration: 180 });

    // Авто-закрытие через 1300мс
    timerRef.current = setTimeout(() => {
      clearReveal();
    }, 1300);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      scale.value = 0;
      opacity.value = 0;
    };
  }, [reveal, clearReveal, scale, opacity, onLevelUp]);

  const giftStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  if (reveal === null) return null;

  const cosmeticCount = reveal.rewards.filter((r) => r.kind === 'cosmetic').length;
  let subtitle: string;
  if (cosmeticCount === 1) {
    subtitle = t('mascot.newItem', lang);
  } else if (cosmeticCount > 1) {
    subtitle = `${t('mascot.newItems', lang)} ×${cosmeticCount}`;
  } else {
    // helpers or stage rewards — just show level up text
    subtitle = '';
  }

  return (
    <Pressable style={styles.scrim} onPress={clearReveal}>
      {/* Confetti за карточкой */}
      <Confetti height={320} />

      <View style={styles.card}>
        <Animated.View style={giftStyle}>
          <GiftGlyph size={58} />
        </Animated.View>

        <View style={styles.titleRow}>
          <MascotMark size={22} />
          <AppText preset="title" style={styles.title}>
            {`${t('mascot.levelUp', lang)} ур.${reveal.level}`}
          </AppText>
        </View>

        {subtitle.length > 0 ? (
          <AppText preset="caption" style={styles.subtitle}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
    </Pressable>
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
    zIndex: 200,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    borderRadius: radii.card,
    backgroundColor: colors.cardGlass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: spacing.l,
    gap: spacing.m,
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.s,
  },
  title: {
    flexShrink: 1,
    textAlign: 'center',
    fontSize: 20,
  },
  subtitle: {
    textAlign: 'center',
    color: colors.accent,
  },
});
