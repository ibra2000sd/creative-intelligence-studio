// Progressive enhancement. The page is already complete HTML; everything here
// adds motion and interaction and can fail without hiding content.
import './styles.css';
import dna from './dna/dna.json';
import { arcPoint } from './render.js';

const root = document.documentElement;
const motionOK = matchMedia('(prefers-reduced-motion: no-preference)').matches && dna.motion.intensity !== 'none';
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
const wide = matchMedia('(min-width: 900px)');
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const sec = (ms) => ms / 1000;

// ---------------------------------------------------------------- theme -----
const themeButton = $('[data-theme-toggle]');
const currentScheme = () => root.dataset.scheme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
function setScheme(next) {
  const apply = () => {
    root.dataset.scheme = next;
    themeButton?.setAttribute('aria-pressed', String(next === 'dark'));
    try {
      localStorage.setItem('scheme', next);
    } catch {
      /* private mode: the choice lasts for this page only */
    }
  };
  if (motionOK && document.startViewTransition) document.startViewTransition(apply);
  else apply();
}
// However the scheme changes (the button, another script, a test harness), the embedded 3D scene is told.
new MutationObserver(() => $('iframe[data-scene-frame]')?.contentWindow?.postMessage({ type: 'cis-scene-scheme', value: currentScheme() }, location.origin)).observe(root, { attributes: true, attributeFilter: ['data-scheme'] });
themeButton?.setAttribute('aria-pressed', String(currentScheme() === 'dark'));
themeButton?.addEventListener('click', () => setScheme(currentScheme() === 'dark' ? 'light' : 'dark'));

// ------------------------------------------------------- arc gives way -------
// The hero's arc plane is masked behind the copy: one hole per block (eyebrow, headline, lede, actions),
// each as wide as its longest line of text rather than its element box, so no dash shows between lines
// and the sun beside the copy is never clipped. Recomputed when the layout or scheme changes and while
// the hero is on screen.
const arcPlanes = $$('.hero .plane.track');
const heroCopy = $$('.hero-copy > *');
let holeQueued = false;
function holeArc() {
  holeQueued = false;
  const range = document.createRange();
  const union = (rects) => {
    const rs = rects.filter((r) => r.width && r.height);
    if (!rs.length) return null;
    const left = Math.min(...rs.map((r) => r.left));
    const top = Math.min(...rs.map((r) => r.top));
    return { left, top, width: Math.max(...rs.map((r) => r.right)) - left, height: Math.max(...rs.map((r) => r.bottom)) - top };
  };
  const boxes = heroCopy
    .map((el) => {
      if (el.children.length) return union([...el.children].map((c) => c.getBoundingClientRect()));
      range.selectNodeContents(el);
      return union([...range.getClientRects()]);
    })
    .filter(Boolean)
    .sort((a, b) => a.top - b.top);
  if (!boxes.length) return;
  // Each hole reaches down to the next block, so no dash shows in the space between two blocks;
  // widths stay those of each block's own text, so the sun beside the copy is never clipped.
  for (let i = 0; i < boxes.length - 1; i++) boxes[i] = { ...boxes[i], height: Math.max(boxes[i].height, boxes[i + 1].top - boxes[i].top) };
  const pad = 10;
  const fill = 'linear-gradient(#000, #000)';
  for (const plane of arcPlanes) {
    const p = plane.getBoundingClientRect();
    if (!p.width) continue; // the plane of the scheme that is not shown
    const holes = boxes.map((r) => ({ x: r.left - p.left - pad, y: r.top - p.top - pad, w: r.width + pad * 2, h: r.height + pad * 2 }));
    const s = plane.style;
    s.maskImage = s.webkitMaskImage = [fill, ...holes.map(() => fill)].join(', ');
    s.maskSize = s.webkitMaskSize = ['100% 100%', ...holes.map((h) => `${h.w.toFixed(1)}px ${h.h.toFixed(1)}px`)].join(', ');
    s.maskPosition = s.webkitMaskPosition = ['0 0', ...holes.map((h) => `${h.x.toFixed(1)}px ${h.y.toFixed(1)}px`)].join(', ');
    s.maskRepeat = s.webkitMaskRepeat = 'no-repeat';
    s.maskComposite = 'exclude';
    s.webkitMaskComposite = 'xor';
  }
}
const queueHole = () => {
  if (holeQueued) return;
  holeQueued = true;
  requestAnimationFrame(holeArc);
};
if (arcPlanes.length && heroCopy.length) {
  queueHole();
  addEventListener('resize', queueHole);
  document.fonts?.ready.then(queueHole);
  new MutationObserver(queueHole).observe(root, { attributes: true, attributeFilter: ['data-scheme'] });
  let heroVisible = true;
  new IntersectionObserver(([e]) => (heroVisible = e.isIntersecting)).observe($('[data-hero]'));
  addEventListener('scroll', () => heroVisible && queueHole(), { passive: true });
  // The copy's entrance animation moves it for a moment after load.
  setTimeout(queueHole, 1600);
}

// ----------------------------------------------------------------- menu -----
const menuButton = $('[data-menu]');
const nav = $('#primary-nav');
function setMenu(open) {
  menuButton.setAttribute('aria-expanded', String(open));
  nav.classList.toggle('is-open', open);
}
menuButton?.addEventListener('click', () => setMenu(menuButton.getAttribute('aria-expanded') !== 'true'));
nav?.addEventListener('click', (e) => e.target.closest('a') && setMenu(false));
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && menuButton?.getAttribute('aria-expanded') === 'true') {
    setMenu(false);
    menuButton.focus();
  }
});

// Header gains a surface once the page has scrolled.
const header = $('[data-header]');
const sentinel = document.createElement('div');
sentinel.className = 'scroll-sentinel';
document.body.prepend(sentinel);
new IntersectionObserver(([e]) => header.classList.toggle('is-stuck', !e.isIntersecting)).observe(sentinel);
root.classList.add('header-ready');

// --------------------------------------------------------------- reveals ----
// CSS runtime: an observer flips a class, a transition does the rest.
if (motionOK && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      }
    },
    { rootMargin: '0px 0px -12% 0px', threshold: 0.08 },
  );
  for (const el of $$('.reveal')) io.observe(el);
  root.classList.add('enhanced');
}

// ------------------------------------------------------------- pointer ------
if (finePointer) {
  for (const card of $$('[data-card]')) {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  }
}

// ----------------------------------------------------------------- form -----
const form = $('[data-form]');
if (form) {
  const summary = $('[data-summary-box]', form);
  const success = $('[data-success]', form);
  const check = (input) => {
    const err = $(`#${input.id}-err`);
    let message = '';
    if (input.required && !input.value.trim()) message = form.dataset.required;
    else if (input.type === 'email' && input.value && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.value.trim())) message = form.dataset.email;
    input.setAttribute('aria-invalid', String(Boolean(message)));
    if (err) {
      err.textContent = message;
      err.hidden = !message;
    }
    return !message;
  };
  for (const input of $$('input', form)) {
    input.addEventListener('blur', () => input.value && check(input));
    input.addEventListener('input', () => input.getAttribute('aria-invalid') === 'true' && check(input));
  }
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const invalid = $$('input', form).filter((i) => !check(i));
    success.hidden = true;
    if (invalid.length) {
      summary.textContent = form.dataset.summary;
      summary.hidden = false;
      invalid[0].focus();
      return;
    }
    summary.hidden = true;
    // Integration point: replace with a real request. Nothing is sent anywhere.
    form.reset();
    success.hidden = false;
  });
}

// ------------------------------------------------------------- 3D scene -----
const sceneFrame = $('[data-scene]');
let sceneWindow = null;
if (sceneFrame?.dataset.scene) {
  const load = () => {
    if (sceneFrame.querySelector('iframe')) return;
    const iframe = document.createElement('iframe');
    iframe.src = `${sceneFrame.dataset.scene}&scheme=${currentScheme()}`;
    iframe.title = $('#product-title')?.textContent || '3D';
    iframe.loading = 'lazy';
    iframe.setAttribute('data-scene-frame', '');
    iframe.allow = 'fullscreen';
    sceneFrame.append(iframe);
    window.addEventListener('message', (e) => {
      if (e.source !== iframe.contentWindow || e.data?.type !== 'cis-scene-ready') return;
      sceneWindow = iframe.contentWindow;
      sceneFrame.classList.add('is-live');
      // Remove the loading hint for everyone, not just visually.
      sceneFrame.querySelector('.scene-hint')?.setAttribute('hidden', '');
    });
  };
  // The engine is only fetched when the section is near the viewport.
  new IntersectionObserver(
    (entries, io) => {
      if (entries.some((e) => e.isIntersecting)) {
        // Starting a WebGL engine blocks the main thread briefly, so wait for an idle moment.
        (window.requestIdleCallback || setTimeout)(load, { timeout: 2000 });
        io.disconnect();
      }
    },
    { rootMargin: '600px 0px' },
  ).observe(sceneFrame);
}

// ------------------------------------------------ scroll-linked motion ------
// GSAP runtime, loaded only when motion is welcome. Without it the story is a
// plain, fully readable sequence of illustrated chapters.
const story = $('[data-story]');
const chapters = $$('[data-chapter]');
const sun = $('[data-sun]');
const clock = $('[data-clock]');
const storyVisual = $('[data-story-visual]');

function activate(i) {
  chapters.forEach((ch, k) => ch.classList.toggle('is-active', k === i));
  // Sky and ground are separate stacks of frames; both show the active chapter.
  for (const stack of $$('[data-frames]', story)) [...stack.children].forEach((f, k) => f.classList.toggle('is-on', k === i));
  const ch = chapters[i];
  if (storyVisual) storyVisual.dataset.tone = ch.dataset.tone;
  if (clock) clock.textContent = ch.dataset.time;
  if (!sun || story.classList.contains('is-scrubbed')) return; // while scrubbing, the timeline owns the sun
  const pt = arcPoint(Number(ch.dataset.p));
  sun.setAttribute('transform', `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`);
  sun.dataset.night = ch.dataset.night;
}

async function enhanceMotion() {
  const [{ gsap }, { ScrollTrigger }] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger')]);
  gsap.registerPlugin(ScrollTrigger);
  const d = dna.motion.durationMs;
  const mm = gsap.matchMedia();

  mm.add('(min-width: 900px)', () => {
    // Hero: planes drift at different rates as the page scrolls (depth, not decoration).
    for (const plane of $$('.hero .plane')) {
      gsap.to(plane, { yPercent: Number(plane.dataset.depth) * 34, ease: 'none', scrollTrigger: { trigger: '[data-hero]', start: 'top top', end: 'bottom top', scrub: true } });
    }
    gsap.to('.hero-copy', { yPercent: -14, opacity: 0.2, ease: 'none', scrollTrigger: { trigger: '[data-hero]', start: '55% top', end: 'bottom top', scrub: true } });

    // Story: the sun travels its arc with scroll position; frames cross-fade by chapter.
    // Without layered frames there is no separate sun: the illustrations carry their own.
    let tl = null;
    if (sun) {
      story.classList.add('is-scrubbed');
      // `night` is part of the animated state, so scrubbing backwards restores the sun.
      const proxy = { p: Number(chapters[0].dataset.p), night: chapters[0].dataset.night === 'true' ? 1 : 0 };
      let shown = -1;
      const place = () => {
        const pt = arcPoint(proxy.p);
        sun.setAttribute('transform', `translate(${pt.x.toFixed(2)} ${pt.y.toFixed(2)})`);
        const night = String(proxy.night >= 0.5);
        if (sun.dataset.night !== night) sun.dataset.night = night;
        // The picture, the clock and the marked chapter follow the same timeline as the sun, so they
        // cannot disagree with it, however the page was scrolled (a jump to the top included).
        const i = Math.max(0, Math.min(chapters.length - 1, Math.round(tl ? tl.time() : 0)));
        if (i !== shown) activate((shown = i));
      };
      // The timeline runs from the first chapter centred in the window to the last chapter centred,
      // one unit per chapter: the sun is at a chapter's time exactly when that chapter is being read.
      const centred = (el) => el.getBoundingClientRect().top + window.scrollY + el.offsetHeight / 2 - window.innerHeight / 2;
      tl = gsap.timeline({ defaults: { ease: 'none' }, onUpdate: place, scrollTrigger: { trigger: '.chapters', start: () => centred(chapters[0]), end: () => centred(chapters.at(-1)), invalidateOnRefresh: true, scrub: 0.5 } });
      chapters.forEach((ch, i) => {
        if (i === 0) return;
        const night = ch.dataset.night === 'true';
        // Into a night chapter the sun sets behind the hills first, then a moon rises from the other side.
        if (night) tl.to(proxy, { p: 1.14, duration: 0.5 }, i - 1).set(proxy, { p: -0.14, night: 1 }, i - 0.5).to(proxy, { p: Number(ch.dataset.p), duration: 0.5 }, i - 0.5);
        else tl.to(proxy, { p: Number(ch.dataset.p), night: 0, duration: 1 }, i - 1);
      });
      place();
    }
    // Without a scroll-driven sun, chapters switch the picture as they pass the middle of the window.
    const triggers = sun ? [] : chapters.map((ch, i) => ScrollTrigger.create({ trigger: ch, start: 'top 55%', end: 'bottom 55%', onToggle: (self) => self.isActive && activate(i) }));

    // 3D product: scroll position drives the camera through three shots.
    const productTrigger = sceneFrame && ScrollTrigger.create({ trigger: '[data-product]', start: 'top 70%', end: 'bottom 30%', onUpdate: (self) => sceneWindow?.postMessage({ type: 'cis-scene-progress', value: self.progress }, location.origin) });
    return () => {
      story.classList.remove('is-scrubbed');
      tl?.scrollTrigger?.kill();
      tl?.kill();
      triggers.forEach((t) => t.kill());
      productTrigger?.kill();
    };
  });

  // Magnetic primary action: a small pull toward the pointer, released with a spring-like ease.
  if (finePointer) {
    for (const el of $$('[data-magnetic]')) {
      const x = gsap.quickTo(el, 'x', { duration: sec(d.base), ease: 'power3.out' });
      const y = gsap.quickTo(el, 'y', { duration: sec(d.base), ease: 'power3.out' });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        x((e.clientX - r.left - r.width / 2) * 0.22);
        y((e.clientY - r.top - r.height / 2) * 0.3);
      });
      el.addEventListener('pointerleave', () => {
        x(0);
        y(0);
      });
    }
  }
  window.__motion = { engine: 'gsap', version: gsap.version, triggers: () => ScrollTrigger.getAll().length };
}

// Statistics count up once when first seen: a few lines of requestAnimationFrame, no library.
function countUp() {
  const nf = new Intl.NumberFormat(root.lang === 'ar' ? 'ar-u-nu-latn' : root.lang, { maximumFractionDigits: 1 });
  const [x1, y1, x2, y2] = dna.motion.easing.enter;
  const ease = (x) => {
    let lo = 0;
    let hi = 1;
    let t = x;
    for (let i = 0; i < 14; i++) {
      t = (lo + hi) / 2;
      if (3 * (1 - t) ** 2 * t * x1 + 3 * (1 - t) * t ** 2 * x2 + t ** 3 < x) lo = t;
      else hi = t;
    }
    return 3 * (1 - t) ** 2 * t * y1 + 3 * (1 - t) * t ** 2 * y2 + t ** 3;
  };
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        io.unobserve(e.target);
        const el = e.target;
        const target = Number(el.dataset.count);
        let start = 0;
        const step = (now) => {
          start ||= now;
          const p = Math.min(1, (now - start) / dna.motion.durationMs.cinematic);
          el.textContent = nf.format(p >= 1 ? target : target % 1 ? Number((target * ease(p)).toFixed(1)) : Math.round(target * ease(p)));
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }
    },
    { threshold: 0.6 },
  );
  for (const el of $$('[data-count]')) io.observe(el);
}

// The scroll-linked sequence only exists on wide screens, so the animation
// library is only downloaded there. Phones get the stacked, illustrated story.
let motionLoaded = false;
function loadMotion() {
  if (motionLoaded || !wide.matches) return;
  motionLoaded = true;
  enhanceMotion().catch((err) => console.warn('Motion enhancement skipped:', err));
}

if (motionOK && story) {
  countUp();
  loadMotion();
  wide.addEventListener('change', loadMotion);
} else if (story && 'IntersectionObserver' in window && wide.matches) {
  // Reduced motion on wide screens: chapters still switch the picture, with a cross-fade only.
  story.classList.add('is-stepped');
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) activate(chapters.indexOf(e.target));
  }, { rootMargin: '-45% 0px -45% 0px' });
  chapters.forEach((ch) => io.observe(ch));
}
