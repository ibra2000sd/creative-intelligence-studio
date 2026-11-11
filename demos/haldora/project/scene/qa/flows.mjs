// Scripted checks for the interactive 3D scene, run by `creative-studio test scene`.
const ready = (page) => page.waitForFunction(() => window.__scene && (window.__scene.mode === 'fallback' || window.__scene.info), null, { timeout: 25000 });
const settled = (page) => page.waitForFunction(() => window.__scene.info().pendingTweens === 0 && !window.__scene.info().rafActive, null, { timeout: 8000 });
const hexDist = (a, b) => { const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); const [x, y] = [p(a), p(b)]; return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };

async function open(page, baseUrl, query = '') {
  await page.goto(`${baseUrl}/${query}`, { waitUntil: 'networkidle' });
  await ready(page);
  return page.evaluate(() => window.__scene.mode);
}

export const flows = [
  {
    id: 'renders-webgl',
    title: 'The model loads and renders with WebGL',
    async run({ page, baseUrl, expect }) {
      const mode = await open(page, baseUrl);
      expect.equal(mode, 'webgl', 'render mode');
      await settled(page);
      const info = await page.evaluate(() => window.__scene.info());
      expect.ok(info.triangles > 1000, `triangles drawn: ${info.triangles}`);
      expect.ok(info.calls > 0 && info.calls < 40, `draw calls: ${info.calls}`);
      // A rendered product is not a flat field: read pixels straight after a render.
      const variety = await page.evaluate(() => window.__scene.sample());
      expect.ok(variety >= 12, `distinct tones on the canvas: ${variety}`);
      return `${info.triangles} triangles in ${info.calls} draw calls; ${variety} distinct tones read back from the canvas`;
    },
  },
  {
    id: 'idle-costs-nothing',
    category: 'performance',
    title: 'No frames are rendered while nothing changes',
    async run({ page, baseUrl, expect }) {
      if ((await open(page, baseUrl)) !== 'webgl') return 'not applicable in still mode';
      await settled(page);
      const a = await page.evaluate(() => window.__scene.info().frames);
      await page.waitForTimeout(1500);
      const b = await page.evaluate(() => window.__scene.info().frames);
      expect.equal(b, a, 'frames rendered while idle');
    },
  },
  {
    id: 'finish-configurator',
    title: 'Choosing a finish changes the product material',
    async run({ page, baseUrl, expect }) {
      if ((await open(page, baseUrl)) !== 'webgl') return 'not applicable in still mode';
      await settled(page);
      const before = await page.evaluate(() => window.__scene.bodyColor());
      const radios = page.locator('input[name=finish]');
      expect.ok((await radios.count()) >= 2, 'at least two finishes offered');
      await radios.nth(1).check({ force: true });
      await settled(page);
      const after = await page.evaluate(() => window.__scene.bodyColor());
      expect.ok(hexDist(before, after) > 20, `material colour changed (${before} -> ${after})`);
      expect.match(await page.locator('#scene').getAttribute('aria-label'), /\S/, 'canvas description updated');
      return `${before} -> ${after}`;
    },
  },
  {
    id: 'time-of-day',
    title: 'The time slider moves the sun along the arc on the product',
    async run({ page, baseUrl, expect }) {
      if ((await open(page, baseUrl)) !== 'webgl') return 'not applicable in still mode';
      const at = async (h) => { await page.locator('#time').evaluate((el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, String(h)); return page.evaluate(() => window.__scene.sun()); };
      const morning = await at(7);
      const noon = await at(14);
      const evening = await at(21);
      expect.ok(morning[0] < noon[0] && noon[0] < evening[0], 'sun travels left to right through the day');
      expect.ok(noon[1] > morning[1] && noon[1] > evening[1], 'sun is highest at midday');
      expect.equal(await page.locator('#time-out').textContent(), '21:00', 'readout');
    },
  },
  {
    id: 'pointer-orbit',
    title: 'Dragging turns the product, within limits',
    async run({ page, baseUrl, expect }) {
      if ((await open(page, baseUrl)) !== 'webgl') return 'not applicable in still mode';
      await settled(page);
      const box = await page.locator('#scene').boundingBox();
      const a = await page.evaluate(() => window.__scene.view().az);
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 - 220, box.y + box.height / 2, { steps: 12 });
      await page.mouse.up();
      await settled(page);
      const b = await page.evaluate(() => window.__scene.view().az);
      expect.ok(Math.abs(b - a) > 0.15, `azimuth changed (${a.toFixed(2)} -> ${b.toFixed(2)})`);
      expect.ok(Math.abs(b) <= 1.36, 'cannot orbit behind the wall');
    },
  },
  {
    id: 'keyboard-orbit',
    category: 'accessibility',
    title: 'Arrow keys turn and zoom the product (keyboard alternative to dragging)',
    async run({ page, baseUrl, expect }) {
      if ((await open(page, baseUrl)) !== 'webgl') return 'not applicable in still mode';
      await settled(page);
      await page.locator('#scene').focus();
      const a = await page.evaluate(() => window.__scene.view());
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('+');
      await settled(page);
      const b = await page.evaluate(() => window.__scene.view());
      expect.ok(Math.abs(b.az - a.az) > 0.1, 'arrow keys changed the angle');
      expect.ok(b.dist < a.dist - 0.05, 'plus key zoomed in');
    },
  },
  {
    id: 'scroll-camera',
    category: 'motion',
    title: 'Embedded mode: progress messages drive the camera choreography',
    async run({ page, baseUrl, expect }) {
      if ((await open(page, baseUrl, '?embed=1')) !== 'webgl') return 'not applicable in still mode';
      const at = async (p) => { await page.evaluate((v) => window.postMessage({ type: 'cis-scene-progress', value: v }, location.origin), p); await page.waitForTimeout(250); return page.evaluate(() => window.__scene.view()); };
      const start = await at(0);
      const mid = await at(0.5);
      const end = await at(1);
      expect.ok(mid.dist < start.dist - 0.5, 'camera moves in for the close-up');
      expect.ok(end.az < -0.5 && start.az > 0.3, 'camera travels to the opposite side');
      await page.evaluate(() => window.postMessage({ type: 'cis-scene-progress', value: 0 }, 'https://evil.example'));
    },
  },
  {
    id: 'still-fallback',
    title: 'Still-image mode works without WebGL and keeps the configurator',
    async run({ page, baseUrl, expect }) {
      const mode = await open(page, baseUrl, '?fallback=1');
      expect.equal(mode, 'fallback', 'mode');
      expect.ok(await page.locator('#fallback').isVisible(), 'still image visible');
      expect.ok(!(await page.locator('#scene').isVisible()), 'canvas hidden');
      await page.waitForFunction(() => document.getElementById('fallback').naturalWidth > 0);
      const a = await page.locator('#fallback').getAttribute('src');
      await page.locator('input[name=finish]').nth(1).check({ force: true });
      const b = await page.locator('#fallback').getAttribute('src');
      expect.notEqual(a, b, 'finish changes the still image');
      await page.waitForFunction(() => document.getElementById('fallback').naturalWidth > 0);
      expect.match(await page.locator('#fallback').getAttribute('alt'), /\S/, 'still image has a text alternative');
      const requested = await page.evaluate(() => performance.getEntriesByType('resource').some((r) => /scene-.*\.js|\.glb/.test(r.name)));
      expect.ok(!requested, 'the 3D engine and model were not downloaded');
    },
  },
  {
    id: 'context-loss',
    title: 'A lost WebGL context degrades to the still image',
    async run({ page, baseUrl, expect }) {
      if ((await open(page, baseUrl)) !== 'webgl') return 'not applicable in still mode';
      await settled(page);
      const lost = await page.evaluate(() => { const gl = document.getElementById('scene').getContext('webgl2'); const ext = gl && gl.getExtension('WEBGL_lose_context'); if (!ext) return false; ext.loseContext(); return true; });
      if (!lost) return 'WEBGL_lose_context is unavailable in this browser; not exercised';
      await page.waitForFunction(() => window.__scene.mode === 'fallback', null, { timeout: 8000 });
      expect.ok(await page.locator('#fallback').isVisible(), 'still image shown after context loss');
    },
  },
  {
    id: 'resource-cleanup',
    category: 'performance',
    title: 'Disposing the scene releases GPU geometry and textures',
    async run({ page, baseUrl, expect }) {
      if ((await open(page, baseUrl)) !== 'webgl') return 'not applicable in still mode';
      await settled(page);
      const before = await page.evaluate(() => window.__scene.info());
      const after = await page.evaluate(() => { const s = window.__scene; s.api.dispose(); return s.info(); });
      expect.ok(before.geometries > 0, 'geometries were allocated');
      expect.equal(after.geometries, 0, 'geometries after dispose');
      expect.equal(after.textures, 0, 'textures after dispose');
      return `${before.geometries} geometries and ${before.textures} textures released`;
    },
  },
];
