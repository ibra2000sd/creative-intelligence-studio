import { defineConfig } from 'vite';

// Relative base so the built scene can be served from any path, including
// inside the marketing site at /scene/.
export default defineConfig({
  base: './',
  build: { target: 'es2022', assetsInlineLimit: 0, chunkSizeWarningLimit: 900 },
});
