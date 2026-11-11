// Project lifecycle commands: init, doctor, setup, plan, status, task, approve,
// ledger, route, brief, research, checkpoint, validate.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { CisError, EXIT, CIS_VERSION, PLUGIN_ROOT, readJson, writeJson, exists, print, table, nowIso, findSecrets } from '../lib/util.mjs';
import { validate, assertValid, schemaNames } from '../lib/schema.mjs';
import { initProject, requireProject, loadProject, loadBrief, loadState, saveState, appendEvent, verifyLedger, ledger, recordApproval, paths, createCheckpoint, listCheckpoints, restoreCheckpoint } from '../lib/project.mjs';
import { buildPlan, classify, runnable, blockers, startTask, completeTask, failTask, resetTask, recover, route, checkContract } from '../lib/orchestrator.mjs';
import { CAPABILITIES, hasCapability, depVersion, findChrome, runtimeDir, RUNTIME_MANIFEST } from '../lib/deps.mjs';

const json = (flags, value) => (flags.json ? (print(JSON.stringify(value, null, 2)), true) : false);

function which(bin) {
  const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', [bin], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim().split('\n')[0] : null;
}

// ------------------------------------------------------------------ init -----

async function init({ _, flags }) {
  const dir = path.resolve(flags.project || _[0] || '.');
  if (!flags.brief) throw new CisError('E_USAGE', 'init needs --brief <brief.json>. See `creative-studio help init`.', { exit: EXIT.USAGE });
  const brief = readJson(path.resolve(flags.brief));
  fs.mkdirSync(dir, { recursive: true });
  const project = initProject(dir, brief);
  const cls = classify(brief);
  if (json(flags, { ok: true, project, classification: cls })) return;
  print(`Created project "${project.name}" (${project.id}) in ${dir}`);
  print(`Scope: ${cls.scope}: ${cls.disciplines.join(', ')}`);
  if (cls.flags.length) print(`Flags: ${cls.flags.join(', ')}`);
  for (const s of cls.suggestions) print(`Note: ${s}`);
  print('Next: creative-studio plan');
}

// ---------------------------------------------------------------- doctor -----

async function doctor({ flags }) {
  const checks = [];
  const add = (id, status, detail, fix) => checks.push({ id, status, detail, ...(fix ? { fix } : {}) });
  const major = Number(process.versions.node.split('.')[0]);
  add('node', major >= 22 ? 'ok' : 'fail', `Node ${process.versions.node}`, major >= 22 ? undefined : 'Install Node 22 or newer.');
  add('platform', 'ok', `${process.platform} ${os.release()} ${process.arch}`);
  for (const [cap, def] of Object.entries(CAPABILITIES)) {
    const ok = hasCapability(cap);
    const versions = def.packages.map((p) => `${p}@${depVersion(p) || 'missing'}`).join(', ');
    add(`engine:${cap}`, ok ? 'ok' : 'missing', ok ? versions : `${def.enables}. Missing: ${def.packages.filter((p) => !depVersion(p)).join(', ')}`, ok ? undefined : `creative-studio setup --only ${cap}`);
  }
  const chrome = findChrome();
  add('browser', chrome ? 'ok' : 'missing', chrome || 'No Chrome, Chromium or Edge found', chrome ? undefined : 'Install Chrome or set CIS_CHROME to a Chromium binary.');
  for (const bin of ['git', 'npm', 'pnpm', 'ffmpeg', 'claude']) {
    const p = which(bin);
    add(`tool:${bin}`, p ? 'ok' : ['git', 'npm'].includes(bin) ? 'missing' : 'optional', p || 'not found');
  }
  const xcode = spawnSync('xcrun', ['--find', 'simctl'], { encoding: 'utf8' }).status === 0;
  add('mobile:ios-toolchain', xcode ? 'ok' : 'unavailable', xcode ? 'Xcode simulator tools found' : 'Full Xcode not installed: native iOS builds and simulator tests cannot run here.');
  const adb = which('adb') || (process.env.ANDROID_HOME && exists(path.join(process.env.ANDROID_HOME, 'platform-tools')));
  add('mobile:android-toolchain', adb ? 'ok' : 'unavailable', adb ? 'Android SDK found' : 'Android SDK not installed: native Android builds and emulator tests cannot run here.');
  // Presence only. A key's value is never read into output or logs.
  for (const [env, provider] of [['OPENAI_API_KEY', 'openai'], ['GEMINI_API_KEY', 'google']]) {
    add(`provider:${provider}`, process.env[env] ? 'configured' : 'not-configured', process.env[env] ? `${env} is set (value not shown)` : `${env} not set; the local procedural engine still works`);
  }
  add('provider:local-procedural', 'ok', 'Built-in generator, no network, no cost');
  try {
    const st = fs.statfsSync(process.cwd());
    const freeGb = (st.bavail * st.bsize) / 1024 ** 3;
    add('disk', freeGb > 1.5 ? 'ok' : 'warn', `${freeGb.toFixed(1)} GB free`, freeGb > 1.5 ? undefined : 'Dependency installs for the web and mobile templates need about 1.5 GB.');
  } catch {
    add('disk', 'optional', 'could not be measured on this platform');
  }
  add('runtime-dir', 'ok', runtimeDir());
  const fails = checks.filter((c) => c.status === 'fail').length;
  if (json(flags, { ok: fails === 0, version: CIS_VERSION, checks })) return fails ? EXIT.FAIL : EXIT.OK;
  print(`creative-studio ${CIS_VERSION} doctor\n`);
  print(table(checks.map((c) => [c.status, c.id, c.detail]), ['status', 'check', 'detail']));
  const fixes = checks.filter((c) => c.fix);
  if (fixes.length) {
    print('\nTo enable what is missing:');
    for (const c of fixes) print(`  ${c.id}: ${c.fix}`);
  }
  return fails ? EXIT.FAIL : EXIT.OK;
}

async function setup({ flags }) {
  const manifest = readJson(RUNTIME_MANIFEST);
  let deps = manifest.dependencies;
  if (flags.only) {
    const caps = String(flags.only).split(',');
    const unknown = caps.filter((c) => !CAPABILITIES[c]);
    if (unknown.length) throw new CisError('E_USAGE', `Unknown capability: ${unknown.join(', ')}. Known: ${Object.keys(CAPABILITIES).join(', ')}`, { exit: EXIT.USAGE });
    const wanted = new Set(caps.flatMap((c) => CAPABILITIES[c].packages));
    deps = Object.fromEntries(Object.entries(deps).filter(([k]) => wanted.has(k)));
  }
  const dir = runtimeDir();
  const list = Object.entries(deps).map(([k, v]) => `${k}@${v}`);
  if (flags['dry-run']) {
    print(`Would install into ${dir}:\n  ${list.join('\n  ')}`);
    return;
  }
  fs.mkdirSync(dir, { recursive: true });
  const pj = path.join(dir, 'package.json');
  const current = exists(pj) ? readJson(pj) : { name: 'creative-studio-runtime', private: true, dependencies: {} };
  current.dependencies = { ...current.dependencies, ...deps };
  writeJson(pj, current);
  print(`Installing ${list.length} pinned packages into ${dir} (network access to the npm registry) ...`);
  const r = spawnSync('npm', ['install', '--no-audit', '--no-fund', '--omit=dev'], { cwd: dir, stdio: 'inherit' });
  if (r.status !== 0) throw new CisError('E_SETUP', 'npm install failed; see the output above. Nothing else was changed.');
  print('Done. Run `creative-studio doctor` to confirm.');
}

// ------------------------------------------------------------------ plan -----

async function plan({ flags }) {
  const root = requireProject(flags.project);
  const brief = loadBrief(root);
  const existing = loadState(root);
  if (existing && !flags.replan) {
    if (json(flags, existing)) return;
    print('A plan already exists (use --replan to rebuild it and keep completed work). Showing status instead.\n');
    return status({ flags });
  }
  const next = buildPlan(brief);
  if (existing) {
    // Re-planning keeps finished work and decisions; only the graph is refreshed.
    for (const t of next.tasks) {
      const old = existing.tasks.find((x) => x.id === t.id);
      if (old) Object.assign(t, { status: old.status, attempts: old.attempts, startedAt: old.startedAt, finishedAt: old.finishedAt, evidence: old.evidence, lastFailure: old.lastFailure });
      for (const k of Object.keys(t)) if (t[k] === undefined) delete t[k];
    }
    for (const g of next.gates) {
      const old = existing.gates.find((x) => x.id === g.id);
      if (old) Object.assign(g, { status: old.status, ...(old.decision ? { decision: old.decision } : {}) });
    }
  }
  saveState(root, next);
  appendEvent(root, { type: existing ? 'plan.rebuilt' : 'plan.created', data: { tasks: next.tasks.length, gates: next.gates.length, scope: next.classification.scope } });
  if (json(flags, next)) return;
  print(`Plan for "${brief.name}": ${next.tasks.length} tasks, ${next.gates.length} approval gates (${next.classification.scope})\n`);
  print(table(next.tasks.map((t) => [t.id, t.phase, t.skill, t.dependsOn.join(', ') || '-', t.gate || '-']), ['task', 'phase', 'skill', 'depends on', 'needs gate']));
  for (const s of next.classification.suggestions) print(`\nNote: ${s}`);
  print('\nNext: creative-studio status');
}

async function status({ flags }) {
  const root = requireProject(flags.project);
  const project = loadProject(root);
  const state = loadState(root);
  const led = verifyLedger(root);
  if (!state) {
    if (json(flags, { project, plan: null, ledger: led })) return;
    print(`Project "${project.name}" has no plan yet. Run \`creative-studio plan\`.`);
    return;
  }
  const ready = runnable(state).map((t) => t.id);
  const payload = { project, classification: state.classification, tasks: state.tasks, gates: state.gates, ready, ledger: led };
  if (json(flags, payload)) return;
  print(`${project.name} (${project.id}): ${state.classification.scope}`);
  const done = state.tasks.filter((t) => t.status === 'done').length;
  print(`Progress: ${done}/${state.tasks.length} tasks done. Ledger: ${led.count} events, ${led.ok ? 'chain intact' : 'CHAIN BROKEN'}\n`);
  print(table(state.tasks.map((t) => [t.status, t.id, t.skill, t.attempts, t.status === 'done' ? '' : blockers(state, t).join('; ') || (t.lastFailure ? `last failure: ${t.lastFailure}` : 'ready')]), ['status', 'task', 'skill', 'tries', 'waiting on']));
  print('');
  print(table(state.gates.map((g) => [g.status, g.id, g.title, g.decision ? `${g.decision.actor} (${g.decision.role})${g.decision.simulated ? ' [SIMULATED]' : ''}` : '']), ['status', 'gate', 'title', 'decided by']));
  if (ready.length) {
    print(`\nReady now: ${ready.join(', ')}`);
    const t = state.tasks.find((x) => x.id === ready[0]);
    print(`Next: creative-studio task start ${t.id}   (skill: ${t.skill}${t.command ? `; then ${t.command}` : ''})`);
  } else {
    const pendingGate = state.gates.find((g) => g.status !== 'approved' && g.requires.every((r) => state.tasks.find((t) => t.id === r)?.status === 'done'));
    if (pendingGate) print(`\nWaiting for a human decision on ${pendingGate.id}: ${pendingGate.title}\n  creative-studio approve ${pendingGate.id} --actor "<name>" --role client`);
  }
}

async function task({ _, flags }) {
  const root = requireProject(flags.project);
  const [sub, id] = _;
  if (sub === 'recover') {
    const report = recover(root);
    if (json(flags, { ok: true, changes: report })) return;
    print(report.length ? table(report.map((r) => [r.task, r.action, r.detail]), ['task', 'action', 'detail']) : 'State already matches the files on disk.');
    return;
  }
  if (!sub || !id) throw new CisError('E_USAGE', 'Usage: creative-studio task <start|done|fail|reset|check> <task-id> | task recover', { exit: EXIT.USAGE });
  let res;
  if (sub === 'start') res = startTask(root, id);
  else if (sub === 'done') res = completeTask(root, id, { evidence: flags.evidence ? String(flags.evidence).split(',') : [] });
  else if (sub === 'fail') res = failTask(root, id, flags.reason);
  else if (sub === 'reset') res = resetTask(root, id, flags.actor);
  else if (sub === 'check') {
    const state = loadState(root);
    const t = state?.tasks.find((x) => x.id === id);
    if (!t) throw new CisError('E_TASK_UNKNOWN', `Unknown task "${id}"`, { exit: EXIT.USAGE });
    const problems = checkContract(root, t);
    if (json(flags, { ok: problems.length === 0, task: id, problems })) return problems.length ? EXIT.BLOCKED : EXIT.OK;
    print(problems.length ? `Contract unmet:\n  - ${problems.join('\n  - ')}` : `Contract satisfied for "${id}".`);
    return problems.length ? EXIT.BLOCKED : EXIT.OK;
  } else throw new CisError('E_USAGE', `Unknown task subcommand "${sub}"`, { exit: EXIT.USAGE });
  if (json(flags, { ok: true, ...res })) return;
  const t = res.task;
  print(`Task "${t.id}" is ${t.status}${res.changed === false ? ' (no change)' : ''}${t.status === 'escalated' ? `: retry limit reached after ${t.attempts} attempts; a person must decide what happens next` : ''}.`);
}

async function approve({ _, flags }) {
  const root = requireProject(flags.project);
  const gate = _[0];
  if (!gate) throw new CisError('E_USAGE', 'Usage: creative-studio approve <gate-id> --actor "<human name>" [--role client] [--decision approved|rejected|changes-requested] [--note "..."]', { exit: EXIT.USAGE });
  const g = recordApproval(root, {
    gate,
    decision: flags.decision || 'approved',
    actor: flags.actor,
    role: flags.role,
    note: flags.note,
    evidence: flags.evidence ? String(flags.evidence).split(',') : [],
    simulated: Boolean(flags.simulated),
  });
  if (json(flags, { ok: true, gate: g })) return;
  print(`Gate ${g.id} is ${g.status} by ${g.decision.actor} (${g.decision.role})${g.decision.simulated ? ' [SIMULATED: demo fixture, not a real client decision]' : ''}.`);
}

async function ledgerCmd({ _, flags }) {
  const root = requireProject(flags.project);
  if (_[0] === 'verify') {
    const v = verifyLedger(root);
    if (json(flags, v)) return v.ok ? EXIT.OK : EXIT.FAIL;
    print(v.ok ? `Ledger intact: ${v.count} events, hash chain verified.` : `Ledger TAMPERED or corrupt:\n  ${v.problems.join('\n  ')}`);
    return v.ok ? EXIT.OK : EXIT.FAIL;
  }
  const events = ledger(root).slice(-Number(flags.last || 30));
  if (json(flags, events)) return;
  print(table(events.map((e) => [e.seq, e.at.slice(0, 19), e.type, e.actor, JSON.stringify(e.data).slice(0, 90)]), ['#', 'time', 'event', 'actor', 'data']));
}

async function routeCmd({ _, flags }) {
  const request = _.join(' ');
  if (!request) throw new CisError('E_USAGE', 'Usage: creative-studio route "<request in plain words>"', { exit: EXIT.USAGE });
  const res = route(request);
  if (json(flags, res)) return;
  print(res.length ? table(res.map((r) => [r.skill, r.score]), ['skill', 'score']) : 'No specialist matched; start with the creative-studio orchestrator skill.');
}

async function brief({ _, flags }) {
  const sub = _[0] || 'check';
  if (sub === 'template') {
    print(fs.readFileSync(path.join(PLUGIN_ROOT, 'templates', 'brief.example.json'), 'utf8'));
    return;
  }
  const file = flags.file ? path.resolve(flags.file) : paths(requireProject(flags.project)).brief;
  const data = readJson(file);
  const res = validate('brief', data);
  const cls = res.valid ? classify(data) : null;
  const warnings = [];
  if (res.valid) {
    if (!data.approver) warnings.push('No approver named: gates cannot be approved until someone is accountable.');
    if (!(data.sourceOfTruth || []).length) warnings.push('No sourceOfTruth entries: facts and assumptions are not distinguished.');
    const assumed = (data.sourceOfTruth || []).filter((s) => s.source === 'assumption').map((s) => s.field);
    if (assumed.length) warnings.push(`Assumptions to confirm with the client: ${assumed.join(', ')}`);
    if ((data.openQuestions || []).length) warnings.push(`${data.openQuestions.length} open question(s) recorded.`);
    const secrets = findSecrets(JSON.stringify(data));
    if (secrets.length) warnings.push(`Brief contains ${secrets.length} secret-shaped value(s); remove them.`);
  }
  if (json(flags, { ok: res.valid, errors: res.errors, warnings, classification: cls })) return res.valid ? EXIT.OK : EXIT.FAIL;
  if (!res.valid) {
    print(`Brief is invalid:\n${res.errors.map((e) => `  ${e.path || '/'} ${e.message}`).join('\n')}`);
    return EXIT.FAIL;
  }
  print(`Brief is valid. Scope: ${cls.scope}: ${cls.disciplines.join(', ')}`);
  for (const w of [...warnings, ...cls.suggestions]) print(`  note: ${w}`);
}

async function research({ _, flags }) {
  const root = requireProject(flags.project);
  const file = paths(root).research;
  const log = exists(file) ? readJson(file) : { schemaVersion: '1.0.0', entries: [] };
  const sub = _[0] || 'list';
  if (sub === 'add') {
    const entry = {
      id: `r-${String(log.entries.length + 1).padStart(3, '0')}`,
      topic: flags.topic,
      kind: flags.kind || 'fact',
      finding: flags.finding,
      ...(flags.source ? { source: flags.source } : {}),
      ...(flags.basis ? { basis: flags.basis } : {}),
      ...(flags.implication ? { implication: flags.implication } : {}),
      recordedOn: nowIso().slice(0, 10),
    };
    log.entries.push(entry);
    assertValid('research-log', log, 'Research entry');
    writeJson(file, log);
    appendEvent(root, { type: 'research.added', data: { id: entry.id, topic: entry.topic, kind: entry.kind } });
    if (json(flags, { ok: true, entry })) return;
    print(`Recorded ${entry.id} (${entry.kind}, ${entry.topic}).`);
    return;
  }
  if (sub === 'check') {
    const res = validate('research-log', log);
    const facts = log.entries.filter((e) => e.kind === 'fact').length;
    const stale = log.entries.filter((e) => Date.now() - Date.parse(e.recordedOn) > 180 * 864e5).map((e) => e.id);
    if (json(flags, { ok: res.valid, errors: res.errors, entries: log.entries.length, facts, stale })) return res.valid ? EXIT.OK : EXIT.FAIL;
    print(res.valid ? `Research log valid: ${log.entries.length} entries, ${facts} sourced facts${stale.length ? `, ${stale.length} older than 180 days (${stale.join(', ')})` : ''}.` : res.errors.map((e) => `${e.path} ${e.message}`).join('\n'));
    return res.valid ? EXIT.OK : EXIT.FAIL;
  }
  if (json(flags, log)) return;
  print(log.entries.length ? table(log.entries.map((e) => [e.id, e.topic, e.kind, e.finding.slice(0, 70), e.source || e.basis || '']), ['id', 'topic', 'kind', 'finding', 'source / basis']) : 'No research recorded yet. Use `creative-studio research add`.');
}

async function checkpoint({ _, flags }) {
  const root = requireProject(flags.project);
  const sub = _[0] || 'list';
  if (sub === 'create') {
    if (!_[1]) throw new CisError('E_USAGE', 'Usage: creative-studio checkpoint create <dir> [--label name]', { exit: EXIT.USAGE });
    const res = createCheckpoint(root, _[1], String(flags.label || 'manual'));
    if (json(flags, { ok: true, ...res })) return;
    print(`Checkpoint ${res.id} (${res.files} files).`);
  } else if (sub === 'restore') {
    if (!_[1]) throw new CisError('E_USAGE', 'Usage: creative-studio checkpoint restore <id>', { exit: EXIT.USAGE });
    const res = restoreCheckpoint(root, _[1]);
    if (json(flags, { ok: true, ...res })) return;
    print(`Restored ${res.restored} files, removed ${res.removed} files added since the checkpoint.`);
  } else {
    const list = listCheckpoints(root);
    if (json(flags, list)) return;
    print(list.length ? table(list.map((c) => [c.id, c.relDir, c.files, c.label]), ['id', 'dir', 'files', 'label']) : 'No checkpoints.');
  }
}

async function validateCmd({ _, flags }) {
  const [schema, file] = _;
  if (!schema || !file) throw new CisError('E_USAGE', `Usage: creative-studio validate <schema> <file.json>\nSchemas: ${schemaNames().join(', ')}`, { exit: EXIT.USAGE });
  const res = validate(schema, readJson(path.resolve(file)));
  if (json(flags, { ok: res.valid, errors: res.errors })) return res.valid ? EXIT.OK : EXIT.FAIL;
  print(res.valid ? `${file} satisfies ${schema}.` : `${file} violates ${schema}:\n${res.errors.map((e) => `  ${e.path || '/'} ${e.message}`).join('\n')}`);
  return res.valid ? EXIT.OK : EXIT.FAIL;
}

export const commands = [
  { name: 'init', group: 'Project', summary: 'Create a project from a validated client brief', run: init, usage: `
creative-studio init [dir] --brief <brief.json> [--json]

Validates the brief against the brief contract, creates .cis/ (project, brief,
asset registry, cost ledger, event ledger) and adds secret and cache paths to
.gitignore. Refuses to overwrite an existing project.
Get a starting brief with: creative-studio brief template` },
  { name: 'doctor', group: 'Project', summary: 'Report engines, tools, credentials and platform limits', run: doctor, usage: `
creative-studio doctor [--json]

Checks Node, optional engines (raster, browser, vector, model3d), a Chromium
browser, git/npm/ffmpeg, native mobile toolchains and which image providers
have credentials. Credential values are never printed.` },
  { name: 'setup', group: 'Project', summary: 'Install the pinned optional engines', run: setup, usage: `
creative-studio setup [--only raster,browser,vector,model3d] [--dry-run]

Installs exact versions from runtime/package.json into the plugin data
directory (or ~/.creative-studio/runtime). This is the only command that
downloads code, and it does so only when you run it.` },
  { name: 'brief', group: 'Project', summary: 'Validate a brief or print a template', run: brief, usage: `
creative-studio brief check [--file brief.json] [--json]
creative-studio brief template` },
  { name: 'plan', group: 'Orchestration', summary: 'Build the task graph, handoff contracts and approval gates', run: plan, usage: `
creative-studio plan [--replan] [--json]

Classifies the brief and writes .cis/state.json. --replan refreshes the graph
after the brief changes and keeps completed tasks and recorded approvals.` },
  { name: 'status', group: 'Orchestration', summary: 'Show progress, blockers, gates and the next action', run: status, usage: `
creative-studio status [--json]` },
  { name: 'task', group: 'Orchestration', summary: 'Start, complete, fail, reset or recover tasks', run: task, usage: `
creative-studio task start <id>
creative-studio task done <id> [--evidence path,path]
creative-studio task fail <id> --reason "..."
creative-studio task reset <id> --actor "<human name>"
creative-studio task check <id>
creative-studio task recover

"done" succeeds only when the task's declared outputs exist and validate.
A task that fails three times escalates and waits for a person.
"recover" reconciles state with the files on disk after an interruption.` },
  { name: 'approve', group: 'Orchestration', summary: 'Record a human decision on an approval gate', run: approve, usage: `
creative-studio approve <gate-id> --actor "<human name>" [--role client|creative-director]
                        [--decision approved|rejected|changes-requested] [--note "..."] [--simulated]

Automated actors (agent, claude, ai, bot, qa ...) are refused. --simulated marks
a demo or benchmark decision and is shown wherever the gate is reported.` },
  { name: 'route', group: 'Orchestration', summary: 'Show which skills a plain-language request maps to', run: routeCmd, usage: `
creative-studio route "<request>" [--json]` },
  { name: 'research', group: 'Project', summary: 'Record and check sourced research findings', run: research, usage: `
creative-studio research add --topic <audience|competitor|convention|technology|accessibility|legal|content>
                             --kind <fact|inference|client-statement> --finding "..." [--source <url>] [--basis "..."] [--implication "..."]
creative-studio research list | check [--json]

A fact must carry a source URL; an inference must state its basis.` },
  { name: 'ledger', group: 'Orchestration', summary: 'Show or verify the tamper-evident event ledger', run: ledgerCmd, usage: `
creative-studio ledger [--last 30] [--json]
creative-studio ledger verify` },
  { name: 'checkpoint', group: 'Orchestration', summary: 'Snapshot or roll back a deliverable directory', run: checkpoint, usage: `
creative-studio checkpoint create <dir> [--label before-repair]
creative-studio checkpoint list
creative-studio checkpoint restore <id>` },
  { name: 'validate', group: 'Project', summary: 'Validate any JSON file against a contract', run: validateCmd, usage: `
creative-studio validate <schema> <file.json> [--json]` },
];
