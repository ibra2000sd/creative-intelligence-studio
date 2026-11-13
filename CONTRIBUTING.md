# Contributing

Read [docs/extending.md](docs/extending.md): it covers adding providers, recipes, templates and skills, changing contracts, and the release process.

Before opening a change: `pnpm install`, `pnpm test`, `pnpm test:e2e`. All three suites must pass. New behaviour needs a test that fails without it. Do not weaken a failing test to land a change.
