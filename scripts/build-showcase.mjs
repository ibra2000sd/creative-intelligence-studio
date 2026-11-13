#!/usr/bin/env node
// Builds showcase/ from the demonstration's real outputs: QA screenshots, brand
// exports, generated images and report data. Nothing on the page is mocked up;
// every figure is read from a report file and every picture is a file the
// system produced.   node scripts/build-showcase.mjs [--project <dir>] [--live]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const P = path.resolve(argv.includes('--project') ? argv[argv.indexOf('--project') + 1] : path.join(REPO, 'demos/haldora/project'));
const OUT = path.join(REPO, 'showcase');
const sharp = createRequire(import.meta.url)('sharp');
const read = (rel) => JSON.parse(fs.readFileSync(path.join(P, rel), 'utf8'));
const has = (rel) => fs.existsSync(path.join(P, rel));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
fs.mkdirSync(path.join(OUT, 'media'), { recursive: true });

async function shot(rel, name, { width = 1200, crop } = {}) {
  if (!has(rel)) return null;
  let img = sharp(path.join(P, rel));
  const meta = await img.metadata();
  if (crop && meta.height > crop * (meta.width / width)) img = img.extract({ left: 0, top: 0, width: meta.width, height: Math.round(crop * (meta.width / Math.min(width, meta.width))) });
  await img.resize({ width: Math.min(width, meta.width) }).webp({ quality: 82 }).toFile(path.join(OUT, 'media', `${name}.webp`));
  const m = await sharp(path.join(OUT, 'media', `${name}.webp`)).metadata();
  return { src: `media/${name}.webp`, w: m.width, h: m.height };
}
const copy = (rel, name) => (has(rel) ? (fs.copyFileSync(path.join(P, rel), path.join(OUT, 'media', name)), `media/${name}`) : null);

const dna = read('.cis/dna/experience-dna.json');
const qa = has('.cis/reports/qa-summary.json') ? read('.cis/reports/qa-summary.json') : null;
const review = has('.cis/reports/creative-review.json') ? read('.cis/reports/creative-review.json') : null;
const cons = has('.cis/reports/consistency.json') ? read('.cis/reports/consistency.json') : null;
const brand = has('brand/brand-manifest.json') ? read('brand/brand-manifest.json') : null;
const model = has('scene/model-report.json') ? read('scene/model-report.json') : null;
const registry = read('.cis/assets/registry.json');
const state = read('.cis/state.json');

const S = {
  webDesktop: await shot('.cis/reports/qa/web/home-desktop.png', 'web-desktop', { width: 1280 }),
  webDark: await shot('.cis/reports/qa/web/home-desktop-dark.png', 'web-dark', { width: 1280 }),
  webAr: await shot('.cis/reports/qa/web/home-ar-desktop.png', 'web-ar', { width: 1280, crop: 900 }),
  webMobile: await shot('.cis/reports/qa/web/home-mobile.png', 'web-mobile', { width: 390 }),
  appDesktop: await shot('.cis/reports/qa/app/portal-desktop.png', 'app-desktop', { width: 1280 }),
  appDark: await shot('.cis/reports/qa/app/portal-desktop-dark.png', 'app-dark', { width: 1280 }),
  appAr: await shot('.cis/reports/qa/app/portal-ar-desktop.png', 'app-ar', { width: 1280 }),
  appMobile: await shot('.cis/reports/qa/app/portal-mobile.png', 'app-mobile', { width: 390 }),
  scene: await shot('.cis/reports/qa/scene/scene-desktop.png', 'scene-desktop', { width: 1280 }),
  sceneStill: await shot('.cis/reports/qa/scene/scene-still-mobile.png', 'scene-still', { width: 390 }),
  mobile: await shot('.cis/reports/qa/mobile/app-today.png', 'mobile-today', { width: 390 }),
  mobileDark: await shot('.cis/reports/qa/mobile/app-today-dark.png', 'mobile-today-dark', { width: 390 }),
  mobileAr: await shot('.cis/reports/qa/mobile/app-settings-ar.png', 'mobile-settings-ar', { width: 390 }),
  storyChapter: await shot('.cis/reports/qa/web/story-chapter-1.png', 'story-chapter', { width: 1280 }),
  storyNight: await shot('.cis/reports/qa/web/story-chapter-4-dark.png', 'story-night', { width: 1280 }),
  lockup: await shot('brand/logo/png/lockup-horizontal-1200.png', 'lockup', { width: 900 }),
  lockupRev: await shot('brand/logo/png/lockup-horizontal-reversed-1200.png', 'lockup-reversed', { width: 900 }),
  social: await shot('brand/applications/png/social-square.png', 'social-square', { width: 720 }),
  story: await shot('brand/applications/png/story.png', 'story', { width: 480 }),
  og: await shot('brand/applications/png/og-image.png', 'og', { width: 900 }),
  icon: await shot('brand/applications/png/app-icon.png', 'app-icon', { width: 320 }),
};
const assets = [];
for (const id of ['story-dawn', 'story-noon', 'story-dusk', 'story-night', 'feature-contour', 'feature-strata', 'feature-instrument', 'pattern-arc', 'campaign-square', 'campaign-wide', 'bloom-ground', 'app-store-feature']) {
  const rec = registry.assets.find((a) => a.id === id);
  const file = rec?.files.find((f) => /\.(webp|png)$/.test(f.path));
  if (file) assets.push({ id, purpose: rec.purpose, img: await shot(file.path, `asset-${id}`, { width: 640 }), size: `${file.width}×${file.height}`, provider: rec.origin.provider });
}
const guidelines = copy('brand/guidelines.pdf', 'haldora-brand-guidelines.pdf');
const concepts = ['day-arc', 'stored-layers', 'h-field'].map((c) => (has(`brand/logo/concepts/${c}.svg`) ? fs.readFileSync(path.join(P, `brand/logo/concepts/${c}.svg`), 'utf8') : ''));

const fig = (s, alt, cls = '') => (s ? `<figure class="${cls}"><img src="${s.src}" width="${s.w}" height="${s.h}" alt="${esc(alt)}" loading="lazy" decoding="async"></figure>` : `<p class="missing">Not available: ${esc(alt)} (run the full demo).</p>`);
const frame = (s, alt, label) => `<div class="frame"><div class="frame-bar"><span></span><span></span><span></span><em>${esc(label)}</em></div><div class="frame-body" tabindex="0" role="region" aria-label="${esc(alt)}">${fig(s, alt)}</div></div>`;
const phone = (s, alt) => `<div class="phone"><div class="phone-body" tabindex="0" role="region" aria-label="${esc(alt)}">${fig(s, alt)}</div></div>`;

const targetRow = (t) => {
  const n = (st) => t.checks.filter((c) => c.status === st).length;
  return `<tr><th scope="row">${esc(t.id)}</th><td>${n('pass')}</td><td class="${n('fail') ? 'bad' : ''}">${n('fail')}</td><td>${n('warn')}</td><td>${n('blocked')}</td><td>${t.checks.filter((c) => c.id.startsWith('flow:')).length}</td></tr>`;
};
const notable = qa ? qa.targets.flatMap((t) => t.checks.filter((c) => ['fail', 'warn', 'blocked'].includes(c.status)).map((c) => `<li><b>${c.status}</b> <code>${esc(t.id)}/${esc(c.id)}</code> ${esc(c.summary.slice(0, 260))}</li>`)) : [];
const sim = state.gates.filter((g) => g.decision?.simulated).map((g) => g.id);
const pal = Object.values(dna.color.palette).slice(0, 22).map((c) => `<span style="background:${c.hex}" title="${esc(c.name || '')} ${c.hex}"></span>`).join('');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Creative Intelligence Studio: demonstration</title>
<link rel="icon" href="data:,">
<meta name="description" content="Real outputs of the Creative Intelligence Studio plugin for one fictional client: brand, website, portal, mobile app, images and 3D from one Experience DNA.">
<style>
:root{--bg:#131418;--panel:#1b1d23;--line:#2c2f38;--text:#f1eee8;--muted:#a9a69d;--accent:#ff8a3d;--ok:#74c69d;--bad:#ff7b72;color-scheme:dark}
*{box-sizing:border-box}html{scroll-behavior:smooth}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
body{margin:0;background:var(--bg);color:var(--text);font:17px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
a{color:var(--accent)}:focus-visible{outline:3px solid var(--accent);outline-offset:3px;border-radius:4px}
.wrap{width:min(100% - 2.5rem,76rem);margin-inline:auto}
header.top{padding:4.5rem 0 3rem;border-bottom:1px solid var(--line)}
.kicker{font:600 .8rem/1 ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase;color:var(--accent);margin:0 0 1rem}
h1{font:650 clamp(2.2rem,5.4vw,4.2rem)/1.04 Georgia,"Times New Roman",serif;letter-spacing:-.02em;margin:0 0 1.2rem;max-width:18ch}
h2{font:650 clamp(1.6rem,3.2vw,2.4rem)/1.1 Georgia,serif;margin:0 0 .6rem}h3{font-size:1rem;margin:1.6rem 0 .5rem}
.lede{font-size:1.2rem;color:var(--muted);max-width:62ch;margin:0}
nav.toc{display:flex;flex-wrap:wrap;gap:.5rem;margin-top:2rem}nav.toc a{padding:.55rem .9rem;border:1px solid var(--line);border-radius:99px;text-decoration:none;color:var(--text);font-size:.9rem;min-height:44px;display:inline-flex;align-items:center}
nav.toc a:hover{border-color:var(--accent)}
section{padding:4rem 0;border-bottom:1px solid var(--line)}section>.wrap>p{max-width:68ch;color:var(--muted)}
.note{border-inline-start:3px solid var(--accent);padding:.7rem 1rem;background:var(--panel);font-size:.95rem;color:var(--text);max-width:72ch}
.grid{display:grid;gap:1.25rem;grid-template-columns:repeat(auto-fit,minmax(min(100%,18rem),1fr));margin-top:1.5rem}
.two{display:grid;gap:1.5rem;grid-template-columns:minmax(0,1fr);margin-top:1.5rem;align-items:start}@media(min-width:900px){.two{grid-template-columns:minmax(0,1fr) 17rem}}
figure{margin:0}img{display:block;max-width:100%;height:auto}
.card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:1.1rem;display:grid;gap:.6rem;align-content:start}.card img{border-radius:8px}
.card code,.small{font-size:.8rem;color:var(--muted)}
.frame{border:1px solid var(--line);border-radius:12px;overflow:hidden;background:var(--panel)}
.frame-bar{display:flex;align-items:center;gap:6px;padding:.55rem .8rem;border-bottom:1px solid var(--line)}.frame-bar span{width:10px;height:10px;border-radius:50%;background:#3a3d47}.frame-bar em{margin-inline-start:.6rem;font:normal .78rem ui-monospace,monospace;color:var(--muted)}
.frame-body{max-height:34rem;overflow:auto}
.phone{border:8px solid #2a2c34;border-radius:34px;overflow:hidden;background:#000;max-width:17rem;margin-inline:auto}.phone-body{max-height:34rem;overflow:auto}
.plates{display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(min(100%,16rem),1fr));margin-top:1.5rem}
.plate{border-radius:12px;padding:1.5rem;display:grid;place-items:center;min-height:11rem;background:#f6f1e7}.plate.dark{background:#14152b}.plate svg{width:100%;height:auto;max-height:7rem}
.swatches{display:flex;height:2.6rem;border-radius:8px;overflow:hidden;margin-top:1rem}.swatches span{flex:1}
table{width:100%;border-collapse:collapse;margin-top:1rem;font-size:.95rem}th,td{text-align:start;padding:.55rem .8rem;border-bottom:1px solid var(--line)}thead th{color:var(--muted);font-weight:600;font-size:.82rem}td.bad{color:var(--bad);font-weight:700}
.tablewrap{overflow-x:auto}
ul.issues{padding-inline-start:1.1rem;font-size:.9rem;color:var(--muted)}ul.issues b{color:var(--text);text-transform:uppercase;font-size:.72rem;letter-spacing:.06em;margin-inline-end:.4rem}
pre{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:1rem;overflow:auto;font-size:.85rem}
.stat{display:grid;gap:.1rem}.stat b{font:650 2rem/1 Georgia,serif}.stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1.4rem 2rem;margin-top:2rem;max-width:60rem}@media(min-width:760px){.stats{grid-template-columns:repeat(5,minmax(0,1fr))}}
.missing{color:var(--bad);font-size:.9rem;padding:1rem}
footer{padding:3rem 0;color:var(--muted);font-size:.9rem}
</style>
</head>
<body>
<header class="top"><div class="wrap">
<p class="kicker">Creative Intelligence Studio · demonstration</p>
<h1>One brief, one Experience DNA, seven kinds of deliverable.</h1>
<p class="lede">Everything on this page was produced by the plugin's own commands for ${esc(dna.identity.name)}, a fictional home-battery company. The pictures are files the system generated or screenshots its QA harness captured; the numbers are read from its report files.</p>
<div class="stats">
<div class="stat"><b>${brand ? brand.files.length : '–'}</b><span class="small">brand files, ${brand ? `${brand.checks.vectorIntegrity.filter((v) => v.pass).length}/${brand.checks.vectorIntegrity.length}` : '–'} vector masters verified</span></div>
<div class="stat"><b>${registry.assets.length}</b><span class="small">assets registered with provenance</span></div>
<div class="stat"><b>${qa ? qa.totals.pass : '–'}</b><span class="small">automated checks passing</span></div>
<div class="stat"><b>${qa ? qa.totals.fail : '–'}</b><span class="small">failing</span></div>
<div class="stat"><b>${qa ? qa.totals.warn + qa.totals.blocked : '–'}</b><span class="small">warnings and blocked checks, listed below</span></div>
</div>
<nav class="toc" aria-label="Sections"><a href="#brand">Brand</a><a href="#images">Images</a><a href="#web">Website</a><a href="#app">Portal</a><a href="#mobile">Mobile</a><a href="#scene">3D</a><a href="#system">One system</a><a href="#evidence">Evidence</a><a href="#reproduce">Reproduce</a></nav>
</div></header>

<section id="brand"><div class="wrap">
<h2>Brand identity</h2>
<p>Direction: <b>${esc(dna.direction.title)}</b>. ${esc(dna.direction.signature)}</p>
<h3>Three concepts explored; the first was selected</h3>
<div class="plates">${concepts.map((c) => `<div class="plate">${c}</div>`).join('')}</div>
<h3>The system</h3>
<div class="plates"><div class="plate">${fig(S.lockup, 'Haldora horizontal lockup on paper')}</div><div class="plate dark">${fig(S.lockupRev, 'Haldora horizontal lockup reversed on night')}</div><div class="plate dark">${fig(S.icon, 'Haldora app icon')}</div></div>
<div class="swatches" role="img" aria-label="The ${Object.keys(dna.color.palette).length} palette colours">${pal}</div>
<h3>Applications</h3>
<div class="grid"><div class="card">${fig(S.social, 'Social square with outlined logo and headline')}<span class="small">Social square, 1080×1080. Logo and headline are vector outlines, not model-rendered text.</span></div><div class="card">${fig(S.og, 'Link preview image')}<span class="small">Link preview, 1200×630.</span></div><div class="card">${fig(S.story, 'Vertical story graphic')}<span class="small">Story, 1080×1920.</span></div></div>
<p class="note">The logo is delivered as SVG built from filled paths with the wordmark outlined, in colour, reversed and one-colour variants, plus PNG, WebP and vector PDF. ${guidelines ? `<a href="${guidelines}">Brand guidelines (PDF)</a>.` : ''} No trademark search or clearance has been performed.</p>
</div></section>

<section id="images"><div class="wrap">
<h2>Image and asset production</h2>
<p>Generated by the built-in procedural engine from the DNA's colours, motifs and texture: offline, free and reproducible from a seed. Each file was checked for exact dimensions, blank output, palette adherence, byte budget and near-duplicates before it was registered.</p>
<div class="grid">${assets.map((a) => `<div class="card">${fig(a.img, a.purpose)}<span>${esc(a.purpose)}</span><code>${esc(a.id)} · ${a.size} · ${esc(a.provider)}</code></div>`).join('')}</div>
</div></section>

<section id="web"><div class="wrap">
<h2>Marketing website</h2>
<p>Pre-rendered in English and Arabic. On wide screens scrolling moves one sun along the day arc, between the sky and the hills, and cross-fades the scene per chapter; on phones, with reduced motion, or without JavaScript it is a plain illustrated story.</p>
<div class="two">${frame(S.webDesktop, 'Full marketing page, desktop, light scheme', 'haldora.example · light')}${phone(S.webMobile, 'Marketing page on a phone')}</div>
<div class="grid">${frame(S.webDark, 'Marketing page, dark scheme', 'dark scheme')}${frame(S.webAr, 'Marketing page in Arabic, right to left', '/ar/ · right to left')}</div>
<div class="grid">${frame(S.storyChapter, 'Scroll story, first chapter: the sun at 06:10', 'scroll story · 06:10')}${frame(S.storyNight, 'Scroll story, night chapter in the dark scheme: a crescent instead of a sun', 'scroll story · 02:00 · dark')}</div>
</div></section>

<section id="app"><div class="wrap">
<h2>Customer portal</h2>
<p>A React application: day chart with a keyboard-operable time slider and a table alternative, device states with error recovery, a sortable table, and settings that save optimistically and roll back on failure.</p>
<div class="two">${frame(S.appDesktop, 'Portal overview, desktop', 'portal · today')}${phone(S.appMobile, 'Portal on a phone with bottom navigation')}</div>
<div class="grid">${frame(S.appDark, 'Portal in the dark scheme', 'dark scheme')}${frame(S.appAr, 'Portal in Arabic with the navigation on the right', '?lang=ar · right to left')}</div>
</div></section>

<section id="mobile"><div class="wrap">
<h2>Mobile application</h2>
<p>An Expo and React Native project. These captures are from the web export of the same code, which is how gestures and navigation were exercised automatically.</p>
<div class="two"><div><p class="note">Verified here: TypeScript, Jest, production Hermes bundles for iOS and Android, and browser flows for swipe, tabs, detail, slider drag, offline and Arabic. <b>Not verified here:</b> native builds, device gestures, VoiceOver and TalkBack. This machine has neither Xcode nor the Android SDK, and those checks are reported as blocked.</p></div><div class="grid">${phone(S.mobile, 'Today screen with the day dial')}${phone(S.mobileDark, 'Today screen in the dark scheme')}${phone(S.mobileAr, 'Settings in Arabic')}</div></div>
</div></section>

<section id="scene"><div class="wrap">
<h2>3D product experience</h2>
<p>${model ? `A GLB generated from procedural geometry: ${model.files.optimised.validation.stats.triangles.toLocaleString('en')} triangles in ${model.files.optimised.validation.stats.drawCalls} draw calls, ${(model.files.source.bytes / 1024).toFixed(0)} KB before optimisation and ${(model.files.optimised.bytes / 1024).toFixed(0)} KB after, with ${model.files.optimised.validation.errors} validator errors.` : ''} The arc and sun on the product are the same signature as the logo; the time control moves the sun.</p>
<div class="two">${frame(S.scene, 'Interactive 3D scene with finish and time controls', 'scene · WebGL')}${phone(S.sceneStill, 'Still-image fallback on a phone')}</div>
</div></section>

<section id="system"><div class="wrap">
<h2>One design system</h2>
<p>Each deliverable carries a token file generated from the same DNA revision. The consistency check regenerates the tokens and compares bytes, then scans source for colours and typefaces outside the DNA.</p>
${cons ? `<div class="tablewrap"><table><thead><tr><th>Deliverable</th><th>Tokens</th><th>DNA revision</th><th>Source files scanned</th><th>Off-palette colours</th><th>Foreign fonts</th></tr></thead><tbody>${cons.deliverables.map((d) => `<tr><th scope="row">${esc(d.id)}</th><td>${esc(d.tokens)}</td><td>${d.dnaRevision ?? '–'}</td><td>${d.filesScanned}</td><td class="${d.offPalette.length ? 'bad' : ''}">${d.offPalette.length}</td><td class="${d.foreignFonts.length ? 'bad' : ''}">${d.foreignFonts.length}</td></tr>`).join('')}</tbody></table></div>` : '<p class="missing">No consistency report.</p>'}
</div></section>

<section id="evidence"><div class="wrap">
<h2>Evidence, including what did not pass</h2>
${qa ? `<p>Automated verdict: <b>${esc(qa.verdict)}</b>. Generated ${esc(qa.generatedAt)} on ${esc(qa.environment.platform)}. Performance and frame figures are lab measurements from this machine, not field data.</p>
<div class="tablewrap"><table><thead><tr><th>Target</th><th>Pass</th><th>Fail</th><th>Warn</th><th>Blocked</th><th>Scripted flows</th></tr></thead><tbody>${qa.targets.map(targetRow).join('')}</tbody></table></div>
<h3>Every failure, warning and blocked check</h3><ul class="issues">${notable.join('') || '<li>None.</li>'}</ul>
<h3>Not covered by automation</h3><ul class="issues">${qa.manualAuditsOutstanding.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>` : '<p class="missing">No QA summary: run the full demo.</p>'}
${review ? `<h3>Independent creative review</h3><p>By ${esc(review.reviewer)}, ${esc(String(review.reviewedAt).slice(0, 10))}: recommendation <b>${esc(review.recommendation)}</b>, with ${['blocker', 'major', 'minor'].map((k) => `${review.findings.filter((f) => f.severity === k).length} ${k}`).join(', ')} finding(s). The full review, with its reasons, is in <code>.cis/reports/creative-review.json</code>. A model's review is not a person's, and it is not approval.</p>` : '<p class="missing">No creative review has been recorded.</p>'}
<p class="note">Approval gates ${sim.join(', ') || '(none)'} were recorded by the demonstration script and are marked simulated. Gates G6 (quality) and G7 (acceptance) need people, so the demo ends with a draft package, not a final one. Automated checks are evidence; they are not client approval.</p>
</div></section>

<section id="reproduce"><div class="wrap">
<h2>Reproduce it</h2>
<pre>pnpm install
node scripts/run-demo.mjs --full      # brief to draft package: install, build, test, audit
node scripts/build-showcase.mjs       # this page
pnpm test && pnpm test:e2e            # the system's own tests</pre>
<p>Inputs are in <code>demos/haldora/inputs/</code>; outputs in <code>demos/haldora/project/</code>; reports in <code>demos/haldora/project/.cis/reports/</code>.</p>
</div></section>
<footer><div class="wrap">Built ${new Date().toISOString().slice(0, 10)} from Experience DNA revision ${dna.revision}. Haldora is fictional; quotes and product figures in its deliverables are illustrative.</div></footer>
</body>
</html>
`;
fs.writeFileSync(path.join(OUT, 'index.html'), html);
console.log(`showcase/index.html written with ${fs.readdirSync(path.join(OUT, 'media')).length} media files (${Object.values(S).filter(Boolean).length} of ${Object.keys(S).length} captures found).`);
