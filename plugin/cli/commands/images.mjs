// Image and visual asset factory commands.
import path from 'node:path';
import { CisError, EXIT, readJson, exists, print, table, fmtBytes } from '../lib/util.mjs';
import { requireProject, paths } from '../lib/project.mjs';
import { loadDna } from '../lib/dna.mjs';
import { produce, verifyRegistry, loadRegistry, loadCost } from '../lib/assets.mjs';
import { listProviders, getProvider } from '../lib/providers.mjs';
import { recipeNames } from '../lib/imagegen.mjs';
import { hasCapability } from '../lib/deps.mjs';

const json = (flags, value) => (flags.json ? (print(JSON.stringify(value, null, 2)), true) : false);

/** Build outlined logo + headline markup for a job's overlay, from the brand spec. */
async function overlayBuilder(root, dna) {
  const specFile = path.join(paths(root).cis, 'brand-spec.json');
  if (!exists(specFile) || !hasCapability('vector')) return null;
  const { buildMarks, loadBrandSpec } = await import('./brand.mjs');
  const { lockup, symbolMarkup } = await import('../lib/logo.mjs');
  const { loadFont, textToPath } = await import('../lib/fonts.mjs');
  const spec = loadBrandSpec(root);
  const marks = buildMarks(dna, spec);
  const sym = marks.symbols[spec.selected];
  return async (job) => {
    const o = job.overlay;
    const dark = ['dusk', 'night', 'dawn'].includes(job.variant) || job.scheme === 'dark';
    const s = dna.color.semantic[dark ? 'dark' : 'light'];
    const colors = dark ? { primary: s.primary, accent: s.text, text: s.text } : { primary: s.primary, accent: s.accent, text: s.text };
    const m = Math.round(Math.min(job.width, job.height) * 0.07);
    let out = '';
    if (o.logo && o.logo !== 'none') {
      const size = Math.round(Math.min(job.width, job.height) * 0.085);
      const lk = o.logo === 'symbol' ? { w: size, h: size, body: symbolMarkup(sym, { size, primary: colors.primary, accent: colors.accent }) } : lockup(sym, marks.word, { layout: 'horizontal', symbolSize: size, colors, clear: 0 });
      const pos = o.logoPosition || 'top-left';
      const x = pos.endsWith('right') ? job.width - m - lk.w : pos === 'center' ? (job.width - lk.w) / 2 : m;
      const y = pos.startsWith('bottom') ? job.height - m - lk.h : pos === 'center' ? (job.height - lk.h) / 2 : m;
      out += `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})">${lk.body}</g>`;
    }
    if (o.headline) {
      const font = loadFont(dna.typography.display, spec.wordmark.weight);
      const size = Math.round(job.width * 0.07);
      const lines = [''];
      const maxW = job.width - m * 2;
      for (const w of o.headline.split(' ')) {
        const trial = (lines.at(-1) + ' ' + w).trim();
        if (textToPath(font, trial, { size }).width > maxW && lines.at(-1)) lines.push(w);
        else lines[lines.length - 1] = trial;
      }
      const top = job.height * 0.42;
      lines.forEach((line, i) => {
        const p = textToPath(font, line, { size, tracking: dna.typography.scale.displayTracking ?? 0 });
        out += `<path fill="${s.text}" transform="translate(${m} ${(top + i * size * 1.08).toFixed(1)})" d="${p.d}"/>`;
      });
      if (o.kicker) {
        const tf = loadFont(dna.typography.text, 500);
        const p = textToPath(tf, o.kicker.toUpperCase(), { size: Math.round(size * 0.26), tracking: 0.08 });
        out += `<path fill="${s.text}" opacity="0.82" transform="translate(${m} ${(top - size * 1.25).toFixed(1)})" d="${p.d}"/>`;
      }
    }
    return out;
  };
}

async function images({ _, flags }) {
  const sub = _[0] || 'generate';
  if (sub === 'providers') {
    const list = listProviders();
    if (json(flags, { providers: list, recipes: recipeNames() })) return;
    print(table(list.map((p) => [p.id, p.kind, p.available.ok ? 'available' : `unavailable: ${p.available.reason}`, Object.entries(p.capabilities).filter(([, v]) => v === true).map(([k]) => k).join(', ')]), ['provider', 'kind', 'status', 'capabilities']));
    print(`\nLocal recipes: ${recipeNames().join(', ')}`);
    return;
  }
  const root = requireProject(flags.project);
  if (sub === 'estimate' || sub === 'generate') {
    const briefFile = flags.brief ? path.resolve(flags.brief) : path.join(paths(root).cis, 'image-brief.json');
    if (!exists(briefFile)) throw new CisError('E_READ', `No image brief at ${path.relative(root, briefFile)}. Author one (see the image-asset-factory skill).`);
    const brief = readJson(briefFile);
    const dna = loadDna(root);
    const providerId = flags.provider || brief.provider || 'local-procedural';
    if (sub === 'estimate') {
      const p = getProvider(providerId);
      const rows = brief.jobs.map((j) => [j.id, `${j.width}x${j.height}`, j.formats.join(','), `$${p.estimateCostUsd(j).toFixed(3)}`]);
      const total = brief.jobs.reduce((n, j) => n + p.estimateCostUsd(j), 0);
      const cost = loadCost(root);
      if (json(flags, { provider: providerId, estimateUsd: total, remainingUsd: cost.budgetUsd - cost.spentUsd, jobs: brief.jobs.length })) return;
      print(table(rows, ['job', 'size', 'formats', 'estimate']));
      print(`\nTotal estimate on ${providerId}: $${total.toFixed(3)}. Remaining project budget: $${(cost.budgetUsd - cost.spentUsd).toFixed(2)}. Estimates are indicative, not quotes.`);
      return;
    }
    const controller = new AbortController();
    const onSigint = () => controller.abort();
    process.once('SIGINT', onSigint);
    let res;
    try {
      if (!flags.json) print(`Producing ${brief.jobs.length} job(s) with ${providerId} ...`);
      res = await produce(root, brief, dna, { providerId, consent: Boolean(flags.consent), force: Boolean(flags.force), signal: controller.signal, overlayFor: await overlayBuilder(root, dna), log: flags.json ? () => {} : print });
    } finally {
      process.removeListener('SIGINT', onSigint);
    }
    const failed = res.results.filter((r) => r.status === 'failed' || r.status === 'cancelled');
    if (json(flags, { ok: failed.length === 0, provider: res.provider, results: res.results.map(({ record, ...r }) => r), spentUsd: res.cost.spentUsd, budgetUsd: res.cost.budgetUsd })) return failed.length ? EXIT.FAIL : EXIT.OK;
    const count = (s) => res.results.filter((r) => r.status === s).length;
    print(`\n${count('generated')} generated, ${count('cached')} reused, ${failed.length} failed. Spent $${res.cost.spentUsd.toFixed(3)} of $${res.cost.budgetUsd.toFixed(2)}.`);
    for (const r of failed) print(`  ${r.id}: ${r.error || r.status}`);
    return failed.length ? EXIT.FAIL : EXIT.OK;
  }
  if (sub === 'verify') {
    const v = verifyRegistry(root);
    if (json(flags, { ok: v.problems.length === 0, ...v })) return v.problems.length ? EXIT.FAIL : EXIT.OK;
    print(v.problems.length ? table(v.problems.map((p) => [p.asset, p.file, p.problem]), ['asset', 'file', 'problem']) : `Registry intact: ${v.count} assets, ${v.files} files, every hash matches.`);
    return v.problems.length ? EXIT.FAIL : EXIT.OK;
  }
  if (sub === 'list') {
    const reg = loadRegistry(root);
    if (json(flags, reg)) return;
    print(table(reg.assets.map((a) => [a.id, a.kind, a.origin.provider || a.origin.type, a.qa.status, a.clientApproval, a.files.length, fmtBytes(a.files.reduce((n, x) => n + x.bytes, 0))]), ['asset', 'kind', 'origin', 'qa', 'client', 'files', 'size']));
    return;
  }
  throw new CisError('E_USAGE', `Unknown images subcommand "${sub}".`, { exit: EXIT.USAGE });
}

export const commands = [
  { name: 'images', group: 'Production', summary: 'Generate, inspect, register and verify visual assets', run: images, usage: `
creative-studio images providers [--json]          engines, availability and capabilities
creative-studio images estimate [--provider id]    cost estimate against the remaining budget
creative-studio images generate [--provider id] [--brief file] [--consent] [--force] [--json]
creative-studio images verify                      re-hash every registered file
creative-studio images list

Default provider is local-procedural (offline, free, deterministic). Remote
providers are refused when the brief sets externalUploads to "deny", need
--consent when it is "ask", and stop when the project budget would be exceeded.
Each output is checked for exact dimensions, blank renders, palette adherence,
byte budget and near-duplicates before it is registered with provenance.` },
];
