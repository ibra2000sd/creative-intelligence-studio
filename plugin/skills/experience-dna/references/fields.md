# Experience DNA fields

| Block | What it fixes | Consumed by |
|---|---|---|
| `identity` | name, positioning, personality, audience, voice rules | copy, guidelines |
| `direction` | rationale, principles, signature, prohibited patterns | every skill, image prompts |
| `color.palette` | every colour the project may use | lint, consistency check |
| `color.semantic.light/dark` | role mapping per scheme (bg, text, primary, accent, focus, states) | tokens.css, theme.ts |
| `color.dataViz` | chart series colours | charts, illustrations |
| `typography` | display, text, mono, arabic faces with source and licence; scale | fonts.css, fonts.ts, logo outlines |
| `layout` | grammar, grid, spacing unit, radii, density | tokens.css |
| `iconography` | style, stroke width, terminals | icon set |
| `imagery` | style, composition, motifs, texture, prohibitions | image engine, provider prompts |
| `materials` | surfaces, lighting, elevation shadows | tokens.css |
| `motion` | personality, intensity, durations, easings, spring, stagger, reduced-motion strategy | tokens.css, theme.ts, scene.json, motion lint |
| `materials3d` | product finishes (base colour, metalness, roughness), lights | scene.json, GLB materials |
| `accessibility` | target level, minimum contrast, minimum target size | lint, QA |
| `responsive` | breakpoints, strategy | tokens.css |
| `localization` | locales, RTL, numerals | templates |
| `platformExceptions` | where a platform convention overrides the brand, with the reason | reviewers |
| `evidence` | where each block's decisions came from | audit |

Token names are neutral (`--color-bg`, `--font-display`, `--dur-base`, `--ease-enter`): a deliverable never references a brand-specific colour name. Scheme-pinned values (`--light-text`, `--dark-bg`) exist for surfaces that keep one scheme, such as artwork.
