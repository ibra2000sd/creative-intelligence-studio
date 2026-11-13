# Operational limitations and known issues

This is the list of what is not done, not verified or not as good as it should be, with the reason and the next action for each. Statuses use the same four words throughout the project: **implemented and tested**, **implemented, not fully tested**, **simulated**, **blocked**, **not implemented**.

## Blocked by this machine or by missing authorisation

| Item | Status | Why | What is needed |
|---|---|---|---|
| Native iOS build, simulator and device tests | blocked | Full Xcode is not installed (only the command-line tools), so `simctl` and the iOS build chain are unavailable | A Mac with Xcode: `npx expo run:ios`; an Apple signing identity for store builds |
| Native Android build, emulator and device tests | blocked | No Android SDK or `adb` | Android Studio and an emulator or device: `npx expo run:android`; a keystore for store builds |
| Skill invocation by the model | verified for one skill; triggering not measured | In a desktop app session on 13 November 2026 all 17 skills and both agents were listed and `intake-discovery` loaded through the Skill tool; the other 16 were not each invoked, and no evaluation measures whether Claude chooses the right skill from a plain request. The headless `claude -p` check fails with "OAuth session expired and could not be refreshed" | Log in to the CLI again to repeat the headless check; add trigger evaluations (`claude plugin eval`) |
| Real image-provider generation (OpenAI) | implemented and tested for one case | One live generation was run with the owner's approval on 13 November 2026: `gpt-image-2`, low quality, 1024 by 1024, one request, about 14 seconds, accepted by every inspection check. Evidence is in `demos/live-provider-check/`. The recorded cost ($0.006) is the adapter's estimate, not the billed amount. Image editing, reference-guided generation, transparent backgrounds, other sizes and qualities, and real rate-limit behaviour are still covered only by the local stand-in | Check the amount on the provider's billing page; run the other cases when a project needs them |
| Independent creative review of the demonstration | performed six times by a model; latest outcome "revise" with no blocker | The plugin's `creative-reviewer` agent reviewed the work cold six times, each a fresh instance (`demos/haldora/reviews/`). Round 1: 1 blocker, 13 major. Rounds 3 to 6: 7 or 8 major each, with most of each previous list fixed. The loop was stopped after round 6; see the release report for why. A model's critique is not a person's, and it is not client approval | A person reviews before gate G6 |
| Gates G6 (quality) and G7 (acceptance), and a final export | blocked | They need real people | `creative-studio approve G6-quality --actor "<name>"`, then `creative-studio export` |
| Real client approvals | simulated | Haldora is fictional; gates G0 to G2 were recorded with `--simulated` and are labelled so in every report and in the package | A real client |
| Screen-reader, real-device and low-powered-hardware testing | not performed | Not automatable here | People and devices |
| Field Core Web Vitals | not available | They exist only for a live site with real visitors | Launch, then read field data |

## Implemented with known weaknesses

The first independent review showed that the QA screenshots proved less than the pass counts suggested: full-page website captures blank from the middle down, a mobile app evidenced by one onboarding screen (with a "dark" capture byte-identical to the light one), and portal captures of one route only. That is fixed in the harness. Pages are scrolled through before a full-page capture; every page is captured at phone, tablet and desktop size and in dark at phone and desktop size; a dark capture identical to the light one fails; each deliverable declares captures for the states a page capture cannot reach (each story chapter, each portal route, each app screen, in dark and Arabic); and a screenshot is taken only once two consecutive frames are identical. The demonstration now produces about 70 screenshots instead of 28. The first new capture of the portal's History route on a phone immediately failed its overflow check, which is the point of capturing it.

What this still does not do is judge what is in the picture. A doubled sun passed every automated check; only looking found it.

A defect found late is worth recording as a warning about the method: in the dark colour scheme the website's navigation and logo were nearly invisible over the pale hero artwork. No automated rule failed, because contrast over an image cannot be decided automatically. It was caught only after the harness was changed to report undecided rules as warnings and the screenshot was looked at. It is fixed and now has its own scripted check, but it shows that the manual review listed below is not optional.

| Item | Detail | Next action |
|---|---|---|
| First tap on the marketing site's header buttons | About 230 to 250 ms from tap to paint under 4x CPU throttling on the reference machine (16 to 24 ms on later taps; about 60 ms unthrottled). Bisected across header transitions, hover styles, hero artwork, sticky positioning and scroll behaviour without finding the cause | Profile on a real mid-range phone with the browser's performance panel |
| 3D scene start-up | Roughly 1.1 to 1.6 s of main-thread blocking while the WebGL context is created and shaders compile; the same with and without CPU throttling, so it is not script cost. The still image is shown meanwhile and the engine is only fetched when the scene is requested. Recorded as a budget exception and reported as a warning | Move rendering to a worker with `OffscreenCanvas`, or pre-warm on idle |
| Portal start-up | Between about 0.27 s (idle machine) and 0.7 s (busy machine) of blocking under 4x throttling, none unthrottled, dominated by the React runtime. A budget exception with its reason is recorded in `qa/budgets.json` | Route-level code splitting; defer the chart until after first paint |
| Lab performance figures | The reference machine was a desktop in use, with a load average near 20 on 8 cores during the final runs. Identical loads of one page measured between 19 and 583 ms of blocking time; isolated runs gave 132 to 225 ms for the website and 265 to 278 ms for the portal. The harness now detects a loaded host or disagreeing runs and reports over-budget figures as unreliable instead of failing or passing them. No performance number in this release should be read as a benchmark | Re-run `creative-studio test web app` on an idle machine or in CI |
| Frame timing | Measured in headless Chrome on one laptop GPU. It says nothing about low-powered devices | Test on target hardware |
| Design-to-code | The comparison and analysis are tested with synthetic references. No external designer mock-up or Figma file was available, and Figma access is not implemented (it would go through a connector the user has authorised) | Run the loop against a real reference and tune thresholds |
| Templates and originality | There is one template per deliverable type. Different DNAs change colour, type, spacing, motion and artwork, but two projects scaffolded without further work share page structure. The skills instruct Claude to treat templates as a floor and to change composition per direction; that has been exercised for one client only | Build a second, contrasting client and compare fingerprints and structure |
| Creative quality | No claim is made that the output is better than other tools or agencies. There is no benchmark here that could support such a claim | Blind comparison by designers against agreed criteria |
| Upload guard hook | Pattern-based: it catches the common ways of uploading files from a shell and can be evaded deliberately | Rely on Claude Code permissions as the actual boundary |
| Vulnerability audit | Uses the package manager's audit and needs registry access; reported as blocked when offline. The final run found no advisories for the website, portal or scene and 4 moderate and 1 low in the mobile app's production tree (transitive dependencies of Expo and React Native) | Review `pnpm audit --prod` in `mobile/` and upgrade when fixes are released |
| Arabic copy | Written by the system and not reviewed by a native editor | Editorial review |
| Arabic logo | Arabic headlines in the brand applications are now shaped with HarfBuzz and outlined correctly. The logo itself is the Latin wordmark only, by the brand's own rule; no Arabic lockup was designed | Design an Arabic lockup if the client wants one |
| Android right-to-left | Layout mirrors immediately on iOS and the web; on Android a complete mirror needs `I18nManager.forceRTL` and a restart, which the template documents but does not automate | Add the restart flow |
| Product figures and testimonials in the demo | Placeholders and illustrative quotes, labelled as such on the page | Real content |

## Open design work from the latest independent review

The sixth review's major findings, none of them a blocker. Details and suggestions are in `demos/haldora/reviews/review-6-revise.json`.

| Finding | Where |
|---|---|
| The app dial's "In the battery" label touches the ring, the figure is not set in the mono face, the sun touches the ring, and the time stepper has no visible label | mobile app, Today |
| Stray arc fragments near the hero copy (a lone dash above the subhead at 1440, an arc ending mid-sky at 1024, faint dashes at 834 and 768) and a floating arc segment on the presentation title | website hero, `presentation-title.png`, `og-image.png` |
| The portal's forecast state is worded as fact ("the battery holds 83%") and keeps "so far today" | portal, Today with the time moved later |
| The full-bleed icon is used as the Android adaptive foreground, so Android's mask would crop the horizon | `mobile/app.json`, `mobile/assets/icon.png` |
| The 3D scene reads as a configurator, not a launch presentation: a simple model, heavy vents, a skewed floor, no brand mark or narrative; Dusk still reads ultramarine under its lighting | 3D scene |
| Arabic text below the guidelines' 14 px floor in places (scroll cue, portal phone tabs, small labels) | website and portal, Arabic |
| On phones the four feature illustrations repeat the story's landscapes, so eight similar sky tiles appear in one scroll | website, phone |

## Not implemented

| Area from the brief | Note |
|---|---|
| Flutter, SwiftUI, Jetpack Compose | Evaluated; Expo was chosen as the one validated mobile stack. The others are extension points only |
| React Three Fiber, Babylon.js, Spline, WebGPU | Plain Three.js with WebGL2 is implemented. WebGPU guidance could not be verified |
| Rive and Lottie runtimes | Described in the runtime ladder as extensions; nothing bundled or tested |
| Blender automation, texture baking, physics | The 3D pipeline is procedural geometry with untextured physically based materials. Blender is not installed here |
| Product configurator beyond finishes; particle systems; shader effects | The scene has a finish and time-of-day configurator only |
| Print production | No CMYK or spot values, no packaging dielines. The business card has bleed and crop marks in RGB |
| Trademark clearance | Never performed; stated in the brand guidelines and manifest |
| Background removal, upscaling, image editing, reference-guided generation | The provider contract has fields for them; no implementation |
| Other image providers (Gemini, fal, Replicate, local diffusion) | Only the procedural engine, OpenAI and the test mock exist |
| MCP server | Deliberately not shipped; see `docs/skills.md` |
| Multi-tenant service, client web portal, database | A project is a directory. Hosted, multi-client operation is a different product |
| E-commerce, editorial, media, authentication and API-integration templates | The web templates cover a marketing page and a data portal with a mock API |
| Storybook, component library export | Not included |
| `creative-studio research` that browses | The command records and validates findings; research itself is done by Claude with whatever web tools the session has |
| Schema migrations | The mechanism is described; none exists because no contract has had a breaking change |

## Environment the results come from

macOS 13 (Darwin 22.6) on an Intel Core i7-7700HQ with 16 GB of memory and under 3 GB of free disk; Node 22.14; Claude Code 2.1.322; Google Chrome driven headless with the Metal backend. Nothing was tested on Windows or Linux. The CLI uses only portable Node APIs, but paths, the system `unzip` cross-check and Chrome discovery have only been exercised on macOS.
