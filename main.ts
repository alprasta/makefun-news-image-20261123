// THE WORLD TODAY — front page for Monday 23 November 2026.
// Draws a one-page newspaper front page (1024x1024 PNG) with a hand-built
// bitmap font and a hand-rolled PNG writer. Node 22 standard library only,
// no network, no dependencies, fully deterministic.
//
// How the picture is built, in one sentence: a flat RGB canvas is painted
// with rectangles, discs and triangles, text is stamped from a 5x7 font in
// which every glyph is a single 35-bit integer, and the finished canvas is
// packed into a PNG by hand.

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const W = 1024;
const H = 1024;

// ---- palette: warm newsprint, ink, signal red, deep navy ------------------
const PAPER = [246, 236, 214];
const INK = [26, 24, 22];
const RED = [176, 32, 32];
const NAVY = [26, 48, 80];
const NIGHT = [16, 22, 48];
const SKY = [168, 205, 226];
const SEA = [64, 130, 178];
const AMBER = [232, 164, 32];
const ORANGE = [226, 110, 28];
const GREEN = [46, 125, 60];
const GREY = [122, 120, 114];
const WHITE = [250, 248, 242];
const CREAM = [238, 226, 196];

// ---- canvas: one flat RGB byte array, origin top-left ---------------------
const ink = new Uint8Array(W * H * 3);

function paint(c) {
  for (let i = 0; i < W * H; i++) {
    ink[i * 3] = c[0];
    ink[i * 3 + 1] = c[1];
    ink[i * 3 + 2] = c[2];
  }
}

function blot(x, y, w, h, c) {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(W, x + w);
  const y1 = Math.min(H, y + h);
  for (let yy = y0; yy < y1; yy++) {
    let base = (yy * W + x0) * 3;
    for (let xx = x0; xx < x1; xx++) {
      ink[base] = c[0];
      ink[base + 1] = c[1];
      ink[base + 2] = c[2];
      base += 3;
    }
  }
}

function dot(x, y, c) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  ink[i] = c[0];
  ink[i + 1] = c[1];
  ink[i + 2] = c[2];
}

// Filled disc by horizontal scanlines.
function disc(cx, cy, r, c) {
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.floor(Math.sqrt(r * r - dy * dy));
    blot(cx - half, cy + dy, half * 2 + 1, 1, c);
  }
}

// Ring: outer disc minus inner disc, repainted in the given inner colour.
function ring(cx, cy, r, thick, c, inner) {
  disc(cx, cy, r, c);
  disc(cx, cy, Math.max(0, r - thick), inner);
}

// Thick straight streak between two points (square brush stepping).
function streak(x0, y0, x1, y1, w, c) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
  const half = Math.floor(w / 2);
  for (let s = 0; s <= steps; s++) {
    const px = Math.round(x0 + (dx * s) / steps);
    const py = Math.round(y0 + (dy * s) / steps);
    blot(px - half, py - half, w, w, c);
  }
}

// Filled triangle via barycentric edge test.
function tri(ax, ay, bx, by, cx, cy, c) {
  const minX = Math.max(0, Math.min(ax, bx, cx));
  const maxX = Math.min(W - 1, Math.max(ax, bx, cx));
  const minY = Math.max(0, Math.min(ay, by, cy));
  const maxY = Math.min(H - 1, Math.max(ay, by, cy));
  const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
  if (d === 0) return;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const a = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / d;
      const b = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / d;
      const g = 1 - a - b;
      if (a >= 0 && b >= 0 && g >= 0) dot(x, y, c);
    }
  }
}

// ---- font: one 35-bit integer per glyph ----------------------------------
// A glyph is 5 columns by 7 rows. Bit 34 is the top-left pixel, bit 0 the
// bottom-right; bit (34 - row*5 - col) is set when that pixel is inked.
// Decoding is a division, because JS bit shifts only cover 32 bits.
// Unknown characters render as blank.
const GLYPH = {
  A: 0b01110100011000111111100011000110001,
  B: 0b11110100011000111110100011000111110,
  C: 0b01110100011000010000100001000101110,
  D: 0b11110100011000110001100011000111110,
  E: 0b11111100001000011110100001000011111,
  F: 0b11111100001000011110100001000010000,
  G: 0b01110100011000010111100011000101111,
  H: 0b10001100011000111111100011000110001,
  I: 0b01110001000010000100001000010001110,
  J: 0b00111000100001000010000101001001100,
  K: 0b10001100101010011000101001001010001,
  L: 0b10000100001000010000100001000011111,
  M: 0b10001110111010110101100011000110001,
  N: 0b10001110011010110011100011000110001,
  O: 0b01110100011000110001100011000101110,
  P: 0b11110100011000111110100001000010000,
  Q: 0b01110100011000110001101011001001101,
  R: 0b11110100011000111110101001001010001,
  S: 0b01111100001000001110000010000111110,
  T: 0b11111001000010000100001000010000100,
  U: 0b10001100011000110001100011000101110,
  V: 0b10001100011000110001100010101000100,
  W: 0b10001100011000110101101011101110001,
  X: 0b10001100010101000100010101000110001,
  Y: 0b10001100010101000100001000010000100,
  Z: 0b11111000010001000100010001000011111,
  "0": 0b01110100011001110101110011000101110,
  "1": 0b00100011000010000100001000010001110,
  "2": 0b01110100010000100110010001000011111,
  "3": 0b11111000100010000010000011000101110,
  "4": 0b00010001100101010010111110001000010,
  "5": 0b11111100001111000001000011000101110,
  "6": 0b00110010001000011110100011000101110,
  "7": 0b11111000010001000100010000100001000,
  "8": 0b01110100011000101110100011000101110,
  "9": 0b01110100011000101111000010001001100,
  " ": 0,
  ".": 0b00000000000000000000000000110001100,
  ",": 0b00000000000000000000011000010001000,
  ":": 0b00000011000110000000011000110000000,
  "-": 0b00000000000000001110000000000000000,
  "/": 0b00001000100001000100010000100010000,
};

function glyphBit(ch, row, col) {
  const mask = GLYPH[ch] ?? 0;
  const place = 34 - row * 5 - col;
  return Math.floor(mask / 2 ** place) % 2 === 1;
}

// Stamp one glyph: each font pixel becomes an s-by-s block.
function stamp(ch, x, y, s, c) {
  for (let r = 0; r < 7; r++) {
    for (let col = 0; col < 5; col++) {
      if (glyphBit(ch, r, col)) blot(x + col * s, y + r * s, s, s, c);
    }
  }
}

// Width of a string at scale s (5 px glyph + 1 px gap, no trailing gap).
function measure(text, s) {
  if (text.length === 0) return 0;
  return text.length * 6 * s - s;
}

// Draw a single line left-aligned.
function writeLine(text, x, y, s, c) {
  for (let i = 0; i < text.length; i++) {
    stamp(text[i], x + i * 6 * s, y, s, c);
  }
}

// Draw a line centred on cx.
function writeCentred(text, cx, y, s, c) {
  writeLine(text, cx - Math.floor(measure(text, s) / 2), y, s, c);
}

// Greedy word wrap: returns lines that fit maxChars characters each.
function fold(text, maxChars) {
  const words = text.split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    if (cur === "") {
      cur = w;
    } else if (cur.length + 1 + w.length <= maxChars) {
      cur += " " + w;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

// Draw wrapped text inside a box; returns the y just below the last line.
function pour(text, x, y, s, c, boxW, gap = 4) {
  const maxChars = Math.max(1, Math.floor(boxW / (6 * s)));
  const lines = fold(text, maxChars);
  for (const line of lines) {
    writeLine(line, x, y, s, c);
    y += 7 * s + gap;
  }
  return y;
}

// ---- pictograms: flat shapes, one small scene per story ------------------

// Lead art: missiles streaking over a night strait, blast on the horizon.
function leadArt(x, y, w, h) {
  blot(x, y, w, h, NIGHT);
  // stars
  const stars = [
    [18, 22], [64, 12], [120, 30], [180, 14], [250, 26], [320, 10],
    [370, 34], [40, 58], [150, 52], [280, 48], [340, 60], [210, 66],
  ];
  for (const [sx, sy] of stars) blot(x + sx, y + sy, 3, 3, WHITE);
  // missile streaks
  streak(x + 70, y + 30, x + 130, y + 90, 4, ORANGE);
  streak(x + 230, y + 22, x + 185, y + 86, 4, AMBER);
  streak(x + 330, y + 40, x + 290, y + 92, 4, ORANGE);
  // blast: rays + core
  const bx = x + 250;
  const by = y + 130;
  for (let k = 0; k < 8; k++) {
    const ang = (k * Math.PI) / 4;
    const ex = bx + Math.round(Math.cos(ang) * 34);
    const ey = by + Math.round(Math.sin(ang) * 34);
    streak(bx, by, ex, ey, 5, AMBER);
  }
  disc(bx, by, 16, ORANGE);
  disc(bx, by, 9, AMBER);
  disc(bx, by, 4, WHITE);
  // tanker silhouette on the horizon
  blot(x + 30, y + 150, 300, 26, INK);
  blot(x + 52, y + 132, 42, 18, WHITE);
  blot(x + 104, y + 132, 42, 18, WHITE);
  // radar tower on the right
  blot(x + 356, y + 118, 16, 58, RED);
  tri(x + 352, y + 118, x + 376, y + 118, x + 364, y + 96, ORANGE);
  disc(x + 364, y + 90, 7, GREY);
  // sea with white dashes
  blot(x, y + 176, w, h - 176, SEA);
  for (const wx of [24, 96, 168, 240, 312]) blot(x + wx, y + 196, 26, 4, WHITE);
}

// Climate: a crossed-out globe and a red thermometer.
function globeArt(x, y, w, h) {
  blot(x, y, w, h, SKY);
  const cx = x + 78;
  const cy = y + 58;
  disc(cx, cy, 42, SEA);
  ring(cx, cy, 42, 3, NAVY, SEA);
  disc(cx - 12, cy - 10, 13, GREEN);
  disc(cx + 12, cy + 8, 15, GREEN);
  disc(cx + 16, cy - 18, 8, GREEN);
  streak(cx - 34, cy + 34, cx + 34, cy - 34, 6, RED);
  writeLine("NO DEAL", x + 52, y + 108, 1, RED);
  // thermometer
  blot(x + 218, y + 22, 12, 62, WHITE);
  disc(x + 224, y + 92, 14, RED);
  blot(x + 220, y + 44, 8, 40, RED);
  blot(x + 214, y + 18, 20, 6, INK);
}

// Baltic: a cargo ship ablaze on a grey sea.
function shipArt(x, y, w, h) {
  blot(x, y, w, h, SKY);
  // smoke
  disc(x + 130, y + 22, 12, GREY);
  disc(x + 158, y + 14, 14, GREY);
  disc(x + 186, y + 24, 10, GREY);
  // containers
  blot(x + 62, y + 62, 30, 26, RED);
  blot(x + 96, y + 62, 30, 26, AMBER);
  blot(x + 130, y + 62, 30, 26, [42, 122, 110]);
  // flames
  tri(x + 66, y + 62, x + 88, y + 62, x + 77, y + 34, ORANGE);
  tri(x + 100, y + 62, x + 122, y + 62, x + 111, y + 40, AMBER);
  // hull
  tri(x + 30, y + 88, x + 268, y + 88, x + 238, y + 100, INK);
  blot(x + 30, y + 88, 238, 8, INK);
  // bridge
  blot(x + 232, y + 52, 26, 36, WHITE);
  blot(x + 236, y + 58, 18, 10, SKY);
  // sea
  blot(x, y + 100, w, h - 100, SEA);
  for (const wx of [20, 90, 160, 230]) blot(x + wx, y + 108, 24, 4, WHITE);
}

// Ukraine: a drone over a dark city, blast on the right.
function droneArt(x, y, w, h) {
  blot(x, y, w, h, NIGHT);
  const stars = [[16, 16], [70, 30], [140, 12], [210, 26], [260, 14], [40, 52], [180, 48]];
  for (const [sx, sy] of stars) blot(x + sx, y + sy, 3, 3, WHITE);
  // drone body + rotors
  blot(x + 118, y + 34, 62, 10, GREY);
  blot(x + 96, y + 30, 30, 4, WHITE);
  blot(x + 180, y + 30, 30, 4, WHITE);
  disc(x + 149, y + 50, 4, RED);
  // city blocks with lit windows
  const blocks = [[0, 96, 52], [56, 82, 44], [104, 100, 60], [168, 78, 48], [220, 96, 56], [280, 86, 32]];
  for (const [bx, by, bw] of blocks) {
    blot(x + bx, y + by, bw, h - by, INK);
    for (let wy = by + 8; wy < h - 12; wy += 16) {
      blot(x + bx + 8, y + wy, 6, 6, AMBER);
      blot(x + bx + bw - 16, y + wy, 6, 6, AMBER);
    }
  }
  // blast over the right block
  const bx = x + 252;
  const by = y + 62;
  for (let k = 0; k < 6; k++) {
    const ang = (k * Math.PI) / 3 + 0.3;
    streak(bx, by, bx + Math.round(Math.cos(ang) * 26), by + Math.round(Math.sin(ang) * 26), 4, AMBER);
  }
  disc(bx, by, 10, ORANGE);
}

// Indonesia: factory with smoking chimneys.
function factoryArt(x, y, w, h) {
  blot(x, y, w, h, SKY);
  disc(x + 96, y + 10, 10, GREY);
  disc(x + 118, y + 6, 12, GREY);
  blot(x + 176, y + 12, 14, 40, RED);
  blot(x + 172, y + 8, 22, 8, INK);
  // roofline
  tri(x + 10, y + 36, x + 62, y + 36, x + 36, y + 18, INK);
  tri(x + 66, y + 36, x + 118, y + 36, x + 92, y + 18, INK);
  tri(x + 122, y + 36, x + 174, y + 36, x + 148, y + 18, INK);
  blot(x + 10, y + 36, 164, 20, GREY);
  for (const wx of [24, 62, 100, 138]) blot(x + wx, y + 44, 14, 10, AMBER);
  blot(x, y + 56, w, h - 56, GREEN);
}

// South Korea: a crossed-out exam paper and a graduation cap.
function examArt(x, y, w, h) {
  blot(x, y, w, h, CREAM);
  blot(x + 12, y + 12, 84, 56, WHITE);
  blot(x + 12, y + 12, 84, 3, INK);
  blot(x + 12, y + 65, 84, 3, INK);
  blot(x + 12, y + 12, 3, 56, INK);
  blot(x + 93, y + 12, 3, 56, INK);
  for (const ly of [24, 34, 44, 54]) blot(x + 22, y + ly, 44, 3, GREY);
  streak(x + 66, y + 22, x + 92, y + 58, 5, RED);
  streak(x + 92, y + 22, x + 66, y + 58, 5, RED);
  // graduation cap
  tri(x + 128, y + 34, x + 196, y + 34, x + 162, y + 56, INK);
  blot(x + 142, y + 50, 40, 8, INK);
  streak(x + 196, y + 34, x + 196, y + 58, 3, AMBER);
  disc(x + 196, y + 62, 5, AMBER);
}

// Mexico: a sheriff star and handcuffs.
function badgeArt(x, y, w, h) {
  blot(x, y, w, h, CREAM);
  const cx = x + 52;
  const cy = y + 38;
  for (let k = 0; k < 5; k++) {
    const a1 = (k * 2 * Math.PI) / 5 - Math.PI / 2;
    const a2 = ((k + 0.5) * 2 * Math.PI) / 5 - Math.PI / 2;
    tri(
      cx, cy,
      cx + Math.round(Math.cos(a1) * 30), cy + Math.round(Math.sin(a1) * 30),
      cx + Math.round(Math.cos(a2) * 13), cy + Math.round(Math.sin(a2) * 13),
      AMBER
    );
  }
  disc(cx, cy, 11, NAVY);
  disc(cx, cy, 5, WHITE);
  // handcuffs
  ring(x + 148, y + 38, 15, 4, INK, CREAM);
  ring(x + 186, y + 38, 15, 4, INK, CREAM);
  blot(x + 158, y + 30, 18, 5, INK);
}

// AI weapons: a robot face and a prohibition sign.
function robotArt(x, y, w, h) {
  blot(x, y, w, h, SKY);
  blot(x + 56, y + 22, 66, 44, GREY);
  blot(x + 56, y + 22, 66, 4, INK);
  blot(x + 56, y + 62, 66, 4, INK);
  blot(x + 74, y + 34, 12, 10, RED);
  blot(x + 104, y + 34, 12, 10, RED);
  blot(x + 82, y + 52, 26, 3, INK);
  blot(x + 92, y + 14, 4, 8, INK);
  disc(x + 94, y + 12, 5, RED);
  const cx = x + 184;
  const cy = y + 44;
  ring(cx, cy, 24, 3, RED, WHITE);
  // missile silhouette inside the sign
  tri(cx - 6, cy - 20, cx + 6, cy - 20, cx, cy + 16, GREY);
  blot(cx - 6, cy + 2, 12, 6, GREY);
  streak(cx - 20, cy + 20, cx + 20, cy - 20, 5, RED);
}

// ---- PNG writer: hand-packed chunks, zlib for the pixel data -------------
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

// One PNG chunk: length, four-letter tag, payload, CRC over tag+payload.
function pack(tag, data) {
  const tagBuf = Buffer.from(tag, "ascii");
  const head = Buffer.alloc(4);
  head.writeUInt32BE(data.length);
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(Buffer.concat([tagBuf, data])));
  return Buffer.concat([head, tagBuf, data, tail]);
}

function pngBytes() {
  const stride = W * 3 + 1;
  const raw = Buffer.alloc(H * stride);
  const rgb = Buffer.from(ink.buffer, ink.byteOffset, ink.byteLength);
  for (let y = 0; y < H; y++) {
    raw[y * stride] = 0; // filter: none, every row
    rgb.copy(raw, y * stride + 1, y * W * 3, (y + 1) * W * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // 8 bits per channel
  ihdr[9] = 2; // truecolour RGB
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    pack("IHDR", ihdr),
    pack("IDAT", zlib.deflateSync(raw, { level: 9 })),
    pack("IEND", Buffer.alloc(0)),
  ]);
}

// ---- layout: masthead, lead, three cards, four minis, sport footer ------

function rule(x, y, w, h, c) {
  blot(x, y, w, h, c);
}

function card(x, y, w, h, band, kicker, art, headline, body) {
  rule(x, y, w, 2, INK);
  rule(x, y + h - 2, w, 2, INK);
  rule(x, y, 2, h, INK);
  rule(x + w - 2, y, 2, h, INK);
  blot(x + 2, y + 2, w - 4, 30, band);
  writeLine(kicker, x + 12, y + 10, 2, WHITE);
  art(x + 2, y + 32, w - 4, 116);
  let ty = y + 32 + 116 + 8;
  ty = pour(headline, x + 10, ty, 3, INK, w - 20, 4);
  pour(body, x + 10, ty + 6, 2, INK, w - 20, 4);
}

function mini(x, y, w, kicker, art, headline, body) {
  writeLine(kicker, x, y, 2, RED);
  art(x, y + 18, w, 64);
  const ty = pour(headline, x, y + 88, 2, INK, w, 4);
  pour(body, x, ty + 4, 2, INK, w, 4);
}

function compose() {
  paint(PAPER);

  // Masthead + dateline.
  writeCentred("THE WORLD TODAY", 512, 18, 8, INK);
  rule(28, 86, 968, 5, RED);
  writeCentred("MONDAY, 23 NOVEMBER 2026", 512, 100, 3, RED);
  rule(28, 130, 968, 3, INK);

  // Lead story, left column.
  writeLine("GULF WAR - STRAIT OF HORMUZ", 28, 152, 2, RED);
  writeLine("GULF WAR", 28, 178, 7, INK);
  writeLine("ESCALATES", 28, 233, 7, INK);
  let by = pour(
    "IRAN FIRED MISSILES AND DRONES AT US BASES IN BAHRAIN ON SATURDAY NIGHT. " +
      "TEHRAN CLAIMS IT HIT TWO PATRIOT RADARS AT AL-RIFFA AND AWALI. " +
      "BAHRAIN REPORTS A FIRE AT A CIVILIAN PLANT ON SITRA, 2 HURT.",
    28, 294, 2, INK, 540, 4
  );
  pour(
    "25 TANKERS HIT NEAR THE STRAIT IN A WEEK. THE US BLOCKADE OF IRAN IS ON " +
      "DAY 130. TEHRAN READIES A CONVOY TO BREAK IT. TALKS STALLED.",
    28, by + 8, 2, INK, 540, 4
  );

  // Lead art, right column, with caption strip.
  rule(592, 144, 404, 3, INK);
  rule(592, 433, 404, 3, INK);
  rule(592, 144, 3, 292, INK);
  rule(993, 144, 3, 292, INK);
  leadArt(595, 147, 398, 252);
  writeCentred("MISSILES OVER THE STRAIT", 794, 408, 2, INK);

  rule(28, 458, 968, 3, INK);

  // Three mid-page cards.
  card(
    28, 472, 312, 272, NAVY, "CLIMATE - TURKIYE", globeArt,
    "CLIMATE TALKS COLLAPSE",
    "UN TALKS IN TURKIYE END WITH NO DEAL. THE DRAFT OMITS FOSSIL FUELS."
  );
  card(
    356, 472, 312, 272, RED, "BALTIC SEA", shipArt,
    "RUSSIAN SHIP STILL BURNING",
    "SHIP ABLAZE OFF FINLAND AFTER A DRONE ATTACK. SPILLOVER FEARED."
  );
  card(
    684, 472, 312, 272, INK, "WAR - UKRAINE", droneArt,
    "DRONE HITS KYIV: 14 MISSING",
    "DRONE STRIKES A BUILDING IN THE KYIV REGION. AT LEAST 14 MISSING."
  );

  rule(28, 754, 968, 3, INK);

  // Four minis.
  mini(28, 766, 230, "INDONESIA", factoryArt,
    "FACTORY FIRE KILLS 3", "DOZENS MISSING IN FACTORY BLAZE.");
  mini(274, 766, 230, "SOUTH KOREA", examArt,
    "MINISTER QUITS OVER AI EXAMS", "CHOI KYO-JIN QUITS IN EXAM SCANDAL.");
  mini(520, 766, 230, "MEXICO", badgeArt,
    "EL CHAPO ISIDRO CAPTURED", "BOSS SEIZED. 11 KILLED IN SINALOA.");
  mini(766, 766, 230, "AI WEAPONS", robotArt,
    "TALKS ON KILLER ROBOTS GO ON", "NATIONS AGREE TO KEEP NEGOTIATING.");

  // Sport footer.
  blot(0, 938, 1024, 74, NAVY);
  writeLine("SPORT -", 28, 944, 2, AMBER);
  writeLine("INDIA 720/9 DECLARED IN WELLINGTON TEST VS NEW ZEALAND", 28, 961, 2, WHITE);
  writeLine("LIVERPOOL THRASH 10-MAN MAN UTD IN POCHETTINO DEBUT", 28, 978, 2, WHITE);
  writeLine(
    "SOURCES: REUTERS, AP, BBC - THE WORLD TODAY, MONDAY 23 NOVEMBER 2026",
    28, 994, 2, [190, 196, 205]
  );
}

function main() {
  compose();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "entry.png"), pngBytes());
}

main();
