import { serve } from '../plugin/cli/commands/build.mjs';
import { launch } from '../plugin/cli/lib/browser.mjs';
import { gpuArgs } from '../plugin/cli/lib/qa.mjs';
const s = await serve(process.argv[2]);
const browser = await launch({ args: gpuArgs() });
for (const sel of ['[data-menu]', '[data-theme-toggle]']) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.addInitScript(() => { window.__ev = []; new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__ev.push([e.name, Math.round(e.duration), Math.round(e.processingStart - e.startTime), Math.round(e.processingEnd - e.processingStart)]))).observe({ type: 'event', buffered: true, durationThreshold: 16 }); });
  await page.goto(s.url + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  if (process.env.WARM) { await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); await page.touchscreen.tap(200, 700); await page.waitForTimeout(Number(process.env.WARM)); }
  for (let i = 0; i < 3; i++) { await page.locator(sel).click(); await page.waitForTimeout(600); }
  console.log(sel, JSON.stringify(await page.evaluate(() => window.__ev.filter((e) => /click|pointerup|pointerdown/.test(e[0])))));
  await ctx.close();
}
await browser.close(); await s.close();
