import { KEYS, getJSON } from '@/core/storage';

import { useSettings } from '../store';

describe('useSettings', () => {
  it('дефолты разумные', () => {
    const s = useSettings.getState();
    expect(s.sound).toBe(true);
    expect(s.haptics).toBe(true);
    expect(s.praiseTone).toBe('classic');
    expect(s.lang).toBe('system');
  });

  it('update меняет и персистит', () => {
    useSettings.getState().update({ praiseTone: 'meme', sound: false });
    expect(useSettings.getState().praiseTone).toBe('meme');
    const persisted = getJSON<{ praiseTone: string; sound: boolean }>(KEYS.settings);
    expect(persisted?.praiseTone).toBe('meme');
    expect(persisted?.sound).toBe(false);
  });

  it('showMascot по умолчанию true', () => {
    expect(useSettings.getState().showMascot).toBe(true);
  });

  it('update showMascot меняет стор и персистит', () => {
    useSettings.getState().update({ showMascot: false });
    expect(useSettings.getState().showMascot).toBe(false);
    const persisted = getJSON<{ showMascot: boolean }>(KEYS.settings);
    expect(persisted?.showMascot).toBe(false);
  });
});
