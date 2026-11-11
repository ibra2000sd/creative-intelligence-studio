// Experience DNA, creative directions and motion commands.
import fs from 'node:fs';
import path from 'node:path';
import { CisError, EXIT, readJson, writeJson, writeFileAtomic, exists, print, table, contrast, hexToOklch, nowIso } from '../lib/util.mjs';
import { validate, assertValid } from '../lib/schema.mjs';
import { requireProject, paths, appendEvent, loadState, loadBrief } from '../lib/project.mjs';
import { loadDna, lintDna, writeTokens, bumpDna, diffDna, fingerprint, similarity, consistency, aspectOf } from '../lib/dna.mjs';
import { decide, chooseRuntime, lintMotion, maxDuration } from '../lib/motion.mjs';

const json = (flags, value) => (flags.json ? (print(JSON.stringify(value, null, 2)), true) : false);

export const DELIVERABLE_DIRS = [
  { id: 'brand', dir: 'brand', tokenFiles: [] },
  { id: 'website', dir: 'web', tokenFiles: [['src/dna/tokens.css', 'css']] },
  { id: 'web-app', dir: 'app', tokenFiles: [['src/dna/tokens.css', 'css']] },
  { id: 'mobile', dir: 'mobile', tokenFiles: [['src/dna/theme.ts', 'ts']] },
  { id: 'scene-3d', dir: 'scene', tokenFiles: [['src/dna/scene.json', 'json']] },
];

async function dna({ _, flags }) {
  const root = requireProject(flags.project);
  const p = paths(root);
  const sub = _[0] || 'check';

  if (sub === 'template') {
    print(JSON.stringify(readJson(path.join(import.meta.dirname, '..', '..', 'templates', 'experience-dna.example.json')), null, 2));
    return;
  }
  if (sub === 'check') {
    const data = readJson(p.dna);
    const res = validate('experience-dna', data);
    const issues = res.valid ? lintDna(data) : [];
    const errors = issues.filter((i) => i.level === 'error');
    const ok = res.valid && errors.length === 0;
    if (json(flags, { ok, schemaErrors: res.errors, issues })) return ok ? EXIT.OK : EXIT.FAIL;
    if (!res.valid) {
      print(`Experience DNA violates its contract:\n${res.errors.map((e) => `  ${e.path || '/'} ${e.message}`).join('\n')}`);
      return EXIT.FAIL;
    }
    print(`Experience DNA r${data.revision} (${data.status}): schema valid, ${errors.length} error(s), ${issues.length - errors.length} warning(s).`);
    if (issues.length) print(table(issues.map((i) => [i.level, i.path, i.message]), ['level', 'path', 'message']));
    return ok ? EXIT.OK : EXIT.FAIL;
  }
  if (sub === 'tokens') {
    const data = loadDna(root);
    const errors = lintDna(data).filter((i) => i.level === 'error');
    if (errors.length) throw new CisError('E_DNA_LINT', `Fix DNA errors before exporting tokens:\n${errors.map((e) => `  ${e.path} ${e.message}`).join('\n')}`);
    const files = writeTokens(root, data);
    if (json(flags, { ok: true, revision: data.revision, files })) return;
    print(`Exported tokens from DNA r${data.revision}:\n  ${files.join('\n  ')}`);
    return;
  }
  if (sub === 'bump') {
    if (!flags.from) throw new CisError('E_USAGE', 'Usage: creative-studio dna bump --from <edited-dna.json> --reason "..." [--revision-request rev-001]', { exit: EXIT.USAGE });
    const next = readJson(path.resolve(flags.from));
    if (flags['revision-request']) {
      // A scoped revision may not touch aspects the client asked to preserve.
      const rr = readJson(path.join(p.revisions, `${flags['revision-request']}.json`));
      const current = readJson(p.dna);
      const touched = [...new Set(diffDna(current, next).map((c) => aspectOf(c.path)))];
      const violated = touched.filter((a) => rr.preserve.includes(a));
      if (violated.length) {
        throw new CisError('E_PRESERVE', `This DNA change touches aspects ${rr.id} asked to preserve: ${violated.join(', ')}. Narrow the change or get the request amended.`, { exit: EXIT.BLOCKED });
      }
    }
    const res = bumpDna(root, next, { reason: flags.reason, actor: flags.actor || 'cli' });
    if (json(flags, { ok: true, ...res })) return;
    print(`Experience DNA is now r${res.revision} (${res.changes.length} value(s) changed). Status reset to "proposed" if it was approved; regenerate tokens with \`creative-studio dna tokens\`.`);
    if (res.changes.length) print(table(res.changes.slice(0, 30).map((c) => [c.path, String(c.from), String(c.to)]), ['path', 'from', 'to']));
    return;
  }
  if (sub === 'approve') {
    // Marks the DNA approved once the human gate has been recorded.
    const state = loadState(root);
    const gate = state?.gates.find((g) => g.id === 'G2-system');
    if (!gate || gate.status !== 'approved') throw new CisError('E_GATE_NOT_READY', 'Gate G2-system has not been approved by a person. Use `creative-studio approve G2-system --actor "<name>"`.', { exit: EXIT.BLOCKED });
    const data = loadDna(root);
    data.status = 'approved';
    data.updatedAt = nowIso();
    writeJson(p.dna, data);
    appendEvent(root, { type: 'dna.approved', actor: gate.decision.actor, data: { revision: data.revision, simulated: gate.decision.simulated } });
    print(`Experience DNA r${data.revision} marked approved (decided by ${gate.decision.actor}${gate.decision.simulated ? ', SIMULATED' : ''}).`);
    return;
  }
  if (sub === 'diff') {
    const a = readJson(path.join(p.dnaVersions, `r${String(_[1]).padStart(3, '0')}.json`));
    const b = _[2] ? readJson(path.join(p.dnaVersions, `r${String(_[2]).padStart(3, '0')}.json`)) : readJson(p.dna);
    const changes = diffDna(a, b);
    if (json(flags, changes)) return;
    print(changes.length ? table(changes.map((c) => [c.path, String(c.from), String(c.to), aspectOf(c.path)]), ['path', 'from', 'to', 'aspect']) : 'No differences.');
    return;
  }
  if (sub === 'fingerprint') {
    const data = loadDna(root);
    const fp = fingerprint(data);
    // Compare against fingerprints the studio has chosen to keep. Stored
    // fingerprints hold design categories only, never client content.
    const registry = flags.registry ? path.resolve(flags.registry) : null;
    const others = registry && exists(registry) ? readJson(registry).projects : [];
    const matches = others
      .filter((o) => o.id !== data.project.id)
      .map((o) => ({ id: o.id, ...similarity(fp, o.fingerprint) }))
      .sort((x, y) => y.score - x.score);
    const flagged = matches.filter((m) => m.score >= 0.7);
    if (flags.record && registry) {
      const next = { projects: [...others.filter((o) => o.id !== data.project.id), { id: data.project.id, recordedOn: nowIso().slice(0, 10), fingerprint: fp }] };
      writeJson(registry, next);
    }
    if (json(flags, { fingerprint: fp, matches, flagged: flagged.map((m) => m.id) })) return;
    print(table(Object.entries(fp), ['axis', 'value']));
    if (matches.length) print('\n' + table(matches.map((m) => [m.id, `${Math.round(m.score * 100)}%`, m.shared.join(', ')]), ['project', 'overlap', 'shared axes']));
    if (flagged.length) print(`\nReview needed: this direction overlaps 70% or more with ${flagged.map((m) => m.id).join(', ')}. That is a prompt for a human look, not a verdict.`);
    return;
  }
  if (sub === 'consistency') {
    const data = loadDna(root);
    const present = DELIVERABLE_DIRS.filter((d) => exists(path.join(root, d.dir)));
    const report = consistency(root, data, present);
    writeJson(path.join(p.reports, 'consistency.json'), report);
    appendEvent(root, { type: 'dna.consistency-checked', data: { ok: report.ok, deliverables: report.deliverables.map((d) => d.id) } });
    if (json(flags, report)) return report.ok ? EXIT.OK : EXIT.FAIL;
    print(`Consistency against DNA r${data.revision}: ${report.ok ? 'every deliverable matches' : 'DRIFT FOUND'}\n`);
    print(table(report.deliverables.map((d) => [d.id, d.tokens, d.dnaRevision ?? '-', d.filesScanned, d.offPalette.length, d.foreignFonts.length]), ['deliverable', 'tokens', 'dna rev', 'files', 'off-palette colours', 'foreign fonts']));
    for (const d of report.deliverables) {
      for (const c of d.offPalette.slice(0, 8)) print(`  ${d.id}: ${c.hex} in ${c.file} (distance ${c.distance} from nearest palette colour)`);
      for (const f of d.foreignFonts.slice(0, 8)) print(`  ${d.id}: font "${f.family}" in ${f.file} is not in the DNA`);
    }
    return report.ok ? EXIT.OK : EXIT.FAIL;
  }
  throw new CisError('E_USAGE', `Unknown dna subcommand "${sub}". Run \`creative-studio help dna\`.`, { exit: EXIT.USAGE });
}

// ------------------------------------------------------------ directions -----

function loadDirections(root) {
  const dir = paths(root).directions;
  if (!exists(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json') && f !== 'selection.json')
    .sort()
    .map((f) => ({ file: f, data: readJson(path.join(dir, f)) }));
}

function directionAxes(d) {
  const o = hexToOklch(d.palette.primary);
  const bg = hexToOklch(d.palette.bg);
  return {
    grammar: d.layoutGrammar,
    primaryHue: o.c < 0.03 ? 'neutral' : `h${Math.round(o.h / 45) * 45}`,
    ground: bg.l > 0.85 ? 'bright' : bg.l > 0.45 ? 'mid' : 'dark',
    display: d.typography.display.toLowerCase(),
    motion: d.motion.intensity,
    motif: [...d.imagery.motifs].sort()[0],
  };
}

function checkDirections(dirs) {
  const problems = [];
  for (const { file, data } of dirs) {
    const res = validate('direction', data);
    for (const e of res.errors) problems.push(`${file}: ${e.path} ${e.message}`);
    if (res.valid) {
      if (contrast(data.palette.text, data.palette.bg) < 4.5) problems.push(`${file}: text on bg is ${contrast(data.palette.text, data.palette.bg).toFixed(2)}:1, below 4.5:1`);
      if (/\b(apple|ios 2[0-9]|liquid glass)\b/i.test(`${data.title} ${data.concept}`) && !/inspired|principles/i.test(data.concept)) {
        problems.push(`${file}: describes itself as another company's design language; state what is borrowed as a principle and what is original`);
      }
    }
  }
  if (dirs.length < 2) problems.push(`Only ${dirs.length} direction(s) found; propose at least two genuinely different territories when the visual direction is a meaningful choice.`);
  const pairs = [];
  const valid = dirs.filter(({ data }) => validate('direction', data).valid);
  for (let i = 0; i < valid.length; i++) {
    for (let j = i + 1; j < valid.length; j++) {
      const a = directionAxes(valid[i].data);
      const b = directionAxes(valid[j].data);
      const differing = Object.keys(a).filter((k) => a[k] !== b[k]);
      pairs.push({ a: valid[i].data.id, b: valid[j].data.id, differing });
      if (differing.length < 3) problems.push(`"${valid[i].data.id}" and "${valid[j].data.id}" differ on only ${differing.length} of 6 axes (${differing.join(', ') || 'none'}); they are variations, not distinct directions.`);
    }
  }
  return { problems, pairs };
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

function boardHtml(brief, dirs, selection) {
  const card = (d) => {
    const p = d.palette;
    const sw = [p.bg, p.text, p.primary, p.accent, ...(p.support || [])];
    const fit = d.fitScore ? Object.entries(d.fitScore).map(([k, v]) => `<li><span>${esc(k)}</span><b>${v}/5</b></li>`).join('') : '';
    return `<article class="dir${selection?.id === d.id ? ' chosen' : ''}" style="--bg:${p.bg};--fg:${p.text};--pri:${p.primary};--acc:${p.accent}">
  <header><p class="id">${esc(d.id)}${selection?.id === d.id ? ' · selected' : ''}</p><h2 style="font-family:'${esc(d.typography.display)}',Georgia,serif">${esc(d.title)}</h2></header>
  <div class="specimen" aria-hidden="true"><span class="big" style="font-family:'${esc(d.typography.display)}',Georgia,serif">${esc(brief.client.name)}</span><span class="rule"></span><span class="chip">${esc(d.layoutGrammar)}</span><span class="dot"></span></div>
  <ul class="swatches">${sw.map((h) => `<li style="background:${h}"><code>${h}</code></li>`).join('')}</ul>
  <p>${esc(d.concept)}</p>
  <dl>
    <dt>Why it fits</dt><dd>${esc(d.rationale)}</dd>
    <dt>Feels</dt><dd>${esc(d.emotionalIntent)}</dd>
    <dt>Type</dt><dd>${esc(d.typography.display)} / ${esc(d.typography.text)}${d.typography.character ? `: ${esc(d.typography.character)}` : ''}</dd>
    <dt>Motion</dt><dd>${esc(d.motion.intensity)}: ${esc(d.motion.personality)}</dd>
    <dt>Imagery</dt><dd>${esc(d.imagery.style)} (${d.imagery.motifs.map(esc).join(', ')})</dd>
    <dt>Signature</dt><dd>${esc(d.signature)}</dd>
    <dt>Usability</dt><dd>${(d.usabilityImplications || []).map(esc).join(' ') || 'Not stated'}</dd>
    <dt>Needs</dt><dd>${(d.technicalRequirements || []).map(esc).join(' ') || 'Not stated'}</dd>
    <dt>Risks</dt><dd>${d.risks.map(esc).join(' ')}</dd>
    <dt>Effort</dt><dd>${esc(d.effort)}</dd>
  </dl>
  ${fit ? `<ul class="fit" aria-label="Agent self-evaluation against the brief">${fit}</ul><p class="note">Scores are the proposing agent's own evaluation. They are not an approval.</p>` : ''}
</article>`;
  };
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Creative directions: ${esc(brief.name)}</title>
<style>
*{box-sizing:border-box}body{margin:0;font:16px/1.55 ui-sans-serif,system-ui,sans-serif;background:#f3f1ec;color:#1a1916}
main{max-width:1500px;margin:0 auto;padding:40px clamp(16px,4vw,56px) 80px}
h1{font-size:clamp(1.6rem,3vw,2.4rem);margin:0 0 6px}.lede{max-width:70ch;color:#55524a;margin:0 0 32px}
.grid{display:grid;gap:24px;grid-template-columns:repeat(auto-fit,minmax(min(100%,400px),1fr))}
.dir{background:#fff;border:1px solid #dcd8cd;border-radius:14px;padding:24px;display:flex;flex-direction:column;gap:14px}
.dir.chosen{outline:3px solid #1a1916;outline-offset:3px}.id{font:600 12px/1 ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;color:#6a665c;margin:0 0 8px}
h2{margin:0;font-size:1.7rem;line-height:1.1}
.specimen{background:var(--bg);color:var(--fg);border-radius:10px;padding:28px 22px;min-height:170px;position:relative;display:flex;flex-direction:column;justify-content:flex-end;gap:10px;overflow:hidden;border:1px solid rgba(0,0,0,.08)}
.big{font-size:2.6rem;line-height:1;letter-spacing:-.02em}.rule{height:3px;width:44%;background:var(--pri)}
.chip{align-self:flex-start;background:var(--pri);color:var(--bg);font:600 11px/1 ui-monospace,monospace;padding:6px 9px;border-radius:99px;letter-spacing:.06em;text-transform:uppercase}
.dot{position:absolute;inset-inline-end:22px;top:22px;width:56px;height:56px;border-radius:50%;background:var(--acc)}
.swatches{list-style:none;margin:0;padding:0;display:flex;border-radius:8px;overflow:hidden;border:1px solid #dcd8cd}.swatches li{flex:1;height:54px;display:flex;align-items:flex-end}
.swatches code{font-size:10px;background:rgba(255,255,255,.86);color:#111;padding:2px 4px;margin:3px;border-radius:3px}
dl{margin:0;display:grid;grid-template-columns:auto 1fr;gap:6px 14px;font-size:.92rem}dt{font-weight:650;color:#3c3a34}dd{margin:0;color:#45423b}
.fit{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:6px}.fit li{border:1px solid #dcd8cd;border-radius:99px;padding:3px 10px;font-size:.8rem;display:flex;gap:6px}
.note{font-size:.8rem;color:#6a665c;margin:0}
</style></head><body><main>
<h1>Creative directions for ${esc(brief.name)}</h1>
<p class="lede">${dirs.length} territories proposed against the brief. Choosing one is a client decision recorded at gate G1; nothing downstream starts before it.${selection ? ` Selected: <strong>${esc(selection.id)}</strong> (${esc(selection.reason)}).` : ''}</p>
<div class="grid">${dirs.map(card).join('\n')}</div>
</main></body></html>`;
}

async function directions({ _, flags }) {
  const root = requireProject(flags.project);
  const p = paths(root);
  const sub = _[0] || 'check';
  const dirs = loadDirections(root);
  if (sub === 'check') {
    const { problems, pairs } = checkDirections(dirs);
    if (json(flags, { ok: problems.length === 0, count: dirs.length, problems, pairs })) return problems.length ? EXIT.FAIL : EXIT.OK;
    print(`${dirs.length} direction(s).`);
    if (pairs.length) print(table(pairs.map((x) => [x.a, x.b, x.differing.length, x.differing.join(', ')]), ['a', 'b', 'axes that differ', 'which']));
    if (problems.length) print(`\nProblems:\n  - ${problems.join('\n  - ')}`);
    return problems.length ? EXIT.FAIL : EXIT.OK;
  }
  if (sub === 'board') {
    const { problems } = checkDirections(dirs);
    if (problems.length) throw new CisError('E_DIRECTIONS', `Fix the directions before presenting them:\n  - ${problems.join('\n  - ')}`);
    const sel = exists(path.join(p.directions, 'selection.json')) ? readJson(path.join(p.directions, 'selection.json')) : null;
    const out = path.join(p.reports, 'directions.html');
    writeFileAtomic(out, boardHtml(loadBrief(root), dirs.map((d) => d.data), sel));
    appendEvent(root, { type: 'direction.proposed', data: { ids: dirs.map((d) => d.data.id) } });
    if (json(flags, { ok: true, file: path.relative(root, out) })) return;
    print(`Wrote ${path.relative(root, out)}. Show it to the client, then record their choice with \`creative-studio directions select <id> --reason "..."\` and \`creative-studio approve G1-direction --actor "<name>"\`.`);
    return;
  }
  if (sub === 'select') {
    const id = _[1];
    const hit = dirs.find((d) => d.data.id === id);
    if (!hit) throw new CisError('E_USAGE', `Unknown direction "${id}". Known: ${dirs.map((d) => d.data.id).join(', ')}`, { exit: EXIT.USAGE });
    if (!flags.reason) throw new CisError('E_USAGE', 'Selecting a direction needs --reason "..." so the decision is documented.', { exit: EXIT.USAGE });
    writeJson(path.join(p.directions, 'selection.json'), { id, reason: String(flags.reason), selectedAt: nowIso(), rejected: dirs.filter((d) => d.data.id !== id).map((d) => d.data.id) });
    appendEvent(root, { type: 'direction.selected', actor: flags.actor || 'cli', data: { id, reason: String(flags.reason) } });
    if (json(flags, { ok: true, id })) return;
    print(`Recorded "${id}" as the selected direction. It still needs human approval at gate G1-direction.`);
    return;
  }
  throw new CisError('E_USAGE', `Unknown directions subcommand "${sub}".`, { exit: EXIT.USAGE });
}

// ---------------------------------------------------------------- motion -----

async function motion({ _, flags }) {
  const sub = _[0] || 'check';
  if (sub === 'decide') {
    const root = requireProject(flags.project);
    const data = loadDna(root);
    const m = {
      surface: flags.surface || 'application',
      intent: flags.intent,
      trigger: flags.trigger,
      frequency: flags.frequency,
      properties: flags.properties ? String(flags.properties).split(',') : ['transform', 'opacity'],
      gestureDriven: Boolean(flags.gesture),
      interruptible: Boolean(flags.interruptible),
      duration: flags.duration,
      easing: flags.easing,
    };
    for (const k of ['intent', 'trigger', 'frequency']) if (!m[k]) throw new CisError('E_USAGE', 'Usage: creative-studio motion decide --surface <marketing|application|mobile|3d> --intent <...> --trigger <...> --frequency <...> [--properties transform,opacity] [--framework react]', { exit: EXIT.USAGE });
    const d = decide(m, data);
    const r = d.decision === 'animate' ? chooseRuntime(m, { framework: flags.framework }) : null;
    const out = { ...d, ...(r ? { runtime: r.runtime, runtimeWhy: r.why, maxDuration: maxDuration(m), durationsMs: data.motion.durations, reducedMotion: data.motion.reducedMotion } : {}) };
    if (json(flags, out)) return;
    print(`Decision: ${d.decision.toUpperCase()}: ${d.why}`);
    if (r) print(`Runtime: ${r.runtime}: ${r.why}\nDuration ceiling: ${out.maxDuration}. Reduced-motion strategy from the DNA: ${data.motion.reducedMotion}.`);
    return;
  }
  if (sub === 'check') {
    const root = requireProject(flags.project);
    const data = loadDna(root);
    const file = flags.file ? path.resolve(flags.file) : paths(root).motion;
    const spec = assertValid('motion-spec', readJson(file), 'Motion spec');
    const { issues, summary } = lintMotion(spec, data);
    const errors = issues.filter((i) => i.level === 'error');
    if (json(flags, { ok: errors.length === 0, summary, issues })) return errors.length ? EXIT.FAIL : EXIT.OK;
    print(`Motion spec: ${summary.total} behaviours, ${summary.animate} animated, ${summary.none} deliberately still.`);
    print(`Runtimes: ${Object.entries(summary.runtimes).map(([k, v]) => `${k}: ${v.join(', ')}`).join(' | ')}`);
    if (issues.length) print('\n' + table(issues.map((i) => [i.level, i.motion, i.message]), ['level', 'motion', 'message']));
    return errors.length ? EXIT.FAIL : EXIT.OK;
  }
  throw new CisError('E_USAGE', `Unknown motion subcommand "${sub}".`, { exit: EXIT.USAGE });
}

export const commands = [
  { name: 'dna', group: 'Experience DNA', summary: 'Check, version, export and compare the Experience DNA', run: dna, usage: `
creative-studio dna check [--json]            schema + semantic lint (contrast, licences, motion sanity, RTL)
creative-studio dna tokens                    write design-system/{tokens.css,tokens.json,theme.ts,scene.json}
creative-studio dna bump --from <file> --reason "..." [--revision-request rev-001]
creative-studio dna approve                   mark approved after gate G2-system has a human decision
creative-studio dna diff <revA> [revB]
creative-studio dna fingerprint [--registry <studio-fingerprints.json>] [--record]
creative-studio dna consistency [--json]      verify every deliverable still matches the DNA
creative-studio dna template` },
  { name: 'directions', group: 'Experience DNA', summary: 'Validate, present and select creative directions', run: directions, usage: `
creative-studio directions check [--json]     contracts, contrast, and pairwise distinctness (>= 3 of 6 axes)
creative-studio directions board              render .cis/reports/directions.html for the client
creative-studio directions select <id> --reason "..."` },
  { name: 'motion', group: 'Experience DNA', summary: 'Decide, route and lint motion', run: motion, usage: `
creative-studio motion decide --surface <marketing|application|mobile|3d> --intent <orientation|feedback|continuity|explanation|storytelling|delight|status>
                              --trigger <load|scroll|hover|press|drag|state-change|route-change|data-update|in-view>
                              --frequency <constant|frequent|occasional|rare|once> [--properties transform,opacity] [--framework react]
creative-studio motion check [--file motion-spec.json] [--json]

"decide" may answer NONE: not animating is a valid, recorded outcome.` },
];
