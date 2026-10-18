// Il negozio dei mobili (#265) sul server locale (wrangler dev, TEST_CLOCK:1): Luca vince monete con le Regate (API, autopilot); nel
// browser cammina contro la porta della bottega sullo slargo ed entra (velo, camera fissa, niente minimappa); davanti a un mobile in vetrina (quella
// di oggi, #384) A apre la scheda, COMPRA → è nel magazzino (server); una carta da parati comprata si mette subito; il banco dice cosa c’è oggi e il
// server rifiuta un mobile non esposto; in fondo al corridoio esce in città; a casa ARREDA posa il mobile. Senza monete la scheda dice quante ne mancano e non chiama il server. Telefono 390×844: bottone e scheda dentro
// lo schermo, ≥ 44 px. Screenshot: la bottega in città, il negozio da dentro (PC e telefono), la scheda.
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
  const persist = path.join(ctx.OUT, `m3negozio-${process.pid}`);
  const env = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' };
  const wr = (...a) => execFileSync('npx', ['--no-install', 'wrangler', ...a], { cwd: SERVER, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 }).toString();
  const sim = async (f) => import(pathToFileURL(path.join(ctx.ROOT, 'packages/sim/src', f)).href);
  const { regata } = await sim('minigames/regata/regata.ts');
  const { packInputs, quantize } = await sim('replay.ts');
  const { createRng } = await sim('rng.ts');
  const read = (f) => JSON.parse(fs.readFileSync(path.join(ctx.ROOT, 'packages/content/src', f), 'utf8'));
  const mobili = read('mobili.json').mobili, borgo = read('borgo.json'), arch = read('archipelago.json');
  const { vetrinaOra } = await sim('economy/vetrina.ts');
  const oggi = vetrinaOra(Date.now()), def = (id) => mobili.find((m) => m.id === id);
  // il negozio vende solo la vetrina di oggi (#384): il mobile di prova è il più economico a terra 1×1 tra gli esposti, l’altro è uno a parete esposto
  const stereo = oggi.terra.map(def).filter((m) => m && !m.celle).sort((a, b) => a.monete - b.monete)[0], orologio = def(oggi.parete[0]), carta = borgo.carte.find((f) => f.id === oggi.carte[0]); // anche le carte da parati sono quelle di oggi (#393)
  assert(stereo && orologio, 'la vetrina di oggi non ha un mobile a terra 1×1 e uno a parete');
  const [X0, Z0] = borgo.stanza.pavimento, ORIG = arch.islands.find((i) => i.role === 'lotto' && i.slot === 0).at;
  const mondo = (cx, cz) => ({ x: (ORIG[0] + cx) * 2, z: (ORIG[1] + cz) * 2 });

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
    for (let i = 0; i < 4 && (await get('/api/lot')).body.monete < stereo.monete + carta.monete + orologio.monete; i++) assert((await playSolo('tokL')).status === 200, 'regata');
    // le Regate da sole non sempre bastano (10 premiate al giorno): il resto dalla rotta di prova (#414)
    { const m = (await get('/api/lot')).body.monete, serve = stereo.monete + carta.monete + orologio.monete; if (m < serve) assert((await post('/api/test/monete', { n: serve - m })).status === 200, 'monete di prova'); }

    const open = async (viewport, tok = 'tokL') => {
      const pg = await ctx.B.openPage(ctx.browser, `${BASE}/?t=${tok}&test=1`, { viewport });
      pages.push(pg); ctx._pages.push(pg);
      await ctx.waitReady(pg.page, 30000);
      await ctx.waitState(pg.page, (s) => s.lot && s.lot.ready && s.negozio && s.negozio.pezzi.length >= 3, 30000);
      const hook = (n, ...a) => pg.page.evaluate(([n, a]) => window.__game.test[n](...a), [n, a]);
      return { pg, page: pg.page, hook, st: () => ctx.getState(pg.page) };
    };
    /** Frecce che con la camera girata di `yaw` vanno più dritte verso (dx, dz) nel mondo. */
    const frecce = (yaw, dx, dz) => {
      const su = [-Math.sin(yaw), -Math.cos(yaw)], de = [Math.cos(yaw), -Math.sin(yaw)];
      let best = null;
      for (const v of [-1, 0, 1]) for (const h of [-1, 0, 1]) {
        if (!v && !h) continue;
        const x = su[0] * v + de[0] * h, z = su[1] * v + de[1] * h, d = (x * dx + z * dz) / Math.hypot(x, z);
        if (!best || d > best.d) best = { d, k: [...(v > 0 ? ['ArrowUp'] : v < 0 ? ['ArrowDown'] : []), ...(h > 0 ? ['ArrowRight'] : h < 0 ? ['ArrowLeft'] : [])] };
      }
      return best.k;
    };
    const cammina = async (page, tasti, fatto, ms = 15000) => { for (const k of tasti) await page.keyboard.down(k); try { await ctx.waitState(page, fatto, ms); } finally { for (const k of tasti) await page.keyboard.up(k); } };

    await ctx.test('PC: la bottega MOBILI sullo slargo; contro la porta si entra (velo, camera fissa, niente minimappa)', async () => {
      const V = await open(ctx.B.DESKTOP);
      globalThis.__pc = V;
      const { porta } = (await V.st()).negozio;
      await V.hook('teleport', porta.x - porta.verso.x * 3, porta.z - porta.verso.z * 3);
      await V.page.waitForTimeout(800);
      await ctx.shot(V.page, 'pc_bottega');
      await V.hook('teleport', porta.x, porta.z);
      await cammina(V.page, frecce(Math.PI / 4, porta.verso.x, porta.verso.z), (s) => s.negozio.dentro, 15000);
      await V.page.waitForFunction(() => !window.__game.state().velo.attivo, null, { timeout: 5000 });
      const s = await V.st();
      assert(s.velo.passaggi >= 1 && !s.mappa.mini, 'dentro: ' + JSON.stringify({ velo: s.velo, mini: s.mappa.mini }));
      await V.page.waitForTimeout(500);
      await ctx.shot(V.page, 'pc_negozio');
    });

    await ctx.test('PC: davanti al mobile in vetrina A apre la scheda; COMPRA → nel magazzino; la carta da parati si mette subito', async () => {
      const V = globalThis.__pc, p0 = (await get('/api/lot')).body.monete;
      for (const id of [stereo.id, carta.id]) {
        const pz = (await V.st()).negozio.pezzi.find((p) => p.id === id);
        await V.hook('teleport', pz.x, pz.z);
        await ctx.waitState(V.page, (s, id) => s.negozio.near === id, 5000, id);
        await V.page.keyboard.press('KeyE');
        await ctx.waitState(V.page, (s, id) => s.negozio.aperto === id, 3000, id);
        if (id === stereo.id) await ctx.shot(V.page, 'pc_scheda');
        await V.page.locator('#mzNegozio [data-act="compra"]').click();
        await ctx.waitState(V.page, (s, n) => s.negozio.comprati === n, 8000, id === stereo.id ? 1 : 2);
      }
      const lot = (await get('/api/lot')).body;
      assert(lot.casa.magazzino[stereo.id] === 1, 'magazzino: ' + JSON.stringify(lot.casa));
      assert(lot.casa.carta === carta.id && lot.casa.finiture.includes(carta.id), 'carta: ' + JSON.stringify(lot.casa));
      assert(lot.monete === p0 - stereo.monete - carta.monete, `monete ${lot.monete} invece di ${p0 - stereo.monete - carta.monete}`);
    });

    await ctx.test('PC: il banco dice cosa c’è oggi; i pezzi in negozio sono la vetrina della sim; un mobile non esposto il server lo rifiuta (#384)', async () => {
      const V = globalThis.__pc, s0 = await V.st(), banco = s0.negozio.pezzi.find((p) => p.kind === 'banco');
      assert(banco, 'manca il banco del mobiliere');
      assert(JSON.stringify(s0.negozio.vetrina) === JSON.stringify(oggi), 'la vetrina del client non è quella della sim: ' + JSON.stringify(s0.negozio.vetrina));
      const esposti = s0.negozio.pezzi.filter((p) => p.kind === 'mobile').map((p) => p.id).sort();
      assert(JSON.stringify(esposti) === JSON.stringify([...oggi.terra, ...oggi.parete].sort()), 'pezzi in negozio: ' + esposti.join(','));
      for (const [kind, ids] of [['carta', oggi.carte], ['pavimento', oggi.pavimenti]]) {
        const visti = s0.negozio.pezzi.filter((p) => p.kind === kind).map((p) => p.id).sort();
        assert(JSON.stringify(visti) === JSON.stringify([...ids].sort()), `${kind} in negozio: ${visti.join(',')} invece di ${ids.join(',')}`);
      }
      await V.hook('teleport', banco.x, banco.z);
      await ctx.waitState(V.page, (s) => s.negozio.near === 'banco', 5000);
      await V.page.keyboard.press('KeyE');
      await ctx.waitState(V.page, (s) => s.negozio.aperto === 'banco', 3000);
      await V.page.waitForFunction(() => document.querySelector('#mzNegozio')?.textContent?.includes('Merce nuova'), null, { timeout: 5000 });
      await ctx.shot(V.page, 'pc_banco');
      // fuori vetrina il server rifiuta (409, requisito) e non cambia niente; l’id sconosciuto resta 404
      const fuori = mobili.find((m) => m.posto === 'terra' && !oggi.terra.includes(m.id)), prima = (await get('/api/lot')).body;
      const r = await post('/api/lot/casa/compra', { id: fuori.id });
      assert(r.status === 409 && r.body.code === 'requisito', 'fuori vetrina: ' + r.status + ' ' + JSON.stringify(r.body));
      const dopo = (await get('/api/lot')).body;
      assert(JSON.stringify(dopo.casa) === JSON.stringify(prima.casa) && dopo.monete === prima.monete, 'il rifiuto ha cambiato qualcosa');
      assert((await post('/api/lot/casa/compra', { id: 'trono' })).status === 404, 'mobile sconosciuto');
    });

    await ctx.test('PC: in fondo al corridoio si esce in città; a casa ARREDA posa il mobile comprato', async () => {
      const V = globalThis.__pc, u = (await V.st()).negozio.uscita;
      await V.hook('teleport', u.x, u.z);
      await cammina(V.page, ['ArrowDown'], (s) => !s.negozio.dentro && s.arch.place === 'porto', 20000);
      await V.page.waitForFunction(() => !window.__game.state().velo.attivo, null, { timeout: 5000 });
      await V.hook('porta', 0);
      await ctx.waitState(V.page, (s) => s.stanza.dentro === 0 && s.arreda && s.arreda.mia, 10000);
      assert((await V.st()).stanza.carta === carta.id, 'la carta comprata non è in casa');
      await V.hook('arredaPosa', stereo.id);
      const w = mondo(X0 + 3.5, Z0 + 3.5); await V.hook('teleport', w.x, w.z);
      await V.page.keyboard.down('ArrowUp'); await sleep(90); await V.page.keyboard.up('ArrowUp');
      await ctx.waitState(V.page, (s) => s.arreda.ok, 3000);
      await V.page.keyboard.press('KeyE');
      await ctx.waitState(V.page, (s, id) => s.arreda.arredi.some((a) => a.mobile === id), 8000, stereo.id);
      ctx.noErrors(V.pg, 'pc');
    });

    await ctx.test('telefono 390×844: senza monete la scheda dice quante ne mancano (niente chiamate); bottoni ≥ 44 px dentro lo schermo', async () => {
      const V = await open(ctx.B.IPHONE, 'tokA');
      await V.hook('negozio');
      await ctx.waitState(V.page, (s) => s.negozio.dentro, 8000);
      const caro = (await V.st()).negozio.pezzi.find((p) => p.kind === 'mobile');
      await V.hook('teleport', caro.x, caro.z);
      await ctx.waitState(V.page, (s, id) => s.negozio.near === id, 5000, caro.id);
      await V.page.waitForTimeout(500);
      await ctx.shot(V.page, 'telefono_negozio');
      await V.page.locator('#btnA').tap();
      await ctx.waitState(V.page, (s, id) => s.negozio.aperto === id, 3000, caro.id);
      const perle = (await get('/api/lot', 'tokA')).body.monete;
      await V.page.locator('#mzNegozio [data-act="compra"]').tap();
      await V.page.waitForTimeout(500);
      const txt = await V.page.locator('#mzNegozio').innerText();
      if (perle < caro.monete) assert(/mancano/.test(txt), 'senza monete: ' + txt);
      const piccoli = await V.page.evaluate(() => [...document.querySelectorAll('#mzNegozio button')].filter((b) => b.offsetParent).map((b) => { const r = b.getBoundingClientRect(); return { t: b.textContent.slice(0, 20), w: Math.round(r.width), h: Math.round(r.height), fuori: r.left < 0 || r.right > innerWidth || r.bottom > innerHeight }; }).filter((r) => r.w < 44 || r.h < 44 || r.fuori));
      assert(!piccoli.length, 'bottoni piccoli o fuori: ' + JSON.stringify(piccoli));
      await ctx.shot(V.page, 'telefono_scheda');
      ctx.noErrors(V.pg, 'telefono');
    });

    // per ultimo: sposta l'orologio del server (e del lotto di Luca) in avanti
    await ctx.test('a mezzanotte la vetrina cambia: il client rimonta i pezzi del giorno nuovo e il server rifiuta quelli di ieri (#384)', async () => {
      const V = globalThis.__pc, { finoAMezzanotte } = await sim('economy/giorno.ts');
      const off = finoAMezzanotte(Date.now()) + 3_600_000, domani = vetrinaOra(Date.now() + off);
      assert(JSON.stringify(domani) !== JSON.stringify(oggi), 'la vetrina di domani è uguale a quella di oggi');
      await V.page.setExtraHTTPHeaders({ 'x-test-now-offset': String(off) });
      await ctx.waitState(V.page, (s, v) => JSON.stringify(s.negozio.vetrina) === v, 45000, JSON.stringify(domani));
      const s1 = await V.st(), esposti = s1.negozio.pezzi.filter((p) => p.kind === 'mobile').map((p) => p.id).sort();
      assert(JSON.stringify(esposti) === JSON.stringify([...domani.terra, ...domani.parete].sort()), 'pezzi dopo mezzanotte: ' + esposti.join(','));
      await V.hook('negozio');
      await ctx.waitState(V.page, (s) => s.negozio.dentro, 10000);
      await V.page.waitForTimeout(1200);
      await ctx.shot(V.page, 'pc_domani');
      const ieri = oggi.terra.find((id) => !domani.terra.includes(id)), r = await fetch(BASE + '/api/lot/casa/compra', { method: 'POST', headers: { ...hdr('tokL'), 'x-test-now-offset': String(off) }, body: JSON.stringify({ id: ieri }) });
      assert(r.status === 409, 'un mobile di ieri non più esposto: ' + r.status);
      // anche carte e pavimenti: quelli di domani sono in negozio, una carta di oggi che domani non c’è si rifiuta
      for (const [kind, ids] of [['carta', domani.carte], ['pavimento', domani.pavimenti]]) {
        const visti = (await V.st()).negozio.pezzi.filter((p) => p.kind === kind).map((p) => p.id).sort();
        assert(JSON.stringify(visti) === JSON.stringify([...ids].sort()), `${kind} dopo mezzanotte: ${visti.join(',')}`);
      }
      const cIeri = oggi.carte.find((id) => !domani.carte.includes(id)), rc = await fetch(BASE + '/api/lot/casa/finitura', { method: 'POST', headers: { ...hdr('tokL'), 'x-test-now-offset': String(off) }, body: JSON.stringify({ tipo: 'carta', id: cIeri }) });
      assert(rc.status === 409, 'una carta di ieri non più esposta: ' + rc.status);
    });
  } finally {
    for (const p of pages) await p.close().catch(() => {});
    if (dev) { try { process.kill(-dev.pid, 'SIGTERM'); } catch { /* già finito */ } await sleep(500); try { process.kill(-dev.pid, 'SIGKILL'); } catch { /* ok */ } }
    fs.rmSync(persist, { recursive: true, force: true });
    delete globalThis.__pc;
  }
}
