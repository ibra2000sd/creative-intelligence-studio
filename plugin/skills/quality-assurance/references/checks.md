# What the suite checks, and what it cannot

| Check | Category | Method | Limits |
|---|---|---|---|
| load | functional | console errors, exceptions, failed requests, broken images | First view of each page only |
| layout | visual | horizontal overflow and clipped text at 390, 768 and 1440 px | Not every content length |
| a11y-axe | accessibility | axe-core, WCAG 2.0-2.2 A and AA tags, both schemes | Rules cover only part of WCAG; needs a manual audit |
| keyboard | accessibility | Tab through the page; focus indicator present; focus not obscured (SC 2.4.11) | Does not judge logical order |
| target-size | accessibility | pointer targets at least 24 by 24 CSS px (SC 2.5.8) | Web only; native uses 44pt/48dp |
| reduced-motion | motion | no long animation, no hidden content, no scroll engine | Emulated preference |
| web-vitals-lab | performance | median of 3 loads, phone viewport, 4x CPU throttle: LCP, CLS, blocking time, first tap | Lab only. INP is a field metric; a slow tap warns |
| scroll-motion | motion | frame intervals and layout shift while scrolling the page | This machine's GPU |
| visual-regression | visual | pixel diff against accepted baselines | Baselines must be accepted by a person |
| bundle | performance | gzip size of scripts and styles | Static |
| flow:* | functional | the deliverable's own scripted tests | As good as the flows written |
| mobile | build | type check, Jest, iOS and Android bundles | No native build or device run |
| project | delivery | ledger chain, DNA lint, consistency, asset registry | - |
| security | security | secrets, unsafe patterns, third-party requests, licences, SBOM, vulnerability audit | Static; the vulnerability audit needs registry access |

Budgets (defaults): LCP 2500 ms, CLS 0.1, blocking time 300 ms, script 300 KB gzip, styles 60 KB gzip.

Always outstanding after automation: a screen-reader walkthrough, real devices including a low-powered one, field web vitals after launch, native builds and store review, and review of copy by a fluent editor.
