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
    $('iframe[data-scene-frame]')?.contentWindow?.postMessage({ type: 'cis-scene-scheme', value: next }, location.origin);
  };
  if (motionOK && document.startViewTransition) document.startViewTransition(apply);
  else apply();
}
themeButton?.setAttribute('aria-pressed', String(currentScheme() === 'dark'));
themeButton?.addEventListener('click', () => setScheme(currentScheme() === 'dark' ? 'light' : 'dark'));

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

function activate(i) {
  chapters.forEach((ch, k) => ch.classList.toggle('is-active', k === i));
  $$('.frame', story).forEach((f, k) => f.classList.toggle('is-on', k === i));
  const ch = chapters[i];
  const pt = arcPoint(Number(ch.dataset.p));
  sun?.setAttribute('transform', `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`);
  sun?.classList.toggle('is-night', ch.dataset.night === 'true');
  if (clock) clock.textContent = ch.dataset.time;
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
    story.classList.add('is-scrubbed');
    const proxy = { p: Number(chapters[0].dataset.p) };
    const place = () => {
      const pt = arcPoint(proxy.p);
      sun.setAttribute('transform', `translate(${pt.x.toFixed(2)} ${pt.y.toFixed(2)})`);
    };
    const tl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: '.chapters', start: 'top 55%', end: 'bottom 55%', scrub: 0.5 } });
    chapters.forEach((ch, i) => {
      if (i === 0) return;
      const night = ch.dataset.night === 'true';
      // Night chapters: the sun sets first, then reappears as a moon.
      if (night) tl.to(proxy, { p: 1.04, duration: 0.6, onUpdate: place }, i - 1).set(proxy, { p: Number(ch.dataset.p) }, i - 0.4).call(place, null, i - 0.4);
      else tl.to(proxy, { p: Number(ch.dataset.p), duration: 1, onUpdate: place }, i - 1);
    });
    const triggers = chapters.map((ch, i) => ScrollTrigger.create({ trigger: ch, start: 'top 55%', end: 'bottom 55%', onToggle: (self) => self.isActive && activate(i) }));

    // 3D product: scroll position drives the camera through three shots.
    const productTrigger = sceneFrame && ScrollTrigger.create({ trigger: '[data-product]', start: 'top 70%', end: 'bottom 30%', onUpdate: (self) => sceneWindow?.postMessage({ type: 'cis-scene-progress', value: self.progress }, location.origin) });
    return () => {
      story.classList.remove('is-scrubbed');
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
