// Brand identity production: logo concepts, the selected logo system in every
// variant, icon family, applications, guidelines and a verified manifest.
import fs from 'node:fs';
import path from 'node:path';
import { CisError, EXIT, readJson, writeJson, writeFileAtomic, exists, print, table, slugify, contrast, hexToRgb, hexToOklch, nowIso, fmtBytes, sha256File } from '../lib/util.mjs';
import { assertValid } from '../lib/schema.mjs';
import { requireProject, paths, appendEvent, loadBrief } from '../lib/project.mjs';
import { loadDna } from '../lib/dna.mjs';
import { loadFont, textToPath, fontFaceCss } from '../lib/fonts.mjs';
import { buildSymbol, symbolMarkup, lockup, svgDoc, inspectSvg, escapeXml } from '../lib/logo.mjs';
import { iconNames, iconSvg, iconSet } from '../lib/icons.mjs';
import { renderSvg, horizonSun } from '../lib/imagegen.mjs';
import { hasCapability, need } from '../lib/deps.mjs';
import { registerAsset, fileEntry } from '../lib/assets.mjs';

const json = (flags, value) => (flags.json ? (print(JSON.stringify(value, null, 2)), true) : false);
const f = (n) => Number(n.toFixed(2));

function optimise(svg) {
  if (!hasCapability('vector')) return svg;
  const { optimize } = need('svgo', 'vector');
  // SVGO 4's default preset already keeps viewBox and title; desc is kept explicitly.
  // All three are part of an accessible, scalable master.
  const res = optimize(svg, { multipass: true, plugins: [{ name: 'preset-default', params: { overrides: { removeDesc: false, convertPathData: { floatPrecision: 2 } } } }] });
  return res.data + '\n';
}

export function loadBrandSpec(root) {
  const file = path.join(paths(root).cis, 'brand-spec.json');
  if (!exists(file)) throw new CisError('E_NO_BRAND_SPEC', 'No brand spec. Author .cis/brand-spec.json (see the brand-identity skill).');
  return assertValid('brand-spec', readJson(file), 'Brand spec');
}

/** Outline helpers bound to the project's fonts. */
function typeSetter(dna) {
  const fonts = {};
  return function set(role, text, { size, weight = 400, x = 0, y = 0, fill, anchor = 'start', tracking = 0 }) {
    const key = `${role}:${weight}`;
    fonts[key] ||= loadFont(dna.typography[role], weight);
    const p = textToPath(fonts[key], text, { size, tracking });
    const dx = anchor === 'middle' ? -p.width / 2 : anchor === 'end' ? -p.width : 0;
    return { markup: `<path fill="${fill}" transform="translate(${f(x + dx)} ${f(y)})" d="${p.d}"/>`, width: p.width, capHeight: p.capHeight };
  };
}

export function buildMarks(dna, spec) {
  const font = loadFont(dna.typography[spec.wordmark.font || 'display'], spec.wordmark.weight);
  const word = textToPath(font, spec.wordmark.text, { size: 40, tracking: spec.wordmark.tracking ?? 0 });
  const symbols = {};
  for (const c of spec.concepts) {
    let monogramPath;
    if (c.kind === 'monogram') {
      const g = textToPath(font, c.letter, { size: 38 });
      const p = textToPath(font, c.letter, { size: 38, x: 32 - g.width / 2, y: 32 + g.capHeight / 2 });
      monogramPath = p.d;
    }
    symbols[c.id] = buildSymbol(c, { monogramPath });
  }
  return { word, symbols, font };
}

function schemes(dna) {
  const l = dna.color.semantic.light;
  const d = dna.color.semantic.dark;
  return {
    color: { colors: { primary: l.primary, accent: l.accent, text: l.text }, bg: null, mono: false, on: l.bg },
    reversed: { colors: { primary: d.primary, accent: d.text, text: d.text }, bg: null, mono: false, on: d.bg },
    'mono-ink': { colors: { primary: l.text, accent: l.text, text: l.text }, bg: null, mono: true, on: l.bg },
    'mono-paper': { colors: { primary: d.text, accent: d.text, text: d.text }, bg: null, mono: true, on: d.bg },
  };
}

function applications(dna, spec, marks, slug, T) {
  const sym = marks.symbols[spec.selected];
  const l = dna.color.semantic.light;
  const d = dna.color.semantic.dark;
  const name = spec.wordmark.text;
  const out = {};
  const headline = spec.headline || dna.identity.tagline || name;
  const lock = (colors, size, mono = false) => lockup(sym, marks.word, { layout: 'horizontal', symbolSize: size, colors, mono, clear: 0 });
  const bgArt = (recipe, w, h, variant, seed, clear, sunAt) => {
    const r = renderSvg({ id: `app-${seed}`, recipe, width: w, height: h, variant, seed, clear, sunAt }, dna);
    return r.svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  };
  const wrapHeadline = (text, maxChars) => {
    const lines = [''];
    for (const w of text.split(' ')) {
      if ((lines.at(-1) + ' ' + w).trim().length > maxChars) lines.push(w);
      else lines[lines.length - 1] = (lines.at(-1) + ' ' + w).trim();
    }
    return lines;
  };
  /**
   * Break a headline so no line is left with a single stray word: use one line fewer when the
   * text fits, then choose the breaks whose longest and shortest lines differ least.
   */
  const balance = (text, maxChars) => {
    const words = text.split(' ');
    const greedy = wrapHeadline(text, maxChars);
    const limit = maxChars + 3;
    const best = (count) => {
      let found = null;
      let score = Infinity;
      const walk = (start, left, acc) => {
        if (left === 1) {
          const line = words.slice(start).join(' ');
          if (!line || line.length > limit) return;
          const lens = [...acc, line].map((x) => x.length);
          const sc = Math.max(...lens) - Math.min(...lens);
          if (sc < score) [score, found] = [sc, [...acc, line]];
          return;
        }
        for (let end = start + 1; end <= words.length - (left - 1); end++) {
          const line = words.slice(start, end).join(' ');
          if (line.length > limit) break;
          walk(end, left - 1, [...acc, line]);
        }
      };
      walk(0, count, []);
      return found;
    };
    return (greedy.length > 1 && best(greedy.length - 1)) || best(greedy.length) || greedy;
  };
  const want = (k) => spec.applications.includes(k);

  if (want('business-card')) {
    // 85x55mm with 3mm bleed; 10 units per mm. Crop marks sit outside the trim box.
    const S = 10;
    const B = 3 * S;
    const W = 85 * S + B * 2;
    const H = 55 * S + B * 2;
    const marksSvg = [[B, B], [W - B, B], [B, H - B], [W - B, H - B]]
      .map(([x, y]) => `<path stroke="${l.text}" stroke-width="1.2" fill="none" d="M${x} ${y < H / 2 ? 0 : H}V${y < H / 2 ? B - 8 : H - B + 8}M${x < W / 2 ? 0 : W} ${y}H${x < W / 2 ? B - 8 : W - B + 8}"/>`)
      .join('');
    const lk = lock({ primary: d.primary, accent: d.text, text: d.text }, 110);
    const front = `<path fill="${d.bg}" d="M0 0H${W}V${H}H0Z"/><g transform="translate(${f((W - lk.w) / 2)} ${f((H - lk.h) / 2)})">${lk.body}</g>`;
    const c = spec.contact || {};
    const rows = [[c.name || 'Name Surname', 'display', 600, 34, l.text], [c.title || 'Role', 'text', 400, 20, l.textMuted], ['', 'text', 400, 12, l.text], [c.email || 'name@example.com', 'text', 400, 19, l.text], [c.phone || '', 'text', 400, 19, l.text], [c.web || '', 'text', 400, 19, l.text]];
    let y = B + 150;
    let back = `<path fill="${l.surfaceRaised}" d="M0 0H${W}V${H}H0Z"/>` + symbolMarkup(sym, { x: B + 60, y: B + 60, size: 80, primary: l.primary, accent: l.accent });
    for (const [text, role, weight, size, fill] of rows) {
      y += size * 1.55;
      if (text) back += T(role, text, { size, weight, x: B + 60, y, fill }).markup;
    }
    back += `<path fill="${l.accent}" d="M${B + 60} ${H - B - 62}H${W - B - 60}V${H - B - 56}H${B + 60}Z"/>`;
    out['business-card-front'] = { svg: svgDoc({ w: W, h: H, title: `${name} business card, front`, body: front + marksSvg }), mm: [91, 61], note: '85 x 55 mm trim, 3 mm bleed, crop marks' };
    out['business-card-back'] = { svg: svgDoc({ w: W, h: H, title: `${name} business card, back`, body: back + marksSvg }), mm: [91, 61], note: '85 x 55 mm trim, 3 mm bleed, crop marks' };
  }
  const poster = (key, w, h, variant, recipe, opts = {}) => {
    const dark = ['dusk', 'night', 'dawn'].includes(variant);
    const ink = dark ? d.text : l.text;
    const lk = lock(dark ? { primary: d.primary, accent: d.text, text: d.text } : { primary: l.primary, accent: l.accent, text: l.text }, Math.round(w * 0.06));
    const size = Math.round(w * (opts.type || 0.078));
    const m = Math.round(w * 0.075);
    const lines = balance(headline, opts.wrap || 16);
    const lh = size * 1.06;
    const set = (line, y) => T('display', line, { size, weight: spec.wordmark.weight, x: m, y, fill: ink, tracking: dna.typography.scale.displayTracking ?? 0 });
    const widest = Math.max(...lines.map((line) => set(line, 0).width));
    let top = opts.top ?? h * 0.34;
    if (recipe === 'horizon-field') {
      // Text has right of way: if the sun would sit under the headline, the block moves up clear of its halo.
      const sun = horizonSun(w, h, variant, opts.sunAt);
      const overlapsX = sun.x - sun.halo < m + widest + size * 0.3;
      const lowest = sun.y - sun.halo - size * 0.55;
      if (overlapsX && top + (lines.length - 1) * lh > lowest) top = Math.max(m + lk.h + size * 1.25, lowest - (lines.length - 1) * lh);
    }
    // The artwork keeps its arc and stars out of the rectangle the headline occupies.
    const clear = { x: m - size * 0.35, y: top - size * 1.0, w: widest + size * 0.7, h: (lines.length - 1) * lh + size * 1.4 };
    let body = bgArt(recipe, w, h, variant, key, clear, opts.sunAt) + `<g transform="translate(${m} ${m})">${lk.body}</g>`;
    lines.forEach((line, i) => {
      body += set(line, top + i * lh).markup;
    });
    out[key] = { svg: svgDoc({ w, h, title: `${name}: ${headline}`, body }), px: [w, h] };
  };
  if (want('social-square')) poster('social-square', 1080, 1080, 'dusk', 'horizon-field', { top: 380 });
  if (want('og-image')) poster('og-image', 1200, 630, 'noon', 'horizon-field', { type: 0.062, wrap: 22, top: 250 });
  if (want('story')) poster('story', 1080, 1920, 'dawn', 'horizon-field', { type: 0.1, wrap: 12, top: 560 });
  if (want('presentation-title')) poster('presentation-title', 1920, 1080, 'night', 'horizon-field', { type: 0.06, wrap: 20, top: 420 });
  if (want('app-icon')) {
    const body = `<path fill="${d.bg}" d="M0 0H1024V1024H0Z"/>` + symbolMarkup(sym, { x: 172, y: 172, size: 680, primary: d.primary, accent: d.text });
    out['app-icon'] = { svg: svgDoc({ w: 1024, h: 1024, title: `${name} app icon`, body }), px: [1024, 1024], note: 'Full-bleed square; platforms apply their own mask' };
  }
  return out;
}

function guidelinesHtml({ dna, spec, brief, marks, slug, files, appKeys, iconNamesList, fontCss, checks }) {
  const l = dna.color.semantic.light;
  const d = dna.color.semantic.dark;
  const e = escapeXml;
  // Every inlined SVG gets its own id namespace. Optimised files reuse short ids ("a", "b"), and in one
  // HTML document every url(#a) would otherwise resolve to the first file's gradient.
  let inlined = 0;
  const read = (rel) => {
    const ns = `s${++inlined}-`;
    return fs
      .readFileSync(files[rel], 'utf8')
      .replace(/<\?xml[^>]*>/, '')
      .replace(/\bid="([^"]+)"/g, (_, id) => `id="${ns}${id}"`)
      .replace(/url\(#([^)]+)\)/g, (_, id) => `url(#${ns}${id})`)
      .replace(/(xlink:href|href)="#([^"]+)"/g, (_, attr, id) => `${attr}="#${ns}${id}"`);
  };
  // Applications laid out by shape, so a tall story never leaves a hole beside it.
  const aspect = (k) => {
    const m = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(fs.readFileSync(files[`applications/${k}.svg`], 'utf8'));
    return m ? Number(m[1]) / Number(m[2]) : 1;
  };
  const appFigure = (k) => `<figure${aspect(k) < 0.8 ? ' class="tall"' : ''}>${read(`applications/${k}.svg`)}<figcaption>${k}</figcaption></figure>`;
  const pal = Object.entries(dna.color.palette);
  const sw = pal
    .map(([k, c]) => {
      const [r, g, b] = hexToRgb(c.hex);
      const o = hexToOklch(c.hex);
      const ink = contrast(c.hex, '#ffffff') > contrast(c.hex, '#000000') ? '#ffffff' : '#000000';
      return `<li style="background:${c.hex};color:${ink}"><b>${e(c.name || k)}</b><span>${e(c.role)}</span><code>${c.hex.toUpperCase()}</code><code>RGB ${r} ${g} ${b}</code><code>OKLCH ${o.l.toFixed(2)} ${o.c.toFixed(3)} ${Math.round(o.h)}</code></li>`;
    })
    .join('');
  const pairs = [['text', 'bg'], ['textMuted', 'bg'], ['text', 'surface'], ['onPrimary', 'primary'], ['onAccent', 'accent'], ['primary', 'bg'], ['focus', 'bg']];
  const ctable = ['light', 'dark']
    .map((s) => pairs.map(([a, b]) => `<tr><td>${s}</td><td><span class="chip" style="background:${dna.color.semantic[s][b]};color:${dna.color.semantic[s][a]}">${a} on ${b}</span></td><td>${contrast(dna.color.semantic[s][a], dna.color.semantic[s][b]).toFixed(2)}:1</td></tr>`).join(''))
    .join('');
  const sym = marks.symbols[spec.selected];
  const misuse = [
    ['Do not stretch', `<g transform="translate(18 34) scale(1.5 .7)">${symbolMarkup(sym, { primary: l.primary, accent: l.accent })}</g>`],
    ['Do not recolour', symbolMarkup(sym, { x: 34, y: 18, primary: l.danger, accent: l.success })],
    ['Do not rotate', `<g transform="rotate(-18 66 50)">${symbolMarkup(sym, { x: 34, y: 18, primary: l.primary, accent: l.accent })}</g>`],
    ['Do not outline', `<path transform="translate(34 18)" fill="none" stroke="${l.primary}" stroke-width="1.5" d="${sym.body.join('')}"/>`],
  ]
    .map(([label, inner]) => `<figure><svg viewBox="0 0 132 100" role="img" aria-label="${label}"><rect width="132" height="100" fill="${l.surface}"/>${inner}<path d="M8 8L124 92" stroke="${l.danger}" stroke-width="2.5"/></svg><figcaption>${label}</figcaption></figure>`)
    .join('');
  const clear = spec.clearSpace ?? 0.5;
  const ease = Object.entries(dna.motion.easings)
    .map(([k, b]) => `<figure><svg viewBox="-6 -6 112 112" role="img" aria-label="${k} easing curve"><rect x="0" y="0" width="100" height="100" fill="none" stroke="${l.border}"/><path d="M0 100C${b[0] * 100} ${100 - b[1] * 100} ${b[2] * 100} ${100 - b[3] * 100} 100 0" fill="none" stroke="${l.primary}" stroke-width="3"/></svg><figcaption>${k}<br><code>${b.join(', ')}</code></figcaption></figure>`)
    .join('');
  const concepts = spec.concepts
    .map((c) => `<figure class="${c.id === spec.selected ? 'sel' : ''}"><svg viewBox="0 0 64 64" role="img" aria-label="${e(c.title)}">${symbolMarkup(marks.symbols[c.id], { primary: l.primary, accent: l.accent })}</svg><figcaption><b>${e(c.title)}${c.id === spec.selected ? ' (selected)' : ''}</b><br>${e(c.rationale)}</figcaption></figure>`)
    .join('');
  const type = ['display', 'text', 'mono', 'arabic']
    .filter((r) => dna.typography[r])
    .map((r) => {
      const t = dna.typography[r];
      const sample = r === 'arabic' ? 'طاقة بيتك، من شروق الشمس إلى الليل' : r === 'mono' ? '06:10  12.4 kWh  98%' : dna.identity.tagline || spec.wordmark.text;
      return `<div class="type"><p class="meta">${r} · ${e(t.family)} · ${e(t.license)} · ${e(t.source)}</p><p ${r === 'arabic' ? 'dir="rtl" lang="ar"' : ''} style="font-family:'${e(t.family)}',${t.fallback};font-size:${r === 'display' ? 54 : r === 'arabic' ? 34 : 26}px;line-height:1.15;margin:0">${e(sample)}</p></div>`;
    })
    .join('');
  // ---- signature device: a construction drawing and its rules -----------------------------
  const sig = spec.signature;
  const arcAt = (W, H, t) => [W / 2 + W * 0.4 * Math.cos(Math.PI * (1 - t)), H * 0.66 - H * 0.5 * Math.sin(Math.PI * (1 - t))];
  const arcDrawing = () => {
    const W = 640;
    const H = 380;
    const hz = H * 0.66;
    const sun = (t, label, r, fill, moon = false) => {
      const [x, y] = arcAt(W, H, t);
      const disc = moon ? `<path transform="translate(${x.toFixed(1)} ${y.toFixed(1)})" fill="${fill}" d="M3 -8A8.6 8.6 0 1 0 8 3A6.6 6.6 0 0 1 3 -8Z"/>` : `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r * 2.2}" fill="${fill}" opacity=".18"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${fill}"/>`;
      return `${disc}<text x="${x.toFixed(1)}" y="${(y - r * 2.2 - 8).toFixed(1)}" text-anchor="middle">${label}</text>`;
    };
    return `<svg class="construct" viewBox="0 0 ${W} ${H}" role="img" aria-label="Construction of ${e(sig.name)}">
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" fill="${l.surfaceRaised}" stroke="${l.border}"/>
<path d="M0 ${hz}H${W}" stroke="${l.text}" stroke-width="1.2"/>
<path d="M${W * 0.1} ${hz}A${W * 0.4} ${H * 0.5} 0 0 1 ${W * 0.9} ${hz}" fill="none" stroke="${l.primary}" stroke-width="2" stroke-dasharray="3 9" stroke-linecap="round"/>
<path d="M${W / 2} ${hz}V${hz - H * 0.5}M${W / 2} ${hz + 26}H${W * 0.9}" stroke="${l.textMuted}" stroke-width="1" stroke-dasharray="2 3" fill="none"/>
<text x="${W / 2 + 8}" y="${hz - H * 0.25}">height 0.50 H</text><text x="${W * 0.7}" y="${hz + 42}" text-anchor="middle">radius 0.40 W</text><text x="10" y="${hz - 8}">horizon at 0.66 H</text>
<text x="${W * 0.1}" y="${hz + 20}" text-anchor="middle">sunrise</text><text x="${W * 0.9}" y="${hz + 20}" text-anchor="middle">sunset</text>
${sun(0.1, 'dawn', 9, l.accent)}${sun(0.5, 'noon', 9, l.accent)}${sun(0.9, 'dusk', 9, l.accent)}
<g transform="translate(${W - 196} ${H - 62})"><rect width="180" height="48" rx="8" fill="${d.bg}"/><path transform="translate(26 24)" fill="${d.text}" d="M3 -8A8.6 8.6 0 1 0 8 3A6.6 6.6 0 0 1 3 -8Z"/><text x="46" y="28" style="fill:${d.text}">night: a crescent</text></g>
</svg>`;
  };
  const signatureSection = sig
    ? `<section><h2>${e(sig.name)}</h2><p class="lede">${e(dna.direction.signature)}</p>${sig.diagram === 'day-arc' ? arcDrawing() : ''}
<div class="two"><div><h3>Rules</h3><ul>${sig.rules.map((r) => `<li>${e(r)}</li>`).join('')}</ul></div>${sig.dont?.length ? `<div><h3>Do not</h3><ul>${sig.dont.map((r) => `<li>${e(r)}</li>`).join('')}</ul></div>` : ''}</div></section>`
    : '';
  const coverArc = sig?.diagram === 'day-arc' ? (() => {
    const [x, y] = arcAt(900, 520, 0.68);
    return `<svg class="cover-arc" viewBox="0 0 900 380" aria-hidden="true"><path d="M90 343A360 260 0 0 1 810 343" fill="none" stroke="${d.text}" stroke-width="2.5" stroke-dasharray="3 12" stroke-linecap="round" opacity=".6"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="44" fill="${d.primary}" opacity=".2"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="20" fill="${d.primary}"/><path d="M0 343H900" stroke="${d.text}" stroke-width="1.5" opacity=".5"/></svg>`;
  })() : '';

  // ---- type scale in use, and the Arabic hierarchy ------------------------------------------
  const sc = dna.typography.scale;
  const px = (n) => Math.round(sc.basePx * sc.ratio ** n);
  const display = `'${e(dna.typography.display.family)}',${dna.typography.display.fallback}`;
  const text = `'${e(dna.typography.text.family)}',${dna.typography.text.fallback}`;
  const mono = dna.typography.mono ? `'${e(dna.typography.mono.family)}',${dna.typography.mono.fallback}` : 'ui-monospace,monospace';
  const sampleLine = dna.identity.tagline || spec.headline || spec.wordmark.text;
  const steps = [['Display', 4, display, spec.wordmark.weight, sc.displayLineHeight ?? 1.05, sampleLine], ['Heading', 3, display, spec.wordmark.weight, 1.1, sampleLine], ['Subheading', 1, display, spec.wordmark.weight, 1.2, sampleLine], ['Lead', 1, text, 400, 1.45, dna.identity.positioning], ['Body', 0, text, 400, sc.textLineHeight ?? 1.55, dna.identity.positioning], ['Small and labels', -1, text, 600, 1.4, 'Usable capacity · Continuous power'], ['Figures', 1, mono, 500, 1.2, '06:10   12.4 kWh   98%']];
  const hierarchy = steps.map(([name, n, fam, weight, lhh, sample]) => `<div class="step"><p class="meta">${name} · ${px(n)}px · weight ${weight} · line height ${lhh}</p><p style="font-family:${fam};font-size:${Math.min(px(n), 56)}px;font-weight:${weight};line-height:${lhh};margin:0;max-width:none">${e(sample)}</p></div>`).join('');
  const ar = spec.arabic;
  const arFam = dna.typography.arabic ? `'${e(dna.typography.arabic.family)}',${dna.typography.arabic.fallback}` : text;
  const arabicSection = ar && dna.typography.arabic
    ? `<section><h2>Arabic typography</h2><p class="lede">Arabic has its own hierarchy. It is not the Latin page mirrored.</p>
<div class="arabic" dir="rtl" lang="ar" style="font-family:${arFam}">
<p class="meta" dir="ltr">Headline · ${px(3)}px · weight 700 · line height 1.25</p><p style="font-size:${Math.min(px(3), 50)}px;font-weight:700;line-height:1.25;margin:0 0 22px">${e(ar.headline)}</p>
${ar.statement ? `<p class="meta" dir="ltr">Statement · ${px(2)}px · weight 600 · line height 1.7</p><p style="font-size:${px(2)}px;font-weight:600;line-height:1.7;margin:0 0 22px;border-inline-start:3px solid ${l.accent};padding-inline-start:16px">${e(ar.statement)}</p>` : ''}
<p class="meta" dir="ltr">Body · ${px(0)}px · weight 400 · line height 1.75</p><p style="font-size:${px(0)}px;font-weight:400;line-height:1.75;margin:0 0 22px;max-width:52ch">${e(ar.body)}</p>
${ar.label ? `<p class="meta" dir="ltr">Label with a figure · ${px(-1)}px · weight 600; the figure stays in the mono face, left to right</p><p style="font-size:${px(-1)}px;font-weight:600;margin:0">${e(ar.label)} <span dir="ltr" style="font-family:${mono};font-weight:500;font-size:${px(1)}px;margin-inline-start:10px">57%</span></p>` : ''}
</div>
<h3>Rules</h3><ul>${ar.rules.map((r) => `<li>${e(r)}</li>`).join('')}</ul>
${ar.lockupRule ? `<h3>The logo in Arabic contexts</h3><div class="plate" dir="rtl" style="justify-content:flex-start;max-width:420px">${read(`logo/${slug}-lockup-horizontal.svg`)}</div><p>${e(ar.lockupRule)}</p>` : ''}</section>`
    : '';

  // ---- layout: grid, spacing and corners ------------------------------------------------------
  const grid = dna.layout.grid;
  const cols = grid.columns;
  const GW = 640;
  const gm = (grid.marginPx / grid.maxWidthPx) * GW * 0.6;
  const gg = (grid.gutterPx / grid.maxWidthPx) * GW;
  const cw = (GW - gm * 2 - gg * (cols - 1)) / cols;
  const gridDrawing = `<svg class="construct" viewBox="0 0 ${GW} 150" role="img" aria-label="${cols}-column grid"><rect x=".5" y=".5" width="${GW - 1}" height="149" fill="${l.surfaceRaised}" stroke="${l.border}"/>${Array.from({ length: cols }, (_, i) => `<rect x="${(gm + i * (cw + gg)).toFixed(1)}" y="12" width="${cw.toFixed(1)}" height="126" fill="${l.primary}" opacity=".14"/>`).join('')}<rect x="${gm.toFixed(1)}" y="30" width="${(cw * 7 + gg * 6).toFixed(1)}" height="34" fill="${l.primary}" opacity=".55"/><rect x="${gm.toFixed(1)}" y="74" width="${(cw * 5 + gg * 4).toFixed(1)}" height="14" fill="${l.text}" opacity=".5"/><rect x="${(gm + (cw + gg) * 7).toFixed(1)}" y="30" width="${(cw * 5 + gg * 4).toFixed(1)}" height="90" rx="6" fill="${l.accent}" opacity=".75"/></svg>`;
  const unit = dna.layout.spacingUnitPx;
  const spaces = [1, 2, 3, 4, 6, 8, 12, 16].map((n) => `<figure><div style="width:${n * unit}px;height:${n * unit}px;background:${l.primary};border-radius:2px"></div><figcaption>${n * unit}px</figcaption></figure>`).join('');
  const radii = Object.entries(dna.layout.radius).map(([k, v]) => `<figure><div style="width:86px;height:58px;border:2px solid ${l.primary};border-radius:${v}px;background:${l.surfaceRaised}"></div><figcaption>${k} · ${v}px</figcaption></figure>`).join('');
  const layoutSection = `<section><h2>Layout</h2><p class="lede">${e(dna.layout.grammar)} grammar, ${e(dna.layout.density)} density.</p>
<h3>Grid</h3>${gridDrawing}<p>${cols} columns, ${grid.gutterPx}px gutters, ${grid.marginPx}px side margins at full width, content never wider than ${grid.maxWidthPx}px. Text blocks span 5 to 7 columns; pictures and data take the rest. On a phone the grid collapses to one column with the margin reduced, and nothing scrolls sideways.</p>
<h3>Spacing</h3><p>Every distance is a multiple of ${unit}px.</p><div class="scale">${spaces}</div>
<h3>Corners</h3><div class="scale">${radii}</div>
<h3>Writing direction</h3><p>Layouts use start and end, never left and right, so they mirror for Arabic without overrides. Three things do not mirror: ${sig ? `${e(sig.name.toLowerCase())}, ` : ''}charts and time controls (time runs left to right), and figures with their units.</p></section>`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${e(spec.wordmark.text)} brand guidelines</title>
<style>
${fontCss}
@page{size:A4;margin:0}*{box-sizing:border-box}
body{margin:0;background:${l.bg};color:${l.text};font:16px/1.55 "${dna.typography.text.family}",${dna.typography.text.fallback}}
section{padding:56px 64px;page-break-after:always;border-bottom:1px solid ${l.border}}.cover{min-height:296mm}@media print{section{min-height:296mm}}
h1,h2{font-family:"${dna.typography.display.family}",${dna.typography.display.fallback};font-weight:${spec.wordmark.weight};letter-spacing:${dna.typography.scale.displayTracking ?? 0}em;line-height:1.05;margin:0}
h1{font-size:84px}h2{font-size:44px;margin-bottom:26px}h3{font-size:15px;letter-spacing:.09em;text-transform:uppercase;margin:34px 0 12px;color:${l.textMuted}}
p{max-width:68ch}.lede{font-size:21px;max-width:56ch}.meta{font:12px/1.4 ui-monospace,monospace;color:${l.textMuted};margin:0 0 8px}
.cover{background:${d.bg};color:${d.text};display:flex;flex-direction:column;justify-content:space-between}.cover .lock svg{height:96px;width:auto}.cover-arc{width:100%;height:auto;margin:24px 0}
.construct{width:100%;max-width:640px;height:auto;display:block;margin:18px 0}.construct text{font:12px/1 ui-monospace,monospace;fill:${l.textMuted}}
.two{display:grid;gap:28px;grid-template-columns:1.5fr 1fr}.step{border-top:1px solid ${l.border};padding:12px 0}.arabic .meta{text-align:right}.apps-wide{display:grid;gap:18px;grid-template-columns:repeat(2,1fr);margin-bottom:18px}.apps-rest{display:grid;gap:18px;grid-template-columns:repeat(2,1fr);align-items:start;max-width:780px}.apps-rest .tall{grid-row:span 2}.apps-wide svg,.apps-rest svg{width:100%;height:auto;border-radius:6px;border:1px solid ${l.border};display:block}.arabic{border:1px solid ${l.border};border-radius:${dna.layout.radius.md}px;padding:28px;background:${l.surfaceRaised};margin:18px 0}.arabic p{max-width:none}
.scale{display:flex;flex-wrap:wrap;gap:22px;align-items:flex-end}
.grid{display:grid;gap:18px;grid-template-columns:repeat(auto-fill,minmax(190px,1fr))}.plate{border:1px solid ${l.border};border-radius:${dna.layout.radius.md}px;padding:24px;display:flex;align-items:center;justify-content:center;min-height:150px;background:${l.surfaceRaised}}
.plate.dark{background:${d.bg};border-color:${d.border}}.plate svg{max-width:100%;height:auto;max-height:110px}
figure{margin:0}figcaption{font-size:13px;color:${l.textMuted};margin-top:8px}.row{display:grid;gap:18px;grid-template-columns:repeat(4,1fr)}.row3{display:grid;gap:18px;grid-template-columns:repeat(3,1fr)}
.sel svg{outline:3px solid ${l.accent};outline-offset:6px;border-radius:8px}
ul.sw{list-style:none;padding:0;margin:0;display:grid;gap:10px;grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}ul.sw li{border-radius:${dna.layout.radius.sm}px;padding:12px;min-height:118px;display:flex;flex-direction:column;gap:2px;font-size:12px;border:1px solid ${l.border}}ul.sw b{font-size:14px}ul.sw code{font-size:10.5px}
table{border-collapse:collapse;font-size:14px}td,th{padding:6px 14px 6px 0;text-align:start}.chip{padding:5px 10px;border-radius:99px;font-size:13px;display:inline-block}
.icons{display:grid;grid-template-columns:repeat(9,1fr);gap:14px}.icons figure{text-align:center}.icons svg{width:30px;height:30px;color:${l.text}}
.type{border-top:1px solid ${l.border};padding:16px 0}.apps{columns:3;column-gap:18px}.apps>*{break-inside:avoid;margin:0 0 18px;display:block}.apps img,.apps svg{width:100%;height:auto;border-radius:6px;border:1px solid ${l.border};display:block}
.clear{position:relative;display:inline-block;background:${l.surfaceRaised};border:1px dashed ${l.primary}}.clear svg{display:block;height:150px;width:auto}
.note{border-inline-start:4px solid ${l.accent};padding:10px 16px;background:${l.surface};font-size:14px;max-width:72ch}
</style></head><body>
<section class="cover"><div class="lock">${read(`logo/${slug}-lockup-horizontal-reversed.svg`)}</div>${coverArc}<div><h1>Brand<br>guidelines</h1><p class="lede">${e(dna.identity.positioning)}</p><p class="meta" style="color:${d.textMuted}">Experience DNA revision ${dna.revision} · generated ${nowIso().slice(0, 10)} · ${e(brief.client.name)}${brief.client.fictional ? ' (fictional client, demonstration project)' : ''}</p></div></section>
<section><h2>Strategy</h2><p class="lede">${e(dna.identity.positioning)}</p>
<div class="row3"><div><h3>Personality</h3><p>${dna.identity.personality.map(e).join(' · ')}</p></div><div><h3>Audience</h3><p>${dna.identity.audience.map(e).join('; ')}</p></div><div><h3>Voice</h3><p>${dna.identity.voice.tone.map(e).join(' · ')}</p></div></div>
<h3>What sets it apart</h3><p>${e(spec.strategy.differentiation)}</p>
<h3>Direction: ${e(dna.direction.title)}</h3><p>${e(dna.direction.rationale)}</p><p><b>Signature:</b> ${e(dna.direction.signature)}</p>
<h3>Voice rules</h3><ul>${dna.identity.voice.rules.map((r) => `<li>${e(r)}</li>`).join('')}</ul>
<h3>Never</h3><ul>${dna.direction.prohibitedPatterns.map((r) => `<li>${e(r)}</li>`).join('')}</ul></section>
<section><h2>Logo</h2><h3>Concepts explored</h3><div class="row3">${concepts}</div>
${spec.selectionReason ? `<p style="margin-top:22px"><b>Why this one:</b> ${e(spec.selectionReason)}</p>` : ''}
<h3>The system</h3><div class="grid">
<div class="plate">${read(`logo/${slug}-lockup-horizontal.svg`)}</div><div class="plate dark">${read(`logo/${slug}-lockup-horizontal-reversed.svg`)}</div>
<div class="plate">${read(`logo/${slug}-lockup-stacked.svg`)}</div><div class="plate">${read(`logo/${slug}-symbol.svg`)}</div>
<div class="plate">${read(`logo/${slug}-lockup-horizontal-mono-ink.svg`)}</div><div class="plate dark">${read(`logo/${slug}-lockup-horizontal-mono-paper.svg`)}</div></div>
<h3>Clear space and minimum size</h3><div class="clear" style="padding:0">${read(`logo/${slug}-lockup-horizontal.svg`)}</div>
<p>Every logo file carries its clear space as built-in padding: ${clear} of the symbol height on all sides (the dashed box above is the file boundary). Minimum size on screen: symbol ${spec.minSizePx?.symbol ?? 16}px, horizontal lockup ${spec.minSizePx?.lockup ?? 96}px wide.</p>
<h3>Misuse</h3><div class="row">${misuse}</div></section>
${signatureSection}
<section><h2>Colour</h2><ul class="sw">${sw}</ul><h3>Measured contrast (WCAG 2.x ratio)</h3><table><tr><th>Scheme</th><th>Pair</th><th>Ratio</th></tr>${ctable}</table>
<p class="note">Ratios are computed from the hex values above. Text pairs meet ${dna.accessibility.minTextContrast}:1 or better; non-text pairs meet 3:1. Print colours are not specified here: CMYK or spot values must be proofed against the chosen press and stock.</p></section>
<section><h2>Typography</h2>${type}<h3>Hierarchy</h3><p>Base ${dna.typography.scale.basePx}px, each step ${dna.typography.scale.ratio} times the one below. Display tracking ${dna.typography.scale.displayTracking ?? 0}em. Statements are set in the display face, explanation in the text face, and every figure in the mono face.</p>${hierarchy}</section>
${arabicSection}
${layoutSection}
<section><h2>Iconography</h2><p>${iconNamesList.length} icons on a 24px grid, ${dna.iconography.strokeWidth}px ${dna.iconography.terminals || 'round'} strokes.</p><div class="icons">${iconNamesList.map((n) => `<figure>${iconSvg(n, { strokeWidth: dna.iconography.strokeWidth, terminals: dna.iconography.terminals || 'round' })}<figcaption>${n}</figcaption></figure>`).join('')}</div></section>
<section><h2>Imagery and motion</h2><p><b>Style:</b> ${e(dna.imagery.style)}</p><p><b>Composition:</b> ${e(dna.imagery.composition)}</p>${dna.imagery.photography ? `<p><b>Photography:</b> ${e(dna.imagery.photography)}</p>` : ''}
<div class="apps-rest" style="margin-top:18px">${appKeys.filter((k) => !k.startsWith('business') && aspect(k) <= 1.2 && k !== 'app-icon').map((k) => read(`applications/${k}.svg`)).join('')}</div>
<h3>Motion: ${e(dna.motion.personality)}</h3><p>Intensity: ${dna.motion.intensity}. Durations (ms): ${Object.entries(dna.motion.durations).map(([k, v]) => `${k} ${v}`).join(' · ')}. Spring: stiffness ${dna.motion.spring.stiffness}, damping ${dna.motion.spring.damping}. With reduced motion: ${dna.motion.reducedMotion}.</p><div class="row">${ease}</div></section>
<section><h2>Applications</h2><div class="apps-wide">${appKeys.filter((k) => aspect(k) > 1.2).map(appFigure).join('')}</div><div class="apps-rest">${appKeys.filter((k) => aspect(k) <= 1.2).sort((a, b) => aspect(a) - aspect(b)).map(appFigure).join('')}</div>
<h3>Accessibility</h3><p>Target: ${dna.accessibility.target}. Minimum interactive target ${dna.accessibility.minTargetPx}px on the web, 44pt/48dp in native apps.</p>
<h3>Files and integrity</h3><p>${checks.total} files delivered; ${checks.vectorPass}/${checks.vectorTotal} vector masters pass integrity checks (fills only, no live text, no raster, palette colours only).</p>
<h3>Legal notice</h3><p class="note">This identity was generated from design parameters. No trademark search or clearance has been performed, and nothing here asserts that the name or mark is available for registration or free of conflict. Clearance by qualified counsel is required before use in commerce.</p></section>
</body></html>`;
}

async function brandBuild({ flags }) {
  const root = requireProject(flags.project);
  const dna = loadDna(root);
  const spec = loadBrandSpec(root);
  const brief = loadBrief(root);
  if (!spec.concepts.some((c) => c.id === spec.selected)) throw new CisError('E_BRAND_SPEC', `selected "${spec.selected}" is not one of the concepts.`);
  if (!hasCapability('vector')) throw new CisError('E_MISSING_DEP', 'The brand engine outlines the wordmark and optimises SVG, which needs the vector engine. Run `creative-studio setup --only vector`.', { exit: EXIT.MISSING_DEP });
  const slug = slugify(spec.wordmark.text);
  const out = path.join(root, 'brand');
  const marks = buildMarks(dna, spec);
  const T = typeSetter(dna);
  const palette = Object.values(dna.color.palette).map((c) => c.hex);
  const files = {}; // rel -> abs
  const vector = []; // inspection results
  const write = (rel, svg, opts = {}) => {
    const abs = path.join(out, rel);
    const optimised = optimise(svg);
    writeFileAtomic(abs, optimised);
    files[rel] = abs;
    if (opts.inspect !== false) vector.push({ file: rel, ...inspectSvg(optimised, { allowedColors: palette, allowStroke: Boolean(opts.allowStroke), allowBlends: Boolean(opts.allowBlends) }) });
    return optimised;
  };

  // 1. Concepts explored.
  const l = dna.color.semantic.light;
  for (const c of spec.concepts) {
    const lk = lockup(marks.symbols[c.id], marks.word, { layout: 'horizontal', colors: { primary: l.primary, accent: l.accent, text: l.text }, clear: spec.clearSpace ?? 0.5 });
    write(`logo/concepts/${c.id}.svg`, svgDoc({ w: lk.w, h: lk.h, title: `${spec.wordmark.text} concept: ${c.title}`, desc: marks.symbols[c.id].description, body: lk.body }));
  }
  // 2. The selected system.
  const sym = marks.symbols[spec.selected];
  const title = `${spec.wordmark.text} logo`;
  for (const [variant, v] of Object.entries(schemes(dna))) {
    const suffix = variant === 'color' ? '' : `-${variant}`;
    for (const layout of ['symbol', 'wordmark', 'horizontal', 'stacked']) {
      if (layout === 'wordmark' && variant.startsWith('mono')) continue;
      const lk = lockup(sym, marks.word, { layout, colors: v.colors, mono: v.mono, clear: spec.clearSpace ?? 0.5 });
      const name = layout === 'symbol' ? 'symbol' : layout === 'wordmark' ? 'wordmark' : `lockup-${layout}`;
      write(`logo/${slug}-${name}${suffix}.svg`, svgDoc({ w: lk.w, h: lk.h, title: `${title} (${name}${suffix})`, desc: sym.description, body: lk.body }));
    }
  }
  write('logo/favicon.svg', svgDoc({ w: 64, h: 64, title: `${spec.wordmark.text} favicon`, body: symbolMarkup(sym, { primary: l.primary, accent: l.accent }) }));

  // 3. Icons.
  const names = iconNames();
  for (const n of names) {
    const abs = path.join(out, 'icons', `${n}.svg`);
    writeFileAtomic(abs, iconSvg(n, { strokeWidth: dna.iconography.strokeWidth, terminals: dna.iconography.terminals || 'round', color: l.text }));
    files[`icons/${n}.svg`] = abs;
  }
  writeJson(path.join(out, 'icons', 'icons.json'), iconSet(dna));
  files['icons/icons.json'] = path.join(out, 'icons', 'icons.json');

  // 4. Applications.
  const apps = applications(dna, spec, marks, slug, T);
  for (const [key, app] of Object.entries(apps)) write(`applications/${key}.svg`, app.svg, { allowStroke: true, allowBlends: true });

  // 5. Raster and PDF exports.
  const rasterChecks = [];
  if (hasCapability('raster')) {
    const { svgToRaster, metadata } = await import('../lib/raster.mjs');
    const d = dna.color.semantic.dark;
    const jobs = [
      [`logo/${slug}-symbol.svg`, 'logo/png/symbol-512.png', 512, 512, true],
      [`logo/${slug}-symbol.svg`, 'logo/png/symbol-192.png', 192, 192, true],
      ['logo/favicon.svg', 'logo/png/favicon-32.png', 32, 32, true],
      ['logo/favicon.svg', 'logo/png/apple-touch-icon-180.png', 180, 180, false, l.bg],
    ];
    for (const variant of ['', '-reversed']) {
      const src = `logo/${slug}-lockup-horizontal${variant}.svg`;
      const vb = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(fs.readFileSync(files[src], 'utf8'));
      const h = Math.round((1200 * Number(vb[2])) / Number(vb[1]));
      jobs.push([src, `logo/png/lockup-horizontal${variant}-1200.png`, 1200, h, true], [src, `logo/webp/lockup-horizontal${variant}-1200.webp`, 1200, h, true]);
    }
    for (const [key, app] of Object.entries(apps)) {
      if (!app.px) continue;
      jobs.push([`applications/${key}.svg`, `applications/png/${key}.png`, app.px[0], app.px[1], false, d.bg]);
      if (key !== 'app-icon') jobs.push([`applications/${key}.svg`, `applications/webp/${key}.webp`, app.px[0], app.px[1], false, d.bg]);
    }
    for (const [src, rel, w, h, transparent, background] of jobs) {
      const fmt = rel.endsWith('.webp') ? 'webp' : 'png';
      const buf = await svgToRaster(fs.readFileSync(files[src], 'utf8'), { width: w, height: h, format: fmt, transparent, background });
      const abs = path.join(out, rel);
      writeFileAtomic(abs, buf);
      files[rel] = abs;
      const m = await metadata(buf);
      rasterChecks.push({ file: rel, pass: m.width === w && m.height === h, detail: `${m.width}x${m.height} ${m.format}` });
    }
  }
  const { css: fontCss, missing: missingFonts } = fontFaceCss(['display', 'text', 'arabic'].filter((r) => dna.typography[r]).map((r) => dna.typography[r]), { subsets: ['latin', 'arabic'], root });
  const appKeys = Object.keys(apps);
  const vectorPass = vector.filter((v) => v.pass).length;
  const html = guidelinesHtml({ dna, spec, brief, marks, slug, files, appKeys, iconNamesList: names, fontCss, checks: { total: Object.keys(files).length + 2, vectorPass, vectorTotal: vector.length } });
  writeFileAtomic(path.join(out, 'guidelines.html'), html);
  files['guidelines.html'] = path.join(out, 'guidelines.html');
  const pdfNotes = [];
  if (hasCapability('browser')) {
    const { htmlToPdf, svgToPdf } = await import('../lib/browser.mjs');
    try {
      await htmlToPdf(files['guidelines.html'], path.join(out, 'guidelines.pdf'));
      files['guidelines.pdf'] = path.join(out, 'guidelines.pdf');
      for (const [key, app] of Object.entries(apps)) {
        if (!app.mm) continue;
        await svgToPdf(fs.readFileSync(files[`applications/${key}.svg`], 'utf8'), path.join(out, 'applications', 'pdf', `${key}.pdf`), { widthMm: app.mm[0], heightMm: app.mm[1] });
        files[`applications/pdf/${key}.pdf`] = path.join(out, 'applications', 'pdf', `${key}.pdf`);
      }
      const lk = fs.readFileSync(files[`logo/${slug}-lockup-horizontal.svg`], 'utf8');
      const vb = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(lk);
      await svgToPdf(lk, path.join(out, 'logo', 'pdf', `${slug}-lockup-horizontal.pdf`), { widthMm: 120, heightMm: f((120 * Number(vb[2])) / Number(vb[1])) });
      files[`logo/pdf/${slug}-lockup-horizontal.pdf`] = path.join(out, 'logo', 'pdf', `${slug}-lockup-horizontal.pdf`);
    } catch (err) {
      if (err instanceof CisError && err.code === 'E_NO_BROWSER') pdfNotes.push('PDF export skipped: no Chromium browser found.');
      else throw err;
    }
  } else pdfNotes.push('PDF export skipped: browser engine not installed (creative-studio setup --only browser).');

  // 6. Manifest with completeness and integrity checks.
  const expected = [
    ...['symbol', 'wordmark', 'lockup-horizontal', 'lockup-stacked'].flatMap((n) => ['', '-reversed'].map((s) => `logo/${slug}-${n}${s}.svg`)),
    ...['symbol', 'lockup-horizontal', 'lockup-stacked'].flatMap((n) => ['-mono-ink', '-mono-paper'].map((s) => `logo/${slug}-${n}${s}.svg`)),
    'logo/favicon.svg', 'icons/icons.json', 'guidelines.html', ...appKeys.map((k) => `applications/${k}.svg`),
  ];
  const missing = expected.filter((r) => !files[r]);
  const sel = spec.concepts.find((c) => c.id === spec.selected);
  const minFeature = sel.params?.weight ? (sel.params.weight * (spec.minSizePx?.symbol ?? 16)) / 64 : null;
  const manifest = {
    schemaVersion: '1.0.0',
    generatedAt: nowIso(),
    dnaRevision: dna.revision,
    brand: spec.wordmark.text,
    selectedConcept: spec.selected,
    files: Object.entries(files).sort().map(([rel, abs]) => ({ path: `brand/${rel}`, bytes: fs.statSync(abs).size, sha256: sha256File(abs) })),
    checks: {
      vectorIntegrity: vector.map((v) => ({ file: v.file, pass: v.pass, failed: v.checks.filter((c) => !c.pass).map((c) => `${c.id}${c.detail ? `: ${c.detail}` : ''}`) })),
      rasterDimensions: rasterChecks,
      missingAssets: missing,
      missingFonts,
      minimumSize: minFeature === null ? { pass: true, detail: 'not measured for this concept' } : { pass: minFeature >= 1, detail: `thinnest feature is ${minFeature.toFixed(2)}px at the ${spec.minSizePx?.symbol ?? 16}px minimum size` },
    },
    notes: [...pdfNotes, 'No trademark search or clearance has been performed.', 'Print colour (CMYK or spot) is not specified; proof against the chosen press and stock.'],
  };
  manifest.ok = vector.every((v) => v.pass) && rasterChecks.every((r) => r.pass) && missing.length === 0 && manifest.checks.minimumSize.pass;
  writeJson(path.join(out, 'brand-manifest.json'), manifest);

  const reg = (id, purpose, rels, kind = 'vector') =>
    registerAsset(root, {
      schemaVersion: '1.0.0', id, kind, purpose, dnaRevision: dna.revision,
      files: rels.filter((r) => files[r]).map((r) => fileEntry(root, files[r], { format: path.extname(r).slice(1), role: r.endsWith('.svg') ? 'source' : 'export' })),
      origin: { type: 'generated', provider: 'local-procedural', model: 'cis-logo-1', parameters: { concept: spec.selected, wordmark: spec.wordmark.text, weight: spec.wordmark.weight }, costUsd: 0, simulated: false },
      history: [{ at: nowIso(), action: 'generated', by: 'creative-studio brand build' }],
      rights: { status: 'restricted', notes: 'Original geometry; wordmark outlined from a font under its recorded licence. No trademark clearance performed.' },
      qa: { status: manifest.ok ? 'passed' : 'failed', checks: [{ id: 'vector-integrity', pass: vector.every((v) => v.pass) }, { id: 'complete-set', pass: missing.length === 0 }] },
      clientApproval: 'pending', usedIn: ['brand'], createdAt: nowIso(),
    });
  reg('brand-logo-system', 'Logo system: symbol, wordmark and lockups in colour, reversed and one-colour', Object.keys(files).filter((r) => r.startsWith('logo/') && !r.includes('/concepts/')));
  reg('brand-icons', 'Icon family', Object.keys(files).filter((r) => r.startsWith('icons/')));
  reg('brand-applications', 'Brand applications: stationery and social templates', Object.keys(files).filter((r) => r.startsWith('applications/')));
  reg('brand-guidelines', 'Brand guidelines document', ['guidelines.html', 'guidelines.pdf'], 'document');
  appendEvent(root, { type: 'brand.built', data: { files: manifest.files.length, ok: manifest.ok, concept: spec.selected } });

  if (json(flags, manifest)) return manifest.ok ? EXIT.OK : EXIT.FAIL;
  const bytes = manifest.files.reduce((n, x) => n + x.bytes, 0);
  print(`Brand kit for ${spec.wordmark.text}: ${manifest.files.length} files (${fmtBytes(bytes)}) in brand/`);
  print(`Vector integrity: ${vectorPass}/${vector.length} masters pass. Raster exports: ${rasterChecks.filter((r) => r.pass).length}/${rasterChecks.length} at exact size. Missing: ${missing.length || 'none'}.`);
  for (const v of vector.filter((x) => !x.pass)) print(`  FAIL ${v.file}: ${v.checks.filter((c) => !c.pass).map((c) => c.id + (c.detail ? ` (${c.detail})` : '')).join(', ')}`);
  for (const n of manifest.notes) print(`  note: ${n}`);
  return manifest.ok ? EXIT.OK : EXIT.FAIL;
}

async function brandCheck({ flags }) {
  const root = requireProject(flags.project);
  const file = path.join(root, 'brand', 'brand-manifest.json');
  if (!exists(file)) throw new CisError('E_READ', 'No brand manifest. Run `creative-studio brand build`.');
  const m = readJson(file);
  const problems = [];
  for (const fe of m.files) {
    const abs = path.join(root, fe.path);
    if (!exists(abs)) problems.push(`${fe.path}: missing`);
    else if (sha256File(abs) !== fe.sha256) problems.push(`${fe.path}: changed since the manifest was written`);
  }
  for (const v of m.checks.vectorIntegrity.filter((x) => !x.pass)) problems.push(`${v.file}: ${v.failed.join(', ')}`);
  for (const miss of m.checks.missingAssets) problems.push(`${miss}: expected but not produced`);
  if (json(flags, { ok: problems.length === 0, files: m.files.length, problems })) return problems.length ? EXIT.FAIL : EXIT.OK;
  print(problems.length ? `Brand kit problems:\n  - ${problems.join('\n  - ')}` : `Brand kit intact: ${m.files.length} files match the manifest; all vector masters pass.`);
  return problems.length ? EXIT.FAIL : EXIT.OK;
}

async function brand(args) {
  const sub = args._[0] || 'build';
  if (sub === 'build') return brandBuild(args);
  if (sub === 'check') return brandCheck(args);
  throw new CisError('E_USAGE', `Unknown brand subcommand "${sub}".`, { exit: EXIT.USAGE });
}

export const commands = [
  { name: 'brand', group: 'Production', summary: 'Build the logo system, icons, applications and guidelines', run: brand, usage: `
creative-studio brand build [--json]
creative-studio brand check [--json]

Reads .cis/brand-spec.json and the Experience DNA. Produces editable vector
masters (filled paths, outlined wordmark, no raster), colour / reversed /
one-colour variants, PNG and WebP exports at exact sizes, vector PDFs, an icon
family, applications with print bleed, guidelines (HTML and PDF) and
brand/brand-manifest.json with integrity and completeness checks.
Needs the vector engine; raster and browser engines add PNG/WebP and PDF.` },
];
