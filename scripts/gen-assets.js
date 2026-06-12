/**
 * Генерация иконки/adaptive-icon/splash без внешних зависимостей:
 * минимальный PNG-энкодер (zlib + CRC32) + рисование скруглённых блоков.
 * Запуск: node scripts/gen-assets.js → assets/images/*.png
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'assets', 'images');

// ---------- PNG ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4);
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type), data])), 8 + data.length);
  return out;
}

function encodePNG(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- Рисование ----------
function hex(c) {
  return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
}

class Canvas {
  constructor(w, h, bg /* '#rrggbb' | null = прозрачный */) {
    this.w = w;
    this.h = h;
    this.px = Buffer.alloc(w * h * 4);
    if (bg) {
      const [r, g, b] = hex(bg);
      for (let i = 0; i < w * h; i++) {
        this.px[i * 4] = r;
        this.px[i * 4 + 1] = g;
        this.px[i * 4 + 2] = b;
        this.px[i * 4 + 3] = 255;
      }
    }
  }

  set(x, y, r, g, b, a = 255) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.px[i] = r;
    this.px[i + 1] = g;
    this.px[i + 2] = b;
    this.px[i + 3] = a;
  }

  /** Скруглённый блок с «глянцем» (верх светлее, низ темнее) */
  block(x0, y0, size, radius, color) {
    const [r, g, b] = hex(color);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        // скругление углов
        const cx = x < radius ? radius - x : x >= size - radius ? x - (size - 1 - radius) : 0;
        const cy = y < radius ? radius - y : y >= size - radius ? y - (size - 1 - radius) : 0;
        if (cx * cx + cy * cy > radius * radius) continue;
        // глянец
        let mul = 1;
        if (y < size * 0.3) mul = 1.25;
        else if (y > size * 0.84) mul = 0.78;
        this.set(
          x0 + x,
          y0 + y,
          Math.min(255, Math.round(r * mul)),
          Math.min(255, Math.round(g * mul)),
          Math.min(255, Math.round(b * mul)),
        );
      }
    }
  }

  save(name) {
    fs.writeFileSync(path.join(OUT, name), encodePNG(this.w, this.h, this.px));
    console.log(`${name}  ${this.w}x${this.h}`);
  }
}

/** Сетка 2×2 блоков по центру холста */
function drawLogo(canvas, contentSize, colors) {
  const gap = Math.round(contentSize * 0.08);
  const block = Math.round((contentSize - gap) / 2);
  const radius = Math.round(block * 0.18);
  const x0 = Math.round((canvas.w - contentSize) / 2);
  const y0 = Math.round((canvas.h - contentSize) / 2);
  const pos = [
    [x0, y0],
    [x0 + block + gap, y0],
    [x0, y0 + block + gap],
    [x0 + block + gap, y0 + block + gap],
  ];
  pos.forEach(([x, y], i) => canvas.block(x, y, block, radius, colors[i % colors.length]));
}

const BG = '#0F1B33';
const PALETTE = ['#FF4D6D', '#FFD23F', '#3DDC84', '#3FA7FF'];

fs.mkdirSync(OUT, { recursive: true });

// Основная иконка (квадрат, без прозрачности)
{
  const c = new Canvas(1024, 1024, BG);
  drawLogo(c, 600, PALETTE);
  c.save('icon.png');
}
// Adaptive foreground (прозрачный фон, контент в safe-zone ~60%)
{
  const c = new Canvas(1024, 1024, null);
  drawLogo(c, 520, PALETTE);
  c.save('android-icon-foreground.png');
}
// Adaptive background (сплошной тёмный)
{
  const c = new Canvas(1024, 1024, BG);
  c.save('android-icon-background.png');
}
// Monochrome (белые блоки на прозрачном)
{
  const c = new Canvas(1024, 1024, null);
  drawLogo(c, 520, ['#FFFFFF', '#FFFFFF', '#FFFFFF', '#FFFFFF']);
  c.save('android-icon-monochrome.png');
}
// Splash-иконка (прозрачный фон)
{
  const c = new Canvas(512, 512, null);
  drawLogo(c, 360, PALETTE);
  c.save('splash-icon.png');
}
// Favicon
{
  const c = new Canvas(48, 48, BG);
  drawLogo(c, 36, PALETTE);
  c.save('favicon.png');
}

console.log('done');
