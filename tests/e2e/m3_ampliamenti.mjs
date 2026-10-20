// Gli ampliamenti della casa (#386) sul server locale (wrangler dev, TEST_CLOCK:1). Luca: il server rifiuta l'ampliamento senza risorse e con un
// livello sbagliato; vince monete con le Regate (API, autopilot; il resto dalla rotta di prova /api/test/monete, #414); in casa (livello 0) camminando verso ovest si ferma al muro della stanza piccola;
// dal mobiliere (banco del negozio) INGRANDISCI LA CASA chiede una conferma, poi paga e porta la casa a livello 1; tornato a casa la stanza è più
// grande: ora si passa oltre il vecchio muro e ci si ferma al nuovo. Telefono 390×844: la scheda del banco sta nello schermo, bottoni ≥ 44 px.
// Screenshot: il banco con l'ampliamento, la stanza al livello 0 e al livello 1 (PC), la scheda da telefono.
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
export const timeout = 420000;

const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const WIN = process.platform === 'win32';

export default async function (ctx) {
  const { assert } = ctx;
  const SERVER = path.join(ctx.ROOT, 'apps/server');
  const persist = path.join(ctx.OUT, `m3ampl-${process.pid}`);
  const env = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' };
  const wr = (...a) => execFileSync('npx', ['--no-install', 'wrangler', ...a], { cwd: SERVER, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000, shell: WIN }).toString();
  const sim = async (f) => import(pathToFileURL(path.join(ctx.ROOT, 'packages/sim/src', f)).href);
  const { regata } = await sim('minigames/regata/regata.ts');
  const { packInputs, quantize } = await sim('replay.ts');
  const { createRng } = await sim('rng.ts');
  const read = (f) => JSON.parse(fs.readFileSync(path.join(ctx.ROOT, 'packages/content/src', f), 'utf8'));
  const borgo = read('borgo.json'), arch = read('archipelago.json');
  const liv1 = borgo.casa.livelli[0], k1 = liv1.monete, [X0, Z0, X1, Z1] = borgo.stanza.pavimento, N = liv1.pavimento;
  const ORIG = arch.islands.find((i) => i.role === 'lotto' && i.slot === 0).at;
  const mondo = (cx, cz) => ({ x: (ORIG[0] + cx) * 2, z: (ORIG[1] + cz) * 2 });

  let dev = null, log = '';
  const pages = [];
  try {
    fs.rmSync(persist, { recursive: true, force: true });
    wr('d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', persist);
    const sql = path.join(persist, 'persone.sql');
    fs.mkdirSync(persist, { recursive: true });
    fs.writeFileSync(sql, "INSERT INTO persone (id, nome, token, slot) VALUES ('luca', 'Luca', 'tokL', 0), ('ada', 'Ada', 'tokA', 1);\n");
    wr('d1', 'execute', 'DB', '--local', '--persist-to', persist, '--file', sql);
    const port = await freePort(), inspector = await freePort();
    dev = spawn('npx', ['--no-install', 'wrangler', 'dev', '--local', '--ip', '127.0.0.1', '--port', String(port), '--inspector-port', String(inspector),
      '--assets', ctx.distDir, '--persist-to', persist, '--var', 'TEST_CLOCK:1', '--show-interactive-dev-session=false'], { cwd: SERVER, env, detached: !WIN, shell: WIN, stdio: ['ignore', 'pipe', 'pipe'] });
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
    const open = async (viewport, tok = 'tokL') => {
      const pg = await ctx.B.openPage(ctx.browser, `${BASE}/?t=${tok}&test=1`, { viewport });
      pages.push(pg); ctx._pages.push(pg);
      await ctx.waitReady(pg.page, 30000);
      await ctx.waitState(pg.page, (s) => s.lot && s.lot.ready && s.negozio && s.negozio.pezzi.length >= 3, 30000);
      const hook = (n, ...a) => pg.page.evaluate(([n, a]) => window.__game.test[n](...a), [n, a]);
      return { pg, page: pg.page, hook, st: () => ctx.getState(pg.page) };
    };
    const cammina = async (page, tasti, fatto, ms = 15000, arg = null) => { for (const k of tasti) await page.keyboard.down(k); try { await ctx.waitState(page, fatto, ms, arg); } finally { for (const k of tasti) await page.keyboard.up(k); } };
    const aCasa = async (V) => { await V.hook('porta', 0); await ctx.waitState(V.page, (s) => s.stanza.dentro === 0, 10000); await V.page.waitForTimeout(600); };

    await ctx.test('API: senza risorse il server rifiuta (con quanto manca); con un livello sbagliato o senza livello no; niente cambia', async () => {
      const lot0 = (await get('/api/lot')).body;
      const r = await post('/api/lot/casa/amplia', { da: 0 });
      assert(r.status === 409 && r.body.code === 'risorse' && r.body.manca.monete === k1 - lot0.monete, 'senza monete: ' + r.status + ' ' + JSON.stringify(r.body));
      assert((await post('/api/lot/casa/amplia', {})).status === 400, 'senza livello');
      assert((await post('/api/lot/casa/amplia', { da: 'x' })).status === 400, 'livello non numerico');
      for (let i = 0; i < 3; i++) assert((await playSolo('tokL')).status === 200, 'regata');
      const manca = k1 - (await get('/api/lot')).body.monete;
      if (manca > 0) assert((await post('/api/test/monete', { n: manca })).status === 200, 'monete di prova');
      const lot1 = (await get('/api/lot')).body;
      assert(lot1.monete >= k1, `servono ${k1} monete ma ce ne sono ${lot1.monete}`);
      const sbagliato = await post('/api/lot/casa/amplia', { da: 1 });
      assert(sbagliato.status === 409 && sbagliato.body.code === 'livello', 'livello sbagliato: ' + sbagliato.status + ' ' + JSON.stringify(sbagliato.body));
      assert(((await get('/api/lot')).body.casa?.livello ?? 0) === 0 && (await get('/api/lot')).body.monete === lot1.monete, 'i rifiuti hanno cambiato qualcosa');
    });

    let V;
    await ctx.test('PC: a casa (livello 0) camminando verso ovest ci si ferma al muro della stanza piccola', async () => {
      V = await open(ctx.B.DESKTOP);
      globalThis.__pc = V;
      await aCasa(V);
      const s = await V.st();
      assert(s.stanza.livello === 0, 'livello in casa: ' + s.stanza.livello);
      const p = mondo(X0 + 1.5, Z1 - 1.5); await V.hook('teleport', p.x, p.z);
      await V.page.keyboard.down('ArrowLeft'); await V.page.waitForTimeout(2500); await V.page.keyboard.up('ArrowLeft');
      const a = (await V.st()).avatar, muroVecchio = mondo(X0, 0).x;
      assert(a.x >= muroVecchio && a.x < muroVecchio + 1.5, `ci si ferma al muro: x ${a.x.toFixed(2)}, muro ${muroVecchio}`);
      await ctx.shot(V.page, 'pc_livello0');
    });

    await ctx.test('PC: dal mobiliere INGRANDISCI LA CASA chiede conferma, poi paga e porta la casa a livello 1', async () => {
      await V.hook('negozio');
      await ctx.waitState(V.page, (s) => s.negozio.dentro, 10000);
      const banco = (await V.st()).negozio.pezzi.find((p) => p.kind === 'banco');
      await V.hook('teleport', banco.x, banco.z);
      await ctx.waitState(V.page, (s) => s.negozio.near === 'banco', 5000);
      await V.page.keyboard.press('KeyE');
      await ctx.waitState(V.page, (s) => s.negozio.aperto === 'banco', 3000);
      const t = await V.page.locator('#mzNegozio').innerText();
      assert(t.includes('INGRANDISCI LA CASA') && t.includes(liv1.nome) && t.includes(String(k1)), 'scheda del banco: ' + t);
      await ctx.shot(V.page, 'pc_banco_ampliamento');
      const prima = (await get('/api/lot')).body.monete;
      await V.page.locator('#mzNegozio [data-act="amplia"]').click();
      await ctx.waitState(V.page, (s) => s.negozio.conferma === true, 3000);
      assert(((await get('/api/lot')).body.casa?.livello ?? 0) === 0, 'al primo tocco non paga');
      await V.page.locator('#mzNegozio [data-act="amplia"]').click();
      await ctx.waitState(V.page, (s) => s.negozio.ampliati === 1 && s.negozio.livello === 1, 8000);
      const lot = (await get('/api/lot')).body;
      assert(lot.casa.livello === 1, 'livello sul server: ' + JSON.stringify(lot.casa));
      assert(lot.monete === prima - k1, 'costo: ' + JSON.stringify({ prima, dopo: lot.monete, k1 }));
      const bis = await post('/api/lot/casa/amplia', { da: 1 });
      assert(bis.status === 409 && bis.body.code === 'tetto', 'secondo ampliamento nello stesso giorno rifiutato: ' + bis.status + ' ' + JSON.stringify(bis.body));
    });

    await ctx.test('PC: a casa la stanza è più grande: si passa oltre il vecchio muro e ci si ferma al nuovo', async () => {
      // dal negozio si esce in città (come in gioco) prima di rientrare in casa: uscita dal negozio ed entrata in casa nello stesso frame si pesterebbero la camera
      const { porta } = (await V.st()).negozio;
      await V.hook('teleport', porta.x - porta.verso.x * 3, porta.z - porta.verso.z * 3);
      await V.page.waitForTimeout(600);
      await aCasa(V);
      await ctx.waitState(V.page, (s) => s.stanza.livello === 1, 10000);
      const s = await V.st();
      assert(s.stanza.camera && Math.abs(s.stanza.camera.yaw) < 1e-6, 'camera fissa in casa: ' + JSON.stringify(s.stanza.camera));
      assert(JSON.stringify(s.stanza.pianta) === JSON.stringify(N), 'pianta: ' + JSON.stringify(s.stanza.pianta));
      const p = mondo(X0 + 1.5, Z1 - 1.5); await V.hook('teleport', p.x, p.z);
      await V.page.keyboard.down('ArrowLeft'); await V.page.waitForTimeout(3000); await V.page.keyboard.up('ArrowLeft');
      const a = (await V.st()).avatar, vecchio = mondo(X0, 0).x, nuovo = mondo(N[0], 0).x;
      assert(a.x < vecchio - 0.3 && a.x >= nuovo && a.x < nuovo + 1.5, `oltre il vecchio muro, fermo al nuovo: x ${a.x.toFixed(2)} (vecchio ${vecchio}, nuovo ${nuovo})`);
      await ctx.shot(V.page, 'pc_livello1');
      ctx.noErrors(V.pg, 'pc');
    });

    await ctx.test('telefono 390×844: la scheda del banco sta nello schermo (bottoni ≥ 44 px); senza risorse il tocco dice cosa manca', async () => {
      const W = await open(ctx.B.IPHONE, 'tokA');
      await W.hook('negozio');
      await ctx.waitState(W.page, (s) => s.negozio.dentro, 8000);
      const banco = (await W.st()).negozio.pezzi.find((p) => p.kind === 'banco');
      await W.hook('teleport', banco.x, banco.z);
      await ctx.waitState(W.page, (s) => s.negozio.near === 'banco', 5000);
      await W.page.locator('#btnA').tap();
      await ctx.waitState(W.page, (s) => s.negozio.aperto === 'banco', 3000);
      await W.page.waitForTimeout(400);
      await ctx.shot(W.page, 'telefono_banco');
      await W.page.locator('#mzNegozio [data-act="amplia"]').tap();
      await W.page.waitForTimeout(500);
      const txt = await W.page.locator('#mzNegozio').innerText();
      assert(/Non hai ancora abbastanza/.test(txt), 'senza risorse: ' + txt);
      // la scheda scorre dentro sé stessa (pala, retino, canna l'hanno allungata): contano i bottoni nella parte che si vede,
      // la scheda intera sta nello schermo, e tornando in cima il × si raggiunge
      const misura = () => W.page.evaluate(() => {
        const scheda = document.querySelector('#mzNegozio'), S = scheda.getBoundingClientRect();
        const bottoni = [...scheda.querySelectorAll('button')].filter((b) => b.offsetParent).map((b) => { const r = b.getBoundingClientRect(); return { t: b.textContent.slice(0, 20), w: Math.round(r.width), h: Math.round(r.height), vis: r.bottom > S.top && r.top < S.bottom, ok: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight }; });
        return { scheda: { top: Math.round(S.top), bottom: Math.round(S.bottom), h: innerHeight }, bottoni };
      });
      const dopo = await misura();
      assert(dopo.scheda.top >= 0 && dopo.scheda.bottom <= dopo.scheda.h, 'la scheda esce dallo schermo: ' + JSON.stringify(dopo.scheda));
      const piccoli = dopo.bottoni.filter((b) => b.vis && (b.h < 44 || !b.ok));
      assert(!piccoli.length, 'bottoni piccoli o fuori: ' + JSON.stringify(piccoli));
      await W.page.evaluate(() => { document.querySelector('#mzNegozio').scrollTop = 0; });
      const chiudi = (await misura()).bottoni.find((b) => b.t.trim() === '×');
      assert(chiudi && chiudi.vis && chiudi.ok && chiudi.h >= 44, 'il × non si raggiunge tornando in cima: ' + JSON.stringify(chiudi));
      ctx.noErrors(W.pg, 'telefono');
    });
  } finally {
    for (const p of pages) await p.close().catch(() => {});
    if (dev) {
      if (WIN) { try { execFileSync('taskkill', ['/pid', String(dev.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* già chiuso */ } }
      else { try { process.kill(-dev.pid, 'SIGTERM'); } catch { /* già finito */ } await sleep(500); try { process.kill(-dev.pid, 'SIGKILL'); } catch { /* ok */ } }
    }
    try { fs.rmSync(persist, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }); } catch { /* file ancora aperti su Windows */ }
    delete globalThis.__pc;
  }
}
