// Integration: project lifecycle through the CLI: gates, contracts, retries,
// recovery, ledger integrity, checkpoints, DNA revisions, directions, reviews.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { cs, project, approve, fixture, readJson, writeJson, tmpDir, INPUTS } from '../helpers.mjs';

test('init validates the brief, creates state and refuses to overwrite', () => {
  const dir = project({ plan: false, dna: false });
  for (const f of ['.cis/project.json', '.cis/brief.json', '.cis/ledger.jsonl', '.cis/assets/registry.json', '.cis/cost.json', '.gitignore']) assert.ok(fs.existsSync(path.join(dir, f)), f);
  assert.match(fs.readFileSync(path.join(dir, '.gitignore'), 'utf8'), /^\.env$/m);
  assert.equal(readJson(path.join(dir, '.cis/project.json')).policy.externalUploads, 'ask');
  const again = cs(['init', dir, '--brief', path.join(dir, 'brief.in.json')]);
  assert.equal(again.status, 1);
  assert.match(again.stderr, /already exists/);
  const bad = tmpDir();
  writeJson(path.join(bad, 'b.json'), { ...fixture('brief.json'), deliverables: [] });
  const r = cs(['init', path.join(bad, 'p'), '--brief', path.join(bad, 'b.json')]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /does not satisfy the brief contract/);
  assert.ok(!fs.existsSync(path.join(bad, 'p', '.cis', 'project.json')), 'nothing created from an invalid brief');
});

test('gates block work until a named person approves them', () => {
  const dir = project({ dna: false });
  assert.equal(cs(['task', 'start', 'directions'], { cwd: dir }).status, 3, 'blocked before research and gate');
  assert.equal(cs(['task', 'start', 'intake'], { cwd: dir }).status, 0);
  assert.equal(cs(['task', 'done', 'intake'], { cwd: dir }).status, 0, 'brief exists, contract met');
  assert.equal(cs(['task', 'done', 'intake'], { cwd: dir }).status, 0, 'completing twice is harmless');
  for (const actor of ['claude', 'agent', 'AI', 'qa', 'bot', '']) {
    const r = cs(['approve', 'G0-brief', '--actor', actor], { cwd: dir });
    assert.equal(r.status, 3, `"${actor}" may not approve`);
  }
  const early = cs(['approve', 'G1-direction', '--actor', 'Mira Solberg'], { cwd: dir });
  assert.equal(early.status, 3);
  assert.match(early.stderr, /cannot be approved before its inputs exist/);
  const ok = cs(['approve', 'G0-brief', '--actor', 'Mira Solberg', '--role', 'client', '--json'], { cwd: dir });
  assert.equal(ok.json.gate.status, 'approved');
  assert.equal(ok.json.gate.decision.simulated, false);
  const sim = approve(dir, 'G0-brief');
  assert.match(sim.stdout, /SIMULATED/, 'simulated decisions are labelled');
  assert.equal(cs(['approve', 'G9-nope', '--actor', 'Mira'], { cwd: dir }).status, 2);
});

test('a task is not done until its outputs exist and validate', () => {
  const dir = project({ dna: false });
  cs(['task', 'start', 'intake'], { cwd: dir });
  cs(['task', 'done', 'intake'], { cwd: dir });
  cs(['task', 'start', 'research'], { cwd: dir });
  const none = cs(['task', 'done', 'research'], { cwd: dir });
  assert.equal(none.status, 3);
  assert.match(none.stderr, /research\.json does not exist/);
  writeJson(path.join(dir, '.cis/research.json'), { schemaVersion: '1.0.0', entries: [{ id: 'r-001', topic: 'audience', kind: 'fact', finding: 'A claim with no source at all', recordedOn: '2026-11-12' }] });
  const invalid = cs(['task', 'done', 'research'], { cwd: dir });
  assert.equal(invalid.status, 3);
  assert.match(invalid.stderr, /violates research-log/);
  fs.rmSync(path.join(dir, '.cis/research.json'));
  assert.equal(cs(['research', 'add', '--topic', 'accessibility', '--kind', 'fact', '--finding', 'WCAG 2.2 sets a 24 by 24 CSS pixel minimum target', '--source', 'https://www.w3.org/TR/WCAG22/'], { cwd: dir }).status, 0);
  assert.equal(cs(['research', 'add', '--topic', 'audience', '--kind', 'fact', '--finding', 'Unsourced statistic about buyers'], { cwd: dir }).status, 1, 'a fact needs a source');
  assert.equal(cs(['task', 'done', 'research'], { cwd: dir }).status, 0);
});

test('three failures escalate to a person instead of looping', () => {
  const dir = project({ dna: false });
  cs(['task', 'start', 'intake'], { cwd: dir });
  let last;
  for (let i = 0; i < 3; i++) last = cs(['task', 'fail', 'intake', '--reason', `attempt ${i + 1} failed`, '--json'], { cwd: dir });
  assert.equal(last.json.task.status, 'escalated');
  assert.equal(cs(['task', 'start', 'intake'], { cwd: dir }).status, 3, 'no further automatic attempts');
  assert.equal(cs(['task', 'reset', 'intake'], { cwd: dir }).status, 2, 'reset needs a named actor');
  assert.equal(cs(['task', 'reset', 'intake', '--actor', 'Mira Solberg'], { cwd: dir }).status, 0);
  assert.equal(cs(['task', 'start', 'intake'], { cwd: dir }).status, 0);
});

test('recovery reconciles state with the files on disk after an interruption', () => {
  const dir = project({ dna: false });
  cs(['task', 'start', 'intake'], { cwd: dir }); // interrupted here, with the output already present
  const rec = cs(['task', 'recover', '--json'], { cwd: dir });
  assert.deepEqual(rec.json.changes.map((c) => [c.task, c.action]), [['intake', 'completed']]);
  fs.renameSync(path.join(dir, '.cis/brief.json'), path.join(dir, '.cis/brief.moved'));
  const reopened = cs(['task', 'recover', '--json'], { cwd: dir });
  assert.deepEqual(reopened.json.changes.map((c) => [c.task, c.action]), [['intake', 'reopened']]);
  assert.deepEqual(cs(['task', 'recover', '--json'], { cwd: dir }).json.changes, [], 'recovery is idempotent');
});

test('the ledger is hash-chained: edits and deletions are detected, secrets are redacted', () => {
  const dir = project({ dna: false });
  const key = 'sk-' + 'proj-' + 'Zz11Yy22Xx33Ww44Vv55Uu66Tt77';
  cs(['task', 'start', 'intake'], { cwd: dir });
  cs(['task', 'fail', 'intake', '--reason', `provider said key ${key} is invalid`], { cwd: dir });
  const file = path.join(dir, '.cis/ledger.jsonl');
  const text = fs.readFileSync(file, 'utf8');
  assert.ok(!text.includes(key), 'the key never reaches the ledger');
  assert.ok(text.includes('[REDACTED]'));
  assert.equal(cs(['ledger', 'verify'], { cwd: dir }).status, 0);
  const lines = text.trim().split('\n');
  fs.writeFileSync(file, lines.map((l, i) => (i === 1 ? l.replace('brief.created', 'brief.forged') : l)).join('\n') + '\n');
  const edited = cs(['ledger', 'verify'], { cwd: dir });
  assert.equal(edited.status, 1);
  assert.match(edited.stdout, /does not match its hash/);
  fs.writeFileSync(file, [lines[0], ...lines.slice(2)].join('\n') + '\n');
  assert.match(cs(['ledger', 'verify'], { cwd: dir }).stdout, /chain broken|sequence/);
});

test('checkpoints restore changed files and remove files added since', () => {
  const dir = project({ dna: false });
  fs.mkdirSync(path.join(dir, 'web/src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'web/src/a.css'), 'a{color:red}');
  const made = cs(['checkpoint', 'create', 'web', '--label', 'before-fix', '--json'], { cwd: dir });
  assert.equal(made.json.files, 1);
  fs.writeFileSync(path.join(dir, 'web/src/a.css'), 'a{color:blue}');
  fs.writeFileSync(path.join(dir, 'web/src/new.css'), 'b{}');
  const back = cs(['checkpoint', 'restore', made.json.id, '--json'], { cwd: dir });
  assert.deepEqual([back.json.restored, back.json.removed], [1, 1]);
  assert.equal(fs.readFileSync(path.join(dir, 'web/src/a.css'), 'utf8'), 'a{color:red}');
  assert.ok(!fs.existsSync(path.join(dir, 'web/src/new.css')));
  assert.equal(cs(['checkpoint', 'create', '../outside'], { cwd: dir }).status, 1, 'cannot snapshot outside the project');
});

test('DNA: check, tokens, versioned bump, and preserved aspects are protected', () => {
  const dir = project();
  assert.equal(cs(['dna', 'check'], { cwd: dir }).status, 0);
  assert.equal(cs(['dna', 'tokens'], { cwd: dir }).status, 0);
  for (const f of ['tokens.css', 'tokens.json', 'theme.ts', 'scene.json']) assert.ok(fs.existsSync(path.join(dir, 'design-system', f)), f);
  const edited = fixture('experience-dna.json');
  edited.motion.durations.base = 240;
  writeJson(path.join(dir, 'edit.json'), edited);
  const bump = cs(['dna', 'bump', '--from', 'edit.json', '--reason', 'Client: motion a little quicker', '--json'], { cwd: dir });
  assert.equal(bump.json.revision, 2);
  assert.deepEqual(bump.json.changes.map((c) => c.path), ['motion.durations.base']);
  assert.ok(fs.existsSync(path.join(dir, '.cis/dna/versions/r001.json')), 'previous revision archived');
  assert.match(fs.readFileSync(path.join(dir, 'design-system/tokens.css'), 'utf8'), /revision 1 /, 'tokens are stale until regenerated');
  // A revision that asks to preserve brand colours cannot be used to change them.
  const rev = cs(['revise', 'add', '--target', 'dna:motion', '--feedback', 'Reduce animation intensity', '--change', 'motion.adjust', '--preserve', 'layout,typography,brand_colors', '--by', 'Mira Solberg', '--json'], { cwd: dir });
  const sneaky = readJson(path.join(dir, '.cis/dna/experience-dna.json'));
  sneaky.motion.intensity = 'subtle';
  sneaky.color.palette.amber.hex = '#FF8800';
  sneaky.color.semantic.light.accent = '#FF8800';
  sneaky.color.semantic.dark.primary = '#FF8800';
  sneaky.color.semantic.dark.focus = '#FF8800';
  sneaky.color.semantic.dark.warning = '#FF8800';
  sneaky.color.dataViz[0] = '#FF8800';
  sneaky.materials3d.finishes[0].accent = '#FF8800';
  writeJson(path.join(dir, 'sneaky.json'), sneaky);
  const refused = cs(['dna', 'bump', '--from', 'sneaky.json', '--reason', 'x', '--revision-request', rev.json.revision.id], { cwd: dir });
  assert.equal(refused.status, 3);
  assert.match(refused.stderr, /asked to preserve: brand_colors/);
  sneaky.color = readJson(path.join(dir, '.cis/dna/experience-dna.json')).color;
  sneaky.materials3d = readJson(path.join(dir, '.cis/dna/experience-dna.json')).materials3d;
  writeJson(path.join(dir, 'scoped.json'), sneaky);
  assert.equal(cs(['dna', 'bump', '--from', 'scoped.json', '--reason', 'Calmer motion', '--revision-request', rev.json.revision.id], { cwd: dir }).status, 0);
  // An invalid edit never becomes the current DNA.
  const broken = readJson(path.join(dir, '.cis/dna/experience-dna.json'));
  broken.color.semantic.light.text = '#EDE6D6';
  writeJson(path.join(dir, 'broken.json'), broken);
  assert.equal(cs(['dna', 'bump', '--from', 'broken.json', '--reason', 'x'], { cwd: dir }).status, 1);
  assert.equal(readJson(path.join(dir, '.cis/dna/experience-dna.json')).revision, 3);
});

test('directions must be distinct and legible before they are shown', () => {
  const dir = project({ dna: false });
  fs.mkdirSync(path.join(dir, '.cis/directions'), { recursive: true });
  for (const f of fs.readdirSync(path.join(INPUTS, 'directions'))) fs.copyFileSync(path.join(INPUTS, 'directions', f), path.join(dir, '.cis/directions', f));
  const ok = cs(['directions', 'check', '--json'], { cwd: dir });
  assert.equal(ok.json.ok, true);
  assert.ok(ok.json.pairs.every((p) => p.differing.length >= 3));
  assert.equal(cs(['directions', 'board'], { cwd: dir }).status, 0);
  assert.match(fs.readFileSync(path.join(dir, '.cis/reports/directions.html'), 'utf8'), /Daylight Ledger/);
  assert.equal(cs(['directions', 'select', 'daylight-ledger'], { cwd: dir }).status, 2, 'a choice needs a recorded reason');
  // A near-copy is a variation, not a direction.
  const twin = fixture('directions/daylight-ledger.json');
  twin.id = 'daylight-two';
  twin.palette.accent = '#E8A84A';
  writeJson(path.join(dir, '.cis/directions/daylight-two.json'), twin);
  const dup = cs(['directions', 'check', '--json'], { cwd: dir });
  assert.equal(dup.json.ok, false);
  assert.match(dup.json.problems.join('\n'), /variations, not distinct directions/);
  const faint = fixture('directions/quiet-current.json');
  faint.id = 'faint';
  faint.palette.text = '#C9D3DF';
  writeJson(path.join(dir, '.cis/directions/faint.json'), faint);
  assert.match(cs(['directions', 'check', '--json'], { cwd: dir }).json.problems.join('\n'), /below 4\.5:1/);
});

test('a creative review must be independent, evidenced and self-consistent', () => {
  const dir = project({ dna: false });
  fs.mkdirSync(path.join(dir, '.cis/reports/qa/web'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.cis/reports/qa/web/home-desktop.png'), 'png');
  const crit = Object.fromEntries(['designCoherence', 'brandAlignment', 'visualHierarchy', 'typography', 'originality', 'motionQuality', 'interactionClarity', 'assetQuality', 'presentationPolish', 'professionalReadiness'].map((k, i) => [k, { score: 3 + (i % 2), reason: 'Specific observation about the work under review.' }]));
  const base = { schemaVersion: '1.0.0', reviewer: 'Independent Reviewer', independent: true, evaluationOnly: true, reviewedAt: '2026-11-13T10:00:00Z', subject: ['web'], evidenceViewed: ['.cis/reports/qa/web/home-desktop.png'], criteria: crit, findings: [], recommendation: 'revise' };
  const check = (doc) => (writeJson(path.join(dir, '.cis/reports/creative-review.json'), doc), cs(['review', 'check', '--json'], { cwd: dir }).json);
  assert.equal(check(base).ok, true);
  assert.match(check({ ...base, independent: false }).problems.join(), /self-assessment/);
  assert.match(check({ ...base, evidenceViewed: [] }).problems.join(), /evidenceViewed is empty/);
  assert.match(check({ ...base, evidenceViewed: ['missing.png'] }).problems.join(), /does not exist/);
  assert.match(check({ ...base, criteria: Object.fromEntries(Object.keys(crit).map((k) => [k, { score: 5, reason: 'Everything is perfect in every way.' }])) }).problems.join(), /same score/);
  assert.match(check({ ...base, recommendation: 'ready-for-client', findings: [{ severity: 'blocker', where: 'web', issue: 'Text fails contrast' }] }).problems.join(), /contradict/);
  assert.equal(check({ ...base, evaluationOnly: false }).ok, false, 'a review may not present itself as approval');
});
