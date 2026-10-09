import { KEYS, getJSON } from '@/core/storage';

import { useProgression } from '../store';

describe('progression reveal (координатор-owned, спека 15 §4)', () => {
  beforeEach(() => useProgression.setState({ reveal: null, revealQueue: [] }));

  it('queues a reveal until the owning result screen presents it', () => {
    useProgression.getState().enqueueReveal({
      id: 'run-1:3', runId: 'run-1', level: 3, rewards: [{ kind: 'cosmetic', id: 'x' }],
    });
    expect(useProgression.getState().reveal).toBeNull();
    useProgression.getState().presentRevealForRun('run-1');
    expect(useProgression.getState().reveal).toEqual({
      id: 'run-1:3',
      runId: 'run-1',
      level: 3,
      rewards: [{ kind: 'cosmetic', id: 'x' }],
    });

    useProgression.getState().clearReveal();
    expect(useProgression.getState().reveal).toBeNull();
  });

  it('reveal не персистится в MMKV', () => {
    useProgression.getState().addPoints(100);
    useProgression.getState().enqueueReveal({ id: 'run-2:2', runId: 'run-2', level: 2, rewards: [] });
    useProgression.getState().presentRevealForRun('run-2');

    const saved = getJSON<{ reveal?: unknown }>(KEYS.progression);
    expect(saved).not.toBeNull();
    expect(saved!.reveal).toBeUndefined();
  });

  it('drops stale presentation when a new run starts without touching reward receipts', () => {
    useProgression.getState().enqueueReveal({ id: 'old:2', runId: 'old', level: 2, rewards: [] });
    useProgression.getState().presentRevealForRun('old');
    useProgression.getState().discardRevealsForRun();
    expect(useProgression.getState().reveal).toBeNull();
    expect(useProgression.getState().revealQueue).toEqual([]);
  });
});
