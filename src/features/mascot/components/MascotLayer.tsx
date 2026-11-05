import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Modal, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { mascotLost } from '@/core/i18n';
import { stageForLevel, useProgression } from '@/features/progression';
import { useLang, useSettings } from '@/features/settings';
import { useGameStore } from '@/features/game';

import { useMascotBrain } from '../hooks/useMascotBrain';
import { useMascotFeedback } from '../hooks/useMascotFeedback';
import type { EmoteId } from '../logic/types';
import { useMascot } from '../store';
import { Emote } from './Emote';
import { Mascot, useMascotMotion } from './Mascot';
import { MascotChip } from './MascotChip';
import { MascotIntro } from './MascotIntro';
import { SpeechBubble } from './SpeechBubble';
import { Wardrobe } from './Wardrobe';

const MASCOT_SIZE = 56;
const LAYER_HEIGHT = 70;
/** Сдвиг вниз (≈ собственный рост), за которым отпускание = «потеря». */
const DROP_THRESHOLD = MASCOT_SIZE;
const LIFT_RETURN_MS = 180;

interface MascotLayerProps {
  dragActive: SharedValue<number>;
  active?: boolean;
  width?: number;
  compact?: boolean;
  height?: number;
  onEmoteReady?: (emit: ((id: EmoteId) => void) | null) => void;
  onLostTextChange?: (text: string | null) => void;
}

/** Speech belongs to the board's notification slot, outside the utility rail. */
export function MascotMessages({ active = true, lostText = null, onEmote }: {
  active?: boolean;
  lostText?: string | null;
  onEmote?: (id: EmoteId) => void;
}) {
  const showMascot = useSettings((s) => s.showMascot);
  const relayEmote = useCallback((id: EmoteId) => onEmote?.(id), [onEmote]);
  if (!active || !showMascot) return null;
  return lostText ? (
    <View testID="mascot-lost-message" pointerEvents="none" style={{ alignItems: 'center', width: '100%' }}>
      <SpeechBubble text={lostText} tail="center" />
    </View>
  ) : <MascotIntro onEmote={relayEmote} />;
}

/**
 * Публичный слой Капи над доской: позиционирование, монтирование «мозга»,
 * чип уровня, реакция на тап, эмоции и reduce-motion.
 *
 * Монтируется только при включённой настройке showMascot — иначе ни мозг,
 * ни таймеры не запускаются. Функциональные helper-controls живут отдельно.
 * Бросок вниз даёт короткое падение и автоматически возвращает Капи в этой же
 * партии; epoch-recovery остаётся страховкой после прерванного процесса.
 */
export function MascotLayer({ dragActive, active = true, width, compact = false, height, onEmoteReady, onLostTextChange }: MascotLayerProps) {
  const showMascot = useSettings((s) => s.showMascot);
  const [wardrobeOpen, setWardrobeOpen] = useState(false);
  if (!showMascot) return null;
  return (
    <>
      <MascotLayerInner
        dragActive={dragActive}
        active={active}
        width={width}
        compact={compact}
        height={height}
        onEmoteReady={onEmoteReady}
        onLostTextChange={onLostTextChange}
        onOpenWardrobe={() => setWardrobeOpen(true)}
      />
      <Modal visible={wardrobeOpen} transparent animationType="fade" onRequestClose={() => setWardrobeOpen(false)}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <Wardrobe visible={wardrobeOpen} onClose={() => setWardrobeOpen(false)} />
        </GestureHandlerRootView>
      </Modal>
    </>
  );
}

function MascotLayerInner({
  dragActive,
  active = true,
  compact = false,
  width = compact ? 104 : 144,
  height = compact ? 48 : LAYER_HEIGHT,
  onEmoteReady,
  onLostTextChange,
  onOpenWardrobe,
}: MascotLayerProps & { onOpenWardrobe: () => void }) {
  const motion = useMascotMotion();

  const equipped = useMascot((s) => s.equipped);
  // Стадия выводится из Уровня Игры (спека 15), не из своей XP.
  const gameLevel = useProgression((s) => s.level);
  const stage = stageForLevel(gameLevel);

  // Потерян ли маскот (Task 15b устанавливает, здесь только читаем).
  const lost = useMascot((s) => s.lost);

  // Reduce-motion: читаем системную настройку и подписываемся на смену.
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  const mascotSize = compact ? 40 : MASCOT_SIZE;
  const artWidth = compact ? 44 : MASCOT_SIZE;
  const hitHeight = Math.max(44, mascotSize);
  const chipLeft = artWidth + (compact ? 4 : 8);
  const chipWidth = Math.max(0, width - chipLeft);
  const areaWidth = Math.max(0, artWidth - Math.max(44, mascotSize));

  // Текст реплики, язык и тон похвал — для реплики потери.
  const lang = useLang();
  const praiseTone = useSettings((s) => s.praiseTone);
  const [lostText, setLostText] = useState<string | null>(null);

  // Низкочастотный показ эмоции (~1.2 с) — не на горячем пути.
  const [emote, setEmote] = useState<EmoteId>('none');
  const emoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showEmote = useCallback((id: EmoteId) => {
    setEmote(id);
    if (emoteTimer.current) clearTimeout(emoteTimer.current);
    emoteTimer.current = setTimeout(() => setEmote('none'), 1200);
  }, []);
  useEffect(() => {
    onEmoteReady?.(showEmote);
    return () => onEmoteReady?.(null);
  }, [onEmoteReady, showEmote]);
  useEffect(() => { onLostTextChange?.(lostText); }, [lostText, onLostTextChange]);
  useEffect(() => () => onLostTextChange?.(null), [onLostTextChange]);
  useEffect(() => () => {
    if (emoteTimer.current) clearTimeout(emoteTimer.current);
  }, []);

  // Сигнал перетаскивания самого Капи и общая пауза мозга: мозг встаёт на
  // паузу, когда активен ЛЮБОЙ drag — фигуры (dragActive) или маскота.
  const mascotDragging = useSharedValue(0);
  const mascotDropping = useSharedValue(0);
  const mascotReturning = useSharedValue(0);
  const brainPaused = useSharedValue(0);
  useAnimatedReaction(
    () =>
      active
        ? Math.max(
            dragActive.value,
            mascotDragging.value,
            mascotDropping.value,
            mascotReturning.value,
          )
        : 1,
    (v) => {
      brainPaused.value = v;
    },
  );

  useMascotBrain({ motion, stage, reduceMotion, areaWidth, dragActive: brainPaused, onEmote: showEmote });

  // Звук + хаптика моментов Капи (кормление/потеря/тап), гейтятся настройками.
  const { onLost, onTap } = useMascotFeedback();

  // Таймеры падения/реплики — чистим на размонтировании (без чтения ref в рендере).
  const dropTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => {
    dropTimers.current.forEach(clearTimeout);
    dropTimers.current = [];
  }, []);

  // «Потеря» Капи: бросок вниз за пределы пола. Вызывается через runOnJS из
  // pan.onEnd. Анимация падения — на shared values, lost-состояние персистим
  // с задержкой (после падения), реплика автоскрывается.
  const dropInFlightRef = useRef(false);
  const handleDrop = useCallback(() => {
    if (dropInFlightRef.current) return;
    dropInFlightRef.current = true;
    dropTimers.current.forEach(clearTimeout);
    dropTimers.current = [];
    mascotDropping.value = 1;
    mascotReturning.value = 0;
    cancelAnimation(motion.bob);
    cancelAnimation(motion.opacity);
    cancelAnimation(motion.rotate);
    motion.bob.value = withTiming(240, { duration: 450 });
    motion.opacity.value = withTiming(0, { duration: 450 });
    motion.rotate.value = withTiming(40, { duration: 450 });
    setLostText(mascotLost(praiseTone, lang));
    onLost();
    const t1 = setTimeout(() => useMascot.getState().drop(), 450);
    const t3 = setTimeout(() => {
      useMascot.getState().recover();
      mascotDragging.value = 0;
      mascotDropping.value = 0;
      mascotReturning.value = 0;
      dropInFlightRef.current = false;
      motion.opacity.value = withTiming(1, { duration: 200 });
      motion.rotate.value = 0;
      motion.scaleX.value = 1;
      motion.scaleY.value = 1;
      motion.bob.value = withSequence(
        withTiming(-10, { duration: 160 }),
        withSpring(0),
      );
      setLostText(null);
      showEmote('sparkle');
    }, 1_400);
    const t2 = setTimeout(() => setLostText(null), 2200);
    dropTimers.current.push(t1, t2, t3);
  }, [mascotDragging, mascotDropping, mascotReturning, motion, praiseTone, lang, onLost, showEmote]);

  // Восстановление маскота при начале новой партии (newGame / loadSaved).
  const epoch = useGameStore((s) => s.epoch);
  useEffect(() => {
    if (useMascot.getState().lost) {
      useMascot.getState().recover();
      mascotDragging.value = 0;
      mascotDropping.value = 0;
      mascotReturning.value = 0;
      dropInFlightRef.current = false;
      // Вход после возвращения: плавное появление + подпрыжок.
      // Reanimated shared values устанавливаются напрямую — не setState.
      // Полный сброс позы после падения: прозрачность/боб + поворот/масштаб.
      motion.opacity.value = withTiming(1, { duration: 200 });
      motion.rotate.value = 0;
      motion.scaleX.value = 1;
      motion.scaleY.value = 1;
      motion.bob.value = withSequence(
        withTiming(-10, { duration: 160 }),
        withSpring(0),
      );
      // setLostText/showEmote вызывают setState: откладываем на следующий тик,
      // чтобы избежать каскадного ре-рендера в теле эффекта.
      const t = setTimeout(() => {
        setLostText(null);
        showEmote('sparkle');
      }, 0);
      return () => clearTimeout(t);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [epoch]);

  // translateX всего слота (тень + маскот + эмоция) — горизонтальный ход Капи.
  const trackStyle = useAnimatedStyle(() => ({ transform: [{ translateX: motion.x.value }] }));

  // Жесты по Капи: тап (подскок + сердечко) и перетаскивание (захват/ход/бросок).
  // react-compiler's react-hooks/refs ложно срабатывает на жесте-worklet, который
  // трогает Reanimated shared values и создаётся внутри компонента (тот же паттерн
  // в useDrag проходит лишь потому, что живёт в кастомном хуке). Колбэки исполняются
  // на UI-потоке в момент жеста, не во время рендера — доступ безопасен.
  /* eslint-disable react-hooks/refs */
  const tap = Gesture.Tap().enabled(active).onEnd(() => {
    'worklet';
    motion.bob.value = withSequence(
      withTiming(-10, { duration: 140 }),
      withSpring(0, { damping: 10, stiffness: 220 }),
    );
    runOnJS(showEmote)('heart');
    runOnJS(onTap)();
  });

  const pan = Gesture.Pan()
    .enabled(active)
    .onBegin(() => {
      'worklet';
      if (mascotDropping.value) return;
      mascotReturning.value = 0;
      cancelAnimation(motion.bob);
      cancelAnimation(motion.scaleX);
      cancelAnimation(motion.scaleY);
      cancelAnimation(motion.rotate);
      mascotDragging.value = 1;
      motion.scaleX.value = withTiming(1.1, { duration: 120 });
      motion.scaleY.value = withTiming(1.1, { duration: 120 });
    })
    .onChange((e) => {
      'worklet';
      if (mascotDropping.value) return;
      // Горизонталь — в пределах пола; вертикаль (bob) следует за пальцем,
      // положительный bob = вниз, ниже пола.
      motion.x.value = Math.max(0, Math.min(areaWidth, motion.x.value + e.changeX));
      motion.bob.value = motion.bob.value + e.changeY;
    })
    .onEnd((e) => {
      'worklet';
      if (mascotDropping.value) return;
      if (motion.bob.value > DROP_THRESHOLD || e.translationY > DROP_THRESHOLD) {
        // Бросок вниз за пол → «потеря». Отдельный dropping-флаг держит мозг на паузе.
        mascotDropping.value = 1;
        runOnJS(handleDrop)();
      } else {
        // Возврат на место.
        mascotReturning.value = 1;
        cancelAnimation(motion.bob);
        cancelAnimation(motion.scaleX);
        cancelAnimation(motion.scaleY);
        cancelAnimation(motion.rotate);
        motion.bob.value = withTiming(0, { duration: LIFT_RETURN_MS }, (finished) => {
          if (finished) mascotReturning.value = 0;
        });
        motion.scaleX.value = withTiming(1, { duration: LIFT_RETURN_MS });
        motion.scaleY.value = withTiming(1, { duration: LIFT_RETURN_MS });
        motion.rotate.value = withTiming(0, { duration: LIFT_RETURN_MS });
        mascotDragging.value = 0;
      }
    })
    .onFinalize(() => {
      'worklet';
      // Подстраховка: мозг не должен остаться на паузе, если onEnd не «потерял».
      if (!mascotDropping.value && !mascotReturning.value) mascotDragging.value = 0;
    });

  // Гонка: быстрый тап → tap, протяжка → pan.
  const gesture = Gesture.Race(pan, tap);
  /* eslint-enable react-hooks/refs */

  return (
    <View style={[styles.layer, { width, height }]} pointerEvents="box-none">
      <View style={styles.area} pointerEvents="box-none">
        <View testID="mascot-chip-slot" style={[styles.chip, { left: chipLeft, width: chipWidth, height }]} pointerEvents="box-none">
          <MascotChip onPress={onOpenWardrobe} compact={compact} width={chipWidth} />
        </View>

        <View testID="mascot-art-slot" style={[styles.artSlot, { left: 0, width: artWidth, height }]} pointerEvents="box-none">
        {!lost && (
          <Animated.View style={[styles.mascotSlot, { top: (height - hitHeight) / 2, width: artWidth, height: hitHeight }, trackStyle]} pointerEvents="box-none">
            <View style={[styles.shadow, { left: (artWidth - mascotSize) / 2 + mascotSize * 0.12, width: mascotSize * 0.76 }]} pointerEvents="none" />
            <GestureDetector gesture={gesture}>
              <View style={{ width: artWidth, height: hitHeight, alignItems: 'center', justifyContent: 'center' }}>
                <Mascot motion={motion} stage={stage} equipped={equipped} size={mascotSize} />
              </View>
            </GestureDetector>
            <View style={[styles.emote, { top: -(height - hitHeight) / 2 }]} pointerEvents="none">
              <Emote id={emote} size={14} />
            </View>
          </Animated.View>
        )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'relative',
  },
  area: {
    flex: 1,
  },
  chip: {
    position: 'absolute',
    top: 0,
    justifyContent: 'center',
  },
  artSlot: {
    position: 'absolute',
    top: 0,
    overflow: 'hidden',
  },
  mascotSlot: {
    position: 'absolute',
    left: 0,
  },
  shadow: {
    position: 'absolute',
    bottom: -2,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(8,14,28,0.35)',
  },
  emote: {
    position: 'absolute',
    right: 0,
  },
});
