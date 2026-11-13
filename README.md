# Creative Intelligence Studio

A Claude Code plugin and command-line engine for creative engineering. A project starts from a client brief and one validated **Experience DNA**; from that single source the system produces a brand identity, a marketing website, a web application, a mobile app, generated imagery, a motion specification and an interactive 3D scene, checks them with an automated QA harness, and packages them with their evidence. People approve the decisions that matter; the system refuses to approve them itself.

This repository contains the plugin, its tests, a complete demonstration for a fictional client, and the documentation.

## What is in the box

| | |
|---|---|
| Plugin | `plugin/`: 17 skills, 2 agents, 1 hook, the `creative-studio` CLI (28 commands, zero-dependency core), 13 JSON Schema contracts, 4 project templates |
| Demonstration | `demos/haldora/`: inputs, the generated project, and the log of the last full run |
| Showcase | `showcase/index.html`: a page built only from the demonstration's real outputs and reports |
| Tests | `tests/`: unit, integration, security, end-to-end and regression suites |
| Documentation | `docs/` in English, `docs/ar/` in Arabic |
| Release | `release/`: versioned plugin archive with checksum |

## Status at a glance

| Capability | Status |
|---|---|
| Plugin structure, skills, agents, hook | implemented; passes `claude plugin validate` |
| Orchestration, gates, ledger, recovery | implemented and tested |
| Experience DNA, tokens, consistency | implemented and tested |
| Brand identity (editable vector, exports, guidelines) | implemented and tested |
| Image production (local engine, inspection, provenance) | implemented and tested |
| Image production through a paid provider | implemented; verified with one live OpenAI generation (low quality, 1024 by 1024) on top of the stand-in tests. Edits, transparency and higher qualities are not exercised live |
| Marketing website with scroll-driven story | implemented and tested in a browser |
| Web application | implemented and tested in a browser |
| Mobile application | implemented; type check, unit tests, iOS and Android bundles and browser flows pass; **native builds blocked on this machine** |
| Interactive 3D scene and model pipeline | implemented and tested |
| QA harness, security audit, SBOM | implemented; the harness has its own tests |
| Revisions and export | implemented and tested |
| Independent creative review | performed six times by the plugin's reviewer agent (a model, not a person), with fixes between rounds: round 1 found 1 blocker and 13 major problems; rounds 3 to 6 found 7 or 8 major each, most of each previous list fixed. Every round recommended **revise**. See [docs/release-report.md](docs/release-report.md) |
| Final quality and acceptance gates | open: they need people |

The full account, including everything that did not pass, is in [docs/release-report.md](docs/release-report.md) and [docs/limitations.md](docs/limitations.md).

## Quick start

```bash
pnpm install                          # engines and test tools for development
pnpm cs doctor                        # what this machine can and cannot do
node scripts/run-demo.mjs             # reproduce the demonstration (light: no package installs)
node scripts/run-demo.mjs --full      # also install, build, test and audit every deliverable
pnpm test && pnpm test:e2e            # the system's own tests
```

Install the plugin into Claude Code:

```bash
claude plugin marketplace add "$(pwd)"
claude plugin install creative-intelligence-studio@creative-intelligence-studio
```

Then describe a project to Claude, or drive it yourself:

```bash
creative-studio brief template > brief.json
creative-studio init my-project --brief brief.json
cd my-project && creative-studio plan && creative-studio status
```

## Documentation

| Topic | Document |
|---|---|
| System overview, architecture, state, extension points | [docs/architecture.md](docs/architecture.md) |
| Installation, prerequisites, configuration, troubleshooting | [docs/installation.md](docs/installation.md) |
| Every command | [docs/cli.md](docs/cli.md) |
| Skills, agents, the hook, MCP | [docs/skills.md](docs/skills.md) |
| Experience DNA and design system specification | [docs/experience-dna.md](docs/experience-dna.md) |
| Brand, web, mobile, image, 3D and motion workflows | [docs/workflows.md](docs/workflows.md) |
| Quality assurance and automated testing | [docs/quality.md](docs/quality.md) |
| Security, privacy, rights, licences, cost control | [docs/security-privacy-licensing.md](docs/security-privacy-licensing.md) |
| Provider adapters, extension development, upgrades, contributing, releasing | [docs/extending.md](docs/extending.md) |
| Research, source audit, technology decisions, attribution | [docs/research-report.md](docs/research-report.md) |
| Limitations and unresolved issues | [docs/limitations.md](docs/limitations.md) |
| Release report and implementation ledger | [docs/release-report.md](docs/release-report.md), [docs/implementation-ledger.json](docs/implementation-ledger.json) |
| نظرة تنفيذية ودليل المستخدم | [docs/ar/overview.md](docs/ar/overview.md), [docs/ar/user-guide.md](docs/ar/user-guide.md) |

## Licence

MIT. See [LICENSE](LICENSE). Third-party packages used by generated projects keep their own licences; see the research report. Haldora is a fictional company; nothing in the demonstration describes a real product or customer.
