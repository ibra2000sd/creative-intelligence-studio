# Haldora launch: brand, site, portal, app and product experience: delivery package (DRAFT)

Client: Haldora (fictional, demonstration project). Generated 2026-11-13T17:55:29.680Z with creative-intelligence-studio 0.1.0. Experience DNA revision 2.

## Contents

- `deliverables/brand/`: Brand identity: logo system, icons, applications, guidelines (85 files)
- `deliverables/design-system/`: Design tokens for web, native and 3D (4 files)
- `deliverables/assets/`: Generated visual assets with sources (61 files)
- `deliverables/web/`: Marketing website: source and production build (257 files)
- `deliverables/app/`: Web application: source and production build (191 files)
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

Automated verdict: **incomplete** (279 pass, 0 fail, 16 warn, 2 blocked). Automated checks are evidence, not client acceptance.

Creative review by creative-reviewer agent (independent): recommendation **revise**; 0 blocker, 7 major, 19 minor finding(s). Full text in `evidence/creative-review.json`. A review is an evaluation, not an approval.

### Open issues and things automation could not check

- Gate G6-quality (quality evidence reviewed) has not been approved by a person.
- REVIEW MAJOR Mobile app Today dial (.cis/reports/qa/mobile/app-today.png, app-today-dark.png, app-today-evening.png): The label 'In the battery' is wider than the inside of the ring: its first and last letters sit on the iris ring stroke on both sides, in light, dark and evening. '91%' is set in the sans, not the mono that the DNA requi
- REVIEW MAJOR Website hero and exports, day arc against text (.cis/reports/qa/web/home-desktop.png, home-desktop-dark.png, home-ar-desktop.png, home-ar-de: Where the arc is masked around copy, it leaves orphan fragments. At 1440 a single dash sits just above 'A battery', where it reads like a stray accent mark (about x100,y450, both schemes). In Arabic the right leg touches
- REVIEW MAJOR Portal Today, forecast state (.cis/reports/qa/app/portal-forecast.png): When the scrubber is moved past 'Now' to 18:30, the large serif sentence says 'At 18:30 the battery holds 83%, the roof is making 0.2 kW and the home is using 2.3 kW' in the present tense. It also keeps 'Bought from the 
- REVIEW MAJOR Android launcher icon (mobile/app.json android.adaptiveIcon, mobile/assets/icon.png = brand/applications/png/app-icon.png): The adaptive icon's foreground is the full-bleed square amber icon, and its horizon bar runs to within about 4% of the edges. Android shows only the central safe zone of an adaptive foreground. In my circular-mask simula
- REVIEW MAJOR 3D product presentation (.cis/reports/qa/scene/scene-desktop.png, scene-desktop-dark.png, scene-evening.png, scene-finish-2.png, scene-finis: The brief asks for an interactive 3D presentation of the Cell. The scene is a utility configurator: a rounded box with an inset panel, a printed-looking arc and seven heavy black vent strokes, in front of a flat diagonal
- REVIEW MAJOR Arabic small text across web and portal (own render of web/dist/ar/ and app/dist/?lang=ar at 1440 and 390; visible in .cis/reports/qa/web/ho: The guidelines say Arabic is 'never set ... below 14px', and the brief asks for Arabic typography that is 'not an afterthought' and text 'readable at arm's length'. In my render the scroll cue 'مرّر لتتابع اليوم' and the
- REVIEW MAJOR Marketing page on phone: feature cards repeat the story art (.cis/reports/qa/web/home-mobile.png, home-mobile-dark.png, home-ar-mobile.png, : On a phone the four story chapters (sunrise, noon, sunset, night panels) are followed immediately by four feature cards that use the same four landscape panels. That makes eight near-identical sky tiles in one scroll. Th
- WARN app/a11y-axe:portal:light: 1 rule(s) axe could not decide and a person must check: color-contrast (6)
- WARN app/a11y-axe:portal:dark: 1 rule(s) axe could not decide and a person must check: color-contrast (6)
- WARN app/web-vitals-lab:portal: Lab: LCP 1064ms, CLS 0.0001, TBT 277ms, first tap 224ms (median of 5); first scripted tap took 224ms to paint under 4x throttling (the 200ms INP threshold applies to field data; investigate on a real device)
- WARN app/a11y-axe:portal-ar:light: 1 rule(s) axe could not decide and a person must check: color-contrast (4)
- WARN app/a11y-axe:portal-ar:dark: 1 rule(s) axe could not decide and a person must check: color-contrast (4)
- WARN app/web-vitals-lab:portal-ar: Lab: LCP 1056ms, CLS 0.0034, TBT 277ms, first tap 248ms (median of 5); first scripted tap took 248ms to paint under 4x throttling (the 200ms INP threshold applies to field data; investigate on a real device)
- BLOCKED mobile-native/native-ios:mobile: Native iOS build and simulator tests cannot run: full Xcode is not installed on this machine. Needs macOS with Xcode, then `npx expo run:ios`; store builds also need an Apple signing identity.
- BLOCKED mobile-native/native-android:mobile: Native Android build and emulator tests cannot run: the Android SDK is not installed on this machine. Needs Android Studio / SDK and an emulator or device, then `npx expo run:android`; store builds also need a signing keystore.
- WARN scene/a11y-axe:scene:light: 1 rule(s) axe could not decide and a person must check: color-contrast (1)
- WARN scene/a11y-axe:scene:dark: 1 rule(s) axe could not decide and a person must check: color-contrast (1)
- WARN scene/a11y-axe:scene-still:light: 1 rule(s) axe could not decide and a person must check: color-contrast (1)
- WARN scene/a11y-axe:scene-still:dark: 1 rule(s) axe could not decide and a person must check: color-contrast (1)
- WARN security/licences:web: 5 packages; needs a human licence decision: gsap (Standard 'no charge' license: https://gsap.com/standard-license.)
- WARN security/vulnerabilities:mobile: pnpm audit: 0 critical, 0 high, 4 moderate, 1 low (production dependencies)
- WARN web/a11y-axe:home:light: 1 rule(s) axe could not decide and a person must check: color-contrast (29)
- WARN web/a11y-axe:home:dark: 1 rule(s) axe could not decide and a person must check: color-contrast (29)
- WARN web/a11y-axe:home-ar:light: 1 rule(s) axe could not decide and a person must check: color-contrast (11)
- WARN web/a11y-axe:home-ar:dark: 1 rule(s) axe could not decide and a person must check: color-contrast (11)

### Still to be done by people

- Screen-reader walkthrough (VoiceOver, NVDA, TalkBack): automated rules cover only part of WCAG 2.2.
- Testing on real phones and a low-powered laptop: frame timing here comes from one desktop GPU.
- Field Core Web Vitals (75th percentile of real visits): only available after launch.
- Native iOS and Android builds, device gestures and store review.
- Copy review by a fluent Arabic editor and a legal review of claims.

## Rights

Asset origins and licences are in `project/asset-registry.json`; third-party software is listed in `evidence/licences.md`. No trademark clearance has been performed for names or marks in this package.
