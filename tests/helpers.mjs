// Shared helpers for the repository test suites.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PLUGIN = path.join(REPO, 'plugin');
export const INPUTS = path.join(REPO, 'demos', 'haldora', 'inputs');
export const BIN = path.join(PLUGIN, 'bin', 'creative-studio');

/** Run the CLI. Returns {status, stdout, stderr, json}. */
export function cs(args, { cwd, env = {}, input } = {}) {
  const r = spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: 'utf8', input, env: { ...process.env, CIS_FIXED_TIME: '', ...env }, timeout: 180000 });
  let json = null;
  try {
    json = JSON.parse(r.stdout);
  } catch {
    /* not JSON output */
  }
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, json, out: `${r.stdout}\n${r.stderr}` };
}

export function tmpDir(prefix = 'cis-test-') {
  return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
}

export const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
export const writeJson = (f, v) => (fs.mkdirSync(path.dirname(f), { recursive: true }), fs.writeFileSync(f, JSON.stringify(v, null, 2)));
export const fixture = (name) => readJson(path.join(INPUTS, name));

/** A project initialised from the demo brief, optionally planned and with DNA, brand spec and tokens in place. */
export function project({ plan = true, dna = true, brief } = {}) {
  const dir = tmpDir();
  const b = brief || fixture('brief.json');
  writeJson(path.join(dir, 'brief.in.json'), b);
  const init = cs(['init', dir, '--brief', path.join(dir, 'brief.in.json')]);
  if (init.status !== 0) throw new Error(`init failed: ${init.out}`);
  if (plan) cs(['plan'], { cwd: dir });
  if (dna) {
    writeJson(path.join(dir, '.cis/dna/experience-dna.json'), fixture('experience-dna.json'));
    writeJson(path.join(dir, '.cis/brand-spec.json'), fixture('brand-spec.json'));
  }
  return dir;
}

/** Walk the gates a demo needs, marking every decision as simulated. */
export function approve(dir, gate) {
  return cs(['approve', gate, '--actor', 'Test Fixture Person', '--role', 'client', '--simulated'], { cwd: dir });
}
