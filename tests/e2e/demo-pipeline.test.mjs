// End-to-end: reproduce the whole demonstration from its inputs in an empty
// directory (light run: everything that needs no package install), then check
// the regression goldens for outputs that must stay stable between versions.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { REPO, cs, tmpDir, readJson, fixture } from '../helpers.mjs';
import { listZip } from '../../plugin/cli/lib/zip.mjs';
import { tokensCss, tokensTs } from '../../plugin/cli/lib/dna.mjs';
import { buildPlan } from '../../plugin/cli/lib/orchestrator.mjs';
import { renderSvg } from '../../plugin/cli/lib/imagegen.mjs';
import { buildSymbol } from '../../plugin/cli/lib/logo.mjs';
import { batteryParts, checkGeometry } from '../../plugin/cli/lib/model3d.mjs';

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
let dir;

test('the demonstration reproduces from its inputs in a clean directory', { timeout: 600000 }, () => {
  dir = path.join(tmpDir('cis-e2e-'), 'haldora');
  const r = spawnSync(process.execPath, [path.join(REPO, 'scripts/run-demo.mjs'), '--dir', dir], { encoding: 'utf8', timeout: 580000 });
  assert.equal(r.status, 0, r.stdout.split('\n').slice(-30).join('\n') + r.stderr);
  const run = readJson(path.join(dir, '.cis/reports/demo-run.json'));
  assert.ok(run.commands.length > 50, `${run.commands.length} commands executed`);
});

test('orchestration: production tasks are done, human gates are simulated and labelled', () => {
  const status = cs(['status', '--json'], { cwd: dir }).json;
  const byId = Object.fromEntries(status.tasks.map((t) => [t.id, t.status]));
  for (const id of ['intake', 'research', 'directions', 'dna', 'motion-spec', 'brand', 'images', 'scene-3d', 'website', 'web-app', 'mobile', 'consistency']) assert.equal(byId[id], 'done', id);
  assert.notEqual(byId['creative-review'], 'done', 'the independent review is not fabricated by the demo');
  assert.notEqual(byId.export, 'done');
  const gates = Object.fromEntries(status.gates.map((g) => [g.id, g]));
  for (const id of ['G0-brief', 'G1-direction', 'G2-system']) assert.equal(gates[id].decision.simulated, true, `${id} is marked simulated`);
  assert.equal(gates['G6-quality'].status, 'pending');
  assert.equal(gates['G7-acceptance'].status, 'pending');
  assert.equal(status.ledger.ok, true);
  assert.equal(readJson(path.join(dir, '.cis/dna/experience-dna.json')).status, 'approved');
});

test('brand: an editable vector identity with a complete, verified kit', () => {
  const m = readJson(path.join(dir, 'brand/brand-manifest.json'));
  assert.equal(m.ok, true);
  assert.ok(m.files.length >= 70, `${m.files.length} files`);
  assert.ok(m.checks.vectorIntegrity.length >= 20 && m.checks.vectorIntegrity.every((v) => v.pass));
  assert.ok(m.checks.rasterDimensions.every((x) => x.pass));
  assert.deepEqual(m.checks.missingAssets, []);
  const logo = fs.readFileSync(path.join(dir, 'brand/logo/haldora-lockup-horizontal.svg'), 'utf8');
  assert.ok(!/<text|<image/.test(logo) && /<path/.test(logo), 'outlined paths only');
  for (const f of ['brand/guidelines.html', 'brand/guidelines.pdf', 'brand/logo/pdf/haldora-lockup-horizontal.pdf', 'brand/applications/pdf/business-card-front.pdf', 'brand/icons/icons.json', 'brand/logo/png/symbol-512.png']) assert.ok(fs.statSync(path.join(dir, f)).size > 500, f);
  assert.equal(fs.readFileSync(path.join(dir, 'brand/guidelines.pdf')).subarray(0, 5).toString(), '%PDF-');
  assert.match(fs.readFileSync(path.join(dir, 'brand/guidelines.html'), 'utf8'), /No trademark search or clearance has been performed/);
});

test('images: every job produced at its exact size with provenance and no cost', () => {
  const reg = readJson(path.join(dir, '.cis/assets/registry.json'));
  const brief = fixture('image-brief.json');
  for (const job of brief.jobs) {
    const rec = reg.assets.find((a) => a.id === job.id);
    assert.ok(rec, job.id);
    assert.equal(rec.qa.status, 'passed', `${job.id}: ${JSON.stringify(rec.qa.checks.filter((c) => !c.pass))}`);
    assert.equal(rec.files.length, job.formats.length);
    assert.ok(rec.files.every((f) => f.width === job.width && f.height === job.height));
    assert.equal(rec.origin.provider, 'local-procedural');
  }
  assert.equal(readJson(path.join(dir, '.cis/cost.json')).spentUsd, 0);
  assert.ok(reg.assets.find((a) => a.id === 'campaign-square').qa.checks.find((c) => c.id === 'text-is-vector').pass);
});

test('3D: a valid, optimised model with fallbacks', () => {
  const r = readJson(path.join(dir, 'scene/model-report.json'));
  assert.equal(r.valid, true);
  assert.equal(r.files.source.validation.errors, 0);
  assert.equal(r.files.optimised.validation.errors, 0);
  assert.ok(r.files.optimised.bytes < r.files.source.bytes * 0.5, 'optimisation at least halves the file');
  assert.ok(r.files.optimised.validation.stats.triangles > 5000);
  assert.equal(fs.readFileSync(path.join(dir, 'scene/public/models/cell.glb')).subarray(0, 4).toString(), 'glTF');
  assert.equal(r.fallbacks.length, 6);
});

test('integration: every deliverable carries the same Experience DNA', () => {
  const c = readJson(path.join(dir, '.cis/reports/consistency.json'));
  assert.equal(c.ok, true, JSON.stringify(c.deliverables.map((d) => [d.id, d.tokens, d.offPalette.slice(0, 2), d.foreignFonts.slice(0, 2)])));
  assert.deepEqual(c.deliverables.map((d) => d.id).sort(), ['brand', 'mobile', 'scene-3d', 'web-app', 'website']);
  const css = fs.readFileSync(path.join(dir, 'design-system/tokens.css'), 'utf8');
  assert.equal(fs.readFileSync(path.join(dir, 'web/src/dna/tokens.css'), 'utf8'), css);
  assert.equal(fs.readFileSync(path.join(dir, 'app/src/dna/tokens.css'), 'utf8'), css);
  assert.equal(fs.readFileSync(path.join(dir, 'scene/src/dna/tokens.css'), 'utf8'), css);
  assert.equal(fs.readFileSync(path.join(dir, 'mobile/src/dna/theme.ts'), 'utf8'), fs.readFileSync(path.join(dir, 'design-system/theme.ts'), 'utf8'));
  assert.equal(readJson(path.join(dir, 'scene/src/dna/scene.json')).finishes[0].baseColor, '#F6F1E7');
  assert.equal(readJson(path.join(dir, 'mobile/app.json')).expo.name, 'Haldora');
  assert.ok(fs.existsSync(path.join(dir, 'web/public/assets/hero-sky.avif')) && fs.existsSync(path.join(dir, 'web/public/brand/lockup.svg')), 'generated assets are linked into the site');
  assert.ok(fs.existsSync(path.join(dir, 'web/ar/index.html')), 'a pre-render entry exists for Arabic');
});

test('a DNA revision propagates to every deliverable through sync', () => {
  const dnaFile = path.join(dir, '.cis/dna/experience-dna.json');
  const next = readJson(dnaFile);
  next.motion.durations.base = 240;
  fs.writeFileSync(path.join(dir, 'edit.json'), JSON.stringify(next));
  assert.equal(cs(['dna', 'bump', '--from', 'edit.json', '--reason', 'Slightly quicker motion'], { cwd: dir }).status, 0);
  assert.equal(readJson(dnaFile).status, 'proposed', 'an approved DNA that changes must be re-approved');
  cs(['dna', 'tokens'], { cwd: dir });
  const stale = cs(['dna', 'consistency', '--json'], { cwd: dir });
  assert.equal(stale.status, 1, 'deliverables are stale until synced');
  assert.ok(stale.json.deliverables.filter((d) => d.id !== 'brand').every((d) => d.tokens === 'stale-or-edited'));
  for (const args of [['website', 'sync'], ['website', 'sync', '--kind', 'app'], ['mobile', 'sync'], ['3d', 'sync']]) assert.equal(cs(args, { cwd: dir }).status, 0, args.join(' '));
  assert.equal(cs(['dna', 'consistency'], { cwd: dir }).status, 0);
  assert.match(fs.readFileSync(path.join(dir, 'web/src/dna/tokens.css'), 'utf8'), /--dur-base: 240ms/);
  assert.match(fs.readFileSync(path.join(dir, 'mobile/src/dna/theme.ts'), 'utf8'), /"base": 240/);
});

test('delivery: the draft package is complete, hashed and honest about what is open', () => {
  const manifest = readJson(path.join(dir, 'export/delivery-manifest.json'));
  assert.match(manifest.package, /DRAFT/);
  assert.deepEqual(manifest.deliverables.map((d) => d.id), ['brand', 'design-system', 'assets', 'web', 'app', 'scene', 'mobile']);
  assert.ok(manifest.openIssues.some((i) => /G6-quality/.test(i)));
  const zip = fs.readdirSync(path.join(dir, 'export')).find((f) => f.endsWith('.zip'));
  const names = listZip(path.join(dir, 'export', zip)).map((e) => e.name);
  assert.equal(names.length, manifest.files.length + 2);
  assert.ok(names.includes('deliverables/brand/logo/haldora-symbol.svg') && names.includes('deliverables/scene/public/models/cell.glb'));
  assert.match(fs.readFileSync(path.join(dir, 'export/DELIVERY.md'), 'utf8'), /were recorded by a demonstration script, not by a client/);
  assert.equal(cs(['export'], { cwd: dir }).status, 3, 'a final export is still refused');
});

// ---------------------------------------------------------- regression ------

test('regression goldens: stable outputs match the accepted baseline', () => {
  const dna = fixture('experience-dna.json');
  const plan = buildPlan(fixture('brief.json'));
  const battery = batteryParts();
  const current = {
    tokensCss: sha(tokensCss(dna)),
    tokensTs: sha(tokensTs(dna)),
    planShape: sha(JSON.stringify(plan.tasks.map((t) => [t.id, t.skill, t.dependsOn, t.gate || null]))),
    planTasks: plan.tasks.length,
    gates: plan.gates.map((g) => g.id),
    recipes: Object.fromEntries(['horizon-field', 'contour-map', 'pattern-tile'].map((r) => [r, sha(renderSvg({ id: 'golden', recipe: r, width: 800, height: 600, seed: 7, variant: 'dusk' }, dna).svg)])),
    symbolArc: sha(JSON.stringify(buildSymbol({ kind: 'symbol', motif: 'arc', params: { corner: 0.28, sunAngle: 116, weight: 5.2 } }))),
    modelTriangles: Object.fromEntries(battery.parts.map((p) => [p.name, checkGeometry(p.geometry, p.name).triangles])),
  };
  const file = path.join(REPO, 'tests/regression/goldens/haldora.json');
  if (process.env.UPDATE_GOLDENS === '1' || !fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(current, null, 2) + '\n');
  }
  const golden = readJson(file);
  // A difference is not automatically a defect: it is a change someone must look at and accept
  // with UPDATE_GOLDENS=1. The message names exactly what moved.
  const changed = Object.keys(current).filter((k) => JSON.stringify(current[k]) !== JSON.stringify(golden[k]));
  assert.deepEqual(changed, [], `outputs differ from the accepted baseline: ${changed.join(', ')}. Review, then re-run with UPDATE_GOLDENS=1 to accept.`);
});
