#!/usr/bin/env node
// PreToolUse hook for Bash. It only acts inside a Creative Intelligence Studio
// project (a directory tree containing .cis/project.json); everywhere else it
// exits silently. It never blocks reading, building or testing: only commands
// that send local files to another host are checked against the brief's policy.
//
// This is a guard rail, not a sandbox: a determined command can always be
// written to evade pattern matching. It exists to stop accidental uploads and
// to make deliberate ones visible.
import fs from 'node:fs';
import path from 'node:path';

function findProject(start) {
  let dir = path.resolve(start || process.cwd());
  for (;;) {
    const f = path.join(dir, '.cis', 'project.json');
    if (fs.existsSync(f)) return f;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0']);

/** Split a command line into tokens, honouring simple quoting. */
function tokens(command) {
  const out = [];
  const rx = /"((?:[^"\\]|\\.)*)"|'([^']*)'|([^\s;|&()<>]+)/g;
  let m;
  while ((m = rx.exec(command))) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

/** Hostname of a URL-like token, with or without a scheme; null if the token is not a host. */
function hostOf(token) {
  const t = token.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  if (t === token && !/^[\w-]+(\.[\w-]+)+(:\d+)?(\/|$)/.test(t) && !/^(localhost|\[::1\])(:\d+)?(\/|$)/i.test(t)) return null;
  const authority = t.split(/[/?#]/)[0];
  const hostPort = authority.includes('@') ? authority.slice(authority.lastIndexOf('@') + 1) : authority;
  const host = hostPort.startsWith('[') ? hostPort.slice(0, hostPort.indexOf(']') + 1) : hostPort.split(':')[0];
  return host.toLowerCase() || null;
}

const CURL_UPLOAD = /^(?:-[A-Za-z]*[FTd](?:@.*)?|--form(?:-string)?(?:=.*)?|--upload-file(?:=.*)?|--data(?:-binary|-raw|-urlencode|-ascii)?(?:=.*)?|--json(?:=.*)?)$/;

/**
 * Does this command line send local data to a host that is not this machine?
 * Returns true, false, or 'unclear' when an upload flag is present but no
 * destination could be identified.
 */
export function classifyUpload(command) {
  const c = String(command || '');
  const toks = tokens(c);
  const has = (name) => toks.some((t) => t === name || t.endsWith(`/${name}`));
  const hosts = toks.map(hostOf).filter(Boolean);
  const remote = hosts.some((h) => !LOCAL_HOSTS.has(h));

  if (has('curl')) {
    const sendsFile = toks.some((t, i) => {
      if (!CURL_UPLOAD.test(t)) return false;
      if (/^(?:-[A-Za-z]*T|--upload-file)/.test(t)) return true; // -T always uploads a file
      const value = t.includes('=') ? t.slice(t.indexOf('=') + 1) : /^-[A-Za-z]*[Fd]@/.test(t) ? t.slice(t.indexOf('@')) : toks[i + 1] || '';
      return value.includes('@'); // -F name=@file, -d @file, --json @file
    });
    if (sendsFile) return remote ? true : hosts.length ? false : 'unclear';
  }
  if (has('wget') && toks.some((t) => /^--(?:post-file|body-file)(?:=|$)/.test(t))) return remote ? true : hosts.length ? false : 'unclear';
  if (has('scp') || has('rsync') || has('sftp')) {
    // user@host:path or host:path as a destination or source
    const remoteSpec = toks.filter((t) => /^(?:[\w.-]+@)?[\w.-]+:[^/\\]?/.test(t) && !/^[A-Za-z]:\\/.test(t) && !/^\w+:\/\//.test(t));
    if (remoteSpec.some((t) => !LOCAL_HOSTS.has(t.split(':')[0].split('@').pop().toLowerCase()))) return true;
    if (hosts.length && remote) return true;
  }
  if (/\baws\s+s3\s+(?:cp|sync|mv)\b/.test(c) && /s3:\/\//.test(c)) return true;
  if (/\bgsutil\s+(?:cp|rsync)\b/.test(c) && /gs:\/\//.test(c)) return true;
  if (/\baz\s+storage\s+blob\s+upload/.test(c) || /\brclone\s+(?:copy|sync|move)\b/.test(c)) return true;
  if (/\bgh\s+gist\s+create\b/.test(c)) return true;
  return false;
}

export const looksLikeUpload = (command) => classifyUpload(command) !== false;

async function main() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    return; // not our business
  }
  if (input.tool_name !== 'Bash') return;
  const projectFile = findProject(input.cwd);
  if (!projectFile) return;
  const verdict = classifyUpload(input.tool_input?.command);
  if (verdict === false) return;
  let policy = 'ask';
  try {
    policy = JSON.parse(fs.readFileSync(projectFile, 'utf8')).policy?.externalUploads || 'ask';
  } catch {
    /* unreadable project file: fall back to asking */
  }
  if (policy === 'allow') return;
  // An upload whose destination cannot be identified is put to the person rather than refused outright.
  const decision = policy === 'deny' && verdict === true ? 'deny' : 'ask';
  const reason =
    decision === 'deny'
      ? 'This Creative Intelligence Studio project forbids sending material to external services (brief constraints.externalUploads = "deny"), and this command appears to upload local files. Ask the client to change the constraint if the upload is needed.'
      : `This command appears to upload local files from a Creative Intelligence Studio project whose brief ${policy === 'deny' ? 'forbids external uploads; the destination could not be identified' : 'requires consent for external uploads'}. Confirm that the client has agreed before allowing it.`;
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: decision, permissionDecisionReason: reason } }));
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) main();
