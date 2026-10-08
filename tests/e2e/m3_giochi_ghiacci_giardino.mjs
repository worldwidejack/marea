// Minigiochi delle isole a tema: Pinguini sul ghiaccio (Ghiacci, vicino agli igloo) e Carpe koi (Giardino, sul ponticello rosso).
// API (wrangler locale pulito): il server rigioca gli input dell'autopilota e paga l'oro di balance.solo più il premio extra del json;
// chi non tocca niente non prende medaglia; input oltre il tempo rifiutati. Browser: a isola chiusa il posto non c'è (né bottone né
// bussola), aperta con l'hook temiProva compare; telefono 390×844: Pinguini (regole, una mossa trascinando davvero un pinguino, metà
// partita, l'autopilota finisce e la scheda paga) e uno sguardo alle Carpe; PC: Carpe koi (tasto E, un tocco vero su un petalo, metà
// partita col ciliegio in fiore, oro pagato) e Pinguini con le frecce, Esc = ritirato. Screenshot in tests/out/shots/m3_giochi_ghiacci_giardino_*.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
export const timeout = 480000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function (ctx) {
  const { assert } = ctx;
  const SERVER = path.join(ctx.ROOT, 'apps/server');
  const persist = path.join(ctx.OUT, `m3giochi-${process.pid}`);
  const env = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' };
  const wr = (...a) => execFileSync('npx', ['--no-install', 'wrangler', ...a], { cwd: SERVER, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 90000 }).toString();
  const json = (f) => JSON.parse(fs.readFileSync(path.join(ctx.ROOT, 'packages/content/src', f), 'utf8'));
  const balance = json('balance.json');
  const oroDi = (cfg) => { const o = { ...balance.solo.premi.oro }; for (const [k, v] of Object.entries(cfg.premioExtra?.oro ?? {})) o[k] += v; return o; };
  const ORO = { pinguini: oroDi(json('minigames/pinguini.json')), koi: oroDi(json('minigames/koi.json')) };
  const pages = [];
  let w = null;
  try {
    fs.rmSync(persist, { recursive: true, force: true });
    wr('d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', persist);
    wr('d1', 'execute', 'DB', '--local', '--persist-to', persist, '--command',
      "INSERT INTO persone (id, nome, token, slot) VALUES ('luca', 'Luca', 'tokL', 0), ('mia', 'Mia', 'tokM', 1), ('ugo', 'Ugo', 'tokU', 2);");
    w = await ctx.startWrangler({ persistDir: persist, timeoutMs: 120000 });
    const base = w.url;
    const post = async (p, t, b) => { const r = await fetch(base + p, { method: 'POST', headers: { 'x-token': t, 'content-type': 'application/json' }, body: JSON.stringify(b ?? {}) }); return { status: r.status, body: await r.json() }; };
    const sim = await import(pathToFileURL(path.join(ctx.ROOT, 'packages/sim/src/index.ts')).href);
    const autoplay = (id, seed, difficulty) => {
      const m = sim.getMinigame(id), s = m.create({ seed, difficulty }), rng = sim.createRng(1), frames = [];
      for (let i = 0; i < m.maxTicks && !m.result(s).done; i++) { const f = sim.quantize(m.autopilot(s, rng)); frames.push(f); m.step(s, f); }
      return { frames, r: m.result(s) };
    };

    for (const id of ['pinguini', 'koi']) {
      await ctx.test(`API ${id}: il server rigioca gli input dell'autopilota e paga l'oro col premio extra`, async () => {
        const st = await post('/api/solo/start', 'tokU', { minigame: id });
        assert(st.status === 200 && st.body.minigame === id && Number.isInteger(st.body.seed), `start ${id}: ${st.status} ${JSON.stringify(st.body).slice(0, 300)}`);
        const { frames, r: local } = autoplay(id, st.body.seed, st.body.difficulty);
        const r = await post('/api/solo/play', 'tokU', { inputs: sim.packInputs(frames) });
        assert(r.status === 200 && r.body.medal === 'oro' && r.body.score === local.score, `play ${id}: ${r.status} ${JSON.stringify(r.body).slice(0, 300)} (locale ${local.score})`);
        assert(r.body.premiata && JSON.stringify(r.body.premio) === JSON.stringify(ORO[id]), `premio ${id}: ${JSON.stringify(r.body.premio)} invece di ${JSON.stringify(ORO[id])}`);
        ctx.log(`API ${id} oro: ${r.body.score} punti · ${JSON.stringify(r.body.detail)} · premio ${JSON.stringify(r.body.premio)}`);
      });
      await ctx.test(`API ${id}: senza toccare niente niente medaglia (consolazione); input oltre il tempo rifiutati`, async () => {
        const m = sim.getMinigame(id);
        await post('/api/solo/start', 'tokU', { minigame: id });
        const r = await post('/api/solo/play', 'tokU', { inputs: [[m.maxTicks, 0, 0, 0, 0]] });
        assert(r.status === 200 && r.body.medal === null && r.body.score === 0, `fermo: ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
        assert(JSON.stringify(r.body.premio) === JSON.stringify(balance.solo.premi.nessuna), 'consolazione: ' + JSON.stringify(r.body.premio));
        await post('/api/solo/start', 'tokU', { minigame: id });
        const troppo = await post('/api/solo/play', 'tokU', { inputs: [[m.maxTicks + 1, 0, 0, 1, 0]] });
        assert(troppo.status === 400, `input oltre il tempo: ${troppo.status}`);
      });
    }

    // ---------- telefono: Pinguini (partita intera), uno sguardo alle Carpe ----------
    const T = await ctx.B.openPage(ctx.browser, `${base}/?t=tokL&test=1`, { viewport: ctx.B.IPHONE }); pages.push(T); ctx._pages.push(T);
    const page = T.page;
    await ctx.waitReady(page, 40000);
    await ctx.waitState(page, (s) => s.lot && s.lot.ready === true && s.temi && s.minigiochi, 40000);
    const st = () => ctx.getState(page);
    const hook = (p, n, ...a) => p.evaluate(([n, a]) => window.__game.test[n](...a), [n, a]);
    const spotDi = async (p, id) => (await ctx.getState(p)).minigiochi.spots.find((s) => s.id === id);

    await ctx.test('a isola chiusa il posto dei Pinguini non c\'è: niente bottone, niente bussola', async () => {
      const sp = await spotDi(page, 'pinguini:ghiacci');
      assert(sp && sp.minigame === 'pinguini', 'posto dei Pinguini: ' + JSON.stringify(sp));
      assert(await spotDi(page, 'koi:giardino'), 'posto delle Carpe mancante');
      await hook(page, 'temiProva', null);
      await hook(page, 'teleport', sp.x, sp.z);
      await sleep(1500);
      const s = await st();
      assert(!s.temi.isole.find((i) => i.id === 'ghiacci').aperta, 'Ghiacci aperta di serie');
      assert(s.minigiochi.near !== sp.id, 'vicino al posto con l\'isola chiusa');
      assert(!(await page.locator('#mzPlay.on').count()), 'GIOCA acceso con l\'isola chiusa');
      assert(!s.compass.shown.includes(sp.id), 'Pinguini in bussola con l\'isola chiusa');
    });

    await ctx.test('isola aperta (personaggio al livello 3): compaiono GIOCA · PINGUINI e la meta in bussola', async () => {
      await hook(page, 'temiProva', { livello: 3 });
      const sp = await spotDi(page, 'pinguini:ghiacci');
      await hook(page, 'teleport', sp.x, sp.z);
      await ctx.waitState(page, (s) => s.minigiochi.near === 'pinguini:ghiacci', 15000);
      await page.waitForSelector('#mzPlay.on', { timeout: 5000 });
      assert(/PINGUINI/.test(await page.locator('#mzPlay').innerText()), 'testo del bottone');
      assert((await st()).compass.shown.includes(sp.id), 'Pinguini non in bussola a isola aperta');
      await hook(page, 'setZoom', 1.3);
      await sleep(1500);
      await ctx.shot(page, 'iphone_1_igloo');
    });

    await ctx.test('Pinguini: si apre dentro il telefono; trascinando un pinguino scivola davvero', async () => {
      await page.locator('#mzPlay').click();
      await ctx.waitState(page, (s) => s.pinguini && s.pinguini.open, 20000);
      await sleep(200);
      await ctx.shot(page, 'iphone_2_pinguini');
      const box = await page.locator('#mzPinguini .mz-pg-box').boundingBox();
      assert(box && box.x >= 0 && box.x + box.width <= 390 && box.y >= 0 && box.y + box.height <= 844, 'la schermata esce dal telefono: ' + JSON.stringify(box));
      await ctx.waitState(page, (s) => s.pinguini.intro === 0 && s.pinguini.view, 5000);
      let mosso = false;
      for (let dir = 0; dir < 4 && !mosso; dir++) {
        const s = (await st()).pinguini, c = s.cella, cell = s.view.pos[0];
        const x = c.x0 + ((cell % c.n) + 0.5) * c.lato, y = c.y0 + (Math.floor(cell / c.n) + 0.5) * c.lato - c.lato * 0.15;
        const [dx, dy] = [[0, -1], [1, 0], [0, 1], [-1, 0]][dir];
        await page.mouse.move(x, y); await page.mouse.down();
        for (let k = 1; k <= 5; k++) await page.mouse.move(x + dx * c.lato * 0.2 * k, y + dy * c.lato * 0.2 * k);
        await page.mouse.up();
        await sleep(500);
        mosso = (await st()).pinguini.view.mosse > 0 || (await st()).pinguini.view.idx > 0;
      }
      assert(mosso, 'trascinare un pinguino non lo muove');
      assert(await hook(page, 'pinguiniFinoA', 330), 'pinguiniFinoA');
      await sleep(250);
      await ctx.shot(page, 'iphone_3_partita');
    });

    await ctx.test('Pinguini: l\'autopilota finisce, il server rigioca e paga l\'oro (con la Pietra in più)', async () => {
      const before = (await st()).lot.resources;
      await hook(page, 'pinguiniAuto', true);
      await ctx.waitState(page, (s) => s.minigiochi.open === true, 120000);
      const r = (await st()).minigiochi.last;
      ctx.log(`pinguini esito ${r.medal} ${r.score} · ${JSON.stringify(r.detail)}`);
      assert(r.medal === 'oro' && r.premiata && JSON.stringify(r.premio) === JSON.stringify(ORO.pinguini), 'esito: ' + JSON.stringify(r));
      for (const k of ['legno', 'pietra', 'perle']) assert(r.lot.resources[k] >= before[k] + r.premio[k], `${k} non pagato`);
      const txt = await page.locator('#mzEsito').innerText();
      assert(/ORO/.test(txt) && /3\/3 livelli/.test(txt), 'scheda: ' + txt);
      await sleep(300);
      await ctx.shot(page, 'iphone_4_esito');
      await hook(page, 'pinguiniAuto', false);
      await page.locator('#mzEsito [data-act="ok"]').click();
      await ctx.waitState(page, (s) => !s.minigiochi.open, 5000);
    });

    await ctx.test('Carpe koi sul telefono: il ponticello, le regole, lo stagno a metà partita', async () => {
      await hook(page, 'temiProva', 'tutte');
      const sp = await spotDi(page, 'koi:giardino');
      await hook(page, 'teleport', sp.x, sp.z);
      await ctx.waitState(page, (s) => s.minigiochi.near === 'koi:giardino', 15000);
      await hook(page, 'setZoom', 1.3);
      await sleep(1500);
      await ctx.shot(page, 'iphone_5_ponticello');
      await page.locator('#mzPlay').click();
      await ctx.waitState(page, (s) => s.koi && s.koi.open && s.koi.intro, 20000);
      await sleep(200);
      await ctx.shot(page, 'iphone_6_koi_regole');
      const box = await page.locator('#mzKoi .mz-koi-box').boundingBox();
      assert(box && box.x >= 0 && box.x + box.width <= 390 && box.y >= 0 && box.y + box.height <= 844, 'la schermata esce dal telefono: ' + JSON.stringify(box));
      assert(await hook(page, 'koiFinoA', 1700), 'koiFinoA');
      await sleep(250);
      await ctx.shot(page, 'iphone_7_koi_stagno');
      await page.locator('#mzKoi .mz-x').click();
      await ctx.waitState(page, (s) => !s.koi.open && !s.minigiochi.open, 8000);
      ctx.noErrors(T, 'telefono');
    });

    // ---------- PC: Carpe koi (partita intera), Pinguini con le frecce ----------
    const D = await ctx.B.openPage(ctx.browser, `${base}/?t=tokM&test=1`, { viewport: ctx.B.DESKTOP }); pages.push(D); ctx._pages.push(D);
    const dp = D.page;
    await ctx.waitReady(dp, 40000);
    await ctx.waitState(dp, (s) => s.lot && s.lot.ready === true && s.temi && s.minigiochi, 60000); // col mondo grande SwiftShader è lento
    const dst = () => ctx.getState(dp);

    await ctx.test('PC: Giardino chiuso niente Carpe; aperto (mappa) il tasto E apre lo stagno', async () => {
      const sp = await spotDi(dp, 'koi:giardino');
      await hook(dp, 'temiProva', null);
      await hook(dp, 'teleport', sp.x, sp.z);
      await sleep(1500);
      assert((await dst()).minigiochi.near !== sp.id, 'Carpe col Giardino chiuso');
      await hook(dp, 'temiProva', { mappe: ['giardino'] });
      await ctx.waitState(dp, (s) => s.minigiochi.near === 'koi:giardino', 15000);
      assert((await dst()).compass.shown.includes(sp.id), 'Carpe non in bussola a isola aperta');
      await sleep(800);
      await ctx.shot(dp, 'desktop_1_ponticello');
      await dp.keyboard.press('KeyE');
      await ctx.waitState(dp, (s) => s.koi && s.koi.open && s.koi.intro, 20000);
      await sleep(200);
      await ctx.shot(dp, 'desktop_2_koi_regole');
    });

    await ctx.test('PC: un clic su un petalo chiama una carpa; a metà partita il ciliegio fiorisce', async () => {
      await dp.keyboard.press('Space'); // via
      await ctx.waitState(dp, (s) => !s.koi.intro && s.koi.view.cibo.some((c) => c.stato === 1), 15000);
      const s = (await dst()).koi, c = s.view.cibo.find((x) => x.stato === 1);
      await dp.mouse.click(s.stagno.x0 + c.x * s.stagno.k, s.stagno.y0 + c.y * s.stagno.k);
      await ctx.waitState(dp, (s) => s.koi.view.tocco === 'cibo' || s.koi.view.tocco === 'nera', 3000);
      await ctx.waitState(dp, (s) => s.koi.view.mangiati + s.koi.view.rubati >= 1, 10000);
      assert(await hook(dp, 'koiFinoA', 2200), 'koiFinoA');
      await sleep(250);
      await ctx.shot(dp, 'desktop_3_koi_fiori');
      const v = (await dst()).koi.view;
      assert(v.punti > 0 && v.mangiati > 5, 'a metà partita: ' + JSON.stringify(v).slice(0, 300));
    });

    await ctx.test('PC: l\'autopilota finisce le Carpe, il server rigioca e paga l\'oro (col Legno in più)', async () => {
      await hook(dp, 'koiAuto', true);
      await ctx.waitState(dp, (s) => s.minigiochi.open === true, 120000);
      const r = (await dst()).minigiochi.last;
      ctx.log(`koi esito ${r.medal} ${r.score} · ${JSON.stringify(r.detail)}`);
      assert(r.medal === 'oro' && r.premiata && JSON.stringify(r.premio) === JSON.stringify(ORO.koi), 'esito: ' + JSON.stringify(r));
      const txt = await dp.locator('#mzEsito').innerText();
      assert(/ORO/.test(txt) && /bocconi/.test(txt), 'scheda: ' + txt);
      await sleep(300);
      await ctx.shot(dp, 'desktop_4_koi_esito');
      await hook(dp, 'koiAuto', false);
      await dp.keyboard.press('Enter');
      await ctx.waitState(dp, (s) => !s.minigiochi.open, 5000);
    });

    await ctx.test('PC: Pinguini con le frecce (E apre, frecce muovono, Esc = ritirato)', async () => {
      await hook(dp, 'temiProva', 'tutte');
      const sp = await spotDi(dp, 'pinguini:ghiacci');
      await hook(dp, 'teleport', sp.x, sp.z);
      await ctx.waitState(dp, (s) => s.minigiochi.near === 'pinguini:ghiacci', 15000);
      await sleep(800);
      await ctx.shot(dp, 'desktop_5_igloo');
      await dp.keyboard.press('KeyE');
      await ctx.waitState(dp, (s) => s.pinguini && s.pinguini.open && s.pinguini.intro === 0, 20000);
      for (const k of ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft']) {
        if ((await dst()).pinguini.view.mosse > 0) break;
        await dp.keyboard.press(k); await sleep(400);
      }
      assert((await dst()).pinguini.view.mosse > 0, 'le frecce non muovono il pinguino');
      assert(await hook(dp, 'pinguiniFinoA', 520), 'pinguiniFinoA');
      await sleep(250);
      await ctx.shot(dp, 'desktop_6_pinguini');
      await dp.keyboard.press('Escape');
      await ctx.waitState(dp, (s) => !s.pinguini.open && !s.minigiochi.open, 8000);
      ctx.noErrors(D, 'PC');
    });
  } finally {
    for (const p of pages) await p.close().catch(() => {});
    if (w) await w.close().catch(() => {});
    fs.rmSync(persist, { recursive: true, force: true });
  }
}
