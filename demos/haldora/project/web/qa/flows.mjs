// Scripted functional checks for the marketing site, run by `creative-studio test web`.
// Each flow receives a Playwright page and a small expect helper.
const sunPos = (page) => page.evaluate(() => document.querySelector('[data-sun]').getAttribute('transform'));
const xy = (t) => t.match(/-?[\d.]+/g).map(Number);

export const flows = [
  {
    id: 'nav-anchors',
    title: 'Primary navigation scrolls to each section',
    async run({ page, baseUrl, expect }) {
      await page.goto(baseUrl + '/', { waitUntil: 'networkidle' });
      const links = await page.locator('#primary-nav a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
      expect.ok(links.length >= 2, 'navigation has links');
      for (const href of links) {
        await page.locator(`#primary-nav a[href="${href}"]`).click();
        await page.waitForFunction((id) => { const r = document.querySelector(id).getBoundingClientRect(); return r.top < innerHeight * 0.5 && r.bottom > 0; }, href, { timeout: 5000 });
      }
      return `${links.length} links reach their targets`;
    },
  },
  {
    id: 'theme-toggle',
    title: 'Colour scheme toggle switches, announces state and persists',
    async run({ page, baseUrl, expect }) {
      await page.goto(baseUrl + '/', { waitUntil: 'networkidle' });
      const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      const before = await bg();
      await page.locator('[data-theme-toggle]').click();
      await page.waitForTimeout(900);
      expect.equal(await page.evaluate(() => document.documentElement.dataset.scheme), 'dark', 'scheme attribute');
      expect.equal(await page.locator('[data-theme-toggle]').getAttribute('aria-pressed'), 'true', 'aria-pressed');
      expect.notEqual(await bg(), before, 'background colour');
      await page.reload({ waitUntil: 'networkidle' });
      expect.equal(await page.evaluate(() => document.documentElement.dataset.scheme), 'dark', 'scheme after reload');
    },
  },
  {
    id: 'header-over-artwork',
    category: 'accessibility',
    title: 'Dark scheme: the hero shows its night scene, and the header is legible over it and after scrolling',
    async run({ page, baseUrl, expect }) {
      await page.goto(baseUrl + '/', { waitUntil: 'networkidle' });
      await page.evaluate(() => (document.documentElement.dataset.scheme = 'dark'));
      await page.waitForTimeout(600);
      const lum = (rgb) => { const [r, g, b] = rgb.match(/[\d.]+/g).slice(0, 3).map((v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
      const navColor = () => page.locator('#primary-nav a').first().evaluate((el) => getComputedStyle(el).color);
      const atTop = lum(await navColor());
      if (await page.locator('.hero.has-night').count()) {
        expect.ok(await page.locator('.hero-scene.on-dark').isVisible(), 'the night scene is shown');
        expect.ok(!(await page.locator('.hero-scene.on-light').isVisible()), 'the daylight scene is hidden');
        await page.waitForFunction(() => { const i = document.querySelector('.hero-scene.on-dark img.base'); return i.complete && i.naturalWidth > 0; }, null, { timeout: 8000 });
        expect.ok(atTop > 0.6, `navigation text is light over the night artwork (luminance ${atTop.toFixed(3)})`);
        expect.ok(lum(await page.locator('.hero h1').evaluate((el) => getComputedStyle(el).color)) > 0.6, 'the headline takes night ink');
        expect.ok(await page.locator('.brand .on-dark').isVisible(), 'the reversed logo is shown over the night artwork');
      } else {
        expect.ok(atTop < 0.1, `navigation text is dark over the pale artwork (luminance ${atTop.toFixed(3)})`);
        expect.ok(await page.locator('.brand .on-light').isVisible(), 'the logo for light grounds is shown over the artwork');
      }
      await page.evaluate(() => window.scrollTo(0, innerHeight * 1.5));
      await page.waitForFunction(() => document.querySelector('[data-header]').classList.contains('is-stuck'));
      await page.waitForTimeout(500);
      const scrolled = lum(await navColor());
      expect.ok(scrolled > 0.6, `navigation text is light on the dark page once scrolled (luminance ${scrolled.toFixed(3)})`);
      expect.ok(await page.locator('.brand .on-dark').isVisible(), 'the reversed logo is shown on the dark ground');
    },
  },
  {
    id: 'language-switch',
    title: 'Language link opens the right-to-left Arabic page and returns',
    async run({ page, baseUrl, expect }) {
      await page.goto(baseUrl + '/', { waitUntil: 'networkidle' });
      const lang = page.locator('a.lang');
      if (!(await lang.count())) return 'single-locale site';
      const h1 = await page.locator('h1').textContent();
      await lang.click();
      await page.waitForLoadState('networkidle');
      expect.equal(await page.evaluate(() => document.documentElement.dir), 'rtl', 'direction');
      expect.notEqual(await page.locator('h1').textContent(), h1, 'translated headline');
      const start = await page.evaluate(() => { const r = document.querySelector('.hero h1').getBoundingClientRect(); return r.right > innerWidth * 0.6; });
      expect.ok(start, 'headline is anchored to the right edge in RTL');
      await page.locator('a.lang').click();
      await page.waitForLoadState('networkidle');
      expect.equal(await page.evaluate(() => document.documentElement.dir), 'ltr', 'direction after returning');
    },
  },
  {
    id: 'story-scroll',
    category: 'motion',
    title: 'Scroll drives the day story: sun moves on its arc, chapters and frames change',
    async run({ page, baseUrl, expect }) {
      await page.goto(baseUrl + '/', { waitUntil: 'networkidle' });
      await page.waitForFunction(() => window.__motion?.triggers() > 0, null, { timeout: 8000 });
      if (!(await page.locator('[data-sun]').count())) return 'this project has no layered story frames, so no scroll-driven sun';
      const suns = await page.evaluate(() => document.querySelectorAll('.story-visual [data-sun]').length);
      expect.equal(suns, 1, 'exactly one sun is drawn over the story');
      const first = await sunPos(page);
      const positions = new Set([first]);
      const active = new Set();
      const frames = new Set();
      const count = await page.locator('[data-chapter]').count();
      for (let i = 0; i < count; i++) {
        await page.locator('[data-chapter]').nth(i).evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + scrollY - innerHeight * 0.4));
        await page.waitForTimeout(900);
        positions.add(await sunPos(page));
        active.add(await page.evaluate(() => [...document.querySelectorAll('[data-chapter]')].findIndex((c) => c.classList.contains('is-active'))));
        frames.add(await page.evaluate(() => [...document.querySelectorAll('.story .frame')].findIndex((c) => c.classList.contains('is-on'))));
      }
      expect.equal(active.size, count, 'each chapter became active in turn');
      expect.equal(frames.size, count, 'each chapter showed its own frame');
      expect.ok(positions.size >= count, `sun took ${positions.size} distinct positions`);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(900);
      const back = xy(await sunPos(page));
      expect.near(back[0], xy(first)[0], 1.5, 'scrubbing back restores the first position (x)');
      expect.near(back[1], xy(first)[1], 1.5, 'scrubbing back restores the first position (y)');
      return `${count} chapters, ${positions.size} sun positions, reversible`;
    },
  },
  {
    id: 'form-validation',
    title: 'Contact form reports errors accessibly and confirms success',
    async run({ page, baseUrl, expect }) {
      // The form is what is tested, so wait for it rather than for a silent network.
      await page.goto(baseUrl + '/#contact', { waitUntil: 'load' });
      const form = page.locator('[data-form]');
      await form.locator('button[type=submit]').waitFor();
      await form.locator('button[type=submit]').click();
      expect.ok(await form.locator('[data-summary-box]').isVisible(), 'error summary is shown');
      expect.equal(await page.evaluate(() => document.activeElement.id), 'f-name', 'focus moves to the first invalid field');
      expect.equal(await form.locator('#f-name').getAttribute('aria-invalid'), 'true', 'aria-invalid on name');
      expect.ok(await form.locator('#f-name-err').isVisible(), 'inline error is shown');
      await form.locator('#f-name').fill('Ada Example');
      await form.locator('#f-email').fill('not-an-email');
      await form.locator('button[type=submit]').click();
      expect.ok(await form.locator('#f-email-err').isVisible(), 'email format error');
      expect.ok(!(await form.locator('[data-success]').isVisible()), 'no success while invalid');
      await form.locator('#f-email').fill('ada@example.com');
      await form.locator('button[type=submit]').click();
      expect.ok(await form.locator('[data-success]').isVisible(), 'success message');
      expect.equal(await form.locator('#f-name').inputValue(), '', 'form resets');
    },
  },
  {
    id: 'mobile-menu',
    viewport: 'mobile',
    title: 'Mobile menu opens, closes with Escape and returns focus',
    async run({ page, baseUrl, expect }) {
      await page.goto(baseUrl + '/', { waitUntil: 'networkidle' });
      const btn = page.locator('[data-menu]');
      expect.ok(await btn.isVisible(), 'menu button visible on a phone');
      expect.ok(!(await page.locator('#primary-nav').isVisible()), 'links hidden until opened');
      await btn.click();
      expect.equal(await btn.getAttribute('aria-expanded'), 'true', 'aria-expanded');
      expect.ok(await page.locator('#primary-nav a').first().isVisible(), 'links visible');
      await page.keyboard.press('Escape');
      expect.equal(await btn.getAttribute('aria-expanded'), 'false', 'closed by Escape');
      expect.ok(await btn.evaluate((el) => el === document.activeElement), 'focus returned to the button');
    },
  },
  {
    id: 'scene-embed',
    title: 'The 3D product loads lazily and scroll drives its camera',
    async run({ page, baseUrl, expect }) {
      await page.goto(baseUrl + '/', { waitUntil: 'networkidle' });
      const frame = page.locator('[data-scene]');
      if (!(await frame.getAttribute('data-scene'))) return 'no 3D deliverable in this project';
      expect.equal(await page.locator('[data-scene] iframe').count(), 0, 'engine not requested before the section is near');
      await page.locator('#cell').scrollIntoViewIfNeeded();
      await page.waitForSelector('[data-scene].is-live', { timeout: 25000 });
      const inner = page.frameLocator('[data-scene] iframe');
      const fr = page.frames().find((f) => f.url().includes('/scene/'));
      const mode = await fr.evaluate(() => window.__scene.mode);
      if (mode !== 'webgl') return `scene running in ${mode} mode on this machine`;
      const a = await fr.evaluate(() => window.__scene.view());
      await page.mouse.wheel(0, 500);
      await page.waitForTimeout(900);
      const b = await fr.evaluate(() => window.__scene.view());
      expect.ok(Math.abs(a.az - b.az) + Math.abs(a.dist - b.dist) > 0.01, 'camera moved with page scroll');
      expect.ok((await inner.locator('input[name=finish]').count()) >= 1, 'finish controls are present inside the scene');
      return 'lazy-loaded, WebGL, camera follows scroll';
    },
  },
  {
    id: 'no-script',
    category: 'accessibility',
    title: 'With JavaScript disabled the whole page is still readable',
    async run({ baseUrl, expect, ctx }) {
      const bare = await ctx.browser().newContext({ javaScriptEnabled: false, viewport: { width: 1280, height: 800 } });
      try {
        const page = await bare.newPage();
        await page.goto(baseUrl + '/', { waitUntil: 'load' });
        await page.waitForTimeout(2500); // let the CSS-only entrance animation finish
        expect.ok(await page.locator('h1').isVisible(), 'headline visible');
        const chapters = await page.locator('[data-chapter] h3').allTextContents();
        expect.ok(chapters.length >= 3 && chapters.every((t) => t.trim()), 'story chapters are in the HTML');
        const hidden = await page.evaluate(() => [...document.querySelectorAll('main h2, main h3, main p')].filter((el) => Number(getComputedStyle(el).opacity) < 0.3 && el.getBoundingClientRect().width > 0 && !el.closest('[aria-hidden=true]')).length);
        expect.equal(hidden, 0, 'no text left transparent');
        expect.ok(await page.locator('form [type=submit]').isVisible(), 'form present');
      } finally {
        await bare.close();
      }
    },
  },
];

// States a page-level screenshot cannot show. `creative-studio test` captures each one, checks it
// for overflow and compares it with its accepted baseline, so somebody can look at every chapter.
const chapter = (i, path = '/') => async ({ page, baseUrl }) => {
  await page.goto(baseUrl + path, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__motion?.triggers() > 0, null, { timeout: 8000 }).catch(() => {});
  // Centre the chapter, as when it is being read: that is where the sun shows the chapter's time.
  await page.locator('[data-chapter]').nth(i).evaluate((el) => window.scrollTo({ top: el.getBoundingClientRect().top + scrollY + el.offsetHeight / 2 - innerHeight / 2, behavior: 'instant' }));
  await page.waitForTimeout(1500);
};
const product = (path = '/') => async ({ page, baseUrl }) => {
  await page.goto(baseUrl + path, { waitUntil: 'networkidle' });
  await page.locator('#cell').evaluate((el) => window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - 90, behavior: 'instant' }));
  if (await page.locator('[data-scene]').getAttribute('data-scene')) await page.waitForSelector('[data-scene].is-live', { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(1500);
};

const heroAt = (path) => async ({ page, baseUrl }) => {
  await page.goto(baseUrl + path, { waitUntil: 'load' });
  await page.waitForTimeout(1800); // the copy's entrance animation, then the arc's cut-out
};

export const captures = [
  ...[0, 1, 2, 3].map((i) => ({ id: `story-chapter-${i + 1}`, title: `Scroll story, chapter ${i + 1}`, run: chapter(i) })),
  { id: 'story-chapter-1-ar', title: 'Scroll story, first chapter, Arabic', run: chapter(0, '/ar/') },
  { id: 'story-chapter-4-dark', title: 'Scroll story, night chapter, dark scheme', scheme: 'dark', run: chapter(3) },
  // The hero between the phone and desktop layouts, where its composition changes.
  ...[[834, 1194, 'tablet'], [1024, 768, 'small laptop']].flatMap(([w, h, name]) => [
    { id: `hero-${w}`, title: `Hero at ${w} by ${h} (${name})`, viewport: w < 900 ? 'tablet' : 'desktop', size: { width: w, height: h }, run: heroAt('/') },
    { id: `hero-${w}-ar-dark`, title: `Hero at ${w} by ${h}, Arabic, dark scheme`, viewport: w < 900 ? 'tablet' : 'desktop', size: { width: w, height: h }, scheme: 'dark', run: heroAt('/ar/') },
  ]),
  { id: 'product', title: 'Product section with the live 3D view', run: product() },
  { id: 'product-ar-dark', title: 'Product section, Arabic, dark scheme', scheme: 'dark', run: product('/ar/') },
  { id: 'product-mobile', title: 'Product section on a phone', viewport: 'mobile', run: product() },
];
