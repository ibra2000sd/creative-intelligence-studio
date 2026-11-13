# Haldora launch: brand, site, portal, app and product experience: delivery package (DRAFT)

Client: Haldora (fictional, demonstration project). Generated 2026-11-13T13:02:35.125Z with creative-intelligence-studio 0.1.0. Experience DNA revision 1.

## Contents

- `deliverables/brand/`: Brand identity: logo system, icons, applications, guidelines (75 files)
- `deliverables/design-system/`: Design tokens for web, native and 3D (4 files)
- `deliverables/assets/`: Generated visual assets with sources (53 files)
- `deliverables/web/`: Marketing website: source and production build (227 files)
- `deliverables/app/`: Web application: source and production build (167 files)
- `deliverables/scene/`: 3D experience: source, model and production build (50 files)
- `deliverables/mobile/`: Mobile application: source and native JS bundles (73 files)
- `evidence/`: QA summary, security audit, licence list, SBOMs, consistency report
- `project/`: brief, Experience DNA and its history, plan and approvals, asset registry with provenance, event ledger, revisions
- `delivery-manifest.json`: every file with its size and SHA-256

## Approvals

| Gate | Status | Decided by |
|---|---|---|
| G0-brief: Brief, rights and approver confirmed | approved | Mira Solberg (fictional client) (client) **simulated** |
| G1-direction: Creative direction chosen by the client | approved | Mira Solberg (fictional client) (client) **simulated** |
| G2-system: Experience DNA and design system approved | approved | Mira Solberg (fictional client) (client) **simulated** |
| G6-quality: Quality evidence reviewed | pending | - |
| G7-acceptance: Client accepts the delivery | pending | - |

Gates marked simulated (G0-brief, G1-direction, G2-system) were recorded by a demonstration script, not by a client. They are not real approvals.

## Quality

Automated verdict: **incomplete** (278 pass, 0 fail, 16 warn, 2 blocked). Automated checks are evidence, not client acceptance.

Creative review by creative-reviewer agent (independent): recommendation **revise**; 0 blocker, 7 major, 13 minor finding(s). Full text in `evidence/creative-review.json`. A review is an evaluation, not an approval.

### Open issues and things automation could not check

- Gate G6-quality (quality evidence reviewed) has not been approved by a person.
- REVIEW MAJOR web home hero at tablet and small-laptop widths (home-tablet.png, home-ar-tablet.png; confirmed in own renders of web/dist at 768x1024, 834x: At 768 and 834px the hero picture is a band of hills with the horizon about 20% from the top. The sun is cropped off above the frame and only the two arc legs show as faint dots in the top corners, so the signature is mi
- REVIEW MAJOR day-arc stroke on phone and tablet (home-mobile.png, home-ar-mobile.png and their dark versions, home-tablet.png story cards and hero; brand: On desktop the story-card arc is a clear white dashed line (story-chapter-1.png). On phone and tablet the same arc is drawn as hairline dots that almost vanish against the sky. In the 06:10 card the sun seems to float wi
- REVIEW MAJOR portal Today on a phone (portal-mobile.png, portal-mobile-dark.png, portal-ar-mobile.png, portal-ar-mobile-dark.png, chart card): The 'The day so far' chart is the desktop SVG scaled into about 330x130px. Time labels (00:00, 06:00) and the 'Now' tag are about 4-5px, and the three series blur together. The brief asks for 'readable at arm's length' a
- REVIEW MAJOR portal History (portal-history.png, portal-history-mobile.png, portal-history-ar-mobile.png): History is a paginated admin table with ISO dates (2026-10-31), a free-text filter that asks for 'For example 2026-10', and kWh columns. Nothing of the direction appears: no day arc, no horizon, no curve, although the ho
- REVIEW MAJOR mobile app Devices and device detail (app-devices.png, app-devices-dark.png, app-devices-ar.png, app-device-detail*.png): The list is a single left-aligned stack of icon tile, name, location and status text: no cards, no dividers, no chevron, and more than half the screen empty. Nothing shows that the rows can be tapped. The detail screen s
- REVIEW MAJOR night and dark-scheme behaviour of the signature (brand/guidelines.html cover; app-today-evening.png; app-today-dark.png; app-web-mobile-dar: Several places break the guideline's own day-arc rules. The guidelines cover puts an amber sun with a brown halo on a night sky, while the rules say the sun is parchment against night skies and that at night there is no 
- REVIEW MAJOR 3D product presentation (scene-desktop.png, scene-finish-2.png, scene-finish-3.png, scene-evening.png, scene-mobile.png): The Cell is a plain rounded box with a printed arc decal and nothing else. There are no seams, no mounting, and nothing that makes it look like a product rather than a placeholder. It floats in front of the wall inside a
- WARN app/a11y-axe:portal:light: 1 rule(s) axe could not decide and a person must check: color-contrast (5)
- WARN app/a11y-axe:portal:dark: 1 rule(s) axe could not decide and a person must check: color-contrast (5)
- WARN app/web-vitals-lab:portal: Lab: LCP 1140ms, CLS 0.0004, TBT 273ms, first tap 232ms (median of 5); first scripted tap took 232ms to paint under 4x throttling (the 200ms INP threshold applies to field data; investigate on a real device)
- WARN app/a11y-axe:portal-ar:light: 1 rule(s) axe could not decide and a person must check: color-contrast (4)
- WARN app/a11y-axe:portal-ar:dark: 1 rule(s) axe could not decide and a person must check: color-contrast (4)
- WARN app/web-vitals-lab:portal-ar: Lab: LCP 1084ms, CLS 0.0006, TBT 289ms, first tap 248ms (median of 5); first scripted tap took 248ms to paint under 4x throttling (the 200ms INP threshold applies to field data; investigate on a real device)
- BLOCKED mobile-native/native-ios:mobile: Native iOS build and simulator tests cannot run: full Xcode is not installed on this machine. Needs macOS with Xcode, then `npx expo run:ios`; store builds also need an Apple signing identity.
- BLOCKED mobile-native/native-android:mobile: Native Android build and emulator tests cannot run: the Android SDK is not installed on this machine. Needs Android Studio / SDK and an emulator or device, then `npx expo run:android`; store builds also need a signing keystore.
- WARN scene/a11y-axe:scene:light: 1 rule(s) axe could not decide and a person must check: color-contrast (1)
- WARN scene/a11y-axe:scene:dark: 1 rule(s) axe could not decide and a person must check: color-contrast (1)
- WARN scene/a11y-axe:scene-still:light: 1 rule(s) axe could not decide and a person must check: color-contrast (1)
- WARN scene/a11y-axe:scene-still:dark: 1 rule(s) axe could not decide and a person must check: color-contrast (1)
- WARN security/licences:web: 5 packages; needs a human licence decision: gsap (Standard 'no charge' license: https://gsap.com/standard-license.)
- WARN security/vulnerabilities:mobile: pnpm audit: 0 critical, 0 high, 4 moderate, 1 low (production dependencies)
- WARN web/a11y-axe:home:light: 1 rule(s) axe could not decide and a person must check: color-contrast (27)
- WARN web/a11y-axe:home:dark: 1 rule(s) axe could not decide and a person must check: color-contrast (27)
- WARN web/a11y-axe:home-ar:light: 1 rule(s) axe could not decide and a person must check: color-contrast (10)
- WARN web/a11y-axe:home-ar:dark: 1 rule(s) axe could not decide and a person must check: color-contrast (10)

### Still to be done by people

- Screen-reader walkthrough (VoiceOver, NVDA, TalkBack): automated rules cover only part of WCAG 2.2.
- Testing on real phones and a low-powered laptop: frame timing here comes from one desktop GPU.
- Field Core Web Vitals (75th percentile of real visits): only available after launch.
- Native iOS and Android builds, device gestures and store review.
- Copy review by a fluent Arabic editor and a legal review of claims.

## Rights

Asset origins and licences are in `project/asset-registry.json`; third-party software is listed in `evidence/licences.md`. No trademark clearance has been performed for names or marks in this package.
