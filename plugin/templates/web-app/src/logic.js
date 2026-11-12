// Pure logic: data shaping, chart geometry, sorting, validation. No DOM, no React.
// Covered by tests/logic.test.mjs (node --test).

/** Deterministic pseudo-random generator so mock data is stable across runs. */
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One day of household energy in 30-minute steps: solar, home use, battery level, grid import. */
export function dayCurve(seed = 1, { peakKw = 4.8, capacityKwh = 13.5, reserve = 0.3 } = {}) {
  const rand = seeded(seed);
  const points = [];
  let level = 0.34;
  for (let i = 0; i < 48; i++) {
    const h = i / 2;
    const sun = Math.max(0, Math.sin(((h - 6) / 13) * Math.PI));
    const solar = h < 6 || h > 19 ? 0 : peakKw * sun ** 1.6 * (0.92 + rand() * 0.12);
    const home = 0.35 + 0.9 * Math.exp(-((h - 7.5) ** 2) / 2.2) + 2.1 * Math.exp(-((h - 19) ** 2) / 4.5) + rand() * 0.15;
    const surplus = solar - home;
    let delta = (surplus * 0.5) / capacityKwh; // half-hour step
    if (delta < 0 && level + delta < reserve) delta = Math.min(0, reserve - level);
    level = Math.max(0, Math.min(1, level + delta));
    const grid = Math.max(0, -surplus - Math.max(0, -delta * capacityKwh * 2));
    points.push({ h, solar: round(solar), home: round(home), battery: round(level, 3), grid: round(grid) });
  }
  return points;
}

export const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

export function totals(points) {
  const kwh = (k) => round(points.reduce((s, p) => s + p[k] * 0.5, 0), 1);
  const solar = kwh('solar');
  const home = kwh('home');
  const grid = kwh('grid');
  return { solar, home, grid, selfPowered: home ? Math.round(Math.max(0, 1 - grid / home) * 100) : 0 };
}

/** Map data to SVG coordinates. Time always runs left to right, in every locale. */
export function scalePoints(points, key, { width, height, pad = 0, max }) {
  const top = max ?? Math.max(...points.map((p) => p[key]), 0.001);
  return points.map((p) => [pad + (p.h / 23.5) * (width - pad * 2), height - pad - (p[key] / top) * (height - pad * 2)]);
}

export function linePath(xy) {
  return xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');
}

export function areaPath(xy, baseline) {
  if (!xy.length) return '';
  return `${linePath(xy)}L${xy.at(-1)[0].toFixed(1)} ${baseline}L${xy[0][0].toFixed(1)} ${baseline}Z`;
}

/** Position on the day arc for an hour (06:00 at the left end, 20:00 at the right). */
export function arcPoint(hour, { cx, cy, rx, ry }) {
  const p = Math.max(0, Math.min(1, (hour - 6) / 14));
  const a = Math.PI * (1 - p);
  return { x: cx + rx * Math.cos(a), y: cy - ry * Math.sin(a), daylight: hour >= 6 && hour <= 20 };
}

export function history(days = 30, seed = 7) {
  const rand = seeded(seed);
  return Array.from({ length: days }, (_, i) => {
    const solar = round(8 + rand() * 22, 1);
    const used = round(11 + rand() * 9, 1);
    const grid = round(Math.max(0, used - solar * (0.55 + rand() * 0.3)), 1);
    return { id: i + 1, date: new Date(Date.UTC(2026, 9, 31 - i)).toISOString().slice(0, 10), solar, used, grid, selfPowered: Math.round(Math.max(0, 1 - grid / used) * 100) };
  });
}

export function sortRows(rows, key, dir) {
  const m = dir === 'descending' ? -1 : 1;
  return [...rows].sort((a, b) => (a[key] > b[key] ? 1 : a[key] < b[key] ? -1 : 0) * m);
}

export function paginate(rows, page, size) {
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(Math.max(1, page), pages);
  return { rows: rows.slice((current - 1) * size, current * size), page: current, pages, total: rows.length };
}

export function filterRows(rows, query) {
  const q = query.trim();
  return q ? rows.filter((r) => r.date.includes(q)) : rows;
}

export function validateSettings(s) {
  const errors = {};
  if (!Number.isFinite(s.reserve) || s.reserve < 10 || s.reserve > 100) errors.reserve = 'range';
  if (s.alerts && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((s.email || '').trim())) errors.email = s.email ? 'format' : 'required';
  return errors;
}

export function formatNumber(n, locale, digits = 1) {
  // Latin digits in Arabic too: the Experience DNA sets numerals to "latin".
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-u-nu-latn' : locale, { maximumFractionDigits: digits }).format(n);
}

export const clock = (h) => `${String(Math.floor(h)).padStart(2, '0')}:${h % 1 ? '30' : '00'}`;
