import { KEYS, getJSON, setJSONOrThrow, storage } from '@/core/storage';
import { useMascot } from '@/features/mascot/store';
import { rewardReceiptKey, useProgression } from '@/features/progression';

import {
  adventureBonusIdentity,
  adventureXpBonusPaid,
  claimAdventureXpBonus,
  getAdventureXpOffer,
  hasPendingAdventureXpBonus,
  recoverAdventureXpBonuses,
} from '../adventureXpBonus';

function base(id: string, amount = 500) {
  useProgression.getState().grantReward({ runId: id, completionId: id, rewardId: 'xp', source: 'adventure', targetAmount: amount });
  return getAdventureXpOffer(id, id)!;
}

describe('Adventure optional XP entitlement', () => {
  beforeEach(() => {
    storage.clearAll();
    useProgression.setState({ lifetimePoints: 0, level: 1, world: 1, unlockedThemes: ['classic'], activeTheme: 'classic', claimedRewards: [], appliedSettlements: [], rewardReceipts: {}, reveal: null, revealQueue: [] });
  });
  afterEach(() => jest.restoreAllMocks());

  it('commits confirmed XP before dismiss, ignores duplicate callbacks and preserves the base receipt', async () => {
    const offer = base('before-dismiss');
    const original = useProgression.getState().rewardReceipts[rewardReceiptKey(offer.completionId, 'xp')];
    let earn!: () => void;
    let dismiss!: (result: 'rewarded') => void;
    const showRewarded = jest.fn((_placement, onEarned) => {
      earn = onEarned;
      return new Promise<'rewarded'>((resolve) => { dismiss = resolve; });
    });
    const claim = claimAdventureXpBonus(offer, { showRewarded });
    expect(useProgression.getState().lifetimePoints).toBe(500);
    earn();
    earn();
    expect(useProgression.getState().lifetimePoints).toBe(1_000);
    expect(useProgression.getState().rewardReceipts[rewardReceiptKey(offer.completionId, 'xp')]).toEqual(original);
    expect(adventureXpBonusPaid(offer.completionId)).toBe(true);
    dismiss('rewarded');
    await expect(claim).resolves.toBe('applied');
    await expect(claimAdventureXpBonus(offer, { showRewarded })).resolves.toBe('applied');
    expect(showRewarded).toHaveBeenCalledTimes(1);
  });

  it.each(['dismissed', 'unavailable', 'rewarded'] as const)('does not infer earned proof from result %s', async (result) => {
    const offer = base(`no-proof-${result}`);
    await claimAdventureXpBonus(offer, { showRewarded: jest.fn(async () => result) });
    expect(useProgression.getState().lifetimePoints).toBe(500);
    expect(adventureXpBonusPaid(offer.completionId)).toBe(false);
  });

  it('does not show an ad when the offer snapshot cannot be saved', async () => {
    const offer = base('snapshot-fail');
    const set = jest.spyOn(storage, 'set').mockImplementation(() => { throw new Error('disk'); });
    const showRewarded = jest.fn(async () => 'rewarded' as const);
    await expect(claimAdventureXpBonus(offer, { showRewarded })).resolves.toBe('failed');
    expect(showRewarded).not.toHaveBeenCalled();
    set.mockRestore();
  });

  it('retries a failed payout from durable earned proof without a second ad', async () => {
    const offer = base('grant-fail');
    const grant = jest.spyOn(useProgression.getState(), 'grantReward').mockImplementation(() => { throw new Error('disk'); });
    const showRewarded = jest.fn(async (_placement, onEarned) => { onEarned?.(); return 'rewarded' as const; });
    await expect(claimAdventureXpBonus(offer, { showRewarded })).resolves.toBe('pending');
    expect(getJSON<Record<string, { state: string }>>(KEYS.adventureXpBonus)?.[offer.completionId].state).toBe('earned_pending');
    grant.mockRestore();
    await expect(claimAdventureXpBonus(offer, { showRewarded })).resolves.toBe('applied');
    expect(showRewarded).toHaveBeenCalledTimes(1);
    expect(useProgression.getState().lifetimePoints).toBe(1_000);
  });

  it('recovers a disk-only earned journal after restart but never an unconfirmed showing session', () => {
    const earned = base('disk-earned');
    const unconfirmed = base('disk-showing');
    setJSONOrThrow(KEYS.adventureXpBonus, {
      [earned.completionId]: { ...earned, sessionId: 'saved-1', createdAt: 1, state: 'earned_pending' },
      [unconfirmed.completionId]: { ...unconfirmed, sessionId: 'saved-2', createdAt: 1, state: 'showing' },
    });
    recoverAdventureXpBonuses();
    recoverAdventureXpBonuses();
    expect(useProgression.getState().lifetimePoints).toBe(1_500);
    expect(adventureXpBonusPaid(earned.completionId)).toBe(true);
    expect(adventureXpBonusPaid(unconfirmed.completionId)).toBe(false);
  });

  it('preserves in-memory earned proof when its first journal write fails', async () => {
    const offer = base('earned-write-fail');
    const originalSet = storage.set.bind(storage);
    const set = jest.spyOn(storage, 'set').mockImplementation((key, value) => {
      if (key === KEYS.adventureXpBonus && String(value).includes('earned_pending')) throw new Error('disk');
      originalSet(key, value);
    });
    const showRewarded = jest.fn(async (_placement, onEarned) => { onEarned?.(); return 'rewarded' as const; });
    await expect(claimAdventureXpBonus(offer, { showRewarded })).resolves.toBe('pending');
    expect(hasPendingAdventureXpBonus(offer.completionId)).toBe(true);
    set.mockRestore();
    await expect(claimAdventureXpBonus(offer, { showRewarded })).resolves.toBe('applied');
    expect(showRewarded).toHaveBeenCalledTimes(1);
  });

  it('unlocks crossed cosmetics and presents progression without replaying the base entitlement', async () => {
    const offer = base('cosmetics', 3_000);
    const unlock = jest.spyOn(useMascot.getState(), 'unlock');
    await claimAdventureXpBonus(offer, { showRewarded: jest.fn(async (_placement, onEarned) => { onEarned?.(); return 'rewarded' as const; }) });
    expect(unlock).toHaveBeenCalled();
    expect(useProgression.getState().reveal).toBeNull();
    expect(useProgression.getState().revealQueue[0]?.runId).toBe(offer.runId);
    expect(useProgression.getState().rewardReceipts[rewardReceiptKey(adventureBonusIdentity(offer.completionId), 'xp')].grantedAmount).toBe(3_000);
    expect(getAdventureXpOffer(offer.completionId, 'a-retry-run')).toBeNull();
  });

  it('does not pay twice when journal cleanup fails after the balance commit', async () => {
    const offer = base('cleanup-fail');
    const originalSet = storage.set.bind(storage);
    const set = jest.spyOn(storage, 'set').mockImplementation((key, value) => {
      if (key === KEYS.adventureXpBonus && value === '{}') throw new Error('disk');
      originalSet(key, value);
    });
    const showRewarded = jest.fn(async (_placement, onEarned) => { onEarned?.(); return 'rewarded' as const; });
    await expect(claimAdventureXpBonus(offer, { showRewarded })).resolves.toBe('pending');
    expect(useProgression.getState().lifetimePoints).toBe(1_000);
    set.mockRestore();
    await expect(claimAdventureXpBonus(offer, { showRewarded })).resolves.toBe('applied');
    expect(useProgression.getState().lifetimePoints).toBe(1_000);
    expect(showRewarded).toHaveBeenCalledTimes(1);
  });

  it('keeps the confirmed bonus when the SDK subsequently rejects the display promise', async () => {
    const offer = base('earned-then-failure');
    await expect(claimAdventureXpBonus(offer, {
      showRewarded: jest.fn(async (_placement, onEarned) => { onEarned?.(); throw new Error('show failed'); }),
    })).resolves.toBe('applied');
    expect(useProgression.getState().lifetimePoints).toBe(1_000);
  });
});
