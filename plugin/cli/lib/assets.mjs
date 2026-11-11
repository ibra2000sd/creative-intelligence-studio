// Asset registry, provenance, cost control and the image production pipeline:
// requirement -> policy -> cache -> provider -> inspect -> convert -> register.
import fs from 'node:fs';
import path from 'node:path';
import { CisError, EXIT, readJson, writeJson, writeFileAtomic, exists, sha256, sha256File, nowIso } from './util.mjs';
import { assertValid } from './schema.mjs';
import { paths, appendEvent, loadProject } from './project.mjs';
import { getProvider } from './providers.mjs';
import { hasCapability } from './deps.mjs';

// -------------------------------------------------------------- registry -----

export function loadRegistry(root) {
  const file = paths(root).registry;
  return exists(file) ? readJson(file) : { schemaVersion: '1.0.0', assets: [] };
}

export function fileEntry(root, abs, extra = {}) {
  return { path: path.relative(root, abs).split(path.sep).join('/'), sha256: sha256File(abs), bytes: fs.statSync(abs).size, ...extra };
}

/** Insert or replace a record. Replacing keeps the old record's history. */
export function registerAsset(root, record) {
  const reg = loadRegistry(root);
  const prev = reg.assets.find((a) => a.id === record.id);
  const next = { ...record, history: [...(prev?.history || []), ...(record.history || [])] };
  assertValid('asset-record', next, `Asset record "${record.id}"`);
  reg.assets = [...reg.assets.filter((a) => a.id !== record.id), next].sort((a, b) => a.id.localeCompare(b.id));
  writeJson(paths(root).registry, reg);
  return next;
}

/** Recompute hashes for every registered file and report anything missing or changed. */
export function verifyRegistry(root) {
  const reg = loadRegistry(root);
  const problems = [];
  for (const a of reg.assets) {
    assertValid('asset-record', a, `Asset record "${a.id}"`);
    for (const f of a.files) {
      const abs = path.join(root, f.path);
      if (!exists(abs)) problems.push({ asset: a.id, file: f.path, problem: 'missing' });
      else if (sha256File(abs) !== f.sha256) problems.push({ asset: a.id, file: f.path, problem: 'modified since registration' });
    }
    if (a.origin.type === 'generated' && a.origin.simulated) problems.push({ asset: a.id, file: a.files[0].path, problem: 'simulated output from a mock provider; not deliverable' });
    if (a.rights.status === 'unknown') problems.push({ asset: a.id, file: a.files[0].path, problem: 'rights unknown' });
  }
  return { count: reg.assets.length, files: reg.assets.reduce((n, a) => n + a.files.length, 0), problems };
}

// ------------------------------------------------------------------ cost -----

export function loadCost(root) {
  return readJson(paths(root).cost);
}

/** Reserve budget before a paid call. Throws when the project ceiling would be exceeded. */
export function reserveCost(root, { provider, jobId, estimateUsd }) {
  const cost = loadCost(root);
  if (estimateUsd <= 0) return cost;
  if (cost.spentUsd + estimateUsd > cost.budgetUsd + 1e-9) {
    throw new CisError(
      'E_BUDGET',
      `Budget stop: "${jobId}" on ${provider} is estimated at $${estimateUsd.toFixed(3)}, but only $${Math.max(0, cost.budgetUsd - cost.spentUsd).toFixed(3)} of the $${cost.budgetUsd.toFixed(2)} project budget remains. Raise constraints.budgetUsd in the brief (a client decision) or use the local engine.`,
      { exit: EXIT.BLOCKED },
    );
  }
  cost.spentUsd = Number((cost.spentUsd + estimateUsd).toFixed(4));
  cost.entries.push({ at: nowIso(), provider, jobId, usd: estimateUsd, kind: 'reserved' });
  writeJson(paths(root).cost, cost);
  return cost;
}

function refundCost(root, { provider, jobId, usd }) {
  const cost = loadCost(root);
  cost.spentUsd = Number(Math.max(0, cost.spentUsd - usd).toFixed(4));
  cost.entries.push({ at: nowIso(), provider, jobId, usd: -usd, kind: 'refund-failed-call' });
  writeJson(paths(root).cost, cost);
}

// -------------------------------------------------------------- pipeline -----

/** Policy gate for anything that leaves the machine or costs money. */
export function checkProviderPolicy(root, provider, { consent = false } = {}) {
  if (provider.kind === 'local') return;
  const project = loadProject(root);
  if (provider.kind === 'mock' && process.env.CIS_ALLOW_MOCK !== '1') {
    throw new CisError('E_PROVIDER_POLICY', 'The mock provider only runs when CIS_ALLOW_MOCK=1 (tests and benchmarks). Its output is marked simulated and cannot be exported.', { exit: EXIT.BLOCKED });
  }
  if (provider.kind !== 'remote') return;
  if (project.policy.externalUploads === 'deny') {
    throw new CisError('E_PROVIDER_POLICY', `This project's brief forbids sending material to external services (constraints.externalUploads = "deny"). "${provider.id}" is a remote provider. Use local-procedural, or have the client change the constraint.`, { exit: EXIT.BLOCKED });
  }
  if (project.policy.externalUploads === 'ask' && !consent) {
    throw new CisError('E_CONSENT', `"${provider.id}" sends prompts derived from the brief to a third party. This project requires consent per run: re-run with --consent after the client has agreed.`, { exit: EXIT.BLOCKED });
  }
  const avail = provider.available();
  if (!avail.ok) throw new CisError('E_PROVIDER_UNAVAILABLE', `Provider "${provider.id}" is not usable here: ${avail.reason}.`, { exit: EXIT.BLOCKED });
}

function cacheKey(job, providerId, dna) {
  return sha256(JSON.stringify({ job: { ...job, usedIn: undefined }, providerId, color: dna.color, imagery: dna.imagery, v: 2 })).slice(0, 24);
}

/**
 * Produce every job in an image brief. Returns one result per job with status
 * generated | cached | failed | cancelled; nothing is reported as produced
 * unless its files exist and passed inspection.
 */
export async function produce(root, brief, dna, { providerId, consent = false, signal, overlayFor, force = false, log = () => {} } = {}) {
  assertValid('image-brief', brief, 'Image brief');
  const provider = getProvider(providerId || brief.provider || 'local-procedural');
  checkProviderPolicy(root, provider, { consent });
  const canRaster = hasCapability('raster');
  const raster = canRaster ? await import('./raster.mjs') : null;
  const palette = Object.values(dna.color.palette).map((c) => c.hex);
  const outRoot = path.join(root, 'assets', 'generated');
  const cacheFile = path.join(paths(root).cache, 'image-jobs.json');
  const cache = exists(cacheFile) ? readJson(cacheFile) : {};
  const results = [];
  const seenHashes = new Map(loadRegistry(root).assets.flatMap((a) => (a.qa?.checks || []).filter((c) => c.id === 'dhash').map((c) => [c.detail, a.id])));

  for (const job of brief.jobs) {
    if (signal?.aborted) {
      results.push({ id: job.id, status: 'cancelled' });
      continue;
    }
    const needsRaster = job.formats.some((x) => x !== 'svg');
    if (needsRaster && !canRaster) {
      results.push({ id: job.id, status: 'failed', error: 'Raster formats need the raster engine. Run `creative-studio setup --only raster`, or request only "svg".' });
      continue;
    }
    if (job.formats.includes('svg') && !provider.capabilities.vector) {
      results.push({ id: job.id, status: 'failed', error: `Provider "${provider.id}" produces raster only; an SVG wrapping a bitmap would not be an editable vector. Remove "svg" from formats or use local-procedural.` });
      continue;
    }
    const key = cacheKey(job, provider.id, dna);
    const dir = path.join(outRoot, job.id);
    const cached = cache[job.id];
    if (!force && cached?.key === key && cached.files.every((f) => exists(path.join(root, f)))) {
      results.push({ id: job.id, status: 'cached', files: cached.files, costUsd: 0 });
      log(`  ${job.id}: reused (identical job, provider and DNA)`);
      continue;
    }
    const estimate = provider.estimateCostUsd(job);
    let reserved = false;
    try {
      reserveCost(root, { provider: provider.id, jobId: job.id, estimateUsd: estimate });
      reserved = estimate > 0;
      const overlayMarkup = job.overlay && overlayFor ? await overlayFor(job) : '';
      const out = await provider.generate(job, { dna, signal, overlayMarkup });
      fs.mkdirSync(dir, { recursive: true });
      const files = [];
      const checks = [];
      const base = `${job.id}-${job.width}x${job.height}`;
      let master; // buffer used for inspection

      if (out.svg) {
        if (job.formats.includes('svg')) {
          const f = path.join(dir, `${base}.svg`);
          writeFileAtomic(f, out.svg);
          files.push(fileEntry(root, f, { format: 'svg', width: job.width, height: job.height, role: 'source' }));
        }
        for (const fmt of job.formats.filter((x) => x !== 'svg')) {
          const buf = await raster.svgToRaster(out.svg, { width: job.width, height: job.height, format: fmt, transparent: Boolean(job.transparent), background: dna.color.semantic[job.scheme || dna.color.defaultScheme || 'light'].bg });
          const f = path.join(dir, `${base}.${fmt === 'jpeg' ? 'jpg' : fmt}`);
          writeFileAtomic(f, buf);
          files.push(fileEntry(root, f, { format: fmt, width: job.width, height: job.height, role: 'export' }));
          if (!master || fmt === 'png') master = buf;
        }
      } else {
        // Raster providers return one bitmap; fit it to the exact requirement, then derive formats.
        let src = out.buffer;
        const meta = await raster.metadata(src);
        if (meta.width !== job.width || meta.height !== job.height) {
          if (provider.capabilities.exactDimensions) {
            throw new CisError('E_ASSET_QA', `Provider returned ${meta.width}x${meta.height}; the job requires ${job.width}x${job.height}.`);
          }
          src = await raster.convert(src, { width: job.width, height: job.height, format: 'png', fit: 'cover' });
          checks.push({ id: 'cropped-to-requirement', pass: true, detail: `provider returned ${meta.width}x${meta.height}; cropped with attention-based focal point` });
        }
        for (const fmt of job.formats) {
          const buf = fmt === 'png' ? src : await raster.convert(src, { format: fmt });
          const f = path.join(dir, `${base}.${fmt === 'jpeg' ? 'jpg' : fmt}`);
          writeFileAtomic(f, buf);
          files.push(fileEntry(root, f, { format: fmt, width: job.width, height: job.height, role: fmt === 'png' ? 'source' : 'export' }));
        }
        master = src;
      }

      if (master) {
        const insp = await raster.inspect(master, { expect: { width: job.width, height: job.height, transparent: job.transparent }, palette: job.transparent && job.layer && job.layer !== 'all' ? [] : palette });
        checks.push(...insp.checks.map((c) => ({ id: c.id, pass: c.pass, detail: c.detail })));
        const twin = [...seenHashes.entries()].find(([h, id]) => id !== job.id && raster.hamming(h, insp.hash) <= 4);
        checks.push({ id: 'not-duplicate', pass: !twin, detail: twin ? `visually identical to "${twin[1]}"` : 'no near-identical asset registered' });
        checks.push({ id: 'dhash', pass: true, detail: insp.hash });
        seenHashes.set(insp.hash, job.id);
      }
      if (job.maxBytes) {
        for (const fe of files.filter((x) => x.role !== 'source')) checks.push({ id: `byte-budget:${fe.format}`, pass: fe.bytes <= job.maxBytes, detail: `${fe.bytes} bytes, budget ${job.maxBytes}` });
      }
      if (job.overlay) checks.push({ id: 'text-is-vector', pass: Boolean(out.svg), detail: out.svg ? 'headline and logo composited as outlined vector paths' : 'text composited onto raster output' });
      const pass = checks.every((c) => c.pass);
      const record = registerAsset(root, {
        schemaVersion: '1.0.0',
        id: job.id,
        kind: out.svg && job.formats.includes('svg') ? 'vector' : 'raster',
        purpose: job.purpose,
        dnaRevision: dna.revision,
        files,
        origin: { type: 'generated', provider: provider.id, model: out.model, parameters: JSON.parse(JSON.stringify(out.parameters || {})), ...(out.prompt ? { prompt: out.prompt } : {}), ...(out.seed !== undefined ? { seed: out.seed } : {}), costUsd: out.costUsd || 0, simulated: Boolean(out.simulated) },
        history: [{ at: nowIso(), action: 'generated', by: provider.id }],
        rights: out.simulated ? { status: 'restricted', notes: 'Mock output for testing; not for delivery.' } : provider.kind === 'local' ? { status: 'cleared', notes: 'Generated locally from project parameters; no third-party content.' } : { status: 'restricted', notes: `Generated by ${provider.id}; confirm the provider's current terms for commercial use before delivery.` },
        qa: { status: pass ? 'passed' : 'failed', checks },
        clientApproval: 'pending',
        usedIn: job.usedIn || [],
        createdAt: nowIso(),
      });
      appendEvent(root, { type: pass ? 'asset.generated' : 'asset.rejected', data: { id: job.id, provider: provider.id, files: files.length, failed: checks.filter((c) => !c.pass).map((c) => c.id) }, ...(out.costUsd ? { costUsd: out.costUsd } : {}) });
      if (pass) {
        cache[job.id] = { key, files: files.map((x) => x.path) };
        writeJson(cacheFile, cache);
      }
      results.push({ id: job.id, status: pass ? 'generated' : 'failed', files: files.map((x) => x.path), costUsd: out.costUsd || 0, checks, ...(pass ? {} : { error: `Inspection failed: ${checks.filter((c) => !c.pass).map((c) => `${c.id} (${c.detail})`).join('; ')}` }), record });
      log(`  ${job.id}: ${pass ? 'generated' : 'REJECTED'} ${files.length} file(s)${out.costUsd ? ` ($${out.costUsd})` : ''}`);
    } catch (e) {
      if (!(e instanceof CisError)) throw e;
      if (e.code === 'E_BUDGET') {
        results.push({ id: job.id, status: 'failed', error: e.message, blocked: 'budget' });
        log(`  ${job.id}: stopped by budget`);
        continue;
      }
      if (reserved) refundCost(root, { provider: provider.id, jobId: job.id, usd: estimate });
      appendEvent(root, { type: 'asset.failed', data: { id: job.id, provider: provider.id, code: e.code, message: e.message } });
      results.push({ id: job.id, status: e.code === 'E_CANCELLED' ? 'cancelled' : 'failed', error: e.message, code: e.code });
      log(`  ${job.id}: ${e.code === 'E_CANCELLED' ? 'cancelled' : 'FAILED'} (${e.code})`);
    }
  }
  return { provider: provider.id, results, cost: loadCost(root) };
}
