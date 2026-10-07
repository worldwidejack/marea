import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

function buildId(): string {
  if (process.env['MAREA_BUILD']) return process.env['MAREA_BUILD'];
  let sha = '';
  try { sha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { /* repo senza commit */ }
  return `${Date.now().toString(36)}${sha ? '-' + sha : ''}`;
}
const BUILD = buildId();

export default defineConfig({
  base: '/',
  define: { __BUILD__: JSON.stringify(BUILD) },
  optimizeDeps: { exclude: ['@marea/sim', '@marea/protocol', '@marea/content'] },
  server: {
    host: true,
    proxy: { '/api': 'http://127.0.0.1:8787', '/ws': { target: 'ws://127.0.0.1:8787', ws: true } },
  },
  build: {
    outDir: process.env['MAREA_OUTDIR'] || 'dist',
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: false,
    // prova3d.html (#38) e provapixel.html (#46): prove di stile, pagine a parte; il loro JS si carica solo da lì (in build.mjs conta come «dopo»)
    rollupOptions: { input: { index: fileURLToPath(new URL('index.html', import.meta.url)), prova3d: fileURLToPath(new URL('prova3d.html', import.meta.url)), provapixel: fileURLToPath(new URL('provapixel.html', import.meta.url)) }, output: { entryFileNames: 'app-[hash].js', chunkFileNames: 'chunk-[hash].js', assetFileNames: 'a-[hash][extname]' } },
  },
  plugins: [{
    name: 'marea-version',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD, when: new Date().toISOString() }) });
    },
  }],
});
