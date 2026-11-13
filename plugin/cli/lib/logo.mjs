// Parametric logo construction. Every mark is built from filled paths (no
// strokes, no live text, no raster) so the SVG is a true editable vector
// master, and its one-colour version is the same geometry with holes.
import { CisError, nearPalette } from './util.mjs';

const f = (n) => Number(n.toFixed(3));
const pt = (cx, cy, r, deg) => [f(cx + r * Math.cos((deg * Math.PI) / 180)), f(cy - r * Math.sin((deg * Math.PI) / 180))];

function roundedRect(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  return `M${f(x + r)} ${f(y)}H${f(x + w - r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + w)} ${f(y + r)}V${f(y + h - r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + w - r)} ${f(y + h)}H${f(x + r)}A${f(r)} ${f(r)} 0 0 1 ${f(x)} ${f(y + h - r)}V${f(y + r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + r)} ${f(y)}Z`;
}

function circle(cx, cy, r) {
  return `M${f(cx - r)} ${f(cy)}A${f(r)} ${f(r)} 0 1 0 ${f(cx + r)} ${f(cy)}A${f(r)} ${f(r)} 0 1 0 ${f(cx - r)} ${f(cy)}Z`;
}

/** A band following a circular arc from angle a0 to a1 (degrees, counter-clockwise, a0 > a1), with round ends. */
function arcBand(cx, cy, r, w, a0, a1) {
  const ro = r + w / 2;
  const ri = r - w / 2;
  const large = Math.abs(a0 - a1) > 180 ? 1 : 0;
  const [ox0, oy0] = pt(cx, cy, ro, a0);
  const [ox1, oy1] = pt(cx, cy, ro, a1);
  const [ix1, iy1] = pt(cx, cy, ri, a1);
  const [ix0, iy0] = pt(cx, cy, ri, a0);
  const c = f(w / 2);
  return `M${ox0} ${oy0}A${f(ro)} ${f(ro)} 0 ${large} 1 ${ox1} ${oy1}A${c} ${c} 0 0 1 ${ix1} ${iy1}A${f(ri)} ${f(ri)} 0 ${large} 0 ${ix0} ${iy0}A${c} ${c} 0 0 1 ${ox0} ${oy0}Z`;
}

function capsule(x, y, w, h) {
  return roundedRect(x, y, w, h, h / 2);
}

// Each generator draws inside a 64x64 box and returns:
//   body:  paths filled with the primary colour
//   holes: shapes cut out of the body (even-odd)
//   accent: shapes filled with the accent colour (become holes in one-colour marks)
const SYMBOLS = {
  /**
   * A sun on its arc, the arc standing on a horizon, inside a cell. The arc is continuous and the
   * sun sits on it; the horizon runs well past the arc's feet, so the mark reads as a sunrise over
   * land rather than a dome on a plate.
   */
  arc({ corner = 0.28, sunAngle = 122, weight = 5.2, radius = 15.5, sun = 5.4 }) {
    const cx = 32;
    const cy = 39;
    const holes = [arcBand(cx, cy, radius, weight, 180, 0)];
    const reach = radius + weight / 2 + 7.5;
    // The horizon starts just above the arc's feet, so their rounded ends are inside it, not above it.
    holes.push(capsule(cx - reach, cy - weight * 0.08, reach * 2, weight * 0.72));
    const [sx, sy] = pt(cx, cy, radius, sunAngle);
    return { body: [roundedRect(4, 4, 56, 56, 56 * corner)], holes, accent: [circle(sx, sy, sun)], description: 'A sun on its arc, the arc standing on a horizon, held inside a rounded cell.' };
  },
  /** Ring segments around a core. */
  orbit({ weight = 4.6, turn = 28 }) {
    const holes = [arcBand(32, 32, 19, weight, 80 + turn, -200 + turn), arcBand(32, 32, 10.5, weight, 250 + turn, 10 + turn)];
    const [sx, sy] = pt(32, 32, 19, 115 + turn);
    return { body: [circle(32, 32, 28)], holes, accent: [circle(sx, sy, 4.2)], description: 'Two open orbits around a centre with a single body in motion.' };
  },
  /** Stacked layers. */
  strata({ weight = 6, corner = 0.22 }) {
    const rows = [[14, 36], [14, 28], [14, 20]];
    const holes = rows.map(([x, w], i) => capsule(x, 17 + i * (weight + 5.2), w, weight));
    return { body: [roundedRect(4, 4, 56, 56, 56 * corner)], holes: holes.slice(0, 2), accent: [holes[2]], description: 'Three layers of decreasing length: stored, steady, accumulated.' };
  },
  /** A matrix with one active unit. */
  grid({ corner = 0.2, dot = 4.6, active = 2 }) {
    const cells = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) cells.push(circle(18 + c * 14, 18 + r * 14, dot));
    return { body: [roundedRect(4, 4, 56, 56, 56 * corner)], holes: cells.filter((_, i) => i !== active), accent: [cells[active]], description: 'A nine-unit matrix with one unit lit.' };
  },
  /** Nested contours. */
  contour({ weight = 4.4 }) {
    const holes = [arcBand(32, 34, 20, weight, 205, -25), arcBand(32, 34, 11.5, weight, 205, -25)];
    return { body: [circle(32, 32, 28)], holes, accent: [circle(32, 34, 3.6)], description: 'Concentric contours around a fixed point.' };
  },
};

export function symbolKinds() {
  return Object.keys(SYMBOLS);
}

/** Build a symbol. `monogramPath` (already positioned in the 64 box) supports letter-based marks. */
export function buildSymbol(concept, { monogramPath } = {}) {
  if (concept.kind === 'monogram') {
    if (!monogramPath) throw new CisError('E_LOGO', 'A monogram concept needs an outlined letter (vector engine and font files).');
    const corner = concept.params?.corner ?? 0.5;
    const body = corner >= 0.5 ? [circle(32, 32, 28)] : [roundedRect(4, 4, 56, 56, 56 * corner)];
    return { body, holes: [monogramPath], accent: [], description: `The initial "${concept.letter}" cut from a solid field.` };
  }
  const gen = SYMBOLS[concept.motif];
  if (!gen) throw new CisError('E_LOGO', `Unknown symbol motif "${concept.motif}". Known: ${symbolKinds().join(', ')}`);
  return gen(concept.params || {});
}

/** Inner SVG markup for a symbol at (x, y) scaled to `size`. `mono` renders the accent as a hole. */
export function symbolMarkup(sym, { x = 0, y = 0, size = 64, primary, accent, mono = false }) {
  const t = x || y || size !== 64 ? ` transform="translate(${f(x)} ${f(y)}) scale(${f(size / 64)})"` : '';
  const holes = mono ? [...sym.holes, ...sym.accent] : sym.holes;
  let out = `<path${t} fill="${primary}" fill-rule="evenodd" d="${[...sym.body, ...holes].join('')}"/>`;
  if (!mono && sym.accent.length) out += `<path${t} fill="${accent}" d="${sym.accent.join('')}"/>`;
  return out;
}

/**
 * The symbol as a full-bleed icon: the cell's colour fills the whole square and the arc, horizon and
 * sun are scaled to it. Platforms apply their own corner mask, so the master has no tile of its own.
 */
export function iconMarkup(sym, { size, field, knockout, accent }) {
  const s = size / 56;
  const t = ` transform="translate(${f(-4 * s)} ${f(-4 * s)}) scale(${f(s)})"`;
  return `<path fill="${field}" d="M0 0H${size}V${size}H0Z"/><path${t} fill="${knockout}" d="${sym.holes.join('')}"/><path${t} fill="${accent}" d="${sym.accent.join('')}"/>`;
}

export function svgDoc({ w, h, title, desc, body, bg, lang }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f(w)} ${f(h)}" width="${f(w)}" height="${f(h)}" role="img"${lang ? ` xml:lang="${lang}"` : ''}><title>${escapeXml(title)}</title>${desc ? `<desc>${escapeXml(desc)}</desc>` : ''}${bg ? `<path fill="${bg}" d="M0 0H${f(w)}V${f(h)}H0Z"/>` : ''}${body}</svg>\n`;
}

export function escapeXml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
}

/**
 * Assemble a lockup. `word` is an outlined wordmark ({d, width, capHeight})
 * set at baseline y=0, x=0. Returns SVG markup and overall size; padding
 * equals the clear space so the file itself enforces it.
 */
export function lockup(sym, word, { layout = 'horizontal', symbolSize = 64, colors, mono = false, clear = 0.5 }) {
  const pad = symbolSize * clear;
  if (layout === 'symbol') {
    const s = symbolSize + pad * 2;
    return { w: s, h: s, body: symbolMarkup(sym, { x: pad, y: pad, size: symbolSize, primary: colors.primary, accent: colors.accent, mono }) };
  }
  if (layout === 'wordmark') {
    const wpad = word.capHeight * 0.75;
    return { w: word.width + wpad * 2, h: word.capHeight + wpad * 2, body: `<path fill="${colors.text}" transform="translate(${f(wpad)} ${f(wpad + word.capHeight)})" d="${word.d}"/>` };
  }
  if (layout === 'stacked') {
    const gap = symbolSize * 0.3;
    const w = Math.max(symbolSize, word.width) + pad * 2;
    const h = symbolSize + gap + word.capHeight + pad * 2;
    return {
      w,
      h,
      body:
        symbolMarkup(sym, { x: (w - symbolSize) / 2, y: pad, size: symbolSize, primary: colors.primary, accent: colors.accent, mono }) +
        `<path fill="${colors.text}" transform="translate(${f((w - word.width) / 2)} ${f(pad + symbolSize + gap + word.capHeight)})" d="${word.d}"/>`,
    };
  }
  const gap = symbolSize * 0.34;
  const w = pad * 2 + symbolSize + gap + word.width;
  const h = symbolSize + pad * 2;
  const baseline = pad + symbolSize / 2 + word.capHeight / 2; // optical centre on cap height
  return {
    w,
    h,
    body:
      symbolMarkup(sym, { x: pad, y: pad, size: symbolSize, primary: colors.primary, accent: colors.accent, mono }) +
      `<path fill="${colors.text}" transform="translate(${f(pad + symbolSize + gap)} ${f(baseline)})" d="${word.d}"/>`,
  };
}

/**
 * Integrity checks for a vector master. A logo that fails these is not
 * delivered as "editable vector".
 */
export function inspectSvg(svg, { allowedColors = null, allowText = false, allowStroke = false, allowBlends = false } = {}) {
  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass, ...(detail ? { detail } : {}) });
  add('has-viewbox', /<svg[^>]*\sviewBox="[\d.\s-]+"/.test(svg));
  add('no-raster-image', !/<image\b|data:image\//.test(svg));
  add('no-live-text', allowText || !/<text\b|<tspan\b/.test(svg), allowText ? 'text allowed for this asset' : undefined);
  add('no-foreign-object', !/<foreignObject\b/.test(svg));
  add('no-external-reference', !/(?:href|src)\s*=\s*"(?!#)[^"]+"/.test(svg) && !/url\(\s*['"]?https?:/.test(svg));
  add('no-script', !/<script\b|\son[a-z]+\s*=/.test(svg));
  add('no-nan', !/NaN|Infinity|undefined/.test(svg));
  const paths = (svg.match(/<path\b/g) || []).length;
  add('has-geometry', paths > 0, `${paths} path(s)`);
  if (!allowStroke) add('fills-only', !/\sstroke="(?!none)/.test(svg));
  const fills = [...svg.matchAll(/(?:fill|stroke|stop-color)="(#[0-9a-fA-F]{3,8})"/g)].map((m) => m[1].toLowerCase());
  if (allowedColors) {
    const allowed = new Set(allowedColors.map((c) => c.toLowerCase()));
    // Compositions may use gradient stops between two palette colours; logo masters may not.
    const off = [...new Set(fills.filter((c) => !allowed.has(c) && !(allowBlends && nearPalette(c, allowedColors))))];
    add('colours-from-dna', off.length === 0, off.length ? `off-palette: ${off.join(', ')}` : `${new Set(fills).size} colour(s)`);
  }
  return { pass: checks.every((c) => c.pass), checks, paths, colors: [...new Set(fills)] };
}
