import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function buildId(): string {
  if (process.env['MAREA_BUILD']) return process.env['MAREA_BUILD'];
  let sha = '';
  try { sha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { /* repo senza commit */ }
  return `${Date.now().toString(36)}${sha ? '-' + sha : ''}`;
}
const BUILD = buildId();

/** «Dall'ultima volta» (ui/novita.ts): gli ultimi lavori finiti su main, dal git log (ogni PR è un commit col suo titolo). Senza git: lista vuota. */
function novita(): string {
  const nomi = JSON.parse(readFileSync(new URL('autori.json', import.meta.url), 'utf8')) as Record<string, string>;
  let log = '';
  try { log = execSync('git log -n 200 --since=45.days --no-merges --format=%ct%x1f%an%x1f%ae%x1f%s HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString(); } catch { /* repo senza git */ }
  const lavori = log.split('\n').filter(Boolean).map((r) => {
    const [t, an, ae, s] = r.split('\x1f') as [string, string, string, string];
    // via i riferimenti alle PR, «(#276)», «(#264) (#264)», «(sopra #232)»
    return { t: Number(t), chi: nomi[an] ?? nomi[ae] ?? an, titolo: s.replace(/\s*\([^()]*#\d+[^()]*\)/g, '').trim() };
  }).filter((l) => l.titolo && !/^(Merge|Revert) /.test(l.titolo));
  return JSON.stringify({ lavori });
}

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
    // prova3d.html (#38), provapixel.html (#46) provapiste.html (banco di prova delle Corse, #155), provahub.html e provahubvista.html (hub delle Corse, #185), provadiscesa3d.html (discesa in bici, #229): pagine a parte; il loro JS si carica solo da lì (in build.mjs conta come «dopo»)
    rollupOptions: { input: { index: fileURLToPath(new URL('index.html', import.meta.url)), prova3d: fileURLToPath(new URL('prova3d.html', import.meta.url)), provapixel: fileURLToPath(new URL('provapixel.html', import.meta.url)), provapiste: fileURLToPath(new URL('provapiste.html', import.meta.url)), provascena: fileURLToPath(new URL('provascena.html', import.meta.url)), provagarage: fileURLToPath(new URL('provagarage.html', import.meta.url)), provahub: fileURLToPath(new URL('provahub.html', import.meta.url)), provahubvista: fileURLToPath(new URL('provahubvista.html', import.meta.url)), provadiscesa3d: fileURLToPath(new URL('provadiscesa3d.html', import.meta.url)) }, output: { entryFileNames: 'app-[hash].js', chunkFileNames: 'chunk-[hash].js', assetFileNames: 'a-[hash][extname]' } },
  },
  plugins: [{
    name: 'marea-version',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD, when: new Date().toISOString() }) });
      this.emitFile({ type: 'asset', fileName: 'novita.json', source: novita() });
    },
    configureServer(server) {
      server.middlewares.use('/novita.json', (_req, res) => { res.setHeader('content-type', 'application/json'); res.end(novita()); });
    },
  }],
});
