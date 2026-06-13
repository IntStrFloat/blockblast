import { rngNext, rngInt } from '@/core/engine';
import { MASCOT_CONFIG } from './config';
import type { ActionSpec } from './config';
import type { ActionId, BehaviorAction, BehaviorCtx } from './types';

/**
 * Выбирает следующее действие маскота на основе взвешенного случайного выбора
 * с учётом кулдаунов, стадии, режима уменьшения движения и ночного буста.
 *
 * NOTE: 'blink' всегда исключается — у него собственный таймер.
 *
 * @param recent  Карта {actionId → timestamp последнего использования}
 * @param now     Текущее время (ms), например Date.now()
 * @param ctx     Контекст поведения (стадия, час, reduceMotion, настроение)
 * @param rngState Начальное состояние RNG (mulberry32, 32-бит)
 * @returns Выбранное действие и обновлённое состояние RNG
 */
export function nextAction(
  recent: Map<ActionId, number>,
  now: number,
  ctx: BehaviorCtx,
  rngState: number,
): { action: BehaviorAction; rngState: number } {
  const isNight = ctx.hourOfDay >= MASCOT_CONFIG.nightHour;

  // Step 1: Build candidate pool -----------------------------------------------
  let pool: ActionSpec[] = MASCOT_CONFIG.actions.filter(spec => {
    // Always exclude blink (own timer)
    if (spec.id === 'blink') return false;

    // Stage gating
    if (spec.minStage > ctx.stage) return false;

    // reduce-motion: only calm actions allowed
    if (ctx.reduceMotion && !spec.calm) return false;

    // Cooldown: strictly less than cooldownMs elapsed since last use
    const lastUsed = recent.get(spec.id as ActionId);
    if (lastUsed !== undefined && now - lastUsed < spec.cooldownMs) return false;

    return true;
  });

  // Step 2: Fallback to idle if pool is empty ----------------------------------
  if (pool.length === 0) {
    const idleSpec = MASCOT_CONFIG.actions.find(s => s.id === 'idle')!;
    pool = [idleSpec];
  }

  // Step 3: Weighted pick -------------------------------------------------------
  // Compute effective weights (night boost applied if applicable)
  const weights = pool.map(spec =>
    spec.weight * (isNight ? (spec.nightBoost ?? 1) : 1),
  );
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  // Draw a value in [0, 1)
  const rDraw = rngNext(rngState);
  rngState = rDraw.state;

  // Pick by cumulative weight
  const target = rDraw.value * totalWeight;
  let cumulative = 0;
  let chosen = pool[pool.length - 1]; // default to last (guards floating-point edge)
  for (let i = 0; i < pool.length; i++) {
    cumulative += weights[i];
    if (target < cumulative) {
      chosen = pool[i];
      break;
    }
  }

  // Step 4: Duration draw -------------------------------------------------------
  const durationRange = chosen.maxDurationMs - chosen.minDurationMs;
  const rDur = rngInt(rngState, durationRange + 1);
  rngState = rDur.state;
  const durationMs = chosen.minDurationMs + rDur.value;

  // Step 5: Dir (only for moving actions) ----------------------------------------
  let dir: -1 | 1 | undefined;
  if (chosen.moving) {
    const rDir = rngInt(rngState, 2);
    rngState = rDir.state;
    dir = rDir.value === 0 ? -1 : 1;
  }

  // Step 6: Build result --------------------------------------------------------
  const action: BehaviorAction = {
    id: chosen.id,
    durationMs,
    ...(dir !== undefined && { dir }),
    ...(chosen.emote !== undefined && { emote: chosen.emote }),
  };

  return { action, rngState };
}
