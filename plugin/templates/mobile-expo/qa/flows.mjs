// Runtime interaction checks against the web export of the same React Native code
// (react-native-web). They exercise navigation, gestures and state in a real
// browser; they do not replace testing native builds on devices.
const id = (page, t) => page.locator(`[data-testid="${t}"]`);
async function open(page, baseUrl) {
  await page.goto(baseUrl + '/', { waitUntil: 'networkidle' });
  await id(page, 'pager').waitFor({ timeout: 20000 });
}
async function enter(page, baseUrl) {
  await open(page, baseUrl);
  await id(page, 'skip').click();
  await id(page, 'today-title').waitFor();
}
const drag = async (page, box, fromX, toX, y = 0.5) => {
  await page.mouse.move(box.x + box.width * fromX, box.y + box.height * y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * ((fromX + toX) / 2), box.y + box.height * y, { steps: 6 });
  await page.mouse.move(box.x + box.width * toX, box.y + box.height * y, { steps: 6 });
  await page.mouse.up();
};

export const flows = [
  {
    id: 'onboarding-swipe',
    viewport: 'mobile',
    category: 'motion',
    title: 'Onboarding: a horizontal drag turns the page and the indicator follows',
    async run({ page, baseUrl, expect }) {
      await open(page, baseUrl);
      const before = await id(page, 'page-indicator').textContent();
      const box = await id(page, 'pager').boundingBox();
      await drag(page, box, 0.85, 0.15);
      await page.waitForFunction((b) => document.querySelector('[data-testid="page-indicator"]').textContent !== b, before, { timeout: 5000 });
      const after = await id(page, 'page-indicator').textContent();
      expect.match(after, /2/, 'now on page 2');
      await drag(page, box, 0.15, 0.85);
      await page.waitForFunction((a) => document.querySelector('[data-testid="page-indicator"]').textContent !== a, after, { timeout: 5000 });
      expect.match(await id(page, 'page-indicator').textContent(), /1/, 'dragging back returns to page 1');
      return `${before} -> ${after} -> back`;
    },
  },
  {
    id: 'onboarding-buttons',
    viewport: 'mobile',
    title: 'Onboarding: Next walks every page and Get started opens the app',
    async run({ page, baseUrl, expect }) {
      await open(page, baseUrl);
      await id(page, 'next').click();
      await id(page, 'next').click();
      expect.match(await id(page, 'page-indicator').textContent(), /3/, 'last page');
      await id(page, 'next').click();
      await id(page, 'today-title').waitFor();
    },
  },
  {
    id: 'tabs-and-detail',
    viewport: 'mobile',
    title: 'Tabs switch screens; a device opens its detail and Back returns',
    async run({ page, baseUrl, expect }) {
      await enter(page, baseUrl);
      await id(page, 'tab-devices').click();
      await id(page, 'device-cell-1').click();
      await id(page, 'device-title').waitFor();
      expect.match(await id(page, 'device-title').textContent(), /Cell/, 'detail shows the device');
      await page.goBack();
      await id(page, 'device-ev-1').waitFor();
      await id(page, 'tab-settings').click();
      await id(page, 'settings-title').waitFor();
    },
  },
  {
    id: 'time-stepper',
    viewport: 'mobile',
    category: 'motion',
    title: 'Today: stepping time updates the clock, the state line and the dial description',
    async run({ page, baseUrl, expect }) {
      await enter(page, baseUrl);
      const label = () => id(page, 'arc-dial').getAttribute('aria-label');
      const a = await label();
      for (let i = 0; i < 12; i++) await id(page, 'later').click();
      expect.equal(await id(page, 'clock').textContent(), '19:00', 'clock');
      expect.notEqual(await label(), a, 'dial description');
      expect.match(await id(page, 'state').textContent(), /Powering/, 'state line');
    },
  },
  {
    id: 'reserve-slider',
    viewport: 'mobile',
    title: 'Settings: the reserve responds to dragging and to the single-tap buttons',
    async run({ page, baseUrl, expect }) {
      await enter(page, baseUrl);
      await id(page, 'tab-settings').click();
      await id(page, 'reserve-slider').waitFor();
      const val = async () => Number((await id(page, 'reserve-value').textContent()).replace('%', ''));
      expect.equal(await val(), 30, 'initial value');
      await id(page, 'reserve-more').click();
      expect.equal(await val(), 35, 'plus button');
      const box = await id(page, 'reserve-slider').boundingBox();
      await drag(page, box, 0.3, 0.9);
      await page.waitForTimeout(400);
      const dragged = await val();
      expect.ok(dragged >= 80, `drag raised the value to ${dragged}`);
      expect.equal(dragged % 5, 0, 'value snaps to 5% steps');
      return `30 -> 35 by tap -> ${dragged} by drag`;
    },
  },
  {
    id: 'offline-reconnect',
    viewport: 'mobile',
    title: 'Offline: a banner explains the state and Reconnect clears it',
    async run({ page, baseUrl, expect }) {
      await enter(page, baseUrl);
      await id(page, 'tab-settings').click();
      await id(page, 'simulate-offline').click();
      await id(page, 'offline-banner').waitFor();
      await id(page, 'tab-today').click();
      expect.ok(await id(page, 'offline-banner').isVisible(), 'banner persists across tabs');
      await id(page, 'reconnect').click();
      await id(page, 'offline-banner').waitFor({ state: 'detached' });
    },
  },
  {
    id: 'arabic',
    viewport: 'mobile',
    title: 'Language: switching to Arabic translates the interface and mirrors the layout',
    async run({ page, baseUrl, expect }) {
      await enter(page, baseUrl);
      await id(page, 'tab-settings').click();
      const before = await id(page, 'settings-title').textContent();
      await id(page, 'lang-ar').click();
      await page.waitForFunction((b) => document.querySelector('[data-testid="settings-title"]').textContent !== b, before);
      expect.match(await id(page, 'settings-title').textContent(), /[؀-ۿ]/, 'Arabic heading');
      const dir = await id(page, 'settings-title').evaluate((el) => getComputedStyle(el).direction);
      expect.equal(dir, 'rtl', 'computed direction');
      expect.equal(await id(page, 'lang-ar').getAttribute('aria-checked'), 'true', 'radio state');
    },
  },
];
