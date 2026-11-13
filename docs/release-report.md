# Release report: Creative Intelligence Studio 0.1.0

13 November 2026. This report states what works, what does not, and what was not verified. Every figure comes from a command that was run; the command is named so it can be repeated.

## Summary

The plugin is built, validated, installed and exercised end to end on a fictional client. From one brief and one Experience DNA it produced a brand identity, a bilingual marketing website with a scroll-driven story, a customer portal, a mobile app, 19 generated image assets and an interactive 3D product scene, and checked them with its own QA harness. The final automated verdict for the demonstration is **incomplete**, not pass: nothing fails, but native mobile builds could not run on this machine and are reported as blocked. Three things are deliberately left to people: the independent creative review and the two final gates.

## Verification performed

| What | Command | Result |
|---|---|---|
| Plugin manifest | `claude plugin validate ./plugin` | Validation passed, no warnings |
| Marketplace manifest | `claude plugin validate .` | Validation passed |
| Installation | `claude plugin marketplace add`, `claude plugin install creative-intelligence-studio@creative-intelligence-studio` | Installed, enabled, user scope |
| Discovery | `claude plugin details creative-intelligence-studio` | 17 skills, 2 agents, 1 hook; about 2,300 always-on tokens |
| Skill invocation by the model | `claude -p ...` (headless) | **Not verified.** The standalone CLI answered "OAuth session expired and could not be refreshed". Start a new session and run `/creative-intelligence-studio:creative-studio` to confirm |
| Unit, integration, security suites | `pnpm test` | 80 of 80 pass |
| End to end and regression | `pnpm test:e2e` | 9 of 9 pass; the demonstration reproduces from its inputs in an empty directory |
| Portal logic | `npm test` in `app/` | 8 of 8 pass |
| Mobile | `tsc --noEmit`, `jest`, `expo export` | type check clean; 19 of 19 tests; Hermes bundles for iOS (3.85 MB) and Android (3.84 MB) |
| Full demonstration | `node scripts/run-demo.mjs --full --refresh` | 62 commands; the run completed. One command, `creative-studio test`, exited 1 because its verdict is incomplete (see below), and the runner reports that instead of stopping. Log in `demos/haldora/full-run.log` |
| Deliverable QA | `creative-studio test` | 147 pass, 0 fail, 18 warn, 2 blocked, 21 skipped (baselines accepted in this run) |
| Security audit | `creative-studio audit` | pass: 16 pass, 0 fail, 2 warn, 0 blocked |
| Ledger | `creative-studio ledger verify` | 127 events, chain intact |
| Draft package | `creative-studio export --draft` | 593 files, 39.2 MB, read back and verified; 21 open issues listed inside |
| Release archive | `node scripts/package-release.mjs` | `release/creative-intelligence-studio-0.1.0.zip`, 136 files, 307 KB, SHA-256 in `release/*.sha256` |

## Demonstration results by target

Scripted functional flows: **38 of 38 pass** (website 9, portal 12, 3D scene 10, mobile 7).

| Target | Pass | Fail | Warn | Blocked | Notes |
|---|---:|---:|---:|---:|---|
| project | 4 | 0 | 0 | 0 | ledger, DNA lint, consistency across 5 deliverables, 24 assets hash-verified |
| web | 34 | 0 | 6 | 0 | warnings: undecided contrast over artwork (4), lab timing (2) |
| app | 37 | 0 | 6 | 0 | warnings: undecided contrast for SVG chart text (4), start-up over default budget within a documented exception (2) |
| scene | 32 | 0 | 4 | 0 | warnings: undecided contrast for one element (4) |
| mobile-native | 5 | 0 | 0 | 2 | native iOS and Android builds blocked |
| mobile-web | 19 | 0 | 0 | 0 | browser run of the same React Native code |
| security | 16 | 0 | 2 | 0 | GSAP's custom licence needs a human decision; 4 moderate and 1 low advisories in the mobile dependency tree |

Brand kit: 74 files; 25 of 25 vector masters pass integrity; 17 of 17 raster exports at exact size; nothing missing.
Images: 19 of 19 jobs accepted; cost $0.00; one job was first rejected for exceeding its byte budget and the brief was corrected.
3D model: 200.4 KB source, 55.8 KB optimised (72% smaller), 7,980 triangles, 7 draw calls, 0 validator errors for both files.
Scroll frame timing (lab, this machine's GPU): median 16.7 ms, 95th percentile 16.8 ms, 1 of 454 frames over 33 ms, layout shift 0.
Third-party requests in built pages: none.

## Acceptance criteria

| Criterion | Status | Evidence |
|---|---|---|
| Plugin installs in a compatible environment | met | `claude plugin install`, `claude plugin list` |
| Skill discovery | met | `claude plugin details`: 17 skills |
| Skill invocation | **not verified** | headless CLI could not authenticate |
| Valid configuration schemas | met | 13 schemas; contract tests; Ajv parity |
| Working orchestration | met | lifecycle tests; demo run |
| Experience DNA persistence | met | revisions archived; propagation test |
| Functional brand workflow | met | brand manifest; end-to-end test |
| Functional web workflow | met | 9 and 12 flows |
| Asset pipeline with a real or local engine | met with the local engine | registry; asset tests. Paid provider: stand-in only |
| Verified animated website | met | story-scroll flow; scroll-motion check |
| Verified interactive 3D experience | met | 10 scene flows including pixel read-back |
| Genuinely implemented mobile workflow | partly met | real Expo project, tests, platform bundles, browser flows. **Native builds blocked** |
| Real automated tests | met | 116 tests across the suites |
| Representative integration tests | met | integration and end-to-end suites |
| Accessibility checks | met for automation | axe, keyboard, focus, target size, reduced motion; manual audit outstanding |
| Security checks | met | adversarial suite; audit |
| Correct export behaviour | met | export tests; draft package |
| Reproducible demo builds | met | clean-directory end-to-end test (light); full run from templates |
| Complete installation documentation | met | `docs/installation.md` |
| Explicit reporting of unverified or blocked items | met | this report; `docs/limitations.md` |

## Defects found and fixed during the build

Thirty-six are recorded by phase in `docs/implementation-ledger.json`. The ones that mattered most:

- `redact()` did not mask a secret unless it started the text, so a key could have been written to the ledger. Found by a unit test.
- Optional engines were being resolved from the user's home directory, loading an unpinned Playwright. Found by `doctor`.
- The optimised 3D model was invalid glTF until the quantisation extension was declared. Found by the Khronos validator.
- The scene's render loop scheduled duplicate frames. Found by its own frame diagnostics.
- Inactive story chapters were dimmed below the contrast minimum. Found by axe.
- The QA harness itself counted rules axe could not decide as passes. Found by the harness self-test with planted defects.
- In the dark scheme the site's navigation and logo were nearly invisible over the hero artwork. **No automated check failed**; it was found by looking at the screenshot after the harness began reporting undecided contrast as a warning.
- Three issues raised by an automated security review of commits: unconfined registry paths, DNA strings reaching generated code unsanitised, and a host-matching bypass in the upload guard. All fixed with tests.

## Final review by role

**Product designer.** The demonstration has a real idea, the day arc, and it is visibly the same idea in the logo, the site, the chart, the app and the product. Weak points: only one client has been built, so the claim that different briefs yield different-looking work rests on the DNA mechanism and on instructions to Claude, not yet on a second example. The portal and app are competent rather than distinctive. The artwork is flat procedural landscape; it suits this brand and would not suit most others.

**Frontend engineer.** Pre-rendered pages that are complete without JavaScript, logical properties for right-to-left, self-hosted fonts and no third-party requests are sound. The scroll library loads only where it is used. Concerns: start-up blocking in the portal and the 3D scene; a slow first tap on the site header whose cause was not found; templates are single files that will need splitting as projects grow.

**Mobile engineer.** The gesture work is on the UI thread with tap and accessibility alternatives, and it type-checks, tests and bundles for both platforms. It has never run on a device. Until `expo run:ios` and `run:android` succeed and someone uses it with VoiceOver and TalkBack, it is an untested app.

**3D engineer.** A valid, small, optimised model with render-on-demand, context-loss recovery, disposal and a still fallback is a responsible baseline. It is also a simple object: untextured, procedurally modelled, one light rig. No shaders, particles, physics or WebGPU.

**Security engineer.** Zero-dependency core, pinned optional engines, path confinement, redaction, policy and budget enforcement and a tamper-evident ledger are in place and tested. The upload guard is pattern matching and should be described as a guard rail. The prompt-injection defence is instruction plus the fact that the CLI never executes content; it has not been red-teamed with a model in the loop.

**QA lead.** The harness is tested against planted defects, labels its measurements and refuses to turn "could not run" into "passed". Lab performance numbers from this machine are not trustworthy: it was a desktop in use with a load average near 20, and identical page loads ranged from 137 to 2,273 ms of blocking time in one run. The harness now flags that, but the numbers should be regenerated on an idle machine.

**First-time installer.** Validation and installation worked first time. The plugin is read from the repository directory, so moving or deleting the repository breaks it. Optional engines must be installed with `creative-studio setup` before raster, browser or 3D commands work, and that needs network access.

**Demanding client.** They would receive a coherent identity with editable vector logos, a working bilingual site, a working portal, an app project, a 3D viewer, a hashed package and an honest list of what is open. They would not yet receive: a native app build, real photography or copy, print-ready colour, trademark clearance, or anything a person has approved. Whether the work is good enough is their judgement; no evidence here supports a claim that it is better than what other tools or studios produce.

## What is not working or not done

See [limitations.md](limitations.md) for the complete list. In short: native mobile builds; a live paid image provider; model-driven skill invocation (unverified); the independent creative review and final gates; reliable performance numbers; print production; and the frameworks and providers listed there as not implemented.
