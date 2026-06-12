import { BOARD_CELLS, TRAY_SIZE } from './types';
import type { GameState } from './types';
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

export function serialize(state: GameState): string {
  const save: SaveV1 = {
    v: 1,
    board: state.board,
    tray: state.tray.map((p) => (p ? { id: p.shape.id, colorId: p.colorId } : null)),
    score: state.score,
    combo: state.combo,
    movesSinceClear: state.movesSinceClear,
    status: state.status,
    reviveUsed: state.reviveUsed,
    rngState: state.rngState,
  };
  return JSON.stringify(save);
}

export function deserialize(raw: string): GameState | null {
  let save: SaveV1;
  try {
    save = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!save || save.v !== 1) return null;
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
    status: save.status,
    reviveUsed: save.reviveUsed,
    rngState: save.rngState,
  };
}
