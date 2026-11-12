# Handoff contracts

Every task in the plan names the files it must produce. `creative-studio task done` refuses to complete a task until they exist and, where a schema is named, validate.

| Task | Skill | Must produce |
|---|---|---|
| intake | intake-discovery | `.cis/brief.json` (brief) |
| research | research-evidence | `.cis/research.json` (research-log) |
| directions | art-direction | `.cis/directions/*.json`, `.cis/reports/directions.html` |
| dna | experience-dna | `.cis/dna/experience-dna.json` (experience-dna), `design-system/tokens.css` |
| motion-spec | motion-intelligence | `.cis/motion-spec.json` (motion-spec) |
| brand | brand-identity | `brand/logo/`, `brand/guidelines.html`, `brand/brand-manifest.json` |
| images | image-asset-factory | `assets/generated/`, `.cis/assets/registry.json` |
| scene-3d | 3d-experience | `scene/public/models/`, `scene/package.json` |
| website | web-experience | `web/package.json`, `web/src/content.json` (content-web) |
| web-app | web-application | `app/package.json` |
| mobile | mobile-experience | `mobile/package.json`, `mobile/app.json` |
| qa | quality-assurance | `.cis/reports/qa-summary.json` (qa-summary) |
| consistency | experience-dna | `.cis/reports/consistency.json` |
| creative-review | creative-review | `.cis/reports/creative-review.json` (creative-review) |
| export | delivery | `export/delivery-manifest.json` |

## Gates

| Gate | Decided by | Unlocks |
|---|---|---|
| G0-brief | client or account lead | directions |
| G1-direction | client | Experience DNA |
| G2-system | client or creative director | all production |
| G6-quality | creative director | export |
| G7-acceptance | client | project close |

`creative-studio approve` refuses actors named agent, claude, ai, bot, qa, cli, system or automated. `--simulated` exists only for demonstrations and benchmarks and is printed wherever the gate is shown.
