# Production workflows

Each workflow is run for real in the Haldora demonstration (`demos/haldora/`). Inputs are in `demos/haldora/inputs/`; `node scripts/run-demo.mjs --full` reproduces the outputs. Haldora is a fictional client; its approvals are recorded as simulated.

## A. Brand identity

1. Author `.cis/brand-spec.json`: strategy, wordmark, at least two concepts with rationale, the selection and its reason, applications.
2. `creative-studio brand build`
3. `creative-studio brand check`

The build outlines the wordmark from the DNA's display face, constructs each symbol from filled paths (so the one-colour version is the same geometry with holes), writes colour, reversed, mono-ink and mono-paper variants of symbol, wordmark, horizontal and stacked lockups with clear space built into the file, a favicon, 26 icons, applications (business card with 3 mm bleed and crop marks, social square, link preview, story, presentation title, app icon), PNG and WebP exports at exact sizes, vector PDFs, and guidelines in HTML and PDF. The manifest records integrity results for every vector master.

Not included: trademark clearance, CMYK or spot colour values, packaging dielines, Arabic wordmark outlines.

## B. Marketing website

1. Author `.cis/content-web.json` for every locale.
2. `creative-studio website scaffold`, then `npm install && npm run build` in `web/`.
3. `creative-studio test web`

The site is pre-rendered per locale (`/` and `/ar/`), so it is complete without JavaScript. Enhancements: a five-plane hero that drifts with scroll on wide screens (one composed image elsewhere); a scroll story in which the sun travels the day arc and frames cross-fade per chapter, scrubbed and reversible; count-up statistics; pointer-tracked cards; a lazily embedded 3D scene whose camera follows scroll; a validated contact form; light and dark schemes with a cross-fade. The animation library is downloaded only on wide screens with motion allowed.

## C. Web application

1. `creative-studio website scaffold --kind app`, then `npm install && npm test && npm run build` in `app/`.
2. `creative-studio test app`

Four routed sections with focus moved to each new heading; an animated day chart with series toggles, a keyboard-operable time slider and a table alternative; device list with loading, empty and error states and recovery; a sortable, filterable, paged table with `aria-sort`; settings with validation, optimistic save and rollback; right-to-left layout with left-to-right time axes; a bottom navigation bar on phones. `?scenario=slow|error|empty|save-error` exercises each state.

## D. Mobile application

1. `creative-studio mobile scaffold`, then `npm install` in `mobile/`.
2. `creative-studio test mobile`

Expo Router with a system tab bar and stack; an onboarding pager driven by a pan gesture on the UI thread; the day-arc dial animated with Reanimated; a draggable reserve slider with tap buttons and accessibility actions as alternatives; device list and detail; language switch to Arabic with layout mirroring; an offline banner. Verification: TypeScript, 19 Jest tests, Hermes bytecode bundles for iOS and Android, and seven browser flows against a web export of the same code. Native builds and device tests are reported as blocked where the toolchains are missing.

## E. 3D product experience

1. `creative-studio 3d build`, then `npm install && npm run build` in `scene/`.
2. `creative-studio test scene`

The model is generated from procedural geometry (rounded boxes, an arc tube, a sphere), given physically based materials from the DNA, optimised with meshopt and validated with the Khronos validator. The scene renders only when something changes, supports pointer, touch and keyboard orbit, a finish configurator, a time-of-day control that moves the sun along the arc on the product, and a scroll-driven camera when embedded. It falls back to a still image per finish when WebGL is unavailable, when the context is lost, or on request.

## F. Image and asset production

1. Author `.cis/image-brief.json`.
2. `creative-studio images generate`, then `creative-studio images verify`.

Nineteen jobs in the demo: hero planes, story frames, a brand pattern, feature illustrations, three campaign graphics with outlined logo and headline, an app-store graphic and a background. Each is produced at its exact size, converted, inspected and registered with provenance. Unchanged jobs are reused on later runs.

## G. Cross-disciplinary integration

The plan orders the work so shared decisions come first and the website waits for what it embeds. `creative-studio dna consistency` then proves the result: every deliverable's token file is byte-identical to what the current DNA generates and no deliverable's source uses a colour or typeface outside it. The signature device, the day arc, appears as the logo symbol, the hero and story artwork, the portal's chart, the app's dial and the light on the 3D product.

## Design to code

`creative-studio d2c analyze <reference.png>` then `creative-studio d2c compare <reference.png> --url <page> --out <dir>`: the implementation is rendered at the reference's exact size and compared pixel by pixel, with the worst regions named on an 8 by 8 grid and a heatmap written. Tested with synthetic references; see limitations.

## Revisions

`creative-studio revise add` records the request and what to preserve; `start` snapshots the project; the change is made by the smallest route; `verify` fails if anything outside the request's scope changed; a named person closes it.

## Delivery

`creative-studio export --draft` at any time; a final `creative-studio export` once QA is not failing, gate G6 is approved by a person, the ledger is intact and no asset is simulated or of unknown rights.
