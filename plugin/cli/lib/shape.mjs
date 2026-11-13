// Text shaping with HarfBuzz, for scripts whose letters change form with their neighbours (Arabic).
// opentype.js maps characters to glyphs one by one, which leaves Arabic as disconnected isolated
// letters; HarfBuzz applies the font's joining and ligature rules. The result is outlines, so a
// composed headline renders the same everywhere and never depends on an installed font.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { CisError, EXIT } from './util.mjs';
import { resolveDep } from './deps.mjs';
import { resolveFontFile } from './fonts.mjs';

/** Unpack a WOFF 1.0 file into the plain font (SFNT) it wraps: HarfBuzz reads only the latter. */
export function woffToSfnt(buf) {
  if (buf.toString('ascii', 0, 4) !== 'wOFF') return buf; // already a plain font
  const flavor = buf.readUInt32BE(4);
  const numTables = buf.readUInt16BE(12);
  const tables = [];
  for (let i = 0; i < numTables; i++) {
    const at = 44 + i * 20;
    const tag = buf.toString('latin1', at, at + 4);
    const offset = buf.readUInt32BE(at + 4);
    const compLength = buf.readUInt32BE(at + 8);
    const origLength = buf.readUInt32BE(at + 12);
    const checksum = buf.readUInt32BE(at + 16);
    const raw = buf.subarray(offset, offset + compLength);
    const data = compLength < origLength ? zlib.inflateSync(raw) : raw;
    if (data.length !== origLength) throw new CisError('E_FONT', `WOFF table ${tag} has the wrong length after decompression.`);
    tables.push({ tag, checksum, data });
  }
  let pow = 1;
  let log = 0;
  while (pow * 2 <= numTables) {
    pow *= 2;
    log++;
  }
  const header = Buffer.alloc(12 + numTables * 16);
  header.writeUInt32BE(flavor, 0);
  header.writeUInt16BE(numTables, 4);
  header.writeUInt16BE(pow * 16, 6);
  header.writeUInt16BE(log, 8);
  header.writeUInt16BE(numTables * 16 - pow * 16, 10);
  const parts = [header];
  let offset = header.length;
  tables.forEach((t, i) => {
    const at = 12 + i * 16;
    header.write(t.tag, at, 4, 'latin1');
    header.writeUInt32BE(t.checksum, at + 4);
    header.writeUInt32BE(offset, at + 8);
    header.writeUInt32BE(t.data.length, at + 12);
    const pad = (4 - (t.data.length % 4)) % 4;
    parts.push(t.data, Buffer.alloc(pad));
    offset += t.data.length + pad;
  });
  return Buffer.concat(parts);
}

let hbPromise = null;
async function harfbuzz() {
  hbPromise ??= (async () => {
    // The package exports only its entry and its WebAssembly files, so locate it through the latter.
    const hit = resolveDep('harfbuzzjs/dist/harfbuzz.wasm');
    if (!hit) throw new CisError('E_MISSING_ENGINE', 'Shaping Arabic needs harfbuzzjs (part of the vector engine): run `creative-studio setup`.', { exit: EXIT.MISSING_DEP });
    return import(pathToFileURL(path.join(path.dirname(hit.file), 'index.mjs')).href);
  })();
  return hbPromise;
}

const fonts = new Map();
async function hbFont(spec, weight, subset) {
  const file = resolveFontFile(spec, weight, { subset });
  if (!file) throw new CisError('E_FONT', `Font files for "${spec.family}" (${spec.source}) were not found for weight ${weight}.`);
  if (fonts.has(file)) return fonts.get(file);
  const hb = await harfbuzz();
  const sfnt = woffToSfnt(fs.readFileSync(file));
  const face = new hb.Face(new hb.Blob(sfnt.buffer.slice(sfnt.byteOffset, sfnt.byteOffset + sfnt.byteLength)));
  const font = new hb.Font(face);
  const entry = { hb, font, upem: face.upem ?? face.getUpem?.() ?? 1000 };
  fonts.set(file, entry);
  return entry;
}

const f2 = (n) => Number(n.toFixed(2));

/**
 * Shape `text` and return it as filled SVG markup laid out from (x, y) on the baseline, with its
 * advance width. Glyphs come back from HarfBuzz in visual order, so right-to-left text is drawn
 * left to right as it should appear; `anchor: 'end'` aligns its right edge at x.
 */
export async function shapedText(spec, text, { weight = 400, size = 64, x = 0, y = 0, fill = '#000', anchor = 'start', subset = 'arabic' } = {}) {
  const { hb, font, upem } = await hbFont(spec, weight, subset);
  const buffer = new hb.Buffer();
  buffer.addText(text);
  buffer.guessSegmentProperties();
  hb.shape(font, buffer);
  const infos = buffer.getGlyphInfos();
  const positions = buffer.getGlyphPositions();
  const s = size / upem;
  let pen = 0;
  const glyphs = [];
  infos.forEach((g, i) => {
    const p = positions[i];
    const d = font.glyphToPath(g.codepoint);
    if (d) glyphs.push(`<path transform="translate(${f2(pen + (p.xOffset ?? p.x_offset ?? 0))} ${f2(-(p.yOffset ?? p.y_offset ?? 0))})" d="${d}"/>`);
    pen += p.xAdvance ?? p.x_advance ?? 0;
  });
  buffer.destroy?.();
  const width = pen * s;
  const left = anchor === 'end' ? x - width : anchor === 'middle' ? x - width / 2 : x;
  // Font units have y pointing up; SVG has it pointing down.
  return { markup: `<g fill="${fill}" transform="translate(${f2(left)} ${f2(y)}) scale(${f2(s * 1e4) / 1e4} ${-f2(s * 1e4) / 1e4})">${glyphs.join('')}</g>`, width };
}
