import { KEYS, getJSON } from '@/core/storage';

import { useSettings } from '../store';

describe('useSettings', () => {
  it('дефолты разумные', () => {
    const s = useSettings.getState();
    expect(s.sound).toBe(true);
    expect(s.haptics).toBe(true);
    expect(s.praiseTone).toBe('classic');
    expect(s.lang).toBe('ru');
  });

  it('update меняет и персистит', () => {
    useSettings.getState().update({ praiseTone: 'meme', sound: false });
    expect(useSettings.getState().praiseTone).toBe('meme');
    const persisted = getJSON<{ praiseTone: string; sound: boolean }>(KEYS.settings);
    expect(persisted?.praiseTone).toBe('meme');
    expect(persisted?.sound).toBe(false);
  });
});
