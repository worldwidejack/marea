// Minigiochi delle isole a tema: Arrembaggio (Isola della Tempesta, sul promontorio del faro) e Fuga dalla lava (Isola Vulcano, vicino al
// cratere). API (wrangler locale pulito): il server rigioca gli input dell'autopilota e paga l'oro di balance.solo più il premio extra del
// gioco; chi non gioca non prende medaglia; input oltre 60 s rifiutati. Browser (telefono 390×844): a isole chiuse i posti non sono nella
// bussola e lì non compare GIOCA; aperte (hook temiProva) compaiono; si apre la schermata (regole, un colpo / un salto tenendo premuto,
// metà partita), l'autopilota finisce e la scheda dà il premio. PC: E al posto, Spazio, schermata grande, Esc = ritirato.
// Screenshot in tests/out/shots/m3_giochi_tempesta_vulcano_*.
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
export const timeout = 480000;

const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const GIOCHI = [
  { id: 'arrembaggio', spot: 'arrembaggio:tempesta', dom: '#mzArrembaggio', btn: '#mzArrembaggioFuoco', nome: 'ARREMBAGGIO' },
  { id: 'lava', spot: 'lava:vulcano', dom: '#mzLava', btn: '#mzLavaSalta', nome: 'FUGA DALLA LAVA' },
];

export default async function (ctx) {
  const { assert } = ctx;
  const SERVER = path.join(ctx.ROOT, 'apps/server');
  const persist = path.join(ctx.OUT, `m3isole-giochi-${process.pid}`);
  const env = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' };
  const wr = (...a) => execFileSync('npx', ['--no-install', 'wrangler', ...a], { cwd: SERVER, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 }).toString();
  const balance = JSON.parse(fs.readFileSync(path.join(ctx.ROOT, 'packages/content/src/balance.json'), 'utf8'));
  const oroDi = (id) => {
    const cfg = JSON.parse(fs.readFileSync(path.join(ctx.ROOT, `packages/content/src/minigames/${id}.json`), 'utf8'));
    const oro = { ...balance.solo.premi.oro };
    for (const [k, v] of Object.entries(cfg.premioExtra?.oro ?? {})) oro[k] += v;
    return oro;
  };
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
    const autoplay = (id, seed, difficulty) => {
      const m = sim.getMinigame(id), s = m.create({ seed, difficulty }), rng = sim.createRng(1), frames = [];
      for (let i = 0; i < m.maxTicks && !m.result(s).done; i++) { const f = sim.quantize(m.autopilot(s, rng)); frames.push(f); m.step(s, f); }
      return { frames, r: m.result(s) };
    };

    for (const g of GIOCHI) {
      await ctx.test(`API ${g.id}: il server rigioca gli input dell'autopilota e paga l'oro col premio extra`, async () => {
        const st = await post('/api/solo/start', 'tokU', { minigame: g.id });
        assert(st.status === 200 && st.body.minigame === g.id && Number.isInteger(st.body.seed) && st.body.lot?.solo?.pending?.minigame === g.id,
          `start ${g.id}: ${st.status} ${JSON.stringify(st.body).slice(0, 300)}`);
        const { frames, r: local } = autoplay(g.id, st.body.seed, st.body.difficulty);
        const r = await post('/api/solo/play', 'tokU', { inputs: sim.packInputs(frames) });
        assert(r.status === 200 && r.body.medal === 'oro' && r.body.score === local.score, `play ${g.id}: ${r.status} ${JSON.stringify(r.body).slice(0, 300)} (locale ${local.score})`);
        const oro = oroDi(g.id);
        assert(r.body.premiata && JSON.stringify(r.body.premio) === JSON.stringify(oro), `premio: ${JSON.stringify(r.body.premio)} invece di ${JSON.stringify(oro)}`);
        ctx.log(`API ${g.id} oro: ${r.body.score}/${r.body.detail.totale} punti, ${JSON.stringify(r.body.detail)}, premio ${JSON.stringify(r.body.premio)}`);
      });
      await ctx.test(`API ${g.id}: chi non gioca non prende medaglia (consolazione), input oltre 60 s rifiutati`, async () => {
        await post('/api/solo/start', 'tokU', { minigame: g.id });
        const r = await post('/api/solo/play', 'tokU', { inputs: [[3600, 0, 0, 0, 0]] });
        assert(r.status === 200 && r.body.medal === null, `fermo: ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
        assert(JSON.stringify(r.body.premio) === JSON.stringify(balance.solo.premi.nessuna), 'consolazione: ' + JSON.stringify(r.body.premio));
        await post('/api/solo/start', 'tokU', { minigame: g.id });
        const troppo = await post('/api/solo/play', 'tokU', { inputs: [[3601, 0, 0, 1, 0]] });
        assert(troppo.status === 400, `input oltre 60 s: ${troppo.status}`);
      });
    }

    // ---------- telefono ----------
    const T = await ctx.B.openPage(ctx.browser, `${base}/?t=tokL&test=1`, { viewport: ctx.B.IPHONE }); pages.push(T); ctx._pages.push(T);
    const page = T.page;
    await ctx.waitReady(page, 40000);
    await ctx.waitState(page, (s) => s.lot && s.lot.ready === true && s.temi && s.compass, 40000); // col mondo grande SwiftShader è lento
    const st = () => ctx.getState(page);
    const hook = (n, ...a) => page.evaluate(([n, a]) => window.__game.test[n](...a), [n, a]);

    await ctx.test('isole chiuse: i posti non sono nella bussola, il cartello non c\'è e lì GIOCA non compare', async () => {
      await hook('temiProva', null); // il viaggiatore vero: Molo L1, niente Lanterna
      await sleep(400);
      const s = await st();
      for (const g of GIOCHI) {
        assert(s.minigiochi.spots.some((x) => x.id === g.spot), `${g.spot} non c'è`);
        assert(!s.compass.shown.includes(g.spot), `${g.spot} nella bussola da chiusa`);
      }
      const v = await hook('spotVai', 'arrembaggio:tempesta');
      assert(v && v.aperta === false, 'spotVai: ' + JSON.stringify(v));
      await sleep(1200);
      const n = (await st()).minigiochi.near;
      assert(n !== 'arrembaggio:tempesta' && !(await page.locator('#mzPlay.on').count()), 'GIOCA a isola chiusa: ' + n);
    });

    await ctx.test('isole aperte: i posti entrano nella bussola', async () => {
      await hook('temiProva', 'tutte');
      await ctx.waitState(page, (s) => ['arrembaggio:tempesta', 'lava:vulcano'].every((id) => s.compass.shown.includes(id)), 5000);
    });

    for (const g of GIOCHI) {
      await ctx.test(`${g.id}: al posto compare GIOCA, si apre la schermata (dentro il telefono), un ${g.id === 'lava' ? 'salto' : 'colpo'} tenendo premuto, metà partita`, async () => {
        await hook('spotVai', g.spot);
        await ctx.waitState(page, (s, id) => s.minigiochi.near === id, 20000, g.spot);
        await hook('setZoom', 1.2);
        await sleep(1500);
        assert(new RegExp(g.nome).test(await page.locator('#mzPlay').innerText()), 'testo del bottone');
        await ctx.shot(page, `iphone_${g.id}_1_posto`);
        await page.locator('#mzPlay').click();
        await ctx.waitState(page, (s, id) => s[id] && s[id].open && s[id].intro, 20000, g.id);
        await sleep(300);
        await ctx.shot(page, `iphone_${g.id}_2_regole`);
        const box = await page.locator(`${g.dom} .mz-gp-box`).boundingBox();
        assert(box && box.x >= 0 && box.x + box.width <= 390 && box.y >= 0 && box.y + box.height <= 844, 'la schermata esce dal telefono: ' + JSON.stringify(box));
        const b = await page.locator(g.btn).boundingBox();
        await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
        await page.mouse.down();
        if (g.id === 'arrembaggio') {
          await ctx.waitState(page, (s) => !s.arrembaggio.intro && s.arrembaggio.view.carica > 20, 5000);
          await sleep(150);
          await ctx.shot(page, `iphone_${g.id}_3_carica`);
          await page.mouse.up();
          await ctx.waitState(page, (s) => s.arrembaggio.view.spari === 1, 3000);
        } else {
          await ctx.waitState(page, (s) => !s.lava.intro && s.lava.view.salti >= 1 && !s.lava.view.terra, 5000);
          await sleep(120);
          await ctx.shot(page, `iphone_${g.id}_3_salto`);
          await page.mouse.up();
        }
        assert(await hook(g.id + 'FinoA', 1500), 'FinoA');
        if (g.id === 'arrembaggio') await hook(g.id + 'FinoA', 1680, true); // 3 s senza sparare: entrano navi nuove (il pilota le affonda appena si vedono)
        await sleep(100);
        await ctx.shot(page, `iphone_${g.id}_4_meta`);
        const v = (await st())[g.id].view;
        assert(v.punti > 0, 'a metà partita niente punti: ' + JSON.stringify(v));
      });

      await ctx.test(`${g.id}: l'autopilota finisce la partita, il server rigioca e paga l'oro col premio extra; la scheda dice cosa hai fatto`, async () => {
        const before = (await st()).lot.resources;
        await hook(g.id + 'Auto', true);
        await ctx.waitState(page, (s) => s.minigiochi.open === true, 120000);
        const s = await st(), r = s.minigiochi.last;
        ctx.log(`esito ${g.id} ${r.medal} ${r.score} · ${JSON.stringify(r.detail)}`);
        const oro = oroDi(g.id);
        assert(r.medal === 'oro' && r.premiata && JSON.stringify(r.premio) === JSON.stringify(oro), 'esito: ' + JSON.stringify(r));
        for (const k of ['legno', 'pietra', 'perle']) assert(r.lot.resources[k] >= before[k] + r.premio[k], `${k} non pagato`);
        const txt = await page.locator('#mzEsito').innerText();
        assert(/ORO/.test(txt) && /\d+ punti/.test(txt) && (g.id === 'lava' ? /pezzi/.test(txt) : /navi affondate/.test(txt)), 'scheda: ' + txt);
        await sleep(300);
        await ctx.shot(page, `iphone_${g.id}_5_esito`);
        await hook(g.id + 'Auto', false);
        await page.locator('#mzEsito [data-act="ok"]').click();
        await ctx.waitState(page, (s) => !s.minigiochi.open, 5000);
      });
    }
    ctx.noErrors(T, 'telefono');

    // ---------- PC ----------
    const D = await ctx.B.openPage(ctx.browser, `${base}/?t=tokM&test=1`, { viewport: ctx.B.DESKTOP }); pages.push(D); ctx._pages.push(D);
    const dp = D.page;
    await ctx.waitReady(dp, 40000);
    await ctx.waitState(dp, (s) => s.lot && s.lot.ready === true && s.temi, 40000);
    const dhook = (n, ...a) => dp.evaluate(([n, a]) => window.__game.test[n](...a), [n, a]);
    await dhook('temiProva', 'tutte');

    for (const g of GIOCHI) {
      await ctx.test(`PC ${g.id}: E al posto apre la schermata; Spazio tenuto gioca; Esc = ritirato`, async () => {
        await dhook('spotVai', g.spot);
        await ctx.waitState(dp, (s, id) => s.minigiochi.near === id, 20000, g.spot);
        await sleep(1200);
        await ctx.shot(dp, `desktop_${g.id}_1_posto`);
        await dp.keyboard.press('KeyE');
        await ctx.waitState(dp, (s, id) => s[id] && s[id].open && s[id].intro, 20000, g.id);
        await dp.keyboard.down('Space');
        await ctx.waitState(dp, (s, id) => !s[id].intro && s[id].view.tick > 20, 5000, g.id);
        await dp.keyboard.up('Space');
        assert(await dhook(g.id + 'FinoA', 2400), 'FinoA');
        if (g.id === 'arrembaggio') await dhook(g.id + 'FinoA', 2580, true);
        await sleep(100);
        await ctx.shot(dp, `desktop_${g.id}_2_partita`);
        await dp.keyboard.press('Escape');
        await ctx.waitState(dp, (s, id) => !s[id].open && !s.minigiochi.open, 5000, g.id);
        assert((await ctx.getState(dp)).mode === 'walk', 'dopo il ritiro si resta a piedi');
      });
    }
    ctx.noErrors(D, 'PC');
  } finally {
    for (const p of pages) await p.close().catch(() => {});
    if (dev) { try { process.kill(-dev.pid, 'SIGTERM'); } catch { /* già finito */ } await sleep(500); try { process.kill(-dev.pid, 'SIGKILL'); } catch { /* ok */ } }
    fs.rmSync(persist, { recursive: true, force: true });
  }
}
