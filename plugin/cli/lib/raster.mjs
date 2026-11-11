// Raster operations built on sharp: SVG rasterisation, format export,
// inspection (dimensions, blankness, palette adherence), perceptual hashing
// and pixel diffing for visual regression and design-to-code comparison.
import fs from 'node:fs';
import path from 'node:path';
import { hexToRgb, rgbToHex, hexToOklch } from './util.mjs';
import { need } from './deps.mjs';

const sharp = () => need('sharp', 'raster');

/** Rasterise an SVG string to exact pixel dimensions. */
export async function svgToRaster(svg, { width, height, format = 'png', quality, transparent = false, background }) {
  const s = sharp();
  // Render above target size, then downsample, so thin vector detail is antialiased cleanly.
  const density = Math.min(600, Math.max(72, Math.ceil((72 * width * 2) / svgWidth(svg, width))));
  let img = s(Buffer.from(svg), { density, limitInputPixels: 268402689 }).resize(width, height, { fit: 'fill' });
  if (!transparent) img = img.flatten({ background: background || '#ffffff' });
  if (format === 'png') return img.png({ compressionLevel: 9, palette: false }).toBuffer();
  if (format === 'webp') return img.webp({ quality: quality ?? 84, alphaQuality: 90, effort: 5 }).toBuffer();
  if (format === 'avif') return img.avif({ quality: quality ?? 58, effort: 4 }).toBuffer();
  if (format === 'jpeg') return img.flatten({ background: background || '#ffffff' }).jpeg({ quality: quality ?? 84, mozjpeg: true }).toBuffer();
  throw new Error(`Unsupported raster format ${format}`);
}

function svgWidth(svg, fallback) {
  const m = /viewBox="[\d.-]+\s+[\d.-]+\s+([\d.]+)\s+[\d.]+"/.exec(svg);
  return m ? Number(m[1]) : fallback;
}

export async function convert(buffer, { width, height, format, quality, fit = 'cover', position = 'attention' }) {
  let img = sharp()(buffer);
  if (width || height) img = img.resize(width, height, { fit, position });
  if (format === 'webp') return img.webp({ quality: quality ?? 84 }).toBuffer();
  if (format === 'avif') return img.avif({ quality: quality ?? 58, effort: 4 }).toBuffer();
  if (format === 'jpeg') return img.jpeg({ quality: quality ?? 84, mozjpeg: true }).toBuffer();
  return img.png({ compressionLevel: 9 }).toBuffer();
}

export async function metadata(input) {
  const m = await sharp()(input).metadata();
  return { width: m.width, height: m.height, format: m.format, hasAlpha: Boolean(m.hasAlpha), channels: m.channels };
}

async function raw(input, size) {
  const { data, info } = await sharp()(input).resize(size, size, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, info };
}

/** 64-bit difference hash. Near-identical images differ in only a few bits. */
export async function dhash(input) {
  const { data } = await sharp()(input).greyscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  let bits = '';
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += data[y * 9 + x] > data[y * 9 + x + 1] ? '1' : '0';
  return BigInt('0b' + bits).toString(16).padStart(16, '0');
}

export function hamming(a, b) {
  let x = BigInt('0x' + a) ^ BigInt('0x' + b);
  let n = 0;
  while (x) {
    n += Number(x & 1n);
    x >>= 1n;
  }
  return n;
}

function toLab(hex) {
  const o = hexToOklch(hex);
  return [o.l, o.c * Math.cos((o.h * Math.PI) / 180), o.c * Math.sin((o.h * Math.PI) / 180)];
}

function segDist(p, a, b) {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ap = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
  const len = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2;
  const t = len ? Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / len)) : 0;
  return Math.hypot(ap[0] - t * ab[0], ap[1] - t * ab[1], ap[2] - t * ab[2]);
}

/**
 * Inspect a produced image against its requirement.
 * - blankness: a flat field usually means a failed render.
 * - palette adherence: share of sampled pixels lying on or between palette
 *   colours (gradients between two brand colours count as on-brand).
 */
export async function inspect(input, { expect = {}, palette = [] } = {}) {
  const meta = await metadata(input);
  const stats = await sharp()(input).stats();
  const spread = Math.max(...stats.channels.slice(0, 3).map((c) => c.stdev));
  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass, detail });
  if (expect.width) add('dimensions', meta.width === expect.width && meta.height === expect.height, `${meta.width}x${meta.height}, required ${expect.width}x${expect.height}`);
  if (expect.format) add('format', meta.format === (expect.format === 'avif' ? 'heif' : expect.format), `${meta.format}`);
  if (expect.transparent !== undefined) add('alpha', meta.hasAlpha === expect.transparent || !expect.transparent, expect.transparent ? `alpha channel ${meta.hasAlpha ? 'present' : 'MISSING'}` : 'opaque output');
  add('not-blank', spread > 2.5, `channel spread ${spread.toFixed(1)}`);
  let adherence = null;
  if (palette.length >= 2) {
    const { data } = await raw(input, 36);
    const labs = palette.map(toLab);
    let on = 0;
    let counted = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 40) continue; // transparent pixels carry no colour
      counted++;
      const p = toLab(rgbToHex([data[i], data[i + 1], data[i + 2]]));
      let best = Infinity;
      for (let a = 0; a < labs.length && best > 0.045; a++) for (let b = a; b < labs.length; b++) best = Math.min(best, segDist(p, labs[a], labs[b]));
      if (best <= 0.045) on++;
    }
    adherence = counted ? on / counted : 1;
    add('palette-adherence', adherence >= 0.8, `${Math.round(adherence * 100)}% of sampled pixels lie on the brand palette or between two of its colours`);
  }
  if (expect.maxBytes) {
    const bytes = Buffer.isBuffer(input) ? input.length : fs.statSync(input).size;
    add('byte-budget', bytes <= expect.maxBytes, `${bytes} bytes, budget ${expect.maxBytes}`);
  }
  return { pass: checks.every((c) => c.pass), checks, meta, adherence, hash: await dhash(input) };
}

/**
 * Pixel diff of two images at a common size. Returns the changed share, a
 * per-cell breakdown (to localise defects) and optionally writes a heatmap.
 */
export async function diff(aInput, bInput, { threshold = 0.1, grid = 8, heatmap } = {}) {
  const s = sharp();
  const am = await s(aInput).metadata();
  const w = am.width;
  const h = am.height;
  const bm = await s(bInput).metadata();
  const sizeMismatch = bm.width !== w || bm.height !== h;
  const [a, b] = await Promise.all([s(aInput).ensureAlpha().raw().toBuffer(), s(bInput).resize(w, h, { fit: 'fill' }).ensureAlpha().raw().toBuffer()]);
  const out = Buffer.alloc(w * h * 4);
  const cells = Array.from({ length: grid * grid }, () => ({ changed: 0, total: 0 }));
  let changed = 0;
  const max = threshold * 441.7; // distance across the RGB cube
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const d = Math.hypot(a[i] - b[i], a[i + 1] - b[i + 1], a[i + 2] - b[i + 2]);
      const cell = cells[Math.min(grid - 1, Math.floor((y / h) * grid)) * grid + Math.min(grid - 1, Math.floor((x / w) * grid))];
      cell.total++;
      const grey = (a[i] + a[i + 1] + a[i + 2]) / 3;
      if (d > max) {
        changed++;
        cell.changed++;
        out[i] = 226;
        out[i + 1] = 44;
        out[i + 2] = 60;
      } else {
        out[i] = out[i + 1] = out[i + 2] = 200 + grey * 0.2;
      }
      out[i + 3] = 255;
    }
  }
  if (heatmap) {
    fs.mkdirSync(path.dirname(heatmap), { recursive: true });
    await s(out, { raw: { width: w, height: h, channels: 4 } }).png().toFile(heatmap);
  }
  const regions = cells
    .map((c, i) => ({ row: Math.floor(i / grid), col: i % grid, changed: c.total ? c.changed / c.total : 0 }))
    .filter((c) => c.changed > 0.02)
    .sort((x, y) => y.changed - x.changed);
  return { width: w, height: h, sizeMismatch, other: { width: bm.width, height: bm.height }, changedRatio: changed / (w * h), regions };
}

/** Dominant colours by coarse quantisation. Used for design-reference analysis. */
export async function dominantColors(input, count = 6) {
  const { data } = await raw(input, 64);
  const buckets = new Map();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 40) continue;
    const key = `${data[i] >> 4},${data[i + 1] >> 4},${data[i + 2] >> 4}`;
    const b = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0 };
    b.n++;
    b.r += data[i];
    b.g += data[i + 1];
    b.b += data[i + 2];
    buckets.set(key, b);
  }
  const total = [...buckets.values()].reduce((s, b) => s + b.n, 0) || 1;
  return [...buckets.values()]
    .sort((x, y) => y.n - x.n)
    .slice(0, count)
    .map((b) => ({ hex: rgbToHex([b.r / b.n, b.g / b.n, b.b / b.n]), share: Number((b.n / total).toFixed(3)) }));
}

/**
 * Estimate horizontal bands (sections) of a UI screenshot from row-to-row
 * colour change, as a starting point for a component plan.
 */
export async function layoutBands(input) {
  const s = sharp();
  const meta = await s(input).metadata();
  const H = Math.min(400, meta.height);
  const { data } = await s(input).resize(48, H, { fit: 'fill' }).greyscale().raw().toBuffer({ resolveWithObject: true });
  const rowMean = [];
  for (let y = 0; y < H; y++) {
    let sum = 0;
    for (let x = 0; x < 48; x++) sum += data[y * 48 + x];
    rowMean.push(sum / 48);
  }
  const bands = [];
  let start = 0;
  for (let y = 1; y < H; y++) {
    if (Math.abs(rowMean[y] - rowMean[y - 1]) > 14 && y - start > H * 0.04) {
      bands.push([start, y]);
      start = y;
    }
  }
  bands.push([start, H]);
  const scale = meta.height / H;
  return bands.map(([a, b]) => ({ top: Math.round(a * scale), height: Math.round((b - a) * scale), meanLuma: Math.round(rowMean.slice(a, b).reduce((p, c) => p + c, 0) / (b - a)) }));
}

export { hexToRgb };
