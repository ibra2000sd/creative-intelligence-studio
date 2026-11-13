# Release report: Creative Intelligence Studio 0.1.0

13 November 2026. This report states what works, what does not, and what was not verified. Every figure comes from a command that was run; the command is named so it can be repeated.

## Summary

The plugin is built, validated, installed and exercised end to end on a fictional client. From one brief and one Experience DNA it produced a brand identity, a bilingual marketing website with a scroll-driven story, a customer portal, a mobile app, 37 generated image assets and an interactive 3D product scene, and checked them with its own QA harness. The final automated verdict for the demonstration is **incomplete**, not pass: nothing fails, but native mobile builds could not run on this machine and are reported as blocked.

The work was then reviewed three times by the plugin's independent reviewer agent, with fixes between rounds. The first review found a blocker and 13 major problems; the third found no blocker and 7 major problems, most of them design work that was deliberately left (listed below and in [limitations.md](limitations.md)). Every round recommended **revise**. The two final gates are left to people.

## Verification performed

| What | Command | Result |
|---|---|---|
| Plugin manifest | `claude plugin validate ./plugin` | Validation passed, no warnings |
| Marketplace manifest | `claude plugin validate .` | Validation passed |
| Installation | `claude plugin marketplace add`, `claude plugin install creative-intelligence-studio@creative-intelligence-studio` | Installed, enabled, user scope |
| Discovery | `claude plugin details creative-intelligence-studio` | 17 skills, 2 agents, 1 hook; about 2,300 always-on tokens |
| Skill invocation by the model | Skill tool in a desktop app session, 13 November 2026 | One skill verified: `creative-intelligence-studio:intake-discovery` loaded with its instructions, all 17 skills and both agents were listed, and `creative-studio --version` resolved from the plugin on the PATH. Whether Claude picks the right skill unprompted from a plain request was not measured. The headless `claude -p` check still fails with "OAuth session expired and could not be refreshed" |
| Unit, integration, security suites | `pnpm test` | 85 of 85 pass |
| End to end and regression | `pnpm test:e2e` | 9 of 9 pass; the demonstration reproduces from its inputs in an empty directory |
| Portal logic | `npm test` in `app/` | 11 of 11 pass |
| Mobile | `tsc --noEmit`, `jest`, `expo export` | type check clean; 19 of 19 tests; Hermes bundles for iOS (3.85 MB) and Android (3.84 MB) |
| Full demonstration | `node scripts/run-demo.mjs --full --refresh` | 63 commands, none with a non-zero exit; log in `demos/haldora/full-run.log`. After the third review the website, its images and its QA were regenerated with the targeted commands (`images generate`, `website sync`, `test`) rather than a fourth full run |
| Deliverable QA | `creative-studio test` | 278 pass, 0 fail, 16 warn, 2 blocked, 0 skipped, against baselines accepted in an earlier run after the captures were looked at. Log in `demos/haldora/final-qa.log` |
| Security audit | `creative-studio audit` | pass: 16 pass, 0 fail, 2 warn, 0 blocked |
| Ledger | `creative-studio ledger verify` | 278 events, chain intact |
| Draft package | `creative-studio export --draft` | 672 files, 44.4 MB, read back and verified; 26 open issues listed inside, 7 of them the latest review's major findings. A final export is refused while gate G6 is open |
| Release archive | `node scripts/package-release.mjs` | `release/creative-intelligence-studio-0.1.0.zip`, 136 files, 334 KB, SHA-256 in `release/*.sha256` |
| Live image provider | `creative-studio images generate --provider openai --consent` (one job, low quality) | generated on the first request in 14 s; 5 of 5 inspection checks pass; estimate $0.006; key absent from registry, ledger and cost records |

## Demonstration results by target

Scripted functional flows: **41 of 41 pass** (website 9, portal 15, 3D scene 10, mobile 7). Visual comparisons: **62 of 62** match their accepted baselines. Screenshots: 75, covering every page at phone, tablet and desktop size, dark at phone and desktop size, and 42 declared states (each story chapter, each portal route, each app screen, the hero at 834 and 1024 pixels, in light, dark and Arabic). Every full-page capture passed the check that no text was still invisible when it was taken.

| Target | Pass | Fail | Warn | Blocked | Notes |
|---|---:|---:|---:|---:|---|
| project | 4 | 0 | 0 | 0 | ledger, DNA lint, consistency across 5 deliverables, registered assets hash-verified |
| web | 78 | 0 | 4 | 0 | warnings: contrast over artwork that axe cannot decide (4) |
| app | 74 | 0 | 6 | 0 | warnings: undecided contrast for SVG chart text (4); start-up over the default budget, within a documented exception (2) |
| scene | 54 | 0 | 4 | 0 | warnings: undecided contrast for one element (4) |
| mobile-native | 5 | 0 | 0 | 2 | native iOS and Android builds blocked |
| mobile-web | 47 | 0 | 0 | 0 | browser run of the same React Native code |
| security | 16 | 0 | 2 | 0 | GSAP's custom licence needs a human decision; 4 moderate and 1 low advisories in the mobile dependency tree |

Brand kit: 74 files; 25 of 25 vector masters pass integrity; nothing missing.
Images: 37 of 37 jobs accepted; cost $0.00.
3D model: 198.1 KB source, 55.2 KB optimised (72% smaller), 7,648 triangles, 6 draw calls, 0 validator errors for both files; 6 still fallbacks rendered from the model.
Scroll frame timing (lab, this machine's GPU): median 16.7 ms, 95th percentile 16.8 ms, 2 of 444 frames over 33 ms on the English page, layout shift 0.
Third-party requests in built pages: none.

## Independent creative review

The plugin's `creative-reviewer` agent reviewed the demonstration three times on 13 November 2026. Each round was a fresh instance, given the project directory and nothing about how the work was made; rounds 2 and 3 judged the work first and only then compared it with the previous review. Each review passes `creative-studio review check`; all three are kept in `demos/haldora/reviews/`, and the latest is also in the project at `.cis/reports/creative-review.json`. A model's evaluation is not a person's and not an approval.

| Round | Recommendation | Blocker | Major | Minor | Earlier serious findings |
|---|---|---:|---:|---:|---|
| 1 | revise | 1 | 13 | 11 | (first review) |
| 2 | revise | 0 | 9 | 16 | of round 1's 14: 12 fixed, 2 partly fixed |
| 3 | revise | 0 | 7 | 13 | of round 2's 9: 6 fixed, 3 not fixed (deliberately left) |

Scores out of 5, rounds 1 to 3: design coherence 3, 4, 3; brand alignment 4, 4, 4; visual hierarchy 3, 3, 3; typography 3, 4, 4; originality 3, 3, 3; interaction clarity 3, 3, 3; asset quality 3, 3, 3; presentation polish 2, 3, 3; professional readiness 2, 3, 2; motion not assessed in any round (still images only). The scores moved far less than the findings did. Each round was a new reviewer with its own eye, so the scores are not calibrated against each other, and they should not be read as a trend.

**What the rounds changed.** Fixed after round 1: the doubled sun in the scroll story (the blocker), screenshots that did not show the page, a dark scheme finished only in the portal, the 3D stage and stills in dark, the product's finish colour and setting, the portal chart's arc disagreeing with its own cursor, demo data that told three stories, Arabic layouts mirrored from English, Arabic typography, the app's Arabic layout, the portal on a phone, and the story and presentation artwork colliding with headlines. Fixed after round 2: the arc running through the hero headline, the moon covering the Arabic headline, full-disc moons where the rules say crescent, clipped app tab labels, untranslated app content, and guideline previews showing the wrong sky (inlined SVGs shared gradient ids). Round 3 found two regressions caused by those fixes, a cropped sun at tablet width and the sun's halo clipped at 1024 pixels. Both were fixed and checked by looking at new captures at those sizes; there was no fourth review. Those new captures also found a 67-pixel sideways overflow at 1024 pixels, which was fixed.

**What is still open** (the third review's majors, and three left from the second): the arc's stroke is a hairline on phones and tablets; the portal's phone chart is the desktop chart scaled down; the portal shell and History page look like a standard admin template; the app's Devices screens are unstyled; the sun's night and dark rules are not applied in the app dial, the dark portal, the guideline cover and the dark hero's stars; the 3D product is a featureless slab; and there are no Arabic brand applications. These are design work on the demonstration, listed with locations in [limitations.md](limitations.md).

**What the reviews taught about the harness.** Several of the serious findings were things the automated checks reported as passing: two suns in one picture, half-blank screenshots, a "dark" capture identical to the light one. The harness now scrolls a page through before a full-page capture, captures every declared state, fails a dark capture that does not differ, fails a capture with invisible text, and measures contrast only after colour transitions finish. None of that makes it able to judge a picture; looking is still required.

## Acceptance criteria

| Criterion | Status | Evidence |
|---|---|---|
| Plugin installs in a compatible environment | met | `claude plugin install`, `claude plugin list` |
| Skill discovery | met | `claude plugin details`: 17 skills |
| Skill invocation | met for one skill | loaded through the Skill tool in a live session; automatic triggering from plain requests not measured |
| Valid configuration schemas | met | 13 schemas; contract tests; Ajv parity |
| Working orchestration | met | lifecycle tests; demo run |
| Experience DNA persistence | met | revisions archived; propagation test |
| Functional brand workflow | met | brand manifest; end-to-end test |
| Functional web workflow | met | 9 and 12 flows |
| Asset pipeline with a real or local engine | met | registry; asset tests; one live paid generation through the OpenAI adapter (`demos/live-provider-check/`) |
| Verified animated website | met | story-scroll flow checks one sun and its positions; scroll-motion check; each chapter captured and baselined. The doubled sun found by the first review is fixed |
| Verified interactive 3D experience | met | 10 scene flows including pixel read-back |
| Genuinely implemented mobile workflow | partly met | real Expo project, tests, platform bundles, browser flows. **Native builds blocked** |
| Real automated tests | met | 124 tests across the suites (85 unit, integration and security; 9 end to end; 11 portal logic; 19 mobile) |
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
- Found by the independent reviews, after automation had passed them: two suns in the scroll story; full-page screenshots blank below the story; a dark capture identical to the light one; guideline previews showing the wrong artwork because inlined SVGs shared ids; a sideways overflow at 1024 pixels (found by a capture added because of the third review).
- The image cache ignored the recipe code, so a change to how a picture is drawn never reached images generated before it. Found while fixing the night marker.
- Three issues raised by an automated security review of commits: unconfined registry paths, DNA strings reaching generated code unsanitised, and a host-matching bypass in the upload guard. All fixed with tests.

## Final review by role

**Product designer.** The demonstration has a real idea, the day arc, and it is visibly the same idea in the logo, the site, the chart, the app and the product, now with written rules in the guidelines. Three independent reviews agree that the story, the chart and the app dial carry it, and that the portal shell, the app's secondary screens and the 3D product do not yet. Only one client has been built, so the claim that different briefs yield different-looking work rests on the DNA mechanism and on instructions to Claude, not yet on a second example. The artwork is flat procedural landscape; it suits this brand and would not suit most others.

**Frontend engineer.** Pre-rendered pages that are complete without JavaScript, logical properties for right-to-left, self-hosted fonts and no third-party requests are sound. The scroll library loads only where it is used. Concerns: start-up blocking in the portal and the 3D scene; a slow first tap on the site header whose cause was not found; templates are single files that will need splitting as projects grow.

**Mobile engineer.** The gesture work is on the UI thread with tap and accessibility alternatives, and it type-checks, tests and bundles for both platforms. It has never run on a device. Until `expo run:ios` and `run:android` succeed and someone uses it with VoiceOver and TalkBack, it is an untested app.

**3D engineer.** A valid, small, optimised model with render-on-demand, context-loss recovery, disposal and a still fallback is a responsible baseline. It is also a simple object: untextured, procedurally modelled, one light rig. No shaders, particles, physics or WebGPU.

**Security engineer.** Zero-dependency core, pinned optional engines, path confinement, redaction, policy and budget enforcement and a tamper-evident ledger are in place and tested. The upload guard is pattern matching and should be described as a guard rail. The prompt-injection defence is instruction plus the fact that the CLI never executes content; it has not been red-teamed with a model in the loop.

**QA lead.** The harness is tested against planted defects, labels its measurements and refuses to turn "could not run" into "passed". The reviews exposed that it could pass screenshots that showed nothing; that is fixed and tested, but the lesson stands that a pass count is not evidence anyone saw the screen. Lab performance numbers from this machine are not trustworthy: it was a desktop in use with a load average near 20, and identical page loads ranged from 137 to 2,273 ms of blocking time in one run. The harness now flags that, but the numbers should be regenerated on an idle machine.

**First-time installer.** Validation and installation worked first time. The plugin is read from the repository directory, so moving or deleting the repository breaks it. Optional engines must be installed with `creative-studio setup` before raster, browser or 3D commands work, and that needs network access.

**Demanding client.** They would receive a coherent identity with editable vector logos, a working bilingual site, a working portal, an app project, a 3D viewer, a hashed package and an honest list of what is open. They would not yet receive: a native app build, real photography or copy, print-ready colour, trademark clearance, or anything a person has approved. Whether the work is good enough is their judgement; no evidence here supports a claim that it is better than what other tools or studios produce.

## What is not working or not done

See [limitations.md](limitations.md) for the complete list. In short: native mobile builds; the open design work from the third review; a person's review and the final gates; live coverage of the paid image provider beyond one generation; automatic skill triggering from plain requests (not measured); reliable performance numbers; print production; and the frameworks and providers listed there as not implemented.
