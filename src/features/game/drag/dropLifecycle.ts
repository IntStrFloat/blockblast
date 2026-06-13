export interface DropCommit {
  trayIndex: number;
  row: number;
  col: number;
}

export function dropCommitFor(
  trayIndex: number,
  row: number,
  col: number,
  completed = true,
): DropCommit | null {
  'worklet';
  if (!completed || row < 0 || col < 0) return null;
  return { trayIndex, row, col };
}
