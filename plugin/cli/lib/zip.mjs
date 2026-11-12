// Minimal ZIP writer (deflate, UTF-8 names) so delivery packages need no
// external tool. Fixed timestamps make archives byte-reproducible.
import fs from 'node:fs';
import zlib from 'node:zlib';
import { CisError } from './util.mjs';

const TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// 1980-01-01 00:00:00 in DOS date/time format.
const DOS_TIME = 0;
const DOS_DATE = (0 << 9) | (1 << 5) | 1;

/** Write `entries` ([{name, file} | {name, data}]) to `outFile`. Names use forward slashes. */
export function writeZip(outFile, entries) {
  if (entries.length > 65535) throw new CisError('E_ZIP', 'Too many files for a single archive (limit 65,535).');
  const fd = fs.openSync(outFile, 'w');
  const central = [];
  let offset = 0;
  try {
    for (const e of [...entries].sort((a, b) => a.name.localeCompare(b.name))) {
      if (e.name.startsWith('/') || e.name.split('/').includes('..')) throw new CisError('E_ZIP', `Unsafe archive path: ${e.name}`);
      const data = e.data ?? fs.readFileSync(e.file);
      const name = Buffer.from(e.name, 'utf8');
      // Already-compressed formats are stored as is.
      const stored = /\.(png|jpe?g|webp|avif|woff2?|glb|hbc|zip|pdf)$/i.test(e.name);
      const body = stored ? data : zlib.deflateRawSync(data, { level: 9 });
      const method = stored || body.length >= data.length ? 0 : 8;
      const payload = method === 0 ? data : body;
      const crc = crc32(data);
      if (offset + payload.length > 0xfffffffe) throw new CisError('E_ZIP', 'Archive would exceed 4 GB.');
      const local = Buffer.alloc(30);
      local.writeUInt32LE(0x04034b50, 0);
      local.writeUInt16LE(20, 4);
      local.writeUInt16LE(0x0800, 6); // UTF-8 names
      local.writeUInt16LE(method, 8);
      local.writeUInt16LE(DOS_TIME, 10);
      local.writeUInt16LE(DOS_DATE, 12);
      local.writeUInt32LE(crc, 14);
      local.writeUInt32LE(payload.length, 18);
      local.writeUInt32LE(data.length, 22);
      local.writeUInt16LE(name.length, 26);
      fs.writeSync(fd, Buffer.concat([local, name, payload]));
      const cd = Buffer.alloc(46);
      cd.writeUInt32LE(0x02014b50, 0);
      cd.writeUInt16LE(20, 4);
      cd.writeUInt16LE(20, 6);
      cd.writeUInt16LE(0x0800, 8);
      cd.writeUInt16LE(method, 10);
      cd.writeUInt16LE(DOS_TIME, 12);
      cd.writeUInt16LE(DOS_DATE, 14);
      cd.writeUInt32LE(crc, 16);
      cd.writeUInt32LE(payload.length, 20);
      cd.writeUInt32LE(data.length, 24);
      cd.writeUInt16LE(name.length, 28);
      cd.writeUInt32LE(offset, 42);
      central.push(Buffer.concat([cd, name]));
      offset += 30 + name.length + payload.length;
    }
    const dir = Buffer.concat(central);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(central.length, 8);
    end.writeUInt16LE(central.length, 10);
    end.writeUInt32LE(dir.length, 12);
    end.writeUInt32LE(offset, 16);
    fs.writeSync(fd, Buffer.concat([dir, end]));
  } finally {
    fs.closeSync(fd);
  }
  return { files: central.length, bytes: fs.statSync(outFile).size };
}

/** Read back the central directory: used to verify an archive after writing it. */
export function listZip(file) {
  const buf = fs.readFileSync(file);
  const end = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (end < 0) throw new CisError('E_ZIP', 'Not a ZIP archive.');
  const count = buf.readUInt16LE(end + 10);
  let p = buf.readUInt32LE(end + 16);
  const out = [];
  for (let i = 0; i < count; i++) {
    const nameLen = buf.readUInt16LE(p + 28);
    out.push({ name: buf.toString('utf8', p + 46, p + 46 + nameLen), size: buf.readUInt32LE(p + 24), crc: buf.readUInt32LE(p + 16) });
    p += 46 + nameLen + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
  }
  return out;
}
