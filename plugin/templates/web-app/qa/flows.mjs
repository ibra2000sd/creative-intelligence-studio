// Scripted functional checks for the web application, run by `creative-studio test app`.
const go = async (page, baseUrl, q = '') => { await page.goto(`${baseUrl}/${q}`, { waitUntil: 'networkidle' }); await page.waitForSelector('h1'); };
const num = (s) => Number(String(s).replace(/[^\d.]/g, ''));

export const flows = [
  {
    id: 'navigation',
    title: 'Every section is reachable, updates the title and moves focus to its heading',
    async run({ page, baseUrl, expect }) {
      await go(page, baseUrl);
      const titles = new Set([await page.title()]);
      for (const r of ['devices', 'history', 'settings', 'overview']) {
        await page.locator(`.side nav a[href="#/${r}"]`).click();
        await page.waitForFunction((x) => document.querySelector(`.side nav a[href="#/${x}"]`).getAttribute('aria-current') === 'page', r);
        await page.waitForFunction(() => document.activeElement?.tagName === 'H1', null, { timeout: 5000 });
        titles.add(await page.title());
      }
      expect.equal(titles.size, 4, 'distinct document titles');
      await page.goBack();
      await page.waitForFunction(() => location.hash === '#/settings');
      expect.equal(await page.locator('.side nav a[aria-current=page]').getAttribute('href'), '#/settings', 'browser back works');
    },
  },
  {
    id: 'chart-scrub',
    category: 'motion',
    title: 'The time slider drives the readout, the cursor and the sun on its arc',
    async run({ page, baseUrl, expect }) {
      await go(page, baseUrl);
      await page.waitForSelector('#hour');
      const read = async () => ({ text: await page.locator('.readout b').textContent(), battery: num(await page.locator('.stat-value').first().textContent()) });
      const set = async (v) => { await page.locator('#hour').fill(String(v)); await page.waitForTimeout(1300); return read(); };
      const morning = await set(7);
      const noon = await set(13);
      const night = await set(22);
      expect.equal(morning.text, '07:00', 'readout');
      expect.equal(night.text, '22:00', 'readout');
      expect.ok(noon.battery !== morning.battery || night.battery !== noon.battery, 'battery figure follows the selected time');
      await page.locator('#hour').focus();
      await page.keyboard.press('ArrowLeft');
      expect.equal(await page.locator('.readout b').textContent(), '21:30', 'keyboard steps half an hour');
      return `battery ${morning.battery}% at 07:00, ${noon.battery}% at 13:00, ${night.battery}% at 22:00`;
    },
  },
  {
    id: 'chart-alternatives',
    category: 'accessibility',
    title: 'Chart series can be toggled and the data is available as a table',
    async run({ page, baseUrl, expect }) {
      await go(page, baseUrl);
      const lines = () => page.locator('.plot .line').count();
      await page.waitForSelector('.plot .line');
      const before = await lines();
      const chip = page.locator('.legend .chip').first();
      await chip.click();
      await page.waitForTimeout(900);
      expect.equal(await chip.getAttribute('aria-pressed'), 'false', 'aria-pressed');
      expect.ok((await lines()) < before, 'series removed from the plot');
      await page.locator('.link-button').click();
      expect.equal(await page.locator('#chart-table tbody tr').count(), 24, 'one table row per hour');
      expect.equal(await page.locator('.link-button').getAttribute('aria-expanded'), 'true', 'aria-expanded');
    },
  },
  {
    id: 'devices-states',
    title: 'Devices: loading state, list, and an accessible expand/collapse',
    async run({ page, baseUrl, expect }) {
      await page.goto(`${baseUrl}/#/devices`);
      await page.waitForSelector('.skeleton[role=status]', { timeout: 4000 });
      await page.waitForSelector('.devices .device');
      expect.equal(await page.locator('.device').count(), 4, 'devices listed');
      const btn = page.locator('.device .icon-button').first();
      await btn.click();
      expect.equal(await btn.getAttribute('aria-expanded'), 'true', 'expanded');
      await page.waitForSelector('.device-details');
      expect.match(await page.locator('.device-details').first().textContent(), /HC-0193-2291/, 'details shown');
      await btn.click();
      await page.waitForSelector('.device-details', { state: 'detached' });
    },
  },
  {
    id: 'devices-error-recovery',
    title: 'Devices: a failed request shows an error and Try again recovers',
    async run({ page, baseUrl, expect }) {
      await page.goto(`${baseUrl}/?scenario=error#/devices`);
      await page.waitForSelector('.notice[role=alert]');
      expect.equal(await page.locator('.device').count(), 0, 'no stale list');
      await page.locator('.notice .button').click();
      await page.waitForSelector('.devices .device');
      expect.equal(await page.locator('.notice').count(), 0, 'error cleared');
    },
  },
  {
    id: 'devices-empty',
    title: 'Devices: the empty state explains itself',
    async run({ page, baseUrl, expect }) {
      await page.goto(`${baseUrl}/?scenario=empty#/devices`);
      await page.waitForSelector('.empty h2');
      expect.match(await page.locator('.empty').textContent(), /\S{3,}/, 'empty state has copy');
    },
  },
  {
    id: 'history-table',
    title: 'History: sorting announces its direction; filter, empty result and paging work',
    async run({ page, baseUrl, expect }) {
      await page.goto(`${baseUrl}/#/history`);
      await page.waitForSelector('table.data tbody tr');
      const col = async (n) => (await page.locator(`table.data tbody tr td:nth-child(${n})`).allTextContents()).map(num);
      const th = page.locator('table.data thead th').nth(1);
      await th.locator('button').click();
      expect.equal(await th.getAttribute('aria-sort'), 'ascending', 'aria-sort');
      const asc = await col(2);
      expect.ok(asc.every((v, i) => i === 0 || asc[i - 1] <= v), 'ascending order');
      await th.locator('button').click();
      expect.equal(await th.getAttribute('aria-sort'), 'descending', 'aria-sort');
      const desc = await col(2);
      expect.ok(desc.every((v, i) => i === 0 || desc[i - 1] >= v), 'descending order');
      await page.locator('.pager .button').last().click();
      expect.match(await page.locator('.pager [aria-current]').textContent(), /2/, 'page 2');
      await page.locator('#q').fill('1999');
      await page.waitForSelector('.empty');
      await page.locator('.empty .button').click();
      await page.waitForSelector('table.data tbody tr');
      expect.equal(await page.locator('#q').inputValue(), '', 'filter cleared');
    },
  },
  {
    id: 'settings-save',
    title: 'Settings: validation, save confirmation, and the reserve reaches the overview',
    async run({ page, baseUrl, expect }) {
      await page.goto(`${baseUrl}/#/settings`);
      await page.waitForSelector('#reserve');
      await page.locator('#alerts').check();
      await page.locator('button[type=submit]').click();
      expect.ok(await page.locator('#email-err').isVisible(), 'email required when alerts are on');
      expect.equal(await page.evaluate(() => document.activeElement.id), 'email', 'focus on the invalid field');
      await page.locator('#email').fill('ada@example.com');
      await page.locator('#reserve').fill('60');
      await page.locator('button[type=submit]').click();
      await page.waitForSelector('.toast.success');
      await page.locator('.side nav a[href="#/overview"]').click();
      await page.waitForSelector('#hour');
      await page.locator('#hour').fill('23.5');
      await page.waitForTimeout(1300);
      expect.ok(num(await page.locator('.stat-value').first().textContent()) >= 59, 'battery never drops below the new 60% reserve');
    },
  },
  {
    id: 'settings-rollback',
    title: 'Settings: a failed save reports the failure and restores the previous values',
    async run({ page, baseUrl, expect }) {
      await page.goto(`${baseUrl}/?scenario=save-error#/settings`);
      await page.waitForSelector('#reserve');
      await page.locator('#reserve').fill('80');
      await page.locator('button[type=submit]').click();
      await page.waitForSelector('.toast.danger');
      expect.equal(await page.locator('#reserve').inputValue(), '30', 'value rolled back');
    },
  },
  {
    id: 'rtl-layout',
    title: 'Arabic: navigation sits on the right, the chart keeps time left to right',
    async run({ page, baseUrl, expect }) {
      await go(page, baseUrl, '?lang=ar');
      await page.waitForSelector('.plot .line');
      const side = await page.locator('.side').boundingBox();
      expect.ok(side.x > 600, 'sidebar on the right');
      expect.equal(await page.locator('.plot').getAttribute('dir'), 'ltr', 'chart direction');
      expect.match(await page.locator('h1').textContent(), /[؀-ۿ]/, 'Arabic heading');
      await page.locator('.lang').click();
      await page.waitForFunction(() => document.documentElement.dir === 'ltr');
    },
  },
  {
    id: 'mobile-nav',
    viewport: 'mobile',
    title: 'Phone: bottom navigation is reachable and content clears it',
    async run({ page, baseUrl, expect }) {
      await go(page, baseUrl);
      const nav = await page.locator('.side').boundingBox();
      expect.ok(nav.y > 600, 'navigation docked at the bottom');
      await page.locator('.side nav a[href="#/history"]').click();
      await page.waitForSelector('table.data');
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      const last = await page.locator('.pager').boundingBox();
      const bar = await page.locator('.side').boundingBox();
      expect.ok(last.y + last.height <= bar.y + 1, 'last control is not hidden behind the navigation bar');
    },
  },
  {
    id: 'reduced-motion',
    reducedMotion: true,
    category: 'motion',
    title: 'Reduced motion: figures and markers change without travelling',
    async run({ page, baseUrl, expect }) {
      await go(page, baseUrl);
      await page.waitForSelector('#hour');
      await page.locator('#hour').fill('20');
      await page.waitForTimeout(120);
      const a = await page.locator('.stat-value').first().textContent();
      await page.waitForTimeout(700);
      expect.equal(await page.locator('.stat-value').first().textContent(), a, 'figure settled immediately');
    },
  },
  {
    id: 'sun-above-cursor',
    title: 'Chart: the sun stays directly above the time cursor, and the arc stands on sunrise and sunset',
    async run({ page, baseUrl, expect }) {
      await go(page, baseUrl);
      await page.waitForSelector('.plot .line');
      const read = () => page.evaluate(() => {
        const cursor = Number(document.querySelector('.plot .cursor').getAttribute('x1'));
        const g = document.querySelector('.plot .sun-core').parentElement;
        const m = new DOMMatrixReadOnly(getComputedStyle(g).transform);
        return { cursor, sun: m.m41, opacity: Number(getComputedStyle(g).opacity) };
      });
      await page.locator('#hour').focus();
      const seen = [];
      for (const presses of [0, 8, -20]) {
        for (let i = 0; i < Math.abs(presses); i++) await page.keyboard.press(presses > 0 ? 'ArrowRight' : 'ArrowLeft');
        await page.waitForTimeout(1400);
        const r = await read();
        expect.near(r.sun, r.cursor, 2.5, `sun is above the cursor at ${await page.locator('.readout b').textContent()}`);
        expect.ok(r.opacity > 0.9, 'the sun is shown during daylight');
        seen.push(Math.round(r.cursor));
      }
      expect.equal(new Set(seen).size, 3, 'three different times were checked');
      for (let i = 0; i < 12; i++) await page.keyboard.press('ArrowLeft'); // 01:00
      await page.waitForTimeout(1200);
      expect.ok((await read()).opacity < 0.1, 'no sun is drawn at night');
      return `checked at x = ${seen.join(', ')}`;
    },
  },
  {
    id: 'one-moment',
    title: 'Today describes one moment: update time, figures and battery state agree, and the forecast is labelled',
    async run({ page, baseUrl, expect }) {
      await go(page, baseUrl);
      await page.waitForSelector('.plot .line');
      const now = await page.locator('.readout b').textContent();
      const head = await page.locator('.page-head .muted').textContent();
      expect.ok(head.includes(now.slice(0, 2) + ':'), `the update time (${head.trim().slice(0, 24)}) is in the same hour as the figures (${now})`);
      expect.equal(await page.locator('.inspect').count(), 0, 'nothing says "showing another time" at first');
      expect.ok((await page.locator('.plot .forecast').count()) >= 1, 'the rest of the day is drawn as a forecast');
      expect.ok(await page.locator('.plot .now-label').isVisible(), '"Now" is marked on the chart');
      const battery = await page.locator('.flow-list li').nth(1).locator('.flow-value').textContent();
      if (/100%/.test(battery)) expect.ok(!/charging/.test(battery), `a full battery is not described as charging ("${battery}")`);
      await page.locator('#hour').focus();
      for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowRight');
      expect.ok(await page.locator('.inspect').isVisible(), 'moving the slider says which moment is shown');
      expect.match(await page.locator('.inspect').textContent(), /forecast/, 'a later time is called a forecast');
      await page.locator('.inspect button').click();
      expect.equal(await page.locator('.readout b').textContent(), now, '"Back to now" returns to the present');
      return `now ${now}; battery "${battery.trim()}"`;
    },
  },
  {
    id: 'phone-display-settings',
    viewport: 'mobile',
    title: 'Phone: language and appearance are in Settings, and History fits the screen',
    async run({ page, baseUrl, expect }) {
      await go(page, baseUrl, '#/settings');
      const dark = page.locator('#dark-mode');
      expect.ok(await dark.isVisible(), 'appearance switch is in Settings');
      await dark.check({ force: true });
      expect.equal(await page.evaluate(() => document.documentElement.dataset.scheme), 'dark', 'the switch changes the scheme');
      await dark.uncheck({ force: true });
      const lang = page.locator('[data-lang-link]');
      expect.ok(await lang.isVisible(), 'language choice is in Settings');
      await lang.click();
      await page.waitForFunction(() => document.documentElement.dir === 'rtl');
      expect.match(await page.evaluate(() => location.hash), /settings/, 'the page is kept when the language changes');
      await page.locator('.side nav a[href="#/history"]').click();
      await page.waitForSelector('table.data');
      const wide = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect.ok(wide <= 1, `History does not scroll sideways on a phone (${wide}px over)`);
      const cols = await page.locator('table.data thead th').evaluateAll((ths) => ths.filter((th) => getComputedStyle(th).display !== 'none').length);
      expect.equal(cols, 3, 'three columns are shown on a phone');
      const inside = await page.evaluate(() => { const t = document.querySelector('table.data').getBoundingClientRect(); return t.right <= innerWidth + 1 && t.left >= -1; });
      expect.ok(inside, 'the whole table is inside the screen');
    },
  },
];

// Routes and states a screenshot of the first page does not show. Each is captured, checked for
// overflow and compared with its accepted baseline.
const route = (r, q = '', then = async () => {}) => async ({ page, baseUrl }) => {
  await go(page, baseUrl, `${q}#/${r}`);
  await page.waitForSelector(r === 'history' ? 'table.data' : r === 'devices' ? '.device' : r === 'settings' ? 'form' : '.plot .line');
  await then(page);
};
const scrub = (steps) => async (page) => {
  await page.locator('#hour').focus();
  for (let i = 0; i < steps; i++) await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(1200);
};

export const captures = [
  { id: 'portal-devices', title: 'Devices', run: route('devices') },
  { id: 'portal-history', title: 'History', run: route('history') },
  { id: 'portal-settings', title: 'Settings', run: route('settings') },
  { id: 'portal-forecast', title: 'Today, slider moved to the evening forecast', run: route('overview', '', scrub(11)) },
  { id: 'portal-devices-mobile', title: 'Devices on a phone', viewport: 'mobile', fullPage: 'tall', run: route('devices') },
  { id: 'portal-history-mobile', title: 'History on a phone', viewport: 'mobile', fullPage: 'tall', run: route('history') },
  { id: 'portal-settings-mobile', title: 'Settings on a phone', viewport: 'mobile', fullPage: 'tall', run: route('settings') },
  { id: 'portal-history-ar-mobile', title: 'History on a phone, Arabic', viewport: 'mobile', fullPage: 'tall', run: route('history', '?lang=ar') },
  { id: 'portal-settings-ar-mobile-dark', title: 'Settings on a phone, Arabic, dark scheme', viewport: 'mobile', scheme: 'dark', fullPage: 'tall', run: route('settings', '?lang=ar') },
];
