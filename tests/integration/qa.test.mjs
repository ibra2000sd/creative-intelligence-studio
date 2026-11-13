// Integration: tests of the QA harness itself. A page with planted defects
// must be caught; a clean page must pass. Without this, a green QA run would
// prove nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tmpDir } from '../helpers.mjs';
import { serve } from '../../plugin/cli/commands/build.mjs';
import { runBrowserSuite, checkBundle, totals, measurementIsNoisy } from '../../plugin/cli/lib/qa.mjs';
import { findChrome, hasCapability } from '../../plugin/cli/lib/deps.mjs';

const canRun = hasCapability('browser') && Boolean(findChrome());
const page = (body, css = '') => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fixture</title><link rel="icon" href="data:,"><style>body{margin:0;font:16px/1.5 system-ui;background:#fff;color:#111}a,button{min-height:44px;min-width:44px;display:inline-flex;align-items:center}:focus-visible{outline:3px solid #00f}${css}</style></head><body><main>${body}</main></body></html>`;

async function run(html, { flows } = {}) {
  const dir = tmpDir();
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  let flowsFile;
  if (flows) {
    flowsFile = path.join(dir, 'flows.mjs');
    fs.writeFileSync(flowsFile, flows);
  }
  const server = await serve(dir);
  try {
    const checks = await runBrowserSuite({ baseUrl: server.url, pages: [{ label: 'fixture', path: '/' }], evidenceDir: path.join(dir, 'evidence'), baselineDir: path.join(dir, 'baselines'), flowsFile, options: { scrollMotion: false, performance: false, fullPage: false, settleMs: 200 } });
    return { checks, dir, by: (id) => checks.filter((c) => c.id.startsWith(id)) };
  } finally {
    await server.close();
  }
}

test('a clean page passes every generic check', { skip: !canRun && 'needs the browser engine and a Chromium browser' }, async () => {
  const { checks, dir } = await run(page('<h1>Clean page</h1><p>Readable text with enough contrast.</p><a href="#x">A link</a> <button type="button">A button</button><p id="x">Target</p>'));
  const failing = checks.filter((c) => c.status === 'fail');
  assert.deepEqual(failing.map((c) => `${c.id}: ${c.summary}`), []);
  assert.ok(checks.some((c) => c.id.startsWith('a11y-axe') && c.status === 'pass'));
  assert.ok(fs.readdirSync(path.join(dir, 'evidence')).some((f) => f.endsWith('.png')), 'screenshots are kept as evidence');
  assert.ok(fs.readdirSync(path.join(dir, 'baselines')).length >= 3, 'first run establishes baselines');
});

test('planted defects are each caught by the check responsible for them', { skip: !canRun && 'needs the browser engine and a Chromium browser' }, async () => {
  const html = page(
    `<h1>Defective page</h1>
     <p class="faint">This text is far too pale to read.</p>
     <div class="wide">This box is wider than any phone.</div>
     <img src="missing.png" width="40" height="40">
     <a class="tiny" href="#a">x</a>
     <button class="noring" type="button">No focus ring</button>
     <input type="text">
     <p class="hidden-forever">This paragraph never appears.</p>
     <script>console.error('planted console error'); setTimeout(() => { throw new Error('planted exception'); }, 0);</script>`,
    `.faint{color:#ccc}.wide{width:900px;background:#eee}.tiny{min-height:0;min-width:0;display:inline-block;font-size:9px;line-height:1;margin-left:40px}.noring:focus-visible{outline:none}.hidden-forever{opacity:0}@keyframes spin{to{transform:rotate(360deg)}}h1{animation:spin 4s linear infinite}`,
  );
  const { by } = await run(html);
  const failed = (id) => by(id).filter((c) => c.status === 'fail');
  assert.ok(failed('load:').length >= 1, 'runtime errors');
  const problems = failed('load:')[0].data.problems.join('\n');
  assert.match(problems, /planted console error/);
  assert.match(problems, /planted exception/);
  assert.match(problems, /missing\.png/);
  assert.ok(failed('layout:fixture@mobile').length === 1, 'overflow on a phone');
  assert.ok(failed('layout:fixture@mobile')[0].data.wide > 400);
  const axe = failed('a11y-axe:fixture:light')[0];
  assert.ok(axe, 'axe violations');
  const ids = axe.data.violations.map((v) => v.id);
  for (const rule of ['image-alt', 'label']) assert.ok(ids.includes(rule), `axe reports ${rule}; got ${ids.join(', ')}`);
  // The pale text sits under an overflowing box, so axe may be unable to decide its contrast.
  // Either way it must be surfaced by name, never folded into a pass.
  assert.match(axe.summary, /color-contrast/, 'contrast is reported as a violation or as undecided');
  assert.match(failed('keyboard:')[0].summary, /1 stop\(s\) without a visible focus indicator/);
  assert.match(failed('target-size:')[0].data.small.join(), /a "x"/);
  const rm = failed('reduced-motion:')[0];
  assert.ok(rm.data.running.length >= 1, 'an animation that ignores reduced motion');
  assert.ok(rm.data.hidden.length >= 1, 'content left invisible');
});

test('a rule axe cannot decide is a warning, and a decidable contrast failure is a failure', { skip: !canRun && 'needs the browser engine and a Chromium browser' }, async () => {
  const pale = await run(page('<h1>Heading</h1><p style="color:#ccc">Too pale to read on white.</p>'));
  const a = pale.by('a11y-axe:fixture:light')[0];
  assert.equal(a.status, 'fail');
  assert.ok(a.data.violations.some((v) => v.id === 'color-contrast'));
  const overImage = await run(page('<h1>Heading</h1><p style="color:#777;background:linear-gradient(90deg,#fff,#000);padding:8px">Text over a gradient.</p>'));
  const b = overImage.by('a11y-axe:fixture:light')[0];
  assert.equal(b.status, 'warn', b.summary);
  assert.match(b.summary, /could not decide/);
});

test('scripted flows report pass and fail with the reason', { skip: !canRun && 'needs the browser engine and a Chromium browser' }, async () => {
  const flows = `export const flows = [
    { id: 'counter-works', title: 'Counter increments', async run({ page, baseUrl, expect }) { await page.goto(baseUrl + '/'); await page.click('#inc'); expect.equal(await page.textContent('#n'), '1', 'count'); return 'clicked once'; } },
    { id: 'counter-wrong', title: 'Counter is expected to reach 5', async run({ page, baseUrl, expect }) { await page.goto(baseUrl + '/'); await page.click('#inc'); expect.equal(await page.textContent('#n'), '5', 'count'); } },
    { id: 'throws-in-page', title: 'Page throws during the flow', async run({ page, baseUrl }) { await page.goto(baseUrl + '/'); await page.click('#boom'); await page.waitForTimeout(100); } },
  ];`;
  const html = page(`<h1>Flows</h1><button id="inc" type="button" onclick="n.textContent = Number(n.textContent) + 1">Add</button><output id="n">0</output><button id="boom" type="button" onclick="setTimeout(() => { throw new Error('boom') }, 0)">Break</button>`);
  const { by, dir } = await run(html, { flows });
  assert.equal(by('flow:counter-works')[0].status, 'pass');
  assert.match(by('flow:counter-works')[0].summary, /clicked once/);
  const wrong = by('flow:counter-wrong')[0];
  assert.equal(wrong.status, 'fail');
  assert.match(wrong.summary, /got "1", expected "5"/);
  assert.ok(fs.existsSync(wrong.evidence[0]), 'a failing flow leaves a screenshot');
  assert.match(by('flow:throws-in-page')[0].summary, /uncaught exception during flow: Error: boom/);
  assert.ok(dir);
});

test('visual regression: an unchanged page matches, a changed page is caught', { skip: !canRun && 'needs the browser engine and a Chromium browser' }, async () => {
  const dir = tmpDir();
  const opts = (label) => ({ pages: [{ label: 'vr', path: '/' }], evidenceDir: path.join(dir, `evidence-${label}`), baselineDir: path.join(dir, 'baselines'), options: { scrollMotion: false, performance: false, reducedMotion: false, fullPage: false, settleMs: 150 } });
  const once = async (html, label) => {
    fs.writeFileSync(path.join(dir, 'index.html'), html);
    const server = await serve(dir);
    try {
      return (await runBrowserSuite({ baseUrl: server.url, ...opts(label) })).filter((c) => c.id.startsWith('visual-regression'));
    } finally {
      await server.close();
    }
  };
  const a = page('<h1>Stable heading</h1><p>Body text.</p>');
  assert.ok((await once(a, 'first')).every((c) => c.status === 'skipped'), 'first run records baselines');
  assert.ok((await once(a, 'second')).every((c) => c.status === 'pass'), 'identical page matches');
  const changed = await once(page('<h1>Stable heading</h1><p>Body text.</p>', 'body{background:#102040;color:#fff}'), 'third');
  assert.ok(changed.every((c) => c.status === 'fail'));
  assert.ok(changed[0].data.changedRatio > 0.5);
  assert.ok(changed[0].evidence.some((e) => e.endsWith('.diff.png')), 'a heatmap is kept');
});

test('bundle budgets and totals', () => {
  const dir = tmpDir();
  fs.writeFileSync(path.join(dir, 'app.js'), 'console.log(1);'.repeat(10));
  fs.writeFileSync(path.join(dir, 'app.css'), 'a{color:red}');
  const ok = checkBundle(dir, 'x');
  assert.equal(ok.status, 'pass');
  assert.equal(ok.measurement, 'static');
  let big = '';
  for (let i = 0; i < 60000; i++) big += `var v${i}=${Math.random()};`;
  fs.writeFileSync(path.join(dir, 'big.js'), big);
  assert.equal(checkBundle(dir, 'x').status, 'warn');
  assert.deepEqual(totals([{ checks: [{ status: 'pass' }, { status: 'fail' }, { status: 'blocked' }] }]), { pass: 1, fail: 1, warn: 0, skipped: 0, blocked: 1 });
});

test('timing from a busy host or from runs that disagree is classed as unreliable', () => {
  assert.equal(measurementIsNoisy([90, 72, 125, 110, 95], 95, 0.4), false, 'quiet host, tight runs');
  assert.equal(measurementIsNoisy([90, 72, 125, 110, 95], 95, 2.5), true, 'more runnable work than cores');
  assert.equal(measurementIsNoisy([374, 19, 38, 140, 105], 105, 0.4), true, 'identical loads from 19 to 374 ms');
  assert.equal(measurementIsNoisy([1400, 1480, 1441, 1390, 1500], 1441, 0.4), false, 'slow but consistent is a real result');
  assert.equal(measurementIsNoisy([0, 0, 0, 0, 0], 0, 0), false, 'Windows reports no load average');
});
