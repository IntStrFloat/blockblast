import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { View, useWindowDimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useProgression } from '@/features/progression';
import { useScores } from '@/features/scores';
import { useLang } from '@/features/settings';
import { AppText, CandyAvatar, formatNumber, nightCandy as n } from '@/ui';
import { CandyChip, CandyRoundButton } from '@/ui/primitives/CandyControls';
import { useReducedMotion } from '../animation/useReducedMotion';
import { useGameStore } from '../store';

export function Hud({
  onPause,
  compact = false,
}: {
  onPause: () => void;
  compact?: boolean;
}) {
  const router = useRouter();
  const ru = useLang() === 'ru';
  const { width } = useWindowDimensions();
  const score = useGameStore((s) => s.game.score);
  const bestAtStart = useGameStore((s) => s.runBestAtStart);
  const best = useScores((s) => s.best);
  const rank = useProgression((s) => s.level);
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const previous = useRef(score);
  useEffect(() => {
    if (score > previous.current && !reduced)
      scale.value = withSequence(
        withTiming(1.08, { duration: 70 }),
        withTiming(1, { duration: 180 }),
      );
    previous.current = score;
  }, [reduced, scale, score]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const displayed = formatNumber(score);
  const fontSize = Math.min(
    compact ? 42 : 56,
    Math.max(20, (width - 148) / (displayed.length * 0.82)),
  );
  return (
    <View
      testID="game-hud"
      style={{
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingHorizontal: 16,
        gap: 12,
      }}
    >
      <CandyRoundButton
        icon="pause"
        label={ru ? 'Пауза' : 'Pause'}
        onPress={onPause}
      />
      <View style={{ flex: 1, alignItems: 'center', gap: 6 }}>
        <Animated.View style={[{ width: '100%' }, style]}>
          <AppText
            testID="hud-score-text"
            preset="score"
            allowFontScaling={false}
            adjustsFontSizeToFit
            minimumFontScale={0.4}
            numberOfLines={1}
            style={{
              color: n.white,
              fontSize,
              lineHeight: compact ? 44 : 56,
              textAlign: 'center',
              textShadowColor: 'rgba(3,5,30,0.5)',
              textShadowOffset: { width: 0, height: 4 },
              textShadowRadius: 0.1,
            }}
          >
            {displayed}
          </AppText>
        </Animated.View>
        <CandyChip
          height={28}
          icon="crown"
          color={n.sun}
          label={formatNumber(Math.max(best, bestAtStart))}
        />
      </View>
      <CandyAvatar
        rank={rank}
        onPress={() => {
          router.push('/capy');
        }}
      />
    </View>
  );
}
