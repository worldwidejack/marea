// Le decorazioni del Mercante in casa, sul server locale (wrangler dev, TEST_CLOCK:1). API: Luca compra la lanterna e la palma (come il
// Mercante): vanno nel magazzino di casa («decor:<id>»), le monete scendono del prezzo; decorazione sconosciuta 400, senza monete 409 con
// quante mancano; in giardino o fuori dalla stanza non si posano. Browser PC, in casa: ARREDA le mostra nel magazzino, POSA mette la
// lanterna davanti a te (sagoma verde, QUI), si vede col suo modello; davanti A apre la scheda: GIRA e METTI VIA. Telefono 390×844: POSA la
// palma con GIRA, il pannello sta nello schermo. Screenshot della stanza con le decorazioni da PC e da telefono.
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
export const timeout = 420000;

const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function (ctx) {
  const { assert } = ctx;
  const SERVER = path.join(ctx.ROOT, 'apps/server');
  const persist = path.join(ctx.OUT, `m3decor-${process.pid}`);
  const env = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' };
  const wr = (...a) => execFileSync('npx', ['--no-install', 'wrangler', ...a], { cwd: SERVER, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 }).toString();
  const read = (f) => JSON.parse(fs.readFileSync(path.join(ctx.ROOT, 'packages/content/src', f), 'utf8'));
  const decor = read('decor.json'), borgo = read('borgo.json'), arch = read('archipelago.json');
  const prezzo = (id) => decor.find((d) => d.id === id).monete;
  const LANTERNA = 'decor:lanterna', PALMA = 'decor:palma';
  const [X0, Z0, X1, Z1] = borgo.stanza.pavimento, ORIG = arch.islands.find((i) => i.role === 'lotto' && i.slot === 0).at;
  const mondo = (cx, cz) => ({ x: (ORIG[0] + cx) * 2, z: (ORIG[1] + cz) * 2 }); // celle (anche frazionarie) del lotto 0 → m

  let dev = null, log = '';
  const pages = [];
  try {
    fs.rmSync(persist, { recursive: true, force: true });
    wr('d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', persist);
    wr('d1', 'execute', 'DB', '--local', '--persist-to', persist, '--command', "INSERT INTO persone (id, nome, token, slot) VALUES ('luca', 'Luca', 'tokL', 0);");
    const port = await freePort(), inspector = await freePort();
    dev = spawn('npx', ['--no-install', 'wrangler', 'dev', '--local', '--ip', '127.0.0.1', '--port', String(port), '--inspector-port', String(inspector),
      '--assets', ctx.distDir, '--persist-to', persist, '--var', 'TEST_CLOCK:1', '--show-interactive-dev-session=false'], { cwd: SERVER, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    dev.stdout.on('data', (d) => (log += d)); dev.stderr.on('data', (d) => (log += d));
    const BASE = `http://127.0.0.1:${port}`;
    let up = false;
    for (let i = 0; i < 120 && !up; i++) { try { up = (await fetch(BASE + '/api/ping')).ok; } catch { /* non ancora */ } if (!up) await sleep(500); }
    if (!up) throw new Error('wrangler dev non risponde:\n' + log.split('\n').slice(-20).join('\n'));
    const hdr = (tok) => ({ 'x-token': tok, 'content-type': 'application/json' });
    const get = async (p, tok = 'tokL') => { const r = await fetch(BASE + p, { headers: hdr(tok) }); return { status: r.status, body: await r.json() }; };
    const post = async (p, b, tok = 'tokL') => { const r = await fetch(BASE + p, { method: 'POST', headers: hdr(tok), body: JSON.stringify(b ?? {}) }); return { status: r.status, body: await r.json() }; };

    await ctx.test('API: le decorazioni comprate vanno nel magazzino di casa; sconosciute 400, senza monete 409; fuori dalla stanza non si posano', async () => {
      const m0 = (await get('/api/lot')).body.monete, serve = prezzo('lanterna') + prezzo('palma');
      const caro = decor.find((d) => d.monete > m0);
      if (caro) { const r = await post('/api/lot/decor', { decor: caro.id }); assert(r.status === 409 && r.body.manca?.monete === caro.monete - m0, 'senza monete: ' + JSON.stringify(r.body)); }
      const m1 = (await get('/api/lot')).body.monete;
      if (m1 < serve + 10) assert((await post('/api/test/monete', { n: serve + 10 - m1 })).status === 200, 'monete di prova');
      const p0 = (await get('/api/lot')).body.monete;
      assert((await post('/api/lot/decor', { decor: 'lanterna' })).status === 200, 'compra la lanterna');
      assert((await post('/api/lot/decor', { decor: 'palma' })).status === 200, 'compra la palma');
      assert((await post('/api/lot/decor', { decor: 'nave_spaziale' })).status === 400, 'decorazione sconosciuta accettata');
      const lot = (await get('/api/lot')).body;
      assert(lot.monete === p0 - serve, `monete ${lot.monete} invece di ${p0 - serve}`);
      assert(lot.casa.magazzino[LANTERNA] === 1 && lot.casa.magazzino[PALMA] === 1 && !('decor' in lot), 'magazzino: ' + JSON.stringify(lot.casa));
      assert((await post('/api/lot/casa/posa', { id: LANTERNA, cell: [X0 + 1, Z0 - 4] })).status === 400, 'posata in giardino');
      assert((await post('/api/lot/casa/posa', { id: LANTERNA, cell: [borgo.stanza.corridoio[0], Z1 - 1] })).status === 400, 'sullo sbocco del corridoio');
      assert((await post('/api/lot/casa/posa', { id: LANTERNA, cell: [X0 + 1, Z0 + 1], muro: 'n' })).status === 400, 'una decorazione appesa al muro');
      const dopo = (await get('/api/lot')).body;
      assert(JSON.stringify(dopo.casa) === JSON.stringify(lot.casa), 'le richieste rifiutate hanno cambiato la casa');
    });

    const open = async (viewport) => {
      const pg = await ctx.B.openPage(ctx.browser, `${BASE}/?t=tokL&test=1`, { viewport });
      pages.push(pg); ctx._pages.push(pg);
      await ctx.waitReady(pg.page, 30000);
      await ctx.waitState(pg.page, (s) => s.lot && s.lot.ready, 30000);
      const hook = (n, ...a) => pg.page.evaluate(([n, a]) => window.__game.test[n](...a), [n, a]);
      await hook('porta', 0);
      await ctx.waitState(pg.page, (s) => s.stanza.dentro === 0 && s.arreda.mia, 10000);
      return { pg, page: pg.page, hook, st: async () => ctx.getState(pg.page) };
    };
    /** In (cx, cz) del lotto, guardando a nord (un colpetto di freccia su: in casa la camera guarda da sud). */
    const mettiti = async (V, cx, cz) => {
      const w = mondo(cx, cz); await V.hook('teleport', w.x, w.z);
      await V.page.keyboard.down('ArrowUp'); await sleep(90); await V.page.keyboard.up('ArrowUp');
      await V.page.waitForTimeout(250);
    };

    await ctx.test('PC: ARREDA mostra le decorazioni nel magazzino; POSA la lanterna davanti a te, si vede; A apre la scheda: GIRA e METTI VIA', async () => {
      const V = await open(ctx.B.DESKTOP);
      await V.page.locator('#mzArredaBtn').click();
      const txt = await V.page.locator('#mzArreda').innerText();
      assert(/Lanterna/i.test(txt) && /Palma/i.test(txt), 'magazzino: ' + txt);
      await ctx.shot(V.page, 'pc_magazzino');
      await V.page.locator(`#mzArreda [data-mobile="${LANTERNA}"]`).click();
      await ctx.waitState(V.page, (q) => q.arreda.modo === 'posa', 3000);
      await mettiti(V, X0 + 2.5, Z0 + 3.5);
      let s = await V.st();
      assert(s.arreda.target && s.arreda.ok, 'sagoma: ' + JSON.stringify(s.arreda));
      await V.page.locator('#mzArredaBar button', { hasText: 'QUI' }).click();
      await ctx.waitState(V.page, (q, k) => q.arreda.arredi.some((a) => a.mobile === k) && q.arreda.modo === null, 8000, LANTERNA);
      await ctx.waitState(V.page, (q) => q.stanza.arrediVisibili.includes('terra'), 8000);
      const id = (await V.st()).arreda.arredi.find((a) => a.mobile === LANTERNA).id;
      await mettiti(V, X0 + 2.5, Z0 + 3.5);
      await ctx.waitState(V.page, (q, id) => q.arreda.vicino === id, 5000, id);
      await V.page.keyboard.press('KeyE');
      await V.page.locator('#mzArreda button', { hasText: 'Gira' }).click();
      await ctx.waitState(V.page, (q, id) => q.arreda.arredi.find((a) => a.id === id)?.rot === 1, 8000, id);
      await V.page.locator('#mzArreda .mz-x').click();
      await ctx.waitState(V.page, (q) => !q.arreda.aperto, 3000);
      await mettiti(V, X0 + 3.5, Z1 - 1.5);
      await V.page.waitForTimeout(800);
      await ctx.shot(V.page, 'pc_stanza');
      await mettiti(V, X0 + 2.5, Z0 + 3.5);
      await ctx.waitState(V.page, (q, id) => q.arreda.vicino === id, 5000, id);
      await V.page.keyboard.press('KeyE');
      await V.page.locator('#mzArreda button', { hasText: 'Metti via' }).click();
      await ctx.waitState(V.page, (q, k) => !q.arreda.arredi.some((a) => a.mobile === k) && q.arreda.magazzino[k] === 1, 8000, LANTERNA);
      // la rimette, per la foto del telefono
      await V.page.locator('#mzArredaBtn').click();
      await V.page.locator(`#mzArreda [data-mobile="${LANTERNA}"]`).click();
      await mettiti(V, X0 + 2.5, Z0 + 3.5);
      await V.page.keyboard.press('KeyE');
      await ctx.waitState(V.page, (q, k) => q.arreda.arredi.some((a) => a.mobile === k), 8000, LANTERNA);
      ctx.noErrors(V.pg, 'pc');
    });

    await ctx.test('telefono 390×844: POSA la palma (GIRA), il pannello sta nello schermo con bottoni ≥ 44 px; la stanza con le decorazioni', async () => {
      const V = await open(ctx.B.IPHONE);
      await V.page.locator('#mzArredaBtn').tap();
      await ctx.waitState(V.page, (q) => q.arreda.aperto, 3000);
      const piccoli = await V.page.evaluate(() => { const scorre = (b) => { for (let e = b.parentElement; e; e = e.parentElement) { if (/(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight) return true; } return false; }; return [...document.querySelectorAll('#mzArreda button, #mzArredaBtn')].filter((b) => b.offsetParent).map((b) => { const r = b.getBoundingClientRect(); return { t: b.textContent.slice(0, 24), w: Math.round(r.width), h: Math.round(r.height), fuori: r.left < 0 || r.right > innerWidth || (r.bottom > innerHeight && !scorre(b)) }; }).filter((r) => r.w < 44 || r.h < 44 || r.fuori); });
      assert(!piccoli.length, 'bottoni piccoli o fuori: ' + JSON.stringify(piccoli));
      await ctx.shot(V.page, 'telefono_magazzino');
      await V.page.locator(`#mzArreda [data-mobile="${PALMA}"]`).tap();
      await ctx.waitState(V.page, (q) => q.arreda.modo === 'posa', 3000);
      await mettiti(V, X1 - 2.5, Z0 + 2.5);
      await V.page.locator('#mzArredaBar button', { hasText: 'GIRA' }).tap();
      await V.page.waitForTimeout(400);
      await ctx.shot(V.page, 'telefono_posa');
      await V.page.locator('#mzArredaBar button', { hasText: 'QUI' }).tap();
      await ctx.waitState(V.page, (q, k) => q.arreda.arredi.some((a) => a.mobile === k && a.rot === 1), 8000, PALMA);
      await mettiti(V, X0 + 3.5, Z1 - 1.5);
      await V.page.waitForTimeout(800);
      await ctx.shot(V.page, 'telefono_stanza');
      ctx.noErrors(V.pg, 'telefono');
    });
  } finally {
    for (const p of pages) await p.close().catch(() => {});
    if (dev) { try { process.kill(-dev.pid, 'SIGTERM'); } catch { /* già finito */ } await sleep(500); try { process.kill(-dev.pid, 'SIGKILL'); } catch { /* ok */ } }
    fs.rmSync(persist, { recursive: true, force: true });
  }
}
