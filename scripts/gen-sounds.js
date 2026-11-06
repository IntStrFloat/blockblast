/** Original procedural SFX: damped wood modes + felt-like pentatonic resonances.
 * Rebuild: node scripts/gen-sounds.js. No downloaded samples or runtime synthesis.
 * PCM16 mono 44.1kHz; baked dynamics, 40ms end fade and 12ms silent guard.
 */
const fs = require('fs');
const path = require('path');
const SR = 44100;
const OUT = path.join(__dirname, '..', 'assets/sounds');
const bank = {};
function rng(seed) {
  let x = seed | 0;
  return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 4294967296; };
}
function layer(buf, at, duration, fn) {
  const start = Math.round(at * SR), n = Math.round(duration * SR);
  for (let i = 0; i < n && start + i < buf.length; i++) buf[start + i] += fn(i / SR, i, n);
}
function wood(buf, at, freq, amp, seed, softness = 1) {
  const random = rng(seed); let noise = 0;
  const phases = [0, 0.31, 0.7, 1.2];
  const modes = [1, 2.71, 4.13, 5.39];
  layer(buf, at, 0.28, (t) => {
    const attack = 1 - Math.exp(-t / 0.0018);
    let value = 0;
    for (let m = 0; m < modes.length; m++) {
      value += Math.sin(2 * Math.PI * freq * modes[m] * t + phases[m]) *
        Math.exp(-t / ((0.032 * softness) / (1 + m * 0.65))) / (1 + m * 2.7);
    }
    noise += 0.22 * ((random() * 2 - 1) - noise);
    return amp * attack * (value + noise * 0.20 * Math.exp(-t / 0.009));
  });
}
function note(buf, at, freq, amp, decay = 0.16) {
  layer(buf, at, decay * 7 + 0.04, (t) => {
    const attack = 1 - Math.exp(-t / 0.004);
    return amp * attack * (Math.sin(2 * Math.PI * freq * t) * Math.exp(-t / decay) +
      0.19 * Math.sin(2 * Math.PI * freq * 2.003 * t) * Math.exp(-t / (decay * 0.55)) +
      0.055 * Math.sin(2 * Math.PI * freq * 3.97 * t) * Math.exp(-t / (decay * 0.28)));
  });
}
function dust(buf, at, amp, seed) {
  const random = rng(seed); let low = 0, slow = 0;
  layer(buf, at, 0.25, t => {
    low += 0.16 * ((random() * 2 - 1) - low);
    slow += 0.035 * (low - slow);
    return (low - slow) * amp * (1 - Math.exp(-t / 0.009)) * Math.exp(-t / 0.047);
  });
}
function save(cue, variant, duration, peak, compose) {
  const buf = new Float64Array(Math.ceil(duration * SR));
  compose(buf, variant);
  // Two-pole gentle lowpass tames transients; no brick-wall limiter or harsh clipping.
  let p = 0, q = 0, max = 0;
  const k = 1 - Math.exp(-2 * Math.PI * 4100 / SR);
  for (let i = 0; i < buf.length; i++) {
    p += k * (buf[i] - p); q += k * (p - q);
    const tail = Math.min(1, Math.max(0, (duration - 0.012 - i / SR) / 0.04));
    buf[i] = q * (0.5 - 0.5 * Math.cos(Math.PI * tail));
    max = Math.max(max, Math.abs(buf[i]));
  }
  const wav = Buffer.alloc(44 + buf.length * 2);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(SR, 24); wav.writeUInt32LE(SR * 2, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36);
  wav.writeUInt32LE(buf.length * 2, 40);
  for (let i = 0; i < buf.length; i++) wav.writeInt16LE(Math.round(buf[i] / (max || 1) * peak * 32767), 44 + i * 2);
  const name = cue + (variant ? `_${variant + 1}` : '');
  fs.writeFileSync(path.join(OUT, `${name}.wav`), wav);
  (bank[cue] ??= []).push({ name, durationMs: Math.ceil(duration * 1000) });
}
function variants(cue, count, duration, peak, compose) {
  for (let v = 0; v < count; v++) save(cue, v, duration, peak, compose);
}
function melody(cue, notes, peak = 0.24) {
  variants(cue, 1, notes.length * 0.075 + 1.05, peak, b => {
    notes.forEach((f, i) => note(b, i * 0.075, f, 0.7, 0.15));
    wood(b, 0, 230, 0.12, 11, 1.2);
  });
}
fs.mkdirSync(OUT, { recursive: true });
variants('pickup', 3, 0.22, 0.15, (b, v) => wood(b, 0, [420, 450, 395][v], 1, 50 + v, 0.8));
variants('drop', 4, 0.34, 0.23, (b, v) => {
  wood(b, 0, [255, 270, 240, 260][v], 1, 70 + v, 1.35);
  wood(b, 0.013 + v * 0.001, 520, 0.13, 81 + v);
});
variants('return', 3, 0.29, 0.12, (b, v) => wood(b, 0, [210, 225, 200][v], 1, 90 + v, 1.2));
for (let tier = 1; tier <= 3; tier++) {
  variants(`clear${tier}`, 2, 1.02 + tier * 0.09, 0.23 + tier * 0.015, (b, v) => {
    wood(b, 0, 245 + v * 10, 0.7, 101 + v, 1.4);
    dust(b, 0.035, 0.75, 120 + v);
    const notes = tier === 1 ? [392, 523.25] : tier === 2 ? [392, 523.25, 659.25] : [392, 523.25, 659.25, 783.99];
    notes.forEach((f, i) => note(b, 0.018 + i * 0.065 + v * 0.002, f, 0.44 / (1 + i * 0.12), 0.14));
    for (let i = 0; i < 5; i++) wood(b, 0.045 + i * 0.032, 600 - i * 53, 0.055, 130 + i + v, 0.5);
  });
}
variants('jewel', 2, 0.85, 0.12, (b, v) => {
  note(b, 0.09, 659.25, 0.6, 0.11); note(b, 0.15, 783.99, 0.4, 0.10);
  wood(b, 0.08, 640 + v * 22, 0.1, 16 + v, 0.6);
});
variants('stonehit', 2, 0.32, 0.16, (b, v) => {
  wood(b, 0.025, 160 + v * 9, 1, 20 + v, 1.4); dust(b, 0.025, 0.4, 8 + v);
});
variants('stonebreak', 2, 0.47, 0.18, (b, v) => {
  [0.02, 0.06, 0.11].forEach((at, i) => wood(b, at, 185 + i * 75 + v * 6, 0.7 / (i + 1), 25 + i + v, 1.1));
  dust(b, 0.03, 0.65, 37 + v);
});
melody('boardclear', [261.63, 392, 523.25, 659.25, 783.99], 0.28);
melody('record', [392, 523.25, 659.25, 783.99], 0.25);
melody('victory', [329.63, 392, 523.25, 659.25, 783.99], 0.26);
melody('gameover', [392, 329.63, 261.63], 0.16);
melody('levelup', [329.63, 523.25, 659.25], 0.23);
melody('lost', [329.63, 261.63], 0.13);
variants('feed', 2, 0.43, 0.16, (b, v) => {
  wood(b, 0, 270 + v * 12, 0.7, 40 + v, 1.4); wood(b, 0.08, 350 + v * 9, 0.5, 45 + v, 1.2);
});
melody('hint', [523.25, 659.25], 0.13);
variants('swap', 1, 0.53, 0.14, b => {
  wood(b, 0, 300, 0.5, 46); wood(b, 0.055, 400, 0.7, 47); dust(b, 0, 0.4, 48);
});
fs.writeFileSync(path.join(OUT, 'sound-bank.json'), JSON.stringify(bank, null, 2) + '\n');
console.log(`${Object.keys(bank).length} cues / ${Object.values(bank).flat().length} WAVs`);
