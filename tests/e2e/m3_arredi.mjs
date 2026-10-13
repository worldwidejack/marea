// La casa arredabile (#265) sul server locale (wrangler dev, TEST_CLOCK:1). Luca vince Perle con le Regate (API, autopilot), compra i tre
// mobili, un pavimento e una carta (API, come farà il negozio dei mobili); il server rifiuta le richieste rotte. Poi nel browser, in casa:
// pavimento e carta comprati si vedono; ARREDA apre il magazzino; POSA mette il comodino davanti a te (sagoma verde, QUI), l'orologio sul
// muro in fondo; davanti al comodino A apre la scheda: GIRA (salvato), METTI VIA (torna nel magazzino). Telefono 390×844: ARREDA e il
// pannello stanno nello schermo con bottoni ≥ 44 px. Screenshot della stanza arredata da PC e da telefono.
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
export const timeout = 420000;

const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function (ctx) {
  const { assert } = ctx;
  const SERVER = path.join(ctx.ROOT, 'apps/server');
  const persist = path.join(ctx.OUT, `m3arredi-${process.pid}`);
  const env = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' };
  const wr = (...a) => execFileSync('npx', ['--no-install', 'wrangler', ...a], { cwd: SERVER, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 }).toString();
  const sim = async (f) => import(pathToFileURL(path.join(ctx.ROOT, 'packages/sim/src', f)).href);
  const { regata } = await sim('minigames/regata/regata.ts');
  const { packInputs, quantize } = await sim('replay.ts');
  const { createRng } = await sim('rng.ts');
  const read = (f) => JSON.parse(fs.readFileSync(path.join(ctx.ROOT, 'packages/content/src', f), 'utf8'));
  const mobili = read('mobili.json').mobili, borgo = read('borgo.json'), arch = read('archipelago.json');
  const [X0, Z0, X1, Z1] = borgo.stanza.pavimento, ORIG = arch.islands.find((i) => i.role === 'lotto' && i.slot === 0).at;
  const mondo = (cx, cz) => ({ x: (ORIG[0] + cx) * 2, z: (ORIG[1] + cz) * 2 }); // celle (anche frazionarie) del lotto 0 → m
  const comodino = mobili.find((m) => m.id === 'comodino_lampada'), stereo = mobili.find((m) => m.id === 'stereo'), orologio = mobili.find((m) => m.id === 'orologio');
  const pav = borgo.pavimenti[1], carta = borgo.carte[1];
  const serve = comodino.perle + stereo.perle + orologio.perle + pav.perle + carta.perle;

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
    const playSolo = async (tok) => {
      const s = await post('/api/solo/start', { minigame: 'regata' }, tok);
      const x = regata.create({ seed: s.body.seed, difficulty: s.body.difficulty }), rng = createRng(s.body.seed), frames = [];
      while (!x.done) { const f = quantize(regata.autopilot(x, rng)); frames.push(f); regata.step(x, f); }
      return post('/api/solo/play', { inputs: packInputs(frames) }, tok);
    };

    await ctx.test('API: tre mobili nel magazzino, pavimento e carta comprati e messi; le richieste rotte non toccano niente', async () => {
      for (let i = 0; i < 10 && (await get('/api/lot')).body.resources.perle < serve; i++) assert((await playSolo('tokL')).status === 200, 'regata');
      const p0 = (await get('/api/lot')).body.resources.perle;
      assert(p0 >= serve, `Perle ${p0} < ${serve}`);
      for (const m of [comodino, stereo, orologio]) assert((await post('/api/lot/casa/compra', { id: m.id })).status === 200, 'compra ' + m.id);
      assert((await post('/api/lot/casa/finitura', { tipo: 'pavimento', id: pav.id })).status === 200, 'compra il pavimento');
      assert((await post('/api/lot/casa/finitura', { tipo: 'carta', id: carta.id })).status === 200, 'compra la carta');
      const lot = (await get('/api/lot')).body;
      assert(lot.resources.perle === p0 - serve, `Perle ${lot.resources.perle} invece di ${p0 - serve}`);
      assert(JSON.stringify(lot.casa.magazzino) === JSON.stringify({ [comodino.id]: 1, [stereo.id]: 1, [orologio.id]: 1 }), 'magazzino: ' + JSON.stringify(lot.casa));
      assert(lot.casa.pavimento === pav.id && lot.casa.carta === carta.id, 'finiture: ' + JSON.stringify(lot.casa));
      assert((await post('/api/lot/casa/compra', { id: 'trono' })).status === 404, 'mobile sconosciuto');
      assert((await post('/api/lot/casa/finitura', { tipo: 'pavimento', id: pav.id })).status === 409, 'pavimento già tuo');
      assert((await post('/api/lot/casa/posa', { id: comodino.id, cell: [borgo.stanza.corridoio[0], Z1 - 1] })).status === 400, 'sullo sbocco del corridoio');
      assert((await post('/api/lot/casa/posa', { id: orologio.id, cell: [X0 + 1, Z0 + 2], muro: 'n' })).status === 400, 'orologio non sul muro');
      assert((await post('/api/lot/casa/posa', { id: comodino.id, cell: 'x' })).status === 400, 'cella rotta');
      assert((await post('/api/lot/casa/ruota', { id: 'comodino_lampada-9' })).status === 404, 'id sconosciuto');
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

    await ctx.test('PC: in casa pavimento e carta comprati; ARREDA → POSA il comodino davanti a te e l’orologio sul muro in fondo', async () => {
      const V = await open(ctx.B.DESKTOP);
      globalThis.__pc = V;
      let s = await V.st();
      assert(s.stanza.pavimento === pav.id && s.stanza.carta === carta.id, 'finiture nella stanza: ' + JSON.stringify(s.stanza));
      await V.page.locator('#mzArredaBtn').click();
      await V.page.locator(`#mzArreda [data-mobile="${comodino.id}"]`).click();
      await ctx.waitState(V.page, (q) => q.arreda.modo === 'posa', 3000);
      await mettiti(V, X0 + 1.5, Z0 + 3.5);
      s = await V.st();
      assert(s.arreda.target && s.arreda.target.cell[0] === X0 + 1 && s.arreda.target.cell[1] < Z0 + 3 && s.arreda.ok, 'sagoma: ' + JSON.stringify(s.arreda));
      await V.page.locator('#mzArredaBar button', { hasText: 'QUI' }).click();
      await ctx.waitState(V.page, (q) => q.arreda.arredi.length === 1 && q.arreda.modo === null, 8000);
      await V.page.locator('#mzArredaBtn').click();
      await V.page.locator(`#mzArreda [data-mobile="${orologio.id}"]`).click();
      await mettiti(V, X1 - 1.5, Z0 + 0.6);
      s = await V.st();
      assert(s.arreda.target && s.arreda.target.muro === 'n' && s.arreda.ok, 'sagoma sul muro: ' + JSON.stringify(s.arreda));
      await V.page.keyboard.press('KeyE');
      await ctx.waitState(V.page, (q) => q.arreda.arredi.length === 2 && q.arreda.arredi.some((a) => a.muro === 'n'), 8000);
      const casa = (await get('/api/lot')).body.casa;
      assert(casa.arredi.length === 2 && !casa.magazzino[comodino.id] && !casa.magazzino[orologio.id] && casa.magazzino[stereo.id] === 1, 'server: ' + JSON.stringify(casa));
      await mettiti(V, X0 + 3.5, Z1 - 1.5);
      await V.page.waitForTimeout(600);
      await ctx.shot(V.page, 'pc_stanza_arredata');
    });

    await ctx.test('PC: davanti al comodino A apre la scheda; GIRA (salvato) e METTI VIA (torna nel magazzino)', async () => {
      const V = globalThis.__pc;
      const id = (await V.st()).arreda.arredi.find((a) => !a.muro).id;
      await mettiti(V, X0 + 1.5, Z0 + 3.5);
      await ctx.waitState(V.page, (q, id) => q.arreda.vicino === id, 5000, id);
      await V.page.keyboard.press('KeyE');
      await V.page.locator('#mzArreda button', { hasText: 'Gira' }).click();
      await ctx.waitState(V.page, (q, id) => q.arreda.arredi.find((a) => a.id === id)?.rot === 1, 8000, id);
      await V.page.locator('#mzArreda button', { hasText: 'Metti via' }).click();
      await ctx.waitState(V.page, (q) => q.arreda.arredi.length === 1 && q.arreda.magazzino.comodino_lampada === 1, 8000);
      ctx.noErrors(V.pg, 'pc');
    });

    await ctx.test('telefono 390×844: ARREDA e il pannello dentro lo schermo, bottoni ≥ 44 px; la stanza arredata', async () => {
      const V = await open(ctx.B.IPHONE);
      await V.page.waitForTimeout(600);
      await ctx.shot(V.page, 'telefono_stanza_arredata');
      await V.page.locator('#mzArredaBtn').tap();
      await ctx.waitState(V.page, (q) => q.arreda.aperto, 3000);
      const piccoli = await V.page.evaluate(() => [...document.querySelectorAll('#mzArreda button, #mzArredaBtn')].filter((b) => b.offsetParent).map((b) => { const r = b.getBoundingClientRect(); return { t: b.textContent.slice(0, 24), w: Math.round(r.width), h: Math.round(r.height), fuori: r.left < 0 || r.right > innerWidth || r.bottom > innerHeight }; }).filter((r) => r.w < 44 || r.h < 44 || r.fuori));
      assert(!piccoli.length, 'bottoni piccoli o fuori: ' + JSON.stringify(piccoli));
      await ctx.shot(V.page, 'telefono_arreda');
      ctx.noErrors(V.pg, 'telefono');
    });
  } finally {
    for (const p of pages) await p.close().catch(() => {});
    if (dev) { try { process.kill(-dev.pid, 'SIGTERM'); } catch { /* già finito */ } await sleep(500); try { process.kill(-dev.pid, 'SIGKILL'); } catch { /* ok */ } }
    fs.rmSync(persist, { recursive: true, force: true });
    delete globalThis.__pc;
  }
}
