#!/usr/bin/env node
// creative-studio: command-line interface of Creative Intelligence Studio.
import { CisError, EXIT, CIS_VERSION, print, redact, table } from './lib/util.mjs';

const MODULES = ['core', 'dna', 'brand', 'images', 'build', 'qa', 'delivery'];

export function parseArgs(argv) {
  const out = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') {
      out._.push(...argv.slice(i + 1));
      break;
    }
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq !== -1) {
        out.flags[a.slice(2, eq)] = a.slice(eq + 1);
      } else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
        out.flags[a.slice(2)] = argv[++i];
      } else {
        out.flags[a.slice(2)] = true;
      }
    } else {
      out._.push(a);
    }
  }
  return out;
}

async function loadCommands() {
  const commands = new Map();
  for (const m of MODULES) {
    const mod = await import(`./commands/${m}.mjs`);
    for (const c of mod.commands) commands.set(c.name, c);
  }
  return commands;
}

function help(commands, name) {
  if (name && commands.has(name)) {
    const c = commands.get(name);
    print(`creative-studio ${c.name}: ${c.summary}\n`);
    print(c.usage.trim());
    return;
  }
  print(`creative-studio ${CIS_VERSION}: creative engineering from one Experience DNA\n`);
  print('Usage: creative-studio <command> [subcommand] [--flags]\n');
  const groups = {};
  for (const c of commands.values()) (groups[c.group] ||= []).push([`  ${c.name}`, c.summary]);
  for (const [g, rows] of Object.entries(groups)) {
    print(`${g}:`);
    print(table(rows));
    print('');
  }
  print('Run `creative-studio help <command>` for flags and examples.');
  print('Exit codes: 0 ok, 1 failed, 2 usage error, 3 blocked by a gate or contract, 4 missing optional engine.');
}

export async function main(argv) {
  const commands = await loadCommands();
  const [name, ...rest] = argv;
  if (!name || name === 'help' || name === '--help' || name === '-h') {
    help(commands, rest[0]);
    return EXIT.OK;
  }
  if (name === '--version' || name === '-v' || name === 'version') {
    print(CIS_VERSION);
    return EXIT.OK;
  }
  const cmd = commands.get(name);
  if (!cmd) {
    const near = [...commands.keys()].filter((k) => k.startsWith(name[0])).join(', ');
    throw new CisError('E_USAGE', `Unknown command "${name}".${near ? ` Did you mean: ${near}?` : ''} Run \`creative-studio help\`.`, { exit: EXIT.USAGE });
  }
  const args = parseArgs(rest);
  if (args.flags.help) {
    help(commands, name);
    return EXIT.OK;
  }
  const code = await cmd.run(args);
  return typeof code === 'number' ? code : EXIT.OK;
}

const invokedDirectly = process.argv[1] && import.meta.url.endsWith(process.argv[1].split(/[\\/]/).pop());
if (invokedDirectly || process.env.CIS_CLI === '1') {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (err) => {
      if (err instanceof CisError) {
        if (process.argv.includes('--json')) process.stdout.write(JSON.stringify({ ok: false, code: err.code, message: redact(err.message), details: err.details }) + '\n');
        else process.stderr.write(`error [${err.code}]: ${redact(err.message)}\n`);
        process.exitCode = err.exit;
      } else {
        process.stderr.write(`unexpected error: ${redact(err?.stack || String(err))}\n`);
        process.exitCode = 1;
      }
    },
  );
}
