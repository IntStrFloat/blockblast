import { bannerLoadErrorMessage } from '../bannerLoadError';

describe('banner load diagnostics', () => {
  it('reads the Android native error envelope and retains the SDK code', () => {
    expect(bannerLoadErrorMessage({ error: { code: 1, description: 'Network error' } }))
      .toBe('1: Network error');
  });
  it('accepts direct iOS errors', () => {
    expect(bannerLoadErrorMessage({ description: 'No fill', code: '2' })).toBe('2: No fill');
    expect(bannerLoadErrorMessage({ description: 'Unavailable' })).toBe('Unavailable');
  });
  it.each([undefined, null, '', {}, { error: null }, { description: 42 }])(
    'does not crash on an unexpected payload: %p', (payload) => {
      expect(bannerLoadErrorMessage(payload)).toBeUndefined();
    },
  );
});
