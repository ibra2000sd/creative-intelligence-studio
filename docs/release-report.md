# Release report: Creative Intelligence Studio 0.1.0

13 November 2026. This report states what works, what does not, and what was not verified. Every figure comes from a command that was run; the command is named so it can be repeated.

## Summary

The plugin is built, validated, installed and exercised end to end on a fictional client. From one brief and one Experience DNA it produced a brand identity (with Arabic applications whose headlines are shaped by HarfBuzz), a bilingual marketing website with a scroll-driven story, a customer portal, a mobile app, 39 generated image assets and an interactive 3D product scene, and checked them with its own QA harness. The final automated verdict for the demonstration is **incomplete**, not pass: nothing fails, but native mobile builds could not run on this machine and are reported as blocked.

The work was reviewed six times by the plugin's independent reviewer agent, with fixes between rounds. The first review found a blocker and 13 major problems. Since the third round the count of major problems has stayed at about seven per round: each round fixed most of the previous list, and the next reviewer, a fresh instance, found a similar number of new ones. Every round recommended **revise**. The last review's open items are listed below and in [limitations.md](limitations.md). The two final gates are left to people.

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
| Portal logic | `npm test` in `app/` | 12 of 12 pass |
| Mobile | `tsc --noEmit`, `jest`, `expo export` | type check clean; 19 of 19 tests; Hermes bundles for iOS (3.85 MB) and Android (3.84 MB) |
| Full demonstration | `node scripts/run-demo.mjs --full --refresh` | 63 commands, none with a non-zero exit; log in `demos/haldora/full-run.log` |
| Deliverable QA | `creative-studio test` | 279 pass, 0 fail, 16 warn, 2 blocked, 0 skipped, against baselines accepted in the previous run after the captures were looked at. Log in `demos/haldora/final-qa.log` |
| Security audit | `creative-studio audit` | pass: 16 pass, 0 fail, 2 warn, 0 blocked |
| Ledger | `creative-studio ledger verify` | 432 events, chain intact |
| Draft package | `creative-studio export --draft` | 745 files, 44.8 MB, read back and verified; 26 open issues listed inside, 7 of them the latest review's major findings. A final export is refused while gate G6 is open |
| Release archive | `node scripts/package-release.mjs` | `release/creative-intelligence-studio-0.1.0.zip`, 137 files, 345 KB, SHA-256 in `release/*.sha256` |
| Live image provider | `creative-studio images generate --provider openai --consent` (one job, low quality) | generated on the first request in 14 s; 5 of 5 inspection checks pass; estimate $0.006; key absent from registry, ledger and cost records |

## Demonstration results by target

Scripted functional flows: **42 of 42 pass** (website 10, portal 15, 3D scene 10, mobile 7). Visual comparisons: **62 of 62** match their accepted baselines. Screenshots: 75, covering every page at phone, tablet and desktop size, dark at phone and desktop size, and the declared states (each story chapter, each portal route, each app screen, the hero at 834 and 1024 pixels, in light, dark and Arabic). Every full-page capture passed the check that no text was still invisible when it was taken.

| Target | Pass | Fail | Warn | Blocked | Notes |
|---|---:|---:|---:|---:|---|
| project | 4 | 0 | 0 | 0 | ledger, DNA lint, consistency across 5 deliverables at DNA revision 2, registered assets hash-verified |
| web | 79 | 0 | 4 | 0 | warnings: contrast over artwork that axe cannot decide (4) |
| app | 74 | 0 | 6 | 0 | warnings: undecided contrast for SVG chart text (4); start-up over the default budget, within a documented exception (2) |
| scene | 54 | 0 | 4 | 0 | warnings: undecided contrast for one element (4) |
| mobile-native | 5 | 0 | 0 | 2 | native iOS and Android builds blocked |
| mobile-web | 47 | 0 | 0 | 0 | browser run of the same React Native code |
| security | 16 | 0 | 2 | 0 | GSAP's custom licence needs a human decision; 4 moderate and 1 low advisories in the mobile dependency tree |

Brand kit: 84 files; 28 of 28 vector masters pass integrity; nothing missing.
Images: 39 of 39 jobs accepted; cost $0.00.
3D model: 245.2 KB source, 68.1 KB optimised (72% smaller), 9,448 triangles, 7 draw calls, 0 validator errors for both files; 6 still fallbacks rendered from the model.
Experience DNA: revision 2. The Dusk finish was made matte through `dna bump` with its reason recorded; the consistency check flagged every deliverable as stale until it was rebuilt.
Scroll frame timing (lab, this machine's GPU): median 16.7 ms, 95th percentile 16.8 ms, 0 of 460 frames over 33 ms, layout shift 0.
Third-party requests in built pages: none.

## Independent creative review

The plugin's `creative-reviewer` agent reviewed the demonstration six times on 13 November 2026. Each round was a fresh instance, given the project directory and nothing about how the work was made; from round 2 on it judged the work first and only then compared it with the previous review. Every review passes `creative-studio review check`; all six are kept in `demos/haldora/reviews/`, and the latest is also in the project at `.cis/reports/creative-review.json`. A model's evaluation is not a person's and not an approval.

| Round | Recommendation | Blocker | Major | Minor | Previous round's major findings |
|---|---|---:|---:|---:|---|
| 1 | revise | 1 | 13 | 11 | (first review) |
| 2 | revise | 0 | 9 | 16 | of 14 serious: 12 fixed, 2 partly |
| 3 | revise | 0 | 7 | 13 | of 9: 6 fixed, 3 not fixed (deliberately left) |
| 4 | revise | 0 | 8 | 11 | of 7: 2 fixed, 4 partly, 1 not fixed |
| 5 | revise | 0 | 7 | 15 | of 8: 6 fixed, 2 partly |
| 6 | revise | 0 | 7 | 19 | of 7: 2 fixed, 5 partly |

Scores out of 5, rounds 1 to 6: design coherence 3, 4, 3, 4, 4, 4; brand alignment 4, 4, 4, 4, 3, 4; visual hierarchy 3, 3, 3, 3, 4, 3; typography 3, 4, 4, 4, 4, 3; originality 3, 3, 3, 3, 4, 4; interaction clarity 3 throughout; asset quality 3 throughout; presentation polish 2, 3, 3, 3, 3, 3; professional readiness 2, 3, 2, 3, 3, 3; motion not assessed in any round (still images only). Each round was a new reviewer with its own eye, so the scores are not calibrated against each other.

**What the rounds did.** The blocker (two suns in the scroll story) and the problems a client would see first are gone: screenshots that did not show the page, a dark scheme finished in one deliverable only, Arabic layouts mirrored from English, a portal chart whose sun disagreed with its cursor, a cut-off 3D configurator, a hero whose hills ran under the copy, and more. Larger design changes were made on the reviews' advice: Arabic brand applications shaped with HarfBuzz, a portal that states the moment in one sentence and opens History with the last fortnight as day arcs, designed Devices screens in the app, a full-bleed app icon, a logo symbol whose sun sits on a continuous arc over a wider horizon, and a matte Dusk finish through a DNA revision.

**Why the loop was stopped after round 6.** From round 3 on, the number of major findings stayed between 7 and 8. Each round fixed most of the previous list (by the next reviewer's own verdict), and each new reviewer found a similar number of new problems, a mix of regressions caused by the previous round's changes (which were then fixed) and further design opinions. More rounds would keep finding things, as a human design review would; the point at which the work is good enough for a client is a judgement for a person, not for another model review.

**Still open after round 6** (details and suggestions in `demos/haldora/reviews/review-6-revise.json`, summarised in [limitations.md](limitations.md)): the app dial's label touches its ring and the figure is not in the mono face; stray arc fragments near the hero copy at some widths and in two exports; the portal's forecast state is worded as fact; no separate Android adaptive icon foreground; the 3D scene reads as a configurator rather than a launch presentation; Arabic text below the guidelines' own 14 px floor in places; and on phones the feature illustrations repeat the story's landscapes.

**What the reviews taught about the harness.** Several serious findings were things the automated checks had reported as passing: two suns in one picture, half-blank screenshots, a dark capture identical to the light one, a configurator cut off inside its frame, a 3D view squeezed to 70 pixels on a phone. The harness now scrolls a page through before a full-page capture, captures every declared state, fails a dark capture that does not differ and a capture with invisible text, measures contrast only after colour transitions finish, and the website's flows check that the embedded 3D view fits its frame and fills a phone's width. None of that lets it judge a picture; looking is still required.

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
| Real automated tests | met | 125 tests across the suites (85 unit, integration and security; 9 end to end; 12 portal logic; 19 mobile) |
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
- Found by the later reviews: a 3D configurator cut off inside the website's frame, then squeezed to a 70-pixel strip on phones by the fix; History dated two weeks behind the page; a story whose sun contradicted its headline; Android would crop the icon (still open). Each fix that could be checked automatically gained a flow.
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
