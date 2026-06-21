import { View } from 'react-native';

import { AppText, CrownIcon, colors, radii, spacing } from '@/ui';

import type { LeaderboardEntry } from '../types';

interface LeaderboardRowProps {
  entry: LeaderboardEntry;
}

export function LeaderboardRow({ entry }: LeaderboardRowProps) {
  const isChampion =
    entry.championRank != null && entry.championRank >= 1 && entry.championRank <= 3;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.s,
        borderRadius: radii.card,
        backgroundColor: entry.isCurrentPlayer ? colors.cardRaised : colors.cardSolid,
        borderWidth: 1,
        borderColor: entry.isCurrentPlayer ? colors.accent : colors.hairline,
        paddingHorizontal: spacing.m,
        paddingVertical: 12,
        shadowColor: colors.clayShadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
        elevation: 3,
      }}
    >
      {/* Бейдж места */}
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 999,
          backgroundColor: colors.track,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <AppText preset="caption" style={{ color: colors.textDim }}>
          {entry.rank ?? '–'}
        </AppText>
      </View>

      <View style={{ flex: 1 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            alignSelf: 'flex-start',
            paddingHorizontal: isChampion ? 6 : 0,
            paddingVertical: isChampion ? 1 : 0,
            borderRadius: radii.button,
            borderWidth: isChampion ? 1.5 : 0,
            borderColor: isChampion ? colors.accent : 'transparent',
          }}
        >
          {isChampion ? <CrownIcon size={13} color={colors.accent} /> : null}
          <AppText preset="body" numberOfLines={1}>
            {entry.nickname}
          </AppText>
        </View>
        <AppText preset="caption" style={{ color: colors.textDim }}>
          {entry.tag} · {entry.runsCount}
        </AppText>
      </View>

      <AppText preset="button" style={{ fontSize: 16 }}>
        {entry.weeklyBest}
      </AppText>
    </View>
  );
}
