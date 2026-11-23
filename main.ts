// "The World Today" — one-page newspaper front page summing up the world news
// of Monday 23 November 2026. Node 22, standard library only, no network.
// A hand-built 5x7 bitmap font draws the text, flat pictograms illustrate
// each story, and a hand-rolled encoder writes a 1024x1024 PNG to
// $MAKEFUN_OUTPUT_DIR/entry.png (default /output). Deterministic: two runs
// produce identical bytes.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

// ---------------------------------------------------------------------------
// 5x7 bitmap font. Uppercase letters, digits and punctuation; every glyph is
// seven rows of five bits, '1' = ink, '0' = paper.
// ---------------------------------------------------------------------------
const GLYPHS = {
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
  '3': ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  ',': ['00000', '00000', '00000', '00000', '01100', '00100', '01000'],
  ':': ['00000', '01100', '01100', '00000', '01100', '01100', '00000'],
  '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
  '?': ['01110', '10001', '00001', '00110', '00100', '00000', '00100'],
  "'": ['00100', '00100', '01000', '00000', '00000', '00000', '00000'],
  '"': ['01010', '01010', '00000', '00000', '00000', '00000', '00000'],
  '-': ['00000', '00000', '00000', '01110', '00000', '00000', '00000'],
  '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
  '(': ['00010', '00100', '01000', '01000', '01000', '00100', '00010'],
  ')': ['01000', '00100', '00010', '00010', '00010', '00100', '01000'],
  '&': ['01100', '10010', '10100', '01000', '10101', '10010', '01101'],
  '%': ['11001', '11010', '00010', '00100', '01000', '01011', '10011'],
  '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
  '=': ['00000', '00000', '11111', '00000', '11111', '00000', '00000'],
  '*': ['00000', '00100', '10101', '01110', '10101', '00100', '00000'],
  $: ['00100', '01111', '10100', '01110', '00101', '11110', '00100'],
};

// One character cell at scale 1: 5 px glyph + 1 px gap; glyph is 7 px tall.
const CELL_W = 6;
const CELL_H = 7;

// ---------------------------------------------------------------------------
// Minimal PNG writer: 8-bit RGB, no interlace, filter byte 0 per scanline.
// ---------------------------------------------------------------------------
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function pngEncode(width, height, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type 2 = RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 3)] = 0; // filter: none
    rgb.copy(raw, y * (1 + width * 3) + 1, y * width * 3, (y + 1) * width * 3);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Sheet: an RGB pixel buffer with flat-shape drawing helpers.
// ---------------------------------------------------------------------------
const W = 1024;
const H = 1024;

const PAPER = [248, 244, 232]; // warm newsprint
const INK = [22, 22, 22]; // near-black
const RED = [163, 22, 33]; // masthead red
const NAVY = [22, 50, 79]; // deep navy
const TEAL = [14, 116, 110]; // teal accent
const GOLD = [191, 141, 26]; // gold accent
const SKY = [214, 232, 240]; // pale sky panel
const SAND = [238, 228, 203]; // panel sand
const WHITE = [255, 255, 255];
const GREY = [92, 92, 88];
const ORANGE = [224, 108, 24];
const GREEN = [46, 125, 50];
const FLAME = [255, 200, 40];
const SEA = [70, 130, 180];
const NIGHT = [18, 24, 48];

class Sheet {
  constructor() {
    this.buf = Buffer.alloc(W * H * 3);
    this.paint(PAPER);
  }
  paint(rgb) {
    for (let i = 0; i < W * H; i++) {
      this.buf[i * 3] = rgb[0];
      this.buf[i * 3 + 1] = rgb[1];
      this.buf[i * 3 + 2] = rgb[2];
    }
  }
  set(x, y, rgb) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 3;
    this.buf[i] = rgb[0];
    this.buf[i + 1] = rgb[1];
    this.buf[i + 2] = rgb[2];
  }
  box(x, y, w, h, rgb) {
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) this.set(xx, yy, rgb);
    }
  }
  // Hollow rectangle with a border t px thick.
  border(x, y, w, h, rgb, t = 1) {
    this.box(x, y, w, t, rgb);
    this.box(x, y + h - t, w, t, rgb);
    this.box(x, y, t, h, rgb);
    this.box(x + w - t, y, t, h, rgb);
  }
  // Bresenham line, t px thick.
  seg(x0, y0, x1, y1, rgb, t = 1) {
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    let x = x0;
    let y = y0;
    for (;;) {
      for (let a = 0; a < t; a++) for (let b = 0; b < t; b++) this.set(x + a, y + b, rgb);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x += sx; }
      if (e2 <= dx) { err += dx; y += sy; }
    }
  }
  // Filled circle.
  disc(cx, cy, r, rgb) {
    for (let y = -r; y <= r; y++) {
      const half = Math.floor(Math.sqrt(r * r - y * y));
      for (let x = -half; x <= half; x++) this.set(cx + x, cy + y, rgb);
    }
  }
  // Circle outline, 1 px.
  ring(cx, cy, r, rgb) {
    for (let a = 0; a < 360; a += 1) {
      const rad = (a * Math.PI) / 180;
      this.set(Math.round(cx + r * Math.cos(rad)), Math.round(cy + r * Math.sin(rad)), rgb);
    }
  }
  // Filled triangle.
  triangle(x0, y0, x1, y1, x2, y2, rgb) {
    const minX = Math.min(x0, x1, x2);
    const maxX = Math.max(x0, x1, x2);
    const minY = Math.min(y0, y1, y2);
    const maxY = Math.max(y0, y1, y2);
    const d = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0);
    if (d === 0) return;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const s = ((x1 - x0) * (y - y0) - (y1 - y0) * (x - x0)) / d;
        const t = ((x2 - x1) * (y - y1) - (y2 - y1) * (x - x1)) / d;
        if (s >= 0 && t >= 0 && s + t <= 1) this.set(x, y, rgb);
      }
    }
  }
  // One horizontal row of a circle, used for globe latitude lines.
  chord(cx, cy, r, dy, rgb) {
    const half = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)));
    for (let x = -half; x <= half; x++) this.set(cx + x, cy + dy, rgb);
  }
}

// ---------------------------------------------------------------------------
// Text: one glyph, one string, centred text, and word-wrapped paragraphs.
// Everything is upper-cased first (the font is uppercase-only).
// ---------------------------------------------------------------------------
function strWidth(str, scale) {
  return str.length * CELL_W * scale - scale;
}

function putGlyph(sh, ch, x, y, scale, rgb) {
  const g = GLYPHS[ch] || GLYPHS['?'];
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 5; col++) {
      if (g[row][col] === '1') sh.box(x + col * scale, y + row * scale, scale, scale, rgb);
    }
  }
}

function putText(sh, str, x, y, scale, rgb) {
  const s = String(str).toUpperCase();
  for (let i = 0; i < s.length; i++) putGlyph(sh, s[i], x + i * CELL_W * scale, y, scale, rgb);
  return x + strWidth(s, scale);
}

function putCentred(sh, str, cx, y, scale, rgb) {
  const w = strWidth(String(str).toUpperCase(), scale);
  return putText(sh, str, Math.round(cx - w / 2), y, scale, rgb);
}

// Split a string into lines no wider than maxPx at the given scale.
function splitLines(str, maxPx, scale) {
  const words = String(str).toUpperCase().split(' ');
  const lines = [];
  let cur = '';
  for (const word of words) {
    const trial = cur ? cur + ' ' + word : word;
    if (strWidth(trial, scale) <= maxPx) {
      cur = trial;
    } else {
      if (cur) lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

// Draw wrapped text; returns the y just below the last line.
function putPara(sh, str, x, y, maxPx, scale, rgb, gap = 4) {
  const lines = splitLines(str, maxPx, scale);
  const step = CELL_H * scale + gap;
  for (let i = 0; i < lines.length; i++) putText(sh, lines[i], x, y + i * step, scale, rgb);
  return y + lines.length * step;
}

// ---------------------------------------------------------------------------
// Pictograms: small flat scenes, one per story. Each draws inside the box
// (x, y, w, h) given; every coordinate is computed from the box.
// ---------------------------------------------------------------------------

// Lead art: missiles over the Strait of Hormuz at night, tanker below.
function drawGulf(sh, x, y, w, h) {
  sh.box(x, y, w, h, NIGHT); // night sky
  const stars = [[16, 12], [58, 24], [104, 10], [160, 20], [212, 12], [262, 28], [34, 44], [128, 38], [224, 48], [300, 16]];
  for (const [sx, sy] of stars) sh.disc(x + sx, y + sy, 2, WHITE);
  // missile streaks arcing down
  sh.seg(x + 44, y + 14, x + 96, y + 62, ORANGE, 3);
  sh.seg(x + 158, y + 10, x + 190, y + 56, FLAME, 3);
  sh.seg(x + 236, y + 22, x + 268, y + 64, ORANGE, 3);
  // blast star over the strait
  const bx = x + Math.floor(w * 0.60);
  const by = y + Math.floor(h * 0.42);
  for (let a = 0; a < 8; a++) {
    const rad = (a * Math.PI) / 4;
    sh.seg(bx, by, Math.round(bx + 36 * Math.cos(rad)), Math.round(by + 36 * Math.sin(rad)), FLAME, 4);
  }
  sh.disc(bx, by, 13, ORANGE);
  sh.disc(bx, by, 6, [255, 230, 120]);
  // sea + tanker silhouette
  const seaY = y + Math.floor(h * 0.68);
  sh.box(x, seaY, w, h - Math.floor(h * 0.68), SEA);
  sh.box(x + 18, seaY - 22, w - 60, 20, [30, 30, 34]);
  sh.triangle(x + w - 42, seaY - 22, x + w - 4, seaY - 22, x + w - 42, seaY - 2, [30, 30, 34]);
  sh.box(x + 34, seaY - 40, 40, 18, WHITE);
  sh.border(x + 34, seaY - 40, 40, 18, INK, 1);
  sh.box(x + 82, seaY - 40, 40, 18, WHITE);
  sh.border(x + 82, seaY - 40, 40, 18, INK, 1);
  sh.box(x + w - 62, seaY - 48, 22, 26, RED);
  sh.triangle(x + w - 60, seaY - 48, x + w - 42, seaY - 48, x + w - 51, seaY - 70, ORANGE);
  sh.disc(x + w - 51, seaY - 76, 8, GREY);
  // wave marks
  for (let i = 0; i < 5; i++) {
    const wx = x + 8 + i * Math.floor(w / 5);
    sh.seg(wx, seaY + 12, wx + 16, seaY + 12, WHITE, 2);
  }
}

// COP31: the globe with a red slash — talks collapse, no deal.
function drawGlobeSlash(sh, x, y, w, h) {
  sh.box(x, y, w, h, SKY);
  const cx = x + Math.floor(w * 0.38);
  const cy = y + Math.floor(h / 2) - 6;
  const r = 40;
  sh.disc(cx, cy, r, SEA);
  sh.disc(cx, cy, r - 3, [96, 165, 205]);
  sh.disc(cx - 16, cy - 11, 13, GREEN);
  sh.disc(cx + 15, cy + 8, 11, GREEN);
  sh.disc(cx + 4, cy - 21, 8, GREEN);
  sh.chord(cx, cy, r - 4, -22, SEA);
  sh.chord(cx, cy, r - 4, 22, SEA);
  sh.ring(cx, cy, r, NAVY);
  sh.ring(cx, cy, r - 1, NAVY);
  // red slash across the globe
  sh.seg(cx - 34, cy + 34, cx + 34, cy - 34, RED, 6);
  // thermometer at the side, mercury high
  const tx = x + w - 34;
  const ty = y + h - 22;
  sh.box(tx, ty - 52, 10, 52, WHITE);
  sh.border(tx, ty - 52, 10, 52, INK, 2);
  sh.box(tx + 2, ty - 46, 6, 46, RED);
  sh.disc(tx + 5, ty + 6, 9, RED);
  sh.disc(tx + 5, ty + 6, 5, [255, 120, 110]);
  // small "NO DEAL" tag under the globe
  putCentred(sh, 'NO DEAL', cx, y + h - 12, 1, RED);
}

// Russian cargo ship burning in the Baltic.
function drawShipFire(sh, x, y, w, h) {
  sh.box(x, y, w, h, SKY);
  const seaY = y + Math.floor(h * 0.70);
  sh.box(x, seaY, w, h - Math.floor(h * 0.70), SEA);
  // hull
  sh.triangle(x + 8, seaY - 24, x + w - 8, seaY - 24, x + w - 26, seaY + 2, [40, 40, 44]);
  sh.box(x + 8, seaY - 24, w - 16, 9, [40, 40, 44]);
  // containers
  sh.box(x + 24, seaY - 48, 30, 24, RED);
  sh.box(x + 58, seaY - 48, 30, 24, GOLD);
  sh.box(x + 92, seaY - 40, 30, 16, TEAL);
  // bridge tower
  sh.box(x + w - 52, seaY - 54, 26, 30, WHITE);
  sh.border(x + w - 52, seaY - 54, 26, 30, INK, 1);
  // flames and smoke rising off the containers
  sh.triangle(x + 30, seaY - 48, x + 54, seaY - 48, x + 42, seaY - 62, ORANGE);
  sh.triangle(x + 38, seaY - 48, x + 50, seaY - 48, x + 44, seaY - 56, FLAME);
  sh.disc(x + 64, seaY - 56, 9, GREY);
  sh.disc(x + 88, seaY - 62, 10, [120, 120, 116]);
  sh.disc(x + 112, seaY - 54, 8, GREY);
  // waves
  for (let i = 0; i < 4; i++) {
    const wx = x + 6 + i * Math.floor(w / 4);
    sh.seg(wx, seaY + 12, wx + 14, seaY + 12, WHITE, 2);
  }
}

// Drone over Kyiv at night: quadcopter, blast, dark skyline.
function drawDroneCity(sh, x, y, w, h) {
  sh.box(x, y, w, h, NIGHT);
  const stars = [[14, 10], [52, 20], [100, 8], [150, 18], [200, 10], [250, 24], [30, 38], [120, 32]];
  for (const [sx, sy] of stars) sh.disc(x + sx, y + sy, 2, WHITE);
  // quadcopter drone
  const dx = x + Math.floor(w * 0.30);
  const dy = y + 26;
  sh.box(dx - 16, dy - 5, 32, 10, [200, 200, 200]);
  sh.disc(dx - 20, dy, 7, GREY);
  sh.disc(dx + 20, dy, 7, GREY);
  sh.seg(dx - 26, dy - 4, dx - 14, dy - 4, WHITE, 2);
  sh.seg(dx + 14, dy - 4, dx + 26, dy - 4, WHITE, 2);
  sh.disc(dx, dy + 12, 3, RED); // blinking light
  // blast star over the skyline
  const bx = x + Math.floor(w * 0.68);
  const by = y + Math.floor(h * 0.58);
  for (let a = 0; a < 8; a++) {
    const rad = (a * Math.PI) / 4;
    sh.seg(bx, by, Math.round(bx + 28 * Math.cos(rad)), Math.round(by + 28 * Math.sin(rad)), FLAME, 4);
  }
  sh.disc(bx, by, 10, ORANGE);
  sh.disc(bx, by, 5, [255, 230, 120]);
  // skyline
  const base = y + h;
  sh.box(x, base - 30, 52, 30, [10, 14, 30]);
  sh.box(x + 60, base - 46, 44, 46, [10, 14, 30]);
  sh.box(x + 112, base - 24, 60, 24, [10, 14, 30]);
  sh.box(x + 180, base - 38, 48, 38, [10, 14, 30]);
  sh.box(x + 236, base - 26, 52, 26, [10, 14, 30]);
  for (let i = 0; i < 9; i++) {
    sh.box(x + 8 + (i * 29) % 260, base - 20 - ((i * 17) % 22), 5, 6, FLAME);
  }
}

// Factory on fire: sawtooth factory, chimney, flames and smoke.
function drawFactoryFire(sh, x, y, w, h) {
  sh.box(x, y, w, h, SKY);
  const gy = y + h - 12;
  // factory block with sawtooth roof
  sh.box(x + 14, y + 34, w - 60, gy - y - 34, [120, 120, 116]);
  sh.triangle(x + 14, y + 34, x + 44, y + 14, x + 74, y + 34, [90, 90, 86]);
  sh.triangle(x + 74, y + 34, x + 104, y + 14, x + 134, y + 34, [90, 90, 86]);
  // chimney
  sh.box(x + w - 34, y + 8, 16, gy - y - 8, [150, 60, 50]);
  sh.box(x + w - 36, y + 6, 20, 6, INK);
  // windows
  for (let i = 0; i < 4; i++) sh.box(x + 24 + i * 34, y + 52, 16, 12, FLAME);
  // flames bursting from the roof
  sh.triangle(x + 34, y + 16, x + 62, y + 16, x + 48, y - 2, ORANGE);
  sh.triangle(x + 42, y + 16, x + 56, y + 16, x + 49, y + 2, FLAME);
  // smoke
  sh.disc(x + 78, y + 8, 9, GREY);
  sh.disc(x + 100, y + 2, 10, [120, 120, 116]);
  // ground
  sh.box(x, gy, w, 12, [120, 150, 90]);
}

// Exam scandal: graduation cap over an exam paper stamped with a red X.
function drawExamCap(sh, x, y, w, h) {
  sh.box(x, y, w, h, SAND);
  // exam paper
  const px = x + 18;
  const py = y + 12;
  sh.box(px, py, 84, h - 22, WHITE);
  sh.border(px, py, 84, h - 22, INK, 1);
  sh.seg(px + 10, py + 12, px + 58, py + 12, INK, 2);
  sh.seg(px + 10, py + 22, px + 70, py + 22, GREY, 2);
  sh.seg(px + 10, py + 32, px + 70, py + 32, GREY, 2);
  sh.seg(px + 10, py + 42, px + 46, py + 42, GREY, 2);
  // red X across the paper
  sh.seg(px + 52, py + 8, px + 78, py + 44, RED, 4);
  sh.seg(px + 78, py + 8, px + 52, py + 44, RED, 4);
  // graduation cap, right side
  const cx = x + w - 58;
  const cy = y + 30;
  sh.triangle(cx - 44, cy, cx, cy - 18, cx + 44, cy, INK);
  sh.box(cx - 26, cy + 2, 52, 12, INK);
  sh.seg(cx + 44, cy, cx + 44, cy + 26, GOLD, 3);
  sh.disc(cx + 44, cy + 30, 5, GOLD);
}

// Cartel boss captured: sheriff star badge and handcuffs.
function drawBadge(sh, x, y, w, h) {
  sh.box(x, y, w, h, SAND);
  // star badge
  const cx = x + Math.floor(w * 0.32);
  const cy = y + Math.floor(h / 2);
  for (let a = 0; a < 5; a++) {
    const rad = ((a * 72 - 90) * Math.PI) / 180;
    const rad2 = ((a * 72 - 54) * Math.PI) / 180;
    sh.triangle(cx, cy, Math.round(cx + 34 * Math.cos(rad)), Math.round(cy + 34 * Math.sin(rad)), Math.round(cx + 14 * Math.cos(rad2)), Math.round(cy + 14 * Math.sin(rad2)), GOLD);
  }
  sh.disc(cx, cy, 12, NAVY);
  sh.disc(cx, cy, 6, WHITE);
  // handcuffs: two rings and a chain
  const hx = x + Math.floor(w * 0.72);
  const hy = y + Math.floor(h / 2);
  sh.ring(hx - 22, hy, 14, INK);
  sh.ring(hx - 22, hy, 12, INK);
  sh.ring(hx + 22, hy, 14, INK);
  sh.ring(hx + 22, hy, 12, INK);
  sh.seg(hx - 8, hy - 6, hx + 8, hy - 6, INK, 3);
  sh.seg(hx - 8, hy + 6, hx + 8, hy + 6, INK, 3);
}

// Lethal AI weapons: robot head with a red ring around a small missile.
function drawRobot(sh, x, y, w, h) {
  sh.box(x, y, w, h, SKY);
  // robot head
  const cx = x + Math.floor(w * 0.36);
  const cy = y + Math.floor(h / 2) + 4;
  sh.box(cx - 30, cy - 24, 60, 48, [180, 190, 195]);
  sh.border(cx - 30, cy - 24, 60, 48, INK, 2);
  // antenna
  sh.seg(cx, cy - 24, cx, cy - 38, INK, 3);
  sh.disc(cx, cy - 42, 5, RED);
  // eyes and mouth grille
  sh.box(cx - 20, cy - 12, 14, 10, RED);
  sh.box(cx + 6, cy - 12, 14, 10, RED);
  for (let i = 0; i < 4; i++) sh.seg(cx - 18 + i * 10, cy + 12, cx - 12 + i * 10, cy + 12, INK, 2);
  // missile on the right, circled in red
  const mx = x + Math.floor(w * 0.78);
  const my = y + Math.floor(h / 2);
  sh.triangle(mx - 8, my - 22, mx + 8, my - 22, mx, my - 34, GREY);
  sh.box(mx - 8, my - 22, 16, 34, GREY);
  sh.box(mx - 12, my + 2, 24, 6, GREY);
  sh.ring(mx, my - 4, 30, RED);
  sh.seg(mx - 21, my - 25, mx + 21, my + 17, RED, 4);
}

// ---------------------------------------------------------------------------
// Layout: a newspaper front page, 1024 x 1024.
// ---------------------------------------------------------------------------
const M = 28; // outer margin
const CONTENT_W = W - 2 * M;

function hrule(sh, y, rgb, t = 2) {
  sh.box(M, y, CONTENT_W, t, rgb);
}

// One of the three middle cards: coloured header bar, picture, headline, deck.
function card(sh, x, y, w, h, accent, kick, pic, headline, deck) {
  sh.border(x, y, w, h, INK, 1);
  sh.box(x, y, w, 26, accent);
  putText(sh, kick, x + 10, y + 6, 2, WHITE);
  pic(sh, x + 8, y + 34, w - 16, 100);
  const hx = x + 10;
  const hy = y + 142;
  putPara(sh, headline, hx, hy, w - 20, 3, INK, 4);
  putPara(sh, deck, hx, hy + 52, w - 20, 2, INK, 4);
}

// One of the four bottom columns: kicker, picture, headline, deck.
function mini(sh, x, y, w, kick, pic, headline, deck) {
  putText(sh, kick, x, y, 2, RED);
  pic(sh, x, y + 18, w, 76);
  putPara(sh, headline, x, y + 100, w, 2, INK, 3);
  putPara(sh, deck, x, y + 140, w, 2, GREY, 3);
}

function buildPage() {
  const sh = new Sheet();

  // ---- Masthead ----
  putCentred(sh, 'THE WORLD TODAY', W / 2, 16, 7, INK);
  sh.box(M, 74, CONTENT_W, 4, RED);
  putCentred(sh, 'MONDAY, 23 NOVEMBER 2026', W / 2, 86, 3, RED);
  sh.box(M, 116, CONTENT_W, 2, INK);

  // ---- Lead story: Gulf war escalates ----
  const leadY = 128;
  const leadX = M;
  const leadW = 560;
  putText(sh, 'GULF WAR - STRAIT OF HORMUZ', leadX, leadY + 4, 2, RED);
  putText(sh, 'GULF WAR', leadX, leadY + 28, 6, INK);
  putText(sh, 'ESCALATES', leadX, leadY + 74, 6, INK);
  let dy = putPara(sh,
    'Iran fired missiles and drones at US bases in Bahrain on Saturday night. Tehran claims it hit two Patriot radars; Bahrain reports a fire at a civilian plant on Sitra, 2 hurt.',
    leadX, leadY + 130, leadW, 2, INK, 4);
  putPara(sh,
    '25 tankers hit near the Strait in a week. The US blockade of Iran is on day 130; Tehran readies a convoy to break it. Talks stalled.',
    leadX, dy + 10, leadW, 2, INK, 4);

  // ---- Lead art: missiles over the Strait ----
  const artX = 632;
  const artY = leadY;
  const artW = W - M - artX; // 364
  const artH = 272;
  sh.border(artX, artY, artW, artH, INK, 2);
  sh.box(artX + 2, artY + 2, artW - 4, artH - 4, SAND);
  drawGulf(sh, artX + 8, artY + 8, artW - 16, 226);
  putCentred(sh, 'MISSILES OVER THE STRAIT', artX + artW / 2, artY + artH - 26, 2, INK);

  hrule(sh, 414, INK, 2);

  // ---- Three middle stories ----
  const cardsY = 428;
  const cardsH = 258;
  const cardW = Math.floor((CONTENT_W - 32) / 3);
  card(sh, M, cardsY, cardW, cardsH, NAVY, 'CLIMATE - TURKIYE',
    drawGlobeSlash, 'CLIMATE TALKS COLLAPSE',
    'UN talks in Turkiye end with no deal; the draft omits fossil fuels.');
  card(sh, M + cardW + 16, cardsY, cardW, cardsH, RED, 'BALTIC SEA',
    drawShipFire, 'RUSSIAN SHIP STILL BURNING',
    'Ship ablaze off Finland after a drone attack; spillover feared.');
  card(sh, M + 2 * cardW + 32, cardsY, cardW, cardsH, [40, 40, 44], 'WAR - UKRAINE',
    drawDroneCity, 'DRONE HITS KYIV: 14 MISSING',
    'Drone strikes a building in the Kyiv region; at least 14 missing.');

  hrule(sh, 698, INK, 2);

  // ---- Four bottom stories ----
  const miniY = 712;
  const miniW = Math.floor((CONTENT_W - 36) / 4);
  mini(sh, M, miniY, miniW, 'INDONESIA', drawFactoryFire, 'FACTORY FIRE KILLS 3',
    'Dozens missing after a blaze at a candy factory.');
  mini(sh, M + miniW + 12, miniY, miniW, 'SOUTH KOREA', drawExamCap, 'MINISTER QUITS OVER AI EXAMS',
    'Minister quits in AI exam-cheating scandal.');
  mini(sh, M + 2 * miniW + 24, miniY, miniW, 'MEXICO', drawBadge, 'EL CHAPO ISIDRO CAPTURED',
    'Cartel boss seized; 11 killed in Sinaloa firefights.');
  mini(sh, M + 3 * miniW + 36, miniY, miniW, 'AI WEAPONS', drawRobot, 'TALKS ON KILLER ROBOTS GO ON',
    'UN talks on lethal AI weapons continue.');

  // ---- Footer: sport strip + sources ----
  const footY = 916;
  sh.box(0, footY, W, H - footY, NAVY);
  putText(sh, 'SPORT -', M, footY + 12, 2, GOLD);
  putPara(sh,
    'INDIA 720/9 DECLARED IN WELLINGTON TEST VS NEW ZEALAND',
    M, footY + 34, CONTENT_W, 2, WHITE, 4);
  putPara(sh,
    "LIVERPOOL THRASH 10-MAN MAN UTD IN POCHETTINO'S FIRST MATCH",
    M, footY + 56, CONTENT_W, 2, WHITE, 4);
  putText(sh, 'SOURCES: REUTERS, AP, BBC - THE WORLD TODAY, MONDAY 23 NOVEMBER 2026',
    M, footY + 78, 2, [180, 200, 220]);

  return sh;
}

function main() {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';
  mkdirSync(outDir, { recursive: true });
  const page = buildPage();
  const png = pngEncode(W, H, page.buf);
  writeFileSync(join(outDir, 'entry.png'), png);
}

main();
