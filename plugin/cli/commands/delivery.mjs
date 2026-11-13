// Client review and delivery: scoped revision requests that protect approved
// work, and export of a hashed, self-describing delivery package.
import fs from 'node:fs';
import path from 'node:path';
import { CisError, EXIT, CIS_VERSION, readJson, writeJson, writeFileAtomic, exists, print, table, nowIso, walk, sha256File, fmtBytes, slugify } from '../lib/util.mjs';
import { assertValid } from '../lib/schema.mjs';
import { requireProject, paths, appendEvent, loadState, loadProject, loadBrief, verifyLedger } from '../lib/project.mjs';
import { loadRegistry, verifyRegistry } from '../lib/assets.mjs';
import { writeZip, listZip } from '../lib/zip.mjs';

const json = (flags, value) => (flags.json ? (print(JSON.stringify(value, null, 2)), true) : false);
const SKIP = ['node_modules', '.git', '.expo', 'dist-web', 'checkpoints', 'cache', 'export', 'coverage', 'baselines'];

// What each kind of change is allowed to touch. Anything else that changes is a scope violation.
const SCOPE = {
  'color.adjust': { dna: ['brand_colors'], files: ['design-system/', '.cis/dna/', 'src/dna/'], next: ['Edit the colour values in a copy of the DNA', 'creative-studio dna bump --from <file> --revision-request <id>', 'creative-studio dna tokens', 'creative-studio website sync; website sync --kind app; mobile sync; 3d sync'] },
  'typography.adjust': { dna: ['typography'], files: ['design-system/', '.cis/dna/', 'src/dna/', 'package.json'], next: ['Edit typography in a copy of the DNA', 'creative-studio dna bump --from <file> --revision-request <id>', 'creative-studio dna tokens, then sync each deliverable'] },
  'layout.adjust': { dna: ['layout'], files: ['design-system/', '.cis/dna/', 'src/dna/', 'src/styles.css'], next: ['Edit layout in a copy of the DNA or the named section styles', 'creative-studio dna bump ... --revision-request <id>'] },
  'motion.adjust': { dna: ['motion'], files: ['design-system/', '.cis/dna/', 'src/dna/', '.cis/motion-spec.json'], next: ['Edit motion in a copy of the DNA (intensity, durations, spring)', 'creative-studio dna bump --from <file> --revision-request <id>', 'creative-studio dna tokens, then sync each deliverable', 'creative-studio motion check'] },
  'copy.edit': { dna: ['copy'], files: ['.cis/content-web.json', 'src/content.json', 'src/i18n'], next: ['Edit .cis/content-web.json (or the app strings)', 'creative-studio website sync'] },
  'asset.regenerate': { dna: [], files: [], assetOnly: true, next: ['Change only that job in .cis/image-brief.json (seed, variant or recipe)', 'creative-studio images generate   (unchanged jobs are reused, not regenerated)', 'creative-studio website sync'] },
  'asset.replace': { dna: [], files: [], assetOnly: true, next: ['Replace the asset files, then register them with provenance'] },
  'logo.adjust': { dna: [], files: ['brand/', '.cis/brand-spec.json', 'public/brand/', 'assets/icon.png', 'assets/favicon.png'], next: ['Edit the selected concept parameters in .cis/brand-spec.json', 'creative-studio brand build', 'sync the deliverables that embed the logo'] },
  'scene.adjust': { dna: ['materials'], files: ['scene/', 'design-system/', '.cis/dna/', 'public/scene/'], next: ['Edit materials3d in a copy of the DNA or the scene source', 'creative-studio 3d build'] },
  'function.fix': { dna: [], files: [], anyCode: true, next: ['Fix the behaviour in the named deliverable', 'creative-studio test <target>'] },
  'scope.add': { dna: [], files: [], anyCode: true, next: ['This is new scope: update the brief with the client, then creative-studio plan --replan'] },
};

function revisionFile(root, id) {
  return path.join(paths(root).revisions, `${id}.json`);
}

function loadRevisions(root) {
  const dir = paths(root).revisions;
  if (!exists(dir)) return [];
  return fs.readdirSync(dir).filter((f) => /^rev-\d+\.json$/.test(f)).sort().map((f) => readJson(path.join(dir, f)));
}

/** Hash every deliverable and state file so a later verify can tell exactly what a revision changed. */
function snapshot(root) {
  const out = {};
  for (const file of walk(root, { ignore: [...SKIP, 'dist', 'dist-native', 'reports', 'revisions'] })) {
    const rel = path.relative(root, file).split(path.sep).join('/');
    if (rel === '.cis/ledger.jsonl' || rel === '.cis/state.json' || rel === '.cis/cost.json' || rel === '.cis/.lock') continue;
    out[rel] = sha256File(file);
  }
  return out;
}

function inScope(rel, rev, registry) {
  const scope = SCOPE[rev.requestedChange];
  if (rel === '.cis/assets/registry.json') return true; // provenance always records the change
  if (scope.anyCode) return rev.target.type !== 'deliverable' || rel.startsWith(`${rev.target.id}/`) || rel.startsWith('.cis/');
  if (scope.assetOnly) {
    const id = rev.target.id;
    const asset = registry.assets.find((a) => a.id === id);
    const own = new Set((asset?.files || []).map((f) => f.path));
    return own.has(rel) || rel.startsWith(`assets/generated/${id}/`) || new RegExp(`/public/assets/${id}\\.[a-z0-9]+$`).test(`/${rel}`) || rel === '.cis/image-brief.json';
  }
  return scope.files.some((f) => (f.endsWith('/') ? rel.startsWith(f) || rel.includes(`/${f}`) : rel === f || rel.endsWith(`/${f}`) || rel.includes(f)));
}

async function revise({ _, flags }) {
  const root = requireProject(flags.project);
  const sub = _[0] || 'list';
  if (sub === 'add') {
    const [type, ...rest] = String(flags.target || '').split(':');
    const targetId = rest.join(':');
    if (!type || !targetId || !flags.feedback || !flags.change || !flags.by) {
      throw new CisError('E_USAGE', 'Usage: creative-studio revise add --target <asset|dna|deliverable|direction>:<id> --feedback "..." --change <kind> --by "<who asked>" [--preserve layout,typography,brand_colors] [--location "..."] [--category visual]\nKinds: ' + Object.keys(SCOPE).join(', '), { exit: EXIT.USAGE });
    }
    const all = loadRevisions(root);
    const rev = {
      schemaVersion: '1.0.0',
      id: `rev-${String(all.length + 1).padStart(3, '0')}`,
      target: { type, id: targetId, ...(flags.location ? { location: String(flags.location) } : {}) },
      feedback: String(flags.feedback),
      requestedChange: String(flags.change),
      preserve: flags.preserve ? String(flags.preserve).split(',').map((s) => s.trim()) : [],
      category: String(flags.category || 'visual'),
      ...(flags.requirement ? { requirementRef: String(flags.requirement) } : {}),
      status: 'pending',
      requestedBy: String(flags.by),
      createdAt: nowIso(),
    };
    assertValid('revision-request', rev, 'Revision request');
    if (type === 'asset' && !loadRegistry(root).assets.some((a) => a.id === targetId)) throw new CisError('E_REVISION', `No registered asset "${targetId}". See \`creative-studio images list\`.`);
    const clash = (SCOPE[rev.requestedChange].dna || []).filter((a) => rev.preserve.includes(a));
    if (clash.length) throw new CisError('E_REVISION', `The request asks to change and to preserve the same aspect (${clash.join(', ')}). Ask the client which they mean.`, { exit: EXIT.BLOCKED });
    writeJson(revisionFile(root, rev.id), rev);
    appendEvent(root, { type: 'revision.requested', actor: rev.requestedBy, data: { id: rev.id, target: rev.target, change: rev.requestedChange, preserve: rev.preserve } });
    if (json(flags, { ok: true, revision: rev })) return;
    print(`Recorded ${rev.id}: ${rev.requestedChange} on ${type}:${targetId}, preserving ${rev.preserve.join(', ') || 'nothing in particular'}.\nNext: creative-studio revise start ${rev.id}`);
    return;
  }
  if (sub === 'list') {
    const all = loadRevisions(root);
    if (json(flags, all)) return;
    print(all.length ? table(all.map((r) => [r.id, r.status, `${r.target.type}:${r.target.id}`, r.requestedChange, r.preserve.join(',') || '-', r.requestedBy, r.feedback.slice(0, 50)]), ['id', 'status', 'target', 'change', 'preserve', 'by', 'feedback']) : 'No revision requests.');
    return;
  }
  const id = _[1];
  if (!id || !exists(revisionFile(root, id))) throw new CisError('E_USAGE', `Unknown revision "${id || ''}". See \`creative-studio revise list\`.`, { exit: EXIT.USAGE });
  const rev = readJson(revisionFile(root, id));
  const snapFile = path.join(paths(root).revisions, `${id}.snapshot.json`);
  if (sub === 'start') {
    writeJson(snapFile, { takenAt: nowIso(), files: snapshot(root) });
    rev.status = 'in-progress';
    writeJson(revisionFile(root, id), rev);
    appendEvent(root, { type: 'revision.started', data: { id } });
    if (json(flags, { ok: true, revision: rev, steps: SCOPE[rev.requestedChange].next })) return;
    print(`${id} in progress. A snapshot of every deliverable file was taken, so the change can be checked afterwards.\nSteps for a ${rev.requestedChange}:`);
    SCOPE[rev.requestedChange].next.forEach((s, i) => print(`  ${i + 1}. ${s.replace('<id>', id)}`));
    print(`Then: creative-studio revise verify ${id}`);
    return;
  }
  if (sub === 'verify') {
    if (!exists(snapFile)) throw new CisError('E_REVISION', `${id} has no snapshot. Run \`creative-studio revise start ${id}\` before making the change.`);
    const before = readJson(snapFile).files;
    const after = snapshot(root);
    const registry = loadRegistry(root);
    const changed = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((f) => before[f] !== after[f] && !f.startsWith('.cis/revisions/')).sort();
    const outside = changed.filter((f) => !inScope(f, rev, registry));
    const untouched = Object.keys(before).length - changed.filter((f) => f in before).length;
    const ok = changed.length > 0 && outside.length === 0;
    if (ok) {
      rev.status = 'applied';
      rev.resolution = { appliedAt: nowIso(), changedFiles: changed.slice(0, 200), untouchedVerified: [`${untouched} files byte-identical to the pre-revision snapshot`], note: `Scope check passed for ${rev.requestedChange}.` };
      assertValid('revision-request', rev, 'Revision request');
      writeJson(revisionFile(root, id), rev);
      appendEvent(root, { type: 'revision.applied', data: { id, changed: changed.length, untouched } });
    }
    if (json(flags, { ok, changed, outside, untouched })) return ok ? EXIT.OK : EXIT.BLOCKED;
    if (!changed.length) {
      print(`${id}: nothing has changed since the snapshot. The revision has not been applied.`);
      return EXIT.BLOCKED;
    }
    print(`${id}: ${changed.length} file(s) changed, ${untouched} file(s) byte-identical to the snapshot.`);
    print(table(changed.slice(0, 30).map((f) => [outside.includes(f) ? 'OUT OF SCOPE' : 'in scope', f])));
    if (outside.length) {
      print(`\nScope violation: ${outside.length} changed file(s) are outside what a ${rev.requestedChange} on ${rev.target.type}:${rev.target.id} may touch. Revert them (creative-studio checkpoint restore) or have the request widened by ${rev.requestedBy}.`);
      return EXIT.BLOCKED;
    }
    print(`\nScope check passed. Status is "applied". After the client has seen it: creative-studio revise close ${id} --actor "<name>"`);
    return;
  }
  if (sub === 'close') {
    if (rev.status !== 'applied') throw new CisError('E_REVISION', `${id} is "${rev.status}"; only an applied revision can be closed.`, { exit: EXIT.BLOCKED });
    if (!flags.actor || /^(agent|claude|ai|bot|cli|auto)/i.test(String(flags.actor))) throw new CisError('E_APPROVER', 'Closing a revision needs --actor "<the person who confirmed it>".', { exit: EXIT.BLOCKED });
    rev.status = flags.decline ? 'declined' : 'verified';
    writeJson(revisionFile(root, id), rev);
    appendEvent(root, { type: `revision.${rev.status}`, actor: String(flags.actor), data: { id, simulated: Boolean(flags.simulated) } });
    print(`${id} is ${rev.status} (confirmed by ${flags.actor}${flags.simulated ? ', SIMULATED' : ''}).`);
    return;
  }
  throw new CisError('E_USAGE', `Unknown revise subcommand "${sub}".`, { exit: EXIT.USAGE });
}

// ---------------------------------------------------------------- export ----

const DELIVERABLES = [
  ['brand', 'brand', 'Brand identity: logo system, icons, applications, guidelines'],
  ['design-system', 'design-system', 'Design tokens for web, native and 3D'],
  ['assets', 'assets', 'Generated visual assets with sources'],
  ['web', 'web', 'Marketing website: source and production build'],
  ['app', 'app', 'Web application: source and production build'],
  ['scene', 'scene', '3D experience: source, model and production build'],
  ['mobile', 'mobile', 'Mobile application: source and native JS bundles'],
];

async function exportCmd({ flags }) {
  const root = requireProject(flags.project);
  const project = loadProject(root);
  const brief = loadBrief(root);
  const state = loadState(root);
  const p = paths(root);
  const draft = Boolean(flags.draft);
  const blockers = [];
  const qaFile = path.join(p.reports, 'qa-summary.json');
  const qa = exists(qaFile) ? readJson(qaFile) : null;
  if (!qa) blockers.push('No QA summary: run `creative-studio test` and `creative-studio audit`.');
  else if (qa.verdict === 'fail') blockers.push(`QA verdict is FAIL (${qa.totals.fail} failing check(s)).`);
  const gate = state?.gates.find((g) => g.id === 'G6-quality');
  if (!gate || gate.status !== 'approved') blockers.push('Gate G6-quality (quality evidence reviewed) has not been approved by a person.');
  // An independent review is evidence the package must carry: its blocker findings stop a final
  // export, and everything it rated blocker or major is listed as an open issue in a draft.
  const reviewFile = path.join(p.reports, 'creative-review.json');
  let review = null;
  try {
    review = exists(reviewFile) ? readJson(reviewFile) : null;
  } catch {
    blockers.push('The creative review file could not be read: run `creative-studio review check`.');
  }
  const reviewFindings = (review?.findings || []).filter((f) => ['blocker', 'major'].includes(f.severity));
  const reviewBlockers = reviewFindings.filter((f) => f.severity === 'blocker');
  if (review && (review.recommendation === 'rework' || reviewBlockers.length)) {
    blockers.push(`The creative review by ${review.reviewer} recommends "${review.recommendation}" with ${reviewBlockers.length} blocker finding(s); fix them and have the work reviewed again.`);
  }
  const reviewIssues = reviewFindings.map((f) => `REVIEW ${f.severity.toUpperCase()} ${String(f.where).slice(0, 140)}: ${String(f.issue).slice(0, 220)}`);
  const reg = verifyRegistry(root);
  for (const pr of reg.problems) blockers.push(`Asset ${pr.asset}: ${pr.problem} (${pr.file})`);
  const led = verifyLedger(root);
  if (!led.ok) blockers.push(`Event ledger failed verification: ${led.problems[0]}`);
  if (blockers.length && !draft) {
    throw new CisError('E_EXPORT_BLOCKED', `Not exporting a final package:\n  - ${blockers.slice(0, 12).join('\n  - ')}\nUse --draft for a clearly marked review package.`, { exit: EXIT.BLOCKED, details: blockers });
  }

  const entries = [];
  const add = (rel, abs) => entries.push({ name: rel.split(path.sep).join('/'), file: abs });
  const included = [];
  for (const [id, dir, title] of DELIVERABLES) {
    const abs = path.join(root, dir);
    if (!exists(abs)) continue;
    const files = walk(abs, { ignore: SKIP });
    for (const f of files) add(path.join('deliverables', path.relative(root, f)), f);
    included.push({ id, title, files: files.length });
  }
  for (const f of walk(p.reports, { ignore: flags['with-evidence'] ? [] : ['qa'] })) add(path.join('evidence', path.relative(p.reports, f)), f);
  for (const [rel, abs] of [['project/brief.json', p.brief], ['project/experience-dna.json', p.dna], ['project/plan-and-approvals.json', p.state], ['project/event-ledger.jsonl', p.ledger], ['project/asset-registry.json', p.registry], ['project/cost.json', p.cost], ['project/research.json', p.research], ['project/motion-spec.json', p.motion]]) if (exists(abs)) add(rel, abs);
  if (exists(p.dnaVersions)) for (const f of walk(p.dnaVersions)) add(path.join('project/dna-history', path.basename(f)), f);
  if (exists(p.revisions)) for (const f of walk(p.revisions).filter((x) => !x.endsWith('.snapshot.json'))) add(path.join('project/revisions', path.basename(f)), f);

  const dna = exists(p.dna) ? readJson(p.dna) : null;
  const gates = (state?.gates || []).map((g) => ({ id: g.id, title: g.title, status: g.status, by: g.decision?.actor || null, role: g.decision?.role || null, simulated: g.decision?.simulated || false }));
  const notCovered = qa ? qa.targets.flatMap((t) => t.checks.filter((c) => ['blocked', 'warn'].includes(c.status)).map((c) => `${c.status.toUpperCase()} ${t.id}/${c.id}: ${c.summary}`)) : [];
  const manifest = {
    schemaVersion: '1.0.0',
    package: draft ? 'DRAFT: not approved for delivery' : 'final',
    project: { id: project.id, name: project.name, client: brief.client.name, fictionalClient: Boolean(brief.client.fictional) },
    generatedAt: nowIso(),
    generatedWith: `creative-intelligence-studio@${CIS_VERSION}`,
    dnaRevision: dna?.revision ?? null,
    deliverables: included,
    approvals: gates,
    quality: qa ? { verdict: qa.verdict, totals: qa.totals, manualAuditsOutstanding: qa.manualAuditsOutstanding } : null,
    creativeReview: review ? { reviewer: review.reviewer, independent: review.independent === true, reviewedAt: review.reviewedAt, recommendation: review.recommendation, findings: Object.fromEntries(['blocker', 'major', 'minor', 'note'].map((k) => [k, (review.findings || []).filter((f) => f.severity === k).length])) } : null,
    openIssues: [...blockers, ...reviewIssues, ...notCovered],
    assets: { registered: reg.count, files: reg.files },
    ledger: { events: led.count, intact: led.ok },
    files: entries.map((e) => ({ path: e.name, bytes: fs.statSync(e.file).size, sha256: sha256File(e.file) })).sort((a, b) => a.path.localeCompare(b.path)),
  };
  const simulated = gates.filter((g) => g.simulated).map((g) => g.id);
  const md = `# ${project.name}: delivery package${draft ? ' (DRAFT)' : ''}

Client: ${brief.client.name}${brief.client.fictional ? ' (fictional, demonstration project)' : ''}. Generated ${manifest.generatedAt} with creative-intelligence-studio ${CIS_VERSION}. Experience DNA revision ${manifest.dnaRevision}.

## Contents

${included.map((d) => `- \`deliverables/${d.id}/\`: ${d.title} (${d.files} files)`).join('\n')}
- \`evidence/\`: QA summary, security audit, licence list, SBOMs, consistency report
- \`project/\`: brief, Experience DNA and its history, plan and approvals, asset registry with provenance, event ledger, revisions
- \`delivery-manifest.json\`: every file with its size and SHA-256

## Approvals

| Gate | Status | Decided by |
|---|---|---|
${gates.map((g) => `| ${g.id}: ${g.title} | ${g.status} | ${g.by ? `${g.by} (${g.role})${g.simulated ? ' **simulated**' : ''}` : '-'} |`).join('\n')}
${simulated.length ? `\nGates marked simulated (${simulated.join(', ')}) were recorded by a demonstration script, not by a client. They are not real approvals.\n` : ''}
## Quality

${qa ? `Automated verdict: **${qa.verdict}** (${qa.totals.pass} pass, ${qa.totals.fail} fail, ${qa.totals.warn} warn, ${qa.totals.blocked} blocked). Automated checks are evidence, not client acceptance.` : 'No QA summary was available.'}

${review ? `Creative review by ${review.reviewer}${review.independent === true ? ' (independent)' : ''}: recommendation **${review.recommendation}**; ${manifest.creativeReview.findings.blocker} blocker, ${manifest.creativeReview.findings.major} major, ${manifest.creativeReview.findings.minor} minor finding(s). Full text in \`evidence/creative-review.json\`. A review is an evaluation, not an approval.` : 'No creative review has been recorded for this project.'}

### Open issues and things automation could not check

${manifest.openIssues.length ? manifest.openIssues.map((i) => `- ${i}`).join('\n') : '- None recorded.'}

### Still to be done by people

${(qa?.manualAuditsOutstanding || []).map((i) => `- ${i}`).join('\n')}

## Rights

Asset origins and licences are in \`project/asset-registry.json\`; third-party software is listed in \`evidence/licences.md\`. No trademark clearance has been performed for names or marks in this package.
`;
  const outDir = path.join(root, 'export');
  fs.mkdirSync(outDir, { recursive: true });
  writeJson(path.join(outDir, 'delivery-manifest.json'), manifest);
  writeFileAtomic(path.join(outDir, 'DELIVERY.md'), md);
  entries.push({ name: 'delivery-manifest.json', file: path.join(outDir, 'delivery-manifest.json') }, { name: 'DELIVERY.md', file: path.join(outDir, 'DELIVERY.md') });
  const zipName = `${slugify(project.id)}-${draft ? 'draft' : 'delivery'}-dna-r${manifest.dnaRevision}.zip`;
  const zipFile = path.join(outDir, zipName);
  const z = writeZip(zipFile, entries);
  // Read the archive back: the package is only reported once it is known to be complete.
  const listed = listZip(zipFile);
  if (listed.length !== entries.length) throw new CisError('E_EXPORT', `Archive verification failed: wrote ${entries.length} entries, read back ${listed.length}.`);
  appendEvent(root, { type: draft ? 'export.draft' : 'export.final', data: { file: `export/${zipName}`, files: z.files, bytes: z.bytes, sha256: sha256File(zipFile) } });
  if (json(flags, { ok: true, draft, file: `export/${zipName}`, files: z.files, bytes: z.bytes, sha256: sha256File(zipFile), openIssues: manifest.openIssues.length })) return;
  print(`${draft ? 'DRAFT package' : 'Delivery package'}: export/${zipName} (${z.files} files, ${fmtBytes(z.bytes)}), verified by reading it back.`);
  print(`Index: export/DELIVERY.md   Manifest: export/delivery-manifest.json   SHA-256: ${sha256File(zipFile)}`);
  if (manifest.openIssues.length) print(`${manifest.openIssues.length} open issue(s) are listed in DELIVERY.md.`);
  if (!draft) print('The client still has to accept it: creative-studio approve G7-acceptance --actor "<name>"');
}

export const commands = [
  { name: 'revise', group: 'Delivery', summary: 'Record, scope, verify and close client revision requests', run: revise, usage: `
creative-studio revise add --target <asset|dna|deliverable|direction>:<id> --feedback "..." --change <kind>
                           --by "<who asked>" [--preserve layout,typography,brand_colors,copy,motion,imagery,logo,structure,materials]
creative-studio revise list
creative-studio revise start <id>     snapshot every deliverable file and print the steps for this kind of change
creative-studio revise verify <id>    compare with the snapshot; fail if anything outside the request's scope changed
creative-studio revise close <id> --actor "<name>" [--decline]

Change kinds: ${Object.keys(SCOPE).join(', ')}` },
  { name: 'export', group: 'Delivery', summary: 'Build the hashed delivery package with evidence and provenance', run: exportCmd, usage: `
creative-studio export [--draft] [--with-evidence] [--json]

A final export requires a non-failing QA summary, human approval of gate
G6-quality, an intact ledger and no simulated or rights-unknown assets.
--draft produces a clearly marked review package that lists every blocker.
Writes export/<project>-...zip, DELIVERY.md and delivery-manifest.json.` },
];
