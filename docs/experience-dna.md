# Experience DNA and design system specification

The Experience DNA is one JSON document per project (`.cis/dna/experience-dna.json`, contract `plugin/schemas/experience-dna.schema.json`, schema version 1.0.0). It is the only place colour, type, spacing, motion, iconography, imagery rules and 3D finishes are defined.

## Lifecycle

```
draft --(dna check passes, shown to client)--> proposed --(gate G2 approved by a person)--> approved
approved --(dna bump: archived as rNNN, revision + 1)--> proposed --> approved ...
```

- `revision` is an integer that only increases. Every earlier revision is kept in `.cis/dna/versions/`.
- Changing an approved DNA resets it to `proposed`: a change must be seen again.
- `dna bump --revision-request <id>` refuses changes to aspects that request asked to preserve.

## Blocks

See `plugin/skills/experience-dna/references/fields.md` for the field-by-field table. In outline: `identity`, `direction`, `color` (palette, semantic roles for light and dark, data-visualisation series), `typography` (display, text, mono, arabic, scale), `layout`, `iconography`, `imagery`, `materials`, `motion`, `materials3d`, `accessibility`, `responsive`, `localization`, `platformExceptions`, `evidence`.

## Rules the linter enforces beyond the schema

| Rule | Level |
|---|---|
| Text on background, surface and raised surface meets `accessibility.minTextContrast` in both schemes | error |
| Text on primary and on accent meets the same ratio | error |
| Primary, focus and state colours reach 3:1 against the background | error |
| Every semantic and data-visualisation colour is a palette colour | error |
| Durations increase from `instant` to `cinematic`; easing x-values are within 0..1 | error |
| Typefaces have a usable licence; platform and commercial faces are fallbacks only | error |
| Family names, fallbacks and shadows contain no characters that could break generated CSS or code | error |
| An RTL locale requires `rtl: true`; an Arabic-script locale requires an Arabic typeface | error |
| `defaultLocale` is one of `locales` | error |
| Border nearly invisible; data series hard to tell apart; base duration above 500 ms; under-damped spring; mirror-like 3D finish; missing evidence for a major block | warning |

## Generated design system

`creative-studio dna tokens` writes four projections of the same values:

| File | For | Contents |
|---|---|---|
| `design-system/tokens.css` | web | custom properties: palette, semantic colours for the default scheme, `[data-scheme]` and `prefers-color-scheme` overrides, scheme-pinned `--light-*` and `--dark-*`, data-visualisation colours, font stacks, a fluid type scale, spacing, radii, grid, shadows, durations, easings, an `:lang(ar)` typeface switch, and a `prefers-reduced-motion` block that shortens or zeroes durations |
| `design-system/tokens.json` | tools | the platform-neutral token object |
| `design-system/theme.ts` | React Native | the same values as a typed constant; minimum target raised to 44 |
| `design-system/scene.json` | 3D | finishes, lights, background, exposure, semantic colours |

Token names are role names. A template never mentions a brand colour by name, so the same template serves a different DNA unchanged.

Scale: font sizes are `basePx × ratio^n` for n from −2 to 6 (`--text-xs` to `--text-5xl`); the four largest are fluid between a 360 px viewport and the grid's maximum width. Spacing is the unit multiplied by 0, 1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48 (`--space-0` to `--space-11`).

## Consistency

`creative-studio dna consistency` (also part of `creative-studio test project`):

1. regenerates each projection from the current DNA and compares it byte for byte with the copy inside each deliverable (`current`, `stale-or-edited` or `missing`);
2. scans each deliverable's source for hex colours that are neither a palette colour nor a blend of two, and for `font-family` values outside the DNA.

After a `dna bump`, every deliverable reports `stale-or-edited` until its `sync` command is run. The end-to-end test exercises exactly that.

## Fingerprint

`creative-studio dna fingerprint --registry <file> [--record]` reduces a DNA to thirteen categorical axes (layout grammar, density, default scheme, primary and accent hue family, ground tone, typefaces, corner style, motion intensity, motifs, texture, icon style) and compares it with fingerprints a studio has chosen to keep. An overlap of 70% or more is a prompt for a person to look, not a verdict about originality, and says nothing about third-party work. Fingerprints contain design categories only, never client content.
