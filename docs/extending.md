# Extending, contributing, upgrading and releasing

## Adding an image provider

Implement the adapter contract and register it:

```js
import { registerProvider } from './plugin/cli/lib/providers.mjs';

registerProvider({
  id: 'my-provider',
  kind: 'remote',                       // 'local' | 'remote' | 'mock'
  label: 'My image service',
  available: () => (process.env.MY_KEY ? { ok: true } : { ok: false, reason: 'MY_KEY is not set' }),
  capabilities: { generate: true, edit: false, referenceGuided: false, transparent: false, vector: false, exactDimensions: false, deterministic: false, maxEdge: 2048 },
  estimateCostUsd: (job) => 0.04,
  async generate(job, { dna, signal }) {
    // return { buffer, format: 'png', model, costUsd, parameters, prompt }  or  { svg, model, costUsd: 0, parameters }
  },
});
```

`kind: 'remote'` automatically subjects the provider to the upload policy, consent and budget. Use `buildPrompt(job, dna)` so prompts carry the project's art direction and forbid rendered text. Test it the way `tests/integration/assets.test.mjs` tests the OpenAI adapter: against a local HTTP stand-in for success, rate limiting, outage and bad credentials. A provider that has only been tested against a stand-in must be described that way.

## Adding an image recipe or a logo motif

Add a function to `RECIPES` in `cli/lib/imagegen.mjs` (draw only with colours from `colors(dna, scheme)` and `mix`) or to `SYMBOLS` in `cli/lib/logo.mjs` (filled paths in a 64 by 64 box; return `body`, `holes`, `accent`). Add the name to the enum in the image-brief or brand-spec schema. The existing tests then check determinism, palette adherence and path validity for the new entry automatically.

## Adding a template or a framework

A template is a directory under `plugin/templates/` containing a real project that reads its design values from `src/dna/`. Add a branch to `website`, `mobile` or a new command in `cli/commands/build.mjs` that copies it and writes the generated files, add it to `DELIVERABLE_DIRS` in `cli/commands/dna.mjs` so the consistency check covers it, and to `TARGETS` in `cli/commands/qa.mjs` so `test` covers it. Ship `qa/flows.mjs` with it. Flutter, SwiftUI, Jetpack Compose, Next.js or React Three Fiber would be added this way; none is implemented today.

## Adding a skill

Create `plugin/skills/<name>/SKILL.md` with the ten sections the others have, keep it under 500 lines with detail in `references/`, and mention only commands that exist. `tests/unit/engines.test.mjs` checks all of that; add a route to `ROUTES` in `orchestrator.mjs` and an expectation to the routing test. Then `claude plugin validate ./plugin`.

## Changing a contract

Schemas carry a version in `$id` and a `schemaVersion` constant.

- Additive, optional fields: keep the version.
- Anything that would make an existing document invalid: bump the version, keep reading the old one, and write a migration (a function from old to new, with a test using a fixture of the old shape). No migration exists yet because no contract has had a breaking change.

## Upgrading and migration

- **The plugin.** `claude plugin update creative-intelligence-studio`. Project state is plain files with versioned contracts; an updated plugin reads existing projects. After upgrading, run `creative-studio doctor`, then in each active project `creative-studio dna check` and `creative-studio test project`.
- **Optional engines.** Versions are pinned in `plugin/runtime/package.json`. Change a pin deliberately, run the full suite, and note it in the changelog.
- **A deliverable's dependencies.** Each generated project has its own `package.json`. Upgrade there, run its tests and `creative-studio test <target>`, and compare against the visual baselines.
- **Templates.** `scaffold` never overwrites existing files. To take a template change into an existing project, diff the template against the project and apply it by hand, or re-scaffold into a branch with `--force` and review the diff.
- **Research-driven changes.** New libraries, providers or guidance are adopted only after a person has reviewed licence, security and compatibility. Nothing in the plugin fetches or replaces code on its own; `setup` is the only command that downloads, and only when run.

## Contributing

1. `pnpm install`, then `pnpm test` and `pnpm test:e2e` must pass before and after your change.
2. Keep `plugin/cli/lib` free of static third-party imports; load engines through `deps.mjs`.
3. Every new behaviour needs a test that fails without it. A new check in the QA harness needs a fixture in `tests/integration/qa.test.mjs` proving it catches the defect.
4. Do not weaken or delete a failing test to make a change pass. If the test is wrong, fix it and explain why in the commit.
5. Regenerate `docs/cli.md` with `node scripts/gen-cli-docs.mjs` after changing a command.
6. No material from third-party sources without a recorded licence review.

## Releasing and versioning

Semantic versioning on the plugin version (`plugin/.claude-plugin/plugin.json`, mirrored in the marketplace entry; a test checks they agree).

- **Patch:** fixes with no contract or command change.
- **Minor:** new commands, skills, recipes, providers, optional contract fields.
- **Major:** a breaking contract or command change, with a migration.

Release steps: update `CHANGELOG.md`; `pnpm test && pnpm test:e2e`; `node scripts/run-demo.mjs --full`; `claude plugin validate ./plugin && claude plugin validate .`; `node scripts/package-release.mjs` (writes `release/creative-intelligence-studio-<version>.zip` and its SHA-256); `claude plugin tag ./plugin` to create the git tag.
