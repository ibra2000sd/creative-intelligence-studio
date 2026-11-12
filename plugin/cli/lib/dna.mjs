// Experience DNA: semantic lint, token derivation for every platform, revision
// archive, diff, originality fingerprint, and cross-deliverable consistency.
import fs from 'node:fs';
import path from 'node:path';
import { CisError, readJson, writeJson, writeFileAtomic, exists, contrast, hexToOklch, colorDistance, nearPalette, mix, nowIso, walk, sha256 } from './util.mjs';
import { assertValid } from './schema.mjs';
import { paths, appendEvent } from './project.mjs';

export function loadDna(root) {
  const file = paths(root).dna;
  if (!exists(file)) throw new CisError('E_NO_DNA', 'No Experience DNA yet. Author .cis/dna/experience-dna.json (see the experience-dna skill), then run `creative-studio dna check`.');
  return assertValid('experience-dna', readJson(file), 'Experience DNA');
}

// ------------------------------------------------------------------ lint -----

/**
 * Checks a schema cannot express: real contrast, palette membership, motion
 * sanity, licences, localisation coverage. Errors block approval; warnings
 * are surfaced to the human.
 */
export function lintDna(dna) {
  const issues = [];
  const add = (level, at, message) => issues.push({ level, path: at, message });
  const min = dna.accessibility.minTextContrast;
  const paletteHexes = new Set(Object.values(dna.color.palette).map((c) => c.hex.toLowerCase()));

  for (const scheme of ['light', 'dark']) {
    const s = dna.color.semantic[scheme];
    const at = `/color/semantic/${scheme}`;
    const pairs = [
      ['text', 'bg', min], ['text', 'surface', min], ['text', 'surfaceRaised', min],
      ['textMuted', 'bg', min], ['textMuted', 'surface', min],
      ['onPrimary', 'primary', min], ['onAccent', 'accent', min],
      ['primary', 'bg', 3], ['focus', 'bg', 3], ['focus', 'surface', 3],
      ['danger', 'bg', 3], ['success', 'bg', 3], ['warning', 'bg', 3],
    ];
    for (const [fg, bg, need] of pairs) {
      const ratio = contrast(s[fg], s[bg]);
      if (ratio < need) add('error', `${at}/${fg}`, `${fg} on ${bg} is ${ratio.toFixed(2)}:1, needs ${need}:1 (${scheme})`);
    }
    // Borders carry structure for low-vision users; below 1.2:1 they disappear.
    if (contrast(s.border, s.bg) < 1.2) add('warning', `${at}/border`, `border is nearly invisible on bg (${contrast(s.border, s.bg).toFixed(2)}:1)`);
    for (const [k, v] of Object.entries(s)) {
      if (!paletteHexes.has(v.toLowerCase())) add('error', `${at}/${k}`, `${v} is not in color.palette; semantic roles must reference palette colours`);
    }
  }
  for (const hex of dna.color.dataViz) {
    if (!paletteHexes.has(hex.toLowerCase())) add('error', '/color/dataViz', `${hex} is not in color.palette`);
  }
  for (let i = 0; i < dna.color.dataViz.length; i++) {
    for (let j = i + 1; j < dna.color.dataViz.length; j++) {
      if (colorDistance(dna.color.dataViz[i], dna.color.dataViz[j]) < 0.08) add('warning', '/color/dataViz', `series ${i + 1} and ${j + 1} are hard to tell apart`);
    }
  }

  const d = dna.motion.durations;
  const order = ['instant', 'fast', 'base', 'slow', 'cinematic'];
  for (let i = 1; i < order.length; i++) {
    if (d[order[i]] < d[order[i - 1]]) add('error', `/motion/durations/${order[i]}`, `${order[i]} (${d[order[i]]}ms) is shorter than ${order[i - 1]} (${d[order[i - 1]]}ms)`);
  }
  if (dna.motion.intensity === 'none' && d.base > 0) add('warning', '/motion/intensity', 'intensity is "none" but durations are non-zero; engines will ignore the durations');
  if (d.base > 500) add('warning', '/motion/durations/base', `${d.base}ms is slow for everyday UI feedback; frequent interactions feel laggy above ~300ms`);
  const zeta = dna.motion.spring.damping / (2 * Math.sqrt(dna.motion.spring.stiffness * dna.motion.spring.mass));
  if (zeta < 0.35) add('warning', '/motion/spring', `damping ratio ${zeta.toFixed(2)} oscillates visibly; confirm this bounce is intended`);
  for (const [name, b] of Object.entries(dna.motion.easings)) {
    if (b[0] < 0 || b[0] > 1 || b[2] < 0 || b[2] > 1) add('error', `/motion/easings/${name}`, 'cubic-bezier x values must be within 0..1');
  }

  for (const role of ['display', 'text', 'mono', 'arabic']) {
    const f = dna.typography[role];
    if (!f) continue;
    if (/["\\<>{};\n\r]/.test(f.family) || /[<>{};\n\r\\]/.test(f.fallback)) add('error', `/typography/${role}`, 'family and fallback are written into generated CSS and code; quotes, braces, semicolons, angle brackets and line breaks are not allowed');
    if (/^(unknown|tbd|n\/a|proprietary)$/i.test(f.license.trim())) add('error', `/typography/${role}/license`, `"${f.family}" has no usable licence recorded`);
    if (/\b(sf pro|san francisco|new york|segoe|helvetica neue)\b/i.test(f.family)) {
      add('error', `/typography/${role}/family`, `"${f.family}" is a platform or commercial face that cannot be redistributed with a client project; list it only as a fallback`);
    }
  }
  const rtlLocale = dna.localization.locales.some((l) => /^(ar|he|fa|ur)/.test(l));
  if (rtlLocale && !dna.localization.rtl) add('error', '/localization/rtl', 'an RTL locale is listed but rtl is false');
  if (dna.localization.locales.some((l) => /^(ar|fa|ur)/.test(l)) && !dna.typography.arabic) add('error', '/typography/arabic', 'an Arabic-script locale is listed but no Arabic typeface is specified');
  if (!dna.localization.locales.includes(dna.localization.defaultLocale)) add('error', '/localization/defaultLocale', 'defaultLocale is not in locales');

  const evidenced = new Set(dna.evidence.map((e) => e.field.split('.')[0]));
  for (const k of ['identity', 'direction', 'color', 'typography', 'motion']) {
    if (!evidenced.has(k)) add('warning', '/evidence', `no evidence entry explains where "${k}" decisions came from`);
  }
  for (const e of dna.materials.elevation) {
    if (/[<>{};\n\r\\]/.test(e.shadow)) add('error', `/materials/elevation/${e.level}`, 'shadow is written into generated CSS; braces, semicolons, angle brackets and line breaks are not allowed');
  }
  for (const f of dna.materials3d.finishes) {
    if (f.metalness > 0.8 && f.roughness < 0.15) add('warning', `/materials3d/finishes/${f.id}`, 'mirror-like finish needs an environment map to read correctly; plan a fallback');
  }
  return issues;
}

// ---------------------------------------------------------------- tokens -----

function typeScale(dna) {
  const { basePx, ratio } = dna.typography.scale;
  const steps = { xs: -2, sm: -1, md: 0, lg: 1, xl: 2, '2xl': 3, '3xl': 4, '4xl': 5, '5xl': 6 };
  const out = {};
  for (const [name, n] of Object.entries(steps)) out[name] = Math.round(basePx * ratio ** n * 100) / 100;
  return out;
}

function spacingScale(dna) {
  const u = dna.layout.spacingUnitPx;
  const mult = [0, 1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48];
  return Object.fromEntries(mult.map((m, i) => [i, u * m]));
}

// DNA text ends up inside generated CSS and source files. These helpers make sure a
// value can never close the string, declaration or comment it is written into.
const cssName = (s) => String(s).replace(/["\\\n\r<>{};]/g, '');
const cssValue = (s) => String(s).replace(/[\n\r<>{};\\]/g, '');
const commentSafe = (s) => String(s).replace(/[^\w .:-]/g, '');

function fontStack(f) {
  return `"${cssName(f.family)}", ${cssValue(f.fallback)}`;
}

const kebab = (s) => s.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
const bez = (b) => `cubic-bezier(${b.join(', ')})`;

/** Platform-neutral token object. Every other export is a projection of this. */
export function deriveTokens(dna) {
  const type = typeScale(dna);
  return {
    meta: { project: dna.project.id, dnaRevision: dna.revision, generatedBy: 'creative-studio dna tokens' },
    color: {
      palette: Object.fromEntries(Object.entries(dna.color.palette).map(([k, v]) => [k, v.hex.toLowerCase()])),
      light: dna.color.semantic.light,
      dark: dna.color.semantic.dark,
      defaultScheme: dna.color.defaultScheme || 'light',
      dataViz: dna.color.dataViz,
    },
    font: {
      display: fontStack(dna.typography.display),
      text: fontStack(dna.typography.text),
      mono: dna.typography.mono ? fontStack(dna.typography.mono) : 'ui-monospace, SFMono-Regular, Menlo, monospace',
      arabic: dna.typography.arabic ? fontStack(dna.typography.arabic) : null,
      families: {
        display: dna.typography.display.family,
        text: dna.typography.text.family,
        mono: dna.typography.mono?.family || null,
        arabic: dna.typography.arabic?.family || null,
      },
    },
    type: {
      sizePx: type,
      displayTracking: dna.typography.scale.displayTracking ?? 0,
      textLineHeight: dna.typography.scale.textLineHeight ?? 1.55,
      displayLineHeight: dna.typography.scale.displayLineHeight ?? 1.05,
    },
    space: spacingScale(dna),
    radius: dna.layout.radius,
    grid: dna.layout.grid,
    layout: { grammar: dna.layout.grammar, density: dna.layout.density },
    shadow: Object.fromEntries(dna.materials.elevation.map((e) => [e.level, cssValue(e.shadow)])),
    motion: {
      intensity: dna.motion.intensity,
      durationMs: dna.motion.durations,
      easing: dna.motion.easings,
      spring: dna.motion.spring,
      staggerMs: dna.motion.stagger,
      reducedMotion: dna.motion.reducedMotion,
    },
    icon: dna.iconography,
    breakpointPx: dna.responsive.breakpointsPx,
    a11y: { minTargetPx: dna.accessibility.minTargetPx, target: dna.accessibility.target },
    locale: { default: dna.localization.defaultLocale, locales: dna.localization.locales, rtl: dna.localization.rtl },
    scene: dna.materials3d,
  };
}

function schemeBlock(s) {
  return Object.entries(s)
    .map(([k, v]) => `  --color-${kebab(k)}: ${v.toLowerCase()};`)
    .join('\n');
}

export function tokensCss(dna) {
  const t = deriveTokens(dna);
  const def = t.color.defaultScheme;
  const other = def === 'light' ? 'dark' : 'light';
  const fluid = (px, minScale) => {
    // Display sizes scale with the viewport between 360px and the grid max width.
    const lo = Math.round(px * minScale * 100) / 100;
    const slope = ((px - lo) / (t.grid.maxWidthPx - 360)) * 100;
    const intercept = lo - (slope * 360) / 100;
    return `clamp(${(lo / 16).toFixed(4)}rem, ${(intercept / 16).toFixed(4)}rem + ${slope.toFixed(4)}vw, ${(px / 16).toFixed(4)}rem)`;
  };
  const sizes = Object.entries(t.type.sizePx)
    .map(([k, px]) => `  --text-${k}: ${['2xl', '3xl', '4xl', '5xl'].includes(k) ? fluid(px, k === '5xl' ? 0.5 : k === '4xl' ? 0.56 : 0.7) : (px / 16).toFixed(4) + 'rem'};`)
    .join('\n');
  const off = t.motion.intensity === 'none';
  const dur = (ms) => (off ? '0ms' : `${ms}ms`);
  return `/* Generated by creative-studio from Experience DNA revision ${Number(dna.revision)} (${commentSafe(dna.project.id)}).
   Do not edit by hand: change the DNA and run \`creative-studio dna tokens\`. */
:root {
  color-scheme: ${def} ${other};
${Object.entries(t.color.palette).map(([k, v]) => `  --palette-${k}: ${v};`).join('\n')}
${schemeBlock(t.color[def])}
  /* Scheme-pinned values for surfaces that keep one scheme (artwork, inverted bands). */
${['light', 'dark'].map((sc) => Object.entries(t.color[sc]).map(([k, v]) => `  --${sc}-${kebab(k)}: ${v.toLowerCase()};`).join('\n')).join('\n')}
${t.color.dataViz.map((v, i) => `  --viz-${i + 1}: ${v.toLowerCase()};`).join('\n')}
  --font-display: ${t.font.display};
  --font-text: ${t.font.text};
  --font-mono: ${t.font.mono};
${sizes}
  --tracking-display: ${t.type.displayTracking}em;
  --leading-text: ${t.type.textLineHeight};
  --leading-display: ${t.type.displayLineHeight};
${Object.entries(t.space).map(([k, v]) => `  --space-${k}: ${(v / 16).toFixed(4)}rem;`).join('\n')}
  --radius-sm: ${t.radius.sm}px;
  --radius-md: ${t.radius.md}px;
  --radius-lg: ${t.radius.lg}px;
  --grid-columns: ${t.grid.columns};
  --grid-gutter: ${t.grid.gutterPx}px;
  --grid-max: ${t.grid.maxWidthPx}px;
  --grid-margin: clamp(${Math.max(16, Math.round(t.grid.marginPx / 3))}px, 5vw, ${t.grid.marginPx}px);
${Object.entries(t.shadow).map(([k, v]) => `  --shadow-${k}: ${v};`).join('\n')}
${Object.entries(t.motion.durationMs).map(([k, v]) => `  --dur-${k}: ${dur(v)};`).join('\n')}
${Object.entries(t.motion.easing).map(([k, v]) => `  --ease-${k}: ${bez(v)};`).join('\n')}
  --stagger: ${dur(t.motion.staggerMs)};
  --icon-stroke: ${t.icon.strokeWidth};
  --target-min: ${t.a11y.minTargetPx}px;
}
[data-scheme="${other}"] {
  color-scheme: ${other};
${schemeBlock(t.color[other])}
}
[data-scheme="${def}"] {
  color-scheme: ${def};
${schemeBlock(t.color[def])}
}
@media (prefers-color-scheme: ${other}) {
  :root:not([data-scheme]) {
    color-scheme: ${other};
${schemeBlock(t.color[other]).replace(/^/gm, '  ')}
  }
}
${t.font.arabic ? `:lang(ar), [dir="rtl"] {\n  --font-display: ${t.font.arabic};\n  --font-text: ${t.font.arabic};\n  --tracking-display: 0em;\n}\n` : ''}@media (prefers-reduced-motion: reduce) {
  :root {
${Object.keys(t.motion.durationMs).map((k) => `    --dur-${k}: ${t.motion.reducedMotion === 'crossfade' && k !== 'instant' ? '120ms' : '0ms'};`).join('\n')}
    --stagger: 0ms;
  }
}
`;
}

/** TypeScript theme module for React Native / Expo. */
export function tokensTs(dna) {
  const t = deriveTokens(dna);
  const body = {
    dnaRevision: dna.revision,
    color: { light: t.color.light, dark: t.color.dark, palette: t.color.palette, dataViz: t.color.dataViz },
    fontFamily: t.font.families,
    fontSize: Object.fromEntries(Object.entries(t.type.sizePx).map(([k, v]) => [k, Math.round(v)])),
    space: t.space,
    radius: t.radius,
    motion: {
      intensity: t.motion.intensity,
      durationMs: t.motion.durationMs,
      easing: t.motion.easing,
      spring: t.motion.spring,
      staggerMs: t.motion.staggerMs,
    },
    minTarget: Math.max(44, t.a11y.minTargetPx), // native platforms ask for 44pt/48dp, above the WCAG 24px floor
    locale: t.locale,
  };
  return `// Generated by creative-studio from Experience DNA revision ${Number(dna.revision)} (${commentSafe(dna.project.id)}).
// Do not edit by hand: change the DNA and run \`creative-studio dna tokens\`.
export const theme = ${JSON.stringify(body, null, 2)} as const;

export type Scheme = 'light' | 'dark';
export type Theme = typeof theme;
export type Palette = { readonly [K in keyof Theme['color']['light']]: string };
`;
}

/** Write every token projection into <project>/design-system. */
export function writeTokens(root, dna) {
  const dir = path.join(root, 'design-system');
  const t = deriveTokens(dna);
  const files = {
    'tokens.css': tokensCss(dna),
    'tokens.json': JSON.stringify(t, null, 2) + '\n',
    'theme.ts': tokensTs(dna),
    'scene.json': JSON.stringify({ dnaRevision: dna.revision, ...t.scene, semantic: { light: t.color.light, dark: t.color.dark } }, null, 2) + '\n',
  };
  for (const [name, content] of Object.entries(files)) writeFileAtomic(path.join(dir, name), content);
  appendEvent(root, { type: 'dna.tokens-exported', data: { revision: dna.revision, files: Object.keys(files) } });
  return Object.keys(files).map((f) => path.join('design-system', f));
}

// ------------------------------------------------------------- revisions -----

function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj ?? {})) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') flatten(v, p, out);
    else out[p] = v;
  }
  return out;
}

export function diffDna(a, b) {
  const fa = flatten(a);
  const fb = flatten(b);
  const changes = [];
  for (const k of new Set([...Object.keys(fa), ...Object.keys(fb)])) {
    if (['revision', 'updatedAt', 'status'].includes(k)) continue;
    if (fa[k] !== fb[k]) changes.push({ path: k, from: fa[k], to: fb[k] });
  }
  return changes.sort((x, y) => x.path.localeCompare(y.path));
}

/** Map a changed DNA path to the `preserve` aspect it would violate. */
export function aspectOf(dnaPath) {
  if (dnaPath.startsWith('color')) return 'brand_colors';
  if (dnaPath.startsWith('typography')) return 'typography';
  if (dnaPath.startsWith('layout') || dnaPath.startsWith('responsive')) return 'layout';
  if (dnaPath.startsWith('motion')) return 'motion';
  if (dnaPath.startsWith('imagery') || dnaPath.startsWith('iconography')) return 'imagery';
  if (dnaPath.startsWith('materials3d')) return 'materials';
  if (dnaPath.startsWith('identity.voice') || dnaPath.startsWith('identity.tagline')) return 'copy';
  return 'structure';
}

/**
 * Archive the current DNA and write the edited one as the next revision.
 * An approved DNA can only change through an explicit bump, which resets its
 * status to "proposed" so the change is re-approved by a person.
 */
export function bumpDna(root, next, { reason, actor = 'cli' }) {
  const p = paths(root);
  const prev = exists(p.dna) ? readJson(p.dna) : null;
  const revision = prev ? prev.revision + 1 : 1;
  const candidate = { ...next, revision, status: prev?.status === 'approved' ? 'proposed' : next.status || 'draft', updatedAt: nowIso() };
  assertValid('experience-dna', candidate, 'Experience DNA');
  const errors = lintDna(candidate).filter((i) => i.level === 'error');
  if (errors.length) throw new CisError('E_DNA_LINT', `DNA revision rejected:\n${errors.map((e) => `  ${e.path} ${e.message}`).join('\n')}`);
  const changes = prev ? diffDna(prev, candidate) : [];
  if (prev) writeJson(path.join(p.dnaVersions, `r${String(prev.revision).padStart(3, '0')}.json`), prev);
  writeJson(p.dna, candidate);
  appendEvent(root, { type: 'dna.revised', actor, data: { revision, reason: reason || '', changed: changes.map((c) => c.path).slice(0, 40) } });
  return { revision, changes };
}

// ----------------------------------------------------------- fingerprint -----

/**
 * A coarse signature of the design decisions. Comparing fingerprints across
 * a studio's past projects flags look-alikes for human review; it is not a
 * judgement of originality and says nothing about third-party work.
 */
export function fingerprint(dna) {
  const light = dna.color.semantic.light;
  const hue = (hex) => {
    const o = hexToOklch(hex);
    return o.c < 0.03 ? 'neutral' : `h${Math.round(o.h / 30) * 30}`;
  };
  return {
    grammar: dna.layout.grammar,
    density: dna.layout.density,
    defaultScheme: dna.color.defaultScheme || 'light',
    primaryHue: hue(light.primary),
    accentHue: hue(light.accent),
    bgTone: hexToOklch(light.bg).l > 0.9 ? 'bright' : hexToOklch(light.bg).l > 0.5 ? 'mid' : 'dark',
    displayFont: dna.typography.display.family.toLowerCase(),
    textFont: dna.typography.text.family.toLowerCase(),
    radius: dna.layout.radius.md <= 4 ? 'sharp' : dna.layout.radius.md <= 14 ? 'soft' : 'round',
    motion: dna.motion.intensity,
    motifs: [...dna.imagery.motifs].sort().join('+'),
    texture: dna.imagery.texture || 'none',
    iconStyle: dna.iconography.style,
  };
}

export function similarity(a, b) {
  const keys = Object.keys(a);
  const same = keys.filter((k) => a[k] === b[k]);
  return { score: same.length / keys.length, shared: same };
}

// ----------------------------------------------------------- consistency -----

const HEX_RX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;
const SOURCE_EXT = new Set(['.css', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.html', '.svg', '.json']);

function normaliseHex(h) {
  let x = h.slice(1).toLowerCase();
  if (x.length === 3) x = [...x].map((c) => c + c).join('');
  if (x.length === 8) x = x.slice(0, 6);
  return '#' + x;
}

/**
 * Scan each deliverable's source for colours and font families and compare
 * them with the DNA. Colours within a small perceptual distance of a palette
 * colour (tints produced by mixing) are accepted; anything else is "off-DNA".
 * Also verifies each deliverable carries tokens generated from the current
 * DNA revision.
 */
export function consistency(root, dna, deliverables) {
  const tokens = deriveTokens(dna);
  const palette = Object.values(tokens.color.palette);
  const allowed = new Set([...palette, '#000000', '#ffffff']);
  const families = Object.values(tokens.font.families).filter(Boolean).map((f) => f.toLowerCase());
  const expectedCss = sha256(tokensCss(dna));
  const expectedTs = sha256(tokensTs(dna));
  const results = [];
  for (const d of deliverables) {
    const dir = path.join(root, d.dir);
    // A deliverable without generated token files (the brand kit) is judged on its colours and type alone.
    const res = { id: d.id, dir: d.dir, present: exists(dir), tokens: (d.tokenFiles || []).length ? 'missing' : 'not-applicable', dnaRevision: null, offPalette: [], foreignFonts: [], filesScanned: 0 };
    results.push(res);
    if (!res.present) continue;
    for (const [rel, want] of [...(d.tokenFiles || [])]) {
      const f = path.join(dir, rel);
      if (!exists(f)) continue;
      const text = fs.readFileSync(f, 'utf8');
      const m = /revision (\d+)/.exec(text) || /"dnaRevision":\s*(\d+)/.exec(text);
      res.dnaRevision = m ? Number(m[1]) : null;
      const expect = want === 'css' ? expectedCss : want === 'ts' ? expectedTs : null;
      res.tokens = expect ? (sha256(text) === expect ? 'current' : 'stale-or-edited') : res.dnaRevision === dna.revision ? 'current' : 'stale-or-edited';
    }
    const skipTokens = new Set((d.tokenFiles || []).map(([rel]) => path.join(dir, rel)));
    const seen = new Map();
    for (const file of walk(dir, { ignore: ['dist', 'public', '.expo', 'assets', 'qa', 'coverage', '__tests__'] })) {
      if (!SOURCE_EXT.has(path.extname(file)) || skipTokens.has(file)) continue;
      if (file.includes(`${path.sep}src${path.sep}dna${path.sep}`)) continue; // generated from the DNA itself
      if (/package(-lock)?\.json$|tsconfig|app\.json$|content\.json$|\.config\./.test(file)) continue;
      const text = fs.readFileSync(file, 'utf8');
      res.filesScanned++;
      for (const raw of text.match(HEX_RX) || []) {
        const hex = normaliseHex(raw);
        if (allowed.has(hex)) continue;
        // A colour is on-DNA if it is a palette colour or a blend of two (a gradient stop or tint).
        if (!nearPalette(hex, palette, 0.04)) {
          const nearest = Math.min(...palette.map((p) => colorDistance(hex, p)));
          if (!seen.has(hex)) seen.set(hex, { hex, file: path.relative(root, file), distance: Number(nearest.toFixed(3)) });
        }
      }
      for (const m of text.matchAll(/font-family\s*:\s*([^;}{]+)[;}]|fontFamily\s*:\s*['"]([^'"]+)['"]/g)) {
        const decl = (m[1] || m[2]).trim();
        if (/^var\(|inherit|^theme\.|system-ui|ui-monospace|ui-sans-serif/.test(decl)) continue;
        const first = decl.split(',')[0].replace(/['"]/g, '').trim().toLowerCase();
        if (first && !families.includes(first) && !/^(sans-serif|serif|monospace)$/.test(first)) {
          res.foreignFonts.push({ family: first, file: path.relative(root, file) });
        }
      }
    }
    res.offPalette = [...seen.values()];
  }
  const ok = results.every((r) => r.present && ['current', 'not-applicable'].includes(r.tokens) && r.offPalette.length === 0 && r.foreignFonts.length === 0);
  return { schemaVersion: '1.0.0', generatedAt: nowIso(), dnaRevision: dna.revision, ok, deliverables: results };
}

export { mix };
