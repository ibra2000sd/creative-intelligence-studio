#!/usr/bin/env node
// Builds the versioned release archive of the plugin and writes its checksum.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { writeZip, listZip } from '../plugin/cli/lib/zip.mjs';
import { walk } from '../plugin/cli/lib/util.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const plugin = path.join(REPO, 'plugin');
const { name, version } = JSON.parse(fs.readFileSync(path.join(plugin, '.claude-plugin/plugin.json'), 'utf8'));
const out = path.join(REPO, 'release');
fs.mkdirSync(out, { recursive: true });
const files = walk(plugin).filter((f) => !/\.DS_Store$/.test(f));
// The archive is a self-contained marketplace: unzip it and `claude plugin marketplace add <folder>`.
// Its root holds the marketplace manifest, which points at ./plugin, beside the licence and notes.
const entries = files.map((f) => ({ name: `${name}/plugin/${path.relative(plugin, f).split(path.sep).join('/')}`, file: f }));
for (const extra of ['.claude-plugin/marketplace.json', 'CHANGELOG.md', 'LICENSE', 'README.md']) entries.push({ name: `${name}/${extra}`, file: path.join(REPO, extra) });
const zip = path.join(out, `${name}-${version}.zip`);
const res = writeZip(zip, entries.filter((e, i, a) => a.findIndex((x) => x.name === e.name) === i));
const listed = listZip(zip);
if (listed.length !== res.files) throw new Error('archive verification failed');
const sha = crypto.createHash('sha256').update(fs.readFileSync(zip)).digest('hex');
fs.writeFileSync(`${zip}.sha256`, `${sha}  ${path.basename(zip)}\n`);
fs.writeFileSync(path.join(out, 'release.json'), JSON.stringify({ name, version, builtAt: new Date().toISOString(), archive: path.basename(zip), bytes: res.bytes, files: res.files, sha256: sha, requires: { node: '>=22', claudeCode: '>=2.1.275' }, skills: fs.readdirSync(path.join(plugin, 'skills')).length, schemas: fs.readdirSync(path.join(plugin, 'schemas')).length }, null, 2) + '\n');
console.log(`${path.relative(REPO, zip)}: ${res.files} files, ${(res.bytes / 1024).toFixed(0)} KB, sha256 ${sha}`);
