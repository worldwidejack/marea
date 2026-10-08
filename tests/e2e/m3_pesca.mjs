// Pesca dalla barca (#66), il primo minigioco universale. Server locale pulito (wrangler, D1 e DO in una cartella privata).
// API: start con il mare (normalizzato dal server: sconosciuto → mare aperto), il server rigioca gli input dell'autopilota col mare
// della partita e paga l'oro (balance.solo). Browser (telefono 390×844): a piedi niente PESCA; in barca ferma in mare aperto compare,
// si apre la schermata (cartello delle regole, lancio, attesa, abbocca, recupero, pesce preso), l'autopilota finisce, la scheda dà il premio.
// PC: tasto P nelle acque del Porto, schermata grande, Esc = ritirato. Screenshot in tests/out/shots/m3_pesca_*.
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
export const timeout = 360000;

const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function (ctx) {
  const { assert } = ctx;
  const SERVER = path.join(ctx.ROOT, 'apps/server');
  const persist = path.join(ctx.OUT, `m3pesca-${process.pid}`);
  const env = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' };
  const wr = (...a) => execFileSync('npx', ['--no-install', 'wrangler', ...a], { cwd: SERVER, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 }).toString();
  const balance = JSON.parse(fs.readFileSync(path.join(ctx.ROOT, 'packages/content/src/balance.json'), 'utf8'));
  const cfg = JSON.parse(fs.readFileSync(path.join(ctx.ROOT, 'packages/content/src/minigames/pesca.json'), 'utf8'));
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
    const autoplay = (seed, difficulty, opzioni) => {
      const m = sim.getMinigame('pesca'), s = m.create({ seed, difficulty, opzioni }), rng = sim.createRng(1), frames = [];
      for (let i = 0; i < m.maxTicks && !m.result(s).done; i++) { const f = sim.quantize(m.autopilot(s, rng)); frames.push(f); m.step(s, f); }
      return { frames, r: m.result(s) };
    };

    await ctx.test('API: start col mare (sconosciuto → mare aperto), il server rigioca col mare della partita e paga l\'oro', async () => {
      const x = await post('/api/solo/start', 'tokU', { minigame: 'pesca', opzioni: { mare: 'atlantide' } });
      assert(x.status === 200 && x.body.opzioni?.mare === cfg.mareDiSerie, `mare sconosciuto: ${x.status} ${JSON.stringify(x.body.opzioni)}`);
      const st = await post('/api/solo/start', 'tokU', { minigame: 'pesca', opzioni: { mare: 'porto' } });
      assert(st.status === 200 && st.body.minigame === 'pesca' && st.body.opzioni?.mare === 'porto' && st.body.lot?.solo?.pending?.opzioni?.mare === 'porto',
        `start pesca: ${st.status} ${JSON.stringify(st.body).slice(0, 300)}`);
      const { frames, r: local } = autoplay(st.body.seed, st.body.difficulty, { mare: 'porto' });
      const r = await post('/api/solo/play', 'tokU', { inputs: sim.packInputs(frames) });
      assert(r.status === 200 && r.body.medal === 'oro' && r.body.score === local.score, `play pesca: ${r.status} ${JSON.stringify(r.body).slice(0, 300)} (locale ${local.score})`);
      assert(r.body.detail.mare === Object.keys(cfg.mari).indexOf('porto') && r.body.detail.pesci >= 6, 'detail: ' + JSON.stringify(r.body.detail));
      assert(r.body.premiata && JSON.stringify(r.body.premio) === JSON.stringify(balance.solo.premi.oro), 'premio: ' + JSON.stringify(r.body.premio));
      ctx.log(`API oro: ${r.body.score} punti, ${r.body.detail.pesci} pesci`);
    });

    await ctx.test('API: tocchi a raffica = niente medaglia; senza opzioni = mare di serie; input oltre 60 s rifiutati', async () => {
      const st = await post('/api/solo/start', 'tokU', { minigame: 'pesca', opzioni: { mare: 'laguna' } });
      const raffica = Array.from({ length: 3600 }, (_, i) => ({ mx: 0, my: 0, a: i % 2 === 0, b: false }));
      const r = await post('/api/solo/play', 'tokU', { inputs: sim.packInputs(raffica) });
      assert(r.status === 200 && r.body.medal === null && r.body.score <= 1, `raffica: ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
      const lungo = await post('/api/solo/start', 'tokU', { minigame: 'pesca' });
      assert(lungo.body.opzioni?.mare === cfg.mareDiSerie, 'senza opzioni = mare di serie');
      const troppo = await post('/api/solo/play', 'tokU', { inputs: [[3601, 0, 0, 0, 0]] });
      assert(troppo.status === 400, `input oltre 60 s: ${troppo.status}`);
      void st;
    });

    // ---------- telefono ----------
    const T = await ctx.B.openPage(ctx.browser, `${base}/?t=tokL&test=1`, { viewport: ctx.B.IPHONE }); pages.push(T); ctx._pages.push(T);
    const page = T.page;
    await ctx.waitReady(page, 30000);
    await ctx.waitState(page, (s) => s.lot && s.lot.ready === true && s.pescaPosto, 15000);
    const st = () => ctx.getState(page);
    const hook = (n, ...a) => page.evaluate(([n, a]) => window.__game.test[n](...a), [n, a]);

    await ctx.test('a piedi niente PESCA; il tasto P lo spiega', async () => {
      await sleep(300);
      const s = await st();
      assert(s.pescaPosto.ok === false && s.pescaPosto.bottone === false, 'a piedi: ' + JSON.stringify(s.pescaPosto));
      assert(!(await page.locator('#mzPesca.on').count()), 'bottone acceso a piedi');
    });

    await ctx.test('in barca ferma in mare aperto compare PESCA (con il nome del mare)', async () => {
      await hook('setMode', 'boat');
      const p = await hook('pescaVai', 'largo');
      assert(p, 'nessun punto da pesca in mare aperto');
      await ctx.waitState(page, (s) => s.pescaPosto.ok && s.pescaPosto.bottone && s.pescaPosto.mare === 'largo', 5000);
      assert(/PESCA/.test(await page.locator('#mzPesca').innerText()), 'testo del bottone');
      await sleep(400);
      await ctx.shot(page, 'iphone_1_bottone');
    });

    await ctx.test('PESCA apre la schermata: cartello delle regole, poi lancio, attesa, abbocca, recupero, pesce preso', async () => {
      await page.locator('#mzPesca').click();
      await ctx.waitState(page, (s) => s.pesca && s.pesca.open && s.pesca.intro, 15000);
      await sleep(300);
      await ctx.shot(page, 'iphone_2_regole');
      const box = await page.locator('#mzPescaGioco .mz-pe-box').boundingBox();
      assert(box && box.x >= 0 && box.x + box.width <= 390 && box.y >= 0 && box.y + box.height <= 844, 'la schermata esce dal telefono: ' + JSON.stringify(box));
      await page.locator('#mzPescaTocca').click(); // il primo tocco toglie il cartello e lancia
      await ctx.waitState(page, (s) => !s.pesca.intro && s.pesca.view && s.pesca.view.fase !== 'pronto', 3000);
      await sleep(200);
      for (const f of ['attesa', 'abbocca', 'recupero', 'preso']) {
        assert(await hook('pescaFinoA', f), `fase ${f} mai raggiunta`);
        await sleep(f === 'preso' ? 250 : 120);
        await ctx.shot(page, `iphone_3_${f}`);
      }
      const s = await st();
      assert(s.pesca.view.presi.length >= 1 && s.pesca.view.punti >= 1, 'nessun pesce preso: ' + JSON.stringify(s.pesca.view));
    });

    await ctx.test('l\'autopilota finisce la partita, il server rigioca e paga l\'oro; la scheda mostra pesci, punti e mare', async () => {
      const before = (await st()).lot.resources;
      await hook('pescaAuto', true);
      await ctx.waitState(page, (s) => s.minigiochi.open === true, 60000);
      const s = await st(), r = s.minigiochi.last;
      ctx.log(`esito ${r.medal} ${r.score} · ${JSON.stringify(r.detail)}`);
      assert(r.medal === 'oro' && r.premiata && JSON.stringify(r.premio) === JSON.stringify(balance.solo.premi.oro), 'esito: ' + JSON.stringify(r));
      for (const k of ['legno', 'pietra', 'perle']) assert(r.lot.resources[k] >= before[k] + r.premio[k], `${k} non pagato`);
      const txt = await page.locator('#mzEsito').innerText();
      assert(/ORO/.test(txt) && /pesci/.test(txt) && /Mare aperto/.test(txt), 'scheda: ' + txt);
      await sleep(300);
      await ctx.shot(page, 'iphone_4_esito');
      await hook('pescaAuto', false);
      await page.locator('#mzEsito [data-act="ok"]').click();
      await ctx.waitState(page, (s) => !s.minigiochi.open && s.pescaPosto.bottone, 5000);
      ctx.noErrors(T, 'telefono');
    });

    // ---------- PC ----------
    const D = await ctx.B.openPage(ctx.browser, `${base}/?t=tokM&test=1`, { viewport: ctx.B.DESKTOP }); pages.push(D); ctx._pages.push(D);
    const dp = D.page;
    await ctx.waitReady(dp, 30000);
    await ctx.waitState(dp, (s) => s.lot && s.lot.ready === true && s.pescaPosto, 15000);
    const dhook = (n, ...a) => dp.evaluate(([n, a]) => window.__game.test[n](...a), [n, a]);

    await ctx.test('PC: tasto P nelle acque del Porto apre la schermata; Esc = ritirato', async () => {
      await dhook('setMode', 'boat');
      assert(await dhook('pescaVai', 'porto'), 'nessun punto da pesca al Porto');
      await ctx.waitState(dp, (s) => s.pescaPosto.ok && s.pescaPosto.mare === 'porto' && s.pescaPosto.bottone, 5000);
      await sleep(400);
      await ctx.shot(dp, 'desktop_1_bottone');
      await dp.keyboard.press('KeyP');
      await ctx.waitState(dp, (s) => s.pesca && s.pesca.open && s.pesca.mare === 'porto', 15000);
      await sleep(300);
      await ctx.shot(dp, 'desktop_2_regole');
      await dp.keyboard.press('Space');
      await sleep(200);
      assert(await dhook('pescaFinoA', 'recupero'), 'recupero mai raggiunto');
      await sleep(150);
      await ctx.shot(dp, 'desktop_3_recupero');
      assert(await dhook('pescaFinoA', 'preso'), 'preso mai raggiunto');
      await sleep(250);
      await ctx.shot(dp, 'desktop_4_preso');
      await dp.keyboard.press('Escape');
      await ctx.waitState(dp, (s) => !s.pesca.open && !s.minigiochi.open, 5000);
      ctx.noErrors(D, 'PC');
    });
    await ctx.test('PC: in Laguna i pesci della Laguna', async () => {
      assert(await dhook('pescaVai', 'laguna'), 'nessun punto da pesca in Laguna');
      await ctx.waitState(dp, (s) => s.pescaPosto.ok && s.pescaPosto.mare === 'laguna', 5000);
      await dp.keyboard.press('KeyP');
      await ctx.waitState(dp, (s) => s.pesca && s.pesca.open && s.pesca.mare === 'laguna', 15000);
      await dp.keyboard.press('Space'); await sleep(150);
      assert(await dhook('pescaFinoA', 'preso'), 'preso mai raggiunto');
      await sleep(250);
      await ctx.shot(dp, 'desktop_5_laguna');
      const presi = (await ctx.getState(dp)).pesca.view.presi;
      assert(presi.every((id) => cfg.mari.laguna.pesci.includes(id)), 'pesci non della Laguna: ' + presi.join(','));
      await dp.keyboard.press('Escape');
      ctx.noErrors(D, 'PC laguna');
    });
  } finally {
    for (const p of pages) await p.close().catch(() => {});
    if (dev) { try { process.kill(-dev.pid, 'SIGTERM'); } catch { /* già finito */ } await sleep(500); try { process.kill(-dev.pid, 'SIGKILL'); } catch { /* ok */ } }
    fs.rmSync(persist, { recursive: true, force: true });
  }
}
