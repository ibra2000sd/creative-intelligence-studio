// The Creative Orchestrator: classify a brief, build a dependency-ordered plan
// with handoff contracts and approval gates, and move tasks through it.
import fs from 'node:fs';
import path from 'node:path';
import { CisError, EXIT, exists, readJson, nowIso } from './util.mjs';
import { validate } from './schema.mjs';
import { loadState, saveState, appendEvent, paths } from './project.mjs';

const DISCIPLINE = {
  'brand-identity': 'brand',
  'marketing-website': 'web',
  'web-application': 'web-app',
  'mobile-application': 'mobile',
  'image-assets': 'imagery',
  'social-assets': 'imagery',
  'motion-system': 'motion',
  '3d-experience': '3d',
  'design-system': 'design-system',
};

// Words in a brief that usually signal a deliverable the client did not list.
// These become suggestions for the human, never silent scope additions.
const HINTS = [
  ['brand-identity', /\b(logo|identity|rebrand|brand system|wordmark)\b/i],
  ['marketing-website', /\b(landing page|marketing site|website|launch site)\b/i],
  ['web-application', /\b(dashboard|portal|admin|web app|console)\b/i],
  ['mobile-application', /\b(ios|android|mobile app|native app)\b/i],
  ['3d-experience', /\b(3d|three-dimensional|configurator|webgl)\b/i],
  ['image-assets', /\b(illustration|hero image|campaign|imagery|social)\b/i],
];

export function classify(brief) {
  const disciplines = [...new Set(brief.deliverables.map((d) => DISCIPLINE[d]))];
  const text = `${brief.objective} ${brief.background || ''}`;
  const suggestions = HINTS.filter(([d, rx]) => !brief.deliverables.includes(d) && rx.test(text)).map(
    ([d]) => `The brief mentions work that looks like "${d}" but it is not a listed deliverable. Confirm scope with the client.`,
  );
  const flags = [];
  const rtl = brief.locales.some((l) => /^(ar|he|fa|ur)/.test(l));
  if (rtl) flags.push('rtl');
  if (brief.locales.length > 1) flags.push('multilingual');
  if (brief.constraints.externalUploads === 'deny') flags.push('no-external-uploads');
  if (!brief.constraints.budgetUsd) flags.push('no-paid-providers');
  if (brief.constraints.motionLevel === 'none') flags.push('motion-disabled');
  if ((brief.existingAssets || []).some((a) => a.rights === 'unknown')) flags.push('asset-rights-unknown');
  if (brief.client.fictional) flags.push('fictional-client');
  if ((brief.openQuestions || []).length) flags.push('open-questions');
  return {
    scope: disciplines.length > 1 ? 'cross-disciplinary' : 'single-discipline',
    disciplines,
    flags,
    suggestions,
  };
}

function task(id, title, skill, phase, dependsOn, produces, extra = {}) {
  return { id, title, skill, phase, dependsOn, produces, status: 'pending', attempts: 0, maxAttempts: 3, ...extra };
}

/**
 * Build the plan. Shared foundations (direction, Experience DNA, motion spec)
 * come first and gate everything downstream, which is what keeps a
 * multi-discipline project from becoming disconnected outputs.
 */
export function buildPlan(brief) {
  const has = (d) => brief.deliverables.includes(d);
  const classification = classify(brief);
  const tasks = [];
  const gates = [];

  tasks.push(task('intake', 'Validate the brief and record open questions', 'intake-discovery', 'intake', [], [{ path: '.cis/brief.json', schema: 'brief' }], { command: 'creative-studio brief check' }));
  tasks.push(task('research', 'Research audience, competitors and conventions', 'research-evidence', 'intake', ['intake'], [{ path: '.cis/research.json', schema: 'research-log' }], { command: 'creative-studio research add' }));
  gates.push({ id: 'G0-brief', title: 'Brief, rights and approver confirmed', requires: ['intake'], status: 'pending' });

  tasks.push(task('directions', 'Propose distinct creative directions', 'art-direction', 'direction', ['research'], [{ path: '.cis/directions', kind: 'dir' }, { path: '.cis/reports/directions.html' }], { gate: 'G0-brief', command: 'creative-studio directions check && creative-studio directions board' }));
  gates.push({ id: 'G1-direction', title: 'Creative direction chosen by the client', requires: ['directions'], status: 'pending' });

  tasks.push(task('dna', 'Author the Experience DNA from the approved direction', 'experience-dna', 'system', ['directions'], [{ path: '.cis/dna/experience-dna.json', schema: 'experience-dna' }, { path: 'design-system/tokens.css' }], { gate: 'G1-direction', command: 'creative-studio dna check && creative-studio dna tokens' }));
  gates.push({ id: 'G2-system', title: 'Experience DNA and design system approved', requires: ['dna'], status: 'pending' });

  const production = [];
  const afterSystem = { gate: 'G2-system' };
  const needsMotion = brief.constraints.motionLevel !== 'none' && (has('marketing-website') || has('web-application') || has('mobile-application') || has('3d-experience') || has('motion-system'));
  if (needsMotion) {
    tasks.push(task('motion-spec', 'Decide and specify motion per interaction', 'motion-intelligence', 'system', ['dna'], [{ path: '.cis/motion-spec.json', schema: 'motion-spec' }], { ...afterSystem, command: 'creative-studio motion check' }));
  }
  const motionDep = needsMotion ? ['motion-spec'] : [];

  if (has('brand-identity')) {
    tasks.push(task('brand', 'Produce the logo system, exports and guidelines', 'brand-identity', 'production', ['dna'], [{ path: 'brand/logo', kind: 'dir' }, { path: 'brand/guidelines.html' }, { path: 'brand/brand-manifest.json' }], { ...afterSystem, command: 'creative-studio brand build' }));
    production.push('brand');
  }
  if (has('image-assets') || has('social-assets') || has('marketing-website')) {
    tasks.push(task('images', 'Generate, inspect and register visual assets', 'image-asset-factory', 'production', ['dna', ...(has('brand-identity') ? ['brand'] : [])], [{ path: 'assets/generated', kind: 'dir' }, { path: '.cis/assets/registry.json' }], { ...afterSystem, command: 'creative-studio images generate' }));
    production.push('images');
  }
  if (has('3d-experience')) {
    tasks.push(task('scene-3d', 'Build the 3D asset and interactive scene', '3d-experience', 'production', ['dna', ...motionDep], [{ path: 'scene/public/models', kind: 'dir' }, { path: 'scene/package.json' }], { ...afterSystem, command: 'creative-studio 3d build' }));
    production.push('scene-3d');
  }
  if (has('marketing-website')) {
    const deps = ['dna', 'images', ...motionDep, ...(has('brand-identity') ? ['brand'] : []), ...(has('3d-experience') ? ['scene-3d'] : [])];
    tasks.push(task('website', 'Build the marketing website', 'web-experience', 'production', deps, [{ path: 'web/package.json' }, { path: 'web/src/content.json', schema: 'content-web' }], { ...afterSystem, command: 'creative-studio website scaffold' }));
    production.push('website');
  }
  if (has('web-application')) {
    tasks.push(task('web-app', 'Build the web application', 'web-application', 'production', ['dna', ...motionDep, ...(has('brand-identity') ? ['brand'] : [])], [{ path: 'app/package.json' }], { ...afterSystem, command: 'creative-studio website scaffold --kind app' }));
    production.push('web-app');
  }
  if (has('mobile-application')) {
    tasks.push(task('mobile', 'Build the mobile application', 'mobile-experience', 'production', ['dna', ...motionDep, ...(has('brand-identity') ? ['brand'] : [])], [{ path: 'mobile/package.json' }, { path: 'mobile/app.json' }], { ...afterSystem, command: 'creative-studio mobile scaffold' }));
    production.push('mobile');
  }

  tasks.push(task('qa', 'Run functional, visual, accessibility, performance and security checks', 'quality-assurance', 'quality', production, [{ path: '.cis/reports/qa-summary.json', schema: 'qa-summary' }], { command: 'creative-studio test && creative-studio audit' }));
  if (classification.scope === 'cross-disciplinary') {
    tasks.push(task('consistency', 'Verify every deliverable carries the same Experience DNA', 'experience-dna', 'quality', production, [{ path: '.cis/reports/consistency.json' }], { command: 'creative-studio dna consistency' }));
  }
  const qaDeps = ['qa', ...(classification.scope === 'cross-disciplinary' ? ['consistency'] : [])];
  tasks.push(task('creative-review', 'Independent creative review against the rubric', 'creative-review', 'quality', qaDeps, [{ path: '.cis/reports/creative-review.json', schema: 'creative-review' }], { command: 'creative-studio review check' }));
  gates.push({ id: 'G6-quality', title: 'Quality evidence reviewed', requires: qaDeps, status: 'pending' });

  tasks.push(task('export', 'Package deliverables, licences and evidence', 'delivery', 'delivery', ['creative-review'], [{ path: 'export/delivery-manifest.json' }], { gate: 'G6-quality', command: 'creative-studio export' }));
  gates.push({ id: 'G7-acceptance', title: 'Client accepts the delivery', requires: ['export'], status: 'pending' });

  return { schemaVersion: '1.0.0', projectId: brief.projectId, createdAt: nowIso(), classification, tasks, gates };
}

/** Tasks whose dependencies are done and whose gate (if any) is approved. */
export function runnable(state) {
  const done = new Set(state.tasks.filter((t) => t.status === 'done' || t.status === 'skipped').map((t) => t.id));
  const approved = new Set(state.gates.filter((g) => g.status === 'approved').map((g) => g.id));
  return state.tasks.filter((t) => ['pending', 'failed'].includes(t.status) && t.dependsOn.every((d) => done.has(d)) && (!t.gate || approved.has(t.gate)));
}

/** Why a task cannot start yet, in words a person can act on. */
export function blockers(state, t) {
  const out = [];
  for (const d of t.dependsOn) {
    const dep = state.tasks.find((x) => x.id === d);
    if (dep && !['done', 'skipped'].includes(dep.status)) out.push(`waits for task "${d}" (${dep.status})`);
  }
  if (t.gate) {
    const g = state.gates.find((x) => x.id === t.gate);
    if (g.status !== 'approved') out.push(`waits for human approval of gate ${g.id}: ${g.title}`);
  }
  return out;
}

function getTask(state, id) {
  const t = state.tasks.find((x) => x.id === id);
  if (!t) throw new CisError('E_TASK_UNKNOWN', `Unknown task "${id}". Known: ${state.tasks.map((x) => x.id).join(', ')}`, { exit: EXIT.USAGE });
  return t;
}

function requireState(root) {
  const state = loadState(root);
  if (!state) throw new CisError('E_NO_PLAN', 'No plan yet. Run `creative-studio plan` first.');
  return state;
}

export function startTask(root, id) {
  const state = requireState(root);
  const t = getTask(state, id);
  if (t.status === 'done') return { task: t, changed: false }; // idempotent
  if (t.status === 'escalated') throw new CisError('E_ESCALATED', `Task "${id}" hit its retry limit and needs a human decision. Use \`creative-studio task reset ${id}\` after review.`, { exit: EXIT.BLOCKED });
  const why = blockers(state, t);
  if (why.length) throw new CisError('E_BLOCKED', `Task "${id}" cannot start: ${why.join('; ')}`, { exit: EXIT.BLOCKED });
  if (t.status !== 'in-progress') {
    t.status = 'in-progress';
    t.startedAt = nowIso();
    saveState(root, state);
    appendEvent(root, { type: 'task.started', data: { task: id, attempt: t.attempts + 1 } });
  }
  return { task: t, changed: true };
}

/** Check a task's handoff contract against the files actually on disk. */
export function checkContract(root, t) {
  const problems = [];
  for (const out of t.produces) {
    const abs = path.resolve(root, out.path);
    if (!exists(abs)) {
      problems.push(`${out.path} does not exist`);
      continue;
    }
    const isDir = fs.statSync(abs).isDirectory();
    if (out.kind === 'dir') {
      if (!isDir) problems.push(`${out.path} should be a directory`);
      else if (fs.readdirSync(abs).length === 0) problems.push(`${out.path} is empty`);
      continue;
    }
    if (isDir) {
      problems.push(`${out.path} should be a file`);
      continue;
    }
    if (fs.statSync(abs).size === 0) problems.push(`${out.path} is empty`);
    if (out.schema) {
      let data;
      try {
        data = readJson(abs);
      } catch (e) {
        problems.push(`${out.path}: ${e.message}`);
        continue;
      }
      const res = validate(out.schema, data);
      if (!res.valid) problems.push(`${out.path} violates ${out.schema}: ${res.errors.slice(0, 3).map((e) => `${e.path} ${e.message}`).join('; ')}`);
    }
  }
  return problems;
}

/**
 * Mark a task done only if its outputs exist and validate. This is the
 * "no artificial completion" rule, enforced mechanically.
 */
export function completeTask(root, id, { evidence = [] } = {}) {
  const state = requireState(root);
  const t = getTask(state, id);
  if (t.status === 'done') return { task: t, changed: false };
  const why = blockers(state, t);
  if (why.length) throw new CisError('E_BLOCKED', `Task "${id}" cannot complete: ${why.join('; ')}`, { exit: EXIT.BLOCKED });
  const problems = checkContract(root, t);
  if (problems.length) {
    throw new CisError('E_CONTRACT', `Task "${id}" is not done. Its handoff contract is unmet:\n  - ${problems.join('\n  - ')}`, { exit: EXIT.BLOCKED, details: problems });
  }
  t.status = 'done';
  t.finishedAt = nowIso();
  t.attempts += 1;
  t.evidence = [...new Set([...(t.evidence || []), ...evidence])];
  delete t.lastFailure;
  saveState(root, state);
  appendEvent(root, { type: 'task.completed', data: { task: id, attempts: t.attempts }, evidence });
  return { task: t, changed: true };
}

/** Record a failed attempt. After maxAttempts the task escalates to a human instead of looping. */
export function failTask(root, id, reason) {
  const state = requireState(root);
  const t = getTask(state, id);
  t.attempts += 1;
  t.lastFailure = String(reason || 'unspecified').slice(0, 500);
  t.status = t.attempts >= (t.maxAttempts || 3) ? 'escalated' : 'failed';
  saveState(root, state);
  appendEvent(root, { type: t.status === 'escalated' ? 'task.escalated' : 'task.failed', data: { task: id, attempts: t.attempts, reason: t.lastFailure } });
  return { task: t };
}

export function resetTask(root, id, actor) {
  const state = requireState(root);
  const t = getTask(state, id);
  if (!actor) throw new CisError('E_USAGE', 'Resetting a task needs --actor <name> so the decision is attributable.', { exit: EXIT.USAGE });
  t.status = 'pending';
  t.attempts = 0;
  delete t.lastFailure;
  saveState(root, state);
  appendEvent(root, { type: 'task.reset', actor, data: { task: id } });
  return { task: t };
}

/**
 * Re-derive task status from disk. Used after an interrupted session: a task
 * left "in-progress" whose contract is already satisfied is completed; one
 * whose contract is not satisfied goes back to pending without burning a retry.
 */
export function recover(root) {
  const state = requireState(root);
  const report = [];
  for (const t of state.tasks) {
    if (t.status !== 'in-progress') continue;
    const problems = checkContract(root, t);
    if (problems.length === 0 && blockers(state, t).length === 0) {
      t.status = 'done';
      t.finishedAt = nowIso();
      t.attempts += 1;
      report.push({ task: t.id, action: 'completed', detail: 'outputs already satisfy the contract' });
    } else {
      t.status = 'pending';
      report.push({ task: t.id, action: 'requeued', detail: problems[0] || 'blocked' });
    }
  }
  // A "done" task whose outputs have since vanished is no longer done.
  for (const t of state.tasks) {
    if (t.status !== 'done') continue;
    const problems = checkContract(root, t);
    if (problems.length) {
      t.status = 'pending';
      report.push({ task: t.id, action: 'reopened', detail: problems[0] });
    }
  }
  if (report.length) {
    saveState(root, state);
    appendEvent(root, { type: 'state.recovered', data: { changes: report } });
  }
  return report;
}

// ------------------------------------------------------- skill routing -------

const ROUTES = [
  ['creative-studio', /\b(whole project|end[- ]to[- ]end|full (brand|project)|everything|kick ?off|new client)\b/i, 3],
  ['intake-discovery', /\b(brief|requirements?|discovery|scope|intake)\b/i, 2],
  ['research-evidence', /\b(research|competitors?|audience|benchmark|market)\b/i, 2],
  ['art-direction', /\b(art direction|creative directions?|moodboard|territor(y|ies)|look and feel|concepts?)\b/i, 3],
  ['experience-dna', /\b(experience dna|design tokens?|design system|tokens|palette|type scale|consisten(t|cy))\b/i, 3],
  ['brand-identity', /\b(logo|wordmark|monogram|brand (identity|guidelines|kit)|visual identity|rebrand)\b/i, 3],
  ['image-asset-factory', /\b(image|illustration|hero (image|art)|texture|pattern|social (graphic|post|asset)s?|og image|asset generation)\b/i, 2],
  ['web-experience', /\b(landing page|marketing (site|website)|website|scrollytelling|hero section|scroll)\b/i, 2],
  ['web-application', /\b(dashboard|portal|admin|web app(lication)?|data table|charts?)\b/i, 3],
  ['mobile-experience', /\b(mobile app|ios|android|react native|expo|onboarding screens?|gesture)\b/i, 3],
  ['motion-intelligence', /\b(animat(e|ion|ions)|motion|transition|easing|spring|micro-?interactions?|gsap|reduced motion)\b/i, 2],
  ['3d-experience', /\b(3d|three\.?js|webgl|webgpu|gltf|glb|configurator|product viewer|shader)\b/i, 3],
  ['design-to-code', /\b(screenshot|mock-?up|figma|image[- ]to[- ]code|pixel[- ]perfect|match (the|this) design|visual diff)\b/i, 3],
  ['quality-assurance', /\b(test|qa|accessibility|a11y|wcag|performance|core web vitals|audit|security|regression)\b/i, 2],
  ['creative-review', /\b(critique|creative review|design review|rubric|does (this|it) look)\b/i, 3],
  ['revision-management', /\b(revision|feedback|change request|client (wants|asked|said)|tweak|adjust)\b/i, 2],
  ['delivery', /\b(export|package|hand-?off|deliver(y|ables)?|ship|release)\b/i, 2],
];

/**
 * Deterministic request-to-skill router. Claude selects skills from their
 * descriptions; this is the testable baseline the evals compare against and
 * what `creative-studio route` prints.
 */
export function route(request) {
  const scores = ROUTES.map(([skill, rx, weight]) => {
    const m = String(request).match(new RegExp(rx.source, 'gi'));
    return { skill, score: m ? m.length * weight : 0 };
  })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  // Three or more distinct production disciplines is a project, not a task.
  const production = ['brand-identity', 'web-experience', 'web-application', 'mobile-experience', '3d-experience', 'image-asset-factory'];
  const hit = scores.filter((s) => production.includes(s.skill)).length;
  if (hit >= 3 && !scores.some((s) => s.skill === 'creative-studio')) scores.unshift({ skill: 'creative-studio', score: 99 });
  else if (hit >= 3) scores.sort((a, b) => (a.skill === 'creative-studio' ? -1 : b.skill === 'creative-studio' ? 1 : 0));
  return scores;
}
