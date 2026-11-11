// A small JSON Schema validator (2020-12 subset) with no dependencies, so the
// plugin validates contracts immediately after install. The supported keywords
// are exactly the ones our schemas use; an unknown keyword is a hard error
// rather than a silent pass. tests/unit/schema.test.mjs cross-checks verdicts
// against Ajv on every schema and fixture.
import fs from 'node:fs';
import path from 'node:path';
import { PLUGIN_ROOT, CisError, readJson } from './util.mjs';

const SCHEMA_DIR = path.join(PLUGIN_ROOT, 'schemas');
const cache = new Map();

const KNOWN = new Set([
  '$schema', '$id', '$ref', '$defs', '$comment', 'title', 'description', 'examples', 'default',
  'type', 'enum', 'const', 'properties', 'required', 'additionalProperties', 'patternProperties',
  'propertyNames', 'minProperties', 'maxProperties',
  'items', 'minItems', 'maxItems', 'uniqueItems', 'prefixItems',
  'minLength', 'maxLength', 'pattern', 'format',
  'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf',
  'allOf', 'anyOf', 'oneOf', 'not', 'if', 'then', 'else',
]);

const FORMATS = {
  'date-time': (s) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(s) && !Number.isNaN(Date.parse(s)),
  date: (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)),
  uri: (s) => {
    try {
      return /^[a-z][a-z0-9+.-]*:/i.test(s) && Boolean(new URL(s));
    } catch {
      return false;
    }
  },
};

export function schemaNames() {
  return fs
    .readdirSync(SCHEMA_DIR)
    .filter((f) => f.endsWith('.schema.json'))
    .map((f) => f.replace('.schema.json', ''))
    .sort();
}

export function loadSchema(name) {
  if (cache.has(name)) return cache.get(name);
  const file = path.join(SCHEMA_DIR, `${name}.schema.json`);
  if (!fs.existsSync(file)) throw new CisError('E_SCHEMA_UNKNOWN', `Unknown schema "${name}". Known: ${schemaNames().join(', ')}`);
  const schema = readJson(file);
  cache.set(name, schema);
  return schema;
}

function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
  return typeof v;
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => deepEqual(a[k], b[k]));
}

function resolveRef(root, ref) {
  if (!ref.startsWith('#/')) throw new CisError('E_SCHEMA', `Only local $ref is supported, got ${ref}`);
  let node = root;
  for (const part of ref.slice(2).split('/')) {
    node = node?.[part.replace(/~1/g, '/').replace(/~0/g, '~')];
  }
  if (node === undefined) throw new CisError('E_SCHEMA', `Unresolvable $ref ${ref}`);
  return node;
}

function check(schema, data, at, root, errors) {
  if (schema === true) return;
  if (schema === false) {
    errors.push({ path: at, message: 'is not allowed' });
    return;
  }
  for (const k of Object.keys(schema)) {
    if (!KNOWN.has(k)) throw new CisError('E_SCHEMA', `Unsupported schema keyword "${k}" at ${at || '/'}`);
  }
  if (schema.$ref) check(resolveRef(root, schema.$ref), data, at, root, errors);

  const t = typeOf(data);
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const ok = types.some((want) => want === t || (want === 'number' && t === 'integer'));
    if (!ok) {
      errors.push({ path: at, message: `must be ${types.join(' or ')}, got ${t}` });
      return; // further keyword errors on a wrong type are noise
    }
  }
  if (schema.enum && !schema.enum.some((e) => deepEqual(e, data))) {
    errors.push({ path: at, message: `must be one of ${schema.enum.map((e) => JSON.stringify(e)).join(', ')}` });
  }
  if ('const' in schema && !deepEqual(schema.const, data)) {
    errors.push({ path: at, message: `must equal ${JSON.stringify(schema.const)}` });
  }

  if (t === 'string') {
    const len = [...data].length;
    if (schema.minLength !== undefined && len < schema.minLength) errors.push({ path: at, message: `must have at least ${schema.minLength} characters` });
    if (schema.maxLength !== undefined && len > schema.maxLength) errors.push({ path: at, message: `must have at most ${schema.maxLength} characters` });
    if (schema.pattern && !new RegExp(schema.pattern, 'u').test(data)) errors.push({ path: at, message: `must match pattern ${schema.pattern}` });
    if (schema.format) {
      const f = FORMATS[schema.format];
      if (!f) throw new CisError('E_SCHEMA', `Unsupported format "${schema.format}"`);
      if (!f(data)) errors.push({ path: at, message: `must be a valid ${schema.format}` });
    }
  }

  if (t === 'number' || t === 'integer') {
    if (schema.minimum !== undefined && data < schema.minimum) errors.push({ path: at, message: `must be >= ${schema.minimum}` });
    if (schema.maximum !== undefined && data > schema.maximum) errors.push({ path: at, message: `must be <= ${schema.maximum}` });
    if (schema.exclusiveMinimum !== undefined && data <= schema.exclusiveMinimum) errors.push({ path: at, message: `must be > ${schema.exclusiveMinimum}` });
    if (schema.exclusiveMaximum !== undefined && data >= schema.exclusiveMaximum) errors.push({ path: at, message: `must be < ${schema.exclusiveMaximum}` });
    if (schema.multipleOf !== undefined && Math.abs(data / schema.multipleOf - Math.round(data / schema.multipleOf)) > 1e-9) {
      errors.push({ path: at, message: `must be a multiple of ${schema.multipleOf}` });
    }
  }

  if (t === 'array') {
    if (schema.minItems !== undefined && data.length < schema.minItems) errors.push({ path: at, message: `must have at least ${schema.minItems} items` });
    if (schema.maxItems !== undefined && data.length > schema.maxItems) errors.push({ path: at, message: `must have at most ${schema.maxItems} items` });
    if (schema.uniqueItems && data.some((v, i) => data.findIndex((w) => deepEqual(v, w)) !== i)) errors.push({ path: at, message: 'must not contain duplicate items' });
    const prefix = schema.prefixItems || [];
    data.forEach((item, i) => {
      if (i < prefix.length) check(prefix[i], item, `${at}/${i}`, root, errors);
      else if (schema.items !== undefined) check(schema.items, item, `${at}/${i}`, root, errors);
    });
  }

  if (t === 'object') {
    const keys = Object.keys(data);
    if (schema.minProperties !== undefined && keys.length < schema.minProperties) errors.push({ path: at, message: `must have at least ${schema.minProperties} properties` });
    if (schema.maxProperties !== undefined && keys.length > schema.maxProperties) errors.push({ path: at, message: `must have at most ${schema.maxProperties} properties` });
    for (const req of schema.required || []) {
      if (!(req in data)) errors.push({ path: `${at}/${req}`, message: 'is required' });
    }
    const props = schema.properties || {};
    const patterns = Object.entries(schema.patternProperties || {}).map(([p, s]) => [new RegExp(p, 'u'), s]);
    for (const key of keys) {
      const here = `${at}/${key}`;
      let matched = false;
      if (key in props) {
        matched = true;
        check(props[key], data[key], here, root, errors);
      }
      for (const [rx, sub] of patterns) {
        if (rx.test(key)) {
          matched = true;
          check(sub, data[key], here, root, errors);
        }
      }
      if (!matched && schema.additionalProperties !== undefined) {
        if (schema.additionalProperties === false) errors.push({ path: here, message: 'is not an allowed property' });
        else check(schema.additionalProperties, data[key], here, root, errors);
      }
      if (schema.propertyNames) check(schema.propertyNames, key, `${here} (name)`, root, errors);
    }
  }

  for (const sub of schema.allOf || []) check(sub, data, at, root, errors);
  if (schema.anyOf) {
    const pass = schema.anyOf.some((sub) => {
      const e = [];
      check(sub, data, at, root, e);
      return e.length === 0;
    });
    if (!pass) errors.push({ path: at, message: 'must match at least one allowed shape (anyOf)' });
  }
  if (schema.oneOf) {
    const n = schema.oneOf.filter((sub) => {
      const e = [];
      check(sub, data, at, root, e);
      return e.length === 0;
    }).length;
    if (n !== 1) errors.push({ path: at, message: `must match exactly one allowed shape (oneOf), matched ${n}` });
  }
  if (schema.not) {
    const e = [];
    check(schema.not, data, at, root, e);
    if (e.length === 0) errors.push({ path: at, message: 'must not match the excluded shape (not)' });
  }
  if (schema.if) {
    const e = [];
    check(schema.if, data, at, root, e);
    if (e.length === 0 && schema.then) check(schema.then, data, at, root, errors);
    if (e.length > 0 && schema.else) check(schema.else, data, at, root, errors);
  }
}

/** Validate data against a schema object or a schema name. Returns {valid, errors}. */
export function validate(schemaOrName, data) {
  const schema = typeof schemaOrName === 'string' ? loadSchema(schemaOrName) : schemaOrName;
  const errors = [];
  check(schema, data, '', schema, errors);
  return { valid: errors.length === 0, errors };
}

/** Validate and throw a readable error listing every violation. */
export function assertValid(schemaName, data, label = schemaName) {
  const { valid, errors } = validate(schemaName, data);
  if (!valid) {
    const lines = errors.slice(0, 25).map((e) => `  ${e.path || '/'} ${e.message}`);
    throw new CisError('E_SCHEMA_INVALID', `${label} does not satisfy the ${schemaName} contract:\n${lines.join('\n')}`, { details: errors });
  }
  return data;
}
