#!/usr/bin/env node
// Reproduces the Haldora demonstration from its inputs, using the CLI exactly
// as a person or the orchestrator skill would. Safe to re-run: finished steps
// are skipped or refreshed.
//
//   node scripts/run-demo.mjs                 light run: everything that needs no npm install
//   node scripts/run-demo.mjs --full          also install, build, test and audit each deliverable
//   node scripts/run-demo.mjs --dir <path>    target directory (default demos/haldora/project)
//   node scripts/run-demo.mjs --refresh       overwrite template files in an existing run with the current templates
//
// Client decisions in this script are SIMULATED and recorded as such. The
// independent creative review and the final quality and acceptance gates are
// left open on purpose: the demo ends with a draft package, not a final one.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN = path.join(REPO, 'plugin', 'bin', 'creative-studio');
const INPUTS = path.join(REPO, 'demos', 'haldora', 'inputs');
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const opt = (n, d) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : d);
const DIR = path.resolve(opt('dir', path.join(REPO, 'demos', 'haldora', 'project')));
const FULL = flag('full');
const FORCE = flag('refresh') ? ['--force'] : [];
const CLIENT = 'Mira Solberg (fictional client)';
const log = [];

function cs(args, { allowFail = false, cwd = DIR } = {}) {
  const r = spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: 'utf8', timeout: 1800000 });
  const line = `creative-studio ${args.join(' ')}`;
  log.push({ command: line, exit: r.status });
  const tail = `${r.stdout}${r.stderr}`.trim().split('\n').slice(-3).join('\n    ');
  console.log(`  $ ${line}\n    ${tail}`);
  if (r.status !== 0 && !allowFail) {
    console.error(`\nDemo stopped: "${line}" exited ${r.status}.`);
    process.exit(1);
  }
  return r;
}

function sh(cmd, args, cwd) {
  console.log(`  $ (${path.relative(DIR, cwd) || '.'}) ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', timeout: 1800000, env: { ...process.env, CI: '1', EXPO_NO_TELEMETRY: '1' } });
  log.push({ command: `${cmd} ${args.join(' ')} [${path.relative(DIR, cwd)}]`, exit: r.status });
  if (r.status !== 0) {
    console.error(`${r.stdout}${r.stderr}`.trim().split('\n').slice(-25).join('\n'));
    console.error(`\nDemo stopped: ${cmd} ${args.join(' ')} exited ${r.status}.`);
    process.exit(1);
  }
}

const copy = (from, to) => (fs.mkdirSync(path.dirname(path.join(DIR, to)), { recursive: true }), fs.copyFileSync(path.join(INPUTS, from), path.join(DIR, to)));
const task = (id, work) => {
  console.log(`\n== ${id}`);
  cs(['task', 'start', id]);
  work?.();
  cs(['task', 'done', id]);
};
const approve = (gate, note) => cs(['approve', gate, '--actor', CLIENT, '--role', 'client', '--simulated', '--note', note]);
// pnpm when available (shared store, fast); npm otherwise. Each deliverable is a standalone project.
const hasPnpm = spawnSync('pnpm', ['--version'], { encoding: 'utf8' }).status === 0;
const install = (dir) => (hasPnpm ? sh('pnpm', ['install', '--ignore-workspace', '--reporter=silent'], dir) : sh('npm', ['install', '--no-audit', '--no-fund'], dir));

console.log(`Haldora demonstration -> ${DIR} (${FULL ? 'full' : 'light'} run)`);
fs.mkdirSync(DIR, { recursive: true });
if (!fs.existsSync(path.join(DIR, '.cis', 'project.json'))) cs(['init', DIR, '--brief', path.join(INPUTS, 'brief.json')], { cwd: REPO });
cs(['plan']);
cs(['task', 'recover']);

task('intake', () => cs(['brief', 'check']));
approve('G0-brief', 'Demonstration: brief confirmed.');

task('research', () => {
  if (fs.existsSync(path.join(DIR, '.cis', 'research.json'))) return;
  const add = (topic, kind, finding, extra) => cs(['research', 'add', '--topic', topic, '--kind', kind, '--finding', finding, ...extra]);
  add('accessibility', 'fact', 'WCAG 2.2 is a W3C Recommendation; SC 2.5.8 sets a minimum pointer target of 24 by 24 CSS pixels and SC 2.5.7 requires an alternative to dragging.', ['--source', 'https://www.w3.org/TR/WCAG22/', '--implication', 'Token target-min is 24px on the web and 44pt in the app; every drag has a tap alternative.']);
  add('technology', 'fact', 'Core Web Vitals good thresholds are LCP 2.5 s, INP 200 ms and CLS 0.1, assessed at the 75th percentile of field visits.', ['--source', 'https://web.dev/articles/vitals', '--implication', 'Lab runs use these as budgets and are never reported as field data.']);
  add('technology', 'fact', 'GSAP including ScrollTrigger is free for commercial use under a no-charge licence that is not open source and prohibits use in tools competing with Webflow visual animation building.', ['--source', 'https://gsap.com/community/standard-license/', '--implication', 'Installed from npm by the site, flagged by the audit for a human licence decision.']);
  add('technology', 'fact', 'Expo SDK 58 uses React Native 0.88 and React 19.3 and runs only on the New Architecture.', ['--source', 'https://docs.expo.dev/versions/latest/', '--implication', 'Mobile template targets SDK 58 with Reanimated 4 and Gesture Handler 3.']);
  add('audience', 'client-statement', 'Buyers are homeowners, not engineers; launch markets are the UK and the UAE.', []);
  add('competitor', 'inference', 'The category presents itself either as industrial equipment (dark dashboards) or as a gadget (white gloss).', ['--basis', 'Stated in the client brief as category conventions; no competitor audit was performed.']);
  cs(['research', 'check']);
});

task('directions', () => {
  for (const f of fs.readdirSync(path.join(INPUTS, 'directions'))) copy(`directions/${f}`, `.cis/directions/${f}`);
  cs(['directions', 'check']);
  cs(['directions', 'board']);
  cs(['directions', 'select', 'daylight-ledger', '--reason', 'Only this direction explains the product through the household day and differs from both category conventions.', '--actor', CLIENT]);
});
approve('G1-direction', 'Demonstration: Daylight Ledger chosen over Grid Instrument and Quiet Current.');

task('dna', () => {
  if (!fs.existsSync(path.join(DIR, '.cis/dna/experience-dna.json'))) copy('experience-dna.json', '.cis/dna/experience-dna.json');
  cs(['dna', 'check']);
  cs(['dna', 'tokens']);
});
approve('G2-system', 'Demonstration: Experience DNA accepted.');
cs(['dna', 'approve']);
cs(['dna', 'tokens']);

task('motion-spec', () => {
  copy('motion-spec.json', '.cis/motion-spec.json');
  cs(['motion', 'check']);
});

task('brand', () => {
  copy('brand-spec.json', '.cis/brand-spec.json');
  cs(['brand', 'build']);
  cs(['brand', 'check']);
});

task('images', () => {
  copy('image-brief.json', '.cis/image-brief.json');
  cs(['images', 'generate']);
  cs(['images', 'verify']);
});

task('scene-3d', () => {
  cs(['3d', 'build', ...FORCE]);
  if (FULL) {
    install(path.join(DIR, 'scene'));
    sh('npm', ['run', 'build'], path.join(DIR, 'scene'));
    // Replace the drawn fallbacks with stills rendered from the built model. Needs a browser with
    // WebGL; without one the drawn fallbacks stay and the command says so.
    cs(['3d', 'stills'], { allowFail: true });
  }
});

task('website', () => {
  copy('content-web.json', '.cis/content-web.json');
  cs(['website', 'scaffold', ...FORCE]);
  if (FULL) {
    install(path.join(DIR, 'web'));
    sh('npm', ['run', 'build'], path.join(DIR, 'web'));
  }
});

task('web-app', () => {
  cs(['website', 'scaffold', '--kind', 'app', ...FORCE]);
  if (FULL) {
    install(path.join(DIR, 'app'));
    sh('npm', ['test'], path.join(DIR, 'app'));
    sh('npm', ['run', 'build'], path.join(DIR, 'app'));
  }
});

task('mobile', () => {
  cs(['mobile', 'scaffold', ...FORCE]);
  if (FULL) install(path.join(DIR, 'mobile'));
});

console.log('\n== quality');
cs(['dna', 'consistency']);
if (FULL) {
  // A test or audit failure is a result to report, not a reason to hide the report.
  cs(['test', '--update-baselines'], { allowFail: true });
  cs(['audit'], { allowFail: true });
  cs(['task', 'start', 'qa'], { allowFail: true });
  cs(['task', 'done', 'qa'], { allowFail: true });
} else {
  cs(['test', 'project'], { allowFail: true });
  cs(['audit', '--offline'], { allowFail: true });
}
cs(['task', 'start', 'consistency'], { allowFail: true });
cs(['task', 'done', 'consistency'], { allowFail: true });

console.log('\n== delivery (draft: the independent creative review and gates G6 and G7 are left for people)');
cs(['export', '--draft']);
cs(['ledger', 'verify']);
cs(['status']);
fs.writeFileSync(path.join(DIR, '.cis', 'reports', 'demo-run.json'), JSON.stringify({ ranAt: new Date().toISOString(), mode: FULL ? 'full' : 'light', commands: log }, null, 2));
console.log(`\nDone. ${log.length} commands, ${log.filter((l) => l.exit !== 0).length} with a non-zero exit (reported above).`);
