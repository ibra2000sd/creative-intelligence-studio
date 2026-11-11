import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';
import { renderPage, renderHead } from './src/render.js';

const content = JSON.parse(fs.readFileSync(new URL('./src/content.json', import.meta.url), 'utf8'));
const dna = JSON.parse(fs.readFileSync(new URL('./src/dna/dna.json', import.meta.url), 'utf8'));
const icons = JSON.parse(fs.readFileSync(new URL('./src/dna/icons.json', import.meta.url), 'utf8'));
const locales = Object.keys(content.locales);
const others = locales.filter((l) => l !== content.defaultLocale);
const hasScene = fs.existsSync(new URL('./public/scene/index.html', import.meta.url));

// Pre-render every locale to static HTML at build time: the page is complete
// and readable before (or without) JavaScript, and each language has its own URL.
function prerender() {
  return {
    name: 'cis-prerender',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        const m = /data-locale="([^"]+)"/.exec(html);
        const locale = !m || m[1] === 'default' ? content.defaultLocale : m[1];
        const depth = locale === content.defaultLocale ? '' : '../';
        const c = content.locales[locale];
        return html
          .replace(/<html[^>]*>/, `<html lang="${locale}" dir="${c.dir}" data-locale="${locale}">`)
          .replace('<!--head-->', renderHead({ content, locale, base: depth, dna }))
          .replace('<!--app-->', renderPage({ content, locale, base: depth, dna, icons, hasScene }));
      },
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [prerender()],
  build: {
    target: 'es2022',
    rollupOptions: { input: { main: path.resolve('index.html'), ...Object.fromEntries(others.map((l) => [l, path.resolve(l, 'index.html')])) } },
  },
});
