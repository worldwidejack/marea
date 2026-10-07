#!/usr/bin/env node
/**
 * Test runner.
 * Uso: node tests/run.mjs [static|types|sim|<e2e>|contact|all]... [--no-build] [--keep]
 *        [--only <testo>]           esegue solo i test il cui nome (o la cui suite) contiene <testo>
 *        [--viewport iphone|desktop] viewport predefinito di ctx.open() (default iphone; un test può passare { viewport } esplicito)
 *        [--timeout <ms>]           timeout per suite (default: `export const timeout` della suite, altrimenti 180000)
 * Il client viene costruito in una cartella privata (tests/out/dist-<pid>) e servito su una porta libera: agenti in parallelo non collidono.
 * e2e: tests/e2e/<nome>.mjs → `export default async function (ctx) {...}`, opzionale `export const timeout`.
 * ctx (API stabile, si può solo aggiungere): vedi makeCtx(); wrangler: ctx.startWrangler({ distDir?, port? }).
 * Uscite: tests/out/report.json (durate per test e per suite), tests/out/build.json, tests/out/shots/<suite>_*.png.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from '../tools/build.mjs';
import { contact } from '../tools/contact.mjs';
import { startServer } from './lib/server.mjs';
import { startWrangler } from './lib/wrangler.mjs';
import * as B from './lib/browser.mjs';
import assert from './lib/assert.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'tests/out');

// --- argomenti: --flag [valore] ---
const VALUE_FLAGS = new Set(['--only', '--viewport', '--timeout']);
const argv = process.argv.slice(2);
const opts = new Set(); const optVal = {}; let suites = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (VALUE_FLAGS.has(a)) { optVal[a] = argv[++i]; opts.add(a); }
  else if (a.startsWith('--')) opts.add(a);
  else suites.push(a);
}
const ONLY = optVal['--only'] ? String(optVal['--only']).toLowerCase() : null;
const VIEWPORT_NAME = optVal['--viewport'] || 'iphone';
if (!['iphone', 'desktop'].includes(VIEWPORT_NAME)) { console.error(`--viewport: '${VIEWPORT_NAME}' non valido (iphone|desktop)`); process.exit(2); }
const VIEWPORT = VIEWPORT_NAME === 'desktop' ? B.DESKTOP : B.IPHONE;
const TIMEOUT_OVERRIDE = optVal['--timeout'] ? Number(optVal['--timeout']) : null;
if (opts.has('--only') && !ONLY) { console.error('--only vuole un nome di test'); process.exit(2); }

const e2eAvail = fs.readdirSync(path.join(ROOT, 'tests/e2e')).filter((f) => f.endsWith('.mjs')).map((f) => f.replace('.mjs', ''));
if (!suites.length) suites = ['static', 'sim', 'boot'];
// ordine di `all`: static types sim, poi boot, look, perf, poi le suite wpN in ordine, poi contact
const E2E_ORDER = ['boot', 'look', 'perf'];
const e2eSorted = [...E2E_ORDER.filter((n) => e2eAvail.includes(n)), ...e2eAvail.filter((n) => !E2E_ORDER.includes(n)).sort()];
if (suites.includes('all')) suites = ['static', 'types', 'sim', ...e2eSorted, 'contact'];
fs.mkdirSync(path.join(OUT, 'shots'), { recursive: true });

const results = []; const suiteInfo = {}; const t0 = Date.now();
const C = { g: (s) => `\x1b[32m${s}\x1b[0m`, r: (s) => `\x1b[31m${s}\x1b[0m`, y: (s) => `\x1b[33m${s}\x1b[0m` };
function record(suite, name, ok, ms, err, warn = false) {
  results.push({ suite, name, ok, ms, err: err ? String(err.stack || err.message || err).split('\n').slice(0, 8).join('\n') : null, warn });
  console.log(`  ${ok ? (warn ? C.y('WARN') : C.g('PASS')) : C.r('FAIL')} ${suite} › ${name} (${ms} ms)${err && !ok ? '\n    ' + String(err.message || err).split('\n').slice(0, 6).join('\n    ') : warn && err ? ' ' + err : ''}`);
}
/** true se --only non è impostato o corrisponde a suite/test. */
const wanted = (suite, name = '') => !ONLY || suite.toLowerCase().includes(ONLY) || name.toLowerCase().includes(ONLY);

function runNode(args, timeout = 180000) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = ''; p.stdout.on('data', (d) => (out += d)); p.stderr.on('data', (d) => (out += d));
    const to = setTimeout(() => { p.kill('SIGKILL'); out += '\n[timeout]'; }, timeout);
    p.on('close', (code) => { clearTimeout(to); resolve({ code, out }); });
  });
}
let server = null, browser = null, distDir = null; const wranglers = [];
async function ensureWeb() {
  if (server) return;
  if (opts.has('--no-build')) distDir = path.join(ROOT, 'apps/client/dist');
  else {
    distDir = path.join(OUT, `dist-${process.pid}`);
    const b0 = Date.now();
    // il budget non blocca gli e2e: diventa un risultato a parte («build › budget»), così le altre suite girano comunque
    const rep = await build({ outDir: distDir, quiet: true, buildId: `test-${process.pid}`, enforce: false });
    const detail = `js ${rep.jsKB} KB (gzip ${rep.jsGzipKB}) · iniziale ${rep.initialMB} MB · texture ${rep.textureMB} MB`;
    record('build', 'budget TECH §5 — ' + detail, rep.ok, Date.now() - b0, rep.ok ? null : rep.errors.join('; '));
  }
  server = await startServer(distDir);
  browser = await B.launch();
}
function makeCtx(suite) {
  const ctx = {
    suite, ROOT, OUT, distDir, base: server.url, browser, assert, B, opts, viewport: VIEWPORT, viewportName: VIEWPORT_NAME, only: ONLY,
    async open(query = '', o = {}) { const p = await B.openPage(browser, server.url + '/' + query, { viewport: VIEWPORT, ...o }); ctx._pages.push(p); return p; },
    waitReady: B.waitReady, waitState: B.waitState, getState: B.getState, getPerf: B.getPerf, screenStats: B.screenStats,
    shot: (page, name) => B.shot(page, `${suite}_${name}`),
    /** Esegue un test con nome; con --only i non corrispondenti sono saltati in silenzio. */
    async test(name, fn) {
      if (!wanted(suite, name)) return;
      const s = Date.now();
      try { await fn(); record(suite, name, true, Date.now() - s); } catch (e) { record(suite, name, false, Date.now() - s, e); }
    },
    warn(name, msg) { record(suite, name, true, 0, msg, true); },
    noErrors(p, what = '') {
      const errs = [...p.errors.map((e) => 'pageerror: ' + e), ...p.consoleErrors.map((e) => 'console: ' + e), ...p.failed.map((e) => 'request: ' + e)];
      if (errs.length) throw new assert.TestFail(`${what} errori:\n      ` + errs.slice(0, 8).join('\n      '));
    },
    /** wrangler dev --local su `distDir` (default: il dist dei test). Chiuso automaticamente a fine suite. */
    async startWrangler(o = {}) { const w = await startWrangler({ distDir: ctx.distDir, ...o }); wranglers.push(w); return w; },
    /** Scrive un JSON in tests/out/<nome> (es. perf.json). */
    writeOut(name, data) { const f = path.join(OUT, name); fs.writeFileSync(f, JSON.stringify(data, null, 1)); return f; },
    _pages: [], log: (...a) => console.log('   ', ...a),
  };
  return ctx;
}
for (const suite of suites) {
  const s0 = Date.now(); const before = results.length;
  if (ONLY && !wanted(suite) && !e2eAvail.includes(suite)) continue; // con --only le suite non e2e si saltano se il nome non corrisponde
  console.log(`\n▶ ${suite}`);
  try {
    if (suite === 'static' || suite === 'types') {
      const r = await runNode([path.join(ROOT, `tools/check_${suite}.mjs`)]);
      process.stdout.write(r.out.split('\n').filter(Boolean).map((l) => '    ' + l).join('\n') + '\n');
      record(suite, `check_${suite}`, r.code === 0, Date.now() - s0, r.code ? 'vedi sopra' : null);
    } else if (suite === 'sim') {
      // glob relativo (cwd = ROOT): su Windows `node --test <cartella>` cerca un modulo con quel nome e fallisce
      const r = await runNode(['--test', '--test-reporter=spec', 'packages/sim/test/*.test.ts']);
      process.stdout.write(r.out.split('\n').filter(Boolean).slice(-25).map((l) => '    ' + l).join('\n') + '\n');
      record(suite, 'node --test packages/sim/test', r.code === 0, Date.now() - s0, r.code ? 'vedi sopra' : null);
    } else if (suite === 'contact') {
      const r = contact();
      record('contact', `contact.png (${r.n} shot)`, r.ok || r.n === 0, Date.now() - s0, r.ok ? null : r.msg, r.n === 0);
    } else if (e2eAvail.includes(suite)) {
      await ensureWeb();
      const mod = await import(pathToFileURL(path.join(ROOT, 'tests/e2e', suite + '.mjs')).href);
      const ctx = makeCtx(suite); const timeout = TIMEOUT_OVERRIDE || mod.timeout || 180000; const n0 = results.length; let timer;
      // gli screenshot di questa suite si rifanno da zero (prefisso <suite>_): quelli delle altre suite non si toccano
      if (!ONLY) for (const f of fs.readdirSync(path.join(OUT, 'shots'))) if (f.startsWith(suite + '_')) fs.rmSync(path.join(OUT, 'shots', f), { force: true });
      try {
        await Promise.race([mod.default(ctx), new Promise((_, rej) => (timer = setTimeout(() => rej(new Error(`timeout suite ${timeout} ms (usa --timeout <ms> o export const timeout)`)), timeout)))]);
        if (results.length === n0 && !ONLY) record(suite, 'suite', true, Date.now() - s0);
      } catch (e) { record(suite, 'suite', false, Date.now() - s0, e); }
      finally {
        clearTimeout(timer);
        for (const p of ctx._pages) await p.close().catch(() => {});
        for (const w of wranglers.splice(0)) await w.close().catch(() => {});
      }
    } else record(suite, 'suite sconosciuta', false, 0, `'${suite}' (disponibili: static types sim ${e2eAvail.join(' ')} contact all)`);
  } catch (e) { record(suite, 'runner', false, Date.now() - s0, e); }
  const mine = results.slice(before);
  suiteInfo[suite] = { ms: Date.now() - s0, tests: mine.length, failed: mine.filter((r) => !r.ok).length };
}
if (browser) await browser.close().catch(() => {});
if (server) await server.close();
if (distDir && distDir.includes('dist-') && !opts.has('--keep')) fs.rmSync(distDir, { recursive: true, force: true });
const failed = results.filter((r) => !r.ok);
const total = Date.now() - t0;
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ when: new Date().toISOString(), suites, only: ONLY, viewport: VIEWPORT_NAME, ms: total, passed: results.length - failed.length, failed: failed.length, suiteInfo, results }, null, 1));
const slow = Object.entries(suiteInfo).map(([k, v]) => `${k} ${(v.ms / 1000).toFixed(1)}s`).join(' · ');
console.log(`\n${failed.length ? C.r('FAILED') : C.g('ALL GREEN')}: ${results.length - failed.length}/${results.length} in ${(total / 1000).toFixed(1)} s (${slow}) → tests/out/report.json`);
if (failed.length) console.log(C.r('Falliti: ') + failed.map((r) => `${r.suite} › ${r.name}`).join(' | '));
process.exit(failed.length ? 1 : 0);
