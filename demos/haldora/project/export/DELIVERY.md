# Haldora launch: brand, site, portal, app and product experience: delivery package (DRAFT)

Client: Haldora (fictional, demonstration project). Generated 2026-11-13T00:52:53.524Z with creative-intelligence-studio 0.1.0. Experience DNA revision 1.

## Contents

- `deliverables/brand/`: Brand identity: logo system, icons, applications, guidelines (75 files)
- `deliverables/design-system/`: Design tokens for web, native and 3D (4 files)
- `deliverables/assets/`: Generated visual assets with sources (33 files)
- `deliverables/web/`: Marketing website: source and production build (211 files)
- `deliverables/app/`: Web application: source and production build (131 files)
- `deliverables/scene/`: 3D experience: source, model and production build (44 files)
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

Automated verdict: **incomplete** (147 pass, 0 fail, 18 warn, 2 blocked). Automated checks are evidence, not client acceptance.

Creative review by creative-reviewer agent (independent): recommendation **revise**; 1 blocker, 13 major, 11 minor finding(s). Full text in `evidence/creative-review.json`. A review is an evaluation, not an approval.

### Open issues and things automation could not check

- Gate G6-quality (quality evidence reviewed) has not been approved by a person.
- The creative review by creative-reviewer agent recommends "revise" with 1 blocker finding(s); fix them and have the work reviewed again.
- REVIEW BLOCKER web: 'One day, four moments' scroll story, desktop, English and Arabic (home-ar-desktop.png, y about 1300-1800): The story frame shows two suns and two arcs at once. Each illustration already contains a sun with halo on a dotted arc, and a second, smaller sun on a dashed arc is drawn on top at a different position, plus a horizon r
- REVIEW MAJOR QA evidence: .cis/reports/qa/web/home-desktop.png and home-ar-desktop.png: The full-page captures do not show the page. From about y=4000 to y=7400 the image is empty paper: the 'How it works' cards, the Cell copy and specifications, the quotes and the contact form are missing because content t
- REVIEW MAJOR QA evidence: .cis/reports/qa/mobile/ (all four files): The mobile app is evidenced by a single screen. All four captures show onboarding page 1; app-web-desktop-dark.png is pixel-identical to app-web-desktop.png, so no dark state was captured; there is no Today dial, no Devi
- REVIEW MAJOR web: hero in the dark scheme (home-desktop-dark.png, home-ar-desktop-dark.png): Choosing the dark scheme leaves the entire first viewport bright cream: the two dark captures differ from the light ones only by the toggle icon. The stylesheet confirms this is intended ('fixed daylight scene'). It cont
- REVIEW MAJOR scene: dark scheme (scene-desktop-dark.png, scene-still-desktop-dark.png): Only the control panel goes dark. In scene-desktop-dark.png the stage stays cream and the help line 'Drag to turn. Scroll or pinch to zoom...' is set in the dark-scheme muted colour on cream, measured at 1.9:1, which is 
- REVIEW MAJOR scene: the Haldora Cell model and its still fallback (scene-desktop.png, scene-still-desktop.png): The product does not yet look like something a homeowner would want on a wall. The 'Chalk' finish renders as tan putty with brown shading (about #D0C0AC on the face against a #F6F1E7 token), the arc on the product is pal
- REVIEW MAJOR app (portal): 'The day so far' chart (portal-desktop.png, portal-ar-desktop.png, portal-tablet.png): The arc behind the chart is decoration that disagrees with the data in front of it. Its feet stand on 00:00 and 24:00, so against the time axis the sun rises at midnight. With the readout at 13:00 the time cursor sits at
- REVIEW MAJOR app (portal): Today screen data (portal-desktop.png and every portal capture): The demo data tells three stories. The header says 'Updated 08:02', the cards and 'Right now' show 13:00 values (roof 4.6 kW, battery 100%), and a chart titled 'The day so far' is drawn through to midnight. 'Battery 100%
- REVIEW MAJOR Arabic web page, the Cell section and story (home-ar-desktop.png; [Reviewer capture, not in the QA evidence set] lower sections): The Arabic page reads as mirrored English in its details. [Reviewer capture, not in the QA evidence set] specification values ('13.5 kWh', '5 kW', '< 30 dB') are left-aligned under right-aligned Arabic labels, so each la
- REVIEW MAJOR Arabic typography across web, portal and guidelines (home-ar-desktop.png, portal-ar-desktop.png, brand/guidelines.html Typography): The brief asks for 'Arabic typography that is not an afterthought'. One sans family, IBM Plex Sans Arabic, carries headlines, body and quotations, so the editorial contrast between serif statements and sans text that def
- REVIEW MAJOR mobile app in Arabic: Today and Settings: [Reviewer capture, not in the QA evidence set] rendering the web export at 390x844 and switching to Arabic shows layout faults. In Settings the Alerts switch thumb is drawn on top of the label text. On Today each flow ro
- REVIEW MAJOR app (portal) on a phone: language and History: portal-mobile.png and portal-tablet.png show no language switch; on desktop it sits at the foot of the sidebar, on small screens it is gone while the theme toggle is squeezed into the tab bar as an unlabelled fifth item.
- REVIEW MAJOR brand/guidelines.html: The guideline names the day arc as the signature but never specifies it: no geometry, dash pattern, sun sizes, positions by time of day, behaviour at night, or the rule that it stays left-to-right in Arabic. The delivera
- REVIEW MAJOR brand/applications/png/story.png and presentation-title.png: In story.png the sun disc and halo run into the headline: the last line, 'night', sits on the halo with its baseline touching the top of the disc, and the halo is cropped by the left edge. Both pieces break the headline 
- WARN app/a11y-axe:portal:light: 1 rule(s) axe could not decide and a person must check: color-contrast (4)
- WARN app/a11y-axe:portal:dark: 1 rule(s) axe could not decide and a person must check: color-contrast (4)
- WARN app/web-vitals-lab:portal: Lab: LCP 1248ms, CLS 0.0004, TBT 363ms, first tap 320ms (median of 5). Over the default budget (TBT 363ms > 300ms) but within this deliverable's documented exception: Application shell: evaluating the React runtime and rendering the first screen takes 0.5 to 0.7 seconds of main-thread time under 4x CPU throttling on the reference machine (more in Arabic, which loads an extra typeface) and no measurable blocking unthrottled. Users are signed-in customers on repeat visits with a warm cache. Next step if field data shows slow first interactions: route-level code splitting and deferring the chart until after first paint.
- WARN app/a11y-axe:portal-ar:light: 1 rule(s) axe could not decide and a person must check: color-contrast (4)
- WARN app/a11y-axe:portal-ar:dark: 1 rule(s) axe could not decide and a person must check: color-contrast (4)
- WARN app/web-vitals-lab:portal-ar: Lab: LCP 1700ms, CLS 0.0007, TBT 515ms, first tap 384ms (median of 5). Over the default budget (TBT 515ms > 300ms) but within this deliverable's documented exception: Application shell: evaluating the React runtime and rendering the first screen takes 0.5 to 0.7 seconds of main-thread time under 4x CPU throttling on the reference machine (more in Arabic, which loads an extra typeface) and no measurable blocking unthrottled. Users are signed-in customers on repeat visits with a warm cache. Next step if field data shows slow first interactions: route-level code splitting and deferring the chart until after first paint.
- BLOCKED mobile-native/native-ios:mobile: Native iOS build and simulator tests cannot run: full Xcode is not installed on this machine. Needs macOS with Xcode, then `npx expo run:ios`; store builds also need an Apple signing identity.
- BLOCKED mobile-native/native-android:mobile: Native Android build and emulator tests cannot run: the Android SDK is not installed on this machine. Needs Android Studio / SDK and an emulator or device, then `npx expo run:android`; store builds also need a signing keystore.
- WARN scene/a11y-axe:scene:light: 1 rule(s) axe could not decide and a person must check: color-contrast (1)
- WARN scene/a11y-axe:scene:dark: 1 rule(s) axe could not decide and a person must check: color-contrast (1)
- WARN scene/a11y-axe:scene-still:light: 1 rule(s) axe could not decide and a person must check: color-contrast (1)
- WARN scene/a11y-axe:scene-still:dark: 1 rule(s) axe could not decide and a person must check: color-contrast (1)
- WARN security/licences:web: 5 packages; needs a human licence decision: gsap (Standard 'no charge' license: https://gsap.com/standard-license.)
- WARN security/vulnerabilities:mobile: pnpm audit: 0 critical, 0 high, 4 moderate, 1 low (production dependencies)
- WARN web/a11y-axe:home:light: 1 rule(s) axe could not decide and a person must check: color-contrast (12)
- WARN web/a11y-axe:home:dark: 1 rule(s) axe could not decide and a person must check: color-contrast (12)
- WARN web/web-vitals-lab:home: Lab figures unreliable: host load was 3.07 per core and blocking time ranged 137 to 2273ms across five identical loads. Median LCP 952ms, CLS 0, TBT 316ms, first tap 272ms (median of 5) would be over budget (TBT 316ms > 300ms). Re-run on an idle machine before drawing a conclusion.
- WARN web/a11y-axe:home-ar:light: 1 rule(s) axe could not decide and a person must check: color-contrast (4)
- WARN web/a11y-axe:home-ar:dark: 1 rule(s) axe could not decide and a person must check: color-contrast (4)
- WARN web/web-vitals-lab:home-ar: Lab: LCP 1924ms, CLS 0.0123, TBT 150ms, first tap 208ms (median of 5); first scripted tap took 208ms to paint under 4x throttling (the 200ms INP threshold applies to field data; investigate on a real device)

### Still to be done by people

- Screen-reader walkthrough (VoiceOver, NVDA, TalkBack): automated rules cover only part of WCAG 2.2.
- Testing on real phones and a low-powered laptop: frame timing here comes from one desktop GPU.
- Field Core Web Vitals (75th percentile of real visits): only available after launch.
- Native iOS and Android builds, device gestures and store review.
- Copy review by a fluent Arabic editor and a legal review of claims.

## Rights

Asset origins and licences are in `project/asset-registry.json`; third-party software is listed in `evidence/licences.md`. No trademark clearance has been performed for names or marks in this package.
