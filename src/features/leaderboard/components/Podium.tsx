import { View } from 'react-native';

import { AppText, colors, radii, spacing } from '@/ui';

import type { LeaderboardEntry } from '../types';
interface PodiumProps {
  entries: LeaderboardEntry[];
}

export function Podium({ entries }: PodiumProps) {
  if (entries.length === 0) return null;

  return (
    <View style={{ flexDirection: 'row', gap: spacing.s, alignItems: 'flex-end' }}>
      {entries.map((entry, index) => (
        <View
          key={`${entry.tag}-${entry.rank}`}
          style={{
            flex: 1,
            borderRadius: radii.card,
            backgroundColor: index === 0 ? colors.accent : colors.surface,
            padding: spacing.s,
            minHeight: 118 - index * 10,
            justifyContent: 'space-between',
          }}
        >
          <AppText
            preset="caption"
            style={{ color: index === 0 ? '#1B2A4A' : colors.textDim }}
          >
            #{entry.rank}
          </AppText>
          <View style={{ gap: 4 }}>
            <AppText
              preset="body"
              numberOfLines={2}
              style={{ color: index === 0 ? '#1B2A4A' : colors.textPrimary }}
            >
              {entry.nickname}
            </AppText>
            <AppText
              preset="caption"
              style={{ color: index === 0 ? '#1B2A4A' : colors.textDim }}
            >
              {entry.weeklyBest}
            </AppText>
          </View>
        </View>
      ))}
    </View>
  );
}
