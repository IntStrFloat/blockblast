import { View } from 'react-native';

import { t } from '@/core/i18n';
import { useLang } from '@/features/settings';
import { AppText, CrownIcon, colors, radii, spacing } from '@/ui';

import type { LeaderboardEntry } from '../types';
import { prizeForRank } from '../weeklyPrize';

interface PodiumProps {
  /** Топ-3 в порядке мест (#1, #2, #3). */
  entries: LeaderboardEntry[];
}

/** Металлический цвет места: золото / серебро / бронза. */
const MEDAL: Record<number, { base: string; ink: string }> = {
  1: { base: colors.accent, ink: '#10203F' },
  2: { base: '#C9D6E8', ink: '#1B2A4A' },
  3: { base: '#E0915A', ink: '#2A1505' },
};

/** Высота пьедестала по месту — центральная (#1) самая высокая. */
const PEDESTAL_HEIGHT: Record<number, number> = { 1: 132, 2: 108, 3: 96 };

function PodiumColumn({ entry }: { entry: LeaderboardEntry }) {
  const rank = entry.rank ?? 0;
  const medal = MEDAL[rank] ?? MEDAL[3];
  const prize = prizeForRank(rank);
  const isChampion =
    entry.championRank != null && entry.championRank >= 1 && entry.championRank <= 3;

  return (
    <View style={{ flex: 1, alignItems: 'center', gap: spacing.s }}>
      {/* Медаль + корона для #1 */}
      <View style={{ alignItems: 'center', gap: 4 }}>
        {rank === 1 ? <CrownIcon size={22} color={colors.accent} /> : null}
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 999,
            backgroundColor: medal.base,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: colors.clayShadow,
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.4,
            shadowRadius: 5,
            elevation: 4,
          }}
        >
          <AppText preset="button" style={{ color: medal.ink, fontSize: 16 }}>
            {rank}
          </AppText>
        </View>
      </View>

      {/* Ник + рамка чемпиона */}
      <View
        style={{
          maxWidth: '100%',
          paddingHorizontal: 8,
          paddingVertical: 2,
          borderRadius: radii.button,
          borderWidth: isChampion ? 2 : 0,
          borderColor: isChampion ? colors.accent : 'transparent',
        }}
      >
        <AppText preset="caption" numberOfLines={1} style={{ color: colors.textPrimary }}>
          {entry.nickname}
        </AppText>
      </View>

      {/* Пьедестал с очками и призом */}
      <View
        style={{
          width: '100%',
          height: PEDESTAL_HEIGHT[rank] ?? 96,
          borderTopLeftRadius: radii.card,
          borderTopRightRadius: radii.card,
          backgroundColor: rank === 1 ? colors.cardRaised : colors.cardSolid,
          borderWidth: 1,
          borderColor: rank === 1 ? colors.accent : colors.hairline,
          paddingVertical: spacing.s,
          paddingHorizontal: 6,
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: 4,
          shadowColor: colors.clayShadow,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.45,
          shadowRadius: 10,
          elevation: 5,
        }}
      >
        <AppText preset="title" style={{ fontSize: 18 }} numberOfLines={1}>
          {entry.weeklyBest}
        </AppText>
        {prize ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 3,
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: 999,
              backgroundColor: 'rgba(255,201,60,0.16)',
            }}
          >
            <CrownIcon size={11} color={colors.accent} />
            <AppText preset="caption" style={{ color: colors.accent, fontSize: 11 }}>
              +{prize.points}
            </AppText>
          </View>
        ) : null}
      </View>
    </View>
  );
}

export function Podium({ entries }: PodiumProps) {
  // Хук до раннего return — иначе порядок хуков меняется между рендерами (rules-of-hooks).
  const lang = useLang();
  if (entries.length === 0) return null;

  const byRank = (rank: number) => entries.find((entry) => (entry.rank ?? 0) === rank);
  // Классический порядок: #2 слева, #1 в центре, #3 справа.
  const ordered = [byRank(2), byRank(1), byRank(3)].filter(Boolean) as LeaderboardEntry[];

  return (
    <View style={{ gap: spacing.s }}>
      <AppText preset="caption" style={{ color: colors.textDim }}>
        {t('leaderboard.podiumTitle', lang)}
      </AppText>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.s }}>
        {ordered.map((entry) => (
          <PodiumColumn key={`${entry.tag}-${entry.rank}`} entry={entry} />
        ))}
      </View>
    </View>
  );
}
