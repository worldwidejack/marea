// Caccia alle perle, minigioco universale: dalla barca ferma su acqua bassa ',' (vicino a una costa, lontano dai moli) ti tuffi.
// API (wrangler locale pulito): il server rigioca gli input dell'autopilota e paga l'oro di balance.solo più le Perle extra
// (perle.json premioExtra); chi non si tuffa non prende medaglia; input oltre 60 s rifiutati. Browser (telefono 390×844): a piedi
// niente TUFFATI; in barca ferma su acqua bassa compare; si apre la schermata (regole, tuffo, fondale a metà partita), l'autopilota
// finisce e la scheda dà il premio. PC: tasto T, schermata grande, un tuffo tenendo premuto Spazio, Esc = ritirato.
// Screenshot in tests/out/shots/m3_perle_*.
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
export const timeout = 180000;

const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function (ctx) {
  const { assert } = ctx;
  const SERVER = path.join(ctx.ROOT, 'apps/server');
  const persist = path.join(ctx.OUT, `m3perle-${process.pid}`);
  const env = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' };
  const wr = (...a) => execFileSync('npx', ['--no-install', 'wrangler', ...a], { cwd: SERVER, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 }).toString();
  const balance = JSON.parse(fs.readFileSync(path.join(ctx.ROOT, 'packages/content/src/balance.json'), 'utf8'));
  const cfg = JSON.parse(fs.readFileSync(path.join(ctx.ROOT, 'packages/content/src/minigames/perle.json'), 'utf8'));
  const oro = { ...balance.solo.premi.oro };
  for (const [k, v] of Object.entries(cfg.premioExtra?.oro ?? {})) oro[k] += v;
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
    const autoplay = (seed, difficulty) => {
      const m = sim.getMinigame('perle'), s = m.create({ seed, difficulty }), rng = sim.createRng(1), frames = [];
      for (let i = 0; i < m.maxTicks && !m.result(s).done; i++) { const f = sim.quantize(m.autopilot(s, rng)); frames.push(f); m.step(s, f); }
      return { frames, r: m.result(s) };
    };

    await ctx.test('API: il server rigioca gli input dell\'autopilota e paga l\'oro con le Perle in più', async () => {
      const st = await post('/api/solo/start', 'tokU', { minigame: 'perle' });
      assert(st.status === 200 && st.body.minigame === 'perle' && Number.isInteger(st.body.seed) && st.body.lot?.solo?.pending?.minigame === 'perle',
        `start perle: ${st.status} ${JSON.stringify(st.body).slice(0, 300)}`);
      const { frames, r: local } = autoplay(st.body.seed, st.body.difficulty);
      const r = await post('/api/solo/play', 'tokU', { inputs: sim.packInputs(frames) });
      assert(r.status === 200 && r.body.medal === 'oro' && r.body.score === local.score, `play perle: ${r.status} ${JSON.stringify(r.body).slice(0, 300)} (locale ${local.score})`);
      assert(r.body.detail.perle >= 20 && r.body.detail.totale > r.body.score, 'detail: ' + JSON.stringify(r.body.detail));
      assert(r.body.premiata && JSON.stringify(r.body.premio) === JSON.stringify(oro), `premio: ${JSON.stringify(r.body.premio)} invece di ${JSON.stringify(oro)}`);
      ctx.log(`API oro: ${r.body.score}/${r.body.detail.totale} punti, ${r.body.detail.perle} perle, premio ${JSON.stringify(r.body.premio)}`);
    });

    await ctx.test('API: chi resta a galla non prende medaglia (consolazione), input oltre 60 s rifiutati', async () => {
      await post('/api/solo/start', 'tokU', { minigame: 'perle' });
      const r = await post('/api/solo/play', 'tokU', { inputs: [[3600, 0, 0, 0, 0]] });
      assert(r.status === 200 && r.body.medal === null && r.body.score === 0, `a galla: ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
      assert(JSON.stringify(r.body.premio) === JSON.stringify(balance.solo.premi.nessuna), 'consolazione: ' + JSON.stringify(r.body.premio));
      await post('/api/solo/start', 'tokU', { minigame: 'perle' });
      const troppo = await post('/api/solo/play', 'tokU', { inputs: [[3601, 0, 0, 1, 0]] });
      assert(troppo.status === 400, `input oltre 60 s: ${troppo.status}`);
    });

    // ---------- telefono ----------
    const T = await ctx.B.openPage(ctx.browser, `${base}/?t=tokL&test=1`, { viewport: ctx.B.IPHONE }); pages.push(T); ctx._pages.push(T);
    const page = T.page;
    await ctx.waitReady(page, 30000);
    await ctx.waitState(page, (s) => s.lot && s.lot.ready === true && s.perlePosto, 15000);
    const st = () => ctx.getState(page);
    const hook = (n, ...a) => page.evaluate(([n, a]) => window.__game.test[n](...a), [n, a]);

    await ctx.test('a piedi niente TUFFATI', async () => {
      await sleep(300);
      const s = await st();
      assert(s.perlePosto.ok === false && s.perlePosto.bottone === false, 'a piedi: ' + JSON.stringify(s.perlePosto));
      assert(!(await page.locator('#mzPerle.on').count()), 'bottone acceso a piedi');
    });

    await ctx.test('in barca ferma su acqua bassa, lontano dal molo, compare TUFFATI (e non PESCA)', async () => {
      await hook('setMode', 'boat');
      const p = await hook('perleVai');
      assert(p, 'nessun punto da tuffo');
      await ctx.waitState(page, (s) => s.perlePosto.ok && s.perlePosto.bottone, 5000);
      const s = await st();
      assert(!s.pescaPosto?.bottone, 'PESCA e TUFFATI insieme');
      assert(/TUFFATI/.test(await page.locator('#mzPerle').innerText()), 'testo del bottone');
      await hook('setZoom', 1.2);
      await sleep(500);
      await ctx.shot(page, 'iphone_1_tuffati');
    });

    await ctx.test('TUFFATI apre la schermata (dentro il telefono): regole, poi il tuffo tenendo premuto', async () => {
      await page.locator('#mzPerle').click();
      await ctx.waitState(page, (s) => s.perle && s.perle.open && s.perle.intro, 15000);
      await sleep(300);
      await ctx.shot(page, 'iphone_2_regole');
      const box = await page.locator('#mzPerleGioco .mz-pr-box').boundingBox();
      assert(box && box.x >= 0 && box.x + box.width <= 390 && box.y >= 0 && box.y + box.height <= 844, 'la schermata esce dal telefono: ' + JSON.stringify(box));
      // tieni premuto il bottone grande per un secondo: il sub scende
      const b = await page.locator('#mzPerleGiu').boundingBox();
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      await page.mouse.down();
      await ctx.waitState(page, (s) => !s.perle.intro && s.perle.view && s.perle.view.y > 12, 4000);
      await sleep(250);
      await ctx.shot(page, 'iphone_3_giu');
      await page.mouse.up();
      const y0 = (await st()).perle.view.y;
      await sleep(900);
      const y1 = (await st()).perle.view.y;
      assert(y1 < y0, `lasciando il sub deve risalire: ${y0} → ${y1}`);
      // a metà partita (pilota fino a 22 s): fondale, perle, meduse
      assert(await hook('perleFinoA', 1320), 'perleFinoA');
      await sleep(200);
      await ctx.shot(page, 'iphone_4_fondale');
      const v = (await st()).perle.view;
      assert(v.punti > 0 && v.prese.bianca > 0, 'a metà partita niente perle: ' + JSON.stringify(v));
    });

    await ctx.test('l\'autopilota finisce la partita, il server rigioca e paga l\'oro (con le Perle in più); la scheda mostra perle e punti', async () => {
      const before = (await st()).lot.resources;
      await hook('perleAuto', true);
      await ctx.waitState(page, (s) => s.minigiochi.open === true, 90000);
      const s = await st(), r = s.minigiochi.last;
      ctx.log(`esito ${r.medal} ${r.score} · ${JSON.stringify(r.detail)}`);
      assert(r.medal === 'oro' && r.premiata && JSON.stringify(r.premio) === JSON.stringify(oro), 'esito: ' + JSON.stringify(r));
      for (const k of ['legno', 'pietra', 'perle']) assert(r.lot.resources[k] >= before[k] + r.premio[k], `${k} non pagato`);
      const txt = await page.locator('#mzEsito').innerText();
      assert(/ORO/.test(txt) && /\d+ prese/.test(txt) && /\d+ punti/.test(txt), 'scheda: ' + txt);
      await sleep(300);
      await ctx.shot(page, 'iphone_5_esito');
      await hook('perleAuto', false);
      await page.locator('#mzEsito [data-act="ok"]').click();
      await ctx.waitState(page, (s) => !s.minigiochi.open && s.perlePosto.bottone, 5000);
      ctx.noErrors(T, 'telefono');
    });

    // ---------- PC ----------
    const D = await ctx.B.openPage(ctx.browser, `${base}/?t=tokM&test=1`, { viewport: ctx.B.DESKTOP }); pages.push(D); ctx._pages.push(D);
    const dp = D.page;
    await ctx.waitReady(dp, 30000);
    await ctx.waitState(dp, (s) => s.lot && s.lot.ready === true && s.perlePosto, 15000);
    const dhook = (n, ...a) => dp.evaluate(([n, a]) => window.__game.test[n](...a), [n, a]);

    await ctx.test('PC: T in barca ferma su acqua bassa apre la schermata; Spazio tenuto = giù; Esc = ritirato', async () => {
      await dhook('setMode', 'boat');
      assert(await dhook('perleVai'), 'nessun punto da tuffo');
      await ctx.waitState(dp, (s) => s.perlePosto.ok && s.perlePosto.bottone, 5000);
      await sleep(400);
      await ctx.shot(dp, 'desktop_1_tuffati');
      await dp.keyboard.press('KeyT');
      await ctx.waitState(dp, (s) => s.perle && s.perle.open && s.perle.intro, 15000);
      await sleep(300);
      await ctx.shot(dp, 'desktop_2_regole');
      await dp.keyboard.down('Space');
      await ctx.waitState(dp, (s) => !s.perle.intro && s.perle.view.y > 15, 4000);
      await dp.keyboard.up('Space');
      assert(await dhook('perleFinoA', 2400), 'perleFinoA');
      await sleep(200);
      await ctx.shot(dp, 'desktop_3_fondale');
      await dp.keyboard.press('Escape');
      await ctx.waitState(dp, (s) => !s.perle.open && !s.minigiochi.open, 5000);
      const m = (await ctx.getState(dp)).mode;
      assert(m === 'boat', 'dopo il ritiro si resta in barca: ' + m);
      ctx.noErrors(D, 'PC');
    });
  } finally {
    for (const p of pages) await p.close().catch(() => {});
    if (dev) { try { process.kill(-dev.pid, 'SIGTERM'); } catch { /* già finito */ } await sleep(500); try { process.kill(-dev.pid, 'SIGKILL'); } catch { /* ok */ } }
    fs.rmSync(persist, { recursive: true, force: true });
  }
}
