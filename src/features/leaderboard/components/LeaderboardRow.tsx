import { StyleSheet, View } from 'react-native';

import { MascotBadge } from '@/features/mascot';
import { AppText, CrownIcon } from '@/ui';

import type { LeaderboardEntry } from '../types';

interface LeaderboardRowProps {
  entry: LeaderboardEntry;
}

export function LeaderboardRow({ entry }: LeaderboardRowProps) {
  const isChampion = entry.championRank != null && entry.championRank >= 1 && entry.championRank <= 3;

  return (
    <View style={[styles.row, entry.isCurrentPlayer && styles.currentRow]}>
      <View style={[styles.rank, entry.isCurrentPlayer && styles.currentRank]}>
        <AppText preset="speech" style={[styles.rankText, entry.isCurrentPlayer && styles.currentRankText]}>
          {entry.rank ?? '—'}
        </AppText>
      </View>
      <MascotBadge avatar={entry.avatar} size={30} />
      <View style={styles.copy}>
        <View style={styles.nameLine}>
          {isChampion ? <CrownIcon size={14} color="#FFE46B" /> : null}
          <AppText preset="speech" numberOfLines={1} style={styles.name}>{entry.nickname}</AppText>
        </View>
        <AppText preset="caption" style={styles.meta}>{entry.tag} · {entry.runsCount}</AppText>
      </View>
      <AppText preset="speech" style={styles.score}>{entry.weeklyBest}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 20, backgroundColor: 'rgba(42,113,202,0.88)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.30)', paddingHorizontal: 14, shadowColor: 'rgba(3,45,116,0.45)', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.42, shadowRadius: 4, elevation: 3 },
  currentRow: { backgroundColor: '#367FD3', borderColor: '#FFE46B', borderWidth: 2 },
  rank: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1746A7' },
  currentRank: { backgroundColor: '#FFE46B' },
  rankText: { color: 'rgba(244,250,255,0.80)', fontFamily: 'Fredoka_700Bold', fontSize: 17 },
  currentRankText: { color: '#1746A7' },
  copy: { flex: 1, minWidth: 0 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { flexShrink: 1, color: '#FFFFFF', fontFamily: 'Fredoka_700Bold', fontSize: 19 },
  meta: { marginTop: 1, color: 'rgba(232,247,255,0.74)', fontSize: 13 },
  score: { color: '#FFFFFF', fontFamily: 'Fredoka_700Bold', fontSize: 24, textShadowColor: 'rgba(3,45,116,0.36)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 1 },
});
