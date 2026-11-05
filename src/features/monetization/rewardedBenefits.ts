import { AppState } from 'react-native';

import { getJSON, KEYS, setJSONOrThrow } from '@/core/storage';
import { reconcileRevivedLeaderboardProof, useGameStore } from '@/features/game/store';
import type { HelperId } from '@/features/mascot/logic/types';
import { useMascot } from '@/features/mascot/store';

import { MONETIZATION } from './config';
import { useAdPresentation } from './adPresentation';
import type { AdsProvider } from './types';

export type RewardedBenefit = { kind: 'revive'; runId: string }
  | { kind: 'helper'; helperId: HelperId };
interface BenefitSession {
  sessionId: string;
  offer: RewardedBenefit;
  createdAt: number;
  adUnitId: string;
  environment: 'test' | 'production';
  state: 'showing' | 'earned_pending';
}

const pendingMemory = new Map<string, BenefitSession>();
let showing = false;
let activeSessionId: string | null = null;
const journal = () => getJSON<Record<string, BenefitSession>>(KEYS.rewardedBenefits) ?? {};
const save = (session: BenefitSession) => setJSONOrThrow(KEYS.rewardedBenefits, {
  ...journal(), [session.sessionId]: session,
});
function remove(sessionId: string) {
  const sessions = journal();
  delete sessions[sessionId];
  setJSONOrThrow(KEYS.rewardedBenefits, sessions);
  pendingMemory.delete(sessionId);
}
function sameOffer(left: RewardedBenefit, right: RewardedBenefit): boolean {
  return left.kind === 'revive' ? right.kind === 'revive' && left.runId === right.runId
    : right.kind === 'helper' && left.helperId === right.helperId;
}
function pruneUnconfirmedSessions(): void {
  const sessions = journal();
  let changed = false;
  for (const [id, session] of Object.entries(sessions)) {
    if (session.state !== 'showing' || id === activeSessionId) continue;
    // A prior process cannot resume its SDK callback. Never turn its unfinished
    // attempt into proof, and do not accumulate one entry per interrupted view.
    delete sessions[id];
    changed = true;
  }
  if (changed) setJSONOrThrow(KEYS.rewardedBenefits, sessions);
}
function apply(session: BenefitSession): boolean {
  save(session);
  if (session.offer.kind === 'helper') {
    // Charge and receipt share the same authoritative MMKV write.
    useMascot.getState().grantRewardedHelperCharge(session.offer.helperId, session.sessionId,
      Object.keys({ ...journal(), ...Object.fromEntries(pendingMemory) }));
  } else {
    const game = useGameStore.getState();
    // A confirmed continuation can only change the run that was offered.
    // Retain its obligation until that run is loaded again.
    if (game.adventure || game.classicMeta?.runId !== session.offer.runId) return false;
    if (!game.game.reviveUsed) {
      if (!game.continueGame(session.offer.runId)) return false;
    } else if (!reconcileRevivedLeaderboardProof(game.game, game.classicMeta)) return false;
  }
  remove(session.sessionId);
  resumeRevivedRun(session);
  return true;
}

function resumeRevivedRun(session: BenefitSession): void {
  if (session.offer.kind !== 'revive' || AppState.currentState !== 'active'
    || useAdPresentation.getState().fullscreenActive) return;
  const game = useGameStore.getState();
  if (!game.adventure && game.classicMeta?.runId === session.offer.runId
    && game.classicMeta.activeSinceAt === null && game.game.status === 'playing') game.resumeClassicActivity();
}

/** Recover only earned proof; a crash while showing cannot establish a reward. */
export function recoverRewardedBenefits(): void {
  try { pruneUnconfirmedSessions(); } catch { /* Recovery can retry a failed cleanup later. */ }
  for (const session of Object.values({ ...journal(), ...Object.fromEntries(pendingMemory) })) {
    if (session.state !== 'earned_pending') continue;
    try { apply(session); } catch { pendingMemory.set(session.sessionId, session); }
  }
}

export async function claimRewardedBenefit(
  offer: RewardedBenefit,
  ads: Pick<AdsProvider, 'showRewarded'>,
): Promise<'applied' | 'pending' | 'dismissed' | 'unavailable' | 'failed'> {
  if (showing) return 'unavailable';
  const confirmed = Object.values({ ...journal(), ...Object.fromEntries(pendingMemory) })
    .filter((session) => session.state === 'earned_pending');
  const pending = confirmed.find((session) => sameOffer(session.offer, offer));
  if (pending) {
    try { return apply(pending) ? 'applied' : 'pending'; } catch { return 'pending'; }
  }
  // Do not sell a second continuation while the previous run's earned right is
  // outstanding. Keep that proof without allowing an unbounded journal of runs.
  if (offer.kind === 'revive' && confirmed.some((session) => session.offer.kind === 'revive')) return 'unavailable';
  if (offer.kind === 'revive') {
    const game = useGameStore.getState();
    if (game.adventure || game.classicMeta?.runId !== offer.runId ||
      game.classicMeta.lifecycle !== 'terminal_revivable' || game.game.reviveUsed) return 'unavailable';
  }
  const session: BenefitSession = {
    sessionId: `benefit:${Date.now()}:${Math.random().toString(36).slice(2)}`,
    offer: { ...offer }, createdAt: Date.now(),
    adUnitId: MONETIZATION.yandex.rewardedAdUnitId,
    environment: MONETIZATION.yandex.rewardedAdUnitId.startsWith('demo-') ? 'test' : 'production',
    state: 'showing',
  };
  let earned = false;
  let applied = false;
  showing = true;
  activeSessionId = session.sessionId;
  try {
    pruneUnconfirmedSessions();
    save(session);
    const result = await ads.showRewarded(offer.kind === 'revive' ? 'revive' : 'helper_charge', () => {
      if (earned) return;
      earned = true;
      const confirmed: BenefitSession = { ...session, state: 'earned_pending' };
      pendingMemory.set(session.sessionId, confirmed);
      // Persist earned proof before changing the board or charge balance.
      try { applied = apply(confirmed); } catch { /* Retry payout, never another view. */ }
    });
    if (earned) return applied ? 'applied' : 'pending';
    remove(session.sessionId);
    return result === 'dismissed' ? 'dismissed' : 'unavailable';
  } catch {
    return earned ? applied ? 'applied' : 'pending' : 'failed';
  } finally {
    if (earned) resumeRevivedRun(session);
    showing = false;
    activeSessionId = null;
  }
}
