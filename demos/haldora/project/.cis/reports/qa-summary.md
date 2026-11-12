# QA summary

Generated 2026-11-12T22:51:20.791Z by creative-studio 0.1.0. Verdict: **fail**.

Pass 153 · Fail 5 · Warn 4 · Blocked 2 · Skipped 0

Measurements labelled *lab* were taken in headless Chrome on the build machine. They are not field data and say nothing about real users' devices or networks.

## app (web-app)

| Status | Check | Category | Result |
|---|---|---|---|
| pass | `build:app` | build (static) | Built output present at app/dist |
| pass | `bundle:app` | performance (static) | JS 112.6KB gzip, CSS 5.3KB gzip, 69 files, 4.42MB on disk |
| pass | `load:portal@mobile` | functional (lab) | No console errors, exceptions, failed requests or broken images |
| pass | `layout:portal@mobile` | visual (lab) | No horizontal overflow or clipped text |
| pass | `visual-regression:portal@mobile` | visual (lab) | Matches the accepted baseline (0.000% difference) |
| pass | `target-size:portal@mobile` | accessibility (lab) | All pointer targets are at least 24x24 CSS px |
| pass | `load:portal@tablet` | functional (lab) | No console errors, exceptions, failed requests or broken images |
| pass | `layout:portal@tablet` | visual (lab) | No horizontal overflow or clipped text |
| pass | `visual-regression:portal@tablet` | visual (lab) | Matches the accepted baseline (0.000% difference) |
| pass | `load:portal@desktop` | functional (lab) | No console errors, exceptions, failed requests or broken images |
| pass | `layout:portal@desktop` | visual (lab) | No horizontal overflow or clipped text |
| pass | `visual-regression:portal@desktop` | visual (lab) | Matches the accepted baseline (0.000% difference) |
| pass | `a11y-axe:portal:light` | accessibility (lab) | No WCAG 2.2 A/AA violations detectable by axe-core (1 item(s) need manual review) |
| pass | `a11y-axe:portal:dark` | accessibility (lab) | No WCAG 2.2 A/AA violations detectable by axe-core (1 item(s) need manual review) |
| pass | `keyboard:portal` | accessibility (lab) | 14 tab stops reached in order, each with a visible focus indicator and none obscured |
| pass | `scroll-motion:portal` | motion (lab) | Scrolling 55px: median frame 16.7ms, p95 16.7ms, 0 of 151 frames over 33ms, layout shift 0 |
| pass | `reduced-motion:portal` | motion (lab) | With reduced motion: no long-running animation, no scroll-linked engine loaded, all content visible |
| warn | `web-vitals-lab:portal` | performance (lab) | Lab: LCP 1680ms, CLS 0.0009, TBT 515ms, first tap 384ms (median of 3). Over the default budget (TBT 515ms > 300ms) but within this deliverable's documented exception: Application shell: evaluating the React runtime and rendering the first screen takes roughly 0.5 seconds of main-thread time under 4x CPU throttling on the reference machine and no measurable blocking unthrottled. Users are signed-in customers on repeat visits with a warm cache. Reduce further with route-level code splitting if field data shows slow first interactions. |
| pass | `load:portal-ar@mobile` | functional (lab) | No console errors, exceptions, failed requests or broken images |
| pass | `layout:portal-ar@mobile` | visual (lab) | No horizontal overflow or clipped text |
| pass | `rtl:portal-ar@mobile` | visual (lab) | Document direction is rtl (computed rtl), language ar |
| pass | `visual-regression:portal-ar@mobile` | visual (lab) | Matches the accepted baseline (0.000% difference) |
| pass | `target-size:portal-ar@mobile` | accessibility (lab) | All pointer targets are at least 24x24 CSS px |
| pass | `load:portal-ar@tablet` | functional (lab) | No console errors, exceptions, failed requests or broken images |
| pass | `layout:portal-ar@tablet` | visual (lab) | No horizontal overflow or clipped text |
| pass | `rtl:portal-ar@tablet` | visual (lab) | Document direction is rtl (computed rtl), language ar |
| pass | `visual-regression:portal-ar@tablet` | visual (lab) | Matches the accepted baseline (0.000% difference) |
| pass | `load:portal-ar@desktop` | functional (lab) | No console errors, exceptions, failed requests or broken images |
| pass | `layout:portal-ar@desktop` | visual (lab) | No horizontal overflow or clipped text |
| pass | `rtl:portal-ar@desktop` | visual (lab) | Document direction is rtl (computed rtl), language ar |
| pass | `visual-regression:portal-ar@desktop` | visual (lab) | Matches the accepted baseline (0.000% difference) |
| pass | `a11y-axe:portal-ar:light` | accessibility (lab) | No WCAG 2.2 A/AA violations detectable by axe-core (1 item(s) need manual review) |
| pass | `a11y-axe:portal-ar:dark` | accessibility (lab) | No WCAG 2.2 A/AA violations detectable by axe-core (1 item(s) need manual review) |
| pass | `keyboard:portal-ar` | accessibility (lab) | 14 tab stops reached in order, each with a visible focus indicator and none obscured |
| pass | `scroll-motion:portal-ar` | motion (lab) | Scrolling 69px: median frame 16.7ms, p95 16.7ms, 0 of 151 frames over 33ms, layout shift 0 |
| pass | `reduced-motion:portal-ar` | motion (lab) | With reduced motion: no long-running animation, no scroll-linked engine loaded, all content visible |
| fail | `web-vitals-lab:portal-ar` | performance (lab) | Over budget in the lab: TBT 676ms > 650ms |
| pass | `flow:navigation` | functional (lab) | Every section is reachable, updates the title and moves focus to its heading |
| pass | `flow:chart-scrub` | motion (lab) | The time slider drives the readout, the cursor and the sun on its arc: battery 30% at 07:00, 100% at 13:00, 39% at 22:00 |
| pass | `flow:chart-alternatives` | accessibility (lab) | Chart series can be toggled and the data is available as a table |
| pass | `flow:devices-states` | functional (lab) | Devices: loading state, list, and an accessible expand/collapse |
| pass | `flow:devices-error-recovery` | functional (lab) | Devices: a failed request shows an error and Try again recovers |
| pass | `flow:devices-empty` | functional (lab) | Devices: the empty state explains itself |
| pass | `flow:history-table` | functional (lab) | History: sorting announces its direction; filter, empty result and paging work |
| pass | `flow:settings-save` | functional (lab) | Settings: validation, save confirmation, and the reserve reaches the overview |
| pass | `flow:settings-rollback` | functional (lab) | Settings: a failed save reports the failure and restores the previous values |
| pass | `flow:rtl-layout` | functional (lab) | Arabic: navigation sits on the right, the chart keeps time left to right |
| pass | `flow:mobile-nav` | functional (lab) | Phone: bottom navigation is reachable and content clears it |
| pass | `flow:reduced-motion` | motion (lab) | Reduced motion: figures and markers change without travelling |

## mobile-native (mobile)

| Status | Check | Category | Result |
|---|---|---|---|
| pass | `typecheck:mobile` | build (static) | TypeScript type check: ok |
| pass | `unit-tests:mobile` | functional (static) | Jest unit and component tests: ok (19 passed, 19 total) |
| pass | `bundles:mobile` | build (static) | Production JS bundles exist for iOS and Android (ios 3.85MB, android 3.84MB) |
| blocked | `native-ios:mobile` | build (manual-required) | Native iOS build and simulator tests cannot run: full Xcode is not installed on this machine. Needs macOS with Xcode, then `npx expo run:ios`; store builds also need an Apple signing identity. |
| blocked | `native-android:mobile` | build (manual-required) | Native Android build and emulator tests cannot run: the Android SDK is not installed on this machine. Needs Android Studio / SDK and an emulator or device, then `npx expo run:android`; store builds also need a signing keystore. |

## mobile-web (mobile-web)

| Status | Check | Category | Result |
|---|---|---|---|
| pass | `build:mobile` | build (static) | Built output present at mobile/dist-web |
| warn | `bundle:mobile` | performance (static) | JS 530KB gzip > 300KB |
| pass | `load:app-web@mobile` | functional (lab) | No console errors, exceptions, failed requests or broken images |
| pass | `layout:app-web@mobile` | visual (lab) | No horizontal overflow or clipped text |
| pass | `visual-regression:app-web@mobile` | visual (lab) | Matches the accepted baseline (0.000% difference) |
| pass | `target-size:app-web@mobile` | accessibility (lab) | All pointer targets are at least 24x24 CSS px |
| pass | `load:app-web@tablet` | functional (lab) | No console errors, exceptions, failed requests or broken images |
| pass | `layout:app-web@tablet` | visual (lab) | No horizontal overflow or clipped text |
| pass | `visual-regression:app-web@tablet` | visual (lab) | Matches the accepted baseline (0.000% difference) |
| pass | `load:app-web@desktop` | functional (lab) | No console errors, exceptions, failed requests or broken images |
| pass | `layout:app-web@desktop` | visual (lab) | No horizontal overflow or clipped text |
| pass | `visual-regression:app-web@desktop` | visual (lab) | Matches the accepted baseline (0.000% difference) |
| pass | `a11y-axe:app-web:light` | accessibility (lab) | No WCAG 2.2 A/AA violations detectable by axe-core (0 item(s) need manual review) |
| pass | `a11y-axe:app-web:dark` | accessibility (lab) | No WCAG 2.2 A/AA violations detectable by axe-core (0 item(s) need manual review) |
| pass | `keyboard:app-web` | accessibility (lab) | 2 tab stops reached in order, each with a visible focus indicator and none obscured |
| pass | `reduced-motion:app-web` | motion (lab) | With reduced motion: no long-running animation, no scroll-linked engine loaded, all content visible |
| pass | `flow:onboarding-swipe` | motion (lab) | Onboarding: a horizontal drag turns the page and the indicator follows: Page 1 of 3 -> Page 2 of 3 -> back |
| pass | `flow:onboarding-buttons` | functional (lab) | Onboarding: Next walks every page and Get started opens the app |
| pass | `flow:tabs-and-detail` | functional (lab) | Tabs switch screens; a device opens its detail and Back returns |
| pass | `flow:time-stepper` | motion (lab) | Today: stepping time updates the clock, the state line and the dial description |
| pass | `flow:reserve-slider` | functional (lab) | Settings: the reserve responds to dragging and to the single-tap buttons: 30 -> 35 by tap -> 90 by drag |
| pass | `flow:offline-reconnect` | functional (lab) | Offline: a banner explains the state and Reconnect clears it |
| pass | `flow:arabic` | functional (lab) | Language: switching to Arabic translates the interface and mirrors the layout |

## scene (scene-3d)

| Status | Check | Category | Result |
|---|---|---|---|
| pass | `build:scene` | build (static) | Built output present at scene/dist |
| pass | `bundle:scene` | performance (static) | JS 167.5KB gzip, CSS 2.6KB gzip, 22 files, 1.11MB on disk |
| pass | `load:scene@mobile` | functional (lab) | No console errors, exceptions, failed requests or broken images |
| pass | `layout:scene@mobile` | visual (lab) | No horizontal overflow or clipped text |
| fail | `visual-regression:scene@mobile` | visual (lab) | 13.25% of pixels differ from the accepted baseline |
| pass | `target-size:scene@mobile` | accessibility (lab) | All pointer targets are at least 24x24 CSS px |
| pass | `load:scene@tablet` | functional (lab) | No console errors, exceptions, failed requests or broken images |
| pass | `layout:scene@tablet` | visual (lab) | No horizontal overflow or clipped text |
| fail | `visual-regression:scene@tablet` | visual (lab) | 12.38% of pixels differ from the accepted baseline |
| pass | `load:scene@desktop` | functional (lab) | No console errors, exceptions, failed requests or broken images |
| pass | `layout:scene@desktop` | visual (lab) | No horizontal overflow or clipped text |
| fail | `visual-regression:scene@desktop` | visual (lab) | 11.52% of pixels differ from the accepted baseline |
| pass | `a11y-axe:scene:light` | accessibility (lab) | No WCAG 2.2 A/AA violations detectable by axe-core (1 item(s) need manual review) |
| pass | `a11y-axe:scene:dark` | accessibility (lab) | No WCAG 2.2 A/AA violations detectable by axe-core (1 item(s) need manual review) |
| pass | `keyboard:scene` | accessibility (lab) | 4 tab stops reached in order, each with a visible focus indicator and none obscured |
| pass | `reduced-motion:scene` | motion (lab) | With reduced motion: no long-running animation, no scroll-linked engine loaded, all content visible |
| fail | `web-vitals-lab:scene` | performance (lab) | Over budget in the lab: TBT 1091ms > 300ms |
| pass | `load:scene-still@mobile` | functional (lab) | No console errors, exceptions, failed requests or broken images |
| pass | `layout:scene-still@mobile` | visual (lab) | No horizontal overflow or clipped text |
| pass | `visual-regression:scene-still@mobile` | visual (lab) | Matches the accepted baseline (0.000% difference) |
| pass | `target-size:scene-still@mobile` | accessibility (lab) | All pointer targets are at least 24x24 CSS px |
| pass | `load:scene-still@tablet` | functional (lab) | No console errors, exceptions, failed requests or broken images |
| pass | `layout:scene-still@tablet` | visual (lab) | No horizontal overflow or clipped text |
| pass | `visual-regression:scene-still@tablet` | visual (lab) | Matches the accepted baseline (0.000% difference) |
| pass | `load:scene-still@desktop` | functional (lab) | No console errors, exceptions, failed requests or broken images |
| pass | `layout:scene-still@desktop` | visual (lab) | No horizontal overflow or clipped text |
| pass | `visual-regression:scene-still@desktop` | visual (lab) | Matches the accepted baseline (0.000% difference) |
| pass | `a11y-axe:scene-still:light` | accessibility (lab) | No WCAG 2.2 A/AA violations detectable by axe-core (1 item(s) need manual review) |
| pass | `a11y-axe:scene-still:dark` | accessibility (lab) | No WCAG 2.2 A/AA violations detectable by axe-core (1 item(s) need manual review) |
| pass | `keyboard:scene-still` | accessibility (lab) | 1 tab stops reached in order, each with a visible focus indicator and none obscured |
| pass | `reduced-motion:scene-still` | motion (lab) | With reduced motion: no long-running animation, no scroll-linked engine loaded, all content visible |
| pass | `web-vitals-lab:scene-still` | performance (lab) | Lab: LCP 452ms, CLS 0, TBT 0ms |
| pass | `flow:renders-webgl` | functional (lab) | The model loads and renders with WebGL: 7982 triangles in 8 draw calls; 25 distinct tones read back from the canvas |
| pass | `flow:idle-costs-nothing` | performance (lab) | No frames are rendered while nothing changes |
| pass | `flow:finish-configurator` | functional (lab) | Choosing a finish changes the product material: #f6f1e7 -> #2a2d66 |
| pass | `flow:time-of-day` | functional (lab) | The time slider moves the sun along the arc on the product |
| pass | `flow:pointer-orbit` | functional (lab) | Dragging turns the product, within limits |
| pass | `flow:keyboard-orbit` | accessibility (lab) | Arrow keys turn and zoom the product (keyboard alternative to dragging) |
| pass | `flow:scroll-camera` | motion (lab) | Embedded mode: progress messages drive the camera choreography |
| pass | `flow:still-fallback` | functional (lab) | Still-image mode works without WebGL and keeps the configurator |
| pass | `flow:context-loss` | functional (lab) | A lost WebGL context degrades to the still image |
| pass | `flow:resource-cleanup` | performance (lab) | Disposing the scene releases GPU geometry and textures: 8 geometries and 2 textures released |

## web (website)

| Status | Check | Category | Result |
|---|---|---|---|
| pass | `build:web` | build (static) | Built output present at web/dist |
| pass | `bundle:web` | performance (static) | JS 48.0KB gzip, CSS 5.4KB gzip, 72 files, 4.43MB on disk |
| pass | `load:home@mobile` | functional (lab) | No console errors, exceptions, failed requests or broken images |
| pass | `layout:home@mobile` | visual (lab) | No horizontal overflow or clipped text |
| pass | `visual-regression:home@mobile` | visual (lab) | Matches the accepted baseline (0.174% difference) |
| pass | `target-size:home@mobile` | accessibility (lab) | All pointer targets are at least 24x24 CSS px |
| pass | `load:home@tablet` | functional (lab) | No console errors, exceptions, failed requests or broken images |
| pass | `layout:home@tablet` | visual (lab) | No horizontal overflow or clipped text |
| pass | `visual-regression:home@tablet` | visual (lab) | Matches the accepted baseline (0.000% difference) |
| pass | `load:home@desktop` | functional (lab) | No console errors, exceptions, failed requests or broken images |
| pass | `layout:home@desktop` | visual (lab) | No horizontal overflow or clipped text |
| pass | `visual-regression:home@desktop` | visual (lab) | Matches the accepted baseline (0.668% difference) |
| pass | `a11y-axe:home:light` | accessibility (lab) | No WCAG 2.2 A/AA violations detectable by axe-core (1 item(s) need manual review) |
| pass | `a11y-axe:home:dark` | accessibility (lab) | No WCAG 2.2 A/AA violations detectable by axe-core (1 item(s) need manual review) |
| pass | `keyboard:home` | accessibility (lab) | 14 tab stops reached in order, each with a visible focus indicator and none obscured |
| pass | `scroll-motion:home` | motion (lab) | Scrolling 6967px: median frame 16.7ms, p95 16.7ms, 1 of 455 frames over 33ms, layout shift 0 |
| pass | `reduced-motion:home` | motion (lab) | With reduced motion: no long-running animation, no scroll-linked engine loaded, all content visible |
| warn | `web-vitals-lab:home` | performance (lab) | Lab: LCP 1168ms, CLS 0, TBT 225ms, first tap 232ms (median of 3); first scripted tap took 232ms to paint under 4x throttling (the 200ms INP threshold applies to field data; investigate on a real device) |
| pass | `load:home-ar@mobile` | functional (lab) | No console errors, exceptions, failed requests or broken images |
| pass | `layout:home-ar@mobile` | visual (lab) | No horizontal overflow or clipped text |
| pass | `rtl:home-ar@mobile` | visual (lab) | Document direction is rtl (computed rtl), language ar |
| pass | `visual-regression:home-ar@mobile` | visual (lab) | Matches the accepted baseline (0.223% difference) |
| pass | `target-size:home-ar@mobile` | accessibility (lab) | All pointer targets are at least 24x24 CSS px |
| pass | `load:home-ar@tablet` | functional (lab) | No console errors, exceptions, failed requests or broken images |
| pass | `layout:home-ar@tablet` | visual (lab) | No horizontal overflow or clipped text |
| pass | `rtl:home-ar@tablet` | visual (lab) | Document direction is rtl (computed rtl), language ar |
| pass | `visual-regression:home-ar@tablet` | visual (lab) | Matches the accepted baseline (0.000% difference) |
| pass | `load:home-ar@desktop` | functional (lab) | No console errors, exceptions, failed requests or broken images |
| pass | `layout:home-ar@desktop` | visual (lab) | No horizontal overflow or clipped text |
| pass | `rtl:home-ar@desktop` | visual (lab) | Document direction is rtl (computed rtl), language ar |
| pass | `visual-regression:home-ar@desktop` | visual (lab) | Matches the accepted baseline (0.579% difference) |
| pass | `a11y-axe:home-ar:light` | accessibility (lab) | No WCAG 2.2 A/AA violations detectable by axe-core (1 item(s) need manual review) |
| pass | `a11y-axe:home-ar:dark` | accessibility (lab) | No WCAG 2.2 A/AA violations detectable by axe-core (1 item(s) need manual review) |
| pass | `keyboard:home-ar` | accessibility (lab) | 14 tab stops reached in order, each with a visible focus indicator and none obscured |
| pass | `scroll-motion:home-ar` | motion (lab) | Scrolling 6914px: median frame 16.7ms, p95 16.7ms, 2 of 437 frames over 33ms, layout shift 0 |
| pass | `reduced-motion:home-ar` | motion (lab) | With reduced motion: no long-running animation, no scroll-linked engine loaded, all content visible |
| warn | `web-vitals-lab:home-ar` | performance (lab) | Lab: LCP 1468ms, CLS 0.0123, TBT 200ms, first tap 248ms (median of 3); first scripted tap took 248ms to paint under 4x throttling (the 200ms INP threshold applies to field data; investigate on a real device) |
| pass | `flow:nav-anchors` | functional (lab) | Primary navigation scrolls to each section: 4 links reach their targets |
| pass | `flow:theme-toggle` | functional (lab) | Colour scheme toggle switches, announces state and persists |
| pass | `flow:language-switch` | functional (lab) | Language link opens the right-to-left Arabic page and returns |
| pass | `flow:story-scroll` | motion (lab) | Scroll drives the day story: sun moves on its arc, chapters and frames change: 4 chapters, 5 sun positions, reversible |
| pass | `flow:form-validation` | functional (lab) | Contact form reports errors accessibly and confirms success |
| pass | `flow:mobile-menu` | functional (lab) | Mobile menu opens, closes with Escape and returns focus |
| pass | `flow:scene-embed` | functional (lab) | The 3D product loads lazily and scroll drives its camera: lazy-loaded, WebGL, camera follows scroll |
| pass | `flow:no-script` | accessibility (lab) | With JavaScript disabled the whole page is still readable |

## Defects

| Status | Severity | Where | Runs failing | Summary |
|---|---|---|---|---|
| escalated | major | `scene/web-vitals-lab:scene` | 10 | Over budget in the lab: TBT 1091ms > 300ms |
| escalated | major | `scene/visual-regression:scene@mobile` | 9 | 13.25% of pixels differ from the accepted baseline |
| escalated | major | `scene/visual-regression:scene@tablet` | 9 | 12.38% of pixels differ from the accepted baseline |
| escalated | major | `scene/visual-regression:scene@desktop` | 9 | 11.52% of pixels differ from the accepted baseline |
| escalated | major | `app/web-vitals-lab:portal-ar` | 4 | Over budget in the lab: TBT 676ms > 650ms |

## Not covered by automation

- Screen-reader walkthrough (VoiceOver, NVDA, TalkBack): automated rules cover only part of WCAG 2.2.
- Testing on real phones and a low-powered laptop: frame timing here comes from one desktop GPU.
- Field Core Web Vitals (75th percentile of real visits): only available after launch.
- Native iOS and Android builds, device gestures and store review.
- Copy review by a fluent Arabic editor and a legal review of claims.
