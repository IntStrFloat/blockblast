import {
  createGeneratedProfile,
  normalizeNickname,
  validateNickname,
} from '../nickname';

describe('profile nickname helpers', () => {
  it('creates a deterministic safe generated profile', () => {
    expect(createGeneratedProfile(7)).toEqual(createGeneratedProfile(7));
    expect(createGeneratedProfile(7).nickname).toMatch(/^[A-Za-z0-9]+$/);
    expect(createGeneratedProfile(7).tag).toBe('00H');
  });

  it('rerolling a neighboring seed changes nickname but keeps it safe', () => {
    const first = createGeneratedProfile(7);
    const second = createGeneratedProfile(8);
    expect(second.nickname).not.toBe(first.nickname);
    expect(second.tag).toBe('00I');
  });

  it('normalizes whitespace and strips invisible characters', () => {
    expect(normalizeNickname('  Pixel\u200B   Hero  ')).toBe('Pixel Hero');
  });

  it('accepts a normalized custom nickname in the allowed range', () => {
    expect(validateNickname('  Pixel   Hero  ')).toEqual({
      ok: true,
      nickname: 'Pixel Hero',
      normalizedNickname: 'pixel hero',
    });
  });

  it('rejects too-short names after normalization', () => {
    expect(validateNickname('  a  ')).toEqual({
      ok: false,
      error: 'too_short',
    });
  });

  it('rejects disallowed characters for local-safe nicknames', () => {
    expect(validateNickname('Neo://Fox')).toEqual({
      ok: false,
      error: 'invalid_chars',
    });
  });
});
