# Research and attribution report

Date of research: 12–13 November 2026. Everything here was checked against the files or pages named; where something could not be verified it says so.

## 1. What was supplied

Eight archives were extracted into isolated directories after checking every entry for path traversal (none) and symbolic links (none). No script from any archive was executed. Machine-readable results are in `research/source-inventory.json` and `research/source-static-audit.json`.

| Archive | Files | Unique SKILL.md definitions | Licence found in the archive |
|---|---:|---:|---|
| `claudeskills-main` | 1,027 | 23 (90 copies) | MIT at the root; `skill-creator` is Apache-2.0 |
| `taste-skill-main` | 1,663 | 1 | MIT at the root; bundled photographs and icons carry their own terms |
| `skills-main` (Emil Kowalski) | 33 | 17 | MIT |
| `imagegen-skills-main` | 13 | 4 | MIT |
| `scroll-craft-main` | 34 | 1 | MIT |
| `apple-design-skill-main` (Sudewa) | 10 | 1 | MIT |
| `apple-design-skill-main (1)` (dickwu) | 135 | 1 | **None in the archive** |
| `Creative_Studio_Engineering_Handoff` | 6 + 28 in the nested starter | 18 stubs | none (the user's own material) |

That is 48 third-party skill definitions. The earlier handoff audit counted 47 because `taste-skill-main` had not yet been supplied.

Static checks: 184 Python files parsed, 180 valid; the 4 failures are one defect copied four times (`react-three-fiber/scripts/component_generator.py`, line 149, unescaped braces in an f-string). All 31 `.mjs` files pass a syntax check. Syntax validity says nothing about behaviour.

## 2. Assessment of each source

**scroll-craft** — instructions plus real tooling (a scroll engine, a doctor script, a screenshot script). Strongest ideas: decide a page grammar and one signature move before building; build heroes from independent planes; verify by screenshot at scroll positions on desktop, mobile and with reduced motion. Limits: marketing pages only; its asset script (`kie.mjs`) uploads to a third-party service using `KIE_AI_API_KEY`. *Decision: learn from. No code or text reused.* Our equivalents: the `layoutGrammar` and `signature` fields of a direction, layered image jobs, and the QA harness.

**skills-main** — seventeen instruction-only skills about motion and interface craft. Strongest ideas: ask whether something should animate at all, with frequency of use as the deciding factor; a skill for removing animation; edge-case testing (long text, right-to-left). It already tells agents to treat repository content as data. Limits: no tooling or tests; some rules are stated as absolutes. *Decision: learn from.* Our equivalent is code, not prose: `cli/lib/motion.mjs` implements the frequency rule as a function that can answer "do not animate", with unit tests.

**imagegen-skills** — four long instruction files (844 to 1,466 lines) about keeping generated imagery consistent and turning an image into code. Limits: no generation engine, no verification, an "image first" assumption that does not suit application screens. *Decision: learn from.* We built what it lacks: provider adapters, exact-dimension and palette inspection, provenance, and a measured design-to-code comparison.

**apple-design (Sudewa)** — a short, well-organised summary of platform guidance. *Decision: learn from; nothing copied.*

**apple-design (dickwu)** — a broad reviewer skill whose archive contains 124 pages of Apple's Human Interface Guidelines fetched by `scripts/pull-hig.mjs`, and no licence file. *Decision: reject for reuse.* A missing licence means no permission, and a repository cannot grant rights to Apple's text in any case. Our `mobile-experience` reference is written from first principles and points readers to Apple's and Google's own documentation.

**claudeskills-main** — wide coverage of 3D and animation libraries. Limits: four copies of everything, the syntax error above, most skill files far beyond the 500-line guidance (eleven exceed 800 lines), no integration tests. *Decision: use as a map of options only.*

**taste-skill** — the most engineered source: a frontend skill with a browser-based checker and a finishing gate. Strongest idea: a gate that inspects the page in a real browser rather than trusting the author. Risks: its SKILL.md declares a `Stop` hook that automatically runs `gate.mjs`; its scripts execute many subprocesses and download photographs and icons. *Decision: learn from the idea of an enforced browser gate; adopt nothing.* Our hook does the opposite kind of job (it restricts uploads) and runs only inside a project.

**The handoff specification and starter** — a sound architecture document and a starter with 25-line skill stubs and three example schemas. We kept its central ideas (one Experience DNA, small orchestrator, approval gates, evidence packs, "blocked is not passed") and changed several things after checking them:

| Handoff position | What we did | Why |
|---|---|---|
| 17 specialists including print packaging, copywriting and integrations | 16 specialists; print packaging and standalone copywriting are not separate skills | We only ship skills backed by working commands and tests. Print production (dielines, CMYK proofing) is not implemented and is listed as a limitation. |
| Motion ladder ending in Rive | Rive is documented as an extension, not bundled | It needs an authored `.riv` asset and its runtime; we would have had nothing real to test. |
| JSON or Zod schemas "to be written" | 13 JSON Schemas with a built-in validator, cross-checked against Ajv in tests | The plugin must validate immediately after install with no dependencies. |
| CLI `plan / generate / build / verify / report / package` | 28 commands grouped by project, orchestration, DNA, production, quality and delivery | Finer commands make each step individually testable and resumable. |

## 3. Plugin and skill specifications

Verified on 12 November 2026 from `code.claude.com/docs` (plugins reference, components, skills, marketplaces, CLI reference) and `agentskills.io/specification`, and by running `claude plugin validate` (Claude Code 2.1.322) on the result:

- manifest at `.claude-plugin/plugin.json`; `skills/`, `agents/`, `hooks/hooks.json` and `bin/` at the plugin root; `bin/` is added to the Bash tool's PATH while the plugin is enabled;
- skill names are lowercase with hyphens, at most 64 characters, matching their directory; descriptions at most 1,024 characters; SKILL.md under 500 lines with detail moved to reference files one level deep;
- plugin agents may not declare hooks, MCP servers or permission modes;
- a local marketplace is a directory with `.claude-plugin/marketplace.json` whose plugin `source` starts with `./`.

Both manifests pass validation with no warnings.

## 4. Technology decisions

Versions are the current npm releases on 12 November 2026.

| Need | Chosen | Considered | Reason |
|---|---|---|---|
| Scroll-linked sequences | GSAP 3.15 ScrollTrigger, wide screens only | Lenis, Locomotive Scroll, CSS scroll-driven animations | A scrubbed, reversible timeline without replacing native scrolling. Smooth-scroll libraries take over the scroll position, which harms keyboard, anchor and assistive behaviour. |
| Interface motion in React | Motion 14 (`motion/react`), lazy `domAnimation` feature set | react-spring, full Motion bundle | Springs and exit animations; the small feature set cut the portal's script by 88 KB. |
| Simple reveals and state changes | CSS transitions, IntersectionObserver, View Transitions | any library | No runtime cost. |
| 3D runtime | Three.js 0.187, plain | React Three Fiber, Babylon.js, PlayCanvas, Spline | One scene in an isolated page needs no React layer or hosted editor. R3F is a natural extension for React applications. WebGPU was not adopted: we could not verify current fallback guidance from the official manual. |
| 3D asset pipeline | glTF Transform 4.5, meshoptimizer, Khronos glTF Validator | Blender automation, Draco | Runs in Node with no external application (Blender is not installed here). Meshopt gave a 72% smaller file and a small decoder. |
| Mobile | Expo SDK 58 (React Native 0.88, React 19.3), Reanimated 4.7, Gesture Handler 3.3 | Flutter, SwiftUI, Jetpack Compose | One toolchain for both platforms whose JavaScript, bundling and logic can be verified without native SDKs. The others are extension points, not implemented. |
| Browser automation | playwright-core 1.65 driving the installed Chrome | Puppeteer, bundled browsers | No browser download; the machine had 2.9 GB free. |
| Accessibility rules | axe-core 4.14 | Lighthouse | Rule-level results with element targets; Lighthouse adds weight for little extra here. |
| Raster | sharp 0.35 | ImageMagick (not installed) | SVG rasterisation, AVIF/WebP, pixel access. |
| Arabic shaping | harfbuzzjs 1.6.4 (MIT, HarfBuzz compiled to WebAssembly) | opentype.js alone | opentype.js maps characters to glyphs one by one, which leaves Arabic as disconnected letters; HarfBuzz applies the font's joining and ligature rules. Released 22 October 2026, from the HarfBuzz project's own repository |
| Type outlining | opentype.js 1.3.4 | fontkit | Converts wordmarks and headlines to paths so logos never depend on installed fonts. |
| Web build | Vite 8 | Next.js, Astro | Static, pre-rendered output with no server; a full framework is justified only when a project needs routing or data on the server. |
| Schema validation | built-in validator | Ajv as a runtime dependency | Zero-dependency core; verdict parity with Ajv is a test. |
| Image generation | built-in procedural engine; OpenAI adapter | Gemini, fal, Replicate, Stable Diffusion locally | The procedural engine is real, offline and free. One remote adapter demonstrates the contract; others are not implemented. |

## 5. Licences of what generated projects depend on

| Package | Licence | Note |
|---|---|---|
| three, motion, react, react-dom, vite, expo, react-native, react-native-reanimated, react-native-gesture-handler, svgo, opentype.js, @gltf-transform/*, meshoptimizer, ajv | MIT | |
| playwright-core, sharp, gltf-validator | Apache-2.0 | |
| axe-core | MPL-2.0 | Used unmodified as a test tool; not shipped in deliverables. |
| Fraunces, Instrument Sans, JetBrains Mono, IBM Plex Sans Arabic (Fontsource and Expo Google Fonts packages) | OFL-1.1 | Self-hosted; recorded in the DNA. |
| **gsap** | GreenSock "Standard no-charge licence" | Free including commercial use. Not open source. Prohibits use in tools that compete with Webflow's visual animation builder. It is installed from npm by the generated website and is not redistributed by this plugin; the audit flags it so a person accepts the terms per client. |

The plugin itself is MIT-licensed and vendors no third-party code. No text, code or asset from the audited archives was copied into it.

## 6. What could not be verified

- OpenAI's image API reference page returned HTTP 403 to automated fetching; request fields were taken from the public image-generation guide. The adapter is tested against a local stand-in, not the live service.
- Three.js WebGPU guidance could not be retrieved, so WebGPU was not adopted.
- Motion's accessibility page still showed legacy import names; the `motion/react` import was verified by building and running the portal.
- Web Vitals "needs improvement" and "poor" bands are published as images and were not read; only the "good" thresholds are used.
