#!/usr/bin/env node
// PreToolUse hook for Bash. It only acts inside a Creative Intelligence Studio
// project (a directory tree containing .cis/project.json); everywhere else it
// exits silently. It never blocks reading, building or testing: only commands
// that send local files to another host are checked against the brief's policy.
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

/** Does this command line upload a local file to a remote host? */
export function looksLikeUpload(command) {
  const c = String(command || '');
  const remote = /https?:\/\/(?!localhost|127\.0\.0\.1|\[::1\])/i.test(c);
  const curlUpload = /\bcurl\b/.test(c) && remote && /(?:\s-(?:[A-Za-z]*[FT])\b|--form\b|--upload-file\b|--data(?:-binary|-raw|-urlencode)?\s+['"]?@|\s-d\s+['"]?@)/.test(c);
  const wgetUpload = /\bwget\b/.test(c) && remote && /--post-file|--body-file/.test(c);
  const copyOut = /\b(?:scp|rsync|sftp)\b[^|;&]*\s[\w.-]+@?[\w.-]*:[^\s]/.test(c) && !/\b(?:scp|rsync)\b[^|;&]*\s(?:localhost|127\.0\.0\.1):/.test(c);
  const cloud = /\b(?:aws\s+s3\s+(?:cp|sync|mv)|gsutil\s+(?:cp|rsync)|az\s+storage\s+blob\s+upload|rclone\s+(?:copy|sync))\b/.test(c);
  const gist = /\bgh\s+gist\s+create\b/.test(c);
  return curlUpload || wgetUpload || copyOut || cloud || gist;
}

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
  if (!looksLikeUpload(input.tool_input?.command)) return;
  let policy = 'ask';
  try {
    policy = JSON.parse(fs.readFileSync(projectFile, 'utf8')).policy?.externalUploads || 'ask';
  } catch {
    /* unreadable project file: fall back to asking */
  }
  if (policy === 'allow') return;
  const reason =
    policy === 'deny'
      ? 'This Creative Intelligence Studio project forbids sending material to external services (brief constraints.externalUploads = "deny"), and this command appears to upload local files. Ask the client to change the constraint if the upload is needed.'
      : 'This command appears to upload local files from a Creative Intelligence Studio project whose brief requires consent for external uploads. Confirm that the client has agreed before allowing it.';
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: policy === 'deny' ? 'deny' : 'ask', permissionDecisionReason: reason } }));
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) main();
