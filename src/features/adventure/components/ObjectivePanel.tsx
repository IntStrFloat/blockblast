import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { t } from '@/core/i18n';
import { useGameStore } from '@/features/game';
import { useLang } from '@/features/settings';
import { AppText, CandyIcon, nightCandy as n } from '@/ui';

import { levelFor } from '../logic/levels';
import { absoluteLevelNumber } from '../logic/seasons';
import { useAdventure } from '../store';
import type { SharedValue } from 'react-native-reanimated';
import type { AdventureObjectiveArrival } from './JewelCollectionFlightLayer';

interface ObjectivePanelProps {
  onLayout?: (event: LayoutChangeEvent) => void;
  onTargetLayout?: (event: LayoutChangeEvent) => void;
  arrival?: AdventureObjectiveArrival | null;
}

function GoalSegment({
  fill,
  index,
  count,
}: {
  fill: SharedValue<number>;
  index: number;
  count: number;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: Math.max(0, Math.min(1, fill.value * count - index)),
  }));
  return (
    <View
      style={{
        flex: 1,
        height: 8,
        borderRadius: 3,
        backgroundColor: '#0B0F42',
        overflow: 'hidden',
      }}
    >
      <Animated.View
        style={[{ position: 'absolute', inset: 0, backgroundColor: n.sky, borderRadius: 3 }, style]}
      />
    </View>
  );
}

export function ObjectivePanel({
  onLayout,
  onTargetLayout,
  arrival = null,
}: ObjectivePanelProps = {}) {
  const lang = useLang();
  const seasonId = useAdventure((s) => s.seasonId);
  const levelIndex = useAdventure((s) => s.levelIndex);
  const gameScore = useGameStore((s) => s.game.score);
  const run = useGameStore((s) => s.adventure);
  const lastAdventureEvent = useGameStore((s) => s.lastAdventureEvent);
  const level = run?.level ?? levelFor(seasonId, levelIndex);
  const jewelObjective = level.objective.type === 'jewels';
  const collected = run?.collectedJewels ?? 0;
  const rawCurrent = jewelObjective ? collected : gameScore;
  const [displayedCurrent, setDisplayedCurrent] = useState(rawCurrent);
  const [pendingDelta, setPendingDelta] = useState(0);
  const seenEventIdsRef = useRef(new Set<string>());
  const arrivedEventIdsRef = useRef(new Set<string>());
  const target = level.objective.target;
  const current = jewelObjective ? displayedCurrent : rawCurrent;
  const fill = Math.min(1, current / Math.max(1, target));
  const fillSV = useSharedValue(fill);
  const label = jewelObjective ? t('adventure.goalJewels', lang) : t('adventure.goalScore', lang);

  useEffect(() => {
    if (!jewelObjective || !lastAdventureEvent || lastAdventureEvent.jewelsCollectedThisMove <= 0)
      return;
    if (seenEventIdsRef.current.has(lastAdventureEvent.presentationId)) return;
    seenEventIdsRef.current.add(lastAdventureEvent.presentationId);
    queueMicrotask(() => {
      setPendingDelta((value) => value + lastAdventureEvent.jewelsCollectedThisMove);
    });
  }, [jewelObjective, lastAdventureEvent]);

  useEffect(() => {
    if (!arrival || arrivedEventIdsRef.current.has(arrival.presentationId)) return;
    arrivedEventIdsRef.current.add(arrival.presentationId);
    queueMicrotask(() => {
      setDisplayedCurrent((value) => Math.max(value, arrival.total));
      setPendingDelta((value) => Math.max(0, value - arrival.delta));
    });
  }, [arrival]);

  useEffect(() => {
    fillSV.value = withTiming(fill, { duration: 420 });
  }, [fill, fillSV]);

  return (
    <View
      accessible
      accessibilityLabel={
        jewelObjective
          ? `${label} ${Math.max(0, target - current)}`
          : `${label} ${current}/${target}`
      }
      onLayout={onLayout}
      style={styles.shell}
    >
      <View style={styles.row}>
        <AppText style={styles.level}>
          {lang === 'ru' ? 'УРОВЕНЬ' : 'LEVEL'}{' '}
          {absoluteLevelNumber(level.seasonId, level.levelIndex)}
        </AppText>
        <View
          onLayout={onTargetLayout}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
        >
          <CandyIcon name={jewelObjective ? 'gem' : 'chart'} size={18} color={n.sky} />
          <AppText style={styles.counter}>
            {Math.min(target, current)} / {target}
          </AppText>
        </View>
      </View>
      <View style={styles.track}>
        {Array.from({ length: Math.min(12, target) }, (_, index) => (
          <GoalSegment key={index} fill={fillSV} index={index} count={Math.min(12, target)} />
        ))}
      </View>
      {pendingDelta > 0 ? (
        <AppText accessibilityLiveRegion="polite" style={{ position: 'absolute', opacity: 0 }}>
          +{pendingDelta}
        </AppText>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  shell: {
    flex: 1,
    height: 56,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: n.border,
    backgroundColor: 'rgba(7,10,42,0.5)',
    gap: 7,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  level: { color: n.mandarin, fontFamily: 'Nunito_900Black', fontSize: 12, letterSpacing: 1.2 },
  counter: { color: '#FFFFFF', fontFamily: 'Unbounded_900Black', fontSize: 16, lineHeight: 20 },
  track: { height: 8, flexDirection: 'row', gap: 3, overflow: 'hidden', borderRadius: 3 },
  fillMask: { position: 'absolute', top: 0, bottom: 0, left: 0, overflow: 'hidden' },
});
