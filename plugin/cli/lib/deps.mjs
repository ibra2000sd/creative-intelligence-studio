// Optional capabilities. The CLI core has no dependencies; heavier engines
// (raster, browser QA, 3D, font outlining) load on demand and report a precise
// remedy when they are missing instead of failing with a stack trace.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { PLUGIN_ROOT, CisError, EXIT, readJson } from './util.mjs';

export const RUNTIME_MANIFEST = path.join(PLUGIN_ROOT, 'runtime', 'package.json');

/** Where `creative-studio setup` installs engines: plugin data dir, or a per-user fallback. */
export function runtimeDir() {
  return process.env.CIS_RUNTIME_DIR || (process.env.CLAUDE_PLUGIN_DATA ? path.join(process.env.CLAUDE_PLUGIN_DATA, 'runtime') : path.join(os.homedir(), '.creative-studio', 'runtime'));
}

function real(p) {
  try {
    return fs.realpathSync(p);
  } catch {
    return path.resolve(p);
  }
}

/**
 * Places an engine may be loaded from, each with the directory it must live
 * inside. Node's resolver walks up to every parent node_modules, which would
 * otherwise pick up an unpinned copy from the user's home directory.
 */
function bases() {
  const repo = path.dirname(PLUGIN_ROOT);
  let dev = false;
  try {
    dev = readJson(path.join(repo, 'package.json')).name === 'creative-intelligence-studio-repo';
  } catch {
    /* installed copy: no enclosing source repository */
  }
  return [
    { base: runtimeDir(), within: runtimeDir() },
    { base: PLUGIN_ROOT, within: dev ? repo : PLUGIN_ROOT },
    { base: process.cwd(), within: process.cwd() },
  ];
}

export const CAPABILITIES = {
  raster: { packages: ['sharp'], enables: 'PNG/WebP/AVIF export, image inspection, visual diff' },
  browser: { packages: ['playwright-core', 'axe-core'], enables: 'browser QA, screenshots, accessibility scans, PDF export' },
  vector: { packages: ['svgo', 'opentype.js'], enables: 'SVG optimisation and text-to-outline conversion' },
  model3d: { packages: ['@gltf-transform/core', '@gltf-transform/functions', '@gltf-transform/extensions', 'meshoptimizer', 'gltf-validator'], enables: 'GLB authoring, optimisation and validation' },
};

// Test seam: CIS_DISABLE_ENGINES=raster,browser makes those engines look uninstalled,
// so missing-dependency behaviour can be exercised without uninstalling anything.
function disabled(name) {
  const off = (process.env.CIS_DISABLE_ENGINES || '').split(',').filter(Boolean);
  return off.some((cap) => CAPABILITIES[cap]?.packages.some((p) => name === p || name.startsWith(p + '/')));
}

export function resolveDep(name) {
  if (disabled(name)) return null;
  for (const { base, within } of bases()) {
    try {
      const req = createRequire(path.join(base, 'noop.js'));
      const file = req.resolve(name);
      if (real(file).startsWith(real(within) + path.sep)) return { req, file, base };
    } catch {
      /* try the next base */
    }
  }
  return null;
}

export function depVersion(name) {
  const hit = resolveDep(name);
  if (!hit) return null;
  let dir = path.dirname(hit.file);
  for (let i = 0; i < 8; i++) {
    const pj = path.join(dir, 'package.json');
    if (fs.existsSync(pj)) {
      const j = readJson(pj);
      if (j.name === name) return j.version;
    }
    dir = path.dirname(dir);
  }
  return 'unknown';
}

export function hasCapability(cap) {
  return CAPABILITIES[cap].packages.every((p) => resolveDep(p));
}

/** Load an optional dependency or stop with a message that says exactly what to run. */
export function need(name, capability) {
  const hit = resolveDep(name);
  if (!hit) {
    const cap = capability || Object.keys(CAPABILITIES).find((c) => CAPABILITIES[c].packages.includes(name));
    throw new CisError(
      'E_MISSING_DEP',
      `This command needs "${name}"${cap ? ` (the "${cap}" capability: ${CAPABILITIES[cap].enables})` : ''}.\nInstall the engines once with:  creative-studio setup${cap ? ` --only ${cap}` : ''}`,
      { exit: EXIT.MISSING_DEP },
    );
  }
  const mod = hit.req(name);
  return mod && mod.__esModule && mod.default && Object.keys(mod).length === 1 ? mod.default : mod;
}

/** Locate a Chromium-family browser without downloading one. */
export function findChrome() {
  if (process.env.CIS_CHROME && fs.existsSync(process.env.CIS_CHROME)) return process.env.CIS_CHROME;
  const candidates = {
    darwin: [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      path.join(os.homedir(), 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
    ],
    linux: ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium', '/usr/bin/microsoft-edge'],
    win32: [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    ],
  }[process.platform] || [];
  return candidates.find((c) => fs.existsSync(c)) || null;
}
