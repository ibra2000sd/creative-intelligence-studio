# Creative Intelligence Studio

A Claude Code plugin for creative engineering. One validated **Experience DNA** per project drives brand identity, a marketing website, a web application, a mobile app, generated imagery, motion and an interactive 3D scene, with human approval gates and evidence-backed QA.

- 17 skills, 2 agents, 1 hook and the `creative-studio` command (zero-dependency core).
- Optional engines (raster, browser QA, vector, 3D) are installed only when you run `creative-studio setup`.

## Install

```bash
claude plugin marketplace add <path-or-repo-of-this-marketplace>
claude plugin install creative-intelligence-studio@creative-intelligence-studio
```

In a session: `/plugin install creative-intelligence-studio --marketplace <owner>/<repo>`.

## Quick start

```bash
creative-studio doctor
creative-studio brief template > brief.json     # edit it
creative-studio init my-project --brief brief.json
cd my-project && creative-studio plan && creative-studio status
```

Or describe the project to Claude and let the `creative-studio` skill run it.

Full documentation, demos and tests live in the source repository (`docs/`).

## Honest limits

- Native iOS and Android builds are not produced by this plugin; it verifies JavaScript bundles, tests and a browser run of the same code.
- The built-in image engine draws procedural artwork. Model providers need your own key, the client's consent and a budget.
- Automated checks are evidence, not client approval. Gates are approved by named people.
- No trademark clearance is performed for generated names or marks.
