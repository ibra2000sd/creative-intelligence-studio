// node tests/longtasks.mjs <dist> [path] [throttle]
import { serve } from '../plugin/cli/commands/build.mjs';
import { launch } from '../plugin/cli/lib/browser.mjs';
import { gpuArgs } from '../plugin/cli/lib/qa.mjs';
const [dir, p = '/', rate = '4'] = process.argv.slice(2);
const s = await serve(dir);
const browser = await launch({ args: gpuArgs() });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(rate) });
await page.addInitScript(() => { window.__lt = []; new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push([Math.round(e.startTime), Math.round(e.duration)]))).observe({ type: 'longtask', buffered: true }); });
await page.goto(s.url + p, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
const lt = await page.evaluate(() => window.__lt);
console.log(`throttle ${rate}x long tasks [start,duration]:`, JSON.stringify(lt), 'TBT', lt.reduce((n, [, d]) => n + Math.max(0, d - 50), 0));
await browser.close(); await s.close();
