import { View } from 'react-native';

import { AppText, colors, radii, spacing } from '@/ui';

import type { LeaderboardEntry } from '../types';
interface LeaderboardRowProps {
  entry: LeaderboardEntry;
}

export function LeaderboardRow({ entry }: LeaderboardRowProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: radii.button,
        backgroundColor: entry.isCurrentPlayer ? 'rgba(255,201,60,0.14)' : colors.surface,
        paddingHorizontal: spacing.m,
        paddingVertical: 12,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s, flex: 1 }}>
        <AppText preset="caption" style={{ minWidth: 26 }}>
          #{entry.rank}
        </AppText>
        <View style={{ flex: 1 }}>
          <AppText preset="body" numberOfLines={1}>
            {entry.nickname}
          </AppText>
          <AppText preset="caption">
            {entry.tag} - {entry.runsCount}
          </AppText>
        </View>
      </View>
      <AppText preset="body">{entry.weeklyBest}</AppText>
    </View>
  );
}
