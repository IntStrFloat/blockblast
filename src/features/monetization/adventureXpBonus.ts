import { KEYS, getJSON, setJSONOrThrow } from '@/core/storage';
import { useAnalyticsStore } from '@/features/analytics';
import { useMascot } from '@/features/mascot/store';
import { rewardReceiptKey, rewardsBetween, useProgression } from '@/features/progression';

import type { AdsProvider } from './types';
import { MONETIZATION } from './config';

export interface AdventureXpOffer {
  completionId: string;
  runId: string;
  amount: number;
}

interface BonusSession extends AdventureXpOffer {
  sessionId: string;
  createdAt: number;
  adUnitId: string;
  environment: 'test' | 'production';
  state: 'showing' | 'earned_pending';
}

type BonusPhase = 'offered' | 'requested' | 'earned' | 'applied' | 'dismissed' | 'unavailable' | 'failed';
// Keep earned proof in memory too when the first critical disk write fails.
// A process death before that write succeeds cannot be recovered without SDK replay.
const pendingMemory = new Map<string, BonusSession>();
let showing = false;

export function adventureBonusIdentity(completionId: string): string {
  return `${completionId}:rewarded-xp`;
}

function journal(): Record<string, BonusSession> {
  return getJSON<Record<string, BonusSession>>(KEYS.adventureXpBonus) ?? {};
}

function saveSession(session: BonusSession): void {
  setJSONOrThrow(KEYS.adventureXpBonus, { ...journal(), [session.completionId]: session });
}

function removeSession(completionId: string): void {
  const sessions = journal();
  delete sessions[completionId];
  setJSONOrThrow(KEYS.adventureXpBonus, sessions);
  pendingMemory.delete(completionId);
}

export function trackAdventureXpOffer(offer: AdventureXpOffer, phase: BonusPhase): void {
  useAnalyticsStore.getState().track('ad_reward_offer', {
    placement: 'adventure_xp_bonus',
    completion_id: offer.completionId,
    amount: offer.amount,
    phase,
    policy_version: MONETIZATION.placementPolicy.version,
  });
}

export function hasPendingAdventureXpBonus(completionId: string): boolean {
  return pendingMemory.has(completionId) || journal()[completionId]?.state === 'earned_pending';
}

export function adventureXpBonusPaid(completionId: string): boolean {
  return (useProgression.getState().rewardReceipts[
    rewardReceiptKey(adventureBonusIdentity(completionId), 'xp')
  ]?.grantedAmount ?? 0) > 0;
}

export function getAdventureXpOffer(completionId: string, runId: string): AdventureXpOffer | null {
  if (adventureXpBonusPaid(completionId) || hasPendingAdventureXpBonus(completionId)) return null;
  const receipt = useProgression.getState().rewardReceipts[rewardReceiptKey(completionId, 'xp')];
  if (!receipt || receipt.source !== 'adventure' || receipt.runId !== runId ||
      !Number.isSafeInteger(receipt.grantedAmount) || receipt.grantedAmount <= 0) return null;
  return { completionId, runId, amount: receipt.grantedAmount };
}

function applySession(session: BonusSession): void {
  // Journal first, then atomic balance+receipt. Replaying either side of the
  // second commit is safe because grantReward uses a cumulative entitlement.
  saveSession(session);
  const identity = adventureBonusIdentity(session.completionId);
  const result = useProgression.getState().grantReward({
    runId: identity,
    completionId: identity,
    rewardId: 'xp',
    source: 'adventure',
    targetAmount: session.amount,
  });
  const rewards = rewardsBetween(result.receipt.fromLevel, result.receipt.toLevel);
  for (const reward of rewards) {
    if (reward.kind === 'cosmetic') useMascot.getState().unlock(reward.id);
  }
  if (result.receipt.toLevel > result.receipt.fromLevel) {
    useProgression.getState().enqueueReveal({
      id: `${identity}:${result.receipt.toLevel}`,
      runId: session.runId,
      level: result.receipt.toLevel,
      rewards,
    });
  }
  removeSession(session.completionId);
  trackAdventureXpOffer(session, 'applied');
}

/** Called at startup and on the result screen; never grants unconfirmed sessions. */
export function recoverAdventureXpBonuses(): void {
  const sessions = { ...journal(), ...Object.fromEntries(pendingMemory) };
  for (const session of Object.values(sessions)) {
    if (session.state !== 'earned_pending') continue;
    try {
      applySession(session);
    } catch {
      pendingMemory.set(session.completionId, session);
    }
  }
}

export type AdventureXpBonusResult = 'applied' | 'pending' | 'dismissed' | 'unavailable' | 'failed';

export async function claimAdventureXpBonus(
  offer: AdventureXpOffer,
  ads: Pick<AdsProvider, 'showRewarded'>,
): Promise<AdventureXpBonusResult> {
  if (hasPendingAdventureXpBonus(offer.completionId)) {
    recoverAdventureXpBonuses();
    return hasPendingAdventureXpBonus(offer.completionId) ? 'pending' : 'applied';
  }
  if (adventureXpBonusPaid(offer.completionId)) return 'applied';
  if (showing) return 'unavailable';
  const fresh = getAdventureXpOffer(offer.completionId, offer.runId);
  if (!fresh || fresh.amount !== offer.amount) return 'unavailable';
  showing = true;
  const session: BonusSession = {
    ...fresh,
    sessionId: `adventure-xp:${Date.now()}:${Math.random().toString(36).slice(2)}`,
    createdAt: Date.now(),
    adUnitId: MONETIZATION.yandex.rewardedAdUnitId,
    environment: MONETIZATION.yandex.rewardedAdUnitId.startsWith('demo-') ? 'test' : 'production',
    state: 'showing',
  };
  let earned = false;
  try {
    saveSession(session);
    trackAdventureXpOffer(session, 'requested');
    const result = await ads.showRewarded('adventure_xp_bonus', () => {
      if (earned) return;
      earned = true;
      const confirmed: BonusSession = { ...session, state: 'earned_pending' };
      pendingMemory.set(session.completionId, confirmed);
      try {
        // Protect proof before telemetry or any reward side effects.
        saveSession(confirmed);
        trackAdventureXpOffer(session, 'earned');
        applySession(confirmed);
      } catch {
        // Retry payout only, never require another ad for confirmed proof.
      }
    });
    if (earned) return hasPendingAdventureXpBonus(offer.completionId) ? 'pending' : 'applied';
    removeSession(session.completionId);
    const outcome = result === 'dismissed' ? 'dismissed' : 'unavailable';
    trackAdventureXpOffer(session, outcome);
    return outcome;
  } catch {
    if (earned) return hasPendingAdventureXpBonus(offer.completionId) ? 'pending' : 'applied';
    trackAdventureXpOffer(session, 'failed');
    return 'failed';
  } finally {
    showing = false;
  }
}
