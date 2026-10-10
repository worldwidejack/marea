// Gran Premio (Isola delle Corse, docs/CORSE.md, #173): nel gioco gira sul motore v2 (pista a nastro 3D, la stessa del banco di prova).
// API (wrangler locale pulito): il server rigioca gli input del pilota automatico sulla pista scelta (opzioni normalizzate dal modulo,
// primo tick = il semaforo: i tick negativi della sim sono input anch'essi), dà la medaglia dalla posizione e paga balance.solo più il
// premio extra; chi sta fermo non prende medaglia; input oltre il tempo massimo rifiutati. Telefono IN ORIZZONTALE 844×390 (in verticale
// compare «Ruota il telefono»): l'isola è aperta a tutti, al via c'è GIOCA, che apre l'hub (#185, test suo in m4_corse_hub.mjs); alla
// porta della Spiaggia la scelta di pista e veicolo sta dentro lo schermo, VIA → semaforo → gara con la camera dietro; gas in avanti +
// DRIFT = drift; draw call ≤ 100 in gara; il pilota automatico finisce, la scheda dice posizione e tempo; si torna nell'hub e da lì nel
// mondo. PC: E al via (hub), porta, Invio = via, ↑ gas, ← + Spazio = drift a sinistra, Esc = ritirato (di nuovo nell'hub), Esc = fuori.
// Screenshot in tests/out/shots/m4_corse_*.
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
export const timeout = 480000;

const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SPOT = 'corse:corse';

export default async function (ctx) {
  const { assert } = ctx;
  const SERVER = path.join(ctx.ROOT, 'apps/server');
  const persist = path.join(ctx.OUT, `m4corse-${process.pid}`);
  const env = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' };
  const wr = (...a) => execFileSync('npx', ['--no-install', 'wrangler', ...a], { cwd: SERVER, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 }).toString();
  const balance = JSON.parse(fs.readFileSync(path.join(ctx.ROOT, 'packages/content/src/balance.json'), 'utf8'));
  const CFG = JSON.parse(fs.readFileSync(path.join(ctx.ROOT, 'packages/content/src/minigames/corse.json'), 'utf8'));
  const MOTORE = JSON.parse(fs.readFileSync(path.join(ctx.ROOT, 'packages/content/src/corse/motore.json'), 'utf8'));
  const pages = [];
  let dev = null, log = '';
  try {
    fs.rmSync(persist, { recursive: true, force: true });
    wr('d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', persist);
    wr('d1', 'execute', 'DB', '--local', '--persist-to', persist, '--command',
      "INSERT INTO persone (id, nome, token, slot) VALUES ('luca', 'Luca', 'tokL', 0), ('mia', 'Mia', 'tokM', 1), ('ugo', 'Ugo', 'tokU', 2);");
    const port = await freePort(), inspector = await freePort();
    dev = spawn('npx', ['--no-install', 'wrangler', 'dev', '--local', '--ip', '127.0.0.1', '--port', String(port), '--inspector-port', String(inspector),
      '--assets', ctx.distDir, '--persist-to', persist, '--show-interactive-dev-session=false'], { cwd: SERVER, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    dev.stdout.on('data', (d) => (log += d)); dev.stderr.on('data', (d) => (log += d));
    const base = `http://127.0.0.1:${port}`;
    let up = false;
    for (let i = 0; i < 120 && !up; i++) { try { up = (await fetch(base + '/api/ping')).ok; } catch { /* non ancora */ } if (!up) await sleep(500); }
    if (!up) throw new Error('wrangler dev non risponde:\n' + log.split('\n').slice(-20).join('\n'));
    const post = async (p, t, b) => { const r = await fetch(base + p, { method: 'POST', headers: { 'x-token': t, 'content-type': 'application/json' }, body: JSON.stringify(b ?? {}) }); return { status: r.status, body: await r.json() }; };
    const sim = await import(pathToFileURL(path.join(ctx.ROOT, 'packages/sim/src/index.ts')).href);
    const gara = await import(pathToFileURL(path.join(ctx.ROOT, 'packages/sim/src/corse/gara.ts')).href);
    const medaglie = { 1: 'oro', 2: 'argento', 3: 'bronzo' };
    const autoplay = (seed, difficulty, opzioni) => {
      const m = gara.garaCorse, s = m.create({ seed, difficulty, opzioni }), frames = [];
      for (let i = 0; i < m.maxTicks && !m.result(s).done; i++) { const f = sim.quantize(gara.pilotaGara(s)); frames.push(f); m.step(s, f); }
      return { frames, r: m.result(s) };
    };
    const premioDi = (medal) => { const p = { ...balance.solo.premi[medal] }; for (const [k, v] of Object.entries(CFG.premioExtra?.[medal] ?? {})) p[k] = (p[k] ?? 0) + v; return p; };

    await ctx.test('API: il server rigioca la gara del pilota automatico sulla pista scelta, medaglia dalla posizione, premio pagato', async () => {
      const st = await post('/api/solo/start', 'tokU', { minigame: 'corse', opzioni: { pista: 'spiaggia_lungomare', veicolo: 'auto' } });
      assert(st.status === 200 && st.body.minigame === 'corse' && Number.isInteger(st.body.seed), `start: ${st.status} ${JSON.stringify(st.body).slice(0, 300)}`);
      assert(st.body.opzioni.pista === 'spiaggia_lungomare' && st.body.opzioni.veicolo === 'auto', `opzioni non normalizzate: ${JSON.stringify(st.body.opzioni)}`);
      const { frames, r: local } = autoplay(st.body.seed, st.body.difficulty, st.body.opzioni);
      const t0 = Date.now();
      const r = await post('/api/solo/play', 'tokU', { inputs: sim.packInputs(frames) });
      ctx.log(`API gara: ${frames.length} tick rigiocati in ${Date.now() - t0} ms, ${JSON.stringify(r.body.detail)}`);
      assert(r.status === 200 && r.body.score === local.score && r.body.detail.pos === local.detail.pos && r.body.medal === local.medal, `play: ${r.status} ${JSON.stringify(r.body).slice(0, 300)} (locale ${local.score} ${local.medal})`);
      assert(r.body.detail.giri === r.body.detail.tot, `gara non finita: ${JSON.stringify(r.body.detail)}`);
      if (r.body.medal) assert(r.body.premiata && JSON.stringify(r.body.premio) === JSON.stringify(premioDi(r.body.medal)), `premio: ${JSON.stringify(r.body.premio)} invece di ${JSON.stringify(premioDi(r.body.medal))}`);
    });
    await ctx.test('API: la Fuga (con l\'onda) e il Porto misto si rigiocano uguali sul server', async () => {
      for (const opz of [{ pista: 'spiaggia_fuga', veicolo: 'kart' }, { pista: 'spiaggia_porto', veicolo: 'moto_acqua' }]) {
        const st = await post('/api/solo/start', 'tokM', { minigame: 'corse', opzioni: opz });
        assert(st.status === 200, `start ${opz.pista}: ${st.status} ${JSON.stringify(st.body).slice(0, 200)}`);
        const { frames, r: local } = autoplay(st.body.seed, st.body.difficulty, st.body.opzioni);
        const r = await post('/api/solo/play', 'tokM', { inputs: sim.packInputs(frames) });
        assert(r.status === 200 && r.body.score === local.score && r.body.detail.pos === local.detail.pos, `${opz.pista}: ${r.status} ${JSON.stringify(r.body).slice(0, 200)} (locale ${local.score})`);
      }
    });
    await ctx.test('API: chi sta fermo non prende medaglia, input oltre il tempo massimo rifiutati', async () => {
      await post('/api/solo/start', 'tokU', { minigame: 'corse' });
      const r = await post('/api/solo/play', 'tokU', { inputs: [[1, 2, 0, 0, 0], [600, 0, 0, 0, 0]] });
      assert(r.status === 200 && r.body.medal === null, `fermo: ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
      await post('/api/solo/start', 'tokU', { minigame: 'corse' });
      const troppo = await post('/api/solo/play', 'tokU', { inputs: [[MOTORE.maxSeconds * 60 + 1, 0, 32, 0, 0]] });
      assert(troppo.status === 400, `input oltre il tempo: ${troppo.status}`);
    });

    // ---------- telefono (in orizzontale) ----------
    const LAND = { width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
    const T = await ctx.B.openPage(ctx.browser, `${base}/?t=tokL&test=1`, { viewport: LAND }); pages.push(T); ctx._pages.push(T);
    const page = T.page;
    await ctx.waitReady(page, 40000);
    await ctx.waitState(page, (s) => s.lot && s.lot.ready === true && s.temi && s.compass, 40000);
    const st = () => ctx.getState(page);
    const hook = (n, ...a) => page.evaluate(([n, a]) => window.__game.test[n](...a), [n, a]);

    await ctx.test('telefono: l\'isola è aperta a tutti, al via compare GIOCA · ISOLA DELLE CORSE', async () => {
      await hook('temiProva', null); // il viaggiatore vero: Molo L1 e basta
      const v = await hook('spotVai', SPOT);
      assert(v && v.aperta === true, 'spotVai: ' + JSON.stringify(v));
      await ctx.waitState(page, (s, id) => s.minigiochi.near === id, 20000, SPOT);
      await sleep(1500);
      const testo = await page.locator('#mzPlay').innerText();
      assert(/ISOLA DELLE CORSE|GRAN PREMIO/.test(testo), 'testo del bottone: ' + testo); // dal #185 il posto apre l'hub: «Isola delle Corse»
      await ctx.shot(page, 'telefono_1_posto');
    });

    await ctx.test('telefono: scelta di pista e veicolo dentro lo schermo orizzontale, VIA, semaforo, gas + DRIFT = drift, draw call ≤ 100', async () => {
      await page.locator('#mzPlay').click();
      await ctx.waitState(page, (s) => s.corse && s.corse.hub && s.corse.hub.aperto === true, 20000);
      await hook('corseHubVai', 'spiaggia'); // dall'hub alla porta della Spiaggia
      await ctx.waitState(page, (s) => s.corse && s.corse.scelta === true, 20000);
      await sleep(400);
      const box = await page.locator('#mzGpIntro .box').boundingBox();
      assert(box && box.x >= 0 && box.x + box.width <= 844 && box.y >= 0 && box.y + box.height <= 390, 'la scelta esce dal telefono: ' + JSON.stringify(box));
      assert(await page.isVisible('#mzGpVia'), 'il bottone VIA non si vede');
      await page.locator('#mzGpIntro [data-id="auto"]').click();
      await ctx.shot(page, 'telefono_2_scelta');
      await page.locator('#mzGpVia').click();
      await ctx.waitState(page, (s) => s.corse.active && s.corse.veicolo === 'auto' && s.corse.pista === 'spiaggia_lungomare', 20000);
      assert(!(await page.isVisible('#mzTop')), 'la barra in alto della superficie è ancora visibile');
      await ctx.waitState(page, (s) => s.corse.vista && s.corse.vista.kit === true && s.corse.vista.avatar === true, 30000);
      await sleep(400);
      await ctx.shot(page, 'telefono_3_semaforo');
      // gas a tutta e dritto: in assi mondo (camera a 45°) l'avanti dello schermo è (−0,707, −0,707)
      await hook('wp2_inject', { mx: -0.707, my: -0.707, a: false });
      await ctx.waitState(page, (s) => s.corse.tick > 0 && s.corse.v > 12, 60000);
      // sterzo a destra sullo schermo + DRIFT tenuto, restando col gas
      await hook('wp2_inject', { mx: -0.07, my: -0.92, a: true });
      await ctx.waitState(page, (s) => s.corse.drift === 1, 5000);
      await sleep(500);
      await ctx.shot(page, 'telefono_4_drift');
      await hook('wp2_inject', null);
      const perf = await ctx.getPerf(page);
      ctx.log('perf in gara (telefono)', JSON.stringify(perf));
      assert(perf.drawCalls <= 100, `draw call ${perf.drawCalls} > 100`);
    });

    await ctx.test('telefono: il pilota automatico finisce la gara, il server rigioca, la scheda dice posizione e tempo; si torna nell\'hub e poi nel mondo', async () => {
      const before = (await st()).lot.resources;
      await hook('corseAuto', 12);
      await ctx.waitState(page, (s) => s.minigiochi.open === true, 150000);
      const s = await st(), r = s.minigiochi.last;
      ctx.log(`esito ${r.medal} ${r.score} · ${JSON.stringify(r.detail)}`);
      assert(r.detail.giri === r.detail.tot && r.detail.pos >= 1 && r.detail.pos <= 5, 'esito: ' + JSON.stringify(r));
      if (r.premiata) for (const k of ['legno', 'pietra', 'perle']) assert(r.lot.resources[k] >= before[k] + r.premio[k], `${k} non pagato`);
      const txt = await page.locator('#mzEsito').innerText();
      assert(/° su 5/.test(txt) && /giro migliore/.test(txt), 'scheda: ' + txt);
      await sleep(300);
      await ctx.shot(page, 'telefono_5_esito');
      await hook('corseAuto', 0);
      await page.locator('#mzEsito [data-act="ok"]').click();
      await ctx.waitState(page, (q) => !q.minigiochi.open && !q.corse.active && q.corse.hub.aperto, 5000);
      await hook('corseEsci');
      await ctx.waitState(page, (q) => !q.corse.hub.aperto, 5000);
      assert(await page.isVisible('#mzTop'), 'la barra in alto non è tornata');
    });
    ctx.noErrors(T, 'telefono');

    await ctx.test('telefono in verticale: avviso «Ruota il telefono» e la gara aspetta', async () => {
      const V = await ctx.B.openPage(ctx.browser, `${base}/?t=tokL&test=1`, { viewport: ctx.B.IPHONE }); pages.push(V); ctx._pages.push(V);
      await ctx.waitReady(V.page, 40000);
      await ctx.waitState(V.page, (s) => s.lot && s.lot.ready === true && s.temi && s.compass, 40000);
      await V.page.evaluate(() => window.__game.test.temiProva(null));
      await V.page.evaluate((id) => window.__game.test.spotVai(id), SPOT);
      await ctx.waitState(V.page, (s, id) => s.minigiochi.near === id, 20000, SPOT);
      await sleep(800);
      await V.page.locator('#mzPlay').click();
      await ctx.waitState(V.page, (s) => s.corse && s.corse.hub && s.corse.hub.aperto === true, 20000);
      await sleep(500);
      assert(await V.page.evaluate(() => document.querySelector('.pp-ruota')?.classList.contains('on') === true), 'l\'avviso non compare in verticale');
      await ctx.shot(V.page, 'telefono_verticale_avviso');
      await V.page.evaluate(() => window.__game.test.corseEsci());
      await ctx.waitState(V.page, (s) => !s.minigiochi.open && !s.corse.active && !s.corse.scelta && !s.corse.hub.aperto, 8000);
      assert(await V.page.evaluate(() => document.querySelector('.pp-ruota')?.classList.contains('on') !== true), 'l\'avviso resta dopo l\'uscita');
    });

    // ---------- PC ----------
    const D = await ctx.B.openPage(ctx.browser, `${base}/?t=tokM&test=1`, { viewport: ctx.B.DESKTOP }); pages.push(D); ctx._pages.push(D);
    const dp = D.page;
    await ctx.waitReady(dp, 40000);
    await ctx.waitState(dp, (s) => s.lot && s.lot.ready === true && s.temi, 40000);
    const dhook = (n, ...a) => dp.evaluate(([n, a]) => window.__game.test[n](...a), [n, a]);

    await ctx.test('PC: E al via, Invio = via, ↑ gas, ← + Spazio = drift a sinistra, Esc = ritirato', async () => {
      await dhook('spotVai', SPOT);
      await ctx.waitState(dp, (s, id) => s.minigiochi.near === id, 20000, SPOT);
      await sleep(1000);
      await dp.keyboard.press('KeyE');
      await ctx.waitState(dp, (s) => s.corse && s.corse.hub && s.corse.hub.aperto === true, 20000);
      await dhook('corseHubVai', 'spiaggia');
      await ctx.waitState(dp, (s) => s.corse && s.corse.scelta === true, 20000);
      await dp.keyboard.press('Enter');
      await ctx.waitState(dp, (s) => s.corse.active && s.corse.tick !== undefined, 20000);
      await dp.keyboard.down('ArrowUp');
      await ctx.waitState(dp, (s) => s.corse.tick > 0 && s.corse.v > 12, 60000);
      await dp.keyboard.down('ArrowLeft'); await dp.keyboard.down('Space');
      await ctx.waitState(dp, (s) => s.corse.drift === -1, 5000);
      await sleep(400);
      await ctx.shot(dp, 'desktop_1_drift');
      await dp.keyboard.up('Space'); await dp.keyboard.up('ArrowLeft'); await dp.keyboard.up('ArrowUp');
      const perf = await ctx.getPerf(dp);
      ctx.log('perf in gara (PC)', JSON.stringify(perf));
      assert(perf.drawCalls <= 100, `draw call ${perf.drawCalls} > 100`);
      await dp.keyboard.press('Escape');
      await ctx.waitState(dp, (s) => !s.corse.active && !s.minigiochi.open && s.corse.hub.aperto, 8000); // ritirato: di nuovo nell'hub
      await dp.keyboard.press('Escape');
      await ctx.waitState(dp, (s) => !s.corse.hub.aperto, 8000);
      assert((await ctx.getState(dp)).mode === 'walk', 'dopo il ritiro si resta a piedi');
    });
    ctx.noErrors(D, 'PC');
  } finally {
    for (const p of pages) await p.close().catch(() => {});
    if (dev) { try { process.kill(-dev.pid, 'SIGTERM'); } catch { /* già finito */ } await sleep(500); try { process.kill(-dev.pid, 'SIGKILL'); } catch { /* ok */ } }
    fs.rmSync(persist, { recursive: true, force: true });
  }
}
