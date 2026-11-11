import { serve } from '../plugin/cli/commands/build.mjs';
import { launch } from '../plugin/cli/lib/browser.mjs';
import { gpuArgs } from '../plugin/cli/lib/qa.mjs';
const s = await serve(process.argv[2]);
const browser = await launch({ args: gpuArgs() });
const variants = { baseline: '', noSmooth: 'html{scroll-behavior:auto!important}', noSticky: '.site-header{position:relative!important}', noScrollPad: 'html{scroll-padding-top:0!important}', noOverflowClip: 'body{overflow-x:visible!important}.hero{overflow:visible!important}' };
for (const [name, css] of Object.entries(variants)) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.addInitScript(() => { window.__ev = []; new PerformanceObserver((l) => l.getEntries().forEach((e) => e.name === 'pointerdown' && window.__ev.push(Math.round(e.duration)))).observe({ type: 'event', buffered: true, durationThreshold: 16 }); });
  await page.goto(s.url + '/', { waitUntil: 'networkidle' });
  if (css) await page.addStyleTag({ content: css });
  await page.waitForTimeout(1500);
  await page.locator(process.argv[3] || '[data-menu]').click(); await page.waitForTimeout(500);
  console.log(name.padEnd(14), JSON.stringify(await page.evaluate(() => window.__ev)));
  await ctx.close();
}
await browser.close(); await s.close();
