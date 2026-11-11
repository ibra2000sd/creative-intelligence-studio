// Static security, privacy and licensing checks over a project and its deliverables.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { walk, exists, readJson, findSecrets, nowIso } from './util.mjs';

const TEXT_EXT = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.json', '.html', '.css', '.md', '.txt', '.yml', '.yaml', '.env', '.sh', '.svg', '.toml', '']);
const IGNORE = ['node_modules', '.git', 'dist', 'dist-web', 'dist-native', '.expo', 'checkpoints', 'cache', 'coverage'];

export function scanSecrets(root) {
  const findings = [];
  let scanned = 0;
  for (const file of walk(root, { ignore: IGNORE })) {
    const base = path.basename(file);
    if (!TEXT_EXT.has(path.extname(file).toLowerCase()) && !base.startsWith('.env')) continue;
    if (/-lock\.(json|yaml)$|\.lock$/.test(base)) continue;
    const st = fs.statSync(file);
    if (st.size > 1_500_000) continue;
    scanned++;
    for (const hit of findSecrets(fs.readFileSync(file, 'utf8'))) findings.push({ file: path.relative(root, file), ...hit });
  }
  const envFiles = walk(root, { ignore: IGNORE }).filter((f) => /^\.env(\..+)?$/.test(path.basename(f)) && !/\.example$/.test(f)).map((f) => path.relative(root, f));
  return { scanned, findings, envFiles };
}

const UNSAFE = [
  ['html-injection', /\.(?:innerHTML|outerHTML)\s*=|insertAdjacentHTML\(|document\.write\(|dangerouslySetInnerHTML/, 'Markup built from strings; confirm every value is escaped or static.'],
  ['dynamic-code', /\beval\(|new Function\(|setTimeout\(\s*['"`]/, 'Dynamic code execution.'],
  ['blank-target', /target=["']_blank["'](?![^>]*rel=["'][^"']*noopener)/, 'target="_blank" without rel="noopener".'],
  ['insecure-url', /["'`]http:\/\/(?!localhost|127\.0\.0\.1|www\.w3\.org)/, 'Plain http:// URL.'],
  ['wildcard-postmessage', /postMessage\([^)]*,\s*['"]\*['"]\s*\)/, 'postMessage to any origin.'],
];

export function scanUnsafePatterns(root, dirs) {
  const findings = [];
  for (const d of dirs) {
    const base = path.join(root, d);
    if (!exists(base)) continue;
    for (const file of walk(base, { ignore: [...IGNORE, 'public', 'assets', 'qa', '__tests__'] })) {
      if (!['.js', '.mjs', '.ts', '.tsx', '.jsx', '.html'].includes(path.extname(file))) continue;
      fs.readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          for (const [id, rx, why] of UNSAFE) {
            // A reviewed line carries an explicit marker saying why it is safe.
            if (rx.test(line) && !/safe:/.test(line)) findings.push({ id, file: path.relative(root, file), line: i + 1, why });
          }
        });
    }
  }
  return findings;
}

/** Third-party origins referenced by built output: each is a request that leaves the visitor's page. */
export function scanExternalOrigins(distDir) {
  const origins = new Map();
  if (!exists(distDir)) return [];
  for (const file of walk(distDir)) {
    if (!['.html', '.css'].includes(path.extname(file))) continue;
    const text = fs.readFileSync(file, 'utf8');
    for (const m of text.matchAll(/(?:src|href|url\()\s*=?\s*["'(]?\s*(https?:)?\/\/([a-z0-9.-]+)/gi)) {
      if (/(^|\.)w3\.org$/.test(m[2])) continue;
      origins.set(m[2], (origins.get(m[2]) || 0) + 1);
    }
  }
  return [...origins.entries()].map(([host, count]) => ({ host, count }));
}

const PERMISSIVE = /^(MIT|ISC|0BSD|BSD-2-Clause|BSD-3-Clause|Apache-2\.0|CC0-1\.0|Unlicense|BlueOak-1\.0\.0|Python-2\.0|CC-BY-4\.0|OFL-1\.1|Zlib|WTFPL)$/;
const WEAK_COPYLEFT = /^(MPL-2\.0|LGPL-[23]\.[01](-only|-or-later)?|EPL-2\.0)$/;

function classify(license) {
  const l = String(license || '').replace(/[()]/g, '').trim();
  if (!l) return 'unknown';
  const parts = l.split(/\s+(?:OR|AND)\s+/);
  if (parts.every((p) => PERMISSIVE.test(p))) return 'permissive';
  if (parts.some((p) => PERMISSIVE.test(p)) && / OR /.test(l)) return 'permissive';
  if (parts.every((p) => PERMISSIVE.test(p) || WEAK_COPYLEFT.test(p))) return 'weak-copyleft';
  if (/GPL|AGPL|SSPL/.test(l)) return 'copyleft';
  return 'custom';
}

/** Software bill of materials from what is actually installed (production dependency tree). */
export function buildSbom(dir, name) {
  const pkgFile = path.join(dir, 'package.json');
  if (!exists(pkgFile)) return null;
  const pkg = readJson(pkgFile);
  const nm = path.join(dir, 'node_modules');
  if (!exists(nm)) return { name, installed: false, components: [], direct: Object.keys(pkg.dependencies || {}) };
  const seen = new Map();
  const queue = Object.keys(pkg.dependencies || {}).map((d) => ({ dep: d, from: dir, direct: true }));
  const resolveFrom = (dep, from) => {
    let cur = fs.realpathSync(from);
    for (;;) {
      const candidate = path.join(cur, 'node_modules', dep, 'package.json');
      if (exists(candidate)) return candidate;
      const parent = path.dirname(cur);
      if (parent === cur) return null;
      cur = parent;
    }
  };
  while (queue.length) {
    const { dep, from, direct } = queue.shift();
    const pj = resolveFrom(dep, from);
    if (!pj) continue;
    const real = fs.realpathSync(pj);
    if (seen.has(real)) {
      if (direct) seen.get(real).direct = true;
      continue;
    }
    const j = readJson(real);
    const license = typeof j.license === 'string' ? j.license : j.license?.type || (Array.isArray(j.licenses) ? j.licenses.map((l) => l.type).join(' OR ') : '');
    seen.set(real, { name: j.name, version: j.version, license, class: classify(license), direct, homepage: j.homepage || (typeof j.repository === 'string' ? j.repository : j.repository?.url) || '' });
    for (const d of Object.keys({ ...j.dependencies, ...j.optionalDependencies })) queue.push({ dep: d, from: path.dirname(real), direct: false });
  }
  const components = [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
  return { name, installed: true, components };
}

export function cycloneDx(sbom, projectName) {
  return {
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    version: 1,
    metadata: { timestamp: nowIso(), component: { type: 'application', name: `${projectName}/${sbom.name}` }, tools: [{ name: 'creative-studio audit' }] },
    components: sbom.components.map((c) => ({ type: 'library', name: c.name, version: c.version, purl: `pkg:npm/${c.name.replace('@', '%40')}@${c.version}`, licenses: c.license ? [{ license: PERMISSIVE.test(c.license) || WEAK_COPYLEFT.test(c.license) ? { id: c.license } : { name: c.license } }] : [], scope: c.direct ? 'required' : 'optional' })),
  };
}

/** Known-vulnerability audit through the package manager. Needs a lockfile and registry access. */
export function auditDependencies(dir) {
  const run = (cmd, args) => spawnSync(cmd, args, { cwd: dir, encoding: 'utf8', timeout: 90000 });
  let r;
  let tool;
  if (exists(path.join(dir, 'pnpm-lock.yaml'))) {
    tool = 'pnpm audit';
    r = run('pnpm', ['audit', '--prod', '--json', '--ignore-workspace']);
  } else if (exists(path.join(dir, 'package-lock.json'))) {
    tool = 'npm audit';
    r = run('npm', ['audit', '--omit=dev', '--json']);
  } else return { status: 'blocked', reason: 'No lockfile; run the package manager install first.' };
  try {
    const j = JSON.parse(r.stdout);
    const v = j.metadata?.vulnerabilities;
    if (!v) return { status: 'blocked', tool, reason: (j.error?.summary || j.message || 'Audit service returned no vulnerability data').slice(0, 200) };
    const advisories = Object.values(j.advisories || j.vulnerabilities || {}).slice(0, 12).map((a) => ({ name: a.module_name || a.name, severity: a.severity, title: a.title || (Array.isArray(a.via) ? a.via.map((x) => x.title || x).join('; ').slice(0, 120) : ''), range: a.vulnerable_versions || a.range }));
    return { status: 'ok', tool, counts: { info: v.info || 0, low: v.low || 0, moderate: v.moderate || 0, high: v.high || 0, critical: v.critical || 0 }, advisories };
  } catch {
    return { status: 'blocked', tool, reason: `Could not read ${tool} output (${(r.stderr || r.error?.message || 'no output').trim().split('\n')[0].slice(0, 160)}). Registry access may be unavailable.` };
  }
}
