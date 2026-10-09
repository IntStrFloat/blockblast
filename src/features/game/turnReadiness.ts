export type TurnReadinessSource = 'existing_tray' | 'native_layout';

export function turnReadinessSource(
  newTray: boolean,
  postCommitPlayable: boolean,
): TurnReadinessSource | null {
  if (!postCommitPlayable) return null;
  return newTray ? 'native_layout' : 'existing_tray';
}
