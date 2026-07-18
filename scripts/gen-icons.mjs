// Erzeugt PWA-Icons als echte PNGs – ohne externe Abhängigkeiten (nur node:zlib).
// Motiv: dunkler Hintergrund, grüne Scheibe, weißes €-Zeichen.
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "public", "icons");
mkdirSync(OUT, { recursive: true });

// --- Farben ---
const BG = [10, 10, 10, 255]; // #0a0a0a
const GREEN = [22, 163, 74, 255]; // #16a34a
const WHITE = [255, 255, 255, 255];
const TRANSPARENT = [0, 0, 0, 0];

function makeImage(size, { maskable }) {
  const buf = new Uint8Array(size * size * 4);
  const set = (x, y, c) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    buf[i] = c[0];
    buf[i + 1] = c[1];
    buf[i + 2] = c[2];
    buf[i + 3] = c[3];
  };

  const radius = size * 0.18; // Eckenradius für "any"
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (maskable) {
        set(x, y, BG); // vollflächig, kein abgerundeter Rand (Safe-Zone)
      } else {
        // abgerundetes Quadrat: Ecken transparent
        const inCorner =
          (x < radius && y < radius && dist(x, y, radius, radius) > radius) ||
          (x > size - radius && y < radius && dist(x, y, size - radius, radius) > radius) ||
          (x < radius && y > size - radius && dist(x, y, radius, size - radius) > radius) ||
          (x > size - radius && y > size - radius && dist(x, y, size - radius, size - radius) > radius);
        set(x, y, inCorner ? TRANSPARENT : BG);
      }
    }
  }

  const cx = size / 2;
  const cy = size / 2;
  const scale = maskable ? 0.8 : 1; // maskable: Emblem in Safe-Zone verkleinern
  const disc = size * 0.34 * scale;

  // grüne Scheibe
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (dist(x, y, cx, cy) <= disc) set(x, y, GREEN);
    }
  }

  // weißes €-Zeichen: Ring (C) + zwei horizontale Balken
  const outer = size * 0.2 * scale;
  const inner = size * 0.12 * scale;
  const barH = size * 0.042 * scale;
  const barY1 = cy - size * 0.05 * scale;
  const barY2 = cy + size * 0.05 * scale;
  const barX0 = cx - size * 0.24 * scale;
  const barX1 = cx + size * 0.03 * scale;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = dist(x, y, cx, cy);
      // Ring, rechts offen (C-Form)
      if (d <= outer && d >= inner) {
        const ang = (Math.atan2(y - cy, x - cx) * 180) / Math.PI;
        if (Math.abs(ang) > 45) set(x, y, WHITE);
      }
      // zwei Querbalken
      if (x >= barX0 && x <= barX1) {
        if (Math.abs(y - barY1) <= barH / 2) set(x, y, WHITE);
        if (Math.abs(y - barY2) <= barH / 2) set(x, y, WHITE);
      }
    }
  }

  return buf;
}

function dist(x, y, cx, cy) {
  const dx = x - cx;
  const dy = y - cy;
  return Math.sqrt(dx * dx + dy * dy);
}

// --- PNG-Encoder ---
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
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodePng(rgba, size) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // Rohdaten mit Filter-Byte 0 pro Zeile
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size * 4; x++) {
      raw[y * (size * 4 + 1) + 1 + x] = rgba[y * size * 4 + x];
    }
  }
  const idat = deflateSync(raw, { level: 9 });

  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function schreibe(name, size, opts) {
  const rgba = makeImage(size, opts);
  const png = encodePng(rgba, size);
  writeFileSync(join(OUT, name), png);
  console.log("erzeugt:", name, `${size}x${size}`);
}

schreibe("icon-192.png", 192, { maskable: false });
schreibe("icon-512.png", 512, { maskable: false });
schreibe("icon-maskable-192.png", 192, { maskable: true });
schreibe("icon-maskable-512.png", 512, { maskable: true });
schreibe("apple-touch-icon.png", 180, { maskable: true });
schreibe("favicon.png", 64, { maskable: false });
console.log("Alle Icons erzeugt.");
