import { findPlacements } from './board';
import { createGame, place } from './game';

/**
 * Детерминированный «отпечаток поведения» движка: одинаковая версия движка даёт
 * одинаковую строку независимо от представления (TS-исходник клиента vs
 * скомпилированный backend/runtime). Считается чистой арифметикой (FNV-1a по
 * потоку ходов/очков на нескольких сидах), без crypto — безопасно для RN.
 *
 * Сервер отдаёт его на /api/health, чтобы ловить расхождение между задеплоенным
 * верификатором и движком клиента: иначе ranked-сабмиты молча отклоняются
 * (см. docs/runbooks/leaderboard-operations.md → «Engine drift»).
 */
const FINGERPRINT_SEEDS = [1, 7, 42, 1000, 123456, 2147483647];
const MAX_FINGERPRINT_MOVES = 10_000;

export function engineFingerprint(): string {
  let acc = 0x811c9dc5; // FNV-1a 32-bit offset basis
  const mix = (n: number) => {
    acc = (acc ^ (n | 0)) >>> 0;
    acc = Math.imul(acc, 0x01000193) >>> 0;
  };

  for (const seed of FINGERPRINT_SEEDS) {
    let state = createGame(seed);
    mix(seed);
    let guard = 0;
    while (state.status === 'playing' && guard < MAX_FINGERPRINT_MOVES) {
      guard += 1;
      let moved = false;
      // Детерминированная стратегия: первый слот лотка с возможной постановкой,
      // первая допустимая клетка. Фиксирует генерацию фигур и скоринг.
      for (let trayIndex = 0; trayIndex < state.tray.length; trayIndex += 1) {
        const piece = state.tray[trayIndex];
        if (!piece) continue;
        const spots = findPlacements(state.board, piece.shape);
        if (spots.length === 0) continue;
        const [row, col] = spots[0];
        state = place(state, trayIndex, row, col).state;
        mix(trayIndex);
        mix(row);
        mix(col);
        mix(state.score);
        moved = true;
        break;
      }
      if (!moved) break;
    }
    mix(state.score);
    mix(guard);
  }

  return (acc >>> 0).toString(16).padStart(8, '0');
}
