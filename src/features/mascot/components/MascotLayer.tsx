import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { getBoardMetrics } from '@/ui';
import { mascotLost } from '@/core/i18n';
import { useLang, useSettings } from '@/features/settings';
import { useGameStore } from '@/features/game';
import { todayISO } from '@/features/streak';

import { useMascotBrain } from '../hooks/useMascotBrain';
import { canFeed } from '../logic/rules';
import { progressFor } from '../logic/progression';
import type { EmoteId } from '../logic/types';
import { useMascot } from '../store';
import { Emote } from './Emote';
import { FeedPrompt } from './FeedPrompt';
import { HelperHint } from './HelperHint';
import { HelperSwap } from './HelperSwap';
import { LevelUpReveal } from './LevelUpReveal';
import { Mascot, useMascotMotion } from './Mascot';
import { MascotChip } from './MascotChip';
import { MascotIntro } from './MascotIntro';
import { SpeechBubble } from './SpeechBubble';
import { Wardrobe } from './Wardrobe';

const MASCOT_SIZE = 56;
const LAYER_HEIGHT = 70;
/** Сдвиг вниз (≈ собственный рост), за которым отпускание = «потеря». */
const DROP_THRESHOLD = MASCOT_SIZE;

interface MascotLayerProps {
  dragActive: SharedValue<number>;
}

/**
 * Публичный слой Капи над доской: позиционирование, монтирование «мозга»,
 * чип уровня, реакция на тап, эмоции и reduce-motion.
 *
 * Монтируется только при включённой настройке showMascot — иначе ни мозг,
 * ни таймеры не запускаются. Капи можно перетаскивать: бросок вниз за пределы
 * «пола» (за DROP_THRESHOLD) → падение, реплика потери и состояние lost до
 * следующей партии (восстановление — в recover-эффекте по epoch).
 */
export function MascotLayer({ dragActive }: MascotLayerProps) {
  const showMascot = useSettings((s) => s.showMascot);
  const [wardrobeOpen, setWardrobeOpen] = useState(false);
  if (!showMascot) return null;
  return (
    <>
      <MascotLayerInner dragActive={dragActive} onOpenWardrobe={() => setWardrobeOpen(true)} />
      <LevelUpReveal />
      <Wardrobe visible={wardrobeOpen} onClose={() => setWardrobeOpen(false)} />
    </>
  );
}

function MascotLayerInner({ dragActive, onOpenWardrobe }: MascotLayerProps & { onOpenWardrobe: () => void }) {
  const motion = useMascotMotion();

  const totalXp = useMascot((s) => s.totalXp);
  const equipped = useMascot((s) => s.equipped);
  const stage = progressFor(totalXp).stage;

  // Потерян ли маскот (Task 15b устанавливает, здесь только читаем).
  const lost = useMascot((s) => s.lost);

  // Ежедневное кормление: доступно ли сегодня.
  const lastFedDay = useMascot((s) => s.lastFedDay);
  const canFeedNow = canFeed(lastFedDay, todayISO());

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
  useEffect(() => () => {
    if (emoteTimer.current) clearTimeout(emoteTimer.current);
  }, []);

  // Сигнал перетаскивания самого Капи и общая пауза мозга: мозг встаёт на
  // паузу, когда активен ЛЮБОЙ drag — фигуры (dragActive) или маскота.
  const mascotDragging = useSharedValue(0);
  const brainPaused = useSharedValue(0);
  useAnimatedReaction(
    () => Math.max(dragActive.value, mascotDragging.value),
    (v) => {
      brainPaused.value = v;
    },
  );

  useMascotBrain({ motion, stage, reduceMotion, areaWidth, dragActive: brainPaused, onEmote: showEmote });

  // Кормление: обработчик нажатия на FeedPrompt.
  // Вызывается из JS (Pressable onPress) — shared values устанавливаем напрямую.
  const handleFeed = useCallback(() => {
    useMascot.getState().feed();
    // Пульс «съедает угощение»
    motion.scaleX.value = withSequence(withTiming(1.12, { duration: 120 }), withSpring(1));
    motion.scaleY.value = withSequence(withTiming(1.12, { duration: 120 }), withSpring(1));
    showEmote('heart');
  }, [motion, showEmote]);

  // Таймеры падения/реплики — чистим на размонтировании (без чтения ref в рендере).
  const dropTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => {
    dropTimers.current.forEach(clearTimeout);
    dropTimers.current = [];
  }, []);

  // «Потеря» Капи: бросок вниз за пределы пола. Вызывается через runOnJS из
  // pan.onEnd. Анимация падения — на shared values, lost-состояние персистим
  // с задержкой (после падения), реплика автоскрывается.
  const handleDrop = useCallback(() => {
    motion.bob.value = withTiming(240, { duration: 450 });
    motion.opacity.value = withTiming(0, { duration: 450 });
    motion.rotate.value = withTiming(40, { duration: 450 });
    setLostText(mascotLost(praiseTone, lang));
    const t1 = setTimeout(() => useMascot.getState().drop(), 450);
    const t2 = setTimeout(() => setLostText(null), 2200);
    dropTimers.current.push(t1, t2);
  }, [motion, praiseTone, lang]);

  // Восстановление маскота при начале новой партии (newGame / loadSaved).
  const epoch = useGameStore((s) => s.epoch);
  useEffect(() => {
    if (useMascot.getState().lost) {
      useMascot.getState().recover();
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
  const tap = Gesture.Tap().onEnd(() => {
    'worklet';
    motion.bob.value = withSequence(
      withTiming(-10, { duration: 140 }),
      withSpring(0, { damping: 10, stiffness: 220 }),
    );
    runOnJS(showEmote)('heart');
  });

  const pan = Gesture.Pan()
    .onBegin(() => {
      'worklet';
      mascotDragging.value = 1;
      motion.scaleX.value = withTiming(1.1, { duration: 120 });
      motion.scaleY.value = withTiming(1.1, { duration: 120 });
    })
    .onChange((e) => {
      'worklet';
      // Горизонталь — в пределах пола; вертикаль (bob) следует за пальцем,
      // положительный bob = вниз, ниже пола.
      motion.x.value = Math.max(0, Math.min(areaWidth, motion.x.value + e.changeX));
      motion.bob.value = motion.bob.value + e.changeY;
    })
    .onEnd((e) => {
      'worklet';
      if (e.translationY > DROP_THRESHOLD) {
        // Бросок вниз за пол → «потеря». mascotDragging сбросит onFinalize.
        runOnJS(handleDrop)();
      } else {
        // Возврат на место.
        motion.bob.value = withSpring(0);
        motion.scaleX.value = withSpring(1);
        motion.scaleY.value = withSpring(1);
        mascotDragging.value = 0;
      }
    })
    .onFinalize(() => {
      'worklet';
      // Подстраховка: мозг не должен остаться на паузе, если onEnd не «потерял».
      mascotDragging.value = 0;
    });

  // Гонка: быстрый тап → tap, протяжка → pan.
  const gesture = Gesture.Race(pan, tap);
  /* eslint-enable react-hooks/refs */

  return (
    <View style={styles.layer} pointerEvents="box-none">
      <View style={[styles.area, { width: boardSize }]} pointerEvents="box-none">
        {/* Чип уровня — верхний левый угол полосы доски. */}
        <View style={styles.chip} pointerEvents="box-none">
          <MascotChip onPress={onOpenWardrobe} />
        </View>

        {/* Мягкие помощники — верхний правый угол. Каждый сам решает, показываться
            ли (затык / непомещаемая фигура + кулдаун). Недоступны, пока Капи потерян. */}
        {!lost && (
          <View style={styles.helpers} pointerEvents="box-none">
            <HelperHint onEmote={showEmote} reduceMotion={reduceMotion} />
            <HelperSwap onEmote={showEmote} reduceMotion={reduceMotion} />
          </View>
        )}

        {/* Маскот в нижнем левом углу; горизонтальный ход — через trackStyle (motion.x),
            чтобы тень и эмоция двигались вместе с Капи. */}
        {!lost && (
          <Animated.View style={[styles.mascotSlot, trackStyle]} pointerEvents="box-none">
            {/* Угощение: кнопка кормления над маскотом (один раз в сутки). */}
            {canFeedNow && (
              <View style={styles.feedPrompt} pointerEvents="box-none">
                <FeedPrompt onPress={handleFeed} />
              </View>
            )}
            {/* Мягкая «тень»-овал под маскотом. */}
            <View style={styles.shadow} pointerEvents="none" />
            <GestureDetector gesture={gesture}>
              <View style={styles.mascotHit}>
                <Mascot motion={motion} stage={stage} equipped={equipped} size={MASCOT_SIZE} />
                {/* Пузырь-эмоция над маскотом (none → null). */}
                <View style={styles.emote} pointerEvents="none">
                  <Emote id={emote} />
                </View>
              </View>
            </GestureDetector>
          </Animated.View>
        )}

        {/* Реплика «потери»: над центром полосы — видна и после падения/анмаунта. */}
        {lostText ? (
          <View style={styles.lostBubble} pointerEvents="none">
            <SpeechBubble text={lostText} />
          </View>
        ) : null}

        {/* Тонкая линия «пола». */}
        <View style={styles.floor} pointerEvents="none" />

        {/* Интро первого захода: неблокирующее, разовое (self-guards на introDone). */}
        <MascotIntro onEmote={showEmote} />
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
  helpers: {
    position: 'absolute',
    top: 0,
    right: 0,
    alignItems: 'flex-end',
    gap: 6,
    zIndex: 3,
  },
  lostBubble: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 4,
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
  feedPrompt: {
    position: 'absolute',
    bottom: MASCOT_SIZE,
    left: 0,
    zIndex: 3,
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
