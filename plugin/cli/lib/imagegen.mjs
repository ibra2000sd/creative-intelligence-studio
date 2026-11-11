// Local procedural image engine. Deterministic, offline, zero cost: the same
// brief, seed and Experience DNA always produce the same artwork. Every recipe
// draws only with colours taken from the DNA, so output is on-brand by
// construction and the result is a real SVG vector that can also be rasterised.
import { rng, mix, CisError } from './util.mjs';

const f = (n) => Number(n.toFixed(2));

function colors(dna, scheme) {
  const s = dna.color.semantic[scheme];
  const o = dna.color.semantic[scheme === 'light' ? 'dark' : 'light'];
  return { ...s, alt: o, viz: dna.color.dataViz, light: dna.color.semantic.light, dark: dna.color.semantic.dark };
}

function grain(dna, id = 'g', strength = 0.11) {
  const t = dna.imagery.texture || 'none';
  if (t === 'none') return { defs: '', layer: () => '' };
  const freq = t === 'film-grain' ? 0.95 : t === 'halftone' ? 0.5 : 0.72;
  return {
    defs: `<filter id="${id}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="2" seed="7" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 ${strength * 4} 0"/></filter>`,
    layer: (w, h) => `<rect width="${w}" height="${h}" filter="url(#${id})" opacity="0.5" style="mix-blend-mode:multiply"/>`,
  };
}

/** A soft ridge line: sum of seeded sines, returned as a closed path down to the bottom edge. */
function ridge(rand, w, h, baseY, amp, steps = 48) {
  const waves = [0, 1, 2].map((i) => ({ k: (1.2 + rand() * 2.4) * (i + 1), p: rand() * Math.PI * 2, a: amp / (i + 1.2) }));
  let d = `M0 ${f(h)}`;
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * w;
    const y = baseY + waves.reduce((s, wv) => s + Math.sin((x / w) * wv.k * Math.PI + wv.p) * wv.a, 0);
    d += `L${f(x)} ${f(y)}`;
  }
  return d + `L${f(w)} ${f(h)}Z`;
}

const TIMES = {
  dawn: { t: 0.1, sky: (c) => [mix(c.dark.surface, c.dark.accent, 0.35), c.dark.accent, c.light.accent, mix(c.light.accent, c.light.bg, 0.6)], ground: (c) => [mix(c.dark.surface, c.dark.accent, 0.3), c.dark.surface, c.dark.bg], body: (c) => c.light.surfaceRaised },
  noon: { t: 0.5, sky: (c) => [mix(c.light.bg, c.light.accent, 0.18), c.light.bg, c.light.surfaceRaised, mix(c.light.surfaceRaised, c.light.accent, 0.22)], ground: (c) => [mix(c.light.surface, c.light.primary, 0.14), mix(c.light.surface, c.light.primary, 0.3), mix(c.light.surface, c.light.primary, 0.5)], body: (c) => c.light.accent },
  dusk: { t: 0.9, sky: (c) => [c.dark.surface, mix(c.dark.surface, c.dark.accent, 0.5), c.dark.accent, c.light.accent], ground: (c) => [mix(c.dark.surface, c.dark.accent, 0.22), c.dark.surface, c.dark.bg], body: (c) => c.light.surfaceRaised },
  night: { t: 0.72, sky: (c) => [c.dark.bg, c.dark.bg, c.dark.surface, c.dark.surfaceRaised], ground: (c) => [c.dark.surfaceRaised, c.dark.surface, c.dark.bg], body: (c) => c.dark.text },
};

const RECIPES = {
  /**
   * A horizon with a sun on its arc at a time of day. `layer` isolates one
   * plane (sky, arc, far, mid, near) on transparency for parallax compositions.
   */
  'horizon-field'({ w, h, rand, dna, variant, layer }) {
    const c = colors(dna, 'light');
    const time = TIMES[variant] || TIMES.noon;
    const sky = time.sky(c);
    const ground = time.ground(c);
    const horizon = h * 0.66;
    const cx = w / 2;
    const rx = w * 0.4;
    const ry = h * 0.5;
    const ang = Math.PI * (1 - time.t);
    const sx = cx + rx * Math.cos(ang);
    const sy = horizon - ry * Math.sin(ang);
    const r = Math.min(w, h) * (variant === 'night' ? 0.035 : 0.06);
    const g = grain(dna);
    const want = (name) => !layer || layer === 'all' || layer === name;
    let body = '';
    if (want('sky')) {
      body += `<rect width="${w}" height="${h}" fill="url(#sky)"/>`;
      if (variant === 'night') {
        for (let i = 0; i < 70; i++) body += `<circle cx="${f(rand() * w)}" cy="${f(rand() * horizon * 0.92)}" r="${f(0.6 + rand() * 1.5)}" fill="${c.dark.text}" opacity="${f(0.25 + rand() * 0.6)}"/>`;
      }
    }
    if (want('arc')) {
      // The day arc with hour ticks: the brand's signature device.
      body += `<path d="M${f(cx - rx)} ${f(horizon)}A${f(rx)} ${f(ry)} 0 0 1 ${f(cx + rx)} ${f(horizon)}" fill="none" stroke="${time.body(c)}" stroke-width="${f(Math.max(1.2, w / 900))}" stroke-dasharray="${f(w / 300)} ${f(w / 110)}" opacity="0.55"/>`;
      body += `<circle cx="${f(sx)}" cy="${f(sy)}" r="${f(r * 2.6)}" fill="${time.body(c)}" opacity="0.14"/><circle cx="${f(sx)}" cy="${f(sy)}" r="${f(r * 1.6)}" fill="${time.body(c)}" opacity="0.2"/><circle cx="${f(sx)}" cy="${f(sy)}" r="${f(r)}" fill="${time.body(c)}"/>`;
    }
    const planes = [['far', horizon - h * 0.02, h * 0.035, ground[0]], ['mid', horizon + h * 0.07, h * 0.045, ground[1]], ['near', horizon + h * 0.19, h * 0.05, ground[2]]];
    for (const [name, y, amp, fill] of planes) {
      const d = ridge(rand, w, h, y, amp); // always consume the same random numbers so layers align
      if (want(name)) body += `<path d="${d}" fill="${fill}"/>`;
    }
    if (!layer || layer === 'all') body += g.layer(w, h);
    return { defs: `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">${sky.map((col, i) => `<stop offset="${f((i / (sky.length - 1)) * 0.72)}" stop-color="${col}"/>`).join('')}</linearGradient>${g.defs}`, body, describe: `Horizon at ${variant || 'noon'} with the sun on its arc` };
  },

  /** Topographic contours around seeded centres. */
  'contour-map'({ w, h, rand, dna, scheme }) {
    const c = colors(dna, scheme);
    const g = grain(dna);
    let body = `<rect width="${w}" height="${h}" fill="${c.bg}"/>`;
    const centres = [0, 1, 2].map(() => ({ x: w * (0.15 + rand() * 0.7), y: h * (0.15 + rand() * 0.7), wob: [0, 1, 2, 3].map(() => ({ k: 2 + Math.floor(rand() * 4), p: rand() * 6.28, a: 0.04 + rand() * 0.07 })) }));
    centres.forEach((ctr, ci) => {
      const levels = 9;
      for (let l = 1; l <= levels; l++) {
        const base = (Math.min(w, h) * 0.52 * l) / levels;
        let d = '';
        const n = 72;
        for (let i = 0; i <= n; i++) {
          const a = (i / n) * Math.PI * 2;
          const rr = base * (1 + ctr.wob.reduce((s, wv) => s + Math.sin(a * wv.k + wv.p) * wv.a, 0));
          d += `${i ? 'L' : 'M'}${f(ctr.x + Math.cos(a) * rr)} ${f(ctr.y + Math.sin(a) * rr)}`;
        }
        body += `<path d="${d}Z" fill="none" stroke="${ci === 0 ? c.accent : c.primary}" stroke-width="${f(Math.max(1, w / 800))}" opacity="${f(0.16 + (1 - l / levels) * 0.5)}"/>`;
      }
      body += `<circle cx="${f(ctr.x)}" cy="${f(ctr.y)}" r="${f(Math.min(w, h) * 0.012)}" fill="${ci === 0 ? c.accent : c.primary}"/>`;
    });
    return { defs: g.defs, body: body + g.layer(w, h), describe: 'Contour field' };
  },

  /** Soft colour bloom: large blurred fields of brand colour. */
  'bloom-mesh'({ w, h, rand, dna, scheme }) {
    const c = colors(dna, scheme);
    const g = grain(dna);
    const pool = [c.accent, c.primary, c.surfaceRaised, mix(c.accent, c.bg, 0.4), mix(c.primary, c.bg, 0.5)];
    let body = `<rect width="${w}" height="${h}" fill="${c.bg}"/><g filter="url(#blur)">`;
    for (let i = 0; i < 6; i++) {
      body += `<ellipse cx="${f(rand() * w)}" cy="${f(rand() * h)}" rx="${f(w * (0.16 + rand() * 0.22))}" ry="${f(h * (0.18 + rand() * 0.26))}" fill="${pool[i % pool.length]}" opacity="${f(0.55 + rand() * 0.3)}"/>`;
    }
    body += '</g>';
    return { defs: `<filter id="blur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${f(Math.min(w, h) * 0.085)}"/></filter>${g.defs}`, body: body + g.layer(w, h), describe: 'Colour bloom' };
  },

  /** Stacked flowing bands, one per data-visualisation colour. */
  'strata-bands'({ w, h, rand, dna, scheme }) {
    const c = colors(dna, scheme);
    const g = grain(dna);
    const fills = [mix(c.bg, c.primary, 0.12), ...c.viz, c.primary];
    let body = `<rect width="${w}" height="${h}" fill="${c.bg}"/>`;
    fills.forEach((fill, i) => {
      body += `<path d="${ridge(rand, w, h, h * (0.2 + (i / fills.length) * 0.75), h * 0.05)}" fill="${fill}"/>`;
    });
    return { defs: g.defs, body: body + g.layer(w, h), describe: 'Layered strata' };
  },

  /** Concentric partial orbits with bodies on them. */
  'orbit-rings'({ w, h, rand, dna, scheme }) {
    const c = colors(dna, scheme);
    const g = grain(dna);
    const cx = w * (0.3 + rand() * 0.4);
    const cy = h * (0.55 + rand() * 0.3);
    let body = `<rect width="${w}" height="${h}" fill="${c.bg}"/>`;
    const rings = 7;
    for (let i = 1; i <= rings; i++) {
      const r = (Math.max(w, h) * 0.75 * i) / rings;
      const a0 = Math.PI * (1.05 + rand() * 0.2);
      const a1 = Math.PI * (1.8 + rand() * 0.2);
      const p = (a) => `${f(cx + r * Math.cos(a))} ${f(cy + r * Math.sin(a))}`;
      body += `<path d="M${p(a0)}A${f(r)} ${f(r)} 0 0 1 ${p(a1)}" fill="none" stroke="${i % 3 === 0 ? c.accent : c.primary}" stroke-width="${f(Math.max(1.2, w / 520))}" stroke-linecap="round" opacity="${f(0.25 + (i / rings) * 0.5)}"/>`;
      const at = a0 + (a1 - a0) * rand();
      body += `<circle cx="${f(cx + r * Math.cos(at))}" cy="${f(cy + r * Math.sin(at))}" r="${f(Math.min(w, h) * (0.008 + rand() * 0.014))}" fill="${i % 2 ? c.accent : c.primary}"/>`;
    }
    return { defs: g.defs, body: body + g.layer(w, h), describe: 'Orbit rings' };
  },

  /** Seamless brand pattern: quarter arcs and dots on a tile grid (Truchet construction). */
  'pattern-tile'({ w, h, rand, dna, scheme }) {
    const c = colors(dna, scheme);
    const n = 6;
    const s = w / n;
    const rows = Math.ceil(h / s);
    let body = `<rect width="${w}" height="${h}" fill="${c.bg}"/>`;
    const sw = f(s * 0.085);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < n; x++) {
        const ox = x * s;
        const oy = y * s;
        const flip = rand() > 0.5;
        const col = rand() > 0.82 ? c.accent : c.primary;
        // Arcs meet tile edges at midpoints, so any rotation tiles seamlessly.
        body += flip
          ? `<path d="M${f(ox + s / 2)} ${f(oy)}A${f(s / 2)} ${f(s / 2)} 0 0 1 ${f(ox)} ${f(oy + s / 2)}M${f(ox + s)} ${f(oy + s / 2)}A${f(s / 2)} ${f(s / 2)} 0 0 0 ${f(ox + s / 2)} ${f(oy + s)}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linecap="round" opacity="0.8"/>`
          : `<path d="M${f(ox + s / 2)} ${f(oy)}A${f(s / 2)} ${f(s / 2)} 0 0 0 ${f(ox + s)} ${f(oy + s / 2)}M${f(ox)} ${f(oy + s / 2)}A${f(s / 2)} ${f(s / 2)} 0 0 1 ${f(ox + s / 2)} ${f(oy + s)}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linecap="round" opacity="0.8"/>`;
        if (rand() > 0.7) body += `<circle cx="${f(ox + s / 2)}" cy="${f(oy + s / 2)}" r="${f(s * 0.07)}" fill="${c.accent}"/>`;
      }
    }
    return { defs: '', body, describe: 'Brand pattern tile' };
  },

  /** Measured grid with a day curve: abstract, data-literate. */
  'grid-instrument'({ w, h, rand, dna, scheme }) {
    const c = colors(dna, scheme);
    const g = grain(dna);
    let body = `<rect width="${w}" height="${h}" fill="${c.bg}"/>`;
    const cols = 24;
    for (let i = 0; i <= cols; i++) body += `<path d="M${f((i / cols) * w)} 0V${h}" stroke="${c.border}" stroke-width="${i % 6 === 0 ? 1.4 : 0.6}" opacity="${i % 6 === 0 ? 0.9 : 0.5}"/>`;
    for (let j = 1; j < 8; j++) body += `<path d="M0 ${f((j / 8) * h)}H${w}" stroke="${c.border}" stroke-width="0.6" opacity="0.5"/>`;
    const curve = (amp, phase, col, fill) => {
      let d = `M0 ${f(h * 0.82)}`;
      for (let i = 0; i <= 96; i++) {
        const t = i / 96;
        const bell = Math.exp(-((t - phase) ** 2) / 0.03);
        d += `L${f(t * w)} ${f(h * 0.82 - bell * h * amp - Math.sin(t * 40 + rand()) * h * 0.004)}`;
      }
      return `<path d="${d}L${w} ${f(h * 0.82)}Z" fill="${fill}" opacity="0.22"/><path d="${d}" fill="none" stroke="${col}" stroke-width="${f(Math.max(2, w / 420))}" stroke-linejoin="round"/>`;
    };
    body += curve(0.56, 0.5, c.viz[0], c.viz[0]) + curve(0.3, 0.78, c.viz[1 % c.viz.length], c.viz[1 % c.viz.length]);
    return { defs: g.defs, body: body + g.layer(w, h), describe: 'Instrument grid with day curves' };
  },
};

export function recipeNames() {
  return Object.keys(RECIPES);
}

/**
 * Render one job to an SVG string. `overlayMarkup` (already-outlined logo and
 * headline paths) is placed on top by the caller, so brand text is exact.
 */
export function renderSvg(job, dna, { overlayMarkup = '' } = {}) {
  const recipe = RECIPES[job.recipe];
  if (!recipe) throw new CisError('E_RECIPE', `Unknown recipe "${job.recipe}". Known: ${recipeNames().join(', ')}`);
  const motifs = dna.imagery.motifs;
  const w = job.width;
  const h = job.height;
  const seed = job.seed ?? `${dna.project.id}:${job.id}`;
  const out = recipe({ w, h, rand: rng(`${seed}:${job.recipe}`), dna, variant: job.variant, layer: job.layer, scheme: job.scheme || dna.color.defaultScheme || 'light', motifs });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><defs>${out.defs}</defs>${out.body}${overlayMarkup}</svg>\n`;
  return { svg, describe: out.describe, seed: String(seed), parameters: { recipe: job.recipe, variant: job.variant || null, layer: job.layer || null, scheme: job.scheme || dna.color.defaultScheme || 'light', width: w, height: h, dnaRevision: dna.revision } };
}
