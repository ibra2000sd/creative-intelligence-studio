// Headless Chromium through playwright-core, using a browser already on the
// machine. Nothing is downloaded.
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { CisError, EXIT } from './util.mjs';
import { need, findChrome } from './deps.mjs';

export async function launch({ headless = true, args = [] } = {}) {
  const chrome = findChrome();
  if (!chrome) throw new CisError('E_NO_BROWSER', 'No Chrome, Chromium or Edge found. Install one or set CIS_CHROME to a Chromium binary.', { exit: EXIT.MISSING_DEP });
  const { chromium } = need('playwright-core', 'browser');
  return chromium.launch({ executablePath: chrome, headless, args: ['--force-color-profile=srgb', '--hide-scrollbars', ...args] });
}

/** Print an HTML file to PDF. Size is in CSS units, e.g. {width:'210mm', height:'297mm'}. */
export async function htmlToPdf(htmlFile, pdfFile, { width, height, landscape = false } = {}) {
  const browser = await launch();
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(path.resolve(htmlFile)).href, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    fs.mkdirSync(path.dirname(pdfFile), { recursive: true });
    await page.pdf({ path: pdfFile, printBackground: true, preferCSSPageSize: !width, ...(width ? { width, height } : { format: 'A4' }), landscape, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
  } finally {
    await browser.close();
  }
}

/** Render a standalone SVG to a single-page vector PDF of the same physical size. */
export async function svgToPdf(svg, pdfFile, { widthMm, heightMm }) {
  const tmp = pdfFile.replace(/\.pdf$/, '.print.html');
  fs.mkdirSync(path.dirname(pdfFile), { recursive: true });
  fs.writeFileSync(tmp, `<!doctype html><meta charset="utf-8"><style>@page{size:${widthMm}mm ${heightMm}mm;margin:0}html,body{margin:0}svg{display:block;width:${widthMm}mm;height:${heightMm}mm}</style>${svg}`);
  try {
    await htmlToPdf(tmp, pdfFile, { width: `${widthMm}mm`, height: `${heightMm}mm` });
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}
