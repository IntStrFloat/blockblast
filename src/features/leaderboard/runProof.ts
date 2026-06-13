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
