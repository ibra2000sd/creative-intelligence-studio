# Architecture

## What it is

Creative Intelligence Studio (CIS) is a Claude Code plugin plus a command-line engine. Claude supplies judgement (reading a brief, proposing directions, writing copy, adapting templates, reviewing). The engine supplies everything that must be exact and repeatable: contracts, state, generation, verification and packaging. Neither is trusted to do the other's job.

```
                         a person describes a project
                                     |
                         creative-studio skill (orchestrator)
                                     |
        +----------------------------+-----------------------------+
        |                            |                             |
  Project intelligence        Creative direction            Human gates
  intake, research            directions, Experience DNA    G0 G1 G2 G6 G7
        |                            |                             |
        +-------------+--------------+                             |
                      v                                            |
                Experience DNA  ----->  tokens.css / theme.ts / scene.json
                      |
   +---------+--------+---------+-----------+-----------+
   v         v        v         v           v           v
 brand    images   website   web app     mobile      3D scene        production skills
   |         |        |         |           |           |
   +---------+--------+----+----+-----------+-----------+
                           v
                 QA harness, audit, consistency, creative review        quality
                           v
                 revisions  ->  export (hashed package)                 delivery
```

## Layers and where they live

| Layer | In the repository | Notes |
|---|---|---|
| Orchestrator and specialists | `plugin/skills/*/SKILL.md` | 17 skills; references are loaded only when needed |
| Agents | `plugin/agents/` | `creative-reviewer` (independent critique), `source-auditor` (read-only audit of third-party material) |
| Hook | `plugin/hooks/` | Checks shell uploads against the project's policy, only inside a project |
| Contracts | `plugin/schemas/*.schema.json` | 15 versioned JSON Schemas |
| Engine | `plugin/cli/` | `main.mjs`, `commands/` (7 modules, 28 commands), `lib/` (zero-dependency core) |
| Templates | `plugin/templates/` | `web-marketing`, `web-app`, `mobile-expo`, `scene-3d` |
| Optional engines | `plugin/runtime/package.json` | Pinned versions, installed by `creative-studio setup` |

## The engine core

`plugin/cli/lib` has no runtime dependencies. It imports only Node built-ins; a test enforces this.

| Module | Responsibility |
|---|---|
| `schema.mjs` | JSON Schema validator (2020-12 subset). Unknown keywords are errors. Verdicts are cross-checked against Ajv in tests. |
| `project.mjs` | Project layout, advisory lock, hash-chained ledger, approvals, checkpoints |
| `orchestrator.mjs` | Classification, plan graph, handoff contracts, retries and escalation, recovery, request routing |
| `dna.mjs` | Semantic lint, token derivation, revisions and diff, fingerprint, cross-deliverable consistency |
| `motion.mjs` | Animate-or-not decision, runtime ladder, motion spec lint |
| `logo.mjs`, `icons.mjs`, `fonts.mjs` | Parametric marks from filled paths, icon family, text-to-outline |
| `imagegen.mjs`, `providers.mjs`, `assets.mjs` | Procedural recipes, provider adapters, the production pipeline with policy, budget, cache, inspection and provenance |
| `raster.mjs` | Rasterisation, inspection, perceptual hash, pixel diff (sharp, loaded on demand) |
| `model3d.mjs` | Procedural geometry, GLB authoring, optimisation, validation (glTF Transform, loaded on demand) |
| `qa.mjs`, `browser.mjs` | Browser harness on the installed Chrome (playwright-core, loaded on demand) |
| `security.mjs` | Secret, pattern and origin scans, SBOM, licence classes, vulnerability audit |
| `zip.mjs` | Archive writer and reader for delivery packages |
| `deps.mjs` | Optional engine resolution confined to known directories |

Optional engines are resolved from three places only: the plugin data directory (or `~/.creative-studio/runtime`), the plugin's own source repository during development, and the current project. Node's upward search through parent `node_modules` is rejected, because during development it silently loaded an unpinned Playwright from the user's home directory.

## Project state

A project is a directory containing `.cis/`:

```
.cis/
  project.json          id, client, policy (uploads, budget)
  brief.json            brief contract
  state.json            plan: tasks, dependencies, contracts, gates, decisions
  ledger.jsonl          append-only events, each carrying the previous entry's hash
  dna/experience-dna.json   current DNA;  dna/versions/rNNN.json  archive
  directions/           proposals and the selection
  brand-spec.json  image-brief.json  content-web.json  motion-spec.json  research.json
  assets/registry.json  asset records with files, hashes, origin, rights, QA
  cost.json             budget, spend, entries
  revisions/            requests, snapshots, resolutions
  reports/              QA summary, defects, security, licences, SBOMs, consistency, screenshots
  checkpoints/          snapshots for rollback
design-system/  brand/  assets/  web/  app/  mobile/  scene/  export/
```

Everything is plain files, so state can be inspected, diffed and committed. Writes are atomic (temporary file then rename) and serialised by a lock file.

## How a project stays coherent

1. One DNA. Engines read it and nothing else for colour, type, spacing and motion.
2. Generated files. Each deliverable has a `src/dna/` folder written by `scaffold` and `sync`. Templates reference tokens with neutral names (`--color-bg`, `--dur-base`), never brand names.
3. A consistency check. `creative-studio dna consistency` regenerates the tokens and compares bytes, then scans every deliverable's source for colours and typefaces outside the DNA.
4. Order. The plan makes the website wait for the brand, the images and the 3D build, because it embeds them.

## Resilience

- **Handoff contracts.** A task is done only when its declared outputs exist and validate.
- **Idempotence.** Completing a done task, re-running generation with unchanged jobs, and re-running the demo script are all no-ops or refreshes.
- **Recovery.** `task recover` reconciles state with the files on disk after an interruption.
- **Bounded retries.** Three failures of a task, or three failing runs of a QA check, escalate to a person.
- **Rollback.** `checkpoint create` and `restore` snapshot a deliverable; `revise start` snapshots the project.

## Extension points

Providers (`registerProvider`), image recipes, logo motifs, templates, schemas, skills and QA flows are all additive. See [extending.md](extending.md).

## What is deliberately not here

No server, database, multi-tenant service or web dashboard. A project is a directory; client isolation is separate directories and the upload policy. A hosted, multi-client service is a different product and is listed under limitations.
