#!/usr/bin/env node
/**
 * Test runner. Uso: node tests/run.mjs [static|types|sim|<e2e>|contact|all] [--no-build] [--keep]
 * Il client viene costruito in una cartella privata (tests/out/dist-<pid>) e servito su una porta libera: agenti in parallelo non collidono.
 * e2e: tests/e2e/<nome>.mjs → `export default async function (ctx) {...}`, opzionale `export const timeout`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from '../tools/build.mjs';
import { contact } from '../tools/contact.mjs';
import { startServer } from './lib/server.mjs';
import * as B from './lib/browser.mjs';
import assert from './lib/assert.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'tests/out');
const argv = process.argv.slice(2);
const opts = new Set(argv.filter((a) => a.startsWith('--')));
let suites = argv.filter((a) => !a.startsWith('--'));
const e2eAvail = fs.readdirSync(path.join(ROOT, 'tests/e2e')).filter((f) => f.endsWith('.mjs')).map((f) => f.replace('.mjs', ''));
if (!suites.length) suites = ['static', 'sim', 'boot'];
if (suites.includes('all')) suites = ['static', 'types', 'sim', ...e2eAvail.sort((a, b) => (a === 'boot' ? -1 : b === 'boot' ? 1 : a.localeCompare(b))), 'contact'];
fs.mkdirSync(path.join(OUT, 'shots'), { recursive: true });

const results = []; const t0 = Date.now();
const C = { g: (s) => `\x1b[32m${s}\x1b[0m`, r: (s) => `\x1b[31m${s}\x1b[0m`, y: (s) => `\x1b[33m${s}\x1b[0m` };
function record(suite, name, ok, ms, err, warn = false) {
  results.push({ suite, name, ok, ms, err: err ? String(err.stack || err.message || err).split('\n').slice(0, 8).join('\n') : null, warn });
  console.log(`  ${ok ? (warn ? C.y('WARN') : C.g('PASS')) : C.r('FAIL')} ${suite} › ${name} (${ms} ms)${err && !ok ? '\n    ' + String(err.message || err).split('\n').slice(0, 6).join('\n    ') : warn && err ? ' ' + err : ''}`);
}
function runNode(args, timeout = 180000) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = ''; p.stdout.on('data', (d) => (out += d)); p.stderr.on('data', (d) => (out += d));
    const to = setTimeout(() => { p.kill('SIGKILL'); out += '\n[timeout]'; }, timeout);
    p.on('close', (code) => { clearTimeout(to); resolve({ code, out }); });
  });
}
let server = null, browser = null, distDir = null;
async function ensureWeb() {
  if (server) return;
  if (opts.has('--no-build')) distDir = path.join(ROOT, 'apps/client/dist');
  else { distDir = path.join(OUT, `dist-${process.pid}`); await build({ outDir: distDir, quiet: true, buildId: `test-${process.pid}` }); }
  server = await startServer(distDir);
  browser = await B.launch();
}
function makeCtx(suite) {
  const ctx = {
    suite, ROOT, OUT, distDir, base: server.url, browser, assert, B,
    async open(query = '', o = {}) { const p = await B.openPage(browser, server.url + '/' + query, o); ctx._pages.push(p); return p; },
    waitReady: B.waitReady, waitState: B.waitState, getState: B.getState, getPerf: B.getPerf, screenStats: B.screenStats,
    shot: (page, name) => B.shot(page, `${suite}_${name}`),
    async test(name, fn) { const s = Date.now(); try { await fn(); record(suite, name, true, Date.now() - s); } catch (e) { record(suite, name, false, Date.now() - s, e); } },
    warn(name, msg) { record(suite, name, true, 0, msg, true); },
    noErrors(p, what = '') {
      const errs = [...p.errors.map((e) => 'pageerror: ' + e), ...p.consoleErrors.map((e) => 'console: ' + e), ...p.failed.map((e) => 'request: ' + e)];
      if (errs.length) throw new assert.TestFail(`${what} errori:\n      ` + errs.slice(0, 8).join('\n      '));
    },
    _pages: [], log: (...a) => console.log('   ', ...a),
  };
  return ctx;
}
for (const suite of suites) {
  const s0 = Date.now();
  console.log(`\n▶ ${suite}`);
  try {
    if (suite === 'static' || suite === 'types') {
      const r = await runNode([path.join(ROOT, `tools/check_${suite}.mjs`)]);
      process.stdout.write(r.out.split('\n').filter(Boolean).map((l) => '    ' + l).join('\n') + '\n');
      record(suite, `check_${suite}`, r.code === 0, Date.now() - s0, r.code ? 'vedi sopra' : null);
    } else if (suite === 'sim') {
      const r = await runNode(['--test', '--test-reporter=spec', path.join(ROOT, 'packages/sim/test/')]);
      process.stdout.write(r.out.split('\n').filter(Boolean).slice(-25).map((l) => '    ' + l).join('\n') + '\n');
      record(suite, 'node --test packages/sim/test', r.code === 0, Date.now() - s0, r.code ? 'vedi sopra' : null);
    } else if (suite === 'contact') {
      const r = contact();
      record('contact', `contact.png (${r.n} shot)`, r.ok || r.n === 0, Date.now() - s0, r.ok ? null : r.msg, r.n === 0);
    } else if (e2eAvail.includes(suite)) {
      await ensureWeb();
      const mod = await import(pathToFileURL(path.join(ROOT, 'tests/e2e', suite + '.mjs')).href);
      const ctx = makeCtx(suite); const timeout = mod.timeout || 180000; const before = results.length; let timer;
      try {
        await Promise.race([mod.default(ctx), new Promise((_, rej) => (timer = setTimeout(() => rej(new Error(`timeout suite ${timeout} ms`)), timeout)))]);
        if (results.length === before) record(suite, 'suite', true, Date.now() - s0);
      } catch (e) { record(suite, 'suite', false, Date.now() - s0, e); }
      finally { clearTimeout(timer); for (const p of ctx._pages) await p.close().catch(() => {}); }
    } else record(suite, 'suite sconosciuta', false, 0, `'${suite}' (disponibili: static types sim ${e2eAvail.join(' ')} contact all)`);
  } catch (e) { record(suite, 'runner', false, Date.now() - s0, e); }
}
if (browser) await browser.close().catch(() => {});
if (server) await server.close();
if (distDir && distDir.includes('dist-') && !opts.has('--keep')) fs.rmSync(distDir, { recursive: true, force: true });
const failed = results.filter((r) => !r.ok);
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ when: new Date().toISOString(), suites, ms: Date.now() - t0, passed: results.length - failed.length, failed: failed.length, results }, null, 1));
console.log(`\n${failed.length ? C.r('FAILED') : C.g('ALL GREEN')}: ${results.length - failed.length}/${results.length} in ${((Date.now() - t0) / 1000).toFixed(1)} s → tests/out/report.json`);
process.exit(failed.length ? 1 : 0);
