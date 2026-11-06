import { View } from 'react-native';
import { AppText, CandyCapy, CandyIcon, formatNumber, nightCandy as n } from '@/ui';
import type { LeaderboardEntry } from '../types';

const podiumColors: Record<number, { fill: string; ink: string; height: number }> = {
  1: { fill: n.sun, ink: n.sunInk, height: 92 },
  2: { fill: '#DFE4FF', ink: n.night900, height: 68 },
  3: { fill: '#FFB37A', ink: '#3A1600', height: 52 },
};
export function Podium({ entries }: { entries: LeaderboardEntry[] }) {
  if (!entries.length) return null;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 10,
        paddingHorizontal: 4,
        paddingTop: 8,
      }}
    >
      {[2, 1, 3].map((rank) => {
        const entry = entries.find((e) => e.rank === rank);
        if (!entry) return <View key={rank} style={{ flex: 1 }} />;
        const color = podiumColors[rank];
        return (
          <View key={rank} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
            <View
              style={{
                width: 50,
                height: 50,
                borderRadius: 99,
                borderWidth: 3,
                borderColor: color.fill,
                backgroundColor: n.night700,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CandyCapy size={40} />
              {entry.championRank != null && (
                <View style={{ position: 'absolute', right: -4, top: -8 }}>
                  <CandyIcon name="crown" color={n.sun} size={16} />
                </View>
              )}
            </View>
            <AppText
              numberOfLines={1}
              style={{
                fontFamily: 'Nunito_800ExtraBold',
                fontSize: 13,
                lineHeight: 18,
                color: n.white,
              }}
            >
              {entry.nickname}
            </AppText>
            <View
              style={{
                width: '100%',
                height: color.height,
                alignItems: 'center',
                paddingTop: 8,
                borderTopLeftRadius: 18,
                borderTopRightRadius: 18,
                borderBottomLeftRadius: 6,
                borderBottomRightRadius: 6,
                backgroundColor: color.fill,
                borderTopWidth: 2,
                borderTopColor: 'rgba(255,255,255,0.45)',
                borderBottomWidth: 5,
                borderBottomColor: 'rgba(30,10,70,0.30)',
              }}
            >
              <AppText preset="score" style={{ fontSize: 22, lineHeight: 28, color: color.ink }}>
                {rank}
              </AppText>
              <AppText preset="button" style={{ fontSize: 14, lineHeight: 20, color: color.ink }}>
                {formatNumber(entry.weeklyBest)}
              </AppText>
            </View>
          </View>
        );
      })}
    </View>
  );
}
