// Unit tests: contracts, utilities, Experience DNA, orchestrator, motion.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { PLUGIN, fixture, tmpDir, writeJson } from '../helpers.mjs';
import { validate, schemaNames, loadSchema } from '../../plugin/cli/lib/schema.mjs';
import { safeJoin, findSecrets, redact, contrast, hexToOklch, oklchToHex, colorDistance, nearPalette, rng, slugify, CisError } from '../../plugin/cli/lib/util.mjs';
import { lintDna, tokensCss, tokensTs, deriveTokens, diffDna, aspectOf, fingerprint, similarity, consistency } from '../../plugin/cli/lib/dna.mjs';
import { classify, buildPlan, runnable, blockers, route } from '../../plugin/cli/lib/orchestrator.mjs';
import { decide, chooseRuntime, lintMotion, maxDuration } from '../../plugin/cli/lib/motion.mjs';

const clone = (o) => JSON.parse(JSON.stringify(o));
const dna = () => clone(fixture('experience-dna.json'));

// ------------------------------------------------------------- contracts ----

test('every schema loads and declares an id and title', () => {
  const names = schemaNames();
  assert.ok(names.length >= 13, `found ${names.length} schemas`);
  for (const n of names) {
    const s = loadSchema(n);
    assert.ok(s.$id && s.title, `${n} has $id and title`);
    assert.match(s.$id, /\/\d+\.\d+\.\d+$/, `${n} is versioned`);
  }
});

test('demo inputs satisfy their contracts', () => {
  for (const [schema, file] of [['brief', 'brief.json'], ['experience-dna', 'experience-dna.json'], ['brand-spec', 'brand-spec.json'], ['image-brief', 'image-brief.json'], ['content-web', 'content-web.json'], ['motion-spec', 'motion-spec.json']]) {
    const res = validate(schema, fixture(file));
    assert.deepEqual(res.errors, [], `${file} against ${schema}`);
  }
  for (const f of fs.readdirSync(path.join(PLUGIN, '..', 'demos/haldora/inputs/directions'))) {
    assert.ok(validate('direction', fixture(`directions/${f}`)).valid, f);
  }
});

const MUTATIONS = [
  ['brief', 'brief.json', (b) => delete b.objective, /objective is required/],
  ['brief', 'brief.json', (b) => (b.deliverables = []), /at least 1/],
  ['brief', 'brief.json', (b) => (b.projectId = '../escape'), /pattern/],
  ['brief', 'brief.json', (b) => (b.constraints.externalUploads = 'maybe'), /one of/],
  ['brief', 'brief.json', (b) => (b.surprise = true), /not an allowed property/],
  ['experience-dna', 'experience-dna.json', (d) => (d.color.semantic.light.bg = 'red'), /pattern/],
  ['experience-dna', 'experience-dna.json', (d) => (d.motion.durations.base = -5), />= 0/],
  ['experience-dna', 'experience-dna.json', (d) => (d.motion.easings.standard = [0, 0, 1]), /at least 4/],
  ['experience-dna', 'experience-dna.json', (d) => delete d.typography.display.license, /license is required/],
  ['experience-dna', 'experience-dna.json', (d) => (d.revision = 0), />= 1/],
  ['image-brief', 'image-brief.json', (b) => (b.jobs[0].id = '../../x'), /pattern/],
  ['image-brief', 'image-brief.json', (b) => (b.jobs[0].width = 99999), /<= 8192/],
  ['content-web', 'content-web.json', (c) => delete c.locales.en.hero.headline, /headline is required/],
];

test('invalid documents are rejected with a pointed message', () => {
  for (const [schema, file, mutate, expected] of MUTATIONS) {
    const doc = clone(fixture(file));
    mutate(doc);
    const res = validate(schema, doc);
    assert.equal(res.valid, false, `${schema} mutation should fail`);
    assert.match(res.errors.map((e) => `${e.path} ${e.message}`).join('\n'), expected);
  }
});

test('the built-in validator agrees with Ajv on every fixture and mutation', () => {
  const require = createRequire(import.meta.url);
  const Ajv = require('ajv/dist/2020');
  const addFormats = require('ajv-formats');
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  let compared = 0;
  const cases = [...MUTATIONS.map(([s, f, m]) => [s, f, m]), ...['brief', 'experience-dna', 'brand-spec', 'image-brief', 'content-web', 'motion-spec'].map((s) => [s, s === 'experience-dna' ? 'experience-dna.json' : `${s}.json`, () => {}])];
  for (const [schema, file, mutate] of cases) {
    const doc = clone(fixture(file));
    mutate(doc);
    const ours = validate(schema, doc).valid;
    const theirs = ajv.compile(loadSchema(schema))(doc);
    assert.equal(ours, theirs, `${schema}/${file}: built-in=${ours}, ajv=${theirs}`);
    compared++;
  }
  assert.ok(compared >= 19);
});

test('an unsupported schema keyword is an error, never a silent pass', () => {
  assert.throws(() => validate({ type: 'object', dependentRequired: {} }, {}), /Unsupported schema keyword/);
});

// --------------------------------------------------------------- utilities ---

test('safeJoin confines paths to the root', () => {
  const root = tmpDir();
  assert.equal(safeJoin(root, 'a/b.txt'), path.join(root, 'a/b.txt'));
  for (const bad of ['../x', 'a/../../x', '/etc/passwd', 'a/\0b']) assert.throws(() => safeJoin(root, bad), CisError, bad);
});

test('secrets are found, masked and redacted; placeholders are not findings', () => {
  const key = 'sk-' + 'proj-' + 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4';
  const text = `OPENAI_API_KEY="${key}"\naws = AKIA${'ABCDEFGHIJKLMNOP'}\npassword: "changeme-placeholder"\napi_key = "your_key_here_please"`;
  const hits = findSecrets(text);
  assert.ok(hits.some((h) => h.kind === 'openai-key'));
  assert.ok(hits.some((h) => h.kind === 'aws-access-key'));
  assert.ok(hits.every((h) => !h.masked.includes(key)), 'findings never contain the secret');
  assert.ok(!hits.some((h) => h.line === 4), 'placeholder ignored');
  assert.ok(!redact(text).includes(key));
});

test('colour maths', () => {
  assert.equal(Math.round(contrast('#000000', '#ffffff')), 21);
  assert.ok(Math.abs(contrast('#777777', '#ffffff') - 4.48) < 0.02);
  assert.equal(oklchToHex(hexToOklch('#2a2d66')), '#2a2d66');
  assert.ok(colorDistance('#e9a23b', '#e9a23c') < 0.01);
  assert.ok(nearPalette('#f0c88f', ['#f6f1e7', '#e9a23b']), 'a blend of two palette colours is on-palette');
  assert.ok(!nearPalette('#00ff00', ['#f6f1e7', '#e9a23b', '#2a2d66']));
});

test('seeded randomness is reproducible', () => {
  const a = rng('haldora');
  const b = rng('haldora');
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
  assert.notEqual(rng('x')(), rng('y')());
  assert.equal(slugify('  IBM Plex Sans Arabic! '), 'ibm-plex-sans-arabic');
});

// -------------------------------------------------------- Experience DNA ----

test('the demo DNA passes lint with no errors', () => {
  assert.deepEqual(lintDna(dna()).filter((i) => i.level === 'error'), []);
});

test('lint catches real design defects', () => {
  const cases = [
    [(d) => (d.color.semantic.light.textMuted = '#D9D0BC'), /textMuted on bg is 1\.\d+:1/],
    [(d) => (d.color.semantic.light.accent = '#123456'), /not in color\.palette/],
    [(d) => (d.motion.durations.fast = 900), /shorter than/],
    [(d) => delete d.typography.arabic, /no Arabic typeface/],
    [(d) => (d.localization.rtl = false), /rtl is false/],
    [(d) => (d.typography.display.family = 'SF Pro Display'), /cannot be redistributed/],
    [(d) => (d.typography.text.license = 'unknown'), /no usable licence/],
    [(d) => (d.typography.text.family = 'Evil"; } body { display:none'), /not allowed/],
    [(d) => (d.motion.easings.enter = [1.4, 0, 0.2, 1]), /within 0\.\.1/],
  ];
  for (const [mutate, expected] of cases) {
    const d = dna();
    mutate(d);
    assert.match(lintDna(d).filter((i) => i.level === 'error').map((i) => i.message).join('\n'), expected);
  }
});

test('tokens are deterministic, scheme-aware and cannot be broken out of', () => {
  const d = dna();
  const css = tokensCss(d);
  assert.equal(css, tokensCss(dna()), 'same DNA, same bytes');
  for (const needle of ['--color-bg: #f6f1e7', '--dark-bg: #14152b', '--font-display: "Fraunces"', '--dur-base: 280ms', '--ease-enter: cubic-bezier(0.16, 1, 0.3, 1)', '[data-scheme="dark"]', 'prefers-reduced-motion: reduce', ':lang(ar)']) assert.ok(css.includes(needle), needle);
  d.typography.display.family = 'X"; } html { color: red';
  d.project.id = 'a */ body{} /*';
  const hostile = tokensCss(d);
  assert.ok(!hostile.includes('html { color: red'), 'family cannot close the declaration');
  assert.ok(!/\(a \*\//.test(hostile), 'project id cannot close the comment');
  assert.match(tokensTs(dna()), /export const theme = \{/);
  assert.equal(deriveTokens(dna()).a11y.minTargetPx, 24);
});

test('motion intensity "none" zeroes every duration token', () => {
  const d = dna();
  d.motion.intensity = 'none';
  assert.match(tokensCss(d), /--dur-cinematic: 0ms/);
});

test('diff maps changed paths to the aspects a revision may preserve', () => {
  const a = dna();
  const b = dna();
  b.color.palette.amber.hex = '#E8A84A';
  b.motion.durations.base = 240;
  const changes = diffDna(a, b);
  assert.deepEqual(changes.map((c) => c.path), ['color.palette.amber.hex', 'motion.durations.base']);
  assert.deepEqual([...new Set(changes.map((c) => aspectOf(c.path)))], ['brand_colors', 'motion']);
});

test('fingerprints flag look-alike directions', () => {
  const a = fingerprint(dna());
  const twin = dna();
  twin.color.palette.amber.hex = '#E8A84A';
  assert.equal(similarity(a, fingerprint(twin)).score, 1);
  const other = dna();
  Object.assign(other.layout, { grammar: 'instrument', density: 'compact' });
  other.typography.display.family = 'JetBrains Mono';
  other.motion.intensity = 'subtle';
  other.imagery.motifs = ['grid'];
  other.color.defaultScheme = 'dark';
  assert.ok(similarity(a, fingerprint(other)).score < 0.7);
});

test('consistency detects stale tokens, off-palette colours and foreign fonts', () => {
  const root = tmpDir();
  const d = dna();
  fs.mkdirSync(path.join(root, 'web/src/dna'), { recursive: true });
  fs.writeFileSync(path.join(root, 'web/src/dna/tokens.css'), tokensCss(d));
  fs.writeFileSync(path.join(root, 'web/src/ok.css'), '.a{color:var(--color-text);background:#F6F1E7;font-family:var(--font-text)}');
  const target = [{ id: 'website', dir: 'web', tokenFiles: [['src/dna/tokens.css', 'css']] }];
  assert.equal(consistency(root, d, target).ok, true);
  fs.writeFileSync(path.join(root, 'web/src/bad.css'), '.b{color:#00ff88;font-family:"Comic Sans MS",cursive}');
  const drift = consistency(root, d, target);
  assert.equal(drift.ok, false);
  assert.equal(drift.deliverables[0].offPalette[0].hex, '#00ff88');
  assert.equal(drift.deliverables[0].foreignFonts[0].family, 'comic sans ms');
  fs.rmSync(path.join(root, 'web/src/bad.css'));
  fs.appendFileSync(path.join(root, 'web/src/dna/tokens.css'), '\n:root{--color-bg:#fff}');
  assert.equal(consistency(root, d, target).deliverables[0].tokens, 'stale-or-edited');
});

// ------------------------------------------------------------ orchestrator ---

test('classification reads scope, flags and unlisted work from the brief', () => {
  const c = classify(fixture('brief.json'));
  assert.equal(c.scope, 'cross-disciplinary');
  for (const f of ['rtl', 'multilingual', 'fictional-client', 'open-questions']) assert.ok(c.flags.includes(f), f);
  const small = clone(fixture('brief.json'));
  small.deliverables = ['marketing-website'];
  small.locales = ['en'];
  small.objective = 'A landing page for the launch, plus a new logo and a customer dashboard later on.';
  const s = classify(small);
  assert.equal(s.scope, 'single-discipline');
  assert.ok(s.suggestions.some((x) => x.includes('brand-identity')) && s.suggestions.some((x) => x.includes('web-application')));
});

test('the plan is a valid dependency graph with gates in front of production', () => {
  const plan = buildPlan(fixture('brief.json'));
  assert.ok(validate('project-state', plan).valid);
  const ids = new Set(plan.tasks.map((t) => t.id));
  for (const t of plan.tasks) for (const d of t.dependsOn) assert.ok(ids.has(d), `${t.id} depends on existing ${d}`);
  // Topological order exists (no cycles).
  const done = new Set();
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const t of plan.tasks) if (!done.has(t.id) && t.dependsOn.every((d) => done.has(d))) (done.add(t.id), (progressed = true));
  }
  assert.equal(done.size, plan.tasks.length, 'acyclic');
  for (const t of plan.tasks.filter((x) => x.phase === 'production')) assert.equal(t.gate, 'G2-system', `${t.id} waits for the system gate`);
  const web = plan.tasks.find((t) => t.id === 'website');
  for (const d of ['images', 'brand', 'scene-3d', 'motion-spec']) assert.ok(web.dependsOn.includes(d), `website waits for ${d}`);
  assert.ok(plan.tasks.some((t) => t.id === 'consistency'), 'cross-disciplinary projects get a consistency task');
  assert.deepEqual(runnable(plan).map((t) => t.id), ['intake']);
  assert.match(blockers(plan, plan.tasks.find((t) => t.id === 'directions')).join(' '), /human approval of gate G0-brief/);
});

test('a single-deliverable brief gets a smaller plan', () => {
  const b = clone(fixture('brief.json'));
  b.deliverables = ['brand-identity'];
  b.constraints.motionLevel = 'none';
  const plan = buildPlan(b);
  const ids = plan.tasks.map((t) => t.id);
  assert.ok(ids.includes('brand') && !ids.includes('website') && !ids.includes('mobile') && !ids.includes('motion-spec') && !ids.includes('consistency'));
});

test('skill routing picks the right specialist for plain-language requests', () => {
  const expectations = [
    ['Design a logo and wordmark for our bakery', 'brand-identity'],
    ['We need a landing page with scrollytelling for the launch', 'web-experience'],
    ['Build an admin dashboard with charts and a data table', 'web-application'],
    ['Make an iOS and Android app with onboarding screens', 'mobile-experience'],
    ['Add a spring animation to this button and check reduced motion', 'motion-intelligence'],
    ['I want a 3D product configurator in WebGL', '3d-experience'],
    ['Generate hero images and social graphics for the campaign', 'image-asset-factory'],
    ['Here is a screenshot, match this design pixel-perfect', 'design-to-code'],
    ['Run an accessibility and performance audit before we ship', 'quality-assurance'],
    ['The client asked to tweak the amber, record the feedback', 'revision-management'],
    ['Give me three creative directions and a moodboard', 'art-direction'],
    ['Export the design tokens from the design system', 'experience-dna'],
    ['Package the deliverables for hand-off', 'delivery'],
    ['Give this a design critique against the rubric', 'creative-review'],
    ['New client: full brand, website, mobile app and a 3D hero', 'creative-studio'],
  ];
  let correct = 0;
  for (const [request, want] of expectations) {
    const got = route(request)[0]?.skill;
    assert.equal(got, want, `"${request}" -> ${got}`);
    correct++;
  }
  assert.equal(correct, expectations.length);
  assert.deepEqual(route('what is the weather'), []);
});

// ----------------------------------------------------------------- motion ---

test('the engine can decide not to animate', () => {
  const d = dna();
  const m = (o) => ({ surface: 'application', intent: 'feedback', trigger: 'press', frequency: 'occasional', ...o });
  assert.equal(decide(m({}), d).decision, 'animate');
  assert.equal(decide(m({ frequency: 'constant' }), d).rule, 'constant-frequency');
  assert.equal(decide(m({ intent: 'delight', frequency: 'frequent' }), d).rule, 'delight-must-be-rare');
  assert.equal(decide(m({ intent: 'storytelling' }), d).rule, 'storytelling-surface');
  assert.equal(decide(m({ intent: 'explanation', frequency: 'frequent' }), d).rule, 'frequent-needs-function');
  d.motion.intensity = 'none';
  assert.equal(decide(m({}), d).rule, 'project-motion-disabled');
  assert.equal(maxDuration(m({ frequency: 'frequent' })), 'fast');
});

test('the runtime ladder picks the lightest tool that can do the job', () => {
  const pick = (o, ctx) => chooseRuntime({ surface: 'marketing', intent: 'feedback', trigger: 'hover', frequency: 'occasional', ...o }, ctx).runtime;
  assert.equal(pick({}), 'css');
  assert.equal(pick({ trigger: 'in-view' }), 'css');
  assert.equal(pick({ trigger: 'scroll', intent: 'storytelling', duration: 'scrubbed' }), 'gsap-scrolltrigger');
  assert.equal(pick({ trigger: 'route-change' }), 'view-transitions');
  assert.equal(pick({ trigger: 'drag', surface: 'application' }, { framework: 'react' }), 'motion');
  assert.equal(pick({ trigger: 'drag' }), 'waapi');
  assert.equal(pick({ surface: 'mobile', trigger: 'drag', gestureDriven: true }), 'reanimated');
  assert.equal(pick({ surface: '3d', properties: ['camera'] }), 'three');
});

test('the demo motion spec lints clean and bad specs are caught', () => {
  const d = dna();
  const spec = fixture('motion-spec.json');
  const res = lintMotion(spec, d);
  assert.deepEqual(res.issues.filter((i) => i.level === 'error'), []);
  assert.ok(res.summary.none >= 2, 'the spec records decisions not to animate');
  const bad = clone(spec);
  bad.motions.push({ id: 'drag-x', surface: 'application', intent: 'feedback', trigger: 'drag', frequency: 'occasional', decision: 'animate', runtime: 'reanimated', duration: 'scrubbed', easing: 'linear', reducedMotionFallback: 'not-applicable', interruptible: false, keyboardEquivalent: false, properties: ['transform'], rationale: 'x' });
  const msgs = lintMotion(bad, d).issues.filter((i) => i.level === 'error').map((i) => i.message).join('\n');
  assert.match(msgs, /SC 2\.5\.7/);
  assert.match(msgs, /reduced-motion fallback/);
  assert.match(msgs, /React Native runtime/);
});
