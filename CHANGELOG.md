# Changelog

All notable changes are recorded here. The project follows semantic versioning.

## 0.1.0 — 2026-11-13

First release.

### Added
- Claude Code plugin `creative-intelligence-studio`: 17 skills, 2 agents (`creative-reviewer`, `source-auditor`), 1 hook (upload guard).
- `creative-studio` CLI with 28 commands and a zero-dependency core; optional engines installed by `creative-studio setup`.
- 15 versioned JSON Schema contracts and a built-in validator.
- Orchestrator: classification, plan graph with handoff contracts and five approval gates, retries with escalation, recovery, hash-chained ledger, checkpoints.
- Experience DNA: semantic lint, tokens for web, React Native and 3D, revisions, fingerprint, cross-deliverable consistency.
- Brand engine, image engine with provider adapters (local procedural, OpenAI, mock), 3D asset pipeline.
- Templates: marketing website, web application, Expo mobile app, Three.js scene.
- QA harness, security and licence audit with SBOM, design-to-code comparison, revision management, export.
- Haldora demonstration, reproducible with `scripts/run-demo.mjs`.
- Test suites: unit, integration, security, end-to-end, regression.

### Known limitations
See `docs/limitations.md`.
