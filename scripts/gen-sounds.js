/**
 * Синтез игровых звуков в WAV (44.1кГц, 16бит, моно).
 * Запуск: node scripts/gen-sounds.js  → assets/sounds/*.wav
 * Все сэмплы ≤400мс. Тон — мягкие синусы с лёгкой 2-й гармоникой и ADSR-огибающей.
 */
const fs = require('fs');
const path = require('path');

const SR = 44100;
const OUT = path.join(__dirname, '..', 'assets', 'sounds');

function synth(notes, { wave = 'sine', gain = 0.5, harmonics = 0.18 } = {}) {
  const total = notes.reduce((acc, n) => Math.max(acc, n.start + n.dur), 0);
  const buf = new Float32Array(Math.ceil(total * SR));
  for (const n of notes) {
    const s0 = Math.round(n.start * SR);
    const len = Math.round(n.dur * SR);
    const attack = Math.min(0.006 * SR, len * 0.2);
    for (let i = 0; i < len; i++) {
      const t = i / SR;
      // линейный свип частоты, если задан n.freqEnd
      const f = n.freqEnd ? n.freq + (n.freqEnd - n.freq) * (i / len) : n.freq;
      const phase = 2 * Math.PI * f * t;
      let v =
        wave === 'triangle'
          ? (2 / Math.PI) * Math.asin(Math.sin(phase))
          : Math.sin(phase);
      v += harmonics * Math.sin(2 * phase);
      // ADSR: быстрый атак + экспоненциальный спад
      const env =
        i < attack ? i / attack : Math.exp(-(i - attack) / (len * (n.decay ?? 0.32)));
      buf[s0 + i] += v * env * (n.vol ?? 1);
    }
  }
  // нормализация с запасом
  let peak = 0;
  for (const v of buf) peak = Math.max(peak, Math.abs(v));
  const norm = peak > 0 ? gain / peak : 0;
  return Float32Array.from(buf, (v) => v * norm);
}

function writeWav(name, samples) {
  const dataLen = samples.length * 2;
  const buf = Buffer.alloc(44 + dataLen);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataLen, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataLen, 40);
  for (let i = 0; i < samples.length; i++) {
    buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767))), 44 + i * 2);
  }
  fs.writeFileSync(path.join(OUT, `${name}.wav`), buf);
  console.log(`${name}.wav  ${(buf.length / 1024).toFixed(1)} KB  ${(samples.length / SR * 1000).toFixed(0)}ms`);
}

fs.mkdirSync(OUT, { recursive: true });

// Захват: короткий «поп» вверх
writeWav('pickup', synth([{ start: 0, freq: 660, freqEnd: 990, dur: 0.05, decay: 0.5 }], { gain: 0.35 }));

// Дроп: мягкий тук
writeWav('drop', synth([
  { start: 0, freq: 240, freqEnd: 180, dur: 0.07, decay: 0.4 },
  { start: 0, freq: 480, dur: 0.03, vol: 0.4 },
], { gain: 0.4 }));

// Очистки: нарастающие мажорные арпеджио (C5-E5-G5 → E5-G5-C6 → G5-C6-E6)
const arp = (f1, f2, f3, extra) =>
  synth(
    [
      { start: 0, freq: f1, dur: 0.12 },
      { start: 0.055, freq: f2, dur: 0.12 },
      { start: 0.11, freq: f3, dur: 0.2, decay: 0.45 },
      ...(extra ? [{ start: 0.165, freq: extra, dur: 0.2, decay: 0.5, vol: 0.8 }] : []),
    ],
    { gain: 0.45 },
  );
writeWav('clear1', arp(523.25, 659.25, 783.99));
writeWav('clear2', arp(659.25, 783.99, 1046.5));
writeWav('clear3', arp(783.99, 1046.5, 1318.5, 1568));

// Game over: нисходящий, мягкий triangle
writeWav('gameover', synth([
  { start: 0, freq: 392, dur: 0.13 },
  { start: 0.12, freq: 329.6, dur: 0.13 },
  { start: 0.24, freq: 261.6, dur: 0.16, decay: 0.5 },
], { wave: 'triangle', gain: 0.4, harmonics: 0.08 }));

// Новый рекорд: фанфара
writeWav('record', synth([
  { start: 0, freq: 523.25, dur: 0.09 },
  { start: 0.08, freq: 659.25, dur: 0.09 },
  { start: 0.16, freq: 783.99, dur: 0.09 },
  { start: 0.24, freq: 1046.5, dur: 0.16, decay: 0.5 },
], { gain: 0.5 }));

console.log('done');
