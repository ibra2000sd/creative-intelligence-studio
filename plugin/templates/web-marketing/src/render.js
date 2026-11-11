// Pure render functions: content + locale -> HTML strings. Used by the build
// (static pre-render) so the page is complete before any script runs.
// Every content value passes through esc(); no content is trusted as markup.

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

/** Only same-page anchors, relative paths, http(s) and mailto links are rendered as links. */
export function safeHref(href) {
  const h = String(href ?? '').trim();
  return /^(#|\.{0,2}\/|https?:\/\/|mailto:)/i.test(h) && !/[\s<>"']/.test(h) ? h : '#';
}

export function icon(icons, name, cls = 'icon') {
  const paths = icons.icons[name] || icons.icons.sun;
  return `<svg class="${cls}" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="${icons.meta.strokeWidth}" stroke-linecap="${icons.meta.terminals}" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths.map((d) => `<path d="${d}"/>`).join('')}</svg>`;
}

/** Where a clock time sits on the day arc: 0..1 across daylight, or a night position. */
export function arcPosition(time) {
  const [h, m] = String(time).split(':').map(Number);
  const hours = h + (m || 0) / 60;
  if (hours >= 5 && hours <= 20) return { p: (hours - 5) / 15, night: false };
  return { p: ((hours + 24 - 20) % 24) / 9, night: true };
}

export function arcPoint(p, { cx = 200, cy = 250, rx = 170, ry = 190 } = {}) {
  const a = Math.PI * (1 - p);
  return { x: cx + rx * Math.cos(a), y: cy - ry * Math.sin(a) };
}

export function renderHead({ content, locale, base, dna }) {
  const c = content.locales[locale];
  const others = Object.keys(content.locales).filter((l) => l !== locale);
  const url = (l) => (l === content.defaultLocale ? `${base || './'}` : `${base}${l}/`);
  return `<title>${esc(c.meta.title)}</title>
    <meta name="description" content="${esc(c.meta.description)}" />
    <meta property="og:title" content="${esc(c.meta.title)}" />
    <meta property="og:description" content="${esc(c.meta.description)}" />
    <meta property="og:type" content="website" />
    <meta property="og:image" content="${base}assets/campaign-wide.webp" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="theme-color" content="${esc(dna.color.light.bg)}" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="${esc(dna.color.dark.bg)}" media="(prefers-color-scheme: dark)" />
    <link rel="icon" href="${base}brand/favicon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="${base}brand/apple-touch-icon.png" />
    ${others.map((l) => `<link rel="alternate" hreflang="${esc(l)}" href="${url(l)}" vite-ignore />`).join('\n    ')}
    <link rel="alternate" hreflang="${esc(locale)}" href="${url(locale)}" vite-ignore />
    <link rel="preload" as="image" href="${base}assets/hero-sky.avif" type="image/avif" media="(min-width: 900px)" fetchpriority="high" />
    <link rel="preload" as="image" href="${base}assets/hero-mobile.avif" type="image/avif" media="(max-width: 899px)" fetchpriority="high" />`;
}

function header({ c, content, locale, base, dna, icons }) {
  const other = Object.keys(content.locales).find((l) => l !== locale);
  const otherUrl = other ? (other === content.defaultLocale ? base || './' : `${base}${other}/`) : null;
  const otherName = { en: 'English', ar: 'العربية', fr: 'Français', de: 'Deutsch', es: 'Español' }[other] || other;
  return `<header class="site-header" data-header>
  <div class="wrap bar">
    <a class="brand" href="#top" aria-label="${esc(dna.name)}">
      <img class="on-light" src="${base}brand/lockup.svg" alt="" width="180" height="40" />
      <img class="on-dark" src="${base}brand/lockup-reversed.svg" alt="" width="180" height="40" />
    </a>
    <button class="icon-button menu-button" type="button" aria-expanded="false" aria-controls="primary-nav" data-menu><span class="sr-only">${esc(c.ui.menu)}</span>${icon(icons, 'menu')}</button>
    <nav id="primary-nav" class="nav" aria-label="${esc(c.ui.menu)}">
      <ul>${c.nav.map((n) => `<li><a href="${esc(safeHref(n.href))}">${esc(n.label)}</a></li>`).join('')}</ul>
    </nav>
    <div class="tools">
      ${otherUrl ? `<a class="lang" href="${otherUrl}" hreflang="${esc(other)}" lang="${esc(other)}"><span class="sr-only">${esc(c.ui.language)}: </span>${esc(otherName)}</a>` : ''}
      <button class="icon-button" type="button" data-theme-toggle aria-pressed="false"><span class="sr-only">${esc(c.ui.theme)}</span><span class="when-light">${icon(icons, 'moon')}</span><span class="when-dark">${icon(icons, 'sun')}</span></button>
    </div>
  </div>
</header>`;
}

function hero({ c, base }) {
  const h = c.hero;
  const plane = (id, depth) => `<img class="plane" data-depth="${depth}" src="${base}assets/${id}.webp" alt="" width="2400" height="1500" loading="lazy" decoding="async" />`;
  return `<section class="hero" id="top" data-hero>
  <div class="hero-art" aria-hidden="true">
    <picture>
      <source media="(min-width: 900px)" type="image/avif" srcset="${base}assets/hero-sky.avif" />
      <source media="(min-width: 900px)" type="image/webp" srcset="${base}assets/hero-sky.webp" />
      <source type="image/avif" srcset="${base}assets/hero-mobile.avif" />
      <img class="plane base" data-depth="0.04" src="${base}assets/hero-mobile.webp" alt="" width="1080" height="1440" fetchpriority="high" decoding="async" />
    </picture>
    <div class="planes">${plane('hero-arc', 0.1)}${plane('hero-far', 0.18)}${plane('hero-mid', 0.3)}${plane('hero-near', 0.46)}</div>
  </div>
  <div class="wrap hero-copy">
    <p class="eyebrow" style="--i:0">${esc(h.eyebrow)}</p>
    <h1 style="--i:1">${esc(h.headline)}</h1>
    <p class="lede" style="--i:2">${esc(h.sub)}</p>
    <p class="actions" style="--i:3">
      <a class="button primary" data-magnetic href="${esc(safeHref(h.primaryCta.href))}">${esc(h.primaryCta.label)}</a>
      ${h.secondaryCta ? `<a class="button ghost" href="${esc(safeHref(h.secondaryCta.href))}">${esc(h.secondaryCta.label)}</a>` : ''}
    </p>
  </div>
  <p class="scroll-hint" aria-hidden="true">${esc(c.ui.scrollHint)}</p>
</section>`;
}

function story({ c, base, locale }) {
  const s = c.story;
  const nf = new Intl.NumberFormat(locale === 'ar' ? 'ar-u-nu-latn' : locale, { maximumFractionDigits: 1 });
  const img = (ch, cls, lazy = true) => `<img class="${cls}" src="${base}assets/${esc(ch.image || `story-${ch.id}`)}.webp" alt="" width="1600" height="1200" ${lazy ? 'loading="lazy"' : ''} decoding="async" />`;
  const first = arcPosition(s.chapters[0].time);
  const pt = arcPoint(first.p);
  return `<section class="story" id="day" data-story aria-labelledby="story-title">
  <div class="wrap">
    <header class="section-head reveal"><h2 id="story-title">${esc(s.title)}</h2><p class="lede">${esc(s.intro)}</p></header>
    <div class="story-grid">
      <div class="story-visual" aria-hidden="true" data-story-visual>
        <div class="story-frames">${s.chapters.map((ch, i) => img(ch, `frame${i === 0 ? ' is-on' : ''}`, i > 0)).join('')}</div>
        <svg class="story-arc" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid meet">
          <path class="arc-track" d="M30 250A170 190 0 0 1 370 250" />
          <path class="arc-ground" d="M14 250H386" />
          <g data-sun transform="translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})"><circle class="sun-halo" r="22" /><circle class="sun-core" r="11" /></g>
        </svg>
        <p class="story-clock" data-clock>${esc(s.chapters[0].time)}</p>
      </div>
      <ol class="chapters">
        ${s.chapters
          .map((ch, i) => {
            const pos = arcPosition(ch.time);
            return `<li class="chapter${i === 0 ? ' is-active' : ''}" data-chapter data-p="${pos.p.toFixed(3)}" data-night="${pos.night}" data-time="${esc(ch.time)}">
          <figure class="chapter-figure">${img(ch, 'chapter-img')}</figure>
          <p class="chapter-time"><time datetime="${esc(ch.time)}">${esc(ch.time)}</time></p>
          <h3>${esc(ch.title)}</h3>
          <p>${esc(ch.body)}</p>
          <p class="stat"><span class="stat-value"><span data-count="${Number(ch.stat.value)}">${esc(nf.format(ch.stat.value))}</span><span class="stat-unit">${esc(ch.stat.unit)}</span></span><span class="stat-label">${esc(ch.stat.label)}</span></p>
        </li>`;
          })
          .join('\n        ')}
      </ol>
    </div>
  </div>
</section>`;
}

function features({ c, base, icons }) {
  const f = c.features;
  return `<section class="features" id="how" aria-labelledby="features-title">
  <div class="wrap">
    <header class="section-head reveal"><h2 id="features-title">${esc(f.title)}</h2>${f.intro ? `<p class="lede">${esc(f.intro)}</p>` : ''}</header>
    <ul class="cards">
      ${f.items
        .map(
          (it, i) => `<li class="card reveal" data-card style="--i:${i}">
        ${it.image ? `<img class="card-art" src="${base}assets/${esc(it.image)}.webp" alt="" width="1200" height="900" loading="lazy" decoding="async" />` : ''}
        <div class="card-body"><span class="card-icon">${icon(icons, it.icon)}</span><h3>${esc(it.title)}</h3><p>${esc(it.body)}</p></div>
      </li>`,
        )
        .join('\n      ')}
    </ul>
  </div>
</section>`;
}

function product({ c, base, locale, dna, hasScene }) {
  const p = c.product;
  const finish = dna.finishes[0];
  return `<section class="product" id="cell" aria-labelledby="product-title" data-product>
  <div class="wrap product-grid">
    <div class="product-copy reveal">
      <h2 id="product-title">${esc(p.title)}</h2>
      <p class="lede">${esc(p.body)}</p>
      <dl class="specs">${p.specs.map((s) => `<div><dt>${esc(s.label)}</dt><dd>${esc(s.value)}</dd></div>`).join('')}</dl>
    </div>
    <div class="scene-frame" data-scene="${hasScene ? `${base}scene/index.html?embed=1&lang=${esc(locale)}` : ''}">
      ${hasScene ? `<img class="scene-poster" src="${base}scene/fallback/cell-${esc(finish.id)}.webp" alt="${esc(p.fallbackAlt)}" width="900" height="900" loading="lazy" decoding="async" />` : ''}
      ${p.hint && hasScene ? `<p class="scene-hint">${esc(p.hint)}</p>` : ''}
    </div>
  </div>
</section>`;
}

function proof({ c }) {
  const p = c.proof;
  return `<section class="proof" aria-labelledby="proof-title">
  <div class="wrap">
    <header class="section-head reveal"><h2 id="proof-title">${esc(p.title)}</h2></header>
    <ul class="quotes">${p.quotes.map((q, i) => `<li class="quote reveal" style="--i:${i}"><blockquote><p>${esc(q.quote)}</p></blockquote><p class="who"><b>${esc(q.name)}</b><span>${esc(q.role)}</span></p></li>`).join('')}</ul>
    <p class="disclaimer">${esc(p.disclaimer)}</p>
  </div>
</section>`;
}

function contact({ c, base, icons }) {
  const k = c.contact;
  return `<section class="contact" id="contact" aria-labelledby="contact-title">
  <div class="contact-pattern" aria-hidden="true" style="background-image:url('${base}assets/pattern-arc.webp')"></div>
  <div class="wrap contact-grid">
    <div class="reveal"><h2 id="contact-title">${esc(k.title)}</h2><p class="lede">${esc(k.body)}</p></div>
    <form class="form reveal" novalidate data-form data-required="${esc(k.errors.required)}" data-email="${esc(k.errors.email)}" data-summary="${esc(k.errors.summary)}">
      <p class="form-summary" role="alert" tabindex="-1" hidden data-summary-box></p>
      <div class="field"><label for="f-name">${esc(k.fields.name)}</label><input id="f-name" name="name" type="text" autocomplete="name" required aria-describedby="f-name-err" /><p class="error" id="f-name-err" hidden></p></div>
      <div class="field"><label for="f-email">${esc(k.fields.email)}</label><input id="f-email" name="email" type="email" autocomplete="email" inputmode="email" required aria-describedby="f-email-err" /><p class="error" id="f-email-err" hidden></p></div>
      <div class="field"><label for="f-home">${esc(k.fields.home)}</label><select id="f-home" name="home">${k.fields.homeOptions.map((o) => `<option>${esc(o)}</option>`).join('')}</select></div>
      <button class="button primary" type="submit">${esc(k.submit)}</button>
      <p class="form-success" role="status" hidden data-success>${icon(icons, 'check')}<span>${esc(k.success)}</span></p>
    </form>
  </div>
</section>`;
}

export function renderPage({ content, locale, base = '', dna, icons, hasScene = true }) {
  const c = content.locales[locale];
  const ctx = { c, content, locale, base, dna, icons, hasScene };
  return `<a class="skip-link" href="#main">${esc(c.ui.skip)}</a>
${header(ctx)}
<main id="main">
${hero(ctx)}
${story(ctx)}
${features(ctx)}
${product(ctx)}
${proof(ctx)}
${contact(ctx)}
</main>
<footer class="site-footer"><div class="wrap"><img class="on-light" src="${base}brand/symbol.svg" alt="" width="40" height="40" loading="lazy" /><img class="on-dark" src="${base}brand/symbol-reversed.svg" alt="" width="40" height="40" loading="lazy" /><p>${esc(c.footer.legal)}</p>${c.footer.note ? `<p class="footer-note">${esc(c.footer.note)}</p>` : ''}</div></footer>`;
}
