/** mulberry32: детерминированный PRNG, состояние — одно 32-битное число. */

export interface RngResult {
  value: number;
  state: number;
}

export function rngNext(state: number): RngResult {
  const a = (state + 0x6d2b79f5) | 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, state: a };
}

export function rngInt(state: number, maxExclusive: number): RngResult {
  const r = rngNext(state);
  return { value: Math.floor(r.value * maxExclusive), state: r.state };
}

export function seedFromTime(): number {
  return (Date.now() ^ (Math.random() * 0xffffffff)) | 0;
}
