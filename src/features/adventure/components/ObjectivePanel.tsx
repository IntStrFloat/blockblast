import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { t } from '@/core/i18n';
import { useGameStore } from '@/features/game';
import { useLang } from '@/features/settings';
import { AppText, StarIcon } from '@/ui';
import { JewelIcon } from './JewelIcon';

import { adventureSkinFor } from '../logic/skins';
import { levelFor } from '../logic/levels';
import { absoluteLevelNumber } from '../logic/seasons';
import { useAdventure } from '../store';
import type { AdventureObjectiveArrival } from './JewelCollectionFlightLayer';

interface ObjectivePanelProps {
  onLayout?: (event: LayoutChangeEvent) => void;
  onTargetLayout?: (event: LayoutChangeEvent) => void;
  arrival?: AdventureObjectiveArrival | null;
}

export function ObjectivePanel({ onLayout, onTargetLayout, arrival = null }: ObjectivePanelProps = {}) {
  const lang = useLang();
  const seasonId = useAdventure((s) => s.seasonId);
  const levelIndex = useAdventure((s) => s.levelIndex);
  const seasonWindow = useAdventure((s) => s.seasonWindow);
  const gameScore = useGameStore((s) => s.game.score);
  const run = useGameStore((s) => s.adventure);
  const lastAdventureEvent = useGameStore((s) => s.lastAdventureEvent);
  const level = run?.level ?? levelFor(seasonId, levelIndex);
  const skin = adventureSkinFor(absoluteLevelNumber(level.seasonId, level.levelIndex), seasonWindow);
  const jewelObjective = level.objective.type === 'jewels';
  const collected = run?.collectedJewels ?? 0;
  const rawCurrent = jewelObjective ? collected : gameScore;
  const [displayedCurrent, setDisplayedCurrent] = useState(rawCurrent);
  const [pendingDelta, setPendingDelta] = useState(0);
  const seenEventIdsRef = useRef(new Set<string>());
  const arrivedEventIdsRef = useRef(new Set<string>());
  const target = level.objective.target;
  const targetLabel = String(target);
  const badgeDiameter = targetLabel.length >= 4 ? 76 : targetLabel.length >= 3 ? 68 : 60;
  const current = jewelObjective ? displayedCurrent : rawCurrent;
  const fill = Math.min(1, current / Math.max(1, target));
  const fillSV = useSharedValue(fill);
  const label = jewelObjective ? t('adventure.goalJewels', lang) : t('adventure.goalScore', lang);

  useEffect(() => {
    if (!jewelObjective || !lastAdventureEvent || lastAdventureEvent.jewelsCollectedThisMove <= 0) return;
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

  const fillStyle = useAnimatedStyle(() => ({ width: `${fillSV.value * 100}%` }));

  return (
    <View
      accessible
      accessibilityLabel={jewelObjective
        ? `${label} ${Math.max(0, target - current)}`
        : `${label} ${current}/${target}`}
      onLayout={onLayout}
      style={[styles.shell, { height: badgeDiameter }]}
    >
      <View onLayout={onTargetLayout} style={styles.goalCopy}>
        {jewelObjective ? <JewelIcon size={24} /> : <StarIcon size={22} color="#FFE06B" />}
        <AppText
          preset="speech"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.72}
          style={styles.goalText}
        >
          {`${current}/${target}`}
        </AppText>
        {pendingDelta > 0 ? (
          <AppText
            preset="caption"
            accessibilityLiveRegion="polite"
            style={styles.deltaText}
          >
            +{pendingDelta}
          </AppText>
        ) : null}
      </View>
      <View
        style={[
          styles.track,
          {
            backgroundColor: skin.progressTrack,
            borderColor: skin.progressBorder,
            marginRight: 0,
          },
        ]}
      >
        <LinearGradient
          colors={skin.progressGradient}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.trackGlow}
        />
        <Animated.View style={[styles.fillMask, fillStyle]}>
          <LinearGradient
            colors={skin.progressGradient}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.fillGradient}
          />
        </Animated.View>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    width: '100%',
    maxWidth: 320,
    minHeight: 60,
    position: 'relative',
    justifyContent: 'center',
  },
  goalCopy: {
    position: 'absolute',
    top: 0,
    left: 4,
    right: 4,
    minHeight: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  goalText: {
    color: '#FFF6E9',
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  deltaText: {
    color: '#FFF2A8',
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  track: {
    marginTop: 30,
    height: 12,
    borderRadius: 14,
    borderWidth: 2,
    overflow: 'hidden',
    shadowColor: '#2E1C28',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.34,
    shadowRadius: 2,
    elevation: 2,
  },
  trackGlow: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    opacity: 0.12,
  },
  fillMask: {
    height: '100%',
    overflow: 'hidden',
  },
  fillGradient: {
    width: '100%',
    height: '100%',
  },
});
