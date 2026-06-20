/**
 * useMascotBrain — «мозг» Капи: низкочастотный JS-планировщик idle-поведения,
 * отдельный таймер моргания, реакции на игровые события и пауза на время drag.
 *
 * Перф (спека 07/09):
 *  - Пока активен drag, планировщик и таймеры ПОЛНОСТЬЮ на паузе; никакой JS-работы
 *    на горячем пути. Сигнал drag — shared value, читается через useAnimatedReaction.
 *  - Вся анимация — Reanimated shared values (withTiming/withSpring/withSequence/...),
 *    ноль setState и ноль JS на кадр.
 *  - Планировщик делает одно действие раз в ~1–3 с (durationMs из nextAction).
 */
import { useEffect, useRef } from 'react';
import {
  cancelAnimation,
  runOnJS,
  useAnimatedReaction,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { useGameStore } from '@/features/game';

import type { MascotMotion } from '../components/Mascot';
import { nextAction } from '../logic/behavior';
import { MASCOT_CONFIG } from '../logic/config';
import type { ActionId, BehaviorAction, EmoteId, Stage } from '../logic/types';
import { useMascot } from '../store';

export interface MascotBrainParams {
  motion: MascotMotion;
  stage: Stage;
  reduceMotion: boolean;
  /** Горизонтальный диапазон (px), в пределах которого Капи может ходить. */
  areaWidth: number;
  dragActive: SharedValue<number>;
  /** Слой показывает <Emote> при вызове. */
  onEmote: (id: EmoteId) => void;
}

// ---------------------------------------------------------------------------
// applyAction — BehaviorAction → анимации shared values маскота
// ---------------------------------------------------------------------------

/** Сброс «ходячего» боба и наклона к нейтрали. */
function settleNeutral(motion: MascotMotion): void {
  cancelAnimation(motion.bob);
  motion.bob.value = withTiming(0, { duration: 300 });
  motion.scaleX.value = withTiming(1, { duration: 300 });
  motion.scaleY.value = withTiming(1, { duration: 300 });
  motion.rotate.value = withTiming(0, { duration: 300 });
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Применяет действие к motion. Конкретно реализованы перечисленные в спеке,
 * остальные сводятся к разумной нейтрали.
 */
function applyAction(
  motion: MascotMotion,
  action: BehaviorAction,
  areaWidth: number,
): void {
  switch (action.id) {
    case 'walkLeft':
    case 'walkRight': {
      const dir = action.dir ?? 1;
      motion.facing.value = dir;
      const target = clamp(motion.x.value + dir * (areaWidth * 0.35), 0, areaWidth);
      motion.x.value = withTiming(target, { duration: action.durationMs });
      // Мягкий «шагающий» боб на время ходьбы.
      motion.bob.value = withRepeat(
        withSequence(
          withTiming(-3, { duration: 160 }),
          withTiming(0, { duration: 160 }),
        ),
        -1,
      );
      break;
    }

    case 'sleep': {
      cancelAnimation(motion.bob);
      motion.bob.value = withTiming(2, { duration: 400 });
      motion.scaleY.value = withTiming(0.92, { duration: 400 });
      // emote 'sleep' приходит через action.emote → onEmote.
      break;
    }

    case 'hop': {
      cancelAnimation(motion.bob);
      motion.bob.value = withSequence(
        withTiming(-12, { duration: 160 }),
        withSpring(0, { damping: 10, stiffness: 220 }),
      );
      break;
    }

    case 'stretch':
    case 'yawn': {
      cancelAnimation(motion.bob);
      motion.scaleY.value = withSequence(
        withTiming(1.12, { duration: 240 }),
        withTiming(1, { duration: 360 }),
      );
      break;
    }

    case 'faceplant': {
      motion.rotate.value = withSequence(
        withTiming(85, { duration: 200 }),
        withDelay(300, withSpring(0, { damping: 12, stiffness: 180 })),
      );
      break;
    }

    case 'spin': {
      cancelAnimation(motion.bob);
      motion.rotate.value = withSequence(
        withTiming(360, { duration: action.durationMs }),
        withTiming(0, { duration: 0 }),
      );
      break;
    }

    case 'dance': {
      // Лёгкое покачивание корпусом.
      cancelAnimation(motion.bob);
      motion.bob.value = withRepeat(
        withSequence(
          withTiming(-6, { duration: 200 }),
          withTiming(0, { duration: 200 }),
        ),
        -1,
        true,
      );
      break;
    }

    case 'wobble': {
      cancelAnimation(motion.rotate);
      motion.rotate.value = withSequence(
        withTiming(-8, { duration: 120 }),
        withTiming(8, { duration: 160 }),
        withSpring(0, { damping: 10, stiffness: 200 }),
      );
      break;
    }

    default: {
      // idle / sit / lieDown / look* / groom / sniff / scratch / wave /
      // ponder / sparkleIdle / *Block / sneeze / peekDown и пр.:
      // settle к нейтральной позе + едва заметное «дыхание».
      settleNeutral(motion);
      motion.scaleY.value = withSequence(
        withTiming(1.02, { duration: 700 }),
        withTiming(1, { duration: 700 }),
      );
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Реакции на игровые события
// ---------------------------------------------------------------------------

type ReactionKind = 'gameOver' | 'fire' | 'clear' | 'nod';

function react(
  motion: MascotMotion,
  kind: ReactionKind,
  onEmote: (id: EmoteId) => void,
): void {
  switch (kind) {
    case 'gameOver': {
      // Поникнуть: сжаться по вертикали.
      cancelAnimation(motion.bob);
      motion.scaleY.value = withTiming(0.8, { duration: 400 });
      motion.bob.value = withTiming(6, { duration: 400 });
      onEmote('sleep');
      break;
    }
    case 'fire': {
      // Спин-«танец» при комбо ≥ 3.
      cancelAnimation(motion.bob);
      motion.rotate.value = withSequence(
        withTiming(360, { duration: 600 }),
        withTiming(0, { duration: 0 }),
      );
      motion.bob.value = withSequence(
        withTiming(-10, { duration: 200 }),
        withSpring(0, { damping: 10, stiffness: 220 }),
      );
      onEmote('fire');
      break;
    }
    case 'clear': {
      // Прыжок радости при очистке линий.
      cancelAnimation(motion.bob);
      motion.bob.value = withSequence(
        withTiming(-12, { duration: 160 }),
        withSpring(0, { damping: 9, stiffness: 220 }),
      );
      onEmote('sparkle');
      break;
    }
    case 'nod': {
      // Маленький кивок.
      cancelAnimation(motion.bob);
      motion.bob.value = withSequence(
        withTiming(-4, { duration: 120 }),
        withTiming(0, { duration: 180 }),
      );
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useMascotBrain(params: MascotBrainParams): void {
  const { dragActive } = params;

  // Свежие значения параметров для долгоживущих таймеров/подписок.
  // Обновляем в эффекте, а не в теле рендера (правило react-hooks/refs).
  const paramsRef = useRef(params);
  useEffect(() => {
    paramsRef.current = params;
  });

  // Карта {actionId → ts последнего применения} для кулдаунов.
  const recentRef = useRef<Map<ActionId, number>>(new Map());
  const pausedRef = useRef(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blinkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ссылка на актуальный планировщик — чтобы resume после паузы перезапускал
  // ровно тот же цикл, без дубля кода.
  const scheduleNextRef = useRef<() => void>(() => {});

  // --- Idle-планировщик + моргание + подписка на игру: ставится один раз ---
  useEffect(() => {
    const recent = recentRef.current;

    function scheduleNext(): void {
      if (pausedRef.current) return;
      const p = paramsRef.current;
      const ctx = {
        stage: p.stage,
        hourOfDay: new Date().getHours(),
        reduceMotion: p.reduceMotion,
        mood: 'neutral' as const,
      };
      const now = Date.now();
      const { action, rngState } = nextAction(
        recent,
        now,
        ctx,
        useMascot.getState().rngState,
      );
      useMascot.getState().bumpRng(rngState);
      recent.set(action.id, now);

      applyAction(p.motion, action, p.areaWidth);
      if (action.emote) p.onEmote(action.emote);

      idleTimerRef.current = setTimeout(scheduleNext, action.durationMs);
    }
    scheduleNextRef.current = scheduleNext;

    function scheduleBlink(): void {
      const { minMs, maxMs } = MASCOT_CONFIG.blink;
      const delay = minMs + Math.random() * (maxMs - minMs);
      blinkTimerRef.current = setTimeout(() => {
        if (!pausedRef.current) {
          const { motion } = paramsRef.current;
          motion.eyeOpen.value = withSequence(
            withTiming(0, { duration: 80 }),
            withTiming(1, { duration: 120 }),
          );
        }
        scheduleBlink();
      }, delay);
    }

    // Реакции на новые игровые события (по ссылке lastEvent).
    let prevEvent = useGameStore.getState().lastEvent;
    const unsubscribe = useGameStore.subscribe((state) => {
      const event = state.lastEvent;
      if (event === prevEvent) return;
      prevEvent = event;
      if (!event) return;

      // Капи больше не владеет очками/уровнем: начисление счёта — у координатора
      // useProgressionSync (спека 15). Здесь — только визуальная реакция.

      // Поза-реакция не запускается во время drag.
      if (pausedRef.current) return;

      const { motion, onEmote } = paramsRef.current;
      const lines = event.clearedRows.length + event.clearedCols.length;
      if (event.gameOver) react(motion, 'gameOver', onEmote);
      else if (event.onFire) react(motion, 'fire', onEmote);
      else if (lines > 0) react(motion, 'clear', onEmote);
      else react(motion, 'nod', onEmote);
    });

    scheduleNext();
    scheduleBlink();

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (blinkTimerRef.current) clearTimeout(blinkTimerRef.current);
      idleTimerRef.current = null;
      blinkTimerRef.current = null;
      unsubscribe();
    };
    // Один раз на маунт: внутри читаем свежие значения из refs.
  }, []);

  // --- Пауза/возобновление по сигналу drag (UI-поток → JS один раз на смену) ---
  function setPaused(next: boolean): void {
    if (pausedRef.current === next) return;
    pausedRef.current = next;
    if (next) {
      // Стоп планировщика: чистим таймер и замораживаем позу.
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
      const { motion } = paramsRef.current;
      cancelAnimation(motion.x);
      cancelAnimation(motion.bob);
      cancelAnimation(motion.scaleX);
      cancelAnimation(motion.scaleY);
      cancelAnimation(motion.rotate);
    } else {
      // Возобновление idle-цикла тем же планировщиком.
      if (!idleTimerRef.current) scheduleNextRef.current();
    }
  }

  useAnimatedReaction(
    () => dragActive.value,
    (v, prev) => {
      if (v !== prev) runOnJS(setPaused)(v === 1);
    },
  );
}
