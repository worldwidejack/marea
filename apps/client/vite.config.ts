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

/** Le pagine della build: il gioco (index.html) e i banchi di prova di banchi.json. */
function pagine(): Record<string, string> {
  const banchi = JSON.parse(readFileSync(new URL('banchi.json', import.meta.url), 'utf8')) as { pagina: string }[];
  return Object.fromEntries(['index.html', ...banchi.map((b) => b.pagina)].map((p) => [p.replace(/\.html$/, ''), fileURLToPath(new URL(p, import.meta.url))]));
}

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

/** CREDITI della schermata iniziale (ui/crediti.ts): i caratteri e le licenze degli asset così come sono scritti nei loro file. */
function crediti(): string {
  const leggi = (p: string) => { try { return readFileSync(new URL(p, import.meta.url), 'utf8'); } catch { return ''; } };
  return JSON.stringify({ caratteri: leggi('public/assets/fonts/LEGGIMI.txt'), asset: leggi('../../assets/licenses.md') });
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
    // banchi di prova: pagine a parte, elencate in banchi.json (il guardiano in tools/guardiani.mjs vuole lì ogni .html); il loro JS si carica solo da lì (in build.mjs conta come «dopo»)
    rollupOptions: { input: pagine(), output: { entryFileNames: 'app-[hash].js', chunkFileNames: 'chunk-[hash].js', assetFileNames: 'a-[hash][extname]' } },
  },
  plugins: [{
    name: 'marea-version',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD, when: new Date().toISOString() }) });
      this.emitFile({ type: 'asset', fileName: 'novita.json', source: novita() });
      this.emitFile({ type: 'asset', fileName: 'crediti.json', source: crediti() });
    },
    configureServer(server) {
      server.middlewares.use('/novita.json', (_req, res) => { res.setHeader('content-type', 'application/json'); res.end(novita()); });
      server.middlewares.use('/crediti.json', (_req, res) => { res.setHeader('content-type', 'application/json'); res.end(crediti()); });
    },
  }],
});
