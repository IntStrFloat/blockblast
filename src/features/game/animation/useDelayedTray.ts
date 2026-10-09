import type { PieceInstance, PlacementEvent } from '@/core/engine';

export function trayRefillDelayMs(_event: PlacementEvent | null): number {
  return 0;
}

export function useDelayedTray(
  tray: (PieceInstance | null)[],
  _lastEvent: PlacementEvent | null,
): (PieceInstance | null)[] {
  return committedTrayFor(tray);
}

export function committedTrayFor(tray: (PieceInstance | null)[]): (PieceInstance | null)[] {
  return tray;
}
