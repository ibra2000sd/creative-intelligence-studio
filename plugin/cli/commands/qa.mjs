// Quality commands: test (browser + build suites with a bounded repair loop),
// audit (security, privacy, licences, SBOM), review (creative rubric contract),
// d2c (design-to-code analysis and visual comparison).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { CisError, EXIT, CIS_VERSION, readJson, writeJson, writeFileAtomic, exists, print, table, nowIso, redact } from '../lib/util.mjs';
import { validate, assertValid } from '../lib/schema.mjs';
import { requireProject, paths, appendEvent, verifyLedger, loadProject } from '../lib/project.mjs';
import { loadDna, lintDna, consistency } from '../lib/dna.mjs';
import { verifyRegistry } from '../lib/assets.mjs';
import { hasCapability, findChrome } from '../lib/deps.mjs';
import { serve } from './build.mjs';
import { DELIVERABLE_DIRS } from './dna.mjs';

const json = (flags, value) => (flags.json ? (print(JSON.stringify(value, null, 2)), true) : false);
const chk = (id, category, status, summary, extra = {}) => ({ id, category, status, summary, ...extra });

function run(cmd, args, cwd, timeoutMs = 600000) {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', timeout: timeoutMs, env: { ...process.env, CI: '1', FORCE_COLOR: '0' } });
  const out = redact(`${r.stdout || ''}\n${r.stderr || ''}`).trim();
  return { ok: r.status === 0, status: r.status, tail: out.split('\n').slice(-14).join('\n'), out };
}

const TARGETS = {
  web: { kind: 'website', dir: 'web', dist: 'web/dist' },
  app: { kind: 'web-app', dir: 'app', dist: 'app/dist', spa: true },
  scene: { kind: 'scene-3d', dir: 'scene', dist: 'scene/dist' },
  mobile: { kind: 'mobile', dir: 'mobile', dist: 'mobile/dist-web', spa: true },
};

function pagesFor(id, root) {
  if (id === 'web') {
    const content = readJson(path.join(root, 'web/src/content.json'));
    return Object.entries(content.locales).map(([l, c]) => ({ label: l === content.defaultLocale ? 'home' : `home-${l}`, path: l === content.defaultLocale ? '/' : `/${l}/`, rtl: c.dir === 'rtl' }));
  }
  if (id === 'app') return [{ label: 'portal', path: '/' }, { label: 'portal-ar', path: '/?lang=ar', rtl: true }];
  if (id === 'scene') return [{ label: 'scene', path: '/' }, { label: 'scene-still', path: '/?fallback=1', budgets: false }];
  return [{ label: 'app-web', path: '/' }];
}

async function testBrowserTarget(root, id, flags, dna) {
  const t = TARGETS[id];
  const checks = [];
  const dist = path.join(root, t.dist);
  if (!exists(path.join(root, t.dir))) return null;
  if (!exists(path.join(dist, 'index.html'))) {
    checks.push(chk(`build:${id}`, 'build', 'blocked', `${t.dist} does not exist. Build it first (npm install && npm run build in ${t.dir}/).`, { severity: 'critical', measurement: 'static' }));
    return { id, kind: t.kind, checks };
  }
  checks.push(chk(`build:${id}`, 'build', 'pass', `Built output present at ${t.dist}`, { measurement: 'static' }));
  const { runBrowserSuite, checkBundle } = await import('../lib/qa.mjs');
  // The mobile web export is a test vehicle for the React Native code, not a shipped website.
  if (id !== 'mobile') checks.push(checkBundle(dist, id, { exclude: id === 'web' ? [`${path.sep}scene${path.sep}`] : [] }));
  if (!hasCapability('browser') || !findChrome()) {
    checks.push(chk(`browser:${id}`, 'functional', 'blocked', 'Browser checks need the browser engine and a Chromium browser (creative-studio doctor).', { severity: 'critical', measurement: 'lab' }));
    return { id, kind: t.kind, checks };
  }
  const server = await serve(dist, { spa: Boolean(t.spa) });
  const evidenceDir = path.join(paths(root).reports, 'qa', id);
  fs.rmSync(evidenceDir, { recursive: true, force: true });
  try {
    const options = id === 'scene' ? { scrollMotion: false, fullPage: false, settleMs: 2200 } : id === 'mobile' ? { scrollMotion: false, fullPage: false, settleMs: 1500, performance: false, viewports: ['mobile', 'tablet'] } : id === 'web' ? { settleMs: 1200 } : { fullPage: 'tall' };
    // A deliverable may declare a budget exception, but only together with its reason.
    const budgetFile = path.join(root, t.dir, 'qa', 'budgets.json');
    let budgets = null;
    if (exists(budgetFile)) {
      budgets = readJson(budgetFile);
      if (!budgets.rationale || budgets.rationale.length < 40) throw new CisError('E_BUDGET_EXCEPTION', `${path.relative(root, budgetFile)} must explain its exception in a "rationale" of at least 40 characters.`);
    }
    // The Experience DNA defines a dark scheme, so every deliverable is expected to respond to it.
    options.expectDark = Boolean(dna.color?.semantic?.dark);
    const res = await runBrowserSuite({ baseUrl: server.url, budgets, pages: pagesFor(id, root), evidenceDir, baselineDir: path.join(root, t.dir, 'qa', 'baselines'), flowsFile: path.join(root, t.dir, 'qa', 'flows.mjs'), minTargetPx: dna.accessibility.minTargetPx, updateBaselines: Boolean(flags['update-baselines']), options });
    for (const c of res) {
      if (c.evidence) c.evidence = c.evidence.map((e) => path.relative(root, e));
      checks.push(c);
    }
  } finally {
    await server.close();
  }
  return { id, kind: t.kind, url: `served from ${t.dist}`, checks };
}

function testMobile(root, flags) {
  const dir = path.join(root, 'mobile');
  if (!exists(dir)) return null;
  const checks = [];
  if (!exists(path.join(dir, 'node_modules'))) {
    checks.push(chk('build:mobile', 'build', 'blocked', 'mobile/node_modules is missing. Run the package manager install in mobile/ first.', { severity: 'critical', measurement: 'static' }));
    return { id: 'mobile-native', kind: 'mobile', checks };
  }
  const steps = [
    ['typecheck', 'build', ['run', 'typecheck'], 'TypeScript type check'],
    ['unit-tests', 'functional', ['test'], 'Jest unit and component tests'],
    ...(flags.quick ? [] : [['export-native', 'build', ['run', 'export:native'], 'Metro production bundles for iOS and Android (expo export)'], ['export-web', 'build', ['run', 'export:web'], 'Web export used for runtime interaction tests']]),
  ];
  for (const [id, category, args, title] of steps) {
    const r = run('npm', args, dir, 900000);
    const m = /Tests:\s+(.*)/.exec(r.out);
    checks.push(chk(`${id}:mobile`, category, r.ok ? 'pass' : 'fail', r.ok ? `${title}: ok${m ? ` (${m[1].trim()})` : ''}` : `${title} failed (exit ${r.status})`, { severity: 'critical', measurement: 'static', data: { tail: r.tail } }));
  }
  const native = path.join(dir, 'dist-native');
  if (exists(native)) {
    const bundles = fs.existsSync(path.join(native, '_expo/static/js')) ? ['ios', 'android'].map((p) => ({ platform: p, files: fs.existsSync(path.join(native, '_expo/static/js', p)) ? fs.readdirSync(path.join(native, '_expo/static/js', p)).map((f) => ({ file: f, bytes: fs.statSync(path.join(native, '_expo/static/js', p, f)).size })) : [] })) : [];
    const ok = bundles.length === 2 && bundles.every((b) => b.files.length > 0);
    checks.push(chk('bundles:mobile', 'build', ok ? 'pass' : 'fail', ok ? `Production JS bundles exist for iOS and Android (${bundles.map((b) => `${b.platform} ${(b.files.reduce((n, f) => n + f.bytes, 0) / 1024 / 1024).toFixed(2)}MB`).join(', ')})` : 'Expected iOS and Android bundles were not produced', { severity: 'critical', measurement: 'static', data: { bundles } }));
  }
  const xcode = spawnSync('xcrun', ['--find', 'simctl'], { encoding: 'utf8' }).status === 0;
  const android = Boolean(process.env.ANDROID_HOME) || spawnSync('which', ['adb'], { encoding: 'utf8' }).status === 0;
  checks.push(chk('native-ios:mobile', 'build', xcode ? 'skipped' : 'blocked', xcode ? 'Xcode is present; run `npx expo run:ios` and simulator tests (not automated by this command).' : 'Native iOS build and simulator tests cannot run: full Xcode is not installed on this machine. Needs macOS with Xcode, then `npx expo run:ios`; store builds also need an Apple signing identity.', { severity: 'major', measurement: 'manual-required' }));
  checks.push(chk('native-android:mobile', 'build', android ? 'skipped' : 'blocked', android ? 'Android SDK is present; run `npx expo run:android` and emulator tests (not automated by this command).' : 'Native Android build and emulator tests cannot run: the Android SDK is not installed on this machine. Needs Android Studio / SDK and an emulator or device, then `npx expo run:android`; store builds also need a signing keystore.', { severity: 'major', measurement: 'manual-required' }));
  return { id: 'mobile-native', kind: 'mobile', checks };
}

function testProject(root, dna) {
  const checks = [];
  const led = verifyLedger(root);
  checks.push(chk('ledger-integrity', 'delivery', led.ok ? 'pass' : 'fail', led.ok ? `Event ledger hash chain intact (${led.count} events)` : `Ledger problems: ${led.problems.slice(0, 3).join('; ')}`, { severity: 'critical', measurement: 'static' }));
  const lint = lintDna(dna);
  const errs = lint.filter((i) => i.level === 'error');
  checks.push(chk('dna-lint', 'visual', errs.length ? 'fail' : lint.length ? 'warn' : 'pass', errs.length ? `Experience DNA has ${errs.length} error(s): ${errs[0].message}` : `Experience DNA r${dna.revision}: contrast, licences, motion and localisation rules hold${lint.length ? ` (${lint.length} warning(s))` : ''}`, { severity: 'critical', measurement: 'static', data: { issues: lint } }));
  const present = DELIVERABLE_DIRS.filter((d) => exists(path.join(root, d.dir)));
  const con = consistency(root, dna, present);
  writeJson(path.join(paths(root).reports, 'consistency.json'), con);
  const drift = con.deliverables.filter((d) => !['current', 'not-applicable'].includes(d.tokens) || d.offPalette.length || d.foreignFonts.length);
  checks.push(chk('dna-consistency', 'visual', drift.length ? 'fail' : 'pass', drift.length ? `Deliverables drifting from the DNA: ${drift.map((d) => `${d.id} (tokens ${d.tokens}, ${d.offPalette.length} off-palette colours, ${d.foreignFonts.length} foreign fonts)`).join('; ')}` : `${con.deliverables.length} deliverables carry tokens generated from DNA r${dna.revision}, with no off-palette colours or foreign fonts in their source`, { severity: 'major', measurement: 'static', data: { deliverables: con.deliverables.map((d) => ({ id: d.id, tokens: d.tokens, filesScanned: d.filesScanned, offPalette: d.offPalette.slice(0, 5), foreignFonts: d.foreignFonts.slice(0, 5) })) }, evidence: ['.cis/reports/consistency.json'] }));
  const reg = verifyRegistry(root);
  checks.push(chk('asset-registry', 'delivery', reg.problems.length ? 'fail' : 'pass', reg.problems.length ? `${reg.problems.length} asset problem(s): ${reg.problems.slice(0, 3).map((p) => `${p.asset} ${p.problem}`).join('; ')}` : `${reg.count} assets, ${reg.files} files: every file exists and matches its registered hash`, { severity: 'major', measurement: 'static', data: { problems: reg.problems.slice(0, 20) } }));
  return { id: 'project', kind: 'project', checks };
}

/** Bounded repair loop bookkeeping: a defect that survives `maxAttempts` runs escalates to a human. */
function updateDefects(root, targets, maxAttempts) {
  const file = path.join(paths(root).reports, 'defects.json');
  const prev = exists(file) ? readJson(file) : { schemaVersion: '1.0.0', defects: [] };
  const now = nowIso();
  const failing = new Map();
  for (const t of targets) for (const c of t.checks) if (c.status === 'fail') failing.set(`${t.id}/${c.id}`, { target: t.id, check: c.id, category: c.category, severity: c.severity || 'major', summary: c.summary });
  const defects = [];
  for (const d of prev.defects) {
    if (failing.has(d.key)) {
      const attempts = d.status === 'fixed' ? 1 : d.attempts + 1;
      defects.push({ ...d, ...failing.get(d.key), attempts, lastSeen: now, status: attempts >= maxAttempts ? 'escalated' : 'open', regression: d.status === 'fixed' || d.regression || false });
      failing.delete(d.key);
    } else if (d.status !== 'fixed') defects.push({ ...d, status: 'fixed', fixedAt: now });
    else defects.push(d);
  }
  for (const [key, f] of failing) defects.push({ key, ...f, attempts: 1, firstSeen: now, lastSeen: now, status: 'open' });
  const order = { critical: 0, major: 1, minor: 2, info: 3 };
  defects.sort((a, b) => (a.status === 'fixed') - (b.status === 'fixed') || order[a.severity] - order[b.severity]);
  writeJson(file, { schemaVersion: '1.0.0', updatedAt: now, maxAttempts, defects });
  return defects;
}

function summaryMarkdown(summary, defects) {
  const lines = [`# QA summary`, '', `Generated ${summary.generatedAt} by creative-studio ${CIS_VERSION}. Verdict: **${summary.verdict}**.`, '', `Pass ${summary.totals.pass} · Fail ${summary.totals.fail} · Warn ${summary.totals.warn} · Blocked ${summary.totals.blocked} · Skipped ${summary.totals.skipped}`, '', 'Measurements labelled *lab* were taken in headless Chrome on the build machine. They are not field data and say nothing about real users\' devices or networks.', ''];
  for (const t of summary.targets) {
    lines.push(`## ${t.id} (${t.kind})`, '', '| Status | Check | Category | Result |', '|---|---|---|---|');
    for (const c of t.checks) lines.push(`| ${c.status} | \`${c.id}\` | ${c.category}${c.measurement ? ` (${c.measurement})` : ''} | ${c.summary.replace(/\|/g, '\\|').replace(/\n/g, ' ')} |`);
    lines.push('');
  }
  const open = defects.filter((d) => d.status !== 'fixed');
  lines.push('## Defects', '', open.length ? '| Status | Severity | Where | Runs failing | Summary |\n|---|---|---|---|---|\n' + open.map((d) => `| ${d.status} | ${d.severity} | \`${d.key}\` | ${d.attempts} | ${d.summary.replace(/\|/g, '\\|')} |`).join('\n') : 'No open defects.', '');
  lines.push('## Not covered by automation', '', ...summary.manualAuditsOutstanding.map((m) => `- ${m}`), '');
  return lines.join('\n');
}

async function test({ _, flags }) {
  const root = requireProject(flags.project);
  const dna = loadDna(root);
  const wanted = _.length ? _ : ['project', 'web', 'app', 'scene', 'mobile'];
  const unknown = wanted.filter((w) => w !== 'project' && !TARGETS[w]);
  if (unknown.length) throw new CisError('E_USAGE', `Unknown test target: ${unknown.join(', ')}. Known: project, ${Object.keys(TARGETS).join(', ')}`, { exit: EXIT.USAGE });
  const targets = [];
  const say = (m) => !flags.json && print(m);
  if (wanted.includes('project')) targets.push(testProject(root, dna));
  for (const id of wanted.filter((w) => TARGETS[w])) {
    say(`Testing ${id} ...`);
    if (id === 'mobile') {
      const native = testMobile(root, flags);
      if (native) targets.push(native);
    }
    const t = await testBrowserTarget(root, id, flags, dna);
    if (t) targets.push(id === 'mobile' ? { ...t, id: 'mobile-web', kind: 'mobile-web' } : t);
  }
  // Merge with earlier results for targets not re-run, so the summary stays whole.
  const summaryFile = path.join(paths(root).reports, 'qa-summary.json');
  const prior = exists(summaryFile) ? readJson(summaryFile).targets.filter((p) => !targets.some((t) => t.id === p.id)) : [];
  const all = [...prior, ...targets].sort((a, b) => a.id.localeCompare(b.id));
  const { totals } = await import('../lib/qa.mjs');
  const tot = totals(all);
  const summary = {
    schemaVersion: '1.0.0',
    generatedAt: nowIso(),
    environment: { tool: `creative-studio ${CIS_VERSION}`, node: process.version, platform: `${process.platform} ${os.release()} ${process.arch}`, cpu: os.cpus()[0]?.model, browser: findChrome() ? path.basename(findChrome()) : null },
    targets: all,
    totals: tot,
    verdict: tot.fail ? 'fail' : tot.blocked ? 'incomplete' : 'pass',
    manualAuditsOutstanding: [
      'Screen-reader walkthrough (VoiceOver, NVDA, TalkBack): automated rules cover only part of WCAG 2.2.',
      'Testing on real phones and a low-powered laptop: frame timing here comes from one desktop GPU.',
      'Field Core Web Vitals (75th percentile of real visits): only available after launch.',
      'Native iOS and Android builds, device gestures and store review.',
      'Copy review by a fluent Arabic editor and a legal review of claims.',
    ],
  };
  assertValid('qa-summary', summary, 'QA summary');
  writeJson(summaryFile, summary);
  const defects = updateDefects(root, all, Number(flags['max-attempts'] || 3));
  writeFileAtomic(path.join(paths(root).reports, 'qa-summary.md'), summaryMarkdown(summary, defects));
  appendEvent(root, { type: tot.fail ? 'qa.failed' : 'qa.passed', data: { targets: targets.map((t) => t.id), totals: tot, verdict: summary.verdict }, evidence: ['.cis/reports/qa-summary.json'] });
  if (json(flags, { ok: tot.fail === 0, verdict: summary.verdict, totals: tot, defects: defects.filter((d) => d.status !== 'fixed') })) return tot.fail ? EXIT.FAIL : EXIT.OK;
  for (const t of targets) {
    print(`\n${t.id} (${t.kind})`);
    print(table(t.checks.map((c) => [c.status.toUpperCase(), c.id, c.summary.length > 150 ? c.summary.slice(0, 147) + '...' : c.summary])));
  }
  const open = defects.filter((d) => d.status !== 'fixed');
  print(`\nVerdict: ${summary.verdict.toUpperCase()}: ${tot.pass} pass, ${tot.fail} fail, ${tot.warn} warn, ${tot.blocked} blocked, ${tot.skipped} skipped.`);
  if (open.length) {
    print('\nDefects by priority (fix, then re-run this command; a defect that fails 3 runs escalates to a person):');
    print(table(open.map((d) => [d.status, d.severity, d.key, `${d.attempts}x`, d.summary.slice(0, 110)]), ['status', 'severity', 'where', 'runs', 'summary']));
  }
  const fixed = defects.filter((d) => d.fixedAt === defects[0]?.lastSeen || d.fixedAt === summary.generatedAt);
  if (fixed.length) print(`Fixed since the last run: ${fixed.map((d) => d.key).join(', ')}`);
  print('Reports: .cis/reports/qa-summary.md, qa-summary.json, defects.json; screenshots under .cis/reports/qa/');
  return tot.fail ? EXIT.FAIL : EXIT.OK;
}

// ----------------------------------------------------------------- audit ----

async function audit({ flags }) {
  const root = requireProject(flags.project);
  const sec = await import('../lib/security.mjs');
  const project = loadProject(root);
  const checks = [];
  const secrets = sec.scanSecrets(root);
  checks.push(chk('secrets', 'security', secrets.findings.length ? 'fail' : 'pass', secrets.findings.length ? `${secrets.findings.length} secret-shaped value(s): ${secrets.findings.slice(0, 4).map((f) => `${f.file}:${f.line} (${f.kind})`).join(', ')}` : `No secrets found in ${secrets.scanned} text files`, { severity: 'critical', measurement: 'static', data: { findings: secrets.findings.slice(0, 30) } }));
  checks.push(chk('env-files', 'security', secrets.envFiles.length ? 'warn' : 'pass', secrets.envFiles.length ? `Environment files present (${secrets.envFiles.join(', ')}); they are git-ignored by init, confirm they are not delivered` : 'No .env files in the project tree', { severity: 'major', measurement: 'static' }));
  const dirs = ['web', 'app', 'scene', 'mobile'].filter((d) => exists(path.join(root, d)));
  const unsafe = sec.scanUnsafePatterns(root, dirs);
  checks.push(chk('unsafe-patterns', 'security', unsafe.length ? 'warn' : 'pass', unsafe.length ? `${unsafe.length} pattern(s) to review: ${[...new Set(unsafe.map((u) => u.id))].join(', ')}` : `No string-built markup, dynamic code, unsafe link targets or plain-http URLs in ${dirs.join(', ')} source`, { severity: 'major', measurement: 'static', data: { findings: unsafe.slice(0, 30) } }));
  for (const d of dirs) {
    const dist = path.join(root, d, d === 'mobile' ? 'dist-web' : 'dist');
    const origins = sec.scanExternalOrigins(dist);
    if (exists(dist)) checks.push(chk(`third-party-requests:${d}`, 'security', origins.length ? 'warn' : 'pass', origins.length ? `Built pages reference third-party hosts: ${origins.map((o) => o.host).join(', ')}` : 'Built pages reference no third-party hosts (fonts and scripts are self-hosted)', { severity: 'major', measurement: 'static', data: { origins } }));
  }
  const licenceRows = [];
  for (const d of dirs) {
    const sbom = sec.buildSbom(path.join(root, d), d);
    if (!sbom) continue;
    if (!sbom.installed) {
      checks.push(chk(`sbom:${d}`, 'security', 'blocked', `${d}/node_modules missing; install dependencies to produce an SBOM`, { measurement: 'static' }));
      continue;
    }
    writeJson(path.join(paths(root).reports, `sbom-${d}.cdx.json`), sec.cycloneDx(sbom, project.id));
    const flagged = sbom.components.filter((c) => ['custom', 'copyleft', 'unknown'].includes(c.class));
    for (const c of sbom.components.filter((x) => x.direct || x.class !== 'permissive')) licenceRows.push([d, c.name, c.version, c.license || 'UNKNOWN', c.class, c.direct ? 'direct' : 'transitive']);
    checks.push(chk(`licences:${d}`, 'security', flagged.some((c) => c.class === 'copyleft' || c.class === 'unknown') ? 'fail' : flagged.length ? 'warn' : 'pass', flagged.length ? `${sbom.components.length} packages; needs a human licence decision: ${flagged.map((c) => `${c.name} (${c.license || 'no licence field'})`).slice(0, 6).join(', ')}` : `${sbom.components.length} packages in the production tree, all under permissive licences`, { severity: 'major', measurement: 'static', data: { total: sbom.components.length, byClass: Object.fromEntries(['permissive', 'weak-copyleft', 'custom', 'copyleft', 'unknown'].map((k) => [k, sbom.components.filter((c) => c.class === k).length])), flagged }, evidence: [`.cis/reports/sbom-${d}.cdx.json`] }));
    if (!flags.offline) {
      const a = sec.auditDependencies(path.join(root, d));
      if (a.status === 'blocked') checks.push(chk(`vulnerabilities:${d}`, 'security', 'blocked', `Vulnerability audit did not run: ${a.reason}`, { severity: 'major', measurement: 'static' }));
      else {
        const bad = a.counts.high + a.counts.critical;
        checks.push(chk(`vulnerabilities:${d}`, 'security', bad ? 'fail' : a.counts.moderate ? 'warn' : 'pass', `${a.tool}: ${a.counts.critical} critical, ${a.counts.high} high, ${a.counts.moderate} moderate, ${a.counts.low} low (production dependencies)`, { severity: 'critical', measurement: 'static', data: a }));
      }
    }
  }
  const led = verifyLedger(root);
  checks.push(chk('ledger-integrity', 'security', led.ok ? 'pass' : 'fail', led.ok ? `Audit trail intact: ${led.count} hash-chained events` : `Audit trail broken: ${led.problems[0]}`, { severity: 'critical', measurement: 'static' }));
  const reg = verifyRegistry(root);
  const unknownRights = reg.problems.filter((p) => /rights|simulated/.test(p.problem));
  checks.push(chk('asset-rights', 'delivery', unknownRights.length ? 'fail' : 'pass', unknownRights.length ? `${unknownRights.length} asset(s) cannot be delivered: ${unknownRights.slice(0, 4).map((p) => `${p.asset} (${p.problem})`).join(', ')}` : `All ${reg.count} registered assets have recorded origin and rights`, { severity: 'critical', measurement: 'static' }));
  checks.push(chk('upload-policy', 'security', 'pass', `External uploads policy: "${project.policy.externalUploads}"; budget $${project.policy.budgetUsd}. Remote providers are refused or need consent accordingly.`, { measurement: 'static' }));

  const tot = { pass: 0, fail: 0, warn: 0, skipped: 0, blocked: 0 };
  for (const c of checks) tot[c.status]++;
  const report = { schemaVersion: '1.0.0', generatedAt: nowIso(), checks, totals: tot, verdict: tot.fail ? 'fail' : tot.blocked ? 'incomplete' : 'pass' };
  writeJson(path.join(paths(root).reports, 'security.json'), report);
  if (licenceRows.length) {
    writeFileAtomic(path.join(paths(root).reports, 'licences.md'), `# Third-party software\n\nGenerated ${report.generatedAt}. Direct production dependencies and every package that is not under a permissive licence. Full trees are in the CycloneDX files beside this report.\n\n| Deliverable | Package | Version | Licence | Class | Relation |\n|---|---|---|---|---|---|\n${licenceRows.map((r) => `| ${r.join(' | ')} |`).join('\n')}\n\n"custom" and "weak-copyleft" licences are permitted only after a person has read their terms for this client's use.\n`);
  }
  // Fold the audit into the QA summary so one file answers "is it deliverable?".
  const summaryFile = path.join(paths(root).reports, 'qa-summary.json');
  if (exists(summaryFile)) {
    const s = readJson(summaryFile);
    s.targets = [...s.targets.filter((t) => t.id !== 'security'), { id: 'security', kind: 'project', checks }].sort((a, b) => a.id.localeCompare(b.id));
    const { totals } = await import('../lib/qa.mjs');
    s.totals = totals(s.targets);
    s.verdict = s.totals.fail ? 'fail' : s.totals.blocked ? 'incomplete' : 'pass';
    writeJson(summaryFile, s);
  }
  appendEvent(root, { type: 'audit.completed', data: { totals: tot, verdict: report.verdict }, evidence: ['.cis/reports/security.json'] });
  if (json(flags, report)) return tot.fail ? EXIT.FAIL : EXIT.OK;
  print(table(checks.map((c) => [c.status.toUpperCase(), c.id, c.summary.length > 160 ? c.summary.slice(0, 157) + '...' : c.summary])));
  print(`\nAudit verdict: ${report.verdict.toUpperCase()}: ${tot.pass} pass, ${tot.fail} fail, ${tot.warn} warn, ${tot.blocked} blocked. Reports: .cis/reports/security.json, licences.md, sbom-*.cdx.json`);
  return tot.fail ? EXIT.FAIL : EXIT.OK;
}

// ---------------------------------------------------------------- review ----

async function review({ _, flags }) {
  const root = requireProject(flags.project);
  const sub = _[0] || 'check';
  const file = path.join(paths(root).reports, 'creative-review.json');
  if (sub === 'template') {
    const crit = Object.fromEntries(['designCoherence', 'brandAlignment', 'visualHierarchy', 'typography', 'originality', 'motionQuality', 'interactionClarity', 'assetQuality', 'presentationPolish', 'professionalReadiness'].map((k) => [k, { score: 3, reason: 'Replace with a specific observation that cites evidence.' }]));
    print(JSON.stringify({ schemaVersion: '1.0.0', reviewer: 'name of the independent reviewer', independent: true, evaluationOnly: true, reviewedAt: nowIso(), subject: ['web', 'app'], evidenceViewed: ['.cis/reports/qa/web/home-desktop.png'], criteria: crit, findings: [], recommendation: 'revise' }, null, 2));
    return;
  }
  if (!exists(file)) throw new CisError('E_READ', 'No creative review at .cis/reports/creative-review.json. Have the creative-reviewer agent (or a person) write one; `creative-studio review template` prints the shape.');
  const data = readJson(file);
  const res = validate('creative-review', data);
  const problems = res.errors.map((e) => `${e.path} ${e.message}`);
  if (res.valid) {
    if (!data.independent) problems.push('independent is false: the reviewer authored the work, so this is self-assessment, not a review.');
    if (!(data.evidenceViewed || []).length) problems.push('evidenceViewed is empty: a review must name the screenshots or builds it looked at.');
    for (const e of data.evidenceViewed || []) if (!exists(path.join(root, e))) problems.push(`evidence "${e}" does not exist`);
    const flat = Object.values(data.criteria).map((c) => c.score);
    if (new Set(flat).size === 1) problems.push('every criterion has the same score: that is not a discriminating evaluation.');
    const blockers = data.findings.filter((f) => f.severity === 'blocker').length;
    if (blockers && data.recommendation === 'ready-for-client') problems.push(`${blockers} blocker finding(s) contradict the "ready-for-client" recommendation.`);
  }
  const ok = problems.length === 0;
  if (ok) appendEvent(root, { type: 'review.recorded', actor: data.reviewer, data: { recommendation: data.recommendation, findings: data.findings.length } });
  if (json(flags, { ok, problems, recommendation: data.recommendation })) return ok ? EXIT.OK : EXIT.FAIL;
  if (!ok) {
    print(`Creative review is not acceptable as evidence:\n  - ${problems.join('\n  - ')}`);
    return EXIT.FAIL;
  }
  print(`Creative review by ${data.reviewer}: recommendation "${data.recommendation}". This is an evaluation with reasons; it is not client approval.`);
  print(table(Object.entries(data.criteria).map(([k, v]) => [k, `${v.score}/5`, v.reason.slice(0, 110)]), ['criterion', 'score', 'reason']));
  if (data.findings.length) print('\n' + table(data.findings.map((f) => [f.severity, f.where, f.issue.slice(0, 100)]), ['severity', 'where', 'issue']));
}

// ------------------------------------------------------------------- d2c ----

async function d2c({ _, flags }) {
  const sub = _[0];
  if (!hasCapability('raster')) throw new CisError('E_MISSING_DEP', 'Design-to-code analysis needs the raster engine: creative-studio setup --only raster', { exit: EXIT.MISSING_DEP });
  const raster = await import('../lib/raster.mjs');
  if (sub === 'analyze') {
    const file = path.resolve(_[1] || '');
    if (!exists(file)) throw new CisError('E_USAGE', 'Usage: creative-studio d2c analyze <reference.png> [--json]', { exit: EXIT.USAGE });
    const meta = await raster.metadata(file);
    const palette = await raster.dominantColors(file, 8);
    const bands = await raster.layoutBands(file);
    const out = { file, width: meta.width, height: meta.height, palette, bands, notes: ['Bands are horizontal regions separated by a strong change in tone; treat them as candidate sections, then name components by reading the image.', 'Palette shares are approximate. Map each colour to a design token before writing CSS; do not paste raw hex values.', 'Fonts cannot be identified reliably from pixels: choose from the Experience DNA and note the substitution.'] };
    if (json(flags, out)) return;
    print(`${path.basename(file)}: ${meta.width}x${meta.height}`);
    print(table(palette.map((p) => [p.hex, `${Math.round(p.share * 100)}%`]), ['colour', 'share']));
    print('\n' + table(bands.map((b, i) => [i + 1, b.top, b.height, b.meanLuma]), ['band', 'top px', 'height px', 'mean luma']));
    return;
  }
  if (sub === 'compare') {
    const ref = path.resolve(_[1] || '');
    if (!exists(ref) || (!_[2] && !flags.url)) throw new CisError('E_USAGE', 'Usage: creative-studio d2c compare <reference.png> <candidate.png> | --url <url> [--selector css] [--out dir] [--threshold 0.03]', { exit: EXIT.USAGE });
    const outDir = path.resolve(flags.out || '.cis-d2c');
    fs.mkdirSync(outDir, { recursive: true });
    const meta = await raster.metadata(ref);
    let candidate = _[2] ? path.resolve(_[2]) : null;
    if (flags.url) {
      // Render the implementation at the reference's exact size, so the comparison is like for like.
      const { launch } = await import('../lib/browser.mjs');
      const browser = await launch();
      try {
        const page = await browser.newPage({ viewport: { width: meta.width, height: meta.height }, deviceScaleFactor: 1 });
        await page.goto(String(flags.url), { waitUntil: 'networkidle' });
        await page.evaluate(() => document.fonts.ready);
        candidate = path.join(outDir, 'candidate.png');
        if (flags.selector) await page.locator(String(flags.selector)).first().screenshot({ path: candidate, animations: 'disabled' });
        else await page.screenshot({ path: candidate, animations: 'disabled' });
      } finally {
        await browser.close();
      }
    }
    const threshold = Number(flags.threshold || 0.03);
    const res = await raster.diff(ref, candidate, { heatmap: path.join(outDir, 'diff.png'), grid: 8, threshold: 0.12 });
    const refPalette = await raster.dominantColors(ref, 5);
    const candPalette = await raster.dominantColors(candidate, 5);
    const pass = !res.sizeMismatch && res.changedRatio <= threshold;
    const report = { reference: ref, candidate, size: { reference: `${res.width}x${res.height}`, candidate: `${res.other.width}x${res.other.height}`, mismatch: res.sizeMismatch }, changedRatio: Number(res.changedRatio.toFixed(5)), threshold, pass, worstRegions: res.regions.slice(0, 8).map((r) => ({ row: r.row + 1, col: r.col + 1, changed: Number(r.changed.toFixed(3)), area: `${['top', 'upper', 'upper-middle', 'middle', 'middle', 'lower-middle', 'lower', 'bottom'][r.row]} / ${['far left', 'left', 'centre-left', 'centre', 'centre', 'centre-right', 'right', 'far right'][r.col]}` })), palette: { reference: refPalette, candidate: candPalette }, heatmap: path.join(outDir, 'diff.png'), caveats: ['Differences in font rasterisation and sub-pixel positioning are expected; investigate regions, not the global number alone.', 'One viewport proves one viewport. Repeat at each breakpoint the design specifies.'] };
    writeJson(path.join(outDir, 'd2c-report.json'), report);
    if (json(flags, report)) return pass ? EXIT.OK : EXIT.FAIL;
    print(`${pass ? 'MATCH' : 'DIFFERS'}: ${(res.changedRatio * 100).toFixed(2)}% of pixels differ (threshold ${(threshold * 100).toFixed(1)}%)${res.sizeMismatch ? `; size mismatch ${report.size.reference} vs ${report.size.candidate}` : ''}`);
    if (report.worstRegions.length) print(table(report.worstRegions.map((r) => [`r${r.row} c${r.col}`, r.area, `${Math.round(r.changed * 100)}%`]), ['cell (8x8)', 'area', 'changed']));
    print(`Heatmap: ${report.heatmap}`);
    return pass ? EXIT.OK : EXIT.FAIL;
  }
  throw new CisError('E_USAGE', 'Usage: creative-studio d2c <analyze|compare> ...', { exit: EXIT.USAGE });
}

export const commands = [
  { name: 'test', group: 'Quality', summary: 'Run functional, visual, accessibility, motion and performance checks', run: test, usage: `
creative-studio test [project] [web] [app] [scene] [mobile] [--update-baselines] [--quick] [--max-attempts 3] [--json]

Serves each built deliverable on loopback and checks, at phone, tablet and
desktop sizes: runtime errors, failed requests, broken images, overflow and
clipped text, WCAG 2.2 A/AA rules (axe-core, both colour schemes), keyboard
order and focus visibility, target size, reduced-motion behaviour, lab web
vitals under 4x CPU throttling, scroll frame timing, visual regression against
accepted baselines, and the deliverable's own scripted flows (qa/flows.mjs).
Mobile adds type check, Jest, and iOS/Android production bundles.
Writes .cis/reports/qa-summary.{json,md}, defects.json and screenshots.
A check that cannot run is reported as blocked, never as passed.` },
  { name: 'audit', group: 'Quality', summary: 'Security, privacy, licence and provenance audit with SBOM', run: audit, usage: `
creative-studio audit [--offline] [--json]

Secrets scan, unsafe source patterns, third-party requests in built pages,
CycloneDX SBOM and licence classification per deliverable, known-vulnerability
audit (needs registry access; --offline skips it), ledger and asset-rights checks.` },
  { name: 'review', group: 'Quality', summary: 'Validate an independent creative review against the rubric', run: review, usage: `
creative-studio review check [--json]
creative-studio review template

A review must be independent, cite the evidence it looked at, discriminate
between criteria and be consistent with its own findings. It is an evaluation,
never client approval.` },
  { name: 'd2c', group: 'Quality', summary: 'Analyse a design reference and diff an implementation against it', run: d2c, usage: `
creative-studio d2c analyze <reference.png> [--json]
creative-studio d2c compare <reference.png> <candidate.png> [--out dir] [--threshold 0.03]
creative-studio d2c compare <reference.png> --url <url> [--selector css] [--out dir]

compare renders the implementation at the reference's exact pixel size, reports
the share of differing pixels, names the worst regions on an 8x8 grid and
writes a heatmap, so corrections can be targeted instead of guessed.` },
];
