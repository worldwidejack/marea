#!/usr/bin/env node
// Deploy: build (con budget) → migrazioni D1 remote → wrangler deploy → attende /version.json con lo stesso build → /api/ping → 30 s di `wrangler tail`.
// Uso: node tools/deploy.mjs [--dry-run] [--no-build] [--no-tail] [--tail-seconds N]
//   --dry-run   niente deploy vero: build (o dist esistente con --no-build), bundle di prova con `wrangler deploy --dry-run`, elenco migrazioni, controllo login; stampa cosa farebbe.
//   --no-build  usa apps/client/dist già costruito (deve avere version.json).
// Solo l'orchestratore lancia il deploy vero (CLAUDE.md, Fine sessione).
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { build } from './build.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SERVER = path.join(ROOT, 'apps/server');
const DIST = path.join(ROOT, 'apps/client/dist');
const WRANGLER = path.join(ROOT, 'node_modules/wrangler/bin/wrangler.js');
export const URL_PUBBLICO = 'https://marea.stanza-idee.workers.dev';
const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const DRY = has('--dry-run'), NO_BUILD = has('--no-build'), NO_TAIL = has('--no-tail');
const ti = args.indexOf('--tail-seconds'); const TAIL_S = ti >= 0 ? Number(args[ti + 1]) || 30 : 30;
const say = (m) => console.log(`[deploy] ${m}`);
const die = (m, code = 1) => { console.error(`[deploy] ERRORE: ${m}`); process.exit(code); };
const wenv = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' };

function wrangler(wargs, { capture = false, timeout = 0 } = {}) {
  const r = spawnSync(process.execPath, [WRANGLER, ...wargs], { cwd: SERVER, stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit', env: wenv, encoding: 'utf8', timeout: timeout || undefined });
  return { ok: r.status === 0, out: `${r.stdout || ''}${r.stderr || ''}`, status: r.status };
}

async function pollVersion(build) {
  const t0 = Date.now(); let last = '';
  while (Date.now() - t0 < 120_000) {
    try {
      const r = await fetch(`${URL_PUBBLICO}/version.json?x=${Date.now()}`, { cache: 'no-store' });
      if (r.ok) { const j = await r.json(); last = j.build; if (j.build === build) return { ok: true, ms: Date.now() - t0 }; }
    } catch { /* riprova */ }
    await new Promise((r) => setTimeout(r, 3000));
  }
  return { ok: false, ms: Date.now() - t0, last };
}

/** `wrangler tail --format json` per N secondi (timeout duro), con un po' di traffico per far comparire eventi. Ritorna { events, errors }. */
async function tailErrors(seconds) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [WRANGLER, 'tail', '--format', 'json'], { cwd: SERVER, stdio: ['ignore', 'pipe', 'pipe'], env: wenv });
    let buf = '', events = 0; const errors = []; let stderr = '';
    // `tail --format json` stampa oggetti JSON indentati su più righe: si accumulano da «{» a «}» in colonna 0 (o su una riga sola)
    let acc = null;
    const onLine = (raw) => {
      const line = raw.replace(/\r$/, '');
      let text = null;
      if (acc === null) { if (line === '{') acc = ['{']; else if (line.startsWith('{') && line.endsWith('}')) text = line; }
      else { acc.push(line); if (line === '}') { text = acc.join('\n'); acc = null; } }
      if (text === null) return;
      let e; try { e = JSON.parse(text); } catch { return; }
      events++;
      const bad = (e.outcome && !['ok', 'canceled'].includes(e.outcome)) || (e.exceptions && e.exceptions.length) || (e.logs || []).some((l) => l.level === 'error');
      if (bad) errors.push({ outcome: e.outcome, url: e.event?.request?.url, exceptions: (e.exceptions || []).map((x) => x.message || x.name), logs: (e.logs || []).filter((l) => l.level === 'error').map((l) => l.message) });
    };
    child.stdout.on('data', (d) => { buf += d; const parts = buf.split('\n'); buf = parts.pop(); parts.forEach(onLine); });
    child.stderr.on('data', (d) => { stderr += d; });
    const finish = (note) => { clearTimeout(soft); clearTimeout(hard); clearInterval(traffic); resolve({ events, errors, note, stderr: stderr.split('\n').slice(-3).join(' ') }); };
    const hard = setTimeout(() => { child.kill('SIGKILL'); finish('timeout duro'); }, (seconds + 8) * 1000);
    const soft = setTimeout(() => { child.kill('SIGTERM'); setTimeout(() => child.kill('SIGKILL'), 3000).unref(); }, seconds * 1000);
    child.on('close', () => finish(null));
    child.on('error', (e) => finish('tail non parte: ' + e.message));
    // traffico di prova a partire da qualche secondo dopo l'avvio del tail
    let n = 0; const traffic = setInterval(() => { if (n++ < 6) fetch(`${URL_PUBBLICO}/api/ping?tail=${n}`, { cache: 'no-store' }).catch(() => {}); }, 3000);
  });
}

// --- 1. build ---
let report;
if (NO_BUILD) {
  if (!fs.existsSync(path.join(DIST, 'version.json'))) die('--no-build ma apps/client/dist/version.json non esiste: lancia prima `npm run build`.');
  const v = JSON.parse(fs.readFileSync(path.join(DIST, 'version.json'), 'utf8'));
  report = { build: v.build };
  say(`build esistente: ${v.build} (${v.when}) — non ricostruisco (--no-build)`);
} else {
  try { report = await build({ outDir: DIST }); }
  catch (e) { die(`la build non passa, non si deploya.\n${e.message}`); }
}

// --- 2. dry-run ---
if (DRY) {
  say('MODALITÀ PROVA (--dry-run): non viene toccato niente online.');
  const dryOut = path.join(ROOT, 'tests/out/wrangler-dry');
  const d = wrangler(['deploy', '--dry-run', '--outdir', dryOut], { capture: true, timeout: 120000 });
  fs.rmSync(dryOut, { recursive: true, force: true });
  if (!d.ok) die('il bundle del Worker non si costruisce (`wrangler deploy --dry-run`):\n' + d.out.split('\n').slice(-20).join('\n'));
  const bind = d.out.match(/Total Upload:[^\n]*/)?.[0];
  say(`bundle del Worker ok${bind ? ' · ' + bind : ''}`);
  const migDir = path.join(SERVER, 'migrations');
  const migs = fs.existsSync(migDir) ? fs.readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort() : [];
  say(`migrazioni D1 che verrebbero applicate (solo le nuove): ${migs.join(', ') || 'nessuna'}`);
  const who = wrangler(['whoami'], { capture: true, timeout: 20000 });
  say(who.ok && /logged in|Account/i.test(who.out) ? 'login Cloudflare ok' : 'login Cloudflare NON verificato (offline o non autenticato): il deploy vero potrebbe chiederlo (`npx wrangler login`).');
  const git = spawnSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' });
  const dirty = (git.stdout || '').split('\n').filter(Boolean).length;
  if (dirty) say(`avviso: ${dirty} file non committati (il deploy pubblica il working tree, non l'ultimo commit)`);
  say('con il deploy vero farei, in ordine:');
  say(`  1. wrangler d1 migrations apply DB --remote`);
  say(`  2. wrangler deploy`);
  say(`  3. attendere ${URL_PUBBLICO}/version.json con build ${report.build} (max 2 min)`);
  say(`  4. controllare ${URL_PUBBLICO}/api/ping`);
  say(`  5. ${NO_TAIL ? 'nessun tail (--no-tail)' : `wrangler tail --format json per ${TAIL_S} s e segnalare gli errori`}`);
  say('prova completata: tutto pronto per `npm run deploy`.');
  process.exit(0);
}

// --- 3. deploy vero ---
say('migrazioni D1 (remote)…');
if (!wrangler(['d1', 'migrations', 'apply', 'DB', '--remote']).ok) die('le migrazioni D1 sono fallite: il Worker NON è stato deployato. Guarda l\'errore sopra.');
say('wrangler deploy…');
if (!wrangler(['deploy']).ok) die('`wrangler deploy` è fallito: online c\'è ancora la versione precedente.');

// --- 4. verifica ---
say(`attendo che ${URL_PUBBLICO} serva il build ${report.build}…`);
const v = await pollVersion(report.build);
if (!v.ok) die(`online non risponde con il build ${report.build} entro 2 minuti${v.last ? ` (serve ancora ${v.last})` : ''}. Riprova a mano: ${URL_PUBBLICO}/version.json`);
say(`versione online dopo ${(v.ms / 1000).toFixed(0)} s`);
let ping;
try { ping = await (await fetch(`${URL_PUBBLICO}/api/ping`, { cache: 'no-store' })).json(); } catch (e) { die(`/api/ping non risponde (${e.message}): il Worker è online ma l'API no.`); }
if (!ping.ok) die(`/api/ping risponde ma ok=false: ${JSON.stringify(ping)}`);
say(`/api/ping ok · build ${ping.build}`);
if (ping.build && ping.build !== report.build) say(`avviso: /api/ping dice build ${ping.build}, il client ${report.build} (Worker e asset non allineati?)`);

if (NO_TAIL) say('tail saltato (--no-tail)');
else {
  say(`wrangler tail per ${TAIL_S} s (cerco errori)…`);
  const t = await tailErrors(TAIL_S);
  if (t.note) say(`avviso tail: ${t.note}${t.stderr ? ' — ' + t.stderr : ''}`);
  say(`tail: ${t.events} eventi, ${t.errors.length} con errori`);
  for (const e of t.errors.slice(0, 5)) say(`  ERRORE ${e.outcome || ''} ${e.url || ''} ${[...e.exceptions, ...e.logs].join(' | ')}`);
  if (t.errors.length) say('ATTENZIONE: il Worker ha prodotto errori dopo il deploy. Controlla `npx wrangler tail` prima di dire a Jack che è online.');
}
say(`online: ${URL_PUBBLICO} · build ${report.build}`);
