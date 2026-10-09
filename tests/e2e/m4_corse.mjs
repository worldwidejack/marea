// Gran Premio (Isola delle Corse, docs/CORSE.md). API (wrangler locale pulito): il server rigioca gli input del pilota automatico (primo
// tick = la guida), dà l'oro per il primo posto e paga balance.solo più il premio extra; chi sta fermo non prende medaglia; input oltre il
// tempo massimo rifiutati. Telefono 390×844: l'isola è aperta a tutti (niente link? si gioca lo stesso), al via c'è GIOCA, la scelta della
// guida sta dentro il telefono, VIA → semaforo → gara con la camera dietro al kart; sterzo tutto a destra + DRIFT = drift a destra; draw
// call ≤ 100 in gara; il pilota automatico finisce e la scheda dice posizione e tempo; si torna nel mondo. PC: E al via, 3 = NERVOSA,
// Invio = via, ← + Spazio = drift a sinistra, Esc = ritirato. Screenshot in tests/out/shots/m4_corse_*.
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
  const oro = { ...balance.solo.premi.oro };
  for (const [k, v] of Object.entries(CFG.premioExtra?.oro ?? {})) oro[k] += v;
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
    const autoplay = (seed, difficulty, guida) => {
      const m = sim.getMinigame('corse'), s = m.create({ seed, difficulty }), frames = [sim.quantize(sim.corseStartFrame(guida))];
      m.step(s, frames[0]);
      for (let i = 1; i < m.maxTicks && !m.result(s).done; i++) { const f = sim.quantize(sim.corsePilota(s)); frames.push(f); m.step(s, f); }
      return { frames, r: m.result(s) };
    };

    await ctx.test('API: il server rigioca la gara del pilota automatico (guida media), primo posto = oro col premio extra', async () => {
      const st = await post('/api/solo/start', 'tokU', { minigame: 'corse' });
      assert(st.status === 200 && st.body.minigame === 'corse' && Number.isInteger(st.body.seed), `start: ${st.status} ${JSON.stringify(st.body).slice(0, 300)}`);
      const { frames, r: local } = autoplay(st.body.seed, st.body.difficulty, 1);
      const t0 = Date.now();
      const r = await post('/api/solo/play', 'tokU', { inputs: sim.packInputs(frames) });
      ctx.log(`API gara: ${frames.length} tick rigiocati in ${Date.now() - t0} ms, ${JSON.stringify(r.body.detail)}`);
      assert(r.status === 200 && r.body.medal === 'oro' && r.body.score === local.score && r.body.detail.pos === 1, `play: ${r.status} ${JSON.stringify(r.body).slice(0, 300)} (locale ${local.score})`);
      assert(r.body.premiata && JSON.stringify(r.body.premio) === JSON.stringify(oro), `premio: ${JSON.stringify(r.body.premio)} invece di ${JSON.stringify(oro)}`);
    });
    await ctx.test('API: chi sta fermo non prende medaglia, input oltre il tempo massimo rifiutati', async () => {
      await post('/api/solo/start', 'tokU', { minigame: 'corse' });
      const r = await post('/api/solo/play', 'tokU', { inputs: [[1, 2, 0, 0, 0], [600, 0, 0, 0, 0]] });
      assert(r.status === 200 && r.body.medal === null, `fermo: ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
      await post('/api/solo/start', 'tokU', { minigame: 'corse' });
      const troppo = await post('/api/solo/play', 'tokU', { inputs: [[CFG.maxSeconds * 60 + 1, 0, 32, 0, 0]] });
      assert(troppo.status === 400, `input oltre il tempo: ${troppo.status}`);
    });

    // ---------- telefono ----------
    const T = await ctx.B.openPage(ctx.browser, `${base}/?t=tokL&test=1`, { viewport: ctx.B.IPHONE }); pages.push(T); ctx._pages.push(T);
    const page = T.page;
    await ctx.waitReady(page, 40000);
    await ctx.waitState(page, (s) => s.lot && s.lot.ready === true && s.temi && s.compass, 40000);
    const st = () => ctx.getState(page);
    const hook = (n, ...a) => page.evaluate(([n, a]) => window.__game.test[n](...a), [n, a]);

    await ctx.test('telefono: l\'isola è aperta a tutti, al via compare GIOCA · GRAN PREMIO', async () => {
      await hook('temiProva', null); // il viaggiatore vero: Molo L1 e basta
      const v = await hook('spotVai', SPOT);
      assert(v && v.aperta === true, 'spotVai: ' + JSON.stringify(v));
      await ctx.waitState(page, (s, id) => s.minigiochi.near === id, 20000, SPOT);
      await sleep(1500);
      assert(/GRAN PREMIO/.test(await page.locator('#mzPlay').innerText()), 'testo del bottone');
      await ctx.shot(page, 'iphone_1_posto');
    });

    await ctx.test('telefono: scelta della guida dentro il telefono, VIA, semaforo, sterzo + DRIFT = drift, draw call ≤ 100', async () => {
      await page.locator('#mzPlay').click();
      await ctx.waitState(page, (s) => s.corse && s.corse.active && s.corse.fase === 'intro', 20000);
      await sleep(300);
      const box = await page.locator('#mzGpIntro').boundingBox();
      assert(box && box.x >= 0 && box.x + box.width <= 390 && box.y >= 0 && box.y + box.height <= 844, 'la scelta della guida esce dal telefono: ' + JSON.stringify(box));
      assert(!(await page.isVisible('#mzTop')), 'la barra in alto della superficie è ancora visibile');
      await page.locator('#mzGpIntro [data-guida="nervosa"]').click();
      await ctx.shot(page, 'iphone_2_guida');
      await page.locator('#mzGpVia').click();
      await ctx.waitState(page, (s) => s.corse.fase === 'via' && s.corse.guida === 2, 5000);
      await sleep(400);
      await ctx.shot(page, 'iphone_3_semaforo');
      await ctx.waitState(page, (s) => s.corse.fase === 'gara' && s.corse.v > 12, 45000);
      // sterzo tutto a destra sullo schermo (camera a 45°: destra = (0,707, −0,707) in assi mondo) col DRIFT tenuto
      await hook('wp2_inject', { mx: 0.707, my: -0.707, a: true });
      await ctx.waitState(page, (s) => s.corse.drift === 1, 3000);
      await sleep(500);
      await ctx.shot(page, 'iphone_4_drift');
      await hook('wp2_inject', null);
      const perf = await ctx.getPerf(page);
      ctx.log('perf in gara (telefono)', JSON.stringify(perf));
      assert(perf.drawCalls <= 100, `draw call ${perf.drawCalls} > 100`);
    });

    await ctx.test('telefono: il pilota automatico finisce la gara, il server rigioca, la scheda dice posizione e tempo; si torna nel mondo', async () => {
      const before = (await st()).lot.resources;
      await hook('corseAuto', 12);
      await ctx.waitState(page, (s) => s.minigiochi.open === true, 120000);
      const s = await st(), r = s.minigiochi.last;
      ctx.log(`esito ${r.medal} ${r.score} · ${JSON.stringify(r.detail)}`);
      assert(r.detail.giri === r.detail.tot && r.detail.pos >= 1 && r.detail.pos <= 5 && r.detail.guida === 2, 'esito: ' + JSON.stringify(r));
      if (r.premiata) for (const k of ['legno', 'pietra', 'perle']) assert(r.lot.resources[k] >= before[k] + r.premio[k], `${k} non pagato`);
      const txt = await page.locator('#mzEsito').innerText();
      assert(/° su 5/.test(txt) && /giro migliore/.test(txt), 'scheda: ' + txt);
      await sleep(300);
      await ctx.shot(page, 'iphone_5_esito');
      await hook('corseAuto', 0);
      await page.locator('#mzEsito [data-act="ok"]').click();
      await ctx.waitState(page, (q) => !q.minigiochi.open && !q.corse.active, 5000);
      assert(await page.isVisible('#mzTop'), 'la barra in alto non è tornata');
    });
    ctx.noErrors(T, 'telefono');

    // ---------- PC ----------
    const D = await ctx.B.openPage(ctx.browser, `${base}/?t=tokM&test=1`, { viewport: ctx.B.DESKTOP }); pages.push(D); ctx._pages.push(D);
    const dp = D.page;
    await ctx.waitReady(dp, 40000);
    await ctx.waitState(dp, (s) => s.lot && s.lot.ready === true && s.temi, 40000);
    const dhook = (n, ...a) => dp.evaluate(([n, a]) => window.__game.test[n](...a), [n, a]);

    await ctx.test('PC: E al via, 3 = NERVOSA, Invio = via, ← + Spazio = drift a sinistra, Esc = ritirato', async () => {
      await dhook('spotVai', SPOT);
      await ctx.waitState(dp, (s, id) => s.minigiochi.near === id, 20000, SPOT);
      await sleep(1000);
      await dp.keyboard.press('KeyE');
      await ctx.waitState(dp, (s) => s.corse && s.corse.fase === 'intro', 20000);
      await dp.keyboard.press('Digit3');
      await dp.keyboard.press('Enter');
      await ctx.waitState(dp, (s) => s.corse.fase === 'gara' && s.corse.v > 12 && s.corse.guida === 2, 45000);
      await dp.keyboard.down('ArrowLeft'); await dp.keyboard.down('Space');
      await ctx.waitState(dp, (s) => s.corse.drift === -1, 3000);
      await sleep(400);
      await ctx.shot(dp, 'desktop_1_drift');
      await dp.keyboard.up('Space'); await dp.keyboard.up('ArrowLeft');
      const perf = await ctx.getPerf(dp);
      ctx.log('perf in gara (PC)', JSON.stringify(perf));
      assert(perf.drawCalls <= 100, `draw call ${perf.drawCalls} > 100`);
      await dp.keyboard.press('Escape');
      await ctx.waitState(dp, (s) => !s.corse.active && !s.minigiochi.open, 8000);
      assert((await ctx.getState(dp)).mode === 'walk', 'dopo il ritiro si resta a piedi');
    });
    ctx.noErrors(D, 'PC');
  } finally {
    for (const p of pages) await p.close().catch(() => {});
    if (dev) { try { process.kill(-dev.pid, 'SIGTERM'); } catch { /* già finito */ } await sleep(500); try { process.kill(-dev.pid, 'SIGKILL'); } catch { /* ok */ } }
    fs.rmSync(persist, { recursive: true, force: true });
  }
}
