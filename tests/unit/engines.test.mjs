// Unit tests: logo geometry, image engine, providers, 3D geometry, archive
// writer, upload-guard hook, and the plugin's own skills and manifests.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { PLUGIN, REPO, fixture, tmpDir, writeJson, cs } from '../helpers.mjs';
import { buildSymbol, symbolMarkup, lockup, svgDoc, inspectSvg, symbolKinds } from '../../plugin/cli/lib/logo.mjs';
import { iconNames, iconSvg, ICON_PATHS } from '../../plugin/cli/lib/icons.mjs';
import { renderSvg, recipeNames } from '../../plugin/cli/lib/imagegen.mjs';
import { buildPrompt, encodePng, listProviders, getProvider, registerProvider } from '../../plugin/cli/lib/providers.mjs';
import { roundedBox, arcTube, sphere, checkGeometry, batteryParts, fallbackSvg } from '../../plugin/cli/lib/model3d.mjs';
import { writeZip, listZip, crc32 } from '../../plugin/cli/lib/zip.mjs';
import { looksLikeUpload } from '../../plugin/hooks/upload-guard.mjs';
import { nearPalette } from '../../plugin/cli/lib/util.mjs';

const dna = fixture('experience-dna.json');
const palette = Object.values(dna.color.palette).map((c) => c.hex);

// ------------------------------------------------------------------- logo ---

test('every symbol motif builds closed, finite paths', () => {
  for (const motif of symbolKinds()) {
    const s = buildSymbol({ kind: 'symbol', motif, params: {} });
    const d = [...s.body, ...s.holes, ...s.accent].join('');
    assert.ok(s.body.length >= 1 && s.description.length > 10, motif);
    assert.ok(!/NaN|Infinity|undefined/.test(d), `${motif} has finite coordinates`);
    assert.ok((d.match(/Z/g) || []).length >= s.body.length + s.holes.length, `${motif} subpaths are closed`);
  }
  assert.throws(() => buildSymbol({ kind: 'symbol', motif: 'nonsense' }), /Unknown symbol motif/);
  assert.throws(() => buildSymbol({ kind: 'monogram', letter: 'H' }), /needs an outlined letter/);
});

test('a one-colour mark is the same geometry with the accent cut out', () => {
  const s = buildSymbol({ kind: 'symbol', motif: 'arc', params: { sunAngle: 116 } });
  const colour = symbolMarkup(s, { primary: '#2a2d66', accent: '#e9a23b' });
  const mono = symbolMarkup(s, { primary: '#1c1b18', accent: '#1c1b18', mono: true });
  assert.equal((colour.match(/<path/g) || []).length, 2);
  assert.equal((mono.match(/<path/g) || []).length, 1, 'single compound path');
  assert.ok(mono.includes(s.accent[0]), 'accent shape is part of the compound path');
});

test('vector integrity checks catch what would make a logo non-editable or off-brand', () => {
  const s = buildSymbol({ kind: 'symbol', motif: 'arc', params: {} });
  const good = svgDoc({ w: 64, h: 64, title: 'Mark', body: symbolMarkup(s, { primary: '#2A2D66', accent: '#E9A23B' }) });
  assert.equal(inspectSvg(good, { allowedColors: palette }).pass, true);
  const failing = (svg, id, opts = {}) => assert.ok(inspectSvg(svg, { allowedColors: palette, ...opts }).checks.find((c) => c.id === id && !c.pass), id);
  failing(good.replace('</svg>', '<text x="0" y="10">Haldora</text></svg>'), 'no-live-text');
  failing(good.replace('</svg>', '<image href="data:image/png;base64,AAAA"/></svg>'), 'no-raster-image');
  failing(good.replace('</svg>', '<script>alert(1)</script></svg>'), 'no-script');
  failing(good.replace('</svg>', '<use href="https://example.com/x.svg#a"/></svg>'), 'no-external-reference');
  failing(good.replace('#2A2D66', '#FF00FF'), 'colours-from-dna');
  failing(good.replace('fill="#E9A23B"', 'fill="none" stroke="#E9A23B"'), 'fills-only');
  failing(good.replace(/ viewBox="[^"]+"/, ''), 'has-viewbox');
  // Compositions may blend two palette colours; logo masters may not.
  const blend = good.replace('#E9A23B', '#F0C88F');
  assert.equal(inspectSvg(blend, { allowedColors: palette }).pass, false);
  assert.equal(inspectSvg(blend, { allowedColors: palette, allowBlends: true }).pass, true);
});

test('lockups reserve clear space and stay inside their canvas', () => {
  const s = buildSymbol({ kind: 'symbol', motif: 'arc', params: {} });
  const word = { d: 'M0 0H100V-28H0Z', width: 100, capHeight: 28 };
  const h = lockup(s, word, { layout: 'horizontal', colors: { primary: '#000000', accent: '#111111', text: '#000000' }, clear: 0.5 });
  assert.equal(h.h, 64 + 64, 'half a symbol of clear space above and below');
  assert.ok(h.w > 64 + 100 + 64);
  const st = lockup(s, word, { layout: 'stacked', colors: { primary: '#000000', accent: '#111111', text: '#000000' }, clear: 0.5 });
  assert.ok(st.h > h.h && st.w < h.w);
});

test('the icon family is consistent and renders with the DNA stroke', () => {
  assert.ok(iconNames().length >= 24);
  for (const [name, paths] of Object.entries(ICON_PATHS)) {
    for (const d of paths) assert.match(d, /^M[\dMLHVACZ.\s-]+$/, `${name} uses only simple path commands`);
  }
  const svg = iconSvg('battery', { strokeWidth: 1.75 });
  assert.match(svg, /viewBox="0 0 24 24"/);
  assert.match(svg, /stroke-width="1.75"/);
  assert.throws(() => iconSvg('nope'));
});

// ----------------------------------------------------------- image engine ---

test('every recipe renders deterministically and only in brand colours', () => {
  for (const recipe of recipeNames()) {
    const job = { id: `t-${recipe}`, purpose: 'unit test', recipe, width: 640, height: 480, formats: ['svg'], seed: 5, variant: 'dusk' };
    const a = renderSvg(job, dna);
    const b = renderSvg(job, dna);
    assert.equal(a.svg, b.svg, `${recipe} is reproducible`);
    assert.notEqual(a.svg, renderSvg({ ...job, seed: 6 }, dna).svg, `${recipe} varies with the seed`);
    assert.match(a.svg, /viewBox="0 0 640 480"/);
    const colours = [...a.svg.matchAll(/(?:fill|stroke|stop-color)="(#[0-9a-fA-F]{6})"/g)].map((m) => m[1]);
    assert.ok(colours.length > 0, `${recipe} draws something`);
    const off = [...new Set(colours.filter((c) => !nearPalette(c, palette, 0.06)))];
    assert.deepEqual(off, [], `${recipe} uses palette colours or blends of two`);
  }
  assert.throws(() => renderSvg({ id: 'x', recipe: 'unknown', width: 10, height: 10 }, dna), /Unknown recipe/);
});

test('parallax layers of one scene share geometry', () => {
  const base = { id: 'hero', purpose: 'x', recipe: 'horizon-field', variant: 'noon', seed: 'hero', width: 1200, height: 750, formats: ['svg'] };
  const all = renderSvg({ ...base, layer: 'all' }, dna).svg;
  for (const layer of ['far', 'mid', 'near']) {
    const d = /<path d="([^"]+)" fill/.exec(renderSvg({ ...base, layer }, dna).svg)[1];
    assert.ok(all.includes(d), `${layer} ridge is identical in the composed image`);
  }
  assert.ok(!renderSvg({ ...base, layer: 'far' }, dna).svg.includes('url(#sky)'), 'a single layer has no sky fill');
});

test('provider prompts carry the art direction and forbid rendered text', () => {
  const p = buildPrompt({ purpose: 'Hero image', scheme: 'light' }, dna);
  assert.ok(p.includes(dna.imagery.style) && p.includes(dna.color.semantic.light.accent));
  assert.match(p, /Do not render any text/);
  for (const banned of dna.direction.prohibitedPatterns) assert.ok(p.includes(`Avoid: ${banned}`));
});

test('provider registry: capabilities, availability and the adapter contract', () => {
  const list = listProviders();
  const local = list.find((p) => p.id === 'local-procedural');
  assert.ok(local.available.ok && local.capabilities.vector && local.capabilities.deterministic);
  assert.equal(getProvider('local-procedural').estimateCostUsd({}), 0);
  assert.ok(getProvider('openai').estimateCostUsd({ width: 1024, height: 1024, quality: 'low' }) > 0);
  assert.throws(() => getProvider('nope'), /Unknown provider/);
  assert.throws(() => registerProvider({ id: 'half' }), /missing/);
  const png = encodePng(4, 3, () => [10, 20, 30]);
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(png.readUInt32BE(16), 4);
  assert.equal(png.readUInt32BE(20), 3);
});

// ---------------------------------------------------------------- 3D model ---

test('procedural geometry is well formed: finite, unit normals, outward facing', () => {
  for (const [name, g] of [['box', roundedBox(0.6, 1, 0.16, 0.045, 7)], ['flat', roundedBox(0.5, 0.8, 0.012, 0.03, 5)], ['tube', arcTube(0.17, 0.008, 0, 180)], ['sphere', sphere(0.026)]]) {
    const r = checkGeometry(g, name);
    assert.deepEqual(r.problems, [], name);
    assert.ok(r.triangles > 100, `${name} has ${r.triangles} triangles`);
    assert.equal(g.positions.length / 3, g.uvs.length / 2);
  }
  const box = roundedBox(2, 1, 1, 0.1);
  const xs = box.positions.filter((_, i) => i % 3 === 0);
  assert.ok(Math.abs(Math.max(...xs) - 1) < 1e-6 && Math.abs(Math.min(...xs) + 1) < 1e-6, 'box fills its stated width');
  const flipped = roundedBox(1, 1, 1, 0.1);
  for (let i = 0; i < flipped.indices.length; i += 3) [flipped.indices[i], flipped.indices[i + 1]] = [flipped.indices[i + 1], flipped.indices[i]];
  assert.match(checkGeometry(flipped, 'flipped').problems.join(), /face inward/);
});

test('the product model has the named parts the scene depends on', () => {
  const { parts, dims } = batteryParts();
  for (const n of ['Body', 'Fascia', 'ArcLight', 'Sun']) assert.ok(parts.some((p) => p.name === n), n);
  assert.ok(dims.arcR > 0 && dims.W < dims.H);
  const svg = fallbackSvg(dna, dna.materials3d.finishes[1]);
  assert.match(svg, /<title>.*Dusk finish/);
  assert.ok(svg.includes(dna.materials3d.finishes[1].baseColor));
});

// -------------------------------------------------------------------- zip ---

test('archives round-trip and refuse unsafe paths', () => {
  assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926);
  const dir = tmpDir();
  fs.writeFileSync(path.join(dir, 'a.txt'), 'hello '.repeat(500));
  const zip = path.join(dir, 'out.zip');
  const res = writeZip(zip, [{ name: 'docs/a.txt', file: path.join(dir, 'a.txt') }, { name: 'مرحبا.txt', data: Buffer.from('arabic name') }]);
  assert.equal(res.files, 2);
  const listed = listZip(zip);
  assert.deepEqual(listed.map((e) => e.name).sort(), ['docs/a.txt', 'مرحبا.txt']);
  assert.equal(listed.find((e) => e.name === 'docs/a.txt').size, 3000);
  assert.ok(res.bytes < 1000, 'text is deflated');
  const unzip = spawnSync('unzip', ['-tq', zip], { encoding: 'utf8' });
  if (unzip.error === undefined) assert.equal(unzip.status, 0, `system unzip accepts the archive: ${unzip.stdout}${unzip.stderr}`);
  assert.throws(() => writeZip(zip, [{ name: '../evil.txt', data: Buffer.from('x') }]), /Unsafe archive path/);
  assert.throws(() => writeZip(zip, [{ name: '/abs.txt', data: Buffer.from('x') }]), /Unsafe archive path/);
});

// ------------------------------------------------------------------- hook ---

test('the upload guard recognises uploads and leaves ordinary commands alone', () => {
  const uploads = ['curl -F "file=@brief.pdf" https://api.example.com/upload', 'curl --upload-file logo.svg https://files.example.com/', 'curl -X POST --data-binary @.cis/brief.json https://x.example/y', 'scp -r brand user@host.example:/srv/', 'rsync -av web/dist/ deploy@server.example:/var/www/', 'aws s3 cp export/pkg.zip s3://bucket/', 'gh gist create .cis/brief.json'];
  const fine = ['npm install', 'curl -s https://registry.npmjs.org/three', 'curl -F a=@x http://localhost:3000/upload', 'creative-studio test web', 'git status', 'node build.mjs', 'cat brief.json | head'];
  for (const c of uploads) assert.equal(looksLikeUpload(c), true, c);
  for (const c of fine) assert.equal(looksLikeUpload(c), false, c);
});

test('the hook denies or asks inside a project and is silent outside one', () => {
  const hook = path.join(PLUGIN, 'hooks', 'upload-guard.mjs');
  const run = (cwd, command) => spawnSync(process.execPath, [hook], { input: JSON.stringify({ tool_name: 'Bash', tool_input: { command }, cwd }), encoding: 'utf8' });
  const outside = run(tmpDir(), 'curl -F f=@a https://x.example/');
  assert.equal(outside.stdout, '');
  assert.equal(outside.status, 0);
  for (const [policy, decision] of [['deny', 'deny'], ['ask', 'ask']]) {
    const dir = tmpDir();
    writeJson(path.join(dir, '.cis/project.json'), { policy: { externalUploads: policy } });
    fs.mkdirSync(path.join(dir, 'web/src'), { recursive: true });
    const res = JSON.parse(run(path.join(dir, 'web/src'), 'curl -F f=@a https://x.example/').stdout);
    assert.equal(res.hookSpecificOutput.permissionDecision, decision);
    assert.equal(res.hookSpecificOutput.hookEventName, 'PreToolUse');
    assert.equal(run(dir, 'npm run build').stdout, '', 'ordinary commands pass untouched');
  }
  const allow = tmpDir();
  writeJson(path.join(allow, '.cis/project.json'), { policy: { externalUploads: 'allow' } });
  assert.equal(run(allow, 'curl -F f=@a https://x.example/').stdout, '');
  assert.equal(spawnSync(process.execPath, [hook], { input: 'not json', encoding: 'utf8' }).status, 0, 'malformed input never breaks the session');
});

// ------------------------------------------------------- plugin integrity ---

const REQUIRED_SECTIONS = ['## Purpose', '## When to use', '## Inputs', '## Workflow', '## Tools and dependencies', '## Output contract', '## Quality checks', '## Failure handling', '## Example', '## Tests'];

test('every skill is complete, within limits, and names only real commands and files', () => {
  const commands = new Set(cs(['help']).stdout.split('\n').map((l) => /^\s{2}(\S+)\s{2,}/.exec(l)?.[1]).filter(Boolean));
  assert.ok(commands.size >= 24, `${commands.size} commands registered`);
  const skillsDir = path.join(PLUGIN, 'skills');
  const skills = fs.readdirSync(skillsDir);
  assert.equal(skills.length, 17);
  for (const name of skills) {
    const file = path.join(skillsDir, name, 'SKILL.md');
    const text = fs.readFileSync(file, 'utf8');
    const fm = /^---\nname: (.+)\ndescription: (.+)\n---\n/.exec(text);
    assert.ok(fm, `${name} has frontmatter`);
    assert.equal(fm[1], name, 'name matches its directory');
    assert.match(name, /^[a-z0-9]+(-[a-z0-9]+)*$/);
    assert.ok(fm[2].length >= 80 && fm[2].length <= 1024, `${name} description length ${fm[2].length}`);
    assert.match(fm[2], /Use (when|at|before|after)/, `${name} description says when to use it`);
    assert.ok(text.split('\n').length < 500, `${name} is under 500 lines`);
    for (const s of REQUIRED_SECTIONS) assert.ok(text.includes(`\n${s}\n`), `${name} has "${s}"`);
    for (const m of text.matchAll(/`creative-studio ([a-z0-9]+)/g)) assert.ok(commands.has(m[1]), `${name} mentions real command "${m[1]}"`);
    for (const m of text.matchAll(/\]\((references\/[^)]+|\.\.\/[^)]+)\)/g)) assert.ok(fs.existsSync(path.join(skillsDir, name, m[1])), `${name} links to existing ${m[1]}`);
    for (const m of text.matchAll(/(?:tests|plugin)\/[\w./()-]+\.(?:mjs|ts|tsx)/g)) assert.ok(fs.existsSync(path.join(REPO, m[0])), `${name} cites existing test ${m[0]}`);
  }
});

test('manifests, agents and hooks are well formed', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(PLUGIN, '.claude-plugin/plugin.json'), 'utf8'));
  assert.equal(manifest.name, 'creative-intelligence-studio');
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  const market = JSON.parse(fs.readFileSync(path.join(REPO, '.claude-plugin/marketplace.json'), 'utf8'));
  assert.equal(market.plugins[0].source, './plugin');
  assert.equal(market.plugins[0].version, manifest.version);
  for (const agent of fs.readdirSync(path.join(PLUGIN, 'agents'))) {
    const text = fs.readFileSync(path.join(PLUGIN, 'agents', agent), 'utf8');
    assert.match(text, /^---\nname: [a-z-]+\ndescription: .{60,}\ntools: [A-Za-z, ]+\n---\n/, agent);
    assert.ok(!/\b(Write|Edit)\b/.test(/tools: (.*)/.exec(text)[1]), `${agent} is not given file-editing tools`);
  }
  const hooks = JSON.parse(fs.readFileSync(path.join(PLUGIN, 'hooks/hooks.json'), 'utf8'));
  assert.equal(hooks.hooks.PreToolUse[0].matcher, 'Bash');
  assert.ok(hooks.hooks.PreToolUse[0].hooks[0].command.includes('${CLAUDE_PLUGIN_ROOT}/hooks/upload-guard.mjs'));
  assert.ok(fs.statSync(path.join(PLUGIN, 'bin/creative-studio')).mode & 0o111, 'CLI launcher is executable');
  assert.ok(!fs.existsSync(path.join(PLUGIN, 'node_modules')), 'the plugin ships no vendored dependencies');
});

test('every command has help text and unknown input fails with a usage error', () => {
  const names = cs(['help']).stdout.split('\n').map((l) => /^\s{2}(\S+)\s{2,}/.exec(l)?.[1]).filter(Boolean);
  for (const n of names) {
    const h = cs(['help', n]);
    assert.equal(h.status, 0);
    assert.ok(h.stdout.includes(`creative-studio ${n}`), `${n} documents its usage`);
  }
  assert.equal(cs(['frobnicate']).status, 2);
  assert.equal(cs(['status'], { cwd: tmpDir() }).status, 2, 'no project is a usage error, not a crash');
  assert.match(cs(['--version']).stdout, /^\d+\.\d+\.\d+/);
});
