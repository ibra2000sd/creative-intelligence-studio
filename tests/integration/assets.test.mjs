// Integration: the asset pipeline: local generation, caching, inspection
// failures, budget and consent policy, and the OpenAI adapter against a local
// stand-in for its API (success, rate limiting, outage, bad credentials).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { cs, project, readJson, writeJson, fixture, BIN } from '../helpers.mjs';
import { encodePng } from '../../plugin/cli/lib/providers.mjs';

const brief = (jobs, extra = {}) => ({ schemaVersion: '1.0.0', ...extra, jobs });
const job = (id, o = {}) => ({ id, purpose: 'Integration test asset', recipe: 'horizon-field', variant: 'dusk', width: 320, height: 200, formats: ['png', 'webp'], ...o });

function withBrief(dir, b) {
  writeJson(path.join(dir, '.cis/image-brief.json'), b);
}

/** Run the CLI without blocking the event loop, so an in-process HTTP stub can answer it. */
function csAsync(args, { cwd, env = {} }) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [BIN, ...args], { cwd, env: { ...process.env, ...env } });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('close', (status) => {
      let json = null;
      try {
        json = JSON.parse(out);
      } catch {
        /* text output */
      }
      resolve({ status, out, json });
    });
  });
}

test('local generation: exact sizes, formats, provenance, then reuse', () => {
  const dir = project();
  withBrief(dir, brief([job('one'), job('two', { recipe: 'contour-map', formats: ['svg', 'webp'], width: 400, height: 300 })]));
  const first = cs(['images', 'generate', '--json'], { cwd: dir });
  assert.equal(first.status, 0, first.out);
  assert.deepEqual(first.json.results.map((r) => r.status), ['generated', 'generated']);
  assert.equal(first.json.spentUsd, 0);
  assert.ok(fs.existsSync(path.join(dir, 'assets/generated/one/one-320x200.png')));
  assert.ok(fs.existsSync(path.join(dir, 'assets/generated/two/two-400x300.svg')));
  const reg = readJson(path.join(dir, '.cis/assets/registry.json'));
  const rec = reg.assets.find((a) => a.id === 'one');
  assert.equal(rec.origin.provider, 'local-procedural');
  assert.equal(rec.origin.simulated, false);
  assert.equal(rec.rights.status, 'cleared');
  assert.equal(rec.qa.status, 'passed');
  for (const id of ['dimensions', 'not-blank', 'palette-adherence', 'not-duplicate']) assert.ok(rec.qa.checks.find((c) => c.id === id)?.pass, id);
  assert.match(rec.files[0].sha256, /^[0-9a-f]{64}$/);
  const second = cs(['images', 'generate', '--json'], { cwd: dir });
  assert.deepEqual(second.json.results.map((r) => r.status), ['cached', 'cached'], 'identical jobs are not produced twice');
  // Editing one job regenerates that job only.
  withBrief(dir, brief([job('one'), job('two', { recipe: 'contour-map', formats: ['svg', 'webp'], width: 400, height: 300, seed: 99 })]));
  assert.deepEqual(cs(['images', 'generate', '--json'], { cwd: dir }).json.results.map((r) => r.status), ['cached', 'generated']);
  assert.equal(cs(['images', 'verify'], { cwd: dir }).status, 0);
  fs.appendFileSync(path.join(dir, 'assets/generated/one/one-320x200.png'), 'tampered');
  const v = cs(['images', 'verify', '--json'], { cwd: dir });
  assert.equal(v.status, 1);
  assert.equal(v.json.problems[0].problem, 'modified since registration');
});

test('a byte budget that is exceeded rejects the asset instead of shipping it', () => {
  const dir = project();
  withBrief(dir, brief([job('heavy', { width: 800, height: 600, maxBytes: 1500 })]));
  const r = cs(['images', 'generate', '--json'], { cwd: dir });
  assert.equal(r.status, 1);
  assert.match(r.json.results[0].error, /byte-budget/);
  assert.equal(readJson(path.join(dir, '.cis/assets/registry.json')).assets[0].qa.status, 'failed');
});

test('identical artwork under a second id is flagged as a duplicate', () => {
  const dir = project();
  withBrief(dir, brief([job('first', { seed: 1 }), job('second', { seed: 1 })]));
  const r = cs(['images', 'generate', '--json'], { cwd: dir });
  assert.equal(r.json.results[0].status, 'generated');
  assert.match(r.json.results[1].error, /not-duplicate.*first/);
});

test('raster formats are refused cleanly when the raster engine is missing', () => {
  const dir = project();
  withBrief(dir, brief([job('needs-raster'), job('vector-only', { formats: ['svg'], recipe: 'pattern-tile' })]));
  const r = cs(['images', 'generate', '--json'], { cwd: dir, env: { CIS_DISABLE_ENGINES: 'raster' } });
  assert.match(r.json.results[0].error, /creative-studio setup --only raster/);
  assert.equal(r.json.results[1].status, 'generated', 'vector output still works offline with no engines');
});

test('mock provider: off by default; wrong size, blank and off-brand output are rejected; output is never deliverable', () => {
  const dir = project();
  withBrief(dir, brief([job('m1', { formats: ['png'] })]));
  const refused = cs(['images', 'generate', '--provider', 'mock'], { cwd: dir });
  assert.equal(refused.status, 3);
  assert.match(refused.stderr, /CIS_ALLOW_MOCK/);
  const run = (mode, id) => {
    withBrief(dir, brief([job(id, { formats: ['png'] })]));
    return cs(['images', 'generate', '--provider', 'mock', '--json'], { cwd: dir, env: { CIS_ALLOW_MOCK: '1', CIS_MOCK_MODE: mode } }).json.results[0];
  };
  assert.match(run('wrong-size', 'w').error, /requires 320x200/);
  assert.match(run('blank', 'b').error, /not-blank/);
  assert.match(run('off-brand', 'o').error, /palette-adherence/);
  assert.match(run('fail', 'f').error, /configured to fail/);
  const ok = run('ok', 'good');
  assert.equal(ok.status, 'generated');
  assert.ok(ok.costUsd > 0);
  const verify = cs(['images', 'verify', '--json'], { cwd: dir });
  assert.ok(verify.json.problems.some((p) => p.asset === 'good' && /simulated/.test(p.problem)), 'simulated output blocks delivery');
  const cost = readJson(path.join(dir, '.cis/cost.json'));
  assert.ok(cost.entries.some((e) => e.kind === 'refund-failed-call'), 'a failed call returns its reserved budget');
  assert.ok(Math.abs(cost.spentUsd - 0.08) < 1e-9, `every call that returned output is charged, rejected or not; the failed call is not: ${cost.spentUsd}`);
});

test('the project budget stops paid generation before the call is made', () => {
  const b = fixture('brief.json');
  b.constraints.budgetUsd = 0.03;
  const dir = project({ brief: b });
  withBrief(dir, brief([job('a', { formats: ['png'], seed: 1 }), job('b', { formats: ['png'], seed: 2 }), job('c', { formats: ['png'], seed: 3 })]));
  const r = cs(['images', 'generate', '--provider', 'mock', '--json'], { cwd: dir, env: { CIS_ALLOW_MOCK: '1' } });
  assert.deepEqual(r.json.results.map((x) => x.status), ['generated', 'failed', 'failed']);
  assert.equal(r.json.results[1].blocked, 'budget');
  assert.match(r.json.results[1].error, /Budget stop/);
  assert.ok(r.json.spentUsd <= 0.03);
  assert.match(cs(['images', 'estimate', '--provider', 'mock'], { cwd: dir, env: { CIS_ALLOW_MOCK: '1' } }).stdout, /Total estimate/);
});

test('remote providers obey the brief: deny refuses, ask needs consent, a missing key is reported', () => {
  const deny = fixture('brief.json');
  deny.constraints.externalUploads = 'deny';
  const d1 = project({ brief: deny });
  withBrief(d1, brief([job('x', { formats: ['png'] })]));
  const refused = cs(['images', 'generate', '--provider', 'openai', '--consent'], { cwd: d1, env: { OPENAI_API_KEY: 'test-key-not-real' } });
  assert.equal(refused.status, 3);
  assert.match(refused.stderr, /forbids sending material to external services/);
  const d2 = project();
  withBrief(d2, brief([job('x', { formats: ['png'] })]));
  const needs = cs(['images', 'generate', '--provider', 'openai'], { cwd: d2, env: { OPENAI_API_KEY: 'test-key-not-real' } });
  assert.equal(needs.status, 3);
  assert.match(needs.stderr, /re-run with --consent/);
  const nokey = cs(['images', 'generate', '--provider', 'openai', '--consent'], { cwd: d2, env: { OPENAI_API_KEY: '' } });
  assert.equal(nokey.status, 3);
  assert.match(nokey.stderr, /OPENAI_API_KEY is not set/);
});

test('OpenAI adapter against a local stand-in: success, retry after 429, outage, bad key', async () => {
  const dna = fixture('experience-dna.json');
  const [r, g, b] = [0xe9, 0xa2, 0x3b];
  const bg = [0xf6, 0xf1, 0xe7];
  // Each response is a different brand-coloured gradient, as a real model would return different images.
  let served = 0;
  const picture = () => {
    const k = served++;
    return encodePng(1536, 1024, (x, y) => bg.map((v, i) => Math.round(v + ([r, g, b][i] - v) * Math.min(1, (k % 2 ? y / 1024 : x / 1536) * (1 + k * 0.35))))).toString('base64');
  };
  const seen = [];
  let mode = 'ok';
  let calls = 0;
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (d) => (body += d));
    req.on('end', () => {
      calls++;
      seen.push({ url: req.url, auth: req.headers.authorization, body: JSON.parse(body) });
      if (mode === 'rate' && calls === 1) return res.writeHead(429, { 'retry-after': '0' }).end('{"error":{"message":"slow down"}}');
      if (mode === 'down') return res.writeHead(503).end('{"error":{"message":"unavailable"}}');
      if (mode === 'auth') return res.writeHead(401).end('{"error":{"message":"bad key"}}');
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ data: [{ b64_json: picture() }] }));
    });
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const env = { OPENAI_API_KEY: 'test-key-not-real', CIS_OPENAI_BASE_URL: `http://127.0.0.1:${server.address().port}/v1` };
  try {
    const dir = project();
    const go = async (id, m) => {
      mode = m;
      calls = 0;
      withBrief(dir, brief([job(id, { formats: ['png', 'webp'], width: 600, height: 400, quality: 'low', prompt: 'Calm dusk horizon' })]));
      return (await csAsync(['images', 'generate', '--provider', 'openai', '--consent', '--json'], { cwd: dir, env })).json;
    };
    const ok = await go('remote-ok', 'ok');
    assert.equal(ok.results[0].status, 'generated', JSON.stringify(ok.results[0]).slice(0, 900));
    assert.equal(seen[0].url, '/v1/images/generations');
    assert.equal(seen[0].auth, 'Bearer test-key-not-real');
    assert.equal(seen[0].body.size, '1536x1024', 'nearest supported size to 3:2');
    assert.match(seen[0].body.prompt, /Calm dusk horizon/);
    assert.match(seen[0].body.prompt, /Do not render any text/);
    assert.ok(seen[0].body.prompt.includes(dna.imagery.style));
    const rec = readJson(path.join(dir, '.cis/assets/registry.json')).assets.find((a) => a.id === 'remote-ok');
    assert.equal(rec.origin.provider, 'openai');
    assert.equal(rec.rights.status, 'restricted', 'provider terms must be confirmed before delivery');
    assert.ok(rec.qa.checks.find((c) => c.id === 'cropped-to-requirement'), 'output was fitted to the exact requirement');
    assert.ok(!JSON.stringify(rec).includes('test-key-not-real'), 'the key is not recorded');
    assert.ok(rec.origin.costUsd > 0);

    const retried = await go('remote-retry', 'rate');
    assert.equal(retried.results[0].status, 'generated');
    assert.equal(calls, 2, 'one retry after the 429');

    const down = await go('remote-down', 'down');
    assert.equal(down.results[0].status, 'failed');
    assert.equal(down.results[0].code, 'E_PROVIDER_UNAVAILABLE');
    assert.equal(calls, 3, 'retries are capped');

    const before = readJson(path.join(dir, '.cis/cost.json')).spentUsd;
    const auth = await go('remote-auth', 'auth');
    assert.equal(auth.results[0].code, 'E_PROVIDER_AUTH');
    assert.equal(calls, 1, 'a rejected key is not retried');
    assert.equal(readJson(path.join(dir, '.cis/cost.json')).spentUsd, before, 'failed calls cost nothing');
    const ledger = fs.readFileSync(path.join(dir, '.cis/ledger.jsonl'), 'utf8');
    assert.ok(ledger.includes('asset.failed') && !ledger.includes('test-key-not-real'));
  } finally {
    server.close();
  }
});
