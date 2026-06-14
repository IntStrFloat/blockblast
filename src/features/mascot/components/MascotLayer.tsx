import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { getBoardMetrics } from '@/ui';
import { useSettings } from '@/features/settings';

import { useMascotBrain } from '../hooks/useMascotBrain';
import { progressFor } from '../logic/progression';
import type { EmoteId } from '../logic/types';
import { useMascot } from '../store';
import { Emote } from './Emote';
import { LevelUpReveal } from './LevelUpReveal';
import { Mascot, useMascotMotion } from './Mascot';
import { MascotChip } from './MascotChip';

const MASCOT_SIZE = 56;
const LAYER_HEIGHT = 70;

interface MascotLayerProps {
  dragActive: SharedValue<number>;
}

/**
 * Публичный слой Капи над доской: позиционирование, монтирование «мозга»,
 * чип уровня, реакция на тап, эмоции и reduce-motion.
 *
 * Монтируется только при включённой настройке showMascot — иначе ни мозг,
 * ни таймеры не запускаются. Перетаскивание/«потеря» маскота — отдельная
 * задача (Task 15), здесь не реализуется.
 */
export function MascotLayer({ dragActive }: MascotLayerProps) {
  const showMascot = useSettings((s) => s.showMascot);
  if (!showMascot) return null;
  return (
    <>
      <MascotLayerInner dragActive={dragActive} />
      <LevelUpReveal />
    </>
  );
}

function MascotLayerInner({ dragActive }: MascotLayerProps) {
  const motion = useMascotMotion();

  const totalXp = useMascot((s) => s.totalXp);
  const equipped = useMascot((s) => s.equipped);
  const stage = progressFor(totalXp).stage;

  // Reduce-motion: читаем системную настройку и подписываемся на смену.
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  const { width } = useWindowDimensions();
  const { boardSize } = getBoardMetrics(width);
  const areaWidth = Math.max(0, boardSize - MASCOT_SIZE);

  // Низкочастотный показ эмоции (~1.2 с) — не на горячем пути.
  const [emote, setEmote] = useState<EmoteId>('none');
  const emoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showEmote = useCallback((id: EmoteId) => {
    setEmote(id);
    if (emoteTimer.current) clearTimeout(emoteTimer.current);
    emoteTimer.current = setTimeout(() => setEmote('none'), 1200);
  }, []);
  useEffect(() => () => {
    if (emoteTimer.current) clearTimeout(emoteTimer.current);
  }, []);

  useMascotBrain({ motion, stage, reduceMotion, areaWidth, dragActive, onEmote: showEmote });

  // translateX всего слота (тень + маскот + эмоция) — горизонтальный ход Капи.
  const trackStyle = useAnimatedStyle(() => ({ transform: [{ translateX: motion.x.value }] }));

  // Тап по Капи: подскок — прямо в worklet (UI-поток), сердечко — через runOnJS.
  // react-compiler's react-hooks/refs ложно срабатывает на жесте-worklet, который
  // трогает Reanimated shared values и создаётся внутри компонента (тот же паттерн
  // в useDrag проходит лишь потому, что живёт в кастомном хуке). Колбэк исполняется
  // на UI-потоке в момент тапа, не во время рендера — доступ безопасен.
  /* eslint-disable react-hooks/refs */
  const tap = Gesture.Tap().onEnd(() => {
    'worklet';
    motion.bob.value = withSequence(
      withTiming(-10, { duration: 140 }),
      withSpring(0, { damping: 10, stiffness: 220 }),
    );
    runOnJS(showEmote)('heart');
  });
  /* eslint-enable react-hooks/refs */

  return (
    <View style={styles.layer} pointerEvents="box-none">
      <View style={[styles.area, { width: boardSize }]} pointerEvents="box-none">
        {/* Чип уровня — верхний левый угол полосы доски. */}
        <View style={styles.chip} pointerEvents="box-none">
          <MascotChip />
        </View>

        {/* Маскот в нижнем левом углу; горизонтальный ход — через trackStyle (motion.x),
            чтобы тень и эмоция двигались вместе с Капи. */}
        <Animated.View style={[styles.mascotSlot, trackStyle]} pointerEvents="box-none">
          {/* Мягкая «тень»-овал под маскотом. */}
          <View style={styles.shadow} pointerEvents="none" />
          <GestureDetector gesture={tap}>
            <View style={styles.mascotHit}>
              <Mascot motion={motion} stage={stage} equipped={equipped} size={MASCOT_SIZE} />
              {/* Пузырь-эмоция над маскотом (none → null). */}
              <View style={styles.emote} pointerEvents="none">
                <Emote id={emote} />
              </View>
            </View>
          </GestureDetector>
        </Animated.View>

        {/* Тонкая линия «пола». */}
        <View style={styles.floor} pointerEvents="none" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    width: '100%',
    height: LAYER_HEIGHT,
  },
  area: {
    flex: 1,
    alignSelf: 'center',
  },
  chip: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 2,
  },
  floor: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  mascotSlot: {
    position: 'absolute',
    bottom: 0,
    left: 0,
  },
  mascotHit: {
    width: MASCOT_SIZE,
    height: MASCOT_SIZE,
  },
  shadow: {
    position: 'absolute',
    bottom: -2,
    left: MASCOT_SIZE * 0.12,
    width: MASCOT_SIZE * 0.76,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(8,14,28,0.35)',
  },
  emote: {
    position: 'absolute',
    top: -22,
    right: -8,
  },
});
