import { View } from 'react-native';
import { useLang } from '@/features/settings';
import { AppText, CandyCapy, CandyIcon, formatNumber, nightCandy as n } from '@/ui';
import type { LeaderboardEntry } from '../types';

export function LeaderboardRow({
  entry,
  gapToNext,
}: {
  entry: LeaderboardEntry;
  gapToNext?: number;
}) {
  const ru = useLang() === 'ru';
  return (
    <View
      style={{
        minHeight: 60,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 12,
        borderRadius: 20,
        backgroundColor: entry.isCurrentPlayer ? 'rgba(255,201,60,0.14)' : 'rgba(255,255,255,0.06)',
        borderWidth: entry.isCurrentPlayer ? 2 : 0,
        borderColor: n.sun,
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 99,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: entry.isCurrentPlayer ? n.sun : 'rgba(255,255,255,0.1)',
        }}
      >
        <AppText
          preset="button"
          style={{
            fontSize: 14,
            lineHeight: 20,
            color: entry.isCurrentPlayer ? n.sunInk : n.white,
          }}
        >
          {entry.rank ?? '—'}
        </AppText>
      </View>
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 99,
          backgroundColor: n.night700,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CandyCapy size={34} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          {entry.championRank != null && <CandyIcon name="crown" size={13} color={n.sun} />}
          <AppText
            numberOfLines={1}
            style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 15, lineHeight: 21 }}
          >
            {entry.nickname}
          </AppText>
        </View>
        {entry.isCurrentPlayer && (
          <AppText
            style={{
              fontFamily: 'Nunito_800ExtraBold',
              color: n.muted,
              fontSize: 12,
              lineHeight: 16,
            }}
          >
            {ru ? 'это ты' : 'you'}
            {gapToNext != null && gapToNext > 0
              ? ru
                ? ` · до места выше ${formatNumber(gapToNext)}`
                : ` · ${formatNumber(gapToNext)} to next place`
              : ''}
          </AppText>
        )}
      </View>
      <AppText preset="button" style={{ fontSize: 17, lineHeight: 23 }}>
        {formatNumber(entry.weeklyBest)}
      </AppText>
    </View>
  );
}
