# Installation and operations

## Prerequisites

| Need | Why | Check |
|---|---|---|
| Node.js 22 or newer | the engine and every template | `node -v` |
| Claude Code 2.1.275 or newer | to use the plugin's skills, agents and hook | `claude --version` |
| npm or pnpm | to install a deliverable's own dependencies | `npm -v` |
| Chrome, Chromium or Edge | browser QA, screenshots, PDF export | `creative-studio doctor` |
| about 1.5 GB free disk | dependencies of the web and mobile projects | `creative-studio doctor` |
| Optional: Xcode / Android SDK | native mobile builds | `creative-studio doctor` reports them as unavailable when absent |

## Install the plugin

From a checkout of this repository:

```bash
claude plugin validate ./plugin
claude plugin marketplace add /absolute/path/to/creative-intelligence-studio
claude plugin install creative-intelligence-studio@creative-intelligence-studio
claude plugin list
```

To try it for one session without installing: `claude --plugin-dir /absolute/path/to/creative-intelligence-studio/plugin`.

To remove it: `claude plugin uninstall creative-intelligence-studio` and `claude plugin marketplace remove creative-intelligence-studio`.

## Install the optional engines

The core works immediately (contracts, planning, DNA, tokens, vector image output, revisions, export). Four engines add the rest and are installed only when you ask:

```bash
creative-studio doctor                 # what is present, what is missing, what this machine cannot do
creative-studio setup --dry-run        # exact packages and versions that would be installed
creative-studio setup                  # all four
creative-studio setup --only raster,browser
```

| Engine | Packages (pinned in `plugin/runtime/package.json`) | Enables |
|---|---|---|
| raster | sharp | PNG, WebP and AVIF export; image inspection; visual diff |
| browser | playwright-core, axe-core | browser QA, screenshots, accessibility rules, PDF |
| vector | svgo, opentype.js, harfbuzzjs | SVG optimisation; outlining wordmarks and headlines; shaping Arabic headlines so their letters join |
| model3d | @gltf-transform/core, functions, extensions; meshoptimizer; gltf-validator | GLB authoring, optimisation, validation |

They are installed into the plugin's data directory (`CLAUDE_PLUGIN_DATA/runtime`), or `~/.creative-studio/runtime` outside Claude Code. No browser is downloaded: the installed Chrome is used.

## Configuration

| Setting | Where | Meaning |
|---|---|---|
| `constraints.externalUploads` | the brief | `deny`, `ask` or `allow` for anything leaving the machine |
| `constraints.budgetUsd` | the brief | ceiling for paid provider calls |
| `OPENAI_API_KEY` | environment | enables the OpenAI image provider (still subject to the two settings above) |
| `CIS_OPENAI_IMAGE_MODEL`, `CIS_OPENAI_BASE_URL` | environment | model id and API base for that provider |
| `CIS_CHROME` | environment | path to a Chromium binary if it is not in a standard location |
| `CIS_RUNTIME_DIR` | environment | where optional engines are installed and loaded from |
| `<deliverable>/qa/budgets.json` | project | a performance budget exception; must include a `rationale` |

Keys are read from the environment only. They are never written to a project file, a ledger or a log; `creative-studio doctor` reports only whether one is set.

## Working from the repository

```bash
pnpm install                 # engines and test tools for development
pnpm cs doctor               # the CLI
pnpm test                    # unit, integration and security suites
pnpm test:e2e                # reproduces the demonstration in a temporary directory
node scripts/run-demo.mjs            # light run of the Haldora demo
node scripts/run-demo.mjs --full     # also installs, builds, tests and audits each deliverable
node scripts/build-showcase.mjs      # rebuilds showcase/ from the demo's real outputs
```

## Troubleshooting

| Symptom | Cause and remedy |
|---|---|
| `error [E_MISSING_DEP]` (exit 4) | An optional engine is not installed. Run the `creative-studio setup --only <engine>` line the message prints. |
| `error [E_NO_BROWSER]` | No Chromium-family browser found. Install Chrome or set `CIS_CHROME`. |
| `error [E_BLOCKED]` or `E_GATE_NOT_READY` (exit 3) | A dependency task is not done or a gate has not been approved by a person. `creative-studio status` shows which. |
| `error [E_CONTRACT]` | `task done` was called before the task's outputs exist. The message lists what is missing. |
| `error [E_APPROVER]` | An automated name was given as approver. Use the name of the person who decided. |
| `error [E_CONSENT]` / `E_PROVIDER_POLICY` | A remote provider needs `--consent`, or the brief forbids external services. |
| `error [E_BUDGET]` | The estimate exceeds the remaining project budget. Raising it is the client's decision. |
| `error [E_FONT]` | The typeface package named in the DNA is not installed where the engine can find it. |
| `error [E_LOCKED]` | Another `creative-studio` process holds the project lock; a stale lock clears after 30 seconds. |
| A check reports `blocked` | It could not run here (no browser, no native toolchain, no registry access). It is not a pass. |
| Frame timing looks wrong | Headless Chrome needs a real GPU for meaningful timing; the harness requests Metal on macOS. Numbers are lab numbers. |
| Visual regression fails after an intended change | Look at the `.diff.png`, then accept with `creative-studio test <target> --update-baselines`. |
| Mobile Jest fails in `react-native-worklets` | Keep `jest.setup.js` and the `resolver` entry from the template: they select the packages' own mocks. |

## Upgrading

See [extending.md](extending.md#upgrading-and-migration).
