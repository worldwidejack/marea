// Decorazioni libere (#108) sul server locale (wrangler dev, TEST_CLOCK:1). Luca vince Perle con le Regate (API, autopilot) e compra due
// decorazioni (API, come il Mercante); poi nel browser, sulla sua isola: (1) A vicino a una decorazione apre la scheda SPOSTA / RUOTA /
// RIVENDI; (2) SPOSTA: sagoma rossa sull'altra decorazione e sul libro degli ospiti (CONFERMA spenta), verde su erba libera, A conferma,
// il server la sposta; (3) RUOTA gira di 90° (salvato); (4) RIVENDI con conferma: metà delle Perle per difetto, la decorazione sparisce;
// (5) API: niente sposta su cella occupata, niente id sconosciuti, isole degli altri senza scheda; (6) telefono 390×844: tocco sulla
// decorazione, scheda e sagoma verde/rossa dentro lo schermo con bottoni ≥ 44 px, ANNULLA rimette com'era.
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
export const timeout = 420000;

const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const same = (a, b) => a[0] === b[0] && a[1] === b[1];

export default async function (ctx) {
  const { assert } = ctx;
  const SERVER = path.join(ctx.ROOT, 'apps/server');
  const persist = path.join(ctx.OUT, `m3decor-${process.pid}`);
  const env = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' };
  const wr = (...a) => execFileSync('npx', ['--no-install', 'wrangler', ...a], { cwd: SERVER, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 }).toString();
  const sim = async (f) => import(pathToFileURL(path.join(ctx.ROOT, 'packages/sim/src', f)).href);
  const { regata } = await sim('minigames/regata/regata.ts');
  const { packInputs, quantize } = await sim('replay.ts');
  const { createRng } = await sim('rng.ts');
  const read = (f) => JSON.parse(fs.readFileSync(path.join(ctx.ROOT, 'packages/content/src', f), 'utf8'));
  const decor = read('decor.json'), balance = read('balance.json'), rientro = read('rientro.json');
  const prezzo = (id) => decor.find((d) => d.id === id).perle;
  const rimborso = (id) => Math.floor(prezzo(id) * balance.decor.rimborso);
  // celle del template `lotto` (erba lontana dal libro degli ospiti e dagli slot): A = la lanterna, B = il barile, C = dove si sposta A
  const A = [11, 16], B = [13, 16], C = [11, 14], LIBRO = rientro.libro.lotto;

  let dev = null, log = '';
  const pages = [];
  try {
    fs.rmSync(persist, { recursive: true, force: true });
    wr('d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', persist);
    wr('d1', 'execute', 'DB', '--local', '--persist-to', persist, '--command', "INSERT INTO persone (id, nome, token, slot) VALUES ('luca', 'Luca', 'tokL', 0), ('ada', 'Ada', 'tokA', 1);");
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
    const playSolo = async (tok) => {
      const s = await post('/api/solo/start', { minigame: 'regata' }, tok);
      const x = regata.create({ seed: s.body.seed, difficulty: s.body.difficulty }), rng = createRng(s.body.seed), frames = [];
      while (!x.done) { const f = quantize(regata.autopilot(x, rng)); frames.push(f); regata.step(x, f); }
      return post('/api/solo/play', { inputs: packInputs(frames) }, tok);
    };
    const serve = prezzo('lanterna') + prezzo('barile') + 2;

    await ctx.test('API: Perle dalle Regate, due decorazioni comprate; sposta/ruota/rivendi rifiutano richieste rotte', async () => {
      for (let i = 0; i < 6 && (await get('/api/lot')).body.resources.perle < serve; i++) assert((await playSolo('tokL')).status === 200, 'regata');
      for (let i = 0; i < 6 && (await get('/api/lot', 'tokA')).body.resources.perle < prezzo('barile'); i++) assert((await playSolo('tokA')).status === 200, 'regata di Ada');
      assert((await post('/api/lot/decor', { decor: 'lanterna', cell: A, rot: 0 })).status === 200, 'compra lanterna');
      assert((await post('/api/lot/decor', { decor: 'barile', cell: B, rot: 0 })).status === 200, 'compra barile');
      assert((await post('/api/lot/decor', { decor: 'barile', cell: A, rot: 0 }, 'tokA')).status === 200, 'compra il barile di Ada');
      const lot = (await get('/api/lot')).body;
      assert(lot.decor.length === 2 && lot.decor.every((d) => !d.rot), 'decorazioni: ' + JSON.stringify(lot.decor));
      const [la, ba] = lot.decor;
      const occ = await post('/api/lot/decor/move', { id: la.id, cell: B });
      assert(occ.status === 409 && occ.body.code === 'cella', 'sposta su cella occupata: ' + occ.status + ' ' + JSON.stringify(occ.body));
      const libro = await post('/api/lot/decor/move', { id: la.id, cell: LIBRO });
      assert(libro.status === 400, 'sposta sul libro degli ospiti: ' + libro.status);
      assert((await post('/api/lot/decor/move', { id: la.id, cell: 'x' })).status === 400, 'cella rotta');
      assert((await post('/api/lot/decor/rotate', { id: 'nessuna-1' })).status === 404, 'id sconosciuto');
      assert((await post('/api/lot/decor/sell', {})).status === 400, 'id mancante');
      // la decorazione di Ada non si tocca da Luca: il suo id nel lotto di Luca non c'è
      const ada = (await get('/api/lot', 'tokA')).body.decor[0];
      if (!lot.decor.some((d) => d.id === ada.id)) assert((await post('/api/lot/decor/sell', { id: ada.id })).status === 404, 'decorazione altrui');
      const dopo = (await get('/api/lot')).body;
      assert(JSON.stringify(dopo.decor) === JSON.stringify(lot.decor), 'le richieste rifiutate non toccano niente');
      ctx.log(`Perle ${dopo.resources.perle} · decor ${la.id} ${ba.id}`);
    });

    const open = async (viewport) => {
      const pg = await ctx.B.openPage(ctx.browser, `${BASE}/?t=tokL&test=1`, { viewport });
      pages.push(pg); ctx._pages.push(pg);
      await ctx.waitReady(pg.page, 30000);
      await ctx.waitState(pg.page, (s) => s.lot && s.lot.ready && s.lot.decor.length === 2 && s.lot.decor.every((d) => d.model && d.at), 30000);
      const hook = (n, ...a) => pg.page.evaluate(([n, a]) => window.__game.test[n](...a), [n, a]);
      return { pg, page: pg.page, hook, st: async () => (await ctx.getState(pg.page)).lot };
    };
    /** La camera insegue l'avatar: aspetta che il bersaglio a schermo sia fermo tra due frame disegnati (vale anche a 2-4 fps), non un tempo fisso. */
    const fermo = async (V, target) => {
      const dove = () => (Array.isArray(target) ? V.hook('lotScreen', target) : V.hook('lotDecorScreen', target));
      let p = await dove();
      for (let i = 0, t0 = Date.now(); Date.now() - t0 < 15000; i++) {
        await V.page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
        const q = await dove();
        const stabile = p && q && Math.hypot(p.x - q.x, p.y - q.y) < 0.5;
        p = q;
        if (stabile) break;
      }
      return p;
    };
    /** Tocco vero sul canvas (mouse o dito) nel punto a schermo di una cella o di una decorazione. */
    const tocca = async (V, target, phone) => {
      const p = await fermo(V, target);
      assert(p && p.on, 'bersaglio fuori schermo: ' + JSON.stringify(p));
      if (phone) await V.page.touchscreen.tap(p.x, p.y); else await V.page.mouse.click(p.x, p.y);
    };
    const bigEnough = (page) => page.evaluate(() => [...document.querySelectorAll('#mzSheet button')].filter((b) => b.offsetParent).map((b) => { const r = b.getBoundingClientRect(); return { t: b.textContent.slice(0, 24), w: Math.round(r.width), h: Math.round(r.height) }; }).filter((r) => r.w < 44 || r.h < 44));

    // ---- PC ----
    let lanterna, barile;
    await ctx.test('PC: A vicino alla lanterna apre la scheda SPOSTA / RUOTA / RIVENDI', async () => {
      const V = await open(ctx.B.DESKTOP);
      globalThis.__pc = V;
      [lanterna, barile] = (await V.st()).decor;
      assert(same(lanterna.cell, A) && same(barile.cell, B), 'celle: ' + JSON.stringify((await V.st()).decor));
      await V.hook('setZoom', 0.9);
      await V.hook('teleport', lanterna.at.x + 1.1, lanterna.at.z + 0.4);
      await ctx.waitState(V.page, (s, id) => s.lot.nearDecor === id, 8000, lanterna.id);
      await fermo(V, lanterna.id);
      await V.page.waitForFunction(() => [...document.querySelectorAll('.mz-lbl.decor')].some((e) => e.getBoundingClientRect().x > -1000), null, { timeout: 5000 });
      await ctx.shot(V.page, 'desktop_vicino');
      await V.page.keyboard.press('KeyE');
      await ctx.waitState(V.page, (s, id) => s.lot.panel && s.lot.panel.kind === 'decor' && s.lot.panel.id === id, 5000, lanterna.id);
      const txt = await V.page.locator('#mzSheet').innerText();
      assert(/Lanterna/i.test(txt) && /SPOSTA/.test(txt) && /RUOTA/.test(txt) && /RIVENDI/.test(txt) && txt.includes(`+${rimborso('lanterna')}`), 'scheda: ' + txt);
      await ctx.shot(V.page, 'desktop_scheda');
    });

    await ctx.test('PC: SPOSTA, sagoma rossa su un’altra decorazione e sul libro, verde sull’erba libera; A conferma e il server la sposta', async () => {
      const V = globalThis.__pc;
      await V.page.locator('#mzSheet [data-act="sposta"]').click();
      await ctx.waitState(V.page, (s) => s.lot.panel && s.lot.panel.kind === 'sposta' && s.lot.sagoma && s.lot.sagoma.visible, 5000);
      await tocca(V, B, false);
      await ctx.waitState(V.page, (s, c) => s.lot.sagoma && s.lot.sagoma.cell[0] === c[0] && s.lot.sagoma.cell[1] === c[1], 5000, B);
      let s = await V.st();
      assert(s.sagoma.color === '#FF5C3D' && s.sagoma.problema, 'sagoma su una decorazione: ' + JSON.stringify(s.sagoma));
      assert(await V.page.locator('#mzSheet [data-act="conferma"]').isDisabled(), 'CONFERMA accesa su cella occupata');
      await ctx.shot(V.page, 'desktop_sposta_rossa');
      const o = (await V.st()).origin, mondo = (c) => ({ x: (o[0] + c[0] + 0.5) * 2, z: (o[1] + c[1] + 0.5) * 2 });
      const lw = mondo(LIBRO);
      await V.hook('teleport', lw.x + 3, lw.z + 1);
      await tocca(V, LIBRO, false);
      await ctx.waitState(V.page, (s, c) => s.lot.sagoma && s.lot.sagoma.cell[0] === c[0] && s.lot.sagoma.cell[1] === c[1], 5000, LIBRO);
      s = await V.st();
      assert(s.sagoma.color === '#FF5C3D' && /isola/.test(s.sagoma.problema ?? ''), 'sagoma sul libro: ' + JSON.stringify(s.sagoma));
      await V.hook('teleport', lanterna.at.x + 1.1, lanterna.at.z - 2);
      await tocca(V, C, false);
      await ctx.waitState(V.page, (s, c) => s.lot.sagoma && s.lot.sagoma.cell[0] === c[0] && s.lot.sagoma.cell[1] === c[1], 5000, C);
      s = await V.st();
      assert(s.sagoma.color === '#B6FF3D' && !s.sagoma.problema, 'sagoma su erba libera: ' + JSON.stringify(s.sagoma));
      const at = s.decor.find((d) => d.id === lanterna.id).at;
      assert(Math.hypot(at.x - (s.origin[0] + C[0] + 0.5) * 2, at.z - (s.origin[1] + C[1] + 0.5) * 2) < 0.01, 'la lanterna non segue la sagoma: ' + JSON.stringify(at));
      assert(!(await V.page.locator('#mzSheet [data-act="conferma"]').isDisabled()), 'CONFERMA spenta su cella buona');
      await ctx.shot(V.page, 'desktop_sposta_verde');
      await V.page.keyboard.press('KeyE');
      await ctx.waitState(V.page, (s, a) => s.lot.panel === null && s.lot.decor.some((d) => d.id === a.id && d.cell[0] === a.c[0] && d.cell[1] === a.c[1]), 8000, { id: lanterna.id, c: C });
      const srv = (await get('/api/lot')).body.decor.find((d) => d.id === lanterna.id);
      assert(same(srv.cell, C), 'sul server: ' + JSON.stringify(srv));
    });

    await ctx.test('PC: RUOTA gira di 90° a ogni tocco (salvato sul server)', async () => {
      const V = globalThis.__pc;
      assert(await V.hook('lotTap', lanterna.id), 'scheda non aperta');
      await ctx.waitState(V.page, (s) => s.lot.panel && s.lot.panel.kind === 'decor', 5000);
      await V.page.locator('#mzSheet [data-act="ruota"]').click();
      await ctx.waitState(V.page, (s, id) => s.lot.decor.find((d) => d.id === id)?.rot === 1 && !s.lot.busy, 8000, lanterna.id);
      await V.page.locator('#mzSheet [data-act="ruota"]').click();
      await ctx.waitState(V.page, (s, id) => s.lot.decor.find((d) => d.id === id)?.rot === 2 && !s.lot.busy, 8000, lanterna.id);
      assert((await get('/api/lot')).body.decor.find((d) => d.id === lanterna.id).rot === 2, 'rotazione non salvata');
      assert((await V.st()).panel?.kind === 'decor', 'dopo RUOTA la scheda resta aperta');
    });

    await ctx.test('PC: RIVENDI chiede conferma, poi rimborsa metà delle Perle per difetto e toglie la decorazione', async () => {
      const V = globalThis.__pc;
      const p0 = (await get('/api/lot')).body.resources.perle;
      await V.page.locator('#mzSheet [data-act="rivendi"]').click();
      await ctx.waitState(V.page, (s) => s.lot.panel && s.lot.panel.vendi === true, 5000);
      await ctx.shot(V.page, 'desktop_rivendi_conferma');
      await V.page.locator('#mzSheet [data-act="vendi"]').click();
      await ctx.waitState(V.page, (s, id) => s.lot.panel === null && !s.lot.decor.some((d) => d.id === id), 8000, lanterna.id);
      const lot = (await get('/api/lot')).body;
      assert(lot.resources.perle === p0 + rimborso('lanterna'), `Perle ${lot.resources.perle} ≠ ${p0} + ${rimborso('lanterna')}`);
      assert(lot.decor.length === 1 && lot.decor[0].id === barile.id, 'decor dopo la vendita: ' + JSON.stringify(lot.decor));
      await ctx.waitState(V.page, (s, w) => s.lot.resources.perle === w, 8000, lot.resources.perle);
      ctx.noErrors(V.pg, 'PC');
    });

    // ---- telefono ----
    await ctx.test('telefono 390×844: tocco sulla decorazione, scheda e sagoma rossa/verde nello schermo; ANNULLA rimette com’era', async () => {
      const lot = (await get('/api/lot')).body;
      // ricompra una lanterna così in telefono ci sono due decorazioni (per la sagoma rossa)
      assert((await post('/api/lot/decor', { decor: 'lanterna', cell: A, rot: 0 })).status === 200, 'ricompra lanterna');
      const ids = (await get('/api/lot')).body.decor.map((d) => d.id);
      assert(new Set(ids).size === ids.length && ids.length === 2, 'id ripetuti dopo la vendita: ' + ids);
      ctx.log(`Perle ${lot.resources.perle} · decor ${ids}`);
      const V = await open(ctx.B.IPHONE);
      const b = (await V.st()).decor.find((d) => d.decor === 'barile');
      await V.hook('teleport', b.at.x + 1.1, b.at.z + 0.4); await V.hook('setZoom', 0.9);
      await ctx.waitState(V.page, (s, id) => s.lot.nearDecor === id, 8000, b.id);
      await tocca(V, b.id, true);
      await ctx.waitState(V.page, (s, id) => s.lot.panel && s.lot.panel.kind === 'decor' && s.lot.panel.id === id, 5000, b.id);
      await V.page.waitForTimeout(250);
      const box = await V.page.locator('#mzSheet').boundingBox();
      assert(box && box.x >= 0 && box.x + box.width <= 390 && box.y + box.height <= 844, 'scheda fuori schermo: ' + JSON.stringify(box));
      const small = await bigEnough(V.page); assert(!small.length, 'bottoni < 44 px: ' + JSON.stringify(small));
      await ctx.shot(V.page, 'iphone_scheda');
      await V.page.locator('#mzSheet [data-act="sposta"]').tap();
      await ctx.waitState(V.page, (s) => s.lot.sagoma && s.lot.sagoma.visible, 5000);
      // in SPOSTA si può camminare: ci si mette tra le due decorazioni, così le celle da toccare stanno al centro dello schermo
      const o = (await V.st()).origin;
      await V.hook('teleport', (o[0] + 12.5) * 2, (o[1] + 16.5) * 2 + 1);
      await tocca(V, A, true);
      await ctx.waitState(V.page, (s, c) => s.lot.sagoma && s.lot.sagoma.cell[0] === c[0] && s.lot.sagoma.cell[1] === c[1], 5000, A);
      assert((await V.st()).sagoma.color === '#FF5C3D', 'sagoma non rossa sulla lanterna');
      await V.page.waitForTimeout(250);
      await ctx.shot(V.page, 'iphone_sposta_rossa');
      const D = [12, 15];
      await tocca(V, D, true);
      await ctx.waitState(V.page, (s, c) => s.lot.sagoma && s.lot.sagoma.cell[0] === c[0] && s.lot.sagoma.cell[1] === c[1], 5000, D);
      assert((await V.st()).sagoma.color === '#B6FF3D', 'sagoma non verde su erba libera');
      const sb = await V.page.locator('#mzSheet').boundingBox();
      assert(sb && sb.y + sb.height <= 844 && sb.y > 844 * 0.45, 'pannello SPOSTA copre l’isola: ' + JSON.stringify(sb));
      assert(!(await bigEnough(V.page)).length, 'bottoni < 44 px in SPOSTA');
      await V.page.waitForTimeout(250);
      await ctx.shot(V.page, 'iphone_sposta_verde');
      await V.page.locator('#mzSheet [data-act="annulla"]').tap();
      await ctx.waitState(V.page, (s, id) => s.lot.panel && s.lot.panel.kind === 'decor' && !s.lot.sagoma, 5000, b.id);
      const s = await V.st(), back = s.decor.find((d) => d.id === b.id);
      assert(same(back.cell, B) && Math.hypot(back.at.x - b.at.x, back.at.z - b.at.z) < 0.01, 'ANNULLA non rimette com’era: ' + JSON.stringify(back));
      assert(same((await get('/api/lot')).body.decor.find((d) => d.id === b.id).cell, B), 'ANNULLA ha chiamato il server');
      await V.page.locator('#mzSheet [data-act="chiudi"]').tap();
      await ctx.waitState(V.page, (s) => s.lot.panel === null, 3000);
      ctx.noErrors(V.pg, 'telefono');
    });

    await ctx.test('isola di un amico: le sue decorazioni si vedono ma non si aprono', async () => {
      const V = await open(ctx.B.DESKTOP);
      await ctx.waitState(V.page, (s) => !!s['lot:ada'] && s['lot:ada'].ready && s['lot:ada'].decor.length === 1, 15000);
      const id = (await ctx.getState(V.page))['lot:ada'].decor[0].id;
      assert((await V.hook('lotTap@ada', id)) === false, 'scheda aperta su un’isola altrui');
      assert((await V.st()).panel === null, 'pannello aperto');
    });
  } finally {
    for (const p of pages) await p.close().catch(() => {});
    if (dev) { try { process.kill(-dev.pid, 'SIGTERM'); } catch { /* già finito */ } await sleep(500); try { process.kill(-dev.pid, 'SIGKILL'); } catch { /* ok */ } }
    fs.rmSync(persist, { recursive: true, force: true });
    delete globalThis.__pc;
  }
}
