// Image provider adapters. One interface, several engines: the built-in
// procedural generator (offline, free), OpenAI's image API (network, paid),
// and a mock used by tests. Selection, cost and consent are enforced by the
// caller in assets.mjs; adapters only know how to talk to their engine.
import zlib from 'node:zlib';
import { CisError, rng, hexToRgb } from './util.mjs';
import { renderSvg } from './imagegen.mjs';

/** Prompt for model providers, assembled from the Experience DNA so every image shares one art direction. */
export function buildPrompt(job, dna) {
  const s = dna.color.semantic[job.scheme || dna.color.defaultScheme || 'light'];
  const lines = [
    job.prompt || job.purpose,
    `Art direction: ${dna.imagery.style}.`,
    `Composition: ${dna.imagery.composition}.`,
    dna.imagery.photography ? `Photography: ${dna.imagery.photography}.` : '',
    dna.materials.lighting ? `Lighting: ${dna.materials.lighting}.` : '',
    `Colour palette, use only these and tones between them: ${[s.bg, s.primary, s.accent, s.text].join(', ')}.`,
    `Mood: ${dna.direction.emotionalIntent}.`,
    'Do not render any text, letters, numbers, logos, watermarks or user-interface elements; typography is added afterwards as vector.',
    ...(dna.imagery.prohibited || []).map((p) => `Avoid: ${p}.`),
    ...dna.direction.prohibitedPatterns.map((p) => `Avoid: ${p}.`),
  ];
  return lines.filter(Boolean).join(' ');
}

const sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new CisError('E_CANCELLED', 'Generation cancelled.'));
    });
  });

// ----------------------------------------------------------------- local -----

const localProcedural = {
  id: 'local-procedural',
  kind: 'local',
  label: 'Built-in procedural engine',
  available: () => ({ ok: true }),
  capabilities: { generate: true, edit: false, referenceGuided: false, transparent: true, vector: true, exactDimensions: true, deterministic: true, maxEdge: 8192 },
  estimateCostUsd: () => 0,
  async generate(job, { dna, overlayMarkup }) {
    const r = renderSvg(job, dna, { overlayMarkup });
    return { svg: r.svg, model: 'cis-procedural-1', costUsd: 0, parameters: r.parameters, seed: r.seed, describe: r.describe, simulated: false };
  },
};

// ---------------------------------------------------------------- openai -----

const OPENAI_SIZES = [[1024, 1024], [1536, 1024], [1024, 1536]];
// Published per-image estimates for gpt-image-2 at 1024x1024, read from
// OpenAI's image-generation guide on 2026-11-12. Treated as estimates only.
const OPENAI_PRICE = { low: 0.006, medium: 0.053, high: 0.211 };

function openaiSize(job) {
  const ratio = job.width / job.height;
  return OPENAI_SIZES.map((s) => ({ s, d: Math.abs(Math.log(s[0] / s[1] / ratio)) })).sort((a, b) => a.d - b.d)[0].s;
}

const openai = {
  id: 'openai',
  kind: 'remote',
  label: 'OpenAI Images API',
  available: () => (process.env.OPENAI_API_KEY ? { ok: true } : { ok: false, reason: 'OPENAI_API_KEY is not set' }),
  capabilities: { generate: true, edit: true, referenceGuided: true, transparent: true, vector: false, exactDimensions: false, deterministic: false, maxEdge: 1536 },
  estimateCostUsd(job) {
    const [w, h] = openaiSize(job);
    return Number((OPENAI_PRICE[job.quality || 'medium'] * ((w * h) / (1024 * 1024))).toFixed(4));
  },
  async generate(job, { dna, signal, fetchImpl = fetch, maxAttempts = 3 }) {
    const base = process.env.CIS_OPENAI_BASE_URL || 'https://api.openai.com/v1';
    const model = process.env.CIS_OPENAI_IMAGE_MODEL || 'gpt-image-2';
    const [w, h] = openaiSize(job);
    const body = {
      model,
      prompt: buildPrompt(job, dna),
      size: `${w}x${h}`,
      quality: job.quality || 'medium',
      n: 1,
      output_format: 'png',
      ...(job.transparent ? { background: 'transparent' } : {}),
    };
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      let res;
      try {
        res = await fetchImpl(`${base}/images/generations`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
          body: JSON.stringify(body),
          signal,
        });
      } catch (e) {
        if (signal?.aborted) throw new CisError('E_CANCELLED', 'Generation cancelled.');
        lastError = new CisError('E_PROVIDER_NETWORK', `OpenAI request failed: ${e.message}`);
        if (attempt < maxAttempts) await sleep(400 * 2 ** (attempt - 1), signal);
        continue;
      }
      if (res.ok) {
        const data = await res.json();
        const b64 = data?.data?.[0]?.b64_json;
        if (!b64) throw new CisError('E_PROVIDER_RESPONSE', 'OpenAI returned no image data.');
        return { buffer: Buffer.from(b64, 'base64'), format: 'png', model, costUsd: this.estimateCostUsd(job), costIsEstimate: true, attempts: attempt, parameters: { ...body, prompt: undefined, requested: `${job.width}x${job.height}` }, prompt: body.prompt, simulated: false };
      }
      const text = (await res.text()).slice(0, 300);
      // 429 and 5xx are worth retrying; other 4xx are our fault or a policy refusal.
      if (res.status === 429 || res.status >= 500) {
        lastError = new CisError(res.status === 429 ? 'E_PROVIDER_RATE_LIMIT' : 'E_PROVIDER_UNAVAILABLE', `OpenAI responded ${res.status}: ${text}`);
        const retryAfter = Number(res.headers.get('retry-after'));
        if (attempt < maxAttempts) await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 20000) : 400 * 2 ** (attempt - 1), signal);
        continue;
      }
      throw new CisError(res.status === 401 || res.status === 403 ? 'E_PROVIDER_AUTH' : 'E_PROVIDER_REJECTED', `OpenAI responded ${res.status}: ${text}`);
    }
    throw lastError;
  },
};

// ------------------------------------------------------------------ mock -----

function crc32(buf) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

/** Minimal PNG encoder (truecolour, no dependencies) for the mock provider and tests. */
export function encodePng(width, height, pixel) {
  const rawRows = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    rawRows[y * (width * 3 + 1)] = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixel(x, y);
      rawRows.set([r, g, b], y * (width * 3 + 1) + 1 + x * 3);
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(rawRows)), chunk('IEND', Buffer.alloc(0))]);
}

const mock = {
  id: 'mock',
  kind: 'mock',
  label: 'Mock provider (tests only; output is marked simulated and cannot be exported)',
  available: () => ({ ok: true }),
  capabilities: { generate: true, edit: false, referenceGuided: false, transparent: false, vector: false, exactDimensions: true, deterministic: true, maxEdge: 4096 },
  estimateCostUsd: (job) => Number(process.env.CIS_MOCK_COST || 0.02) * (job.quality === 'high' ? 4 : 1),
  async generate(job, { dna }) {
    const mode = process.env.CIS_MOCK_MODE || 'ok';
    if (mode === 'fail') throw new CisError('E_PROVIDER_UNAVAILABLE', 'Mock provider is configured to fail.');
    const s = dna.color.semantic.light;
    const a = hexToRgb(s.bg);
    const b = hexToRgb(mode === 'off-brand' ? '#00ff00' : s.accent);
    const rand = rng(`${job.id}:${job.seed ?? 0}`);
    const tilt = rand();
    const w = mode === 'wrong-size' ? job.width + 8 : job.width;
    const buffer = encodePng(w, job.height, (x, y) => {
      if (mode === 'blank') return a;
      const t = Math.min(1, Math.max(0, (x / w) * (1 - tilt) + (y / job.height) * tilt));
      return a.map((v, i) => Math.round(v + (b[i] - v) * t));
    });
    return { buffer, format: 'png', model: 'mock-1', costUsd: this.estimateCostUsd(job), parameters: { mode, width: job.width, height: job.height }, prompt: buildPrompt(job, dna), simulated: true };
  },
};

const REGISTRY = { 'local-procedural': localProcedural, openai, mock };

export function listProviders() {
  return Object.values(REGISTRY).map((p) => ({ id: p.id, kind: p.kind, label: p.label, available: p.available(), capabilities: p.capabilities }));
}

export function getProvider(id) {
  const p = REGISTRY[id];
  if (!p) throw new CisError('E_PROVIDER_UNKNOWN', `Unknown provider "${id}". Known: ${Object.keys(REGISTRY).join(', ')}`);
  return p;
}

/** Register an additional adapter (extension point; see docs/extending.md). */
export function registerProvider(adapter) {
  for (const k of ['id', 'kind', 'available', 'capabilities', 'estimateCostUsd', 'generate']) {
    if (!(k in adapter)) throw new CisError('E_PROVIDER_CONTRACT', `Provider adapter is missing "${k}".`);
  }
  REGISTRY[adapter.id] = adapter;
}
