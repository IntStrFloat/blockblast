export type NextActionKind = 'adventure' | 'leaderboard';

export interface NextActionState {
  gamesPlayed: number;
  adventure: {
    available: boolean;
    complete: boolean;
  };
  leaderboard: {
    available: boolean;
    complete: boolean;
  };
}

export interface NextAction {
  kind: NextActionKind;
  /** True only on the first scheduled reveal of a feature. */
  isReveal: boolean;
}

function action(kind: NextActionKind, isReveal: boolean): NextAction {
  return { kind, isReveal };
}

/**
 * Selects the single retention card rendered below the Home primary CTA.
 *
 * The first three completed games deliberately reveal one concept at a time.
 * Game four is a cooldown: it introduces no additional automatic card. From
 * game five onward the next incomplete, available goal wins by product
 * priority instead of by feature novelty.
 */
export function selectNextAction(state: NextActionState): NextAction | null {
  const gamesPlayed = Math.max(0, Math.floor(state.gamesPlayed));

  if (gamesPlayed === 1 && state.adventure.available) return action('adventure', true);
  if (gamesPlayed === 2 && state.leaderboard.available) return action('leaderboard', true);
  if (gamesPlayed < 5) return null;

  if (state.adventure.available && !state.adventure.complete) return action('adventure', false);
  if (state.leaderboard.available && !state.leaderboard.complete) {
    return action('leaderboard', false);
  }

  return null;
}
