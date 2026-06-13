export type RunMode = 'weekly' | 'daily';
export type LeaderboardViewState = 'idle' | 'loading' | 'ready' | 'empty' | 'cached' | 'error';

export interface ProfileIdentity {
  nickname: string;
  normalizedNickname: string;
  tag: string;
  seed: number;
}

export interface RankedTicket {
  ticketId: string;
  seed: number;
  expiresAt: string;
}

export interface RunMove {
  trayIndex: number;
  row: number;
  col: number;
}

export interface RunProof {
  id: string;
  seed: number;
  startedAt: string;
  finishedAt: string | null;
  mode: RunMode;
  challengeDate: string | null;
  moves: RunMove[];
  frozenScore: number | null;
  ranked: boolean;
  ticketId: string | null;
}

export interface PendingSubmission {
  proofId: string;
  ticketId: string;
  seed: number;
  score: number;
  durationMs: number;
  moves: RunMove[];
  queuedAt: string;
}

export interface VerifiedRun {
  id: string;
  weekKey: string;
  score: number;
  seed: number;
  moves: RunMove[];
  durationMs: number;
  completedAt: string;
  runsCount: number;
}

export interface LeaderboardEntry {
  nickname: string;
  tag: string;
  rank: number | null;
  weeklyBest: number;
  runsCount: number;
  achievedAt: string | null;
  isCurrentPlayer: boolean;
}

export interface WeeklyLeaderboardSnapshot {
  weekKey: string;
  weekStartIso: string;
  weekEndIso: string;
  generatedAt: string;
  source: 'local' | 'remote';
  isCached: boolean;
  currentPlayer: LeaderboardEntry;
  entries: LeaderboardEntry[];
}

export interface WeeklyImpact {
  score: number;
  weeklyBest: number;
  rank: number | null;
  rankDelta: number | null;
  improved: boolean;
  queued: boolean;
}

export interface BackendProfileSession {
  profile: {
    nickname: string;
    tag: string;
  };
  authToken: string;
}
