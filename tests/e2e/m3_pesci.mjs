// La pesca (#457): la canna si compra al negozio dei mobili (500 monete, zaino «Strumenti», peso 0); con la canna in mano sulle rive del
// Borgo compare PESCA, si mira e si lancia vicino a un'ombra, il pesce viene, fa le finte, va sotto e coi tocchi ripetuti si tira su
// (zaino a peso 0, «visto» nel Diario). Consegnato al mobiliere diventa «catturato» (scheda nel Diario) e sale nella classifica dei
// collezionisti. Dalla barca ferma al largo escono le ombre del mare aperto. Il vecchio minigioco della Pesca non c'è più; il Diario
// si apre anche dal menù AVATAR. Telefono: il joystick di mira a destra al posto di A.
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
export const timeout = 480000;

const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function (ctx) {
  const { assert } = ctx;
  const SERVER = path.join(ctx.ROOT, 'apps/server');
  const WRANGLER_BIN = path.join(ctx.ROOT, 'node_modules/wrangler/bin/wrangler.js');
  const persist = path.join(ctx.OUT, `m3pesci-${process.pid}`);
  const env = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' };
  const wr = (...a) => execFileSync(process.execPath, [WRANGLER_BIN, ...a], { cwd: SERVER, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 }).toString();
  const { PESCI } = await import(pathToFileURL(path.join(ctx.ROOT, 'packages/content/src/pesci.ts')).href);

  let dev = null, log = '';
  const pages = [];
  try {
    fs.rmSync(persist, { recursive: true, force: true });
    wr('d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', persist);
    wr('d1', 'execute', 'DB', '--local', '--persist-to', persist, '--command', "INSERT INTO persone (id, nome, token, slot) VALUES ('luca', 'Luca', 'tokL', 0), ('ada', 'Ada', 'tokA', 1);");
    const port = await freePort(), inspector = await freePort();
    dev = spawn(process.execPath, [WRANGLER_BIN, 'dev', '--local', '--ip', '127.0.0.1', '--port', String(port), '--inspector-port', String(inspector),
      '--assets', ctx.distDir, '--persist-to', persist, '--var', 'TEST_CLOCK:1', '--show-interactive-dev-session=false'], { cwd: SERVER, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    dev.stdout.on('data', (d) => (log += d)); dev.stderr.on('data', (d) => (log += d));
    const BASE = `http://127.0.0.1:${port}`;
    let up = false;
    for (let i = 0; i < 120 && !up; i++) { try { up = (await fetch(BASE + '/api/ping')).ok; } catch { /* non ancora */ } if (!up) await sleep(500); }
    if (!up) throw new Error('wrangler dev non risponde:\n' + log.split('\n').slice(-20).join('\n'));

    const hdr = { 'x-token': 'tokL', 'content-type': 'application/json' };
    const get = async (p) => { const r = await fetch(BASE + p, { headers: hdr }); return { status: r.status, body: await r.json() }; };
    const post = async (p, b) => { const r = await fetch(BASE + p, { method: 'POST', headers: hdr, body: JSON.stringify(b ?? {}) }); return { status: r.status, body: await r.json() }; };
    await get('/api/lot');
    assert((await post('/api/test/monete', { n: 2000 })).status === 200, 'monete di prova');

    const pg = await ctx.B.openPage(ctx.browser, `${BASE}/?t=tokL&test=1`, { viewport: ctx.B.DESKTOP });
    pages.push(pg); ctx._pages.push(pg);
    const page = pg.page;
    if (process.platform === 'win32') await page.route((u) => /^\/(api|chunk|assets)/.test(u.pathname), (r) => r.continue({ headers: { ...r.request().headers(), connection: 'close' } }));
    await ctx.waitReady(page, 30000);
    await ctx.waitState(page, (s) => s.lot && s.lot.ready && s.negozio && s.pesca, 30000);
    const hook = (n, ...a) => page.evaluate(([n, a]) => window.__game.test[n](...a), [n, a]);
    const st = () => ctx.getState(page);

    await ctx.test('1. Il vecchio minigioco della Pesca non c’è più', async () => {
      assert((await post('/api/solo/start', { minigame: 'pesca' })).status === 400, 'la partita alla Pesca non parte');
      assert(!(await page.locator('#mzPesca').count()), 'niente bottone del minigioco');
      const r = await get('/api/record');
      assert(r.status === 200 && !r.body.voci.some((v) => v.minigame === 'pesca'), 'niente Pesca nel tabellone');
    });

    await ctx.test('2. La canna al negozio dei mobili: 500 monete, nello zaino a peso 0, in mano subito', async () => {
      await hook('negozio', false);
      await ctx.waitState(page, (s) => s.negozio.dentro, 5000);
      const pz = (await st()).negozio.pezzi.find((p) => p.kind === 'canna');
      assert(pz && pz.monete === 500, 'manca l’espositore della canna da 500: ' + JSON.stringify((await st()).negozio.pezzi.map((p) => p.kind)));
      const m0 = (await get('/api/lot')).body.monete;
      await hook('teleport', pz.x, pz.z);
      await ctx.waitState(page, (s) => s.negozio.near === 'canna', 5000);
      await page.keyboard.press('KeyE');
      await ctx.waitState(page, (s) => s.negozio.aperto === 'canna', 3000);
      await ctx.fulvioFinoA(page, 'compra');
      await page.locator('#mzNegozio [data-act="compra"]').click();
      await ctx.waitState(page, (s) => s.pesca.canna === true, 8000);
      const l = (await get('/api/lot')).body;
      assert(l.monete === m0 - 500 && l.hero.inv.canna === 1, `canna comprata: ${l.monete} vs ${m0 - 500}`);
      assert((await st()).insetti.attrezzo === 'canna', 'appena comprata è in mano');
      assert((await post('/api/lot/casa/canna')).status === 409, 'la seconda canna no');
      const { uscita } = (await st()).negozio;
      await hook('teleport', uscita.x, uscita.z);
      await page.keyboard.down('ArrowDown');
      try { await ctx.waitState(page, (s) => !s.negozio.dentro && s.arch.place === 'porto', 20000); } finally { await page.keyboard.up('ArrowDown'); }
      await page.waitForFunction(() => !window.__game.state().velo.attivo, null, { timeout: 5000 });
    });

    let preso = null;
    await ctx.test('3. Da riva: PESCA, mira, lancio vicino all’ombra, finte, morso, tocchi ripetuti → nello zaino e «visto»', async () => {
      const om = await hook('pescaVai');
      assert(om && om.k.startsWith('r:'), 'nessuna ombra di riva: ' + JSON.stringify((await st()).pesca.ombre));
      await hook('setZoom', 0.7);
      await ctx.waitState(page, (s) => s.pesca.puoi === 'riva' && /pesca/i.test(s.pesca.bottone ?? ''), 5000);
      await page.keyboard.press('KeyE');
      await ctx.waitState(page, (s) => s.pesca.fase === 'mira' && s.pesca.pannello, 3000);
      await ctx.shot(page, 'pc_pesca_mira');
      // si lancia accanto all'ombra: viene (quasi sempre: se non la vede si tira su e si rilancia)
      let morso = false;
      for (let i = 0; i < 4 && !morso; i++) {
        const o = (await st()).pesca.ombre.find((x) => x.k === om.k) ?? om;
        assert(await hook('pescaLancia', o.x + 0.6, o.z + 0.6), 'il punto del lancio è acqua');
        try { await ctx.waitState(page, (s) => s.pesca.fase === 'morso', 12000); morso = true; } catch { await hook('pescaA', 1); await ctx.waitState(page, (s) => s.pesca.fase === 'mira', 3000); }
      }
      assert(morso, 'il pesce non ha mai abboccato: ' + JSON.stringify((await st()).pesca));
      await ctx.shot(page, 'pc_pesca_tira');
      const s1 = await st();
      assert(s1.pesca.preda && s1.pesca.preda.k === om.k, 'abbocca l’ombra vicina');
      for (let i = 0; i < 6; i++) { await hook('pescaA', 4); await sleep(80); }
      await ctx.waitState(page, (s) => s.pesca.cartello && /hai preso/i.test(s.pesca.cartello), 8000);
      preso = s1.pesca.preda.id;
      const l = (await get('/api/lot')).body;
      assert(l.hero.inv[preso] === 1 && l.pesci.visti[preso] === 1 && l.pesci.presi.includes(om.k), 'preso dal server: ' + JSON.stringify(l.pesci));
      assert((await post('/api/lot/pesci/cattura', { k: om.k })).status === 409, 'la stessa ombra due volte no');
      await ctx.shot(page, 'pc_pesca_preso');
      await ctx.waitState(page, (s) => s.pesca.fase === 'mira', 4000);
      await page.keyboard.press('Escape');
      await ctx.waitState(page, (s) => s.pesca.fase === 'spento', 3000);
    });

    await ctx.test('4. Tirare durante le finte spaventa il pesce', async () => {
      const om = await hook('pescaVai');
      assert(om, 'un’altra ombra di riva');
      await page.keyboard.press('KeyE');
      await ctx.waitState(page, (s) => s.pesca.fase === 'mira', 3000);
      let finte = false;
      for (let i = 0; i < 4 && !finte; i++) {
        await hook('pescaLancia', om.x + 0.6, om.z + 0.6);
        try { await ctx.waitState(page, (s) => s.pesca.preda && s.pesca.preda.stato === 'finte', 12000); finte = true; } catch { await hook('pescaA', 1); await ctx.waitState(page, (s) => s.pesca.fase === 'mira', 3000); }
      }
      assert(finte, 'il pesce non è mai venuto');
      await hook('pescaA', 1);
      await ctx.waitState(page, (s, k) => s.pesca.fase === 'scappa' || (s.pesca.fase === 'mira' && !s.pesca.ombre.some((o) => o.k === k && o.stato === 'nuota')), 3000, om.k);
      await page.keyboard.press('Escape');
    });

    await ctx.test('5. Al mobiliere lo consegni (catturato, scheda nel Diario), sale tra i collezionisti; il Diario si apre dal menù AVATAR', async () => {
      const def = PESCI.find((p) => p.id === preso);
      await page.locator('#mzAvatarBtn').click();
      await page.locator('#mzAvatarMenu [data-voce="diario"]').click();
      await ctx.waitState(page, (s) => s.diario.open, 5000);
      await page.locator('#mzDiario [data-tab="pesci"]').click();
      await page.locator(`#mzDiario [data-cella="${preso}"]`).click();
      const prima = (await page.locator('#mzDiario').textContent()) ?? '';
      assert(prima.includes('non ancora registrato') && !prima.includes(def.descr), 'preso ma non registrato: nel Diario non c’è');
      await hook('diarioChiudi');
      await hook('negozio', false);
      await ctx.waitState(page, (s) => s.negozio.dentro, 5000);
      const banco = (await st()).negozio.pezzi.find((p) => p.kind === 'banco');
      await hook('teleport', banco.x, banco.z);
      await ctx.waitState(page, (s) => s.negozio.near === 'banco', 5000);
      await page.keyboard.press('KeyE');
      await ctx.fulvioFinoA(page, 'registra');
      await page.locator('#mzNegozio [data-act="registra"]').click();
      await page.locator(`#mzNegozio [data-pesce="${preso}"]`).click();
      await ctx.waitState(page, (s) => s.negozio.consegnati === 1, 8000);
      const l = (await get('/api/lot')).body;
      assert(l.pesci.posseduti.includes(preso) && !(l.hero.inv[preso] > 0), 'catturato e sparito dallo zaino');
      await page.keyboard.press('Escape');
      await hook('diarioApri', 'pesci');
      await page.locator(`#mzDiario [data-cella="${preso}"]`).click();
      assert(((await page.locator('#mzDiario').textContent()) ?? '').includes(def.descr), 'catturato: la scheda si legge');
      await ctx.shot(page, 'pc_pesca_diario');
      await hook('diarioChiudi');
      const c = await get('/api/collezione');
      assert(c.status === 200 && c.body.righe[0]?.id === 'luca' && c.body.righe[0].pesci === 1 && c.body.righe[0].nome === 'Luca', 'collezionisti: ' + JSON.stringify(c.body));
      assert(c.body.righe.some((r) => r.id === 'ada' && r.pesci === 0 && r.insetti === 0), 'chi non ha consegnato niente sta in fondo a zero');
    });

    await ctx.test('6. Dalla barca ferma al largo: PESCA, ombre del mare aperto attorno alla barca', async () => {
      const { uscita } = (await st()).negozio;
      await hook('teleport', uscita.x, uscita.z);
      await page.keyboard.down('ArrowDown');
      try { await ctx.waitState(page, (s) => !s.negozio.dentro, 20000); } finally { await page.keyboard.up('ArrowDown'); }
      await page.waitForFunction(() => !window.__game.state().velo.attivo, null, { timeout: 5000 });
      await hook('setMode', 'boat');
      const p = await hook('pescaBarcaVai');
      assert(p, 'nessun punto da pesca al largo');
      await ctx.waitState(page, (s) => s.pesca.barca.ok && /pesca/i.test(s.pesca.bottone ?? ''), 8000);
      await page.locator('#mzPescaBtn').click();
      await ctx.waitState(page, (s) => s.pesca.fase === 'mira' && s.pesca.dove === 'barca', 3000);
      const s = await st();
      assert(s.pesca.ombre.some((o) => o.k.startsWith('b:')), 'ombre della barca: ' + JSON.stringify(s.pesca.ombre));
      for (const o of s.pesca.ombre.filter((x) => x.k.startsWith('b:'))) assert(PESCI.find((d) => d.id === o.id).zona === 'barca', 'pesci del mare aperto');
      await ctx.shot(page, 'pc_pesca_barca');
      await page.keyboard.press('Escape');
      await hook('setMode', 'walk');
      ctx.noErrors(pg, 'm3_pesci');
    });

    await ctx.test('7. Telefono: il joystick di mira a destra al posto di A', async () => {
      const ph = await ctx.B.openPage(ctx.browser, `${BASE}/?t=tokL&test=1`, { viewport: ctx.B.IPHONE });
      pages.push(ph); ctx._pages.push(ph);
      const tp = ph.page;
      if (process.platform === 'win32') await tp.route((u) => /^\/(api|chunk|assets)/.test(u.pathname), (r) => r.continue({ headers: { ...r.request().headers(), connection: 'close' } }));
      await ctx.waitReady(tp, 60000);
      await ctx.waitState(tp, (s) => s.lot && s.lot.ready && s.pesca && s.pesca.canna, 60000);
      const th = (n, ...a) => tp.evaluate(([n, a]) => window.__game.test[n](...a), [n, a]);
      await th('insettiAttrezzo', 'canna');
      assert(await th('pescaVai'), 'ombra di riva');
      await ctx.waitState(tp, (s) => s.pesca.puoi === 'riva', 5000);
      await sleep(7500); // il saluto della guida
      await tp.locator('#mzPescaBtn').tap();
      await ctx.waitState(tp, (s) => s.pesca.fase === 'mira' && s.pesca.stick, 3000);
      assert(await tp.locator('#mzPescaMira').isVisible(), 'joystick di mira visibile');
      assert(!(await tp.locator('#btnA').isVisible()), 'A nascosto mentre si mira');
      const r = await tp.evaluate(() => { const b = document.getElementById('mzPescaMira').getBoundingClientRect(); return { r: b.right, b: b.bottom, w: innerWidth, h: innerHeight }; });
      assert(r.r <= r.w && r.b <= r.h && r.r > r.w * 0.7, 'a destra, dentro lo schermo: ' + JSON.stringify(r));
      await ctx.shot(tp, 'tel_pesca_mira');
      await tp.locator('#mzPescaPanel [data-act="smetti"]').tap();
      await ctx.waitState(tp, (s) => s.pesca.fase === 'spento' && !s.pesca.stick, 3000);
      assert(await tp.locator('#btnA').isVisible(), 'A torna');
      ctx.noErrors(ph, 'm3_pesci telefono');
    });
  } finally {
    for (const p of pages) await p.close().catch(() => {});
    if (dev?.pid) { try { process.kill(-dev.pid, 'SIGKILL'); } catch { try { dev.kill('SIGKILL'); } catch { /* già morto */ } } }
    await sleep(300);
    fs.rmSync(persist, { recursive: true, force: true });
  }
}
