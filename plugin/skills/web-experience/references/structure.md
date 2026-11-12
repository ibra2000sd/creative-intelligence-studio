# Marketing site structure

- `index.html` and `<locale>/index.html`: shells. `vite.config.js` pre-renders every locale at build time from `src/content.json` through `src/render.js`.
- `src/render.js`: pure functions returning HTML strings. Every content value is escaped; links are restricted to anchors, relative paths, http(s) and mailto.
- `src/main.js`: progressive enhancement only. Theme, menu, reveals (CSS), form validation, lazy 3D embed, and on wide screens with motion allowed, the GSAP scroll timeline.
- `src/styles.css`: logical properties throughout, so right-to-left needs no overrides.
- `src/dna/`: generated tokens, fonts, icons and runtime DNA.
- `qa/flows.mjs`: scripted functional tests. `qa/baselines/`: accepted screenshots.

Rules worth keeping when you change it:

1. Content is in the HTML. Scripts may hide nothing that they cannot guarantee to show (`.enhanced` is only added after the observer is running).
2. The scroll story is a real list of chapters first. The sticky picture and the scrubbed sun are an enhancement for wide screens.
3. The active item is marked by something other than dimming the rest: dimmed text fails contrast.
4. The animation library is only downloaded where the scroll-linked sequence exists.
5. Artwork that keeps one scheme uses scheme-pinned tokens for its text.
