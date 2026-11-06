import { create } from 'zustand';

import {
  DEFAULT_CONFIG,
  configForExperience,
  createAdventureRun,
  createGame,
  deserialize,
  deserializeClassicCheckpoint,
  deserializeAdventureRun,
  placeAdventure,
  place,
  replaceTrayPiece as engineReplaceTrayPiece,
  revive,
  rescueAdventureRun,
  seedFromTime,
  serializeAdventureRun,
  serializeClassicCheckpoint,
  serialize,
} from '@/core/engine';
import type {
  AdventureHelpPolicy,
  AdventureLevelSpec,
  AdventurePlacementEvent,
  AdventureRun,
  Board,
  ClassicCheckpointMeta,
  GameConfig,
  GameState,
  PlacementEvent,
} from '@/core/engine';
import {
  KEYS,
  getJSON,
  getString,
  removeKey,
  setJSON,
  setString,
  setStringOrThrow,
} from '@/core/storage';
import { adventureCompletionIdentity, adventureXpForLevel } from '@/features/adventure/logic/xp';
import { seasonRewardCosmetic } from '@/features/adventure/logic/config';
import { seasonLength } from '@/features/adventure/logic/seasons';
import { useAdventure } from '@/features/adventure/store';
import {
  recordAttributedNextRun,
  recordNextGoalCompletion,
  useAnalyticsStore,
} from '@/features/analytics';
import { useLeaderboardStore } from '@/features/leaderboard/store';
import { useMascot } from '@/features/mascot/store';
import {
  loadAdsMeta,
  recordAdventureFail,
  recordAdventureLevelWin,
  saveAdsMeta,
} from '@/features/monetization';
import { useAdPresentation } from '@/features/monetization/adPresentation';
import { recordMeaningfulSessionForPush } from '@/features/notifications/softAsk';
import {
  FTUE_EXPERIMENT_ID,
  ftueCheckpointForRun,
  shouldShowFtueAssistance,
  useFtueStore,
} from '@/features/onboarding/ftueStore';
import { findTutorialRecommendation } from '@/features/onboarding/tutorialGame';
import { useScores } from '@/features/scores';
import type { SubmitResult } from '@/features/scores';
import { rewardReceiptKey, useProgression } from '@/features/progression/store';
import { rewardsBetween } from '@/features/progression/logic/rewards';
import { useSettings } from '@/features/settings';
import { todayISO, useStreak } from '@/features/streak';

import { recordProgressFor } from './animation/recordProgression';
import { playPlacementFeedback } from './sound/feedback';
import { playSound } from './sound/sounds';

export interface NewGameOptions {
  seed?: number;
  analyticsSource?: 'home' | 'result' | 'restart';
  /** Optional deterministic fixture used by the first-install tutorial only. */
  initialGame?: GameState;
}

export type ResumeKind = 'none' | 'active' | 'terminal';

export type SavedGameKind = 'none' | 'active' | 'terminal_revivable' | 'terminal_final';

export type ClassicRunMeta = ClassicCheckpointMeta;

/** Repair the split board/proof commit only for the proof belonging to this run. */
export function reconcileRevivedLeaderboardProof(game: GameState, meta: ClassicRunMeta): boolean {
  if (!game.reviveUsed || game.status !== 'playing' || !meta.leaderboardProofId) return true;
  return useLeaderboardStore.getState().reopenActiveRun(meta.leaderboardProofId);
}

export interface SavedGameSummary {
  mode: 'classic';
  kind: SavedGameKind;
  runId: string | null;
  score: number | null;
  canContinue: boolean;
  runKind: 'classic' | 'tutorial' | null;
  fallbackReason?: 'corrupt' | 'incompatible';
}

export interface SavedAdventureSummary {
  mode: 'adventure';
  kind: 'none' | 'active' | 'terminal';
  runId: string | null;
  score: number | null;
  seasonId: number | null;
  levelIndex: number | null;
  attempt: number | null;
  status: 'playing' | 'won' | 'failed' | null;
  objectiveType: 'score' | 'jewels' | null;
  objectiveCurrent: number | null;
  objectiveTarget: number | null;
  fallbackReason?: 'corrupt' | 'incompatible';
}

export interface RecordCelebration {
  score: number;
  previousBest: number;
}

/** Config the классической партии дилит трей с FTUE-ассистом для новичков. */
function classicConfigFor(): { configId: string; config: GameConfig } {
  const gamesPlayed = useScores.getState().gamesPlayed;
  return {
    configId: `classic-experience-${Math.min(6, Math.max(0, gamesPlayed))}`,
    config: configForExperience(gamesPlayed),
  };
}

export interface AdventureOutcomeSettlement {
  runId: string;
  completionId: string | null;
  status: 'won' | 'failed';
  campaignApplied: boolean;
  xpGranted: number;
  fromLevel: number;
  toLevel: number;
  completedSeason: number | null;
}

let persistedRunSequence = 0;

function createPersistedRunId(kind: 'classic' | 'adventure'): string {
  persistedRunSequence += 1;
  return `${kind}-${Date.now().toString(36)}-${persistedRunSequence.toString(36)}-${Math.random().toString(36).slice(2, 12)}-${Math.random().toString(36).slice(2, 8)}`;
}

interface GameStore {
  game: GameState;
  /** Активный конфиг текущей классической партии (FTUE-ассист новичкам). */
  activeConfig: GameConfig;
  adventure: AdventureRun | null;
  lastEvent: PlacementEvent | null;
  boardRecovery: { previousBoard: Board; board: Board } | null;
  lastAdventureEvent: AdventurePlacementEvent | null;
  linesCleared: number;
  finalResult: SubmitResult | null;
  classicMeta: ClassicRunMeta | null;
  epoch: number;
  runBestAtStart: number;
  recordCelebration: RecordCelebration | null;
  recordCelebrated: boolean;
  newGame: (options?: NewGameOptions) => void;
  newAdventureGame: (
    spec: AdventureLevelSpec,
    attempt?: number,
    analyticsSource?: 'home' | 'restart' | 'next',
    helpPolicy?: AdventureHelpPolicy,
  ) => void;
  resumeSavedAdventure: (spec: AdventureLevelSpec) => AdventureRun | null;
  suspendAdventure: () => void;
  exitAdventure: () => void;
  discardAdventure: () => void;
  markAdventureOutcomeSettled: (runId: string, at?: number) => void;
  setAdventureRetryPolicy: (runId: string, policy: AdventureHelpPolicy) => boolean;
  settleAdventureOutcome: (runId: string) => AdventureOutcomeSettlement | null;
  discardAndStartNew: (options?: NewGameOptions) => void;
  placePiece: (trayIndex: number, r: number, c: number) => PlacementEvent | null;
  replaceTrayPiece: (trayIndex: number) => void;
  restoreGame: (snapshot: GameState) => void;
  continueGame: (expectedRunId?: string) => boolean;
  helperHint?: { trayIndex: number; r: number; c: number } | null;
  recoverHelperRescues: () => void;
  finishCurrentResult: () => void;
  settleClassicRun: (
    reason: 'home' | 'replay' | 'restart' | 'final_game_over',
  ) => SubmitResult | null;
  pauseClassicActivity: () => void;
  resumeClassicActivity: () => void;
  syncTutorialCheckpoint: () => void;
  loadSaved: () => Exclude<ResumeKind, 'none'> | null;
}

/** A rewarded clear is available only for the current, unfinished terminal run. */
export function canOfferBoardRecovery(
  { game, adventure, classicMeta }: Pick<GameStore, 'game' | 'adventure' | 'classicMeta'>,
  runId: string | undefined,
): boolean {
  if (!runId || game.status !== 'over' || game.reviveUsed) return false;
  if (adventure) {
    return adventure.runId === runId && adventure.status === 'failed' &&
      !adventure.resultAcknowledged && !adventure.helperSpend;
  }
  return classicMeta?.runId === runId && classicMeta.lifecycle === 'terminal_revivable' &&
    !classicMeta.resultAcknowledged && !classicMeta.helperSpend;
}

function buildFreshPresentationState(
  best: number,
): Pick<GameStore, 'runBestAtStart' | 'recordCelebration' | 'recordCelebrated'> {
  return {
    runBestAtStart: best,
    recordCelebration: null,
    recordCelebrated: false,
  };
}

function buildLoadedPresentationState(
  best: number,
  score: number,
): Pick<GameStore, 'runBestAtStart' | 'recordCelebration' | 'recordCelebrated'> {
  return {
    runBestAtStart: best,
    recordCelebration: null,
    recordCelebrated: score > best,
  };
}

function buildPlacementPresentationState(
  previous: Pick<GameStore, 'runBestAtStart' | 'recordCelebration' | 'recordCelebrated'>,
  score: number,
): Pick<GameStore, 'recordCelebration' | 'recordCelebrated'> {
  if (previous.recordCelebration || previous.recordCelebrated) {
    return {
      recordCelebration: previous.recordCelebration,
      recordCelebrated: previous.recordCelebrated,
    };
  }

  if (previous.runBestAtStart > 0 && score > previous.runBestAtStart) {
    return {
      recordCelebration: {
        score,
        previousBest: previous.runBestAtStart,
      },
      recordCelebrated: false,
    };
  }

  return {
    recordCelebration: null,
    recordCelebrated: false,
  };
}

function archiveSave(
  key: typeof KEYS.classicRunArchive | typeof KEYS.adventureRunArchive,
  raw: string,
  reason: 'corrupt' | 'incompatible',
): void {
  setJSON(key, { raw, reason, archivedAt: Date.now() });
}

interface LegacyClassicRunMeta {
  v: 1;
  runId: string;
  runKind: 'classic' | 'tutorial';
  lifecycle: 'active' | 'terminal_revivable' | 'terminal_final';
  linesCleared: number;
  bestAtStart: number;
  gameRngState: number;
  settlement: unknown;
}

interface LegacyClassicRunEnvelope {
  v: 1;
  game: string;
  meta: LegacyClassicRunMeta;
}

function persistClassicSnapshot(game: GameState, meta: ClassicRunMeta, critical = false): void {
  const ftueCheckpoint = meta.runKind === 'tutorial' ? ftueCheckpointForRun(meta.runId) : null;
  const checkpointMeta: ClassicRunMeta = {
    ...meta,
    tutorialCheckpoint: ftueCheckpoint ? { ...ftueCheckpoint } : null,
  };
  const raw = serialize(game);
  // Authoritative checkpoint: game, generator rules, counters and settlement
  // intent are committed by one synchronous MMKV write.
  const write = critical ? setStringOrThrow : setString;
  write(KEYS.classicRunEnvelope, serializeClassicCheckpoint(game, checkpointMeta));
  // Read-only compatibility mirrors for builds that predate checkpoint v2.
  setString(KEYS.gameCurrent, raw);
  setJSON(KEYS.classicRunMeta, checkpointMeta);
}

function readClassicSnapshot(): { game: GameState; meta: ClassicRunMeta } | null {
  const envelopeRaw = getString(KEYS.classicRunEnvelope);
  if (envelopeRaw) {
    const checkpoint = deserializeClassicCheckpoint(envelopeRaw);
    if (checkpoint) return checkpoint;

    // One-release migration path from the split v1 envelope.
    const envelope = getJSON<Partial<LegacyClassicRunEnvelope>>(KEYS.classicRunEnvelope);
    if (envelope?.v === 1 && typeof envelope.game === 'string' && envelope.meta) {
      const game = deserialize(envelope.game);
      if (game && envelope.meta.gameRngState === game.rngState) {
        const meta = migrateClassicMeta(game, envelope.meta);
        persistClassicSnapshot(game, meta);
        return { game, meta };
      }
    }
    archiveSave(KEYS.classicRunArchive, envelopeRaw, 'corrupt');
    removeKey(KEYS.classicRunEnvelope);
  }

  const raw = getString(KEYS.gameCurrent);
  if (!raw) return null;
  const game = deserialize(raw);
  if (!game) {
    archiveSave(KEYS.classicRunArchive, raw, 'corrupt');
    removeKey(KEYS.gameCurrent);
    removeKey(KEYS.classicRunMeta);
    return null;
  }
  const meta = migrateClassicMeta(game);
  persistClassicSnapshot(game, meta);
  return { game, meta };
}

function migrateClassicMeta(
  game: GameState,
  supplied?: Partial<LegacyClassicRunMeta>,
): ClassicRunMeta {
  const stored = supplied ?? getJSON<Partial<LegacyClassicRunMeta>>(KEYS.classicRunMeta);
  const { configId, config } = classicConfigFor();
  if (
    stored?.v === 1 &&
    typeof stored.runId === 'string' &&
    (stored.runKind === 'classic' || stored.runKind === 'tutorial') &&
    ['active', 'terminal_revivable', 'terminal_final'].includes(stored.lifecycle ?? '') &&
    stored.gameRngState === game.rngState
  ) {
    const migrated: ClassicRunMeta = {
      checkpointVersion: 2,
      runId: stored.runId,
      runKind: stored.runKind,
      // A legacy terminal may already have paid through the old screen effect.
      // Never replay it; only legacy active runs remain eligible for settlement.
      lifecycle: game.status === 'playing' ? 'active' : 'terminal_final',
      configId,
      activeConfig: config,
      linesCleared: Math.max(0, Math.trunc(stored.linesCleared ?? 0)),
      placements: 0,
      activeDurationMs: 0,
      activeSinceAt: game.status === 'playing' ? Date.now() : null,
      bestAtStart: Math.max(0, Math.trunc(stored.bestAtStart ?? useScores.getState().best)),
      settlement: null,
    };
    useAnalyticsStore.getState().track('checkpoint_recovery', {
      run_id: migrated.runId,
      checkpoint_version: 1,
      reason: 'legacy_migration',
    });
    return migrated;
  }

  // Legacy saves were already accounted at their first game-over. Treat terminal
  // saves as final so migration cannot duplicate score, XP or leaderboard rewards.
  const unfinishedFtue = !['complete', 'skipped'].includes(useFtueStore.getState().status);
  const meta: ClassicRunMeta = {
    checkpointVersion: 2,
    runId:
      useLeaderboardStore.getState().activeProof?.id ??
      `legacy-classic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    runKind: unfinishedFtue && useScores.getState().gamesPlayed === 0 ? 'tutorial' : 'classic',
    lifecycle: game.status === 'playing' ? 'active' : 'terminal_final',
    configId,
    activeConfig: config,
    linesCleared: 0,
    placements: 0,
    activeDurationMs: 0,
    activeSinceAt: game.status === 'playing' ? Date.now() : null,
    bestAtStart: useScores.getState().best,
    settlement: null,
  };
  useAnalyticsStore.getState().track('checkpoint_recovery', {
    run_id: meta.runId,
    checkpoint_version: 0,
    reason: 'legacy_migration',
  });
  return meta;
}

function advanceActiveCounters(
  meta: ClassicRunMeta,
  at: number,
  placementDelta = 0,
): ClassicRunMeta {
  const runtime = useAnalyticsStore.getState().activeRun;
  const runtimeDuration =
    runtime?.run_id === meta.runId
      ? runtime.active_duration_ms +
        (runtime.active_since_ms === null ? 0 : Math.max(0, at - runtime.active_since_ms))
      : null;
  const elapsed = meta.activeSinceAt === null ? 0 : Math.max(0, at - meta.activeSinceAt);
  return {
    ...meta,
    placements: meta.placements + placementDelta,
    activeDurationMs:
      runtimeDuration === null
        ? meta.activeDurationMs + elapsed
        : Math.max(meta.activeDurationMs + elapsed, runtimeDuration),
    activeSinceAt: at,
  };
}

function migrateAdventureRunSettlement(run: AdventureRun): AdventureRun {
  if (!run.runId.startsWith('legacy-adventure:') || run.status === 'playing') return run;
  const progress = getJSON<{ seasonId?: number; levelIndex?: number }>(KEYS.adventure);
  const winAlreadyAdvanced =
    run.status === 'won' &&
    progress !== null &&
    ((progress.seasonId ?? 0) > run.level.seasonId ||
      ((progress.seasonId ?? 0) === run.level.seasonId &&
        (progress.levelIndex ?? 0) > run.level.levelIndex));
  // Old failed terminals had no reward to replay and cannot prove whether the
  // pre-update effect ran, so conservatively avoid a duplicate fail mutation.
  const settled = winAlreadyAdvanced || run.status === 'failed';
  if (!settled) return run;
  const migrated = { ...run, outcomeSettledAt: 1 };
  setString(KEYS.adventureRun, serializeAdventureRun(migrated));
  return migrated;
}

export function getSavedGameSummary(): SavedGameSummary {
  const snapshot = readClassicSnapshot();
  if (!snapshot) {
    const archive = getJSON<{ reason?: 'corrupt' | 'incompatible' }>(KEYS.classicRunArchive);
    return {
      mode: 'classic',
      kind: 'none',
      runId: null,
      score: null,
      canContinue: false,
      runKind: null,
      ...(archive?.reason ? { fallbackReason: archive.reason } : {}),
    };
  }

  const { game, meta } = snapshot;

  if (game.status === 'playing') {
    return {
      mode: 'classic',
      kind: 'active',
      runId: meta.runId,
      score: game.score,
      canContinue: true,
      runKind: meta.runKind,
    };
  }
  return {
    mode: 'classic',
    kind: meta.lifecycle === 'terminal_revivable' ? 'terminal_revivable' : 'terminal_final',
    runId: meta.runId,
    score: game.score,
    canContinue: meta.lifecycle === 'terminal_revivable',
    runKind: meta.runKind,
  };
}

export function getSavedAdventureSummary(): SavedAdventureSummary {
  const raw = getString(KEYS.adventureRun);
  if (!raw) {
    const archive = getJSON<{ reason?: 'corrupt' | 'incompatible' }>(KEYS.adventureRunArchive);
    return {
      mode: 'adventure',
      kind: 'none',
      runId: null,
      score: null,
      seasonId: null,
      levelIndex: null,
      attempt: null,
      status: null,
      objectiveType: null,
      objectiveCurrent: null,
      objectiveTarget: null,
      ...(archive?.reason ? { fallbackReason: archive.reason } : {}),
    };
  }
  const parsed = deserializeAdventureRun(raw);
  const run = parsed ? migrateAdventureRunSettlement(parsed) : null;
  if (!run) {
    archiveSave(KEYS.adventureRunArchive, raw, 'corrupt');
    removeKey(KEYS.adventureRun);
    return {
      mode: 'adventure',
      kind: 'none',
      runId: null,
      score: null,
      seasonId: null,
      levelIndex: null,
      attempt: null,
      status: null,
      objectiveType: null,
      objectiveCurrent: null,
      objectiveTarget: null,
      fallbackReason: 'corrupt',
    };
  }
  return {
    mode: 'adventure',
    kind: run.status === 'playing' ? 'active' : 'terminal',
    runId: run.runId,
    score: run.game.score,
    seasonId: run.level.seasonId,
    levelIndex: run.level.levelIndex,
    attempt: run.attempt,
    status: run.status,
    objectiveType: run.level.objective.type,
    objectiveCurrent: run.level.objective.type === 'score' ? run.game.score : run.collectedJewels,
    objectiveTarget: run.level.objective.target,
  };
}

export function hasSavedGame(): boolean {
  return getSavedGameSummary().kind !== 'none';
}

export function getSavedScore(): number | null {
  const summary = getSavedGameSummary();
  return summary.canContinue ? summary.score : null;
}

export const useGameStore = create<GameStore>((set, get) => {
  const clearAdventure = () => {
    removeKey(KEYS.adventureRun);
    return { adventure: null, lastAdventureEvent: null, boardRecovery: null };
  };

  // Убирает adventure-ран из памяти, не трогая сохранённый снапшот в MMKV:
  // Endless-партия перестаёт роутиться в adventure-ветку placePiece, а уровень
  // можно восстановить позже через resumeSavedAdventure (FR-7).
  const detachAdventure = () => ({ adventure: null, lastAdventureEvent: null, boardRecovery: null });

  const settleClassic = (
    reason: 'home' | 'replay' | 'restart' | 'final_game_over',
  ): SubmitResult | null => {
    const { game } = get();
    if (game.status !== 'over') return null;
    const meta = get().classicMeta ?? migrateClassicMeta(game);
    const terminalReason = reason === 'final_game_over' ? 'game_over' : reason;
    if (meta.settlement?.phase === 'complete' && meta.settlement.targetScore >= game.score) {
      useAnalyticsStore.getState().track('duplicate_reward_count', {
        run_id: meta.runId,
        reward_id: 'xp',
        target_amount: game.score,
      });
      if (reason !== 'final_game_over' && meta.lifecycle !== 'terminal_final') {
        const finalized = { ...meta, lifecycle: 'terminal_final' as const };
        persistClassicSnapshot(game, finalized);
        set({ classicMeta: finalized });
      }
      return meta.settlement.result;
    }

    const pending: ClassicRunMeta = {
      ...meta,
      lifecycle:
        game.reviveUsed || reason !== 'final_game_over' ? 'terminal_final' : 'terminal_revivable',
      activeSinceAt: null,
      settlement: {
        revision: (meta.settlement?.revision ?? 0) + 1,
        previousTargetScore: meta.settlement?.targetScore ?? 0,
        targetScore: game.score,
        reason: terminalReason,
        result: null,
        phase: 'pending',
        committedAt: Date.now(),
        completedAt: null,
      },
    };
    // Phase 1: result intent is durable before touching balance or receipts.
    persistClassicSnapshot(game, pending);
    set({ classicMeta: pending });

    const scoreOutcome = useScores
      .getState()
      .submitGameRevision(meta.runId, game.score, pending.linesCleared);
    const progression = useProgression.getState().grantReward({
      runId: pending.runId,
      rewardId: 'xp',
      source: 'classic',
      targetAmount: game.score,
    });
    if (progression.applied) {
      for (const reward of progression.rewards) {
        if (reward.kind === 'cosmetic') useMascot.getState().unlock(reward.id);
        const rewardId = reward.kind === 'world' ? reward.themeId : reward.id;
        useAnalyticsStore
          .getState()
          .trackOnce(
            `progression-reward:${pending.runId}:${reward.kind}:${rewardId}`,
            'reward_granted',
            {
              reward_type: 'progression',
              reward_id: `${reward.kind}:${rewardId}`,
              mode: 'classic',
            },
          );
      }
      if (progression.toLevel > progression.fromLevel) {
        // Presentation consumes this state when ready; accounting never waits
        // for an animation timer or for GameScreen to remain mounted.
        useProgression.getState().enqueueReveal({
          id: `classic:${pending.runId}:${progression.toLevel}`,
          runId: pending.runId,
          level: progression.toLevel,
          rewards: progression.rewards,
        });
      }
    } else {
      useAnalyticsStore.getState().track('duplicate_reward_count', {
        run_id: pending.runId,
        reward_id: 'xp',
        target_amount: game.score,
      });
    }
    useAnalyticsStore
      .getState()
      .trackOnce(`xp:${pending.runId}:${pending.settlement!.revision}`, 'reward_granted', {
        reward_type: 'xp',
        amount: progression.applied
          ? progression.grantedDelta
          : Math.max(0, pending.settlement!.targetScore - pending.settlement!.previousTargetScore),
        reward_id: `classic:${pending.runId}:xp`,
        completion_id: pending.runId,
        mode: 'classic',
        first_completion: pending.settlement!.previousTargetScore === 0,
      });

    void useLeaderboardStore.getState().finishActiveRun(game.score, new Date());
    useAnalyticsStore.getState().finishRun({
      mode: 'classic',
      result: 'completed',
      reason: 'game_over',
      score: game.score,
      lines: pending.linesCleared,
    });
    useAnalyticsStore.getState().track('session_depth', {
      gamesPlayed: useScores.getState().gamesPlayed,
    });

    const result: SubmitResult = {
      newRecord: scoreOutcome.newRecord,
      delta: scoreOutcome.delta,
    };
    const settled: ClassicRunMeta = {
      ...pending,
      settlement: {
        ...pending.settlement!,
        result,
        phase: 'complete',
        completedAt: Date.now(),
      },
    };
    // Phase 2: completion follows the atomic balance+receipt commit. Replaying
    // a pending phase is safe because both score and reward stores are idempotent.
    persistClassicSnapshot(game, settled);
    set({ classicMeta: settled, finalResult: result });
    recordNextGoalCompletion('resume', `resume:${pending.runId}`);
    return result;
  };

  const startNew = (options?: NewGameOptions) => {
    useProgression.getState().discardRevealsForRun();
    removeKey(KEYS.classicRunArchive);
    set({ helperHint: null });
    const best = useScores.getState().best;
    const proof = useLeaderboardStore.getState().startRun({
      startedAt: new Date().toISOString(),
      mode: 'weekly',
      seed: options?.seed ?? seedFromTime(),
      challengeDate: null,
    });
    const { configId, config } = classicConfigFor();
    const game = options?.initialGame ?? createGame(proof.seed, config);
    const meta: ClassicRunMeta = {
      checkpointVersion: 2,
      runId: createPersistedRunId('classic'),
      leaderboardProofId: proof.id,
      runKind: options?.initialGame ? 'tutorial' : 'classic',
      lifecycle: 'active',
      configId,
      activeConfig: config,
      linesCleared: 0,
      placements: 0,
      activeDurationMs: 0,
      activeSinceAt: Date.now(),
      bestAtStart: best,
      settlement: null,
    };
    if (meta.runKind === 'tutorial') {
      useFtueStore.getState().beginAttempt(meta.runId);
    }
    set({
      ...detachAdventure(),
      game,
      activeConfig: config,
      lastEvent: null,
      linesCleared: 0,
      finalResult: null,
      classicMeta: meta,
      epoch: get().epoch + 1,
      ...buildFreshPresentationState(best),
    });
    persistClassicSnapshot(game, meta);
    useAnalyticsStore
      .getState()
      .startRun(
        'classic',
        options?.analyticsSource === 'restart' ? 'restart' : 'new',
        meta.runId,
        options?.analyticsSource,
      );
    recordAttributedNextRun('classic');
    useAnalyticsStore.getState().track('game_start', { mode: 'weekly' });
  };

  const placeAdventurePiece = (
    adventure: AdventureRun,
    trayIndex: number,
    r: number,
    c: number,
  ): AdventurePlacementEvent | null => {
    const assistanceActive = adventure.helpPolicy === 'highlight' && !adventure.helpUsed;
    let adventureResult: { run: AdventureRun; event: AdventurePlacementEvent };
    try {
      adventureResult = placeAdventure(adventure, trayIndex, r, c);
    } catch {
      return null;
    }
    if (assistanceActive) {
      adventureResult = {
        ...adventureResult,
        run: { ...adventureResult.run, helpUsed: true },
      };
    }

    const settings = useSettings.getState();
    const oldStones = adventure.stonesOnBoard ?? {};
    const newStones = adventureResult.run.stonesOnBoard ?? {};
    playPlacementFeedback(adventureResult.event, {
      sound: settings.sound,
      haptics: settings.haptics,
    }, {
      jewel: adventureResult.event.jewelsCollectedThisMove > 0,
      stoneHit: Object.keys(oldStones).some((key) => oldStones[Number(key)] !== newStones[Number(key)]),
      stoneBreak: Object.keys(oldStones).some((key) => newStones[Number(key)] == null),
      won: adventureResult.run.status === 'won',
    });

    const serializedRun = serializeAdventureRun(adventureResult.run);
    if (adventureResult.run.status === 'playing') setString(KEYS.adventureRun, serializedRun);
    else setStringOrThrow(KEYS.adventureRun, serializedRun);
    set({
      adventure: adventureResult.run,
      game: adventureResult.run.game,
      lastEvent: adventureResult.event,
      boardRecovery: null,
      helperHint: null,
      lastAdventureEvent: adventureResult.event,
      linesCleared:
        get().linesCleared +
        adventureResult.event.clearedRows.length +
        adventureResult.event.clearedCols.length,
    });
    if (adventureResult.event.jewelsCollectedThisMove > 0) {
      useAnalyticsStore.getState().track('adventure_objective_collected', {
        presentation_id: adventureResult.event.presentationId,
        delta: adventureResult.event.jewelsCollectedThisMove,
        total: adventureResult.event.collectedJewels,
        remaining: adventureResult.event.remainingJewels,
      });
    }
    if (adventureResult.run.status !== 'playing') {
      // The terminal snapshot above is the recovery anchor. Settlement failures
      // leave it pending and are retried by resumeSavedAdventure on cold start.
      try {
        get().settleAdventureOutcome(adventureResult.run.runId);
      } catch {
        // Keep the persisted status=won/failed snapshot authoritative.
      }
    }
    const clearedLines =
      adventureResult.event.clearedRows.length + adventureResult.event.clearedCols.length;
    useAnalyticsStore.getState().recordPlacement({
      mode: 'adventure',
      guidance: assistanceActive ? 'assisted' : 'independent',
      clearedLines,
    });
    if (adventureResult.run.status !== 'playing') {
      useAnalyticsStore.getState().finishRun({
        mode: 'adventure',
        result: adventureResult.run.status === 'won' ? 'completed' : 'failed',
        reason: adventureResult.run.status === 'won' ? 'level_won' : 'level_failed',
        score: adventureResult.run.game.score,
        lines: get().linesCleared,
      });
    }
    return adventureResult.event;
  };

  return {
    game: createGame(),
    activeConfig: DEFAULT_CONFIG,
    adventure: null,
    lastEvent: null,
    boardRecovery: null,
    lastAdventureEvent: null,
    linesCleared: 0,
    finalResult: null,
    classicMeta: null,
    epoch: 1,
    ...buildFreshPresentationState(useScores.getState().best),

    newGame: startNew,
    discardAndStartNew: startNew,
    settleClassicRun: settleClassic,

    recoverHelperRescues: () => {
      const classic = readClassicSnapshot();
      if (classic?.meta.helperSpend) {
        try {
          const intent = classic.meta.helperSpend;
          if (useMascot.getState().useHelper(intent.helperId, intent)) {
            const meta = { ...classic.meta, helperSpend: undefined };
            persistClassicSnapshot(classic.game, meta, true);
            if (get().classicMeta?.runId === meta.runId)
              set({ classicMeta: meta, ...(!get().adventure ? { game: classic.game } : {}) });
          }
        } catch {
          /* The saved debit intent remains available for retry. */
        }
      }
      const raw = getString(KEYS.adventureRun);
      const adventure = raw ? deserializeAdventureRun(raw) : null;
      if (adventure?.helperSpend) {
        try {
          const intent = adventure.helperSpend;
          if (useMascot.getState().useHelper(intent.helperId, intent)) {
            const settled = { ...adventure, helperSpend: undefined };
            setStringOrThrow(KEYS.adventureRun, serializeAdventureRun(settled));
            if (get().adventure?.runId === adventure.runId)
              set({ adventure: settled, game: settled.game });
          }
        } catch {
          /* Retry the same receipt rather than debiting again. */
        }
      }
    },

    finishCurrentResult: () => {
      const current = get();
      if (current.adventure) {
        if (current.adventure.status !== 'failed' || current.adventure.resultAcknowledged) return;
        const finished = { ...current.adventure, resultAcknowledged: true };
        setStringOrThrow(KEYS.adventureRun, serializeAdventureRun(finished));
        set({ adventure: finished });
      } else if (
        current.game.status === 'over' &&
        current.classicMeta &&
        !current.classicMeta.resultAcknowledged
      ) {
        if (
          current.classicMeta.settlement?.phase !== 'complete' ||
          current.classicMeta.settlement.targetScore < current.game.score
        )
          settleClassic('final_game_over');
        const meta: ClassicRunMeta = {
          ...get().classicMeta!,
          lifecycle: 'terminal_final',
          resultAcknowledged: true,
        };
        persistClassicSnapshot(current.game, meta, true);
        set({ classicMeta: meta });
      }
    },

    pauseClassicActivity: () => {
      const { adventure, classicMeta, game } = get();
      if (
        adventure ||
        !classicMeta ||
        game.status !== 'playing' ||
        classicMeta.activeSinceAt === null
      ) {
        return;
      }
      const paused = { ...advanceActiveCounters(classicMeta, Date.now()), activeSinceAt: null };
      persistClassicSnapshot(game, paused);
      set({ classicMeta: paused });
    },

    resumeClassicActivity: () => {
      const { adventure, classicMeta, game } = get();
      if (
        adventure ||
        !classicMeta ||
        game.status !== 'playing' ||
        classicMeta.activeSinceAt !== null
      ) {
        return;
      }
      const resumed = { ...classicMeta, activeSinceAt: Date.now() };
      persistClassicSnapshot(game, resumed);
      set({ classicMeta: resumed });
    },

    syncTutorialCheckpoint: () => {
      const { classicMeta, game } = get();
      if (!classicMeta || classicMeta.runKind !== 'tutorial') return;
      persistClassicSnapshot(game, classicMeta);
    },

    newAdventureGame: (spec, attempt = 0, analyticsSource, helpPolicy) => {
      useProgression.getState().discardRevealsForRun();
      removeKey(KEYS.adventureRunArchive);
      const previous = get().adventure;
      const sameLevel =
        previous?.level.seasonId === spec.seasonId && previous.level.levelIndex === spec.levelIndex;
      const failureCount = sameLevel ? previous.failureCount : 0;
      const resolvedHelpPolicy = helpPolicy ?? (sameLevel ? previous.helpPolicy : 'none');
      const run = createAdventureRun(spec, attempt, undefined, createPersistedRunId('adventure'), {
        failureCount,
        helpPolicy: resolvedHelpPolicy,
      });
      set({
        helperHint: null,
        game: run.game,
        adventure: run,
        boardRecovery: null,
        lastEvent: null,
        lastAdventureEvent: null,
        linesCleared: 0,
        finalResult: null,
        epoch: get().epoch + 1,
      });
      setString(KEYS.adventureRun, serializeAdventureRun(run));
      useAnalyticsStore
        .getState()
        .startRun('adventure', attempt > 0 ? 'restart' : 'new', run.runId, analyticsSource);
      recordAttributedNextRun('adventure');
      useAnalyticsStore.getState().track('adventure_level_start', {
        seasonId: spec.seasonId,
        levelIndex: spec.levelIndex,
        attempt,
        objective: spec.objective.type,
        failure_count: run.failureCount,
        help_policy: run.helpPolicy,
      });
    },

    resumeSavedAdventure: (spec) => {
      const raw = getString(KEYS.adventureRun);
      if (!raw) return null;

      const parsed = deserializeAdventureRun(raw);
      const run = parsed ? migrateAdventureRunSettlement(parsed) : null;
      const matchesSpec =
        run !== null &&
        run.level.seasonId === spec.seasonId &&
        run.level.levelIndex === spec.levelIndex &&
        ((spec.rulesVersion === 2 && run.level.rulesVersion == null) ||
          (run.level.objective.type === spec.objective.type &&
            run.level.objective.target === spec.objective.target));
      if (!run) {
        archiveSave(KEYS.adventureRunArchive, raw, 'corrupt');
        removeKey(KEYS.adventureRun);
        return null;
      }
      // A terminal run is authoritative even when progression already advanced
      // to the next level; it must be presented/settled before replacement.
      if (run.status === 'playing' && !matchesSpec) {
        archiveSave(KEYS.adventureRunArchive, raw, 'incompatible');
        removeKey(KEYS.adventureRun);
        return null;
      }

      set({
        game: run.game,
        adventure: run,
        boardRecovery: null,
        lastEvent: null,
        lastAdventureEvent: null,
        linesCleared: 0,
        finalResult: null,
        epoch: get().epoch + 1,
      });
      useAnalyticsStore.getState().resumeRun('adventure', 'saved', run.runId);
      if (run.status !== 'playing' && !run.outcomeSettledAt) {
        try {
          get().settleAdventureOutcome(run.runId);
        } catch {
          // The terminal checkpoint remains pending for the next recovery pass.
        }
      }
      if (run.status !== 'playing') {
        useAnalyticsStore.getState().finishRun({
          mode: 'adventure',
          result: run.status === 'won' ? 'completed' : 'failed',
          reason: run.status === 'won' ? 'level_won' : 'level_failed',
          score: run.game.score,
        });
      }
      recordAttributedNextRun('adventure');
      return run;
    },

    suspendAdventure: () => {
      if (!get().adventure) return;
      set({ ...detachAdventure(), lastEvent: null });
    },

    exitAdventure: () => {
      if (!get().adventure) return;
      set({ ...detachAdventure(), lastEvent: null });
    },

    discardAdventure: () => {
      set({ ...clearAdventure(), lastEvent: null, epoch: get().epoch + 1 });
    },

    markAdventureOutcomeSettled: (runId, at = Date.now()) => {
      const run = get().adventure;
      if (!run || run.runId !== runId || run.status === 'playing' || run.outcomeSettledAt) return;
      const settled = {
        ...run,
        failureCount: run.status === 'failed' ? run.failureCount + 1 : 0,
        outcomeSettledAt: at,
      };
      setStringOrThrow(KEYS.adventureRun, serializeAdventureRun(settled));
      set({ adventure: settled, game: settled.game });
    },

    setAdventureRetryPolicy: (runId, policy) => {
      const run = get().adventure;
      if (
        !run ||
        run.runId !== runId ||
        run.status !== 'failed' ||
        !run.outcomeSettledAt ||
        run.helpPolicy === policy
      ) {
        return run?.runId === runId && run.helpPolicy === policy;
      }
      const updated = { ...run, helpPolicy: policy };
      setStringOrThrow(KEYS.adventureRun, serializeAdventureRun(updated));
      set({ adventure: updated, game: updated.game });
      return true;
    },

    settleAdventureOutcome: (runId) => {
      const run = get().adventure;
      if (!run || run.runId !== runId || run.status === 'playing') return null;

      if (run.outcomeSettledAt) {
        if (run.status === 'failed') {
          const level = useProgression.getState().level;
          return {
            runId: run.runId,
            completionId: null,
            status: 'failed',
            campaignApplied: false,
            xpGranted: 0,
            fromLevel: level,
            toLevel: level,
            completedSeason: null,
          };
        }
        const completionId = adventureCompletionIdentity(
          run.level.seasonId,
          run.level.levelIndex,
        ).completionId;
        const receipt =
          useProgression.getState().rewardReceipts[rewardReceiptKey(completionId, 'xp')];
        return {
          runId: run.runId,
          completionId,
          status: 'won',
          campaignApplied: false,
          xpGranted: receipt?.grantedAmount ?? 0,
          fromLevel: receipt?.fromLevel ?? useProgression.getState().level,
          toLevel: receipt?.toLevel ?? useProgression.getState().level,
          completedSeason:
            run.level.levelIndex + 1 >= seasonLength(run.level.seasonId)
              ? run.level.seasonId
              : null,
        };
      }

      if (run.status === 'failed') {
        const campaignApplied = useAdventure.getState().recordFailOnce(run.runId);
        if (campaignApplied) saveAdsMeta(recordAdventureFail(loadAdsMeta()));
        const objectiveCurrent =
          run.level.objective.type === 'score' ? run.game.score : run.collectedJewels;
        useAnalyticsStore
          .getState()
          .trackOnce(`adventure-result:${run.runId}`, 'adventure_level_fail', {
            seasonId: run.level.seasonId,
            levelIndex: run.level.levelIndex,
            attempt: run.attempt,
            objective: run.level.objective.type,
            current: objectiveCurrent,
            target: run.level.objective.target,
            remaining: Math.max(0, run.level.objective.target - objectiveCurrent),
            failure_count: run.failureCount + 1,
            help_policy: run.helpPolicy,
          });
        get().markAdventureOutcomeSettled(run.runId);
        recordNextGoalCompletion('resume', `resume:${run.runId}`);
        return {
          runId: run.runId,
          completionId: null,
          status: 'failed',
          campaignApplied,
          xpGranted: 0,
          fromLevel: useProgression.getState().level,
          toLevel: useProgression.getState().level,
          completedSeason: null,
        };
      }

      const identity = adventureCompletionIdentity(run.level.seasonId, run.level.levelIndex);
      const completionId = identity.completionId;
      const completedSeason =
        run.level.levelIndex + 1 >= seasonLength(run.level.seasonId) ? run.level.seasonId : null;
      const campaignApplied = useAdventure
        .getState()
        .recordWinOnce(completionId, run.runId, todayISO());
      if (campaignApplied) saveAdsMeta(recordAdventureLevelWin(loadAdsMeta()));
      useStreak.getState().markPlayedToday();

      const xpTarget = adventureXpForLevel(run.level.levelIndex);
      const progression = useProgression.getState().grantReward({
        runId: run.runId,
        completionId,
        rewardId: 'xp',
        source: 'adventure',
        targetAmount: xpTarget,
      });
      const earnedRewards = progression.applied
        ? progression.rewards
        : rewardsBetween(
            progression.receipt.fromLevel ?? progression.fromLevel,
            progression.receipt.toLevel ?? progression.toLevel,
          );
      for (const reward of earnedRewards) {
        if (reward.kind === 'cosmetic') useMascot.getState().unlock(reward.id);
        const rewardId = reward.kind === 'world' ? reward.themeId : reward.id;
        useAnalyticsStore
          .getState()
          .trackOnce(
            `progression-reward:${completionId}:${reward.kind}:${rewardId}`,
            'reward_granted',
            {
              reward_type: 'progression',
              reward_id: `${reward.kind}:${rewardId}`,
              completion_id: completionId,
              mode: 'adventure',
              first_completion: true,
            },
          );
      }
      const revealFromLevel = progression.receipt.fromLevel ?? progression.fromLevel;
      const revealToLevel = progression.receipt.toLevel ?? progression.toLevel;
      if (revealToLevel > revealFromLevel) {
        useProgression.getState().enqueueReveal({
          id: `${completionId}:${revealToLevel}`,
          runId: run.runId,
          level: revealToLevel,
          rewards: earnedRewards,
        });
      }
      if (!progression.applied) {
        useAnalyticsStore.getState().track('duplicate_reward_count', {
          run_id: run.runId,
          reward_id: `${completionId}:xp`,
          target_amount: xpTarget,
        });
      }
      useAnalyticsStore.getState().trackOnce(`adventure-xp:${completionId}`, 'reward_granted', {
        reward_type: 'xp',
        amount: progression.receipt.grantedAmount,
        reward_id: `${completionId}:xp`,
        completion_id: completionId,
        mode: 'adventure',
        first_completion: true,
      });
      const sessionId = useAnalyticsStore.getState().context?.session_id;
      if (sessionId) recordMeaningfulSessionForPush(sessionId, 'adventure');
      useAnalyticsStore
        .getState()
        .trackOnce(`adventure-result:${completionId}`, 'adventure_level_win', {
          seasonId: run.level.seasonId,
          levelIndex: run.level.levelIndex,
          attempt: run.attempt,
          consecutive: useAdventure.getState().consecutive,
          completionId,
        });

      if (completedSeason !== null) {
        useAnalyticsStore
          .getState()
          .trackOnce(`adventure-season-complete:${completedSeason}`, 'adventure_season_complete', {
            seasonId: completedSeason,
          });
        const seasonCosmetic = seasonRewardCosmetic(completedSeason);
        if (seasonCosmetic !== null) {
          useMascot.getState().unlock(seasonCosmetic);
          useAnalyticsStore
            .getState()
            .trackOnce(
              `season-cosmetic:${completedSeason}:${seasonCosmetic}`,
              'season_reward_granted',
              { seasonId: completedSeason, cosmeticId: seasonCosmetic },
            );
          useAnalyticsStore
            .getState()
            .trackOnce(`season-reward:${completedSeason}:${seasonCosmetic}`, 'reward_granted', {
              reward_type: 'season_cosmetic',
              reward_id: seasonCosmetic,
              completion_id: completionId,
              mode: 'adventure',
              first_completion: true,
            });
        }
      }

      get().markAdventureOutcomeSettled(run.runId);
      recordNextGoalCompletion('resume', `resume:${run.runId}`);
      return {
        runId: run.runId,
        completionId,
        status: 'won',
        campaignApplied,
        xpGranted: progression.receipt.grantedAmount,
        fromLevel: progression.receipt.fromLevel ?? progression.fromLevel,
        toLevel: progression.receipt.toLevel ?? progression.toLevel,
        completedSeason,
      };
    },

    placePiece: (trayIndex, r, c) => {
      const adventure = get().adventure;
      if (adventure) {
        return placeAdventurePiece(adventure, trayIndex, r, c);
      }

      const { game, linesCleared, activeConfig, runBestAtStart } = get();
      const currentMeta = get().classicMeta ?? migrateClassicMeta(game);
      const ftueBefore = useFtueStore.getState();
      const tutorialRecommendation =
        currentMeta.runKind === 'tutorial' &&
        ftueBefore.runId === currentMeta.runId &&
        shouldShowFtueAssistance(ftueBefore)
          ? findTutorialRecommendation(game)
          : null;
      const followedHighlight = Boolean(
        tutorialRecommendation &&
        tutorialRecommendation.trayIndex === trayIndex &&
        tutorialRecommendation.row === r &&
        tutorialRecommendation.col === c,
      );
      const preparedFixtureMove = Boolean(
        ftueBefore.guidedClearAt === null &&
        ftueBefore.placements === 0 &&
        trayIndex === 2 &&
        r === 3 &&
        c === 3 &&
        game.tray[2]?.shape.id === 'sq2',
      );
      let result: { state: GameState; event: PlacementEvent };
      try {
        result = place(game, trayIndex, r, c, activeConfig);
      } catch {
        return null;
      }

      const settings = useSettings.getState();
      playPlacementFeedback(result.event, {
        sound: settings.sound,
        haptics: settings.haptics,
      });

      const presentation = buildPlacementPresentationState(get(), result.event.score);
      const previousRecordProgress = recordProgressFor(game.score, runBestAtStart, game.score);
      const nextRecordProgress = recordProgressFor(result.event.score, runBestAtStart, game.score);
      const analyticsRecordStage =
        nextRecordProgress.stage === 'record_broken'
          ? 'broken'
          : nextRecordProgress.stage === 'pursuit' || nextRecordProgress.stage === 'near'
            ? nextRecordProgress.stage
            : null;
      if (nextRecordProgress.stage !== previousRecordProgress.stage && analyticsRecordStage) {
        useAnalyticsStore.getState().track('record_progressed', {
          stage: analyticsRecordStage,
          score: result.event.score,
          best_at_start: runBestAtStart,
          game_depth: useScores.getState().gamesPlayed + 1,
        });
      }
      const lines =
        linesCleared + result.event.clearedRows.length + result.event.clearedCols.length;
      const clearedLines = result.event.clearedRows.length + result.event.clearedCols.length;
      const clearedNow = clearedLines > 0;
      const ftuePlacement =
        currentMeta.runKind === 'tutorial' && ftueBefore.runId === currentMeta.runId
          ? useFtueStore.getState().recordAcceptedPlacement({
              clearedLines,
              followedHighlight,
              preparedFixtureMove,
            })
          : null;
      const nextMeta: ClassicRunMeta = {
        ...advanceActiveCounters(currentMeta, Date.now(), 1),
        linesCleared: lines,
        lifecycle: result.event.gameOver ? 'terminal_revivable' : 'active',
        activeSinceAt: result.event.gameOver ? null : Date.now(),
      };
      // The run envelope is authoritative on resume. Commit game + FTUE before
      // analytics so a process death cannot preserve a metric for a rolled-back move.
      persistClassicSnapshot(result.state, nextMeta);
      useAnalyticsStore.getState().recordPlacement({
        mode: 'classic',
        guidance: ftuePlacement?.phase ?? 'independent',
        clearedLines,
      });
      if (ftuePlacement?.clearOutcome) {
        const ftueAfter = useFtueStore.getState();
        if (ftuePlacement.clearOutcome === 'guided_success') {
          useAnalyticsStore
            .getState()
            .trackOnce(`first-line-cleared:${currentMeta.runId}`, 'first_line_cleared', {
              elapsed_ms: ftueAfter.startedAt ? Date.now() - ftueAfter.startedAt : 0,
              placements: ftueAfter.placements,
            });
        }
        useAnalyticsStore
          .getState()
          .trackOnce(
            `ftue-clear:${currentMeta.runId}:${ftuePlacement.acceptedMovesAfterFixture}:${ftuePlacement.clearOutcome}`,
            'tutorial_clear_outcome',
            {
              experiment_id: FTUE_EXPERIMENT_ID,
              variant: ftueAfter.variant,
              metric_version: ftueAfter.metricVersion,
              outcome: ftuePlacement.clearOutcome,
              accepted_moves_after_fixture: ftuePlacement.acceptedMovesAfterFixture,
              within_10: ftuePlacement.acceptedMovesAfterFixture <= 10,
              skipped: ftueAfter.skipReason !== null,
            },
          );
      }
      if (ftuePlacement?.metricWindowClosed) {
        const ftueAfter = useFtueStore.getState();
        useAnalyticsStore
          .getState()
          .trackOnce(`ftue-window:${currentMeta.runId}`, 'tutorial_metric_window_closed', {
            experiment_id: FTUE_EXPERIMENT_ID,
            variant: ftueAfter.variant,
            metric_version: ftueAfter.metricVersion,
            accepted_moves_after_fixture: ftueAfter.acceptedMovesAfterFixture,
            independent_clear: ftueAfter.outcome === 'independent_success',
            skipped: ftueAfter.skipReason !== null,
          });
      }
      useLeaderboardStore.getState().recordMove({ trayIndex, row: r, col: c });

      if (clearedNow) {
        useStreak.getState().markPlayedToday();
        const sessionId = useAnalyticsStore.getState().context?.session_id;
        if (sessionId) recordMeaningfulSessionForPush(sessionId, 'classic');
      }

      if (result.event.gameOver) {
        useAnalyticsStore.getState().track('game_over', {
          score: result.event.score,
          linesCleared: lines,
          revived: game.reviveUsed,
          sessionDepth: useScores.getState().gamesPlayed + 1,
        });

        set({
          game: result.state,
          lastEvent: result.event,
          boardRecovery: null,
          helperHint: null,
          linesCleared: lines,
          finalResult: null,
          classicMeta: nextMeta,
          ...presentation,
        });
        settleClassic('final_game_over');
      } else {
        set({
          game: result.state,
          lastEvent: result.event,
          boardRecovery: null,
          helperHint: null,
          linesCleared: lines,
          classicMeta: nextMeta,
          ...presentation,
        });
      }

      return result.event;
    },

    replaceTrayPiece: (trayIndex) => {
      const { game } = get();
      if (game.status !== 'playing') return;
      if (trayIndex < 0 || trayIndex >= game.tray.length) return;
      if (game.tray[trayIndex] === null) return;
      const next = engineReplaceTrayPiece(game, trayIndex);
      const meta = get().classicMeta;
      const nextMeta = meta ? advanceActiveCounters(meta, Date.now()) : null;
      set({ game: next, helperHint: null, ...(nextMeta ? { classicMeta: nextMeta } : {}) });
      if (nextMeta) persistClassicSnapshot(next, nextMeta);
      else setString(KEYS.gameCurrent, serialize(next));
    },

    restoreGame: (snapshot) => {
      const meta = get().classicMeta;
      const nextMeta = meta ? advanceActiveCounters(meta, Date.now()) : null;
      set({
        ...detachAdventure(),
        game: snapshot,
        ...(nextMeta ? { classicMeta: nextMeta } : {}),
      });
      if (nextMeta) persistClassicSnapshot(snapshot, nextMeta);
      else setString(KEYS.gameCurrent, serialize(snapshot));
    },

    continueGame: (expectedRunId) => {
      const { adventure, game, activeConfig, classicMeta } = get();
      if (adventure) {
        if (adventure.runId !== expectedRunId || adventure.helperSpend) return false;
        const next = rescueAdventureRun(adventure);
        if (!next) return false;
        setStringOrThrow(KEYS.adventureRun, serializeAdventureRun(next));
        set({
          adventure: next,
          game: next.game,
          boardRecovery: { previousBoard: game.board, board: next.game.board },
          lastEvent: null,
          lastAdventureEvent: null,
          helperHint: null,
        });
        useAnalyticsStore.getState().resumeRun('adventure', 'revive', adventure.runId);
        if (useSettings.getState().sound) playSound('boardclear');
        return true;
      }
      const meta = classicMeta ?? migrateClassicMeta(game);
      if (expectedRunId && meta.runId !== expectedRunId) return false;
      if (meta.lifecycle !== 'terminal_revivable' || meta.resultAcknowledged || meta.helperSpend) {
        return false;
      }
      const next = revive(game, activeConfig);
      if (!next) return false;
      const proofId = useLeaderboardStore.getState().activeProof?.id;
      if (meta.leaderboardProofId && meta.leaderboardProofId !== proofId) return false;
      // Переоткрываем ран лидерборда, чтобы продолженная партия дописывала ходы
      // и финализировалась заново — иначе счёт после ревайва не попадал в результат.
      const resumedMeta: ClassicRunMeta = {
        ...meta,
        leaderboardProofId: meta.leaderboardProofId ?? proofId,
        lifecycle: 'active',
        activeSinceAt: useAdPresentation.getState().fullscreenActive ? null : Date.now(),
      };
      // The revived board and reviveUsed marker are one durable decision.
      // Keep the earned journal pending when the write fails.
      persistClassicSnapshot(next, resumedMeta, true);
      if (!reconcileRevivedLeaderboardProof(next, resumedMeta)) return false;
      set({
        game: next,
        classicMeta: resumedMeta,
        finalResult: null,
        boardRecovery: { previousBoard: game.board, board: next.board },
        lastEvent: null,
        helperHint: null,
        linesCleared: meta.linesCleared,
      });
      useAnalyticsStore.getState().track('revive_used', { result: 'continued' });
      useAnalyticsStore.getState().resumeRun('classic', 'revive', meta.runId, {
        placements: meta.placements,
        lines: meta.linesCleared,
        activeDurationMs: meta.activeDurationMs,
      });
      if (useSettings.getState().sound) playSound('boardclear');
      return true;
    },

    loadSaved: () => {
      const snapshot = readClassicSnapshot();
      if (!snapshot) return null;
      const { game, meta } = snapshot;

      // A post-revive terminal is never revivable again. Recover a torn legacy
      // mirror by settling it idempotently before exposing CTA state.
      const pendingRecovery = meta.settlement?.phase === 'pending';
      const loadedMeta: ClassicRunMeta = {
        ...meta,
        activeSinceAt: game.status === 'playing' ? Date.now() : null,
      };
      // The board can have committed immediately before process death while
      // the separate proof still contains the first game-over's frozen score.
      if (!reconcileRevivedLeaderboardProof(game, loadedMeta)) return null;
      if (loadedMeta.runKind === 'tutorial') {
        useFtueStore.getState().restoreCheckpoint(loadedMeta.tutorialCheckpoint, loadedMeta.runId);
      }

      const runtime = useAnalyticsStore.getState().activeRun;
      if (runtime?.run_id === loadedMeta.runId) {
        const counters = [
          ['linesCleared', loadedMeta.linesCleared, runtime.lines],
          ['placements', loadedMeta.placements, runtime.placements],
          ['activeDurationMs', loadedMeta.activeDurationMs, runtime.active_duration_ms],
        ] as const;
        for (const [counter, checkpointValue, runtimeValue] of counters) {
          const differs =
            counter === 'activeDurationMs'
              ? Math.abs(checkpointValue - runtimeValue) > 1_000
              : checkpointValue !== runtimeValue;
          if (differs) {
            useAnalyticsStore.getState().track('checkpoint_counter_mismatch', {
              run_id: loadedMeta.runId,
              counter,
              checkpoint_value: checkpointValue,
              runtime_value: runtimeValue,
            });
          }
        }
      }
      useAnalyticsStore.getState().track('checkpoint_recovery', {
        run_id: loadedMeta.runId,
        checkpoint_version: loadedMeta.checkpointVersion,
        reason: pendingRecovery ? 'pending_settlement' : 'cold_resume',
      });

      set({
        ...detachAdventure(),
        game,
        activeConfig: loadedMeta.activeConfig,
        lastEvent: null,
        linesCleared: loadedMeta.linesCleared,
        finalResult: loadedMeta.settlement?.result ?? null,
        classicMeta: loadedMeta,
        epoch: get().epoch + 1,
        ...buildLoadedPresentationState(loadedMeta.bestAtStart, game.score),
      });
      persistClassicSnapshot(game, loadedMeta);
      if (
        pendingRecovery ||
        (game.status === 'over' &&
          !loadedMeta.settlement &&
          loadedMeta.lifecycle !== 'terminal_final')
      ) {
        settleClassic('final_game_over');
      }
      if (game.status === 'playing') {
        useAnalyticsStore.getState().resumeRun('classic', 'saved', loadedMeta.runId, {
          placements: loadedMeta.placements,
          lines: loadedMeta.linesCleared,
          activeDurationMs: loadedMeta.activeDurationMs,
        });
        recordAttributedNextRun('classic');
      }
      return game.status === 'playing' ? 'active' : 'terminal';
    },
  };
});
