import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { t } from '@/core/i18n';
import { useGameStore } from '@/features/game';
import { useLang } from '@/features/settings';
import { AppText } from '@/ui';

import { adventureSkinFor } from '../logic/skins';
import { levelFor } from '../logic/levels';
import { absoluteLevelNumber } from '../logic/seasons';
import { useAdventure } from '../store';

export function ObjectivePanel() {
  const lang = useLang();
  const seasonId = useAdventure((s) => s.seasonId);
  const levelIndex = useAdventure((s) => s.levelIndex);
  const gameScore = useGameStore((s) => s.game.score);
  const run = useGameStore((s) => s.adventure);
  const level = run?.level ?? levelFor(seasonId, levelIndex);
  const skin = adventureSkinFor(absoluteLevelNumber(seasonId, levelIndex));
  const jewelObjective = level.objective.type === 'jewels';
  const collected = run?.collectedJewels ?? 0;
  const current = jewelObjective ? collected : gameScore;
  const target = level.objective.target;
  const fill = Math.min(1, current / Math.max(1, target));
  const fillSV = useSharedValue(fill);
  const badgeScale = useSharedValue(1);
  const label = jewelObjective ? t('adventure.goalJewels', lang) : t('adventure.goalScore', lang);

  useEffect(() => {
    fillSV.value = withTiming(fill, { duration: 420 });
    badgeScale.value = withSequence(
      withTiming(1.08, { duration: 120 }),
      withTiming(1, { duration: 160 }),
    );
  }, [badgeScale, fill, fillSV]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${fillSV.value * 100}%` }));
  const badgeStyle = useAnimatedStyle(() => ({ transform: [{ scale: badgeScale.value }] }));

  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${current}/${target}`}
      style={styles.shell}
    >
      <View
        style={[
          styles.track,
          { backgroundColor: skin.progressTrack, borderColor: skin.progressBorder },
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

      <Animated.View
        style={[
          styles.targetBadge,
          {
            backgroundColor: skin.progressBadge,
            borderColor: skin.progressBorder,
          },
          badgeStyle,
        ]}
      >
        <AppText preset="speech" style={[styles.targetText, { color: skin.progressBadgeText }]}>
          {target}
        </AppText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    width: '100%',
    maxWidth: 320,
    height: 60,
    position: 'relative',
    justifyContent: 'center',
  },
  track: {
    height: 24,
    marginRight: 34,
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
    opacity: 0.76,
  },
  fillMask: {
    height: '100%',
    overflow: 'hidden',
  },
  fillGradient: {
    width: 250,
    height: '100%',
  },
  targetBadge: {
    position: 'absolute',
    right: 0,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    shadowColor: '#2E1C28',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.34,
    shadowRadius: 2,
    elevation: 4,
  },
  targetText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 21,
    lineHeight: 25,
  },
});
