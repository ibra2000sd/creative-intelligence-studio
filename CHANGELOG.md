# Changelog

All notable changes are recorded here. The project follows semantic versioning.

## 0.1.0 — 2026-11-13

First release.

### Changed after the first independent review
- Website: the scroll story draws one sun, between a sky layer and a ground layer, and a crescent at night; the hero has a night scene for the dark scheme; Arabic details (spec alignment, digits, type hierarchy).
- Portal: the chart's arc stands on sunrise and sunset with the sun above the time cursor; the page describes one moment, with the rest of the day drawn as a forecast; language and appearance in Settings; History fits a phone.
- 3D scene: neutral tone mapping so finishes match their tokens, a room setting, dark scheme followed live, captions coloured from the surface behind them, localised finish names, and `creative-studio 3d stills` to render fallback stills from the real model.
- Mobile app: text alignment in Arabic, a themed switch that stays inside its track, Latin digits.
- Brand: balanced headlines that keep clear of the sun, arc and stars; guideline pages for the signature device, type hierarchy, Arabic typography and layout.
- QA harness: full-page captures after scrolling the page through, at every viewport; dark captures compared with light; captures declared per deliverable for routes, chapters and app screens.
- After the fifth review: the embedded 3D product takes the full width on phones (a website flow checks it); "Reset view" no longer wraps; the hero's arc cut-outs reach from one block of copy to the next; the logo's arc feet sit inside the horizon; app and home-screen icon masters are full bleed (new `iconMarkup`, `logo/touch-icon.svg`); the History caption describes what is drawn; the app dial's ring sits clear of the horizon; daylight hills are drawn from the warm palette colours; the four "How it works" illustrations are one family of day scenes.
- After the fourth review: the embedded 3D configurator fits its frame (a compact embedded panel, and a website flow that fails if any control is cut off); no sun on the product after sunset; History tiles keep a constant dashed arc and show the day by the warmth of the sky, dated up to the day before the page's date; the portal's Today states the moment in one sentence with mono figures and shows the backup reserve; the app dial leads with the arc and labels its figure; the hero copy sits on clear sky above the hills; brand applications move a headline below the sun when it would cover it; the logo symbol's arc is continuous with the sun on it and stands on a horizon wider than its feet.
- Open design work from the third review: Arabic brand applications shaped with HarfBuzz (new optional engine `harfbuzzjs` 1.6.4) and a headline per application; arc line work drawn for the size a picture is shown at (`displayWidth`) and areas kept clear of stars and arc (`clearZones`); a crescent on the app dial at night and an amber sun in both schemes; the portal draws its chart at the width it is shown, carries a day band on every page and opens History with the last fortnight as small day arcs and readable dates; the app's Devices rows and detail screen are designed, with status pills, notes and the same four devices as the portal; the 3D product has a ventilation grille and a contact shadow; the Dusk finish is matte, changed through a DNA revision (r2) with its reason recorded.
- After the third review: the hero's arc and sun are separate image layers (new `track` and `sun` layers), so only the arc gives way to the copy; the layered hero composition is used from tablet width, which keeps the sun in frame; the 3D frame's width is pinned to its column (it overflowed at 1024 px); QA captures may set an exact window size, and the hero is captured at 834 and 1024 px; the duplicate check uses a finer, per-cell colour fingerprint.
- After the second review: the night marker is a crescent in every picture; `sunAt` places the sun or moon clear of copy; on phones the hero artwork is a band above the copy; on wider screens the hero arc is cut away behind the copy; guideline previews no longer share gradient ids (they showed the wrong sky); the product's arc light is dashed and stands on its horizon; the app translates device names and places and points its back arrow the right way in Arabic; full-page captures wait for each scroll step to render, and a capture with text still invisible fails; the local image engine's cache now includes the recipe code, so a drawing change regenerates the affected images.
- Image pipeline: a `ground` layer; duplicates are judged on colour and proportion as well as structure; `sameAs` declares an intentional twin.

### Added
- Claude Code plugin `creative-intelligence-studio`: 17 skills, 2 agents (`creative-reviewer`, `source-auditor`), 1 hook (upload guard).
- `creative-studio` CLI with 28 commands and a zero-dependency core; optional engines installed by `creative-studio setup`.
- 13 versioned JSON Schema contracts and a built-in validator.
- Orchestrator: classification, plan graph with handoff contracts and five approval gates, retries with escalation, recovery, hash-chained ledger, checkpoints.
- Experience DNA: semantic lint, tokens for web, React Native and 3D, revisions, fingerprint, cross-deliverable consistency.
- Delivery packages carry the independent creative review: its blocker and major findings are listed as open issues, and a blocker finding or a "rework" recommendation stops a final export.
- Brand engine, image engine with provider adapters (local procedural, OpenAI, mock), 3D asset pipeline.
- Templates: marketing website, web application, Expo mobile app, Three.js scene.
- QA harness, security and licence audit with SBOM, design-to-code comparison, revision management, export.
- Haldora demonstration, reproducible with `scripts/run-demo.mjs`.
- Test suites: unit, integration, security, end-to-end, regression.

### Known limitations
See `docs/limitations.md`.
