// Font resolution and text-to-outline conversion. Logos and composited
// headlines are shipped as outlines so they render identically everywhere and
// never depend on a font being installed.
import fs from 'node:fs';
import path from 'node:path';
import { CisError, slugify } from './util.mjs';
import { need, resolveDep } from './deps.mjs';

const cache = new Map();

/** Find the font file for a DNA font spec. Supports `npm:<package>` sources (Fontsource layout) and `file:<path>`. */
export function resolveFontFile(spec, weight = 400, { subset = 'latin', root = process.cwd(), ext = 'woff' } = {}) {
  const src = spec.source || '';
  if (src.startsWith('file:')) {
    const f = path.resolve(root, src.slice(5));
    return fs.existsSync(f) ? f : null;
  }
  if (src.startsWith('npm:')) {
    const pkg = src.slice(4);
    const hit = resolveDep(`${pkg}/package.json`);
    if (!hit) return null;
    const dir = path.join(path.dirname(hit.file), 'files');
    const base = slugify(pkg.split('/').pop());
    const weights = [weight, ...(spec.weights || []), 400, 500, 600, 700].filter((w, i, a) => a.indexOf(w) === i);
    for (const w of weights) {
      const f = path.join(dir, `${base}-${subset}-${w}-normal.${ext}`);
      if (fs.existsSync(f)) return f;
    }
  }
  return null;
}

export function loadFont(spec, weight, opts = {}) {
  const file = resolveFontFile(spec, weight, opts);
  if (!file) {
    throw new CisError('E_FONT', `Font files for "${spec.family}" (${spec.source}) were not found. Install the package the DNA names, or point typography.*.source at file:<path-to-font>.`);
  }
  if (cache.has(file)) return cache.get(file);
  const opentype = need('opentype.js', 'vector');
  const buf = fs.readFileSync(file);
  const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  font.__file = file;
  cache.set(file, font);
  return font;
}

/**
 * Convert text to a single SVG path. `tracking` is in em. Returns the path
 * data positioned so (x, y) is the left end of the baseline, plus metrics.
 */
export function textToPath(font, text, { size = 64, tracking = 0, x = 0, y = 0, precision = 2 } = {}) {
  const scale = size / font.unitsPerEm;
  const glyphs = font.stringToGlyphs(text);
  let cursor = x;
  const parts = [];
  let minY = Infinity;
  let maxY = -Infinity;
  glyphs.forEach((g, i) => {
    if (g.index === 0 && text[i] !== ' ') {
      throw new CisError('E_FONT_GLYPH', `"${font.names.fontFamily?.en || 'font'}" has no glyph for "${text[i]}"; the outline would silently drop it.`);
    }
    const p = g.getPath(cursor, y, size);
    const d = p.toPathData(precision);
    if (d) parts.push(d);
    const bb = p.getBoundingBox();
    if (Number.isFinite(bb.y1) && bb.y1 !== bb.y2) {
      minY = Math.min(minY, bb.y1);
      maxY = Math.max(maxY, bb.y2);
    }
    let adv = g.advanceWidth * scale;
    if (i < glyphs.length - 1) adv += font.getKerningValue(g, glyphs[i + 1]) * scale + tracking * size;
    cursor += adv;
  });
  const capGlyph = font.charToGlyph('H');
  const capHeight = (font.tables.os2?.sCapHeight || capGlyph.getMetrics().yMax || font.ascender * 0.7) * scale;
  return {
    d: parts.join(''),
    width: cursor - x,
    capHeight,
    ascent: font.ascender * scale,
    descent: -font.descender * scale,
    top: minY,
    bottom: maxY,
  };
}

/** Base64 @font-face rules so a standalone HTML document (and its PDF) carries its own type. */
export function fontFaceCss(specs, { subsets = ['latin'], root } = {}) {
  const rules = [];
  const missing = [];
  for (const spec of specs) {
    for (const weight of spec.weights || [400, 600]) {
      for (const subset of subsets) {
        const file = resolveFontFile(spec, weight, { subset, root, ext: 'woff2' });
        if (!file || !file.includes(`-${subset}-${weight}-`)) {
          if (subset === subsets[0]) missing.push(`${spec.family} ${weight}`);
          continue;
        }
        const b64 = fs.readFileSync(file).toString('base64');
        rules.push(`@font-face{font-family:"${spec.family}";font-weight:${weight};font-style:normal;font-display:swap;src:url(data:font/woff2;base64,${b64}) format("woff2");}`);
      }
    }
  }
  return { css: rules.join('\n'), missing };
}
