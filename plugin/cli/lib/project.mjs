// Project state: layout on disk, the hash-chained ledger, approvals, checkpoints.
import fs from 'node:fs';
import path from 'node:path';
import { CisError, EXIT, readJson, writeJson, exists, sha256, nowIso, redact, CIS_VERSION, walk } from './util.mjs';
import { assertValid } from './schema.mjs';

export function paths(root) {
  const cis = path.join(root, '.cis');
  return {
    root,
    cis,
    project: path.join(cis, 'project.json'),
    brief: path.join(cis, 'brief.json'),
    dna: path.join(cis, 'dna', 'experience-dna.json'),
    dnaVersions: path.join(cis, 'dna', 'versions'),
    directions: path.join(cis, 'directions'),
    state: path.join(cis, 'state.json'),
    ledger: path.join(cis, 'ledger.jsonl'),
    registry: path.join(cis, 'assets', 'registry.json'),
    revisions: path.join(cis, 'revisions'),
    cost: path.join(cis, 'cost.json'),
    research: path.join(cis, 'research.json'),
    motion: path.join(cis, 'motion-spec.json'),
    reports: path.join(cis, 'reports'),
    checkpoints: path.join(cis, 'checkpoints'),
    cache: path.join(cis, 'cache'),
  };
}

/** Walk up from `start` to the nearest directory holding .cis/project.json. */
export function findProject(start = process.cwd()) {
  let dir = path.resolve(start);
  for (;;) {
    if (exists(path.join(dir, '.cis', 'project.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function requireProject(start) {
  const root = findProject(start);
  if (!root) {
    throw new CisError('E_NO_PROJECT', 'No Creative Intelligence Studio project here. Run `creative-studio init --brief <brief.json>` first.', { exit: EXIT.USAGE });
  }
  return root;
}

export function initProject(root, brief) {
  const p = paths(root);
  if (exists(p.project)) throw new CisError('E_EXISTS', `A project already exists at ${root}. Use \`creative-studio status\` to inspect it.`);
  assertValid('brief', brief, 'Brief');
  const project = {
    schemaVersion: '1.0.0',
    id: brief.projectId,
    clientId: brief.client.id,
    name: brief.name,
    createdAt: nowIso(),
    createdWith: `creative-intelligence-studio@${CIS_VERSION}`,
    policy: {
      externalUploads: brief.constraints.externalUploads,
      budgetUsd: brief.constraints.budgetUsd ?? 0,
      allowedProviders: ['local-procedural'],
    },
  };
  for (const d of [p.cis, p.dnaVersions, p.directions, p.revisions, p.reports, p.checkpoints, path.dirname(p.registry)]) {
    fs.mkdirSync(d, { recursive: true });
  }
  writeJson(p.project, project);
  writeJson(p.brief, brief);
  writeJson(p.registry, { schemaVersion: '1.0.0', assets: [] });
  writeJson(p.cost, { schemaVersion: '1.0.0', budgetUsd: project.policy.budgetUsd, spentUsd: 0, entries: [] });
  // Secrets and caches never belong in a client repository.
  const gi = path.join(root, '.gitignore');
  const lines = ['node_modules/', 'dist/', '.cis/cache/', '.cis/checkpoints/', '.env', '.env.*', '!.env.example'];
  const current = exists(gi) ? fs.readFileSync(gi, 'utf8').split('\n') : [];
  const missing = lines.filter((l) => !current.includes(l));
  if (missing.length) fs.writeFileSync(gi, [...current.filter(Boolean), ...missing].join('\n') + '\n');
  appendEvent(root, { type: 'project.created', actor: 'cli', data: { projectId: project.id, clientId: project.clientId } });
  appendEvent(root, { type: 'brief.created', actor: 'cli', data: { deliverables: brief.deliverables } });
  return project;
}

export function loadProject(root) {
  return readJson(paths(root).project);
}

export function loadBrief(root) {
  return assertValid('brief', readJson(paths(root).brief), 'Brief');
}

// ------------------------------------------------------------------ lock -----

/** Coarse advisory lock so two CLI processes never interleave state writes. */
function withLock(root, fn) {
  const lock = path.join(paths(root).cis, '.lock');
  const deadline = Date.now() + 5000;
  for (;;) {
    try {
      const fd = fs.openSync(lock, 'wx');
      fs.writeSync(fd, String(process.pid));
      fs.closeSync(fd);
      break;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      // A lock left by a crashed process is reclaimed after 30 seconds.
      try {
        if (Date.now() - fs.statSync(lock).mtimeMs > 30000) fs.unlinkSync(lock);
      } catch {
        /* lock vanished between calls */
      }
      if (Date.now() > deadline) throw new CisError('E_LOCKED', 'Project state is locked by another creative-studio process.');
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 40);
    }
  }
  try {
    return fn();
  } finally {
    try {
      fs.unlinkSync(lock);
    } catch {
      /* already released */
    }
  }
}

// ---------------------------------------------------------------- ledger -----

function readLedger(root) {
  const file = paths(root).ledger;
  if (!exists(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line, i) => {
      try {
        return JSON.parse(line);
      } catch {
        throw new CisError('E_LEDGER_CORRUPT', `Ledger line ${i + 1} is not valid JSON.`);
      }
    });
}

function eventHash(e) {
  const { hash, ...rest } = e;
  return sha256(JSON.stringify(rest));
}

/**
 * Append an event. Each entry carries the hash of the previous one, so edits or
 * deletions in the middle of the history are detectable by `ledger verify`.
 */
export function appendEvent(root, { type, actor = 'cli', data = {}, evidence = [], costUsd }) {
  return withLock(root, () => {
    const events = readLedger(root);
    const prev = events.at(-1);
    const event = {
      seq: events.length + 1,
      at: nowIso(),
      type,
      actor,
      data: JSON.parse(redact(JSON.stringify(data))),
      evidence,
      ...(costUsd !== undefined ? { costUsd } : {}),
      prevHash: prev ? prev.hash : null,
    };
    event.hash = eventHash(event);
    fs.appendFileSync(paths(root).ledger, JSON.stringify(event) + '\n');
    return event;
  });
}

export function verifyLedger(root) {
  const events = readLedger(root);
  const problems = [];
  events.forEach((e, i) => {
    if (e.seq !== i + 1) problems.push(`entry ${i + 1}: sequence is ${e.seq}`);
    if (eventHash(e) !== e.hash) problems.push(`entry ${i + 1}: content does not match its hash`);
    const want = i === 0 ? null : events[i - 1].hash;
    if (e.prevHash !== want) problems.push(`entry ${i + 1}: chain broken`);
  });
  return { ok: problems.length === 0, count: events.length, problems };
}

export function ledger(root) {
  return readLedger(root);
}

// ----------------------------------------------------------------- state -----

export function loadState(root) {
  const file = paths(root).state;
  if (!exists(file)) return null;
  return assertValid('project-state', readJson(file), 'Project state');
}

export function saveState(root, state) {
  state.updatedAt = nowIso();
  assertValid('project-state', state, 'Project state');
  withLock(root, () => writeJson(paths(root).state, state));
}

// ------------------------------------------------------------- approvals -----

const AUTOMATED_ACTOR = /^(agent|claude|ai|assistant|auto|automated|bot|cli|system|qa)$/i;

/**
 * Record a human decision on a gate. Automated actors are refused: a QA score
 * or an agent's own judgement is never client approval. `simulated` exists for
 * demos and benchmarks and is carried into every report that mentions the gate.
 */
export function recordApproval(root, { gate, decision, actor, role, note, evidence = [], simulated = false }) {
  const state = loadState(root);
  if (!state) throw new CisError('E_NO_PLAN', 'No plan yet. Run `creative-studio plan` first.');
  const g = state.gates.find((x) => x.id === gate);
  if (!g) throw new CisError('E_GATE_UNKNOWN', `Unknown gate "${gate}". Known: ${state.gates.map((x) => x.id).join(', ')}`, { exit: EXIT.USAGE });
  if (!actor || AUTOMATED_ACTOR.test(actor.trim())) {
    throw new CisError('E_APPROVER', `"${actor || ''}" cannot approve a gate. Approval must name the human who decided (client or creative director).`, { exit: EXIT.BLOCKED });
  }
  if (!['approved', 'rejected', 'changes-requested'].includes(decision)) {
    throw new CisError('E_USAGE', 'Decision must be approved, rejected or changes-requested.', { exit: EXIT.USAGE });
  }
  const missing = g.requires.filter((id) => state.tasks.find((t) => t.id === id)?.status !== 'done');
  if (decision === 'approved' && missing.length) {
    throw new CisError('E_GATE_NOT_READY', `Gate ${gate} cannot be approved before its inputs exist: ${missing.join(', ')}`, { exit: EXIT.BLOCKED });
  }
  g.status = decision;
  g.decision = { actor, role: role || 'client', at: nowIso(), note: note || '', evidence, simulated };
  saveState(root, state);
  appendEvent(root, { type: `gate.${decision}`, actor, data: { gate, role: g.decision.role, simulated, note: note || '' }, evidence });
  return g;
}

// ----------------------------------------------------------- checkpoints -----

/** Snapshot a deliverable directory before a repair attempt so it can be rolled back. */
export function createCheckpoint(root, relDir, label) {
  const src = path.resolve(root, relDir);
  if (!src.startsWith(path.resolve(root) + path.sep)) throw new CisError('E_PATH_TRAVERSAL', 'Checkpoint path escapes the project.');
  if (!exists(src)) throw new CisError('E_READ', `Nothing to checkpoint at ${relDir}`);
  const id = `${nowIso().replace(/[:.]/g, '-')}-${label.replace(/[^a-z0-9-]/gi, '-')}`;
  const dest = path.join(paths(root).checkpoints, id);
  const files = walk(src, { ignore: ['dist', '.cis', '.expo'] });
  for (const f of files) {
    const target = path.join(dest, 'files', path.relative(src, f));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(f, target);
  }
  writeJson(path.join(dest, 'checkpoint.json'), { id, relDir, label, createdAt: nowIso(), files: files.length });
  appendEvent(root, { type: 'checkpoint.created', data: { id, relDir, files: files.length } });
  return { id, files: files.length };
}

export function listCheckpoints(root) {
  const dir = paths(root).checkpoints;
  if (!exists(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((d) => exists(path.join(dir, d, 'checkpoint.json')))
    .map((d) => readJson(path.join(dir, d, 'checkpoint.json')))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** Restore a checkpoint: files added since the snapshot are removed, changed files are reverted. */
export function restoreCheckpoint(root, id) {
  const dir = path.join(paths(root).checkpoints, id);
  if (!exists(path.join(dir, 'checkpoint.json'))) throw new CisError('E_READ', `Unknown checkpoint ${id}`);
  const meta = readJson(path.join(dir, 'checkpoint.json'));
  const dest = path.resolve(root, meta.relDir);
  const snap = path.join(dir, 'files');
  const keep = new Set(walk(snap).map((f) => path.relative(snap, f)));
  let removed = 0;
  for (const f of walk(dest, { ignore: ['dist', '.cis', '.expo'] })) {
    if (!keep.has(path.relative(dest, f))) {
      fs.unlinkSync(f);
      removed++;
    }
  }
  for (const rel of keep) {
    const target = path.join(dest, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(snap, rel), target);
  }
  appendEvent(root, { type: 'checkpoint.restored', data: { id, restored: keep.size, removed } });
  return { restored: keep.size, removed };
}
