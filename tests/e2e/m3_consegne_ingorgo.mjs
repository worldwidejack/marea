// Minigiochi universali: Consegne (in barca, dal molo al molo indicato) e Ingorgo (puzzle a schermo stile Rush Hour). Server locale pulito.
// API: il server rigioca gli input dell'autopilota e paga l'oro (Consegne partite da un lotto: il molo è il primo input), input rotti 400.
// Browser PC (Luca, lotto 0): sul molo del lotto compaiono CONSEGNE e INGORGO (non accanto alla barca né allo spawn), nella bussola solo
// quelli del Porto; Consegne dal molo: conto alla rovescia, rotta a puntini, meta con bandiera, HUD; l'autopilota consegna tutto, il server premia.
// Telefono (Mia, 390×844): Ingorgo al Porto, la griglia sta nello schermo, una barca si trascina davvero, RICOMINCIA, Esc ritira;
// l'autopilota risolve i tre ingorghi e il server premia. HUD delle Consegne leggibile sul telefono.
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
export const timeout = 480000;

const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function (ctx) {
  const { assert } = ctx;
  const SERVER = path.join(ctx.ROOT, 'apps/server');
  const persist = path.join(ctx.OUT, `m3ci-${process.pid}`);
  const env = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' };
  const wr = (...a) => execFileSync('npx', ['--no-install', 'wrangler', ...a], { cwd: SERVER, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 }).toString();
  const balance = JSON.parse(fs.readFileSync(path.join(ctx.ROOT, 'packages/content/src/balance.json'), 'utf8'));
  const sim = await import(pathToFileURL(path.join(ctx.ROOT, 'packages/sim/src/index.ts')).href);

  let dev = null, log = '';
  const pages = [];
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
    /** Partita dell'autopilota della sim, quantizzata come fa il client; `first` = frame iniziale (le Consegne: il molo). */
    const autoplay = (id, seed, difficulty, first) => {
      const m = sim.getMinigame(id), s = m.create({ seed, difficulty }), rng = sim.createRng(1), frames = [];
      if (first) { const f = sim.quantize(first); frames.push(f); m.step(s, f); }
      for (let i = 0; i < m.maxTicks && !m.result(s).done; i++) { const f = sim.quantize(m.autopilot(s, rng)); frames.push(f); m.step(s, f); }
      return { frames, local: m.result(s) };
    };

    await ctx.test('API: Consegne da un lotto (molo = primo input) e Ingorgo, il server rigioca l\'autopilota e paga l\'oro', async () => {
      const moli = sim.consegneMoli(), lotto = moli.findIndex((m) => m.id === 'lotto:2');
      const st = await post('/api/solo/start', 'tokU', { minigame: 'consegne' });
      assert(st.status === 200 && st.body.minigame === 'consegne', `start consegne: ${st.status} ${JSON.stringify(st.body).slice(0, 200)}`);
      const a = autoplay('consegne', st.body.seed, st.body.difficulty, sim.startFrame(lotto));
      const r = await post('/api/solo/play', 'tokU', { inputs: sim.packInputs(a.frames) });
      assert(r.status === 200 && r.body.medal === 'oro', `play consegne: ${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
      assert(r.body.detail.partenza === lotto && r.body.detail.consegne === 5 && r.body.score === a.local.score, 'detail: ' + JSON.stringify(r.body.detail));
      assert(r.body.premiata && JSON.stringify(r.body.premio) === JSON.stringify(balance.solo.premi.oro), 'premio: ' + JSON.stringify(r.body.premio));
      ctx.log(`consegne: ${a.frames.length} tick, ${sim.packInputs(a.frames).length} righe, ${JSON.stringify(sim.packInputs(a.frames)).length} byte`);
      const s2 = await post('/api/solo/start', 'tokU', { minigame: 'ingorgo' });
      assert(s2.status === 200 && s2.body.minigame === 'ingorgo', `start ingorgo: ${s2.status}`);
      const b = autoplay('ingorgo', s2.body.seed, s2.body.difficulty);
      const r2 = await post('/api/solo/play', 'tokU', { inputs: sim.packInputs(b.frames) });
      assert(r2.status === 200 && r2.body.medal === 'oro' && r2.body.detail.risolti === 3, `play ingorgo: ${r2.status} ${JSON.stringify(r2.body).slice(0, 300)}`);
      assert(JSON.stringify(r2.body.premio) === JSON.stringify(balance.solo.premi.oro), 'premio ingorgo');
    });

    await ctx.test('API: input rotti 400 (troppi tick, righe storte); mezza partita di Consegne → la medaglia la decide il server', async () => {
      await post('/api/solo/start', 'tokU', { minigame: 'consegne' });
      const big = await post('/api/solo/play', 'tokU', { inputs: [[sim.getMinigame('consegne').maxTicks + 5, 0, 0, 1, 0]] });
      assert(big.status === 400, 'troppi tick: ' + big.status);
      const storta = await post('/api/solo/play', 'tokU', { inputs: [[1, 99, 0, 1, 0]] });
      assert(storta.status === 400, 'riga storta: ' + storta.status);
      const st = await post('/api/solo/start', 'tokU', { minigame: 'consegne' });
      const m = sim.getMinigame('consegne'), s = m.create({ seed: st.body.seed, difficulty: st.body.difficulty }), rng = sim.createRng(2), frames = [sim.quantize(sim.startFrame(0))];
      m.step(s, frames[0]);
      while (!s.done) { const f = sim.quantize(s.consegnate < 3 ? m.autopilot(s, rng) : { mx: 0, my: 0, a: false, b: false }); frames.push(f); m.step(s, f); }
      const r = await post('/api/solo/play', 'tokU', { inputs: sim.packInputs(frames) });
      assert(r.status === 200 && r.body.medal === 'argento' && r.body.detail.consegne === 3, 'mezza partita: ' + JSON.stringify(r.body).slice(0, 300));
    });

    // ---------------- PC: Luca sul suo lotto ----------------
    const L = await ctx.B.openPage(ctx.browser, `${base}/?t=tokL&test=1`, { viewport: ctx.B.DESKTOP }); pages.push(L); ctx._pages.push(L);
    const page = L.page;
    await ctx.waitReady(page, 30000);
    await ctx.waitState(page, (s) => s.lot && s.lot.ready === true && s.minigiochi, 15000);
    const st = () => ctx.getState(page);
    const hook = (n, ...a) => page.evaluate(([n, a]) => window.__game.test[n](...a), [n, a]);

    await ctx.test('PC: Consegne e Ingorgo su ogni molo (Porto e lotti); nella bussola solo quelli del Porto', async () => {
      const s = await st(), ids = s.minigiochi.spots.map((x) => x.id);
      for (const id of ['consegne:porto', 'ingorgo:porto', 'consegne:lotto:0', 'ingorgo:lotto:0', 'consegne:lotto:7', 'ingorgo:lotto:7']) assert(ids.includes(id), `manca ${id}: ${ids.join(',')}`);
      assert(ids.indexOf('regata') === 0, 'la Regata deve restare il primo posto (guida)');
      const rows = await page.evaluate(() => [...document.querySelectorAll('#compass [data-id]')].map((r) => r.dataset.id));
      assert(rows.includes('consegne:porto') && rows.includes('ingorgo:porto'), 'bussola: ' + rows.join(','));
      assert(!rows.some((r) => /lotto:/.test(r ?? '')), 'nella bussola ci sono i posti dei lotti: ' + rows.join(','));
    });

    await ctx.test('PC: allo spawn e accanto alla barca del lotto A resta «sali in barca»; sul posto compare GIOCA · CONSEGNE', async () => {
      await hook('goto', 'lotto:0');
      for (const k of ['spawn', 'dock']) {
        await page.evaluate((k) => { const d = window.__game.state().island[k]; window.__game.test.teleport(d.x, d.z); }, k);
        await page.waitForTimeout(250);
        const near = (await st()).minigiochi.near;
        assert(!/^(consegne|ingorgo)/.test(near ?? ''), `al punto ${k} si è vicini a ${near}`);
      }
      const spot = (await st()).minigiochi.spots.find((x) => x.id === 'consegne:lotto:0');
      await hook('teleport', spot.x, spot.z);
      await ctx.waitState(page, (q) => q.minigiochi.near === 'consegne:lotto:0', 5000);
      await page.waitForSelector('#mzPlay.on', { timeout: 3000 });
      assert(/CONSEGNE/.test(await page.$eval('#mzPlay', (e) => e.textContent)), 'bottone senza CONSEGNE');
      await page.waitForTimeout(400);
    });
    await ctx.shot(page, 'pc_1_molo');

    await ctx.test('PC: GIOCA → in barca dal molo del lotto, conto alla rovescia con la meta, poi HUD, rotta a puntini e boa con la bandiera', async () => {
      await page.click('#mzPlay');
      await ctx.waitState(page, (q) => q.consegne?.active && q.consegne.phase === 'countdown', 15000);
      const s = await st();
      assert(s.mode === 'boat' && s.consegne.dest, 'non in barca o senza meta: ' + JSON.stringify(s.consegne));
      const lot0 = sim.consegneMoli().find((m) => m.id === 'lotto:0');
      assert(Math.hypot(s.consegne.boat.x - lot0.x, s.consegne.boat.z - lot0.z) < 1, 'la barca non parte dal molo del lotto 0');
      assert(/Pacco per/.test(await page.$eval('#mzConsegneBig', (e) => e.textContent)), 'conto alla rovescia senza meta');
      await ctx.shot(page, 'pc_2_via');
      await ctx.waitState(page, (q) => q.consegne.phase === 'race', 30000); // il conto alla rovescia su GitHub (2-4 fps) dura di più
      await hook('consegneAuto', 1);
      await page.waitForTimeout(3500);
      const q = await st();
      assert(q.consegne.dots > 4 && q.consegne.leftMs > 0, 'rotta/tempo: ' + JSON.stringify(q.consegne));
      assert(await page.$eval('#mzConsegne', (e) => e.classList.contains('on')), 'HUD spento');
    });
    await ctx.shot(page, 'pc_3_rotta');

    await ctx.test('PC: vicino al molo da raggiungere si vedono la boa con la bandiera e l\'etichetta CONSEGNA', async () => {
      await hook('consegneAuto', 2);
      await ctx.waitState(page, (q) => q.consegne.dest && Math.hypot(q.consegne.dest.x - q.consegne.boat.x, q.consegne.dest.z - q.consegne.boat.z) < 13, 40000);
      await hook('consegneAuto', 0);
      await page.waitForSelector('#mzConsegneTag.on', { timeout: 3000 });
      assert(/CONSEGNA/.test(await page.$eval('#mzConsegneTag', (e) => e.textContent)), 'etichetta della meta');
      const perf = await page.evaluate(() => window.__game.perf());
      ctx.log(`in consegna: ${perf.drawCalls} draw call, ${perf.triangles} triangoli`);
      assert(perf.drawCalls <= 100, 'draw call: ' + perf.drawCalls);
      await ctx.shot(page, 'pc_3b_arrivo');
    });

    await ctx.test('PC: l\'autopilota consegna tutti i pacchi, il server rigioca e paga l\'oro; si torna sul molo a piedi', async () => {
      const before = (await st()).lot.resources;
      await hook('consegneAuto', 20);
      await ctx.waitState(page, (q) => q.minigiochi.open === true, 90000);
      const s = await st(), r = s.minigiochi.last;
      ctx.log(`consegne: ${r.medal} ${r.score} · ${JSON.stringify(r.detail)}`);
      assert(r.medal === 'oro' && r.premiata && r.detail.consegne === 5, 'esito: ' + JSON.stringify(r));
      for (const k of ['legno', 'pietra', 'perle']) assert(r.lot.resources[k] === before[k] + balance.solo.premi.oro[k], k);
      assert(/5\/5 pacchi/.test(await page.locator('#mzEsito').innerText()), 'la scheda non dice 5/5 pacchi');
      assert(s.mode === 'walk' && !s.consegne.active, 'dopo la partita: ' + s.mode);
      await ctx.shot(page, 'pc_4_esito');
      await page.locator('#mzEsito [data-act="ok"]').click();
      assert(!(await page.$('#mzConsegne.on')), 'HUD rimasto acceso');
    });

    await ctx.test('PC: Ingorgo sul molo del lotto; Esc ritira', async () => {
      const spot = (await st()).minigiochi.spots.find((x) => x.id === 'ingorgo:lotto:0');
      await hook('teleport', spot.x, spot.z);
      await ctx.waitState(page, (q) => q.minigiochi.near === 'ingorgo:lotto:0', 5000);
      await page.click('#mzPlay');
      await page.waitForSelector('#mzIngorgo.on', { timeout: 15000 });
      await page.waitForTimeout(1200);
      await ctx.shot(page, 'pc_5_ingorgo');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      assert(!(await page.$('#mzIngorgo.on')) && !(await page.$('#mzEsito.on')), 'Esc non ritira');
    });
    await ctx.test('nessun pageerror per Luca', async () => { ctx.noErrors(L, 'Luca'); });

    // ---------------- telefono: Mia al Porto ----------------
    const M = await ctx.B.openPage(ctx.browser, `${base}/?t=tokM&test=1`, { viewport: ctx.B.IPHONE }); pages.push(M); ctx._pages.push(M);
    const ph = M.page;
    await ctx.waitReady(ph, 30000);
    await ctx.waitState(ph, (s) => s.lot && s.lot.ready === true && s.minigiochi, 15000);
    const pst = () => ctx.getState(ph);
    const phook = (n, ...a) => ph.evaluate(([n, a]) => window.__game.test[n](...a), [n, a]);

    await ctx.test('telefono: al Porto GIOCA · INGORGO apre la griglia 6×6, tutta nello schermo, celle ≥ 44 px', async () => {
      await phook('goto', 'porto');
      const spot = (await pst()).minigiochi.spots.find((x) => x.id === 'ingorgo:porto');
      await phook('teleport', spot.x, spot.z);
      await ctx.waitState(ph, (q) => q.minigiochi.near === 'ingorgo:porto', 5000);
      await ph.waitForTimeout(400);
      await ctx.shot(ph, 'tel_1_molo');
      await ph.tap('#mzPlay');
      await ph.waitForSelector('#mzIngorgo.on', { timeout: 15000 });
      await ctx.waitState(ph, (q) => q.ingorgo?.view && q.ingorgo.possibili.length > 0, 5000);
      await ph.waitForTimeout(900);
      const r = await ph.$eval('#mzIngorgo .mz-ig-water', (e) => { const b = e.getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; });
      assert(r[0] >= 0 && r[1] >= 0 && r[0] + r[2] <= 390 && r[1] + r[3] <= 844 && r[2] / 6 >= 44, 'griglia: ' + JSON.stringify(r));
      const box = await ph.$eval('#mzIngorgo .mz-ig-box', (e) => { const b = e.getBoundingClientRect(); return [b.top, b.bottom]; });
      assert(box[0] >= 0 && box[1] <= 844, 'la schermata esce dallo schermo: ' + JSON.stringify(box));
    });
    await ctx.shot(ph, 'tel_2_ingorgo');

    await ctx.test('telefono: una barca si trascina davvero lungo il suo verso (1 mossa); RICOMINCIA rimette tutto com\'era', async () => {
      const s = await pst(), m = s.ingorgo.possibili[0], b = s.ingorgo.view.barche[m.barca];
      const before = JSON.stringify(s.ingorgo.view.barche);
      const rect = await ph.$eval(`#mzIngorgo [data-barca="${m.barca}"]`, (e) => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
      const cell = (await ph.$eval('#mzIngorgo .mz-ig-water', (e) => e.getBoundingClientRect().width)) / 6;
      const [dx, dy] = b.h ? [m.delta * cell, 0] : [0, m.delta * cell];
      await ph.mouse.move(rect[0], rect[1]); await ph.mouse.down();
      for (let k = 1; k <= 8; k++) await ph.mouse.move(rect[0] + (dx * k) / 8, rect[1] + (dy * k) / 8);
      await ph.mouse.up();
      await ctx.waitState(ph, (q) => q.ingorgo.view.mosse === 1, 3000);
      const after = (await pst()).ingorgo.view.barche[m.barca];
      assert((b.h ? after.x - b.x : after.y - b.y) === m.delta, `spostata di ${JSON.stringify(after)} invece di ${m.delta}`);
      await ph.waitForTimeout(200);
      await ctx.shot(ph, 'tel_3_mossa');
      await ph.tap('#mzIngorgo [data-act="ricomincia"]');
      await ctx.waitState(ph, (q, b0) => JSON.stringify(q.ingorgo.view.barche) === b0 && q.ingorgo.view.mosse === 0, 3000, before);
    });

    await ctx.test('telefono: l\'autopilota risolve i tre ingorghi, il server premia l\'oro', async () => {
      await phook('ingorgoAuto', true);
      await ctx.waitState(ph, (q) => q.minigiochi.open === true, 60000);
      await phook('ingorgoAuto', false);
      const r = (await pst()).minigiochi.last;
      assert(r.medal === 'oro' && r.detail.risolti === 3 && r.premiata, 'esito: ' + JSON.stringify(r));
      assert(/3\/3 ingorghi/.test(await ph.locator('#mzEsito').innerText()), 'la scheda non dice 3/3 ingorghi');
      await ctx.shot(ph, 'tel_4_esito');
      await ph.tap('#mzEsito [data-act="ok"]');
    });

    await ctx.test('telefono: Consegne dal Porto, HUD leggibile; il ritiro torna sul molo senza premio', async () => {
      const spot = (await pst()).minigiochi.spots.find((x) => x.id === 'consegne:porto');
      await phook('teleport', spot.x, spot.z);
      await ctx.waitState(ph, (q) => q.minigiochi.near === 'consegne:porto', 5000);
      await ph.tap('#mzPlay');
      await ctx.waitState(ph, (q) => q.consegne?.phase === 'race', 20000);
      await phook('consegneAuto', 1);
      await ph.waitForTimeout(4000);
      const chips = await ph.$$eval('#mzConsegne .c', (es) => es.map((e) => { const r = e.getBoundingClientRect(); return [r.left, r.right, r.top, r.bottom]; }));
      assert(chips.length === 3 && chips.every(([l, r, t]) => l >= 0 && r <= 390 && t >= 0), 'chip fuori schermo: ' + JSON.stringify(chips));
      await ctx.shot(ph, 'tel_5_consegne');
      const played = (await pst()).minigiochi.played;
      await phook('consegneCancel');
      await ctx.waitState(ph, (q) => !q.consegne.active && q.mode === 'walk', 5000);
      await ph.waitForTimeout(300);
      const s = await pst();
      assert(!s.minigiochi.open && s.minigiochi.played === played, 'il ritiro non deve aprire l\'esito');
    });
    await ctx.test('nessun pageerror per Mia', async () => { ctx.noErrors(M, 'Mia'); });
  } finally {
    for (const p of pages) await p.close().catch(() => {});
    if (dev) { try { process.kill(-dev.pid, 'SIGTERM'); } catch { /* già finito */ } await sleep(500); try { process.kill(-dev.pid, 'SIGKILL'); } catch { /* ok */ } }
    fs.rmSync(persist, { recursive: true, force: true });
  }
}
