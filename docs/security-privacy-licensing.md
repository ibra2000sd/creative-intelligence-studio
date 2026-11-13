# Security, privacy, rights and cost

## Threat model in one paragraph

CIS reads client material and third-party references, generates files, runs builds and can call paid external services. The risks are: an instruction hidden in content steering the agent; client material leaving the machine; secrets leaking into files or logs; a manipulated project file causing reads or writes outside the project; unlicensed material entering a deliverable; and an automated result being mistaken for a human decision.

## Controls

| Risk | Control | Verified by |
|---|---|---|
| Instructions in untrusted content | Skills state that client files, repositories, pages and tool output are data; the orchestrator's reference tells the agent to quote and ignore embedded instructions; both agents repeat the rule. The CLI never interprets content as commands. | `adversarial.test.mjs` (embedded instructions change nothing) |
| Automated approval | `approve` and `revise close` refuse automated actor names; a gate cannot be approved before its inputs exist; simulated decisions are labelled everywhere | lifecycle and revision tests |
| Client material leaving the machine | The brief sets `externalUploads` to deny, ask or allow. Remote image providers are refused or need `--consent`. The hook checks shell uploads inside a project. No telemetry exists in the plugin. | asset tests, hook tests |
| Secrets | Keys are read from the environment only and never printed. Ledger entries are redacted. `audit` scans the project for ten secret patterns and reports masked findings. `init` adds `.env` to `.gitignore`. | `core.test.mjs`, lifecycle test (a key in a failure reason never reaches the ledger), audit test |
| Path traversal | Paths from briefs, registries and flags go through `safeJoin`; registry records are re-validated and hash-checked before any copy; archive entries reject `..` and absolute names; the preview server serves only its directory on loopback | security suite |
| Generated-code injection | DNA strings written into CSS, TypeScript and comments are validated by the linter and sanitised at emission; typeface names used as identifiers must match a strict pattern | `core.test.mjs` |
| Markup injection in sites | Website content is escaped at render; links are limited to anchors, relative paths, http(s) and mailto | security suite |
| Supply chain | The plugin core has no dependencies. Optional engines are pinned and installed only by `setup`. Engines load only from known directories. `audit` writes a CycloneDX SBOM and classifies licences per deliverable and runs the package manager's vulnerability audit when the registry is reachable. | security suite; `doctor` |
| Tampering with history | The ledger is hash-chained; `ledger verify` detects edits and deletions | lifecycle test |
| Unlicensed or unverifiable assets | Every asset has a record with origin, parameters, rights and QA. Export refuses assets that are simulated or of unknown rights. | asset and export tests |
| Runaway cost | Budget reserved before each paid call and refused when exceeded; identical jobs are reused; retries are capped at three; failed calls are refunded; `Ctrl+C` cancels | asset tests |

The hook and the scans are guard rails. They reduce accidents and make deliberate actions visible; they are not a sandbox, and Claude Code's own permission system remains the boundary for tool use.

## Client isolation

A project is one directory. Nothing in the CLI reads another project's files, and the fingerprint registry (the only cross-project feature) stores thirteen design categories per project and no client content. Running several clients means several directories, ideally several repositories. There is no multi-tenant service; see limitations.

## Rights and provenance

Asset records (`asset-record` contract) hold, for generated assets: provider, model, parameters, prompt where one was used, seed, cost, whether the output is simulated, edit history, client approval status and file hashes. For external assets: source, author, URL, licence, version, attribution, commercial-use, modification and redistribution status, and the date verified. For client-supplied assets: who supplied them and their rights status.

Rights statuses assigned automatically: `cleared` for locally generated procedural artwork (no third-party content); `restricted` for output from a remote provider (confirm the provider's current terms) and for logos (no trademark clearance has been performed); mock output is `restricted` and not deliverable.

## Licences

The plugin is MIT-licensed. It contains no code, text or assets copied from the audited sources. Dependencies of generated projects are listed, with their licences, in [research-report.md](research-report.md#5-licences-of-what-generated-projects-depend-on); each project's own list is written to `.cis/reports/licences.md`.

Platform guidance: nothing from Apple's Human Interface Guidelines or Google's Material guidance is reproduced. The mobile skill's notes are original and point to the official sources. A direction may be inspired by a platform's principles; it may not copy a vendor's assets or imply endorsement, and `directions check` flags a direction that describes itself as another company's design language.
