// Shared zero-dependency helpers for the Creative Intelligence Studio CLI.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const CIS_VERSION = JSON.parse(fs.readFileSync(path.join(PLUGIN_ROOT, '.claude-plugin', 'plugin.json'), 'utf8')).version;

/** Error with a stable machine-readable code and a process exit code. */
export class CisError extends Error {
  constructor(code, message, { exit = 1, details } = {}) {
    super(message);
    this.code = code;
    this.exit = exit;
    this.details = details;
  }
}

export const EXIT = { OK: 0, FAIL: 1, USAGE: 2, BLOCKED: 3, MISSING_DEP: 4 };

export function readJson(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (e) {
    throw new CisError('E_READ', `Cannot read ${file}: ${e.code || e.message}`);
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new CisError('E_JSON', `Invalid JSON in ${file}: ${e.message}`);
  }
}

/** Atomic write: a crash mid-write never leaves a truncated state file. */
export function writeFileAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
}

export function writeJson(file, value) {
  writeFileAtomic(file, JSON.stringify(value, null, 2) + '\n');
}

export function exists(p) {
  return fs.existsSync(p);
}

export function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export function sha256File(file) {
  return sha256(fs.readFileSync(file));
}

export function nowIso() {
  // CIS_FIXED_TIME makes ledgers and manifests reproducible in tests.
  return process.env.CIS_FIXED_TIME || new Date().toISOString();
}

export function slugify(s) {
  return String(s)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

/**
 * Resolve `rel` inside `root` and refuse anything that escapes it.
 * Every path that comes from a brief, a content file, or a CLI flag goes through here.
 */
export function safeJoin(root, rel) {
  if (typeof rel !== 'string' || rel.includes('\0')) throw new CisError('E_PATH', 'Invalid path value');
  const base = path.resolve(root);
  const target = path.resolve(base, rel);
  if (target !== base && !target.startsWith(base + path.sep)) {
    throw new CisError('E_PATH_TRAVERSAL', `Path escapes project root: ${rel}`);
  }
  return target;
}

export function walk(dir, { ignore = [] } = {}) {
  const out = [];
  const skip = new Set(['node_modules', '.git', ...ignore]);
  (function rec(d) {
    let entries;
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (skip.has(e.name)) continue;
      const p = path.join(d, e.name);
      if (e.isSymbolicLink()) continue; // never follow links out of the tree
      if (e.isDirectory()) rec(p);
      else if (e.isFile()) out.push(p);
    }
  })(dir);
  return out.sort();
}

export function copyDir(src, dest, { filter = () => true } = {}) {
  for (const file of walk(src)) {
    const rel = path.relative(src, file);
    if (!filter(rel)) continue;
    const target = path.join(dest, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(file, target);
  }
}

/** Deterministic PRNG (mulberry32) so generated assets are reproducible from a seed. */
export function rng(seed) {
  let a = typeof seed === 'number' ? seed >>> 0 : parseInt(sha256(String(seed)).slice(0, 8), 16);
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- secrets ----

const SECRET_PATTERNS = [
  ['openai-key', /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g],
  ['anthropic-key', /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g],
  ['aws-access-key', /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g],
  ['github-token', /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g],
  ['google-api-key', /\bAIza[0-9A-Za-z_-]{35}\b/g],
  ['slack-token', /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g],
  ['stripe-key', /\b[sr]k_live_[0-9A-Za-z]{20,}\b/g],
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA |)PRIVATE KEY-----/g],
  ['bearer-token', /\bBearer\s+[A-Za-z0-9._~+/-]{24,}=*/g],
  ['assigned-secret', /\b(?:api[_-]?key|secret|token|password|passwd)\b\s*[:=]\s*["']([^"'\s]{12,})["']/gi],
];

/** Find secret-shaped strings. Returns matches with the value already masked. */
export function findSecrets(text) {
  const hits = [];
  for (const [kind, rx] of SECRET_PATTERNS) {
    rx.lastIndex = 0;
    let m;
    while ((m = rx.exec(text))) {
      const value = m[1] || m[0];
      // Obvious placeholders are not findings.
      if (/^(?:x{6,}|your[_-]|example|changeme|placeholder|<|\$\{)/i.test(value)) continue;
      const line = text.slice(0, m.index).split('\n').length;
      hits.push({ kind, line, masked: mask(value) });
    }
  }
  return hits;
}

function mask(v) {
  return v.length <= 8 ? '****' : `${v.slice(0, 4)}…${v.slice(-2)} (${v.length} chars)`;
}

/** Redact secrets before anything is logged or written to a ledger. */
export function redact(text) {
  let out = String(text);
  for (const [, rx] of SECRET_PATTERNS) {
    rx.lastIndex = 0;
    out = out.replace(rx, (m, g1) => (g1 ? m.replace(g1, '[REDACTED]') : '[REDACTED]'));
  }
  return out;
}

// ------------------------------------------------------------------ color ----

export function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) throw new CisError('E_COLOR', `Not a hex colour: ${hex}`);
  let h = m[1];
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

export function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

function srgbToLinear(c) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(v) {
  const c = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
  return c * 255;
}

export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(srgbToLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio between two opaque colours. */
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** sRGB hex -> OKLCH {l, c, h}. Used for perceptual palette distance and ramp generation. */
export function hexToOklch(hex) {
  const [r, g, b] = hexToRgb(hex).map(srgbToLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const c = Math.hypot(A, B);
  let h = (Math.atan2(B, A) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l: L, c, h };
}

export function oklchToHex({ l, c, h }) {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const r = 4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_;
  const g = -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_;
  const bl = -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_;
  return rgbToHex([r, g, bl].map((v) => linearToSrgb(Math.max(0, Math.min(1, v)))));
}

/** Perceptual distance in OKLab (0 = identical, ~0.02 = just noticeable, 1 = black vs white). */
export function colorDistance(a, b) {
  const p = hexToOklch(a);
  const q = hexToOklch(b);
  const ax = p.c * Math.cos((p.h * Math.PI) / 180);
  const ay = p.c * Math.sin((p.h * Math.PI) / 180);
  const bx = q.c * Math.cos((q.h * Math.PI) / 180);
  const by = q.c * Math.sin((q.h * Math.PI) / 180);
  return Math.hypot(p.l - q.l, ax - bx, ay - by);
}

/**
 * True when a colour is a palette colour or lies between two of them
 * (a gradient stop or tint), measured in OKLab.
 */
export function nearPalette(hex, palette, tolerance = 0.05) {
  const lab = (h) => {
    const o = hexToOklch(h);
    return [o.l, o.c * Math.cos((o.h * Math.PI) / 180), o.c * Math.sin((o.h * Math.PI) / 180)];
  };
  const p = lab(hex);
  const pts = palette.map(lab);
  for (let i = 0; i < pts.length; i++) {
    for (let j = i; j < pts.length; j++) {
      const a = pts[i];
      const b = pts[j];
      const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const ap = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
      const len = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2;
      const t = len ? Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / len)) : 0;
      if (Math.hypot(ap[0] - t * ab[0], ap[1] - t * ab[1], ap[2] - t * ab[2]) <= tolerance) return true;
    }
  }
  return false;
}

export function mix(a, b, t) {
  const p = hexToRgb(a);
  const q = hexToRgb(b);
  return rgbToHex(p.map((v, i) => v + (q[i] - v) * t));
}

// ---------------------------------------------------------------- output -----

export function print(line = '') {
  process.stdout.write(line + '\n');
}

export function table(rows, headers) {
  const all = headers ? [headers, ...rows] : rows;
  const widths = [];
  for (const r of all) r.forEach((c, i) => (widths[i] = Math.max(widths[i] || 0, String(c ?? '').length)));
  const fmt = (r) => r.map((c, i) => String(c ?? '').padEnd(widths[i])).join('  ').trimEnd();
  const lines = all.map(fmt);
  if (headers) lines.splice(1, 0, widths.map((w) => '-'.repeat(w)).join('  '));
  return lines.join('\n');
}

export function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}
