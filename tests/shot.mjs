// Ad-hoc screenshot helper: node tests/shot.mjs <dist-dir> <out.png> [path] [width] [height] [waitMs]
import { serve } from '../plugin/cli/commands/build.mjs';
import { launch } from '../plugin/cli/lib/browser.mjs';
const [dir, out, p = '/', w = '1280', h = '800', wait = '1500'] = process.argv.slice(2);
const s = await serve(dir);
const browser = await launch({ args: (process.env.SHOT_ARGS || '').split(' ').filter(Boolean) });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(s.url + p, { waitUntil: 'networkidle' });
await page.waitForTimeout(+wait);
await page.screenshot({ path: out });
console.log(JSON.stringify({ errors, scene: await page.evaluate(() => (window.__scene ? { mode: window.__scene.mode, info: window.__scene.info?.(), stats: window.__scene.frameStats?.() } : null)) }));
await browser.close();
await s.close();
