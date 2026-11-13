# Quality assurance and testing

Two different things are tested: **the deliverables** a project produces, and **the system itself**.

## 1. Testing deliverables: `creative-studio test`

The harness serves each built deliverable on loopback and drives the installed Chrome. For every page at 390, 768 and 1440 pixels wide:

| Check | What it looks for | Fails when |
|---|---|---|
| `load` | console errors, uncaught exceptions, failed requests, broken images | any |
| `layout` | horizontal overflow, clipped text | any |
| `rtl` | document direction on right-to-left pages | not `rtl` |
| `a11y-axe` | WCAG 2.0, 2.1 and 2.2 A and AA rules, in light and dark | a serious or critical violation. A rule axe cannot decide is a **warning** naming the rule |
| `keyboard` | every tab stop has a visible focus indicator and is not fully obscured | any stop fails |
| `target-size` | pointer targets of at least the DNA's minimum (24 CSS px by default) | any smaller |
| `reduced-motion` | with the preference set: no long animation, no hidden content, no scroll engine | any |
| `web-vitals-lab` | median of five spaced cold loads, phone viewport, 4x CPU throttle: LCP, CLS, blocking time | over budget **on reliable data**. If the host has more runnable work than cores, or identical loads disagree widely, an over-budget result is reported as an unreliable warning with the range, not as a failure. A slow first tap is a warning, because INP is a field metric |
| `scroll-motion` | frame intervals and layout shift while scrolling the whole page | more than 5% of frames over 50 ms, or layout shift over 0.1 |
| `dark-scheme` | a dark capture at phone and desktop size, compared with the light one | the project or the page offers a dark scheme and the two captures are identical |
| `visual-regression` | pixel difference from accepted baselines | more than 1.5% |
| `capture:*` | states declared in `qa/flows.mjs` (`export const captures`): a route, a story chapter, an app screen, a scheme or a language | the state cannot be reached, overflows, or differs from its baseline |
| `bundle` | gzip size of scripts and styles | warning over 300 KB or 60 KB |
| `flow:*` | the deliverable's own scripted tests in `qa/flows.mjs` | an assertion fails or the page throws |

Mobile adds a TypeScript check, Jest, production bundles for iOS and Android, and flows against a web export. The project target adds ledger integrity, DNA lint, consistency and the asset registry. `creative-studio audit` adds secrets, unsafe source patterns, third-party requests, licences, SBOMs and known vulnerabilities.

**Screenshots are evidence only if they show the screen.** Page captures are taken full-page after the harness has scrolled the page through once, so content that reveals or loads on scroll is present. A page capture still shows only the first state of a page. Everything else (each chapter of a scroll story, each route of an application, each screen of a mobile app, in dark and in Arabic) is a declared capture. This rule exists because an independent review found the first version of this harness reporting passes for pages whose captures were half blank and for an app evidenced by one onboarding screen; see the release report. Look at the files in `.cis/reports/qa/` before reporting: a doubled sun in the story passed every automated check.

**Statuses.** `pass`, `fail`, `warn`, `skipped` and `blocked`. A check that cannot run is `blocked` and the overall verdict becomes `incomplete`, never `pass`.

**Labels.** Every result says how it was measured: `lab` (this machine, headless), `static` (from files) or `manual-required`. Lab numbers are not field data.

**The repair loop.** Each run writes `defects.json`: every failing check with severity and the number of consecutive runs it has failed. Fixed defects are listed as fixed. A defect that fails three runs is marked `escalated` and is for a person to decide. Checkpoints provide rollback. A budget may be relaxed for one deliverable only through `qa/budgets.json` with a written reason, and is then reported as a warning.

**What automation cannot do.** A screen-reader walkthrough; real phones and a low-powered laptop; field web vitals; native builds and store review; review of copy by a fluent editor. These are printed in every summary.

## 2. Testing the system

```bash
pnpm test        # unit + integration + security
pnpm test:e2e    # end-to-end and regression
```

| Suite | File | What it proves |
|---|---|---|
| Unit: core | `tests/unit/core.test.mjs` | contracts accept the demo inputs and reject 13 targeted mutations; the built-in validator agrees with Ajv; path confinement; secret detection and redaction; colour maths; DNA lint catches 9 kinds of defect; tokens are deterministic and cannot be broken out of; plan is an acyclic graph with gates before production; request routing picks the right skill for 15 requests; the motion engine can say no; the runtime ladder |
| Unit: engines | `tests/unit/engines.test.mjs` | logo geometry and integrity checks; every image recipe is deterministic and on-palette; parallax layers share geometry; provider contract; procedural 3D geometry is well formed; archive round trip; the upload guard including bypass attempts; every skill is complete and cites only real commands and files; manifests, agents and hook |
| Integration: lifecycle | `tests/integration/project-flow.test.mjs` | gates block until a named person approves; a task is not done without valid outputs; three failures escalate; recovery after interruption; ledger tampering is detected and secrets are redacted; checkpoints; DNA revisions respect preserved aspects; directions must be distinct; a review must be independent |
| Integration: assets | `tests/integration/assets.test.mjs` | exact sizes, provenance and reuse; byte budgets; duplicate detection; behaviour without the raster engine; mock outputs that are the wrong size, blank or off-brand are rejected; budget stop; consent and deny policies; the OpenAI adapter against a local stand-in for success, a 429 with retry, an outage and a rejected key |
| Integration: revisions | `tests/integration/revisions.test.mjs` | a revision changes only what was asked; a wider change is caught; export gating and draft contents; simulated approvals stay labelled; design-to-code analysis and comparison |
| Integration: harness | `tests/integration/qa.test.mjs` | **the QA harness itself**: a clean page passes; nine planted defects are each caught by the responsible check; undecided accessibility rules are warnings; flows report pass and fail; visual regression matches and catches; timing from a busy host is classed as unreliable |
| Security | `tests/security/adversarial.test.mjs` | malformed and hostile briefs fail cleanly; instructions embedded in client content change nothing; corrupt state gives precise errors; a tampered registry cannot cause reads or copies outside the project; content cannot inject markup or dangerous links; the preview server serves only its directory; the audit finds a planted secret, unsafe code and third-party requests; licence classification; the plugin core has no dependencies |
| End to end | `tests/e2e/demo-pipeline.test.mjs` | the demonstration reproduces from its inputs in an empty directory; brand, images, 3D model and cross-deliverable consistency hold; a DNA revision propagates through `sync`; the draft package is complete and honest |
| Regression | same file, last test | hashes of stable outputs (tokens, plan shape, three recipes, the logo symbol, model triangle counts) against `tests/regression/goldens/haldora.json`. A difference names what moved; accept deliberately with `UPDATE_GOLDENS=1` |
| Template: portal | `plugin/templates/web-app/tests/logic.test.mjs` | data model, chart geometry, sorting, paging, validation |
| Template: mobile | `plugin/templates/mobile-expo/__tests__/` | gesture maths, day model, store, slider alternatives and accessibility, dial labels, offline banner |

### Evaluation mapping

| Evaluation the brief asked for | Where |
|---|---|
| Correct skill selection | routing test (15 requests) |
| Interpretation of inputs, output contracts | contract tests, lifecycle tests |
| Graceful failure, missing dependencies | exit-code assertions; `CIS_DISABLE_ENGINES` tests |
| Security boundaries | security suite; hook tests |
| Cross-skill coordination, shared tokens | end-to-end consistency and propagation tests |
| Asset integration, build execution | end-to-end test; full demo run |
| Revision handling, artifact export | revisions suite |
| Regression | goldens |
| Adversarial inputs | security suite; asset tests |

Results of the latest full run are in [release-report.md](release-report.md).
