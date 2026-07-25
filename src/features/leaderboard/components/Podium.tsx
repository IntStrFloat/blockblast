import { StyleSheet, View } from 'react-native';

import { t } from '@/core/i18n';
import { useLang } from '@/features/settings';
import { AppText, CrownIcon } from '@/ui';

import type { LeaderboardEntry } from '../types';
import { prizeForRank } from '../weeklyPrize';

interface PodiumProps {
  entries: LeaderboardEntry[];
}

const MEDAL: Record<number, { base: string; edge: string; ink: string; height: number }> = {
  1: { base: '#FFC33A', edge: '#A95A06', ink: '#173C91', height: 132 },
  2: { base: '#DDEBFF', edge: '#86A7D8', ink: '#1746A7', height: 106 },
  3: { base: '#F3A25E', edge: '#AD5E2D', ink: '#5A260A', height: 94 },
};

function PodiumColumn({ entry }: { entry: LeaderboardEntry }) {
  const rank = entry.rank ?? 3;
  const medal = MEDAL[rank] ?? MEDAL[3];
  const prize = prizeForRank(rank);

  return (
    <View style={styles.column}>
      {rank === 1 ? <CrownIcon size={25} color="#FFE46B" /> : <View style={{ height: 25 }} />}
      <View style={[styles.medal, { backgroundColor: medal.base, borderColor: 'rgba(255,255,255,0.52)' }]}>
        <AppText preset="speech" style={[styles.medalText, { color: medal.ink }]}>{rank}</AppText>
      </View>
      <AppText preset="speech" style={styles.nickname} numberOfLines={1}>{entry.nickname}</AppText>
      <View style={[styles.pedestal, { height: medal.height, backgroundColor: medal.base, borderColor: medal.edge }]}>
        <AppText preset="speech" style={[styles.pedestalScore, { color: medal.ink }]} numberOfLines={1}>{entry.weeklyBest}</AppText>
        {prize ? <View style={styles.prize}><CrownIcon size={12} color={medal.ink} /><AppText preset="speech" style={[styles.prizeText, { color: medal.ink }]}>+{prize.points}</AppText></View> : null}
      </View>
    </View>
  );
}

export function Podium({ entries }: PodiumProps) {
  const lang = useLang();
  if (entries.length === 0) return null;
  const byRank = (rank: number) => entries.find((entry) => (entry.rank ?? 0) === rank);
  const ordered = [byRank(2), byRank(1), byRank(3)].filter(Boolean) as LeaderboardEntry[];

  return (
    <View style={styles.root}>
      <AppText preset="speech" style={styles.title}>{t('leaderboard.podiumTitle', lang)}</AppText>
      <View style={styles.columns}>{ordered.map((entry) => <PodiumColumn key={`${entry.tag}-${entry.rank}`} entry={entry} />)}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10 },
  title: { color: '#FFFFFF', fontFamily: 'Fredoka_700Bold', fontSize: 22 },
  columns: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  column: { flex: 1, alignItems: 'center', gap: 5 },
  medal: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', borderWidth: 2, shadowColor: 'rgba(3,45,116,0.45)', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.44, shadowRadius: 3, elevation: 4 },
  medalText: { fontFamily: 'Fredoka_700Bold', fontSize: 25 },
  nickname: { width: '100%', color: '#FFFFFF', fontFamily: 'Fredoka_700Bold', fontSize: 15, textAlign: 'center' },
  pedestal: { width: '100%', borderTopLeftRadius: 18, borderTopRightRadius: 18, alignItems: 'center', paddingTop: 9, borderWidth: 2, shadowColor: 'rgba(3,45,116,0.38)', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.4, shadowRadius: 4, elevation: 4 },
  pedestalScore: { fontFamily: 'Fredoka_700Bold', fontSize: 22 },
  prize: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 5, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.34)' },
  prizeText: { fontFamily: 'Fredoka_700Bold', fontSize: 13 },
});
