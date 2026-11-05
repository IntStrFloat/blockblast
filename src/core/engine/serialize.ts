import { BOARD_CELLS, TRAY_SIZE } from './types';
import type { GameConfig, GameState } from './types';
import { SHAPES_BY_ID } from './shapes';

interface SaveV1 {
  v: 1;
  board: number[];
  tray: ({ id: string; colorId: number } | null)[];
  score: number;
  combo: number;
  movesSinceClear: number;
  status: 'playing' | 'over';
  reviveUsed: boolean;
  rngState: number;
}

interface SaveV2 extends Omit<SaveV1, 'v'> {
  v: 2;
  waveNumber: number;
}

export const CLASSIC_CHECKPOINT_VERSION = 2 as const;

export interface ClassicCheckpointSettlement {
  revision: number;
  previousTargetScore: number;
  targetScore: number;
  reason: 'home' | 'replay' | 'restart' | 'game_over';
  result: { newRecord: boolean; delta: number } | null;
  phase: 'pending' | 'complete';
  committedAt: number;
  completedAt: number | null;
}

export interface ClassicCheckpointMeta {
  checkpointVersion: typeof CLASSIC_CHECKPOINT_VERSION;
  runId: string;
  /** Identity of the separate ranked proof, used for crash-safe revive reconciliation. */
  leaderboardProofId?: string;
  runKind: 'classic' | 'tutorial';
  lifecycle: 'active' | 'terminal_revivable' | 'terminal_final';
  configId: string;
  activeConfig: GameConfig;
  linesCleared: number;
  placements: number;
  activeDurationMs: number;
  activeSinceAt: number | null;
  bestAtStart: number;
  settlement: ClassicCheckpointSettlement | null;
  /** Feature-owned FTUE state captured in the same durable run checkpoint. */
  tutorialCheckpoint?: Record<string, unknown> | null;
}

interface ClassicCheckpointV2 {
  v: typeof CLASSIC_CHECKPOINT_VERSION;
  game: SaveV2;
  meta: ClassicCheckpointMeta;
}

function gameToSave(state: GameState): SaveV2 {
  return {
    v: 2,
    board: state.board,
    tray: state.tray.map((p) => (p ? { id: p.shape.id, colorId: p.colorId } : null)),
    score: state.score,
    combo: state.combo,
    movesSinceClear: state.movesSinceClear,
    waveNumber: state.waveNumber,
    status: state.status,
    reviveUsed: state.reviveUsed,
    rngState: state.rngState,
  };
}

export function serialize(state: GameState): string {
  return JSON.stringify(gameToSave(state));
}

export function deserialize(raw: string): GameState | null {
  let save: SaveV1 | SaveV2;
  try {
    save = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!save || (save.v !== 1 && save.v !== 2)) return null;
  if (!Array.isArray(save.board) || save.board.length !== BOARD_CELLS) return null;
  if (!save.board.every((v) => typeof v === 'number' && v >= 0)) return null;
  if (!Array.isArray(save.tray) || save.tray.length !== TRAY_SIZE) return null;
  if (save.status !== 'playing' && save.status !== 'over') return null;
  if (
    typeof save.score !== 'number' ||
    typeof save.combo !== 'number' ||
    typeof save.movesSinceClear !== 'number' ||
    typeof save.rngState !== 'number' ||
    typeof save.reviveUsed !== 'boolean'
  ) {
    return null;
  }
  const waveNumber = save.v === 1 ? 3 : save.waveNumber;
  if (!Number.isInteger(waveNumber) || waveNumber < 0) return null;

  const tray: GameState['tray'] = [];
  for (const t of save.tray) {
    if (t === null) {
      tray.push(null);
      continue;
    }
    const shape = SHAPES_BY_ID.get(t.id);
    if (!shape || typeof t.colorId !== 'number') return null;
    tray.push({ shape, colorId: t.colorId });
  }

  return {
    board: save.board,
    tray,
    score: save.score,
    combo: save.combo,
    movesSinceClear: save.movesSinceClear,
    waveNumber,
    status: save.status,
    reviveUsed: save.reviveUsed,
    rngState: save.rngState,
  };
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return isFiniteNonNegative(value) && Number.isInteger(value);
}

function isGameConfig(value: unknown): value is GameConfig {
  if (!value || typeof value !== 'object') return false;
  const config = value as Partial<GameConfig>;
  const scoring = config.scoring;
  const spawn = config.spawn;
  return (
    Number.isInteger(config.colors) &&
    (config.colors ?? 0) > 0 &&
    (config.trayPolicy === 'pure' || config.trayPolicy === 'pity') &&
    !!scoring &&
    isFiniteNonNegative(scoring.perPlacedCell) &&
    isFiniteNonNegative(scoring.perClearedCell) &&
    Array.isArray(scoring.lineBonus) &&
    scoring.lineBonus.every(isFiniteNonNegative) &&
    isFiniteNonNegative(scoring.boardClearBonus) &&
    isFiniteNonNegative(scoring.comboStep) &&
    isFiniteNonNegative(scoring.comboForgiveness) &&
    !!spawn &&
    Number.isInteger(spawn.candidates) &&
    spawn.candidates > 0 &&
    isFiniteNonNegative(spawn.sizeBias) &&
    isFiniteNonNegative(spawn.emptyTargetMass) &&
    isFiniteNonNegative(spawn.fullTargetMass) &&
    isFiniteNonNegative(spawn.rescueFullness) &&
    isFiniteNonNegative(spawn.rescueDryStreak) &&
    isFiniteNonNegative(spawn.rescueDryStreakMinFullness) &&
    (spawn.fallbackNodeLimit === undefined || isFiniteNonNegative(spawn.fallbackNodeLimit)) &&
    (spawn.preferClearAssist === undefined || typeof spawn.preferClearAssist === 'boolean')
  );
}

function isSettlement(value: ClassicCheckpointSettlement | null | undefined): boolean {
  if (value == null) return true;
  const validResult =
    value.result === null ||
    (typeof value.result?.newRecord === 'boolean' &&
      isFiniteNonNegative(value.result.delta));
  return (
    Number.isInteger(value.revision) &&
    value.revision > 0 &&
    isFiniteNonNegative(value.previousTargetScore) &&
    isFiniteNonNegative(value.targetScore) &&
    value.previousTargetScore <= value.targetScore &&
    ['home', 'replay', 'restart', 'game_over'].includes(value.reason) &&
    (value.phase === 'pending' || value.phase === 'complete') &&
    isFiniteNonNegative(value.committedAt) &&
    validResult &&
    (value.phase === 'pending'
      ? value.result === null && value.completedAt === null
      : value.result !== null && isFiniteNonNegative(value.completedAt))
  );
}

/**
 * One MMKV value containing every rule and counter needed to continue a run.
 * The game payload remains v2-compatible internally; the outer version belongs
 * to the checkpoint contract and can evolve independently.
 */
export function serializeClassicCheckpoint(
  game: GameState,
  meta: ClassicCheckpointMeta,
): string {
  return JSON.stringify({
    v: CLASSIC_CHECKPOINT_VERSION,
    game: gameToSave(game),
    meta,
  } satisfies ClassicCheckpointV2);
}

export function deserializeClassicCheckpoint(
  raw: string,
): { game: GameState; meta: ClassicCheckpointMeta } | null {
  let checkpoint: Partial<ClassicCheckpointV2>;
  try {
    checkpoint = JSON.parse(raw) as Partial<ClassicCheckpointV2>;
  } catch {
    return null;
  }
  if (checkpoint.v !== CLASSIC_CHECKPOINT_VERSION || !checkpoint.game || !checkpoint.meta) {
    return null;
  }
  const game = deserialize(JSON.stringify(checkpoint.game));
  const meta = checkpoint.meta as Partial<ClassicCheckpointMeta>;
  const settlement = meta.settlement
    ? {
        ...meta.settlement,
        previousTargetScore: isFiniteNonNegative(meta.settlement.previousTargetScore)
          ? meta.settlement.previousTargetScore
          : 0,
      }
    : null;
  if (
    !game ||
    meta.checkpointVersion !== CLASSIC_CHECKPOINT_VERSION ||
    typeof meta.runId !== 'string' ||
    meta.runId.length === 0 ||
    (meta.leaderboardProofId !== undefined &&
      (typeof meta.leaderboardProofId !== 'string' || meta.leaderboardProofId.length === 0)) ||
    (meta.runKind !== 'classic' && meta.runKind !== 'tutorial') ||
    !['active', 'terminal_revivable', 'terminal_final'].includes(meta.lifecycle ?? '') ||
    typeof meta.configId !== 'string' ||
    meta.configId.length === 0 ||
    !isGameConfig(meta.activeConfig) ||
    !isNonNegativeInteger(meta.linesCleared) ||
    !isNonNegativeInteger(meta.placements) ||
    !isNonNegativeInteger(meta.activeDurationMs) ||
    !isNonNegativeInteger(meta.bestAtStart) ||
    (meta.tutorialCheckpoint !== undefined &&
      meta.tutorialCheckpoint !== null &&
      typeof meta.tutorialCheckpoint !== 'object') ||
    (meta.activeSinceAt !== null && !isFiniteNonNegative(meta.activeSinceAt)) ||
    !isSettlement(settlement) ||
    (game.status === 'playing' && meta.lifecycle !== 'active') ||
    (game.status === 'over' && meta.lifecycle === 'active')
  ) {
    return null;
  }
  return {
    game,
    meta: {
      ...(meta as ClassicCheckpointMeta),
      settlement: settlement
        ? settlement
        : null,
    },
  };
}
