export type NicknameValidationError = 'too_short' | 'too_long' | 'invalid_chars';

export interface GeneratedProfile {
  nickname: string;
  normalizedNickname: string;
  tag: string;
  seed: number;
}

const ADJECTIVES = ['Neon', 'Pixel', 'Lime', 'Solar', 'Echo', 'Prism'] as const;
const NOUNS = ['Nova', 'Orbit', 'Comet', 'Rift', 'Tiger', 'Pulse'] as const;
const INVISIBLE_OR_CONTROL = /[\u0000-\u001F\u007F-\u009F\u200B-\u200D\u2060\uFEFF]/g;
const MULTISPACE = /\s+/g;
const SAFE_NICKNAME = /^[A-Za-z0-9 ]+$/;

export function normalizeNickname(input: string): string {
  return input
    .normalize('NFKC')
    .replace(INVISIBLE_OR_CONTROL, '')
    .replace(MULTISPACE, ' ')
    .trim();
}

export function validateNickname(
  input: string,
):
  | { ok: true; nickname: string; normalizedNickname: string }
  | { ok: false; error: NicknameValidationError } {
  const nickname = normalizeNickname(input);
  if (nickname.length < 3) return { ok: false, error: 'too_short' };
  if (nickname.length > 16) return { ok: false, error: 'too_long' };
  if (!SAFE_NICKNAME.test(nickname)) return { ok: false, error: 'invalid_chars' };
  return {
    ok: true,
    nickname,
    normalizedNickname: nickname.toLowerCase(),
  };
}

export function createGeneratedProfile(seed: number): GeneratedProfile {
  const mixed = Math.imul(seed + 1, 2654435761) >>> 0;
  const adjective = ADJECTIVES[mixed % ADJECTIVES.length];
  const noun = NOUNS[((mixed >>> 3) ^ seed) % NOUNS.length];
  const nickname = `${adjective}${noun}`;
  return {
    nickname,
    normalizedNickname: nickname.toLowerCase(),
    tag: toTag(seed),
    seed,
  };
}

function toTag(seed: number): string {
  return (seed + 10).toString(36).toUpperCase().padStart(3, '0').slice(-3);
}
