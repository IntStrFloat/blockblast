import { AppState } from 'react-native';

import { deserializeClassicCheckpoint } from '@/core/engine';
import { getJSON, getString, KEYS, setJSONOrThrow, storage } from '@/core/storage';
import { useGameStore } from '@/features/game/store';
import { useLeaderboardStore } from '@/features/leaderboard/store';
import { useMascot } from '@/features/mascot/store';

import { claimRewardedBenefit, recoverRewardedBenefits } from '../rewardedBenefits';
import type { AdsProvider } from '../types';
import { useAdPresentation } from '../adPresentation';

const helper = { kind: 'helper', helperId: 'hint' } as const;
const rewarded = (earn: (() => void) | undefined) => { earn?.(); return 'rewarded' as const; };
function terminal() {
  useGameStore.getState().newGame({ seed: 731 });
  const current = useGameStore.getState();
  useGameStore.setState({
    game: { ...current.game, status: 'over' },
    classicMeta: { ...current.classicMeta!, lifecycle: 'terminal_revivable' },
  });
  return { kind: 'revive', runId: current.classicMeta!.runId } as const;
}

describe('durable earned revive and helper benefits', () => {
  beforeEach(() => {
    storage.clearAll();
    AppState.currentState = 'active';
    useAdPresentation.setState({ fullscreenActive: false });
    useMascot.setState({ helperCharges: {}, rewardedHelperReceipts: {} });
  });
  afterEach(() => jest.restoreAllMocks());

  it('commits one helper charge at earned before dismiss, rejects duplicate taps and callbacks', async () => {
    let earn!: () => void;
    let dismiss!: (result: 'rewarded') => void;
    const showRewarded = jest.fn<ReturnType<AdsProvider['showRewarded']>, Parameters<AdsProvider['showRewarded']>>(
      (_placement, onEarned) => { earn = onEarned!; return new Promise((resolve) => { dismiss = resolve; }); },
    );
    const pending = claimRewardedBenefit(helper, { showRewarded });
    await expect(claimRewardedBenefit(helper, { showRewarded })).resolves.toBe('unavailable');
    expect(useMascot.getState().helperCharges.hint).toBeUndefined();
    earn();
    earn();
    expect(useMascot.getState().helperCharges.hint).toBe(1);
    expect(getJSON<{ helperCharges: { hint: number }; rewardedHelperReceipts: Record<string, true> }>(KEYS.mascot))
      .toMatchObject({ helperCharges: { hint: 1 }, rewardedHelperReceipts: useMascot.getState().rewardedHelperReceipts });
    dismiss('rewarded');
    await expect(pending).resolves.toBe('applied');
    expect(showRewarded).toHaveBeenCalledTimes(1);
  });

  it.each(['rewarded', 'dismissed', 'unavailable'] as const)('never infers earned proof from result %s', async (result) => {
    const offer = terminal();
    const showRewarded = jest.fn(async () => result);
    await claimRewardedBenefit(helper, { showRewarded });
    await claimRewardedBenefit(offer, { showRewarded });
    expect(useMascot.getState().helperCharges).toEqual({});
    expect(useGameStore.getState().game.reviveUsed).toBe(false);
  });

  it('does not request an ad if its immutable offer cannot be saved', async () => {
    const write = jest.spyOn(storage, 'set').mockImplementation(() => { throw new Error('disk'); });
    const showRewarded = jest.fn(async () => 'rewarded' as const);
    await expect(claimRewardedBenefit(helper, { showRewarded })).resolves.toBe('failed');
    expect(showRewarded).not.toHaveBeenCalled();
    write.mockRestore();
  });

  it('retains earned proof if the first write fails and retries only fulfillment', async () => {
    const original = storage.set.bind(storage);
    const write = jest.spyOn(storage, 'set').mockImplementation((key, value) => {
      if (key === KEYS.rewardedBenefits && String(value).includes('earned_pending')) throw new Error('disk');
      original(key, value);
    });
    const showRewarded = jest.fn(async (_placement, earn) => rewarded(earn));
    await expect(claimRewardedBenefit(helper, { showRewarded })).resolves.toBe('pending');
    expect(useMascot.getState().helperCharges).toEqual({});
    write.mockRestore();
    await expect(claimRewardedBenefit(helper, { showRewarded })).resolves.toBe('applied');
    expect(showRewarded).toHaveBeenCalledTimes(1);
    expect(useMascot.getState().helperCharges.hint).toBe(1);
  });

  it('replays disk-only earned sessions after restart, ignoring unconfirmed sessions and applied receipts', () => {
    const session = { sessionId: 'disk-earned', offer: helper, createdAt: 1, state: 'earned_pending' };
    setJSONOrThrow(KEYS.rewardedBenefits, {
      'disk-earned': session,
      'disk-showing': { ...session, sessionId: 'disk-showing', state: 'showing' },
    });
    recoverRewardedBenefits();
    expect(useMascot.getState().helperCharges.hint).toBe(1);
    expect(getJSON(KEYS.rewardedBenefits)).toEqual({});
    const saved = getJSON<{ helperCharges: { hint: number }; rewardedHelperReceipts: Record<string, true> }>(KEYS.mascot)!;
    // Replay a torn journal cleanup after reconstructing the recipient from disk.
    useMascot.setState(saved);
    setJSONOrThrow(KEYS.rewardedBenefits, { 'disk-earned': session });
    recoverRewardedBenefits();
    expect(useMascot.getState().helperCharges.hint).toBe(1);
  });

  it('does not double pay when journal cleanup fails after a charge commit', async () => {
    const original = storage.set.bind(storage);
    const write = jest.spyOn(storage, 'set').mockImplementation((key, value) => {
      if (key === KEYS.rewardedBenefits && value === '{}') throw new Error('disk');
      original(key, value);
    });
    const showRewarded = jest.fn(async (_placement, earn) => rewarded(earn));
    await expect(claimRewardedBenefit(helper, { showRewarded })).resolves.toBe('pending');
    expect(useMascot.getState().helperCharges.hint).toBe(1);
    write.mockRestore();
    await expect(claimRewardedBenefit(helper, { showRewarded })).resolves.toBe('applied');
    expect(useMascot.getState().helperCharges.hint).toBe(1);
    expect(showRewarded).toHaveBeenCalledTimes(1);
  });

  it('bounds old helper receipts while retaining receipts for every outstanding earned journal', async () => {
    const rewardedHelperReceipts = Object.fromEntries(Array.from({ length: 300 }, (_, index) => [`past-${index}`, true as const]));
    useMascot.setState({ rewardedHelperReceipts });
    setJSONOrThrow(KEYS.rewardedBenefits, {
      'past-0': { sessionId: 'past-0', offer: { kind: 'helper', helperId: 'swap' }, createdAt: 1, state: 'earned_pending' },
    });
    await claimRewardedBenefit(helper, { showRewarded: jest.fn(async (_placement, earn) => rewarded(earn)) });
    expect(Object.keys(useMascot.getState().rewardedHelperReceipts!)).toHaveLength(257);
    expect(useMascot.getState().rewardedHelperReceipts?.['past-0']).toBe(true);
    recoverRewardedBenefits();
    expect(useMascot.getState().helperCharges.swap).toBeUndefined();
    expect(useMascot.getState().helperCharges.hint).toBe(1);
  });

  it('persists the revived board at earned and cannot repeat a continuation', async () => {
    const offer = terminal();
    const showRewarded = jest.fn(async (_placement, earn) => {
      earn?.(); earn?.();
      expect(useGameStore.getState().game.reviveUsed).toBe(true);
      expect(deserializeClassicCheckpoint(getString(KEYS.classicRunEnvelope)!)?.game.reviveUsed).toBe(true);
      throw new Error('late show rejection');
    });
    await expect(claimRewardedBenefit(offer, { showRewarded })).resolves.toBe('applied');
    await expect(claimRewardedBenefit(offer, { showRewarded })).resolves.toBe('unavailable');
    expect(showRewarded).toHaveBeenCalledTimes(1);
  });

  it('excludes the remaining ad duration from the earned continuation active-play clock', async () => {
    const offer = terminal();
    useAdPresentation.setState({ fullscreenActive: true });
    await claimRewardedBenefit(offer, { showRewarded: jest.fn(async (_placement, earn) => {
      earn?.();
      expect(useGameStore.getState().classicMeta?.activeSinceAt).toBeNull();
      expect(deserializeClassicCheckpoint(getString(KEYS.classicRunEnvelope)!)?.meta.activeSinceAt).toBeNull();
      useAdPresentation.setState({ fullscreenActive: false });
      return 'rewarded' as const;
    }) });
    expect(useGameStore.getState().classicMeta?.activeSinceAt).toEqual(expect.any(Number));
  });

  it('retains the original run obligation when navigation changes context and never revives another run', async () => {
    const offer = terminal();
    const original = useGameStore.getState();
    const originalProof = useLeaderboardStore.getState().activeProof;
    const showRewarded = jest.fn(async (_placement, earn) => {
      useGameStore.getState().newGame();
      earn?.();
      return 'rewarded' as const;
    });
    await expect(claimRewardedBenefit(offer, { showRewarded })).resolves.toBe('pending');
    expect(useGameStore.getState().game.reviveUsed).toBe(false);
    recoverRewardedBenefits();
    expect(useGameStore.getState().game.reviveUsed).toBe(false);
    useGameStore.setState(original);
    useLeaderboardStore.setState({ activeProof: originalProof });
    recoverRewardedBenefits();
    expect(useGameStore.getState().game.reviveUsed).toBe(true);
  });

  it('repairs a frozen matching proof on restart after the revived board committed but the proof write failed', async () => {
    const offer = terminal();
    const frozen = { ...useLeaderboardStore.getState().activeProof!, frozenScore: 100, finishedAt: new Date().toISOString() };
    useLeaderboardStore.setState({ activeProof: frozen });
    setJSONOrThrow(KEYS.leaderboardActiveProof, frozen);
    const original = storage.set.bind(storage);
    const write = jest.spyOn(storage, 'set').mockImplementation((key, value) => {
      if (key === KEYS.leaderboardActiveProof) throw new Error('disk');
      original(key, value);
    });
    const showRewarded = jest.fn(async (_placement, earn) => rewarded(earn));
    await expect(claimRewardedBenefit(offer, { showRewarded })).resolves.toBe('pending');
    expect(deserializeClassicCheckpoint(getString(KEYS.classicRunEnvelope)!)?.game.reviveUsed).toBe(true);
    expect(getJSON(KEYS.leaderboardActiveProof)).toMatchObject({ frozenScore: 100 });
    expect(useLeaderboardStore.getState().activeProof?.frozenScore).toBe(100);
    expect(getJSON(KEYS.rewardedBenefits)).toEqual(expect.objectContaining({
      [Object.keys(getJSON<Record<string, unknown>>(KEYS.rewardedBenefits)!)[0]]: expect.objectContaining({ state: 'earned_pending' }),
    }));
    write.mockRestore();
    expect(useGameStore.getState().loadSaved()).toBe('active');
    expect(getJSON(KEYS.leaderboardActiveProof)).toMatchObject({ id: frozen.id, frozenScore: null, continued: true });
    recoverRewardedBenefits();
    expect(getJSON(KEYS.rewardedBenefits)).toEqual({});
    const proof = useLeaderboardStore.getState().activeProof!;
    useLeaderboardStore.getState().recordMove({ trayIndex: 0, row: 0, col: 0 });
    expect(useLeaderboardStore.getState().activeProof?.moves).toHaveLength(proof.moves.length + 1);
    const finished = useLeaderboardStore.getState().finishActiveRun(101);
    expect(useLeaderboardStore.getState().activeProof?.frozenScore).toBe(101);
    await finished;
    expect(showRewarded).toHaveBeenCalledTimes(1);
  });

  it('does not reopen an unrelated proof or erase earned proof while repairing an already revived run', async () => {
    const offer = terminal();
    const showRewarded = jest.fn(async (_placement, earn) => rewarded(earn));
    await claimRewardedBenefit(offer, { showRewarded });
    const matching = useLeaderboardStore.getState().activeProof!;
    const unrelated = { ...matching, id: 'another-proof', frozenScore: 123 };
    useLeaderboardStore.setState({ activeProof: unrelated });
    setJSONOrThrow(KEYS.leaderboardActiveProof, unrelated);
    setJSONOrThrow(KEYS.rewardedBenefits, {
      repair: { sessionId: 'repair', offer, createdAt: 1, state: 'earned_pending' },
    });
    recoverRewardedBenefits();
    expect(useLeaderboardStore.getState().activeProof).toEqual(unrelated);
    expect(useGameStore.getState().loadSaved()).toBeNull();
    expect(getJSON(KEYS.leaderboardActiveProof)).toEqual(unrelated);
    expect(getJSON(KEYS.rewardedBenefits)).toMatchObject({ repair: { state: 'earned_pending' } });
    useLeaderboardStore.setState({ activeProof: { ...matching, frozenScore: 100 } });
    recoverRewardedBenefits();
    expect(getJSON(KEYS.leaderboardActiveProof)).toMatchObject({ id: matching.id, frozenScore: null });
    expect(getJSON(KEYS.rewardedBenefits)).toEqual({});
  });

  it('retries failed Classic checkpoint persistence without changing memory early or showing a second ad', async () => {
    const offer = terminal();
    const original = storage.set.bind(storage);
    const write = jest.spyOn(storage, 'set').mockImplementation((key, value) => {
      if (key === KEYS.classicRunEnvelope) throw new Error('disk');
      original(key, value);
    });
    const showRewarded = jest.fn(async (_placement, earn) => rewarded(earn));
    await expect(claimRewardedBenefit(offer, { showRewarded })).resolves.toBe('pending');
    expect(useGameStore.getState().game.reviveUsed).toBe(false);
    write.mockRestore();
    await expect(claimRewardedBenefit(offer, { showRewarded })).resolves.toBe('applied');
    expect(useGameStore.getState().game.reviveUsed).toBe(true);
    expect(showRewarded).toHaveBeenCalledTimes(1);
  });
});
