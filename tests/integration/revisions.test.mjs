// Integration: scoped revisions, export gating, and design-to-code comparison.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { cs, project, approve, readJson, writeJson, tmpDir } from '../helpers.mjs';
import { listZip } from '../../plugin/cli/lib/zip.mjs';
import { svgToRaster } from '../../plugin/cli/lib/raster.mjs';

const job = (id, o = {}) => ({ id, purpose: 'Revision test asset', recipe: 'horizon-field', variant: 'dusk', width: 320, height: 200, formats: ['webp'], seed: id, ...o });

function withAssets() {
  const dir = project();
  writeJson(path.join(dir, '.cis/image-brief.json'), { schemaVersion: '1.0.0', jobs: [job('story-dusk'), job('story-noon', { variant: 'noon' }), job('pattern', { recipe: 'pattern-tile' })] });
  assert.equal(cs(['images', 'generate'], { cwd: dir }).status, 0);
  return dir;
}

test('a revision changes what was asked for and proves the rest is untouched', () => {
  const dir = withAssets();
  const add = cs(['revise', 'add', '--target', 'asset:story-dusk', '--feedback', 'Make the dusk picture calmer', '--change', 'asset.regenerate', '--preserve', 'layout,typography,brand_colors', '--by', 'Mira Solberg', '--json'], { cwd: dir });
  assert.equal(add.status, 0, add.out);
  const id = add.json.revision.id;
  assert.equal(id, 'rev-001');
  assert.equal(cs(['revise', 'verify', id], { cwd: dir }).status, 1, 'verify needs a snapshot first');
  assert.equal(cs(['revise', 'start', id], { cwd: dir }).status, 0);
  assert.equal(cs(['revise', 'verify', id], { cwd: dir }).status, 3, 'nothing changed yet: not applied');
  // Apply the change by the smallest route: one job, one new seed.
  const brief = readJson(path.join(dir, '.cis/image-brief.json'));
  brief.jobs[0].seed = 'calmer';
  writeJson(path.join(dir, '.cis/image-brief.json'), brief);
  const gen = cs(['images', 'generate', '--json'], { cwd: dir });
  assert.deepEqual(gen.json.results.map((r) => r.status), ['generated', 'cached', 'cached'], 'only the requested asset is regenerated');
  const verify = cs(['revise', 'verify', id, '--json'], { cwd: dir });
  assert.equal(verify.json.ok, true, JSON.stringify(verify.json));
  assert.ok(verify.json.changed.includes('assets/generated/story-dusk/story-dusk-320x200.webp'));
  assert.ok(!verify.json.changed.some((f) => f.includes('story-noon') || f.includes('pattern')));
  assert.ok(verify.json.untouched > 3);
  const rec = readJson(path.join(dir, '.cis/revisions/rev-001.json'));
  assert.equal(rec.status, 'applied');
  assert.match(rec.resolution.untouchedVerified[0], /byte-identical/);
  assert.equal(cs(['revise', 'close', id, '--actor', 'claude'], { cwd: dir }).status, 3, 'an agent cannot confirm a revision');
  assert.equal(cs(['revise', 'close', id, '--actor', 'Mira Solberg'], { cwd: dir }).status, 0);
  assert.equal(readJson(path.join(dir, '.cis/revisions/rev-001.json')).status, 'verified');
});

test('changing more than was asked is caught as a scope violation', () => {
  const dir = withAssets();
  const id = cs(['revise', 'add', '--target', 'asset:story-dusk', '--feedback', 'Calmer dusk', '--change', 'asset.regenerate', '--by', 'Mira Solberg', '--json'], { cwd: dir }).json.revision.id;
  cs(['revise', 'start', id], { cwd: dir });
  const brief = readJson(path.join(dir, '.cis/image-brief.json'));
  brief.jobs[0].seed = 'calmer';
  brief.jobs[1].seed = 'while-i-was-here'; // not requested
  writeJson(path.join(dir, '.cis/image-brief.json'), brief);
  cs(['images', 'generate'], { cwd: dir });
  const verify = cs(['revise', 'verify', id, '--json'], { cwd: dir });
  assert.equal(verify.status, 3);
  assert.ok(verify.json.outside.some((f) => f.includes('story-noon')), 'the unrequested asset is named');
  assert.equal(readJson(path.join(dir, '.cis/revisions', `${id}.json`)).status, 'in-progress', 'not marked applied');
});

test('contradictory and malformed requests are refused', () => {
  const dir = withAssets();
  const clash = cs(['revise', 'add', '--target', 'dna:motion', '--feedback', 'Calmer but keep motion as is', '--change', 'motion.adjust', '--preserve', 'motion', '--by', 'Mira'], { cwd: dir });
  assert.equal(clash.status, 3);
  assert.match(clash.stderr, /change and to preserve the same aspect/);
  assert.equal(cs(['revise', 'add', '--target', 'asset:nope', '--feedback', 'Swap it', '--change', 'asset.regenerate', '--by', 'Mira'], { cwd: dir }).status, 1, 'unknown asset');
  assert.equal(cs(['revise', 'add', '--target', 'asset:pattern', '--feedback', 'Swap it', '--change', 'make.better', '--by', 'Mira'], { cwd: dir }).status, 1, 'unknown change kind');
  assert.equal(cs(['revise', 'add', '--target', 'asset:pattern', '--feedback', 'Swap it', '--change', 'asset.regenerate'], { cwd: dir }).status, 2, 'requester is required');
});

test('export: a final package needs evidence and approval; a draft says what is missing', () => {
  const dir = withAssets();
  cs(['dna', 'tokens'], { cwd: dir });
  const final = cs(['export'], { cwd: dir });
  assert.equal(final.status, 3);
  assert.match(final.stderr, /No QA summary/);
  assert.match(final.stderr, /G6-quality.*has not been approved/);
  assert.ok(!fs.existsSync(path.join(dir, 'export')), 'a refused export writes nothing');
  const draft = cs(['export', '--draft', '--json'], { cwd: dir });
  assert.equal(draft.status, 0, draft.out);
  assert.equal(draft.json.draft, true);
  assert.ok(draft.json.openIssues >= 2);
  const zip = path.join(dir, draft.json.file);
  const names = listZip(zip).map((e) => e.name);
  for (const n of ['DELIVERY.md', 'delivery-manifest.json', 'project/experience-dna.json', 'project/event-ledger.jsonl', 'project/asset-registry.json', 'deliverables/design-system/tokens.css']) assert.ok(names.includes(n), n);
  assert.ok(names.some((n) => n.startsWith('deliverables/assets/generated/story-dusk/')));
  assert.ok(!names.some((n) => n.includes('node_modules') || n.includes('.snapshot.json') || n.includes('checkpoints')));
  const manifest = readJson(path.join(dir, 'export/delivery-manifest.json'));
  assert.match(manifest.package, /DRAFT/);
  assert.ok(manifest.files.every((f) => /^[0-9a-f]{64}$/.test(f.sha256)));
  assert.equal(manifest.project.fictionalClient, true);
  assert.match(fs.readFileSync(path.join(dir, 'export/DELIVERY.md'), 'utf8'), /\(DRAFT\)/);
});

test('simulated approvals stay labelled all the way into the package', () => {
  const dir = project({ dna: false });
  cs(['task', 'start', 'intake'], { cwd: dir });
  cs(['task', 'done', 'intake'], { cwd: dir });
  approve(dir, 'G0-brief');
  cs(['export', '--draft'], { cwd: dir });
  const manifest = readJson(path.join(dir, 'export/delivery-manifest.json'));
  assert.equal(manifest.approvals.find((g) => g.id === 'G0-brief').simulated, true);
  assert.match(fs.readFileSync(path.join(dir, 'export/DELIVERY.md'), 'utf8'), /not real approvals/);
});

test('design-to-code: analysis, identical match, and localised differences', async () => {
  const out = tmpDir();
  const card = (title, w = 90) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300"><rect width="400" height="300" fill="#F6F1E7"/><rect x="0" y="0" width="400" height="60" fill="#2A2D66"/><rect x="24" y="90" width="${title}" height="18" fill="#1C1B18"/><rect x="24" y="130" width="352" height="${w}" rx="10" fill="#E9A23B"/></svg>`;
  const write = async (name, svg) => (fs.writeFileSync(path.join(out, name), await svgToRaster(svg, { width: 400, height: 300, format: 'png' })), path.join(out, name));
  const ref = await write('reference.png', card(180));
  const same = await write('same.png', card(180));
  const off = await write('off.png', card(180, 140)); // the panel is taller than designed
  const analysis = cs(['d2c', 'analyze', ref, '--json']).json;
  assert.deepEqual([analysis.width, analysis.height], [400, 300]);
  assert.ok(analysis.palette.some((p) => p.hex === '#f6f1e7') && analysis.palette.some((p) => p.hex === '#2a2d66'));
  assert.ok(analysis.bands.length >= 2, 'header and body are separate bands');
  const match = cs(['d2c', 'compare', ref, same, '--out', path.join(out, 'm'), '--json']);
  assert.equal(match.status, 0);
  assert.equal(match.json.changedRatio, 0);
  const diff = cs(['d2c', 'compare', ref, off, '--out', path.join(out, 'd'), '--json']);
  assert.equal(diff.status, 1);
  assert.ok(diff.json.changedRatio > 0.05 && diff.json.changedRatio < 0.3);
  assert.ok(diff.json.worstRegions.every((r) => r.row >= 6), 'the difference is located in the lower part of the frame');
  assert.ok(fs.statSync(path.join(out, 'd/diff.png')).size > 100, 'a heatmap is written');
  const small = await write('small.png', card(180));
  fs.writeFileSync(small, await svgToRaster(card(180), { width: 200, height: 150, format: 'png' }));
  assert.equal(cs(['d2c', 'compare', ref, small, '--out', path.join(out, 's'), '--json']).json.size.mismatch, true);
  assert.equal(cs(['d2c', 'analyze', ref], { env: { CIS_DISABLE_ENGINES: 'raster' } }).status, 4, 'a missing engine is reported with exit code 4');
});
