import type { RankedTicket, RunMode, RunMove, RunProof } from './types';

interface BeginRunProofInput {
  seed: number;
  startedAt: string;
  mode: RunMode;
  challengeDate?: string | null;
  ticket?: RankedTicket | null;
}

interface FinalizeRunProofInput {
  score: number;
  finishedAt: string;
}

export function beginRunProof(input: BeginRunProofInput): RunProof {
  return {
    id: `${input.mode}:${input.seed}:${input.startedAt}`,
    seed: input.seed,
    startedAt: input.startedAt,
    finishedAt: null,
    mode: input.mode,
    challengeDate: input.challengeDate ?? null,
    moves: [],
    frozenScore: null,
    ranked: Boolean(input.ticket),
    ticketId: input.ticket?.ticketId ?? null,
  };
}

export function appendRunMove(proof: RunProof, move: RunMove): RunProof {
  if (proof.frozenScore !== null) return proof;
  return {
    ...proof,
    moves: [...proof.moves, move],
  };
}

export function finalizeRunProof(proof: RunProof, input: FinalizeRunProofInput): RunProof {
  if (proof.frozenScore !== null) return proof;
  return {
    ...proof,
    frozenScore: input.score,
    finishedAt: input.finishedAt,
  };
}

/**
 * Переоткрывает завершённый ран после ревайва: снимает заморозку, чтобы можно
 * было дописать ходы и финализировать с финальным счётом. Ран помечается как
 * продолженный и снимается с ranked — реплей такого рана не сойдётся (ревайв
 * очищает доску посреди партии), поэтому он обновляет лишь локальный результат.
 */
export function reopenRunProof(proof: RunProof): RunProof {
  return {
    ...proof,
    frozenScore: null,
    finishedAt: null,
    ranked: false,
    ticketId: null,
    continued: true,
  };
}
