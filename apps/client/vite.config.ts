import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';

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
    rollupOptions: { output: { entryFileNames: 'app-[hash].js', chunkFileNames: 'chunk-[hash].js', assetFileNames: 'a-[hash][extname]' } },
  },
  plugins: [{
    name: 'marea-version',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD, when: new Date().toISOString() }) });
    },
  }],
});
