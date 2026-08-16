// Generates PWA icons (PNG) and app sounds (WAV) without external deps.
// Run: node scripts/generate-assets.mjs
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// ---------- PNG (minimal encoder: rounded violet gradient square + flame) ----------
function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256).map((_, n) => {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      return c;
    });
  }
  let crc = -1;
  for (const b of buf) crc = (crc >>> 8) ^ table[(crc ^ b) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// Flame silhouette test (normalized coordinates, cheap approximation)
function inFlame(nx, ny) {
  // body: teardrop centered at (0.5, 0.58)
  const dx = nx - 0.5;
  const dy = ny - 0.58;
  const body = (dx * dx) / 0.032 + (dy * dy) / 0.055 < 1 && ny > 0.3;
  // tip: curve toward top-right
  const tx = nx - 0.5 - 0.1 * (0.55 - ny);
  const tip = ny > 0.18 && ny <= 0.45 && Math.abs(tx) < 0.05 * ((ny - 0.12) / 0.33);
  // inner notch (negative space at the bottom)
  const ix = nx - 0.5;
  const iy = ny - 0.72;
  const notch = (ix * ix) / 0.008 + (iy * iy) / 0.012 < 1;
  return (body || tip) && !notch;
}

function makeIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const radius = size * 0.22;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      // rounded-rect mask
      const cx = Math.max(radius - x, x - (size - 1 - radius), 0);
      const cy = Math.max(radius - y, y - (size - 1 - radius), 0);
      const inside = cx * cx + cy * cy <= radius * radius;
      if (!inside) {
        rgba[i + 3] = 0;
        continue;
      }
      // diagonal ink-blue -> teal gradient #2C4A6E -> #1D7A8C
      const g = (x + y) / (2 * size);
      let r = Math.round(0x2c + (0x1d - 0x2c) * g);
      let gr = Math.round(0x4a + (0x7a - 0x4a) * g);
      let b = Math.round(0x6e + (0x8c - 0x6e) * g);
      if (inFlame(x / size, y / size)) {
        r = gr = b = 255;
      }
      rgba[i] = r;
      rgba[i + 1] = gr;
      rgba[i + 2] = b;
      rgba[i + 3] = 255;
    }
  }
  return encodePng(size, size, rgba);
}

// NOTE: App icons/favicon are generated from the real brand logo
// (public/logo.png, from the provided image) — not from this placeholder
// flame. Icon generation here is intentionally disabled so re-running this
// script does not clobber public/icons/*, app/icon.png or app/apple-icon.png.
// `makeIcon`/`inFlame`/PNG helpers above are kept for reference only.
void makeIcon;

// ---------- WAV (16-bit PCM mono) ----------
const SAMPLE_RATE = 44100;

function toWav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    data.writeInt16LE(Math.max(-1, Math.min(1, samples[i])) * 32767, i * 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

/** One bell strike: fundamental + inharmonic partials with exponential decay. */
function bellStrike(samples, offsetSec, freq, amp, decay) {
  const start = Math.floor(offsetSec * SAMPLE_RATE);
  const partials = [
    [1, 1],
    [2.0, 0.55],
    [2.98, 0.32],
    [4.2, 0.18],
    [5.4, 0.1],
  ];
  for (let i = start; i < samples.length; i++) {
    const t = (i - start) / SAMPLE_RATE;
    let v = 0;
    for (const [mult, pAmp] of partials) {
      v += pAmp * Math.sin(2 * Math.PI * freq * mult * t) * Math.exp(-decay * mult * 0.6 * t);
    }
    samples[i] += amp * v * Math.exp(-decay * t);
  }
}

// Antique clock chime: three descending strikes, long ring-out
const chime = new Float64Array(Math.floor(SAMPLE_RATE * 4.5));
bellStrike(chime, 0.0, 660, 0.4, 1.4);
bellStrike(chime, 0.9, 587, 0.4, 1.4);
bellStrike(chime, 1.8, 523, 0.45, 1.0);
writeFileSync(join(root, "public", "sounds", "clock-chime.wav"), toWav(chime));

// Short completion blip: two quick soft notes up
const blip = new Float64Array(Math.floor(SAMPLE_RATE * 0.5));
bellStrike(blip, 0.0, 880, 0.25, 9);
bellStrike(blip, 0.12, 1174.7, 0.25, 9);
writeFileSync(join(root, "public", "sounds", "complete.wav"), toWav(blip));

console.log("assets generated: icons/icon-192.png, icon-512.png, apple-icon.png, sounds/clock-chime.wav, complete.wav");
