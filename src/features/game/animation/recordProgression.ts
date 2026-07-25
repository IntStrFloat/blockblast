export const RECORD_PROGRESS = {
  pursuitRatio: 0.18,
  pursuitMin: 180,
  pursuitMax: 1_200,
  nearRatio: 0.06,
  nearMin: 60,
  nearMax: 300,
  goalChipEnterMs: 220,
  celebrationMs: 1_450,
  recordSoundDelayMs: 180,
} as const;

export type RecordProgressStage =
  | 'first_run'
  | 'normal'
  | 'pursuit'
  | 'near'
  | 'record_broken'
  | 'post_record';

export interface RecordProgress {
  stage: RecordProgressStage;
  progress: number;
  remaining: number;
  lead: number;
  target: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function finiteScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

export function recordProgressWindowFor(bestAtStart: number): {
  pursuit: number;
  near: number;
} {
  const best = finiteScore(bestAtStart);
  return {
    pursuit: clamp(
      Math.round(best * RECORD_PROGRESS.pursuitRatio),
      RECORD_PROGRESS.pursuitMin,
      RECORD_PROGRESS.pursuitMax,
    ),
    near: clamp(
      Math.round(best * RECORD_PROGRESS.nearRatio),
      RECORD_PROGRESS.nearMin,
      RECORD_PROGRESS.nearMax,
    ),
  };
}

export function recordProgressFor(
  scoreValue: number,
  bestAtStartValue: number,
  previousScoreValue = scoreValue,
): RecordProgress {
  const score = finiteScore(scoreValue);
  const bestAtStart = finiteScore(bestAtStartValue);
  const previousScore = finiteScore(previousScoreValue);

  if (bestAtStart <= 0) {
    return { stage: 'first_run', progress: 0, remaining: 0, lead: 0, target: 0 };
  }

  const target = bestAtStart + 1;
  const remaining = Math.max(0, target - score);
  const lead = Math.max(0, score - bestAtStart);
  const progress = clamp(score / target, 0, 1);

  if (score > bestAtStart) {
    return {
      stage: previousScore <= bestAtStart ? 'record_broken' : 'post_record',
      progress: 1,
      remaining,
      lead,
      target,
    };
  }

  const window = recordProgressWindowFor(bestAtStart);
  const stage: RecordProgressStage =
    remaining <= window.near
      ? 'near'
      : remaining <= window.pursuit
        ? 'pursuit'
        : 'normal';

  return { stage, progress, remaining, lead, target };
}

export function recordSceneIntensityFor(stage: RecordProgressStage): number {
  switch (stage) {
    case 'pursuit':
      return 0.28;
    case 'near':
      return 0.62;
    case 'record_broken':
      return 1;
    case 'post_record':
      return 0.3;
    default:
      return 0;
  }
}

export function recordMoteBonusFor(stage: RecordProgressStage): number {
  if (stage === 'near') return 2;
  if (stage === 'pursuit' || stage === 'post_record') return 1;
  return 0;
}
