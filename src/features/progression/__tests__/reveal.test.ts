import { KEYS, getJSON } from '@/core/storage';

import { useProgression } from '../store';

describe('progression reveal (координатор-owned, спека 15 §4)', () => {
  it('setReveal/clearReveal управляют transient-полем reveal', () => {
    useProgression.getState().setReveal({ level: 3, rewards: [{ kind: 'cosmetic', id: 'x' }] });
    expect(useProgression.getState().reveal).toEqual({
      level: 3,
      rewards: [{ kind: 'cosmetic', id: 'x' }],
    });

    useProgression.getState().clearReveal();
    expect(useProgression.getState().reveal).toBeNull();
  });

  it('reveal не персистится в MMKV', () => {
    useProgression.getState().addPoints(100);
    useProgression.getState().setReveal({ level: 2, rewards: [] });

    const saved = getJSON<{ reveal?: unknown }>(KEYS.progression);
    expect(saved).not.toBeNull();
    expect(saved!.reveal).toBeUndefined();
  });
});
