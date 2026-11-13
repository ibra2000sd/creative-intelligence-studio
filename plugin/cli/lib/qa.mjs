// Browser QA harness: functional, visual, accessibility, motion and
// performance checks against a built deliverable served on loopback.
// Every result is a {id, category, status, summary, measurement, data, evidence}
// record; lab measurements are labelled as lab.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { walk, exists } from './util.mjs';
import { resolveDep } from './deps.mjs';
import { launch } from './browser.mjs';

export const VIEWPORTS = { mobile: { width: 390, height: 844 }, tablet: { width: 768, height: 1024 }, desktop: { width: 1440, height: 900 } };
// Budgets are defaults a project may tighten; they follow the Core Web Vitals "good" thresholds.
export const BUDGETS = { lcpMs: 2500, cls: 0.1, inpMs: 200, tbtMs: 300, jsGzipKb: 300, cssGzipKb: 60 };

const check = (id, category, status, summary, extra = {}) => ({ id, category, status, summary, ...extra });

export function gpuArgs() {
  // A real GPU gives meaningful frame timing; software rendering does not.
  return process.platform === 'darwin' ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--ignore-gpu-blocklist'];
}

/** Collect console errors, uncaught exceptions and failed requests for a page. */
function instrument(page) {
  const log = { console: [], exceptions: [], failed: [], transferred: 0, requests: 0 };
  page.on('console', (m) => m.type() === 'error' && log.console.push(m.text().slice(0, 300)));
  page.on('pageerror', (e) => log.exceptions.push(String(e).slice(0, 300)));
  page.on('requestfailed', (r) => !r.url().startsWith('data:') && log.failed.push(`${r.failure()?.errorText || 'failed'} ${r.url()}`));
  page.on('response', async (r) => {
    log.requests++;
    if (r.status() >= 400) log.failed.push(`${r.status()} ${r.url()}`);
    const len = Number(r.headers()['content-length']);
    if (Number.isFinite(len)) log.transferred += len;
  });
  return log;
}

const settle = (page, ms = 500) => page.waitForLoadState('networkidle').then(() => page.waitForTimeout(ms));

// ------------------------------------------------------------ page checks ---

async function checkLoad(page, log, label) {
  const broken = await page.evaluate(() => [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.currentSrc).map((i) => i.currentSrc));
  const problems = [...log.exceptions.map((e) => `exception: ${e}`), ...log.console.map((e) => `console: ${e}`), ...log.failed.map((e) => `request: ${e}`), ...broken.map((b) => `broken image: ${b}`)];
  return check(`load:${label}`, 'functional', problems.length ? 'fail' : 'pass', problems.length ? `${problems.length} runtime problem(s) on load` : 'No console errors, exceptions, failed requests or broken images', { severity: 'critical', measurement: 'lab', data: { problems: problems.slice(0, 12), requests: log.requests } });
}

async function checkOverflow(page, label) {
  const res = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const wide = document.documentElement.scrollWidth - vw;
    const offenders = [];
    if (wide > 1) {
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        if (r.width && (r.right > vw + 1 || r.left < -1) && getComputedStyle(el).position !== 'fixed') {
          offenders.push(`${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''} (${Math.round(r.left)}..${Math.round(r.right)} of ${vw})`);
          if (offenders.length >= 6) break;
        }
      }
    }
    // Text clipped inside its own box (overflow hidden + content wider than the box).
    const clipped = [];
    for (const el of document.querySelectorAll('h1,h2,h3,p,a,button,label,li,dd,dt,span')) {
      const cs = getComputedStyle(el);
      if (cs.overflowX !== 'visible' && el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 2 && cs.textOverflow !== 'ellipsis' && el.children.length === 0) clipped.push(`${el.tagName.toLowerCase()} "${el.textContent.trim().slice(0, 30)}"`);
      if (clipped.length >= 6) break;
    }
    return { wide, offenders, clipped };
  });
  const bad = res.wide > 1 || res.clipped.length;
  return check(`layout:${label}`, 'visual', bad ? 'fail' : 'pass', bad ? `Horizontal overflow of ${res.wide}px; ${res.clipped.length} clipped text node(s)` : 'No horizontal overflow or clipped text', { severity: 'major', measurement: 'lab', data: res });
}

let axeSource = null;
async function checkAxe(page, label) {
  if (!axeSource) {
    const hit = resolveDep('axe-core/axe.min.js');
    if (!hit) return check(`a11y-axe:${label}`, 'accessibility', 'blocked', 'axe-core is not installed (creative-studio setup --only browser)', { measurement: 'lab' });
    axeSource = fs.readFileSync(hit.file, 'utf8');
  }
  await page.evaluate(axeSource);
  const res = await page.evaluate(async () => {
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }, resultTypes: ['violations', 'incomplete'] });
    const slim = (v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, sample: v.nodes.slice(0, 3).map((n) => ({ target: n.target.join(' '), summary: (n.failureSummary || '').split('\n').slice(0, 3).join(' ').slice(0, 220) })) });
    return { violations: r.violations.map(slim), incomplete: r.incomplete.map(slim), passes: r.passes?.length ?? null };
  });
  const serious = res.violations.filter((v) => ['critical', 'serious'].includes(v.impact));
  // "Incomplete" means axe could not decide a rule (for example contrast over an image or an
  // overlapping element). That is not a pass: it is reported as a warning naming the rules.
  const undecided = res.incomplete.map((v) => `${v.id} (${v.nodes})`);
  const status = serious.length ? 'fail' : res.violations.length || undecided.length ? 'warn' : 'pass';
  const parts = [];
  if (res.violations.length) parts.push(`${res.violations.length} axe violation(s): ${res.violations.map((v) => `${v.id} (${v.impact}, ${v.nodes})`).join(', ')}`);
  if (undecided.length) parts.push(`${undecided.length} rule(s) axe could not decide and a person must check: ${undecided.join(', ')}`);
  if (!parts.length) parts.push('No WCAG 2.2 A/AA violations detectable by axe-core');
  return check(`a11y-axe:${label}`, 'accessibility', status, parts.join('; '), { severity: serious.length ? 'critical' : 'minor', measurement: 'lab', data: res });
}

async function checkKeyboard(page, label) {
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.activeElement?.blur();
  });
  const expected = await page.evaluate(() => {
    const sel = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"]),iframe';
    return [...document.querySelectorAll(sel)].filter((el) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (cs.visibility === 'hidden' || cs.display === 'none' || el.closest('[hidden],[inert]')) return false;
      // Radio groups are one tab stop.
      if (el.type === 'radio' && !el.checked && document.querySelector(`input[type=radio][name="${el.name}"]:checked`)) return false;
      return r.width > 0 || r.height > 0 || el.classList.contains('skip-link');
    }).length;
  });
  const seen = [];
  const noIndicator = [];
  const obscured = [];
  for (let i = 0; i < Math.min(expected + 4, 80); i++) {
    await page.keyboard.press('Tab');
    // Focus may trigger a (smooth) scroll: judge visibility once the page has come to rest.
    await page.evaluate(() => new Promise((resolve) => { let last = scrollY; let still = 0; const tick = () => { still = scrollY === last ? still + 1 : 0; last = scrollY; if (still >= 4) resolve(); else requestAnimationFrame(tick); }; requestAnimationFrame(tick); setTimeout(resolve, 3000); }));
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 1) || cs.boxShadow !== 'none';
      // Radios and similar inputs may delegate their focus ring to a wrapping label.
      const wrap = el.closest('label');
      const wcs = wrap && getComputedStyle(wrap);
      const delegated = wrap && ((wcs.outlineStyle !== 'none' && parseFloat(wcs.outlineWidth) >= 1) || wcs.boxShadow !== 'none');
      // WCAG 2.2 SC 2.4.11 Focus Not Obscured (Minimum): fail only when no part of the element can be seen.
      const pts = [[0.5, 0.5], [0.15, 0.25], [0.85, 0.25], [0.15, 0.75], [0.85, 0.75]].map(([fx, fy]) => [r.left + r.width * fx, r.top + r.height * fy]).filter(([x, y]) => x >= 0 && y >= 0 && x < innerWidth && y < innerHeight);
      const hit = pts.some(([x, y]) => { const top = document.elementFromPoint(x, y); return top && (el.contains(top) || top.contains(el) || wrap?.contains(top)); });
      const covered = r.width > 0 && r.height > 0 && !hit;
      const id = `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.getAttribute('href') ? `[${el.getAttribute('href').slice(0, 24)}]` : ''}:${(el.textContent || el.getAttribute('aria-label') || el.name || '').trim().slice(0, 24)}`;
      return { id, ring: Boolean(ring || delegated), covered, tag: el.tagName };
    });
    if (!info) continue;
    if (seen.includes(info.id) && info.tag !== 'IFRAME') break; // wrapped around
    seen.push(info.id);
    if (!info.ring && info.tag !== 'IFRAME') noIndicator.push(info.id);
    if (info.covered && info.tag !== 'IFRAME') obscured.push(info.id);
    if (info.tag === 'IFRAME') break; // focus has moved into an embedded document; it is tested on its own
  }
  const reachedIframe = seen.some((s) => s.startsWith('iframe'));
  const missing = reachedIframe ? 0 : Math.max(0, expected - seen.length);
  const bad = noIndicator.length || missing > 1 || obscured.length;
  return check(`keyboard:${label}`, 'accessibility', bad ? 'fail' : 'pass', bad ? `${noIndicator.length} stop(s) without a visible focus indicator, ${obscured.length} obscured, ${missing} unreachable` : `${seen.length} tab stops reached in order, each with a visible focus indicator and none obscured`, { severity: 'critical', measurement: 'lab', data: { expected, reached: seen.length, order: seen.slice(0, 40), noIndicator, obscured } });
}

async function checkTargets(page, label, minPx) {
  const small = await page.evaluate((min) => {
    const out = [];
    for (const el of document.querySelectorAll('a[href],button,input:not([type=hidden]),select,[role=button]')) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || el.closest('[hidden]')) continue;
      let r = el.getBoundingClientRect();
      // An input that fills its label takes the label's size as its target.
      if (el.tagName === 'INPUT' && el.closest('label')) r = el.closest('label').getBoundingClientRect();
      if (!r.width && !r.height) continue;
      const inline = el.tagName === 'A' && cs.display === 'inline' && el.parentElement && el.parentElement.textContent.trim().length > el.textContent.trim().length + 8;
      if (!inline && (r.width < min - 0.5 || r.height < min - 0.5)) out.push(`${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 24)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    return out;
  }, minPx);
  return check(`target-size:${label}`, 'accessibility', small.length ? 'fail' : 'pass', small.length ? `${small.length} target(s) smaller than ${minPx}x${minPx} CSS px (WCAG 2.2 SC 2.5.8)` : `All pointer targets are at least ${minPx}x${minPx} CSS px`, { severity: 'major', measurement: 'lab', data: { small: small.slice(0, 12) } });
}

async function checkReducedMotion(browser, url, label) {
  const ctx = await browser.newContext({ viewport: VIEWPORTS.desktop, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: 'load' });
    await settle(page, 600);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight / 2));
    await page.waitForTimeout(400);
    const res = await page.evaluate(() => {
      const running = document.getAnimations().filter((a) => a.playState === 'running' && (a.effect?.getComputedTiming().duration || 0) > 200);
      const hidden = [...document.querySelectorAll('main h1,main h2,main h3,main p,main li')].filter((el) => {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return r.width > 0 && (Number(cs.opacity) < 0.3 || cs.visibility === 'hidden') && !el.closest('[aria-hidden=true]');
      });
      return { running: running.map((a) => a.animationName || a.transitionProperty || a.constructor.name).slice(0, 8), hidden: hidden.map((e) => e.textContent.trim().slice(0, 30)).slice(0, 8), engine: window.__motion?.engine || null };
    });
    const bad = res.running.length || res.hidden.length || res.engine;
    return check(`reduced-motion:${label}`, 'motion', bad ? 'fail' : 'pass', bad ? `With reduced motion: ${res.running.length} long animation(s) running, ${res.hidden.length} text element(s) left hidden${res.engine ? `, ${res.engine} still active` : ''}` : 'With reduced motion: no long-running animation, no scroll-linked engine loaded, all content visible', { severity: 'critical', measurement: 'lab', data: res });
  } finally {
    await ctx.close();
  }
}

async function measureOnce(browser, url) {
  const ctx = await browser.newContext({ viewport: VIEWPORTS.mobile, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  try {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.addInitScript(() => {
      window.__perf = { lcp: 0, cls: 0, long: 0, events: [] };
      new PerformanceObserver((l) => l.getEntries().forEach((e) => (window.__perf.lcp = e.startTime))).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver((l) => l.getEntries().forEach((e) => !e.hadRecentInput && (window.__perf.cls += e.value))).observe({ type: 'layout-shift', buffered: true });
      new PerformanceObserver((l) => l.getEntries().forEach((e) => (window.__perf.long += Math.max(0, e.duration - 50)))).observe({ type: 'longtask', buffered: true });
      new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__perf.events.push(e.duration))).observe({ type: 'event', buffered: true, durationThreshold: 16 });
    });
    const log = instrument(page);
    await page.goto(url, { waitUntil: 'load' });
    await settle(page, 800);
    // Blocking time is read before any scripted input, as load-time blocking; responsiveness is measured separately.
    const loadLong = await page.evaluate(() => window.__perf.long);
    // One representative interaction for a lab responsiveness figure.
    const target = page.locator('button:visible, a.button:visible').first();
    if (await target.count()) await target.click({ trial: false, timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(500);
    const perf = await page.evaluate(() => ({ ...window.__perf, nav: performance.getEntriesByType('navigation')[0]?.domContentLoadedEventEnd || 0, dom: document.querySelectorAll('*').length }));
    perf.long = loadLong;
    const inp = perf.events.length ? Math.max(...perf.events) : null;
    return { lcpMs: Math.round(perf.lcp), cls: Number(perf.cls.toFixed(4)), tbtMs: Math.round(perf.long), interactionMs: inp === null ? null : Math.round(inp), domContentLoadedMs: Math.round(perf.nav), domNodes: perf.dom, requests: log.requests };
  } finally {
    await ctx.close();
  }
}

/**
 * True when timing data should not be trusted: the host had more runnable work than cores,
 * or identical loads disagreed by more than 150 ms and more than 1.5 times their median.
 */
export function measurementIsNoisy(blockingTimes, median, loadPerCore) {
  const spread = Math.max(...blockingTimes) - Math.min(...blockingTimes);
  return loadPerCore > 1 || spread > Math.max(150, 1.5 * median);
}

/** Lab web vitals: the median of five spaced cold loads, because single runs are noisy. */
async function checkPerformance(browser, url, label, overrides = null) {
  const budget = { ...BUDGETS, ...(overrides || {}) };
  const runs = [];
  for (let i = 0; i < 5; i++) {
    await new Promise((r) => setTimeout(r, 800)); // let the previous page finish tearing down
    runs.push(await measureOnce(browser, url));
  }
  const median = (k) => {
    const v = runs.map((r) => r[k]).filter((x) => x !== null).sort((a, b) => a - b);
    return v.length ? v[Math.floor(v.length / 2)] : null;
  };
  const data = { lcpMs: median('lcpMs'), cls: median('cls'), tbtMs: median('tbtMs'), interactionMs: median('interactionMs'), domNodes: runs[0].domNodes, requests: runs[0].requests, runs: runs.map((r) => ({ lcpMs: r.lcpMs, cls: r.cls, tbtMs: r.tbtMs, interactionMs: r.interactionMs })), conditions: 'Median of 5 cold loads. Mobile viewport 390x844 @2x, 4x CPU throttling, loopback network (no latency). Lab numbers from this machine; not field data.' };
  const measure = (b) => {
    const over = [];
    if (data.lcpMs > b.lcpMs) over.push(`LCP ${data.lcpMs}ms > ${b.lcpMs}ms`);
    if (data.cls > b.cls) over.push(`CLS ${data.cls} > ${b.cls}`);
    if (data.tbtMs > b.tbtMs) over.push(`TBT ${data.tbtMs}ms > ${b.tbtMs}ms`);
    return over;
  };
  const overDefault = measure(BUDGETS);
  const over = measure(budget);
  // Timing is only meaningful on a quiet host. A busy machine or a wide spread between identical
  // loads means an over-budget median is not evidence of a slow page, and is reported as such.
  const tbts = runs.map((r) => r.tbtMs);
  const loadPerCore = Number((os.loadavg()[0] / os.cpus().length).toFixed(2)); // 0 on Windows
  const noisy = measurementIsNoisy(tbts, data.tbtMs, loadPerCore);
  Object.assign(data, { hostLoadPerCore: loadPerCore, blockingTimeRangeMs: [Math.min(...tbts), Math.max(...tbts)], reliable: !noisy });
  // INP is a field metric. One scripted tap in the lab is only a hint, so it can warn but not fail.
  const slowTap = data.interactionMs !== null && data.interactionMs > budget.inpMs ? `first scripted tap took ${data.interactionMs}ms to paint under 4x throttling (the ${budget.inpMs}ms INP threshold applies to field data; investigate on a real device)` : '';
  const figures = `LCP ${data.lcpMs}ms, CLS ${data.cls}, TBT ${data.tbtMs}ms${data.interactionMs !== null ? `, first tap ${data.interactionMs}ms` : ''} (median of 5)`;
  if (over.length && noisy) {
    return check(`web-vitals-lab:${label}`, 'performance', 'warn', `Lab figures unreliable: host load was ${loadPerCore} per core and blocking time ranged ${Math.min(...tbts)} to ${Math.max(...tbts)}ms across five identical loads. Median ${figures} would be over budget (${over.join('; ')}). Re-run on an idle machine before drawing a conclusion.`, { severity: 'minor', measurement: 'lab', data });
  }
  if (over.length) return check(`web-vitals-lab:${label}`, 'performance', 'fail', `Over budget in the lab: ${over.join('; ')}`, { severity: 'major', measurement: 'lab', data });
  // Over the default budget but inside a documented exception: surfaced as a warning, never as a clean pass.
  if (overDefault.length) return check(`web-vitals-lab:${label}`, 'performance', 'warn', `Lab: ${figures}. Over the default budget (${overDefault.join('; ')}) but within this deliverable's documented exception: ${overrides.rationale}`, { severity: 'minor', measurement: 'lab', data: { ...data, exception: overrides } });
  if (slowTap) return check(`web-vitals-lab:${label}`, 'performance', 'warn', `Lab: ${figures}; ${slowTap}`, { severity: 'minor', measurement: 'lab', data });
  return check(`web-vitals-lab:${label}`, 'performance', 'pass', `Lab: ${figures}`, { severity: 'major', measurement: 'lab', data });
}

/** Scroll the whole page at a steady rate while sampling frame intervals and layout shift. */
async function checkScrollMotion(page, label) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  const res = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const frames = [];
        let cls = 0;
        const po = new PerformanceObserver((l) => l.getEntries().forEach((e) => !e.hadRecentInput && (cls += e.value)));
        po.observe({ type: 'layout-shift' });
        const max = document.documentElement.scrollHeight - innerHeight;
        const duration = Math.min(9000, Math.max(2500, max * 1.1));
        let start = 0;
        let last = 0;
        function step(now) {
          start ||= now;
          if (last) frames.push(now - last);
          last = now;
          const p = Math.min(1, (now - start) / duration);
          window.scrollTo(0, max * p);
          if (p < 1) requestAnimationFrame(step);
          else {
            po.disconnect();
            const s = [...frames].sort((a, b) => a - b);
            resolve({ samples: s.length, medianMs: s[Math.floor(s.length / 2)] || 0, p95Ms: s[Math.floor(s.length * 0.95)] || 0, over33: s.filter((v) => v > 33.4).length, over50: s.filter((v) => v > 50).length, cls: Number(cls.toFixed(4)), scrolledPx: max, engine: window.__motion ? { ...window.__motion, triggers: window.__motion.triggers?.() } : null });
          }
        }
        requestAnimationFrame(step);
      }),
  );
  if (res.samples < 20) return check(`scroll-motion:${label}`, 'motion', 'skipped', 'Page too short to measure scroll motion', { measurement: 'lab', data: res });
  const janky = res.over50 / res.samples > 0.05 || res.p95Ms > 50;
  const shifted = res.cls > BUDGETS.cls;
  return check(`scroll-motion:${label}`, 'motion', janky || shifted ? 'fail' : res.over33 / res.samples > 0.08 ? 'warn' : 'pass', `Scrolling ${res.scrolledPx}px: median frame ${res.medianMs.toFixed(1)}ms, p95 ${res.p95Ms.toFixed(1)}ms, ${res.over33} of ${res.samples} frames over 33ms, layout shift ${res.cls}`, { severity: 'major', measurement: 'lab', data: { ...res, conditions: 'Desktop viewport, this machine\'s GPU, headless Chrome. Not a low-powered device.' } });
}

async function screenshots(page, dir, label, { fullPage = false } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${label}.png`);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(250);
  await page.screenshot({ path: file, fullPage, animations: 'disabled' });
  return file;
}

async function checkVisualRegression(file, baselineDir, label, { update, threshold = 0.015 }) {
  const base = path.join(baselineDir, path.basename(file));
  if (update || !exists(base)) {
    fs.mkdirSync(baselineDir, { recursive: true });
    fs.copyFileSync(file, base);
    return check(`visual-regression:${label}`, 'visual', 'skipped', update ? 'Baseline updated' : 'No baseline existed; this capture is now the baseline', { measurement: 'lab', evidence: [file] });
  }
  const { diff } = await import('./raster.mjs');
  const heat = file.replace(/\.png$/, '.diff.png');
  const d = await diff(base, file, { heatmap: heat });
  const bad = d.sizeMismatch || d.changedRatio > threshold;
  if (!bad) fs.rmSync(heat, { force: true });
  return check(`visual-regression:${label}`, 'visual', bad ? 'fail' : 'pass', bad ? `${(d.changedRatio * 100).toFixed(2)}% of pixels differ from the accepted baseline${d.sizeMismatch ? ' and the size changed' : ''}` : `Matches the accepted baseline (${(d.changedRatio * 100).toFixed(3)}% difference)`, { severity: 'major', measurement: 'lab', data: { changedRatio: d.changedRatio, regions: d.regions.slice(0, 6), threshold }, evidence: bad ? [file, heat] : [file] });
}

// ------------------------------------------------------------- static -------

/** Bundle weight from the built files (gzip), against budgets. */
export function checkBundle(distDir, label, { exclude = [] } = {}) {
  const files = walk(distDir).filter((f) => !exclude.some((e) => f.includes(e)));
  const gz = (f) => zlib.gzipSync(fs.readFileSync(f)).length;
  const sum = (ext) => files.filter((f) => ext.includes(path.extname(f))).reduce((n, f) => n + gz(f), 0);
  const js = sum(['.js', '.mjs']);
  const css = sum(['.css']);
  const total = files.reduce((n, f) => n + fs.statSync(f).size, 0);
  const biggest = files.map((f) => ({ file: path.relative(distDir, f), bytes: fs.statSync(f).size })).sort((a, b) => b.bytes - a.bytes).slice(0, 6);
  const over = [];
  if (js / 1024 > BUDGETS.jsGzipKb) over.push(`JS ${(js / 1024).toFixed(0)}KB gzip > ${BUDGETS.jsGzipKb}KB`);
  if (css / 1024 > BUDGETS.cssGzipKb) over.push(`CSS ${(css / 1024).toFixed(0)}KB gzip > ${BUDGETS.cssGzipKb}KB`);
  return check(`bundle:${label}`, 'performance', over.length ? 'warn' : 'pass', over.length ? over.join('; ') : `JS ${(js / 1024).toFixed(1)}KB gzip, CSS ${(css / 1024).toFixed(1)}KB gzip, ${files.length} files, ${(total / 1024 / 1024).toFixed(2)}MB on disk`, { severity: 'minor', measurement: 'static', data: { jsGzipBytes: js, cssGzipBytes: css, totalBytes: total, files: files.length, biggest } });
}

// --------------------------------------------------------------- runner -----

/**
 * Run the browser suite against one deliverable.
 * `pages`: [{label, path, rtl}], `flows`: scripted functional tests exported by
 * the deliverable itself (qa/flows.mjs), `options`: which generic checks apply.
 */
export async function runBrowserSuite({ baseUrl, pages, evidenceDir, baselineDir, flowsFile, budgets = null, minTargetPx = 24, updateBaselines = false, options = {} }) {
  const checks = [];
  const browser = await launch({ args: gpuArgs() });
  try {
    for (const pg of pages) {
      const url = baseUrl + pg.path;
      for (const [vpName, viewport] of Object.entries(VIEWPORTS)) {
        const label = `${pg.label}@${vpName}`;
        const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: vpName !== 'desktop', isMobile: vpName === 'mobile', reducedMotion: 'no-preference' });
        const page = await ctx.newPage();
        const log = instrument(page);
        try {
          await page.goto(url, { waitUntil: 'load' });
          await settle(page, options.settleMs ?? 700);
          checks.push(await checkLoad(page, log, label));
          checks.push(await checkOverflow(page, label));
          if (pg.rtl) {
            const dir = await page.evaluate(() => ({ dir: document.documentElement.dir, lang: document.documentElement.lang, computed: getComputedStyle(document.body).direction }));
            checks.push(check(`rtl:${label}`, 'visual', dir.dir === 'rtl' && dir.computed === 'rtl' ? 'pass' : 'fail', `Document direction is ${dir.dir || 'unset'} (computed ${dir.computed}), language ${dir.lang}`, { severity: 'critical', measurement: 'lab', data: dir }));
          }
          const shot = await screenshots(page, evidenceDir, label.replace(/[@/]/g, '-'), { fullPage: vpName === 'desktop' && options.fullPage !== false });
          if (options.visualRegression !== false && baselineDir) checks.push(await checkVisualRegression(shot, baselineDir, label, { update: updateBaselines }));
          if (vpName === 'desktop') {
            checks.push(await checkAxe(page, `${pg.label}:light`));
            await page.evaluate(() => (document.documentElement.dataset.scheme = 'dark'));
            await page.waitForTimeout(700);
            checks.push(await checkAxe(page, `${pg.label}:dark`));
            await screenshots(page, evidenceDir, `${pg.label}-desktop-dark`);
            await page.evaluate(() => (document.documentElement.dataset.scheme = 'light'));
            await page.waitForTimeout(300);
            checks.push(await checkKeyboard(page, pg.label));
            if (options.scrollMotion !== false) checks.push(await checkScrollMotion(page, pg.label));
          }
          if (vpName === 'mobile') checks.push(await checkTargets(page, label, minTargetPx));
        } catch (e) {
          checks.push(check(`suite:${label}`, 'functional', 'fail', `Check run aborted: ${String(e.message || e).split('\n')[0].slice(0, 240)}`, { severity: 'critical', measurement: 'lab' }));
        } finally {
          await ctx.close();
        }
      }
      if (options.reducedMotion !== false) checks.push(await checkReducedMotion(browser, url, pg.label));
      if (options.performance !== false) checks.push(await checkPerformance(browser, url, pg.label, pg.budgets === false ? null : budgets));
    }

    if (flowsFile && exists(flowsFile)) {
      const mod = await import(pathToFileURL(flowsFile).href + `?t=${Date.now()}`);
      for (const flow of mod.flows || []) {
        const ctx = await browser.newContext({ viewport: VIEWPORTS[flow.viewport || 'desktop'], hasTouch: flow.viewport === 'mobile', isMobile: flow.viewport === 'mobile', reducedMotion: flow.reducedMotion ? 'reduce' : 'no-preference', locale: flow.locale || 'en-GB' });
        const page = await ctx.newPage();
        const log = instrument(page);
        const started = Date.now();
        try {
          const detail = await flow.run({ page, baseUrl, expect: makeExpect(), evidenceDir, ctx });
          if (log.exceptions.length) throw new Error(`uncaught exception during flow: ${log.exceptions[0]}`);
          checks.push(check(`flow:${flow.id}`, flow.category || 'functional', 'pass', `${flow.title}${detail ? `: ${detail}` : ''}`, { severity: 'critical', measurement: 'lab', data: { ms: Date.now() - started } }));
        } catch (e) {
          const shot = path.join(evidenceDir, `flow-${flow.id}-failure.png`);
          await page.screenshot({ path: shot }).catch(() => {});
          checks.push(check(`flow:${flow.id}`, flow.category || 'functional', 'fail', `${flow.title}: ${String(e.message || e).split('\n')[0].slice(0, 260)}`, { severity: 'critical', measurement: 'lab', evidence: [shot] }));
        } finally {
          await ctx.close();
        }
      }
    }
  } finally {
    await browser.close();
  }
  return checks;
}

/** Tiny assertion helper handed to flows, so deliverables need no test framework. */
function makeExpect() {
  const fail = (msg) => {
    throw new Error(msg);
  };
  return {
    ok: (cond, msg) => cond || fail(msg),
    equal: (a, b, msg) => a === b || fail(`${msg || 'values differ'}: got ${JSON.stringify(a)}, expected ${JSON.stringify(b)}`),
    notEqual: (a, b, msg) => a !== b || fail(`${msg || 'values should differ'}: both ${JSON.stringify(a)}`),
    near: (a, b, tol, msg) => Math.abs(a - b) <= tol || fail(`${msg || 'not close'}: got ${a}, expected ${b} ± ${tol}`),
    match: (s, rx, msg) => rx.test(String(s)) || fail(`${msg || 'no match'}: ${JSON.stringify(String(s).slice(0, 80))} vs ${rx}`),
  };
}

export function totals(targets) {
  const t = { pass: 0, fail: 0, warn: 0, skipped: 0, blocked: 0 };
  for (const tg of targets) for (const c of tg.checks) t[c.status]++;
  return t;
}
