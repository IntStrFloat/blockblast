import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { t } from '@/core/i18n';
import { useScores } from '@/features/scores';
import { useLang } from '@/features/settings';
import { isStreakAlive, todayISO, useStreak } from '@/features/streak';
import { AppText, GameButton, colors, radii, spacing } from '@/ui';

import { dailyPreview } from '../logic/reward';
import { useDailyBonus, type DailyClaimPayload } from '../store';

const LADDER = [1, 2, 3, 4, 5, 6, 7];

/**
 * Ambient дейли-карточка на Home (спека 14 §8): «день N · ×M», лесенка стрика,
 * кнопка «забрать» или «приходи завтра». Не показывается до первой партии
 * (анти-чеклист 06). Холодный забор использует живой стрик; множитель растёт
 * только реальной игрой. Reveal — лёгкая коробка поверх карточки (≤1.2с, скип тапом).
 */
export function DailyCard() {
  const lang = useLang();
  const gamesPlayed = useScores((s) => s.gamesPlayed);
  const streakCount = useStreak((s) => s.count);
  const streakLastDay = useStreak((s) => s.lastDay);
  const protectorDay = useStreak((s) => s.protectorLastUsedDay);
  const lastClaimDay = useDailyBonus((s) => s.lastClaimDay);
  const [reveal, setReveal] = useState<DailyClaimPayload | null>(null);

  const today = todayISO();
  const liveStreak = isStreakAlive({ lastDay: streakLastDay, count: streakCount }, today)
    ? streakCount
    : 0;
  const preview = dailyPreview(Math.max(liveStreak, 1));
  const currentDay = preview.day;
  const canClaim = lastClaimDay !== today;
  const protectedToday = protectorDay === today;

  const onClaim = useCallback(() => {
    const payload = useDailyBonus.getState().claim();
    if (payload) setReveal(payload);
  }, []);

  if (gamesPlayed < 1) return null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <AppText preset="body">{t('daily.title', lang)}</AppText>
        <AppText preset="caption" style={{ color: colors.accent }}>
          {t('daily.day', lang)} {currentDay} · ×{preview.multiplier}
        </AppText>
      </View>

      <View style={styles.ladder}>
        {LADDER.map((d) => (
          <View
            key={d}
            style={[
              styles.rung,
              { backgroundColor: d <= currentDay ? colors.accent : colors.surface },
            ]}
          />
        ))}
      </View>

      {protectedToday ? (
        <AppText preset="caption">🛟 {t('daily.protected', lang)}</AppText>
      ) : null}

      {canClaim ? (
        <GameButton label={t('daily.claim', lang)} onPress={onClaim} />
      ) : (
        <AppText preset="caption" style={{ textAlign: 'center' }}>
          {t('daily.comeBack', lang)} · {t('daily.tomorrow', lang)} ×
          {dailyPreview(currentDay + 1).multiplier}
        </AppText>
      )}

      <DailyReveal payload={reveal} onDone={() => setReveal(null)} />
    </View>
  );
}

/** Коробка-reveal поверх карточки: «+очки ×множитель» и дроп. Авто-скрытие 1.2с. */
function DailyReveal({
  payload,
  onDone,
}: {
  payload: DailyClaimPayload | null;
  onDone: () => void;
}) {
  const lang = useLang();

  useEffect(() => {
    if (!payload) return undefined;
    const timer = setTimeout(onDone, 1200);
    return () => clearTimeout(timer);
  }, [payload, onDone]);

  if (!payload) return null;

  const dropLabel = payload.drop
    ? payload.drop.type === 'helperCharge'
      ? t('daily.dropCharge', lang)
      : t('daily.dropItem', lang)
    : null;

  return (
    <Pressable onPress={onDone} style={StyleSheet.absoluteFill}>
      <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(200)} style={styles.reveal}>
        <AppText preset="title" style={{ color: colors.accent }}>
          +{payload.points} ×{payload.multiplier}
        </AppText>
        {dropLabel ? <AppText preset="body">{dropLabel}</AppText> : null}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 320,
    gap: spacing.xs,
    padding: spacing.m,
    borderRadius: radii.card,
    backgroundColor: colors.cardGlass,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ladder: {
    flexDirection: 'row',
    gap: 4,
  },
  rung: {
    flex: 1,
    height: 6,
    borderRadius: 3,
  },
  reveal: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.cardGlass,
  },
});
