// Porto tra amici sul server locale (wrangler dev, TEST_CLOCK:1). API: Luca fa una Regata ferma (0 punti) e una Caccia alle perle col
// pilota; Mia fa la Regata col pilota e gli toglie il record (riga nel feed di Luca); il tabellone dà il migliore di oggi e di sempre coi
// nomi. Telefono 390×844 (Luca): pannello del tabellone. PC (Mia): E apre il tabellone, di notte il fascio del Grande Faro gira.
// Del Faro comune (tolto, tag archivio/spenti-faro) resta il modello acceso sullo scoglio: niente cartello, bottone, meta in bussola né
// pannello. Alla fine il giorno dopo «oggi» si svuota e «sempre» resta. Screenshot di tutto.
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
export const timeout = 420000;

const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const H = 3_600_000, DAY = 24 * H;

export default async function (ctx) {
  const { assert } = ctx;
  const SERVER = path.join(ctx.ROOT, 'apps/server');
  const persist = path.join(ctx.OUT, `m3amici-${process.pid}`);
  const env = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' };
  const wr = (...a) => execFileSync('npx', ['--no-install', 'wrangler', ...a], { cwd: SERVER, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 }).toString();
  const imp = (f) => import(pathToFileURL(path.join(ctx.ROOT, 'packages/sim/src', f)).href);
  const sim = await imp('index.ts');
  const autoplay = (id, seed, difficulty, opzioni) => {
    const m = sim.getMinigame(id), s = m.create({ seed, difficulty, opzioni }), rng = sim.createRng(1), frames = [];
    for (let i = 0; i < m.maxTicks && !m.result(s).done; i++) { const f = sim.quantize(m.autopilot(s, rng)); frames.push(f); m.step(s, f); }
    return frames;
  };

  let OFF = 0; // orologio di prova (sempre in avanti): lo usano API e browser
  const pages = [];
  let dev = null, log = '';
  try {
    fs.rmSync(persist, { recursive: true, force: true });
    wr('d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', persist);
    wr('d1', 'execute', 'DB', '--local', '--persist-to', persist, '--command',
      "INSERT INTO persone (id, nome, token, slot) VALUES ('luca', 'Luca', 'tokL', 0), ('mia', 'Mia', 'tokM', 1);");
    const port = await freePort(), inspector = await freePort();
    dev = spawn('npx', ['--no-install', 'wrangler', 'dev', '--local', '--ip', '127.0.0.1', '--port', String(port), '--inspector-port', String(inspector),
      '--assets', ctx.distDir, '--persist-to', persist, '--var', 'TEST_CLOCK:1', '--show-interactive-dev-session=false'], { cwd: SERVER, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    dev.stdout.on('data', (d) => (log += d)); dev.stderr.on('data', (d) => (log += d));
    const B = `http://127.0.0.1:${port}`;
    let up = false;
    for (let i = 0; i < 120 && !up; i++) { try { up = (await fetch(B + '/api/ping')).ok; } catch { /* non ancora */ } if (!up) await sleep(500); }
    if (!up) throw new Error('wrangler dev non risponde:\n' + log.split('\n').slice(-20).join('\n'));
    const hdr = (t) => ({ 'x-token': t, 'content-type': 'application/json', 'x-test-now-offset': String(OFF) });
    const get = async (p, t) => { const r = await fetch(B + p, { headers: hdr(t) }); return { status: r.status, body: await r.json() }; };
    const post = async (p, t, b) => { const r = await fetch(B + p, { method: 'POST', headers: hdr(t), body: JSON.stringify(b ?? {}) }); return { status: r.status, body: await r.json() }; };
    const solo = async (t, id, gioca, opzioni) => {
      const s = await post('/api/solo/start', t, opzioni ? { minigame: id, opzioni } : { minigame: id });
      assert(s.status === 200, `start ${id}: ${s.status}`);
      return post('/api/solo/play', t, { inputs: gioca(s.body) });
    };
    const ferma = () => sim.packInputs(Array.from({ length: sim.getMinigame('regata').maxTicks }, () => ({ mx: 0, my: 0, a: false, b: false })));
    const pilota = (id) => (b) => sim.packInputs(autoplay(id, b.seed, b.difficulty, b.opzioni));
    let regataMia = null, pescaLuca = null;

    await ctx.test('API: record dal replay del server; chi viene superato lo legge nel feed; tabellone coi nomi', async () => {
      const a = await solo('tokL', 'regata', ferma);
      assert(a.status === 200 && a.body.score === 0 && a.body.record?.oggi && a.body.record?.sempre, 'regata ferma di Luca: ' + JSON.stringify({ ...a.body, lot: undefined }));
      const b = await solo('tokM', 'regata', pilota('regata'));
      assert(b.status === 200 && b.body.score > 0 && b.body.record?.sempre, 'regata di Mia: ' + JSON.stringify({ ...b.body, lot: undefined }));
      regataMia = b.body;
      const c = await solo('tokL', 'perle', pilota('perle'));
      assert(c.status === 200 && c.body.score > 0 && c.body.record?.sempre, 'perle di Luca: ' + c.status);
      pescaLuca = c.body;
      // una partita peggiore non tocca il record
      const d = await solo('tokM', 'regata', ferma);
      assert(d.status === 200 && d.body.record && !d.body.record.oggi && !d.body.record.sempre, 'regata peggiore: ' + JSON.stringify(d.body.record));
      const r = await get('/api/record', 'tokL');
      assert(r.status === 200 && Array.isArray(r.body.voci), 'record: ' + r.status);
      const reg = r.body.voci.find((v) => v.minigame === 'regata'), pes = r.body.voci.find((v) => v.minigame === 'perle');
      assert(reg.sempre.chi === 'mia' && reg.sempre.nome === 'Mia' && reg.sempre.score === regataMia.score && reg.oggi.chi === 'mia', 'regata: ' + JSON.stringify(reg));
      assert(typeof reg.sempre.detail.ms === 'number' && reg.sempre.medal === regataMia.medal, 'detail e medaglia: ' + JSON.stringify(reg.sempre));
      assert(pes.sempre.chi === 'luca' && pes.sempre.score === pescaLuca.score, 'perle: ' + JSON.stringify(pes));
      assert(r.body.voci.find((v) => v.minigame === 'koi').sempre === null, 'koi mai giocato');
      const f = await get('/api/feed', 'tokL');
      const riga = f.body.items.find((x) => x.tipo === 'record');
      assert(riga && riga.testo === 'Mia ha battuto il tuo record alla Regata' && riga.da === 'mia' && !riga.sfida, 'feed di Luca: ' + JSON.stringify(f.body.items));
      assert(!(await get('/api/feed', 'tokM')).body.items.some((x) => x.tipo === 'record'), 'Mia non ha perso niente');
      ctx.log(`regata Mia ${regataMia.score} (${regataMia.detail.ms} ms, ${regataMia.medal}) · perle Luca ${pescaLuca.score}`);
    });

    // ---- telefono (Luca) ----
    const open = async (t, viewport, extra = '') => {
      const pg = await ctx.B.openPage(ctx.browser, `${B}/?t=${t}&test=1${extra}`, { viewport });
      pages.push(pg); ctx._pages.push(pg);
      await pg.page.route('**/api/**', (route) => { const rq = route.request(); return route.continue({ headers: { ...rq.headers(), 'x-test-now-offset': String(OFF) } }); });
      await ctx.waitReady(pg.page, 60000);
      await ctx.waitState(pg.page, (s) => s.lot && s.lot.ready && s.portoAmici && s.portoAmici.faro.modello !== '', 60000);
      await pg.page.evaluate(() => window.__game.test.rientroPronto?.());
      if (await pg.page.locator('#mzRientro.on [data-act="chiudi"]').count()) await pg.page.locator('#mzRientro.on [data-act="chiudi"]').click();
      return pg;
    };
    const T = await open('tokL', ctx.B.IPHONE), tp = T.page;
    const tst = () => ctx.getState(tp), th = (n, ...a) => tp.evaluate(([n, a]) => window.__game.test[n](...a), [n, a]);
    const posto = async (page, id) => (await ctx.getState(page)).portoAmici.posti.find((p) => p.id === id);
    const dentro = async (page, sel, w, h) => {
      const box = await page.locator(sel).boundingBox();
      assert(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= w && box.y + box.height <= h, `${sel} fuori schermo: ${JSON.stringify(box)}`);
      const small = await page.evaluate((sel) => [...document.querySelectorAll(sel + ' button')].filter((b) => b.getBoundingClientRect().height < 44).map((b) => b.textContent), sel);
      assert(!small.length, 'bottoni < 44 px: ' + small.join(','));
    };

    await ctx.test('telefono: il Grande Faro acceso sullo scoglio; tabellone: Mia alla Regata col tempo, Luca alle Perle coi punti', async () => {
      const s0 = await tst();
      assert(s0.portoAmici.faro.modello === 'bld_faro_l1' && s0.portoAmici.faro.scala > 1, 'faro: ' + JSON.stringify(s0.portoAmici.faro));
      const f = s0.portoAmici.faro.at;
      await th('teleport', f.x - 3, f.z - 3); await th('setZoom', 1.6);
      await tp.waitForTimeout(900);
      await ctx.shot(tp, 'iphone_faro');
      const t = await posto(tp, 'record');
      await th('teleport', t.fronte.x + 1, t.fronte.z + 2.5); await th('setZoom', 0.9);
      await tp.waitForTimeout(2500); // il cartellino «Mia ha battuto il tuo record» se ne va
      await ctx.shot(tp, 'iphone_tabellone');
      await th('teleport', t.fronte.x, t.fronte.z); await th('setZoom', 0.8);
      await ctx.waitState(tp, (s) => s.portoAmici.near === 'record', 30000);
      await tp.locator('#mzAmiciBtn').tap();
      await ctx.waitState(tp, (s) => s.portoAmici.open === 'record' && s.portoAmici.ui.righe, 30000);
      const reg = tp.locator('#mzAmiciPanel [data-minigioco="regata"] [data-cella="sempre"]');
      assert((await reg.getAttribute('data-chi')) === 'mia', 'regata: non c\'è Mia');
      const secs = (regataMia.detail.ms / 1000).toFixed(1).replace('.', ',');
      assert((await reg.innerText()).includes(`${secs} s`), `tempo della regata ${secs}: ${await reg.innerText()}`);
      const pes = tp.locator('#mzAmiciPanel [data-minigioco="perle"] [data-cella="oggi"]');
      assert((await pes.getAttribute('data-chi')) === 'luca' && (await pes.innerText()).includes(`${pescaLuca.score} punti`), 'perle: ' + await pes.innerText());
      assert(await tp.locator('#mzAmiciPanel [data-minigioco="perle"] .mz-pa-cell.io').count() === 2, 'la riga di Luca è evidenziata');
      assert(await tp.locator('#mzAmiciPanel [data-minigioco="collezione"] [data-chi="luca"]').count() === 1, 'i collezionisti (#457) in cima al tabellone');
      await dentro(tp, '#mzAmiciPanel', 390, 844);
      await tp.waitForTimeout(250);
      await ctx.shot(tp, 'iphone_record');
      await tp.locator('#mzAmiciPanel [data-act="chiudi"]').tap();
      await ctx.waitState(tp, (s) => s.portoAmici.open === null, 30000);
      ctx.noErrors(T, 'telefono');
    });

    await ctx.test('PC (Mia): E apre il tabellone; di notte il fascio del Grande Faro gira', async () => {
      const D = await open('tokM', ctx.B.DESKTOP, '&serie=1'), dp = D.page;
      const dh = (n, ...a) => dp.evaluate(([n, a]) => window.__game.test[n](...a), [n, a]);
      const t = await posto(dp, 'record');
      await dh('teleport', t.fronte.x, t.fronte.z); await dh('setZoom', 0.9);
      await ctx.waitState(dp, (s) => s.portoAmici.near === 'record', 30000);
      await dp.keyboard.press('KeyE');
      try { await ctx.waitState(dp, (s) => s.portoAmici.open === 'record' && s.portoAmici.ui.righe, 30000); }
      catch (e) { const s = await ctx.getState(dp); ctx.log('DEBUG', JSON.stringify({ pa: { ...s.portoAmici, faro: undefined }, porto: s.porto?.open, libro: s.libro?.open })); await ctx.shot(dp, 'debug'); throw e; }
      await dp.waitForTimeout(300);
      await ctx.shot(dp, 'desktop_record');
      await dp.keyboard.press('Escape');
      await ctx.waitState(dp, (s) => s.portoAmici.open === null, 30000);
      const f = (await ctx.getState(dp)).portoAmici.faro.at;
      await dp.evaluate(() => window.__game.test.aspettoPronto());
      await dh('ciclo', 0.78);
      await dh('teleport', f.x + 4, f.z + 22); await dh('setZoom', 1.6);
      await ctx.waitState(dp, (s) => s.aspetto.momento === 'notte' && s.portoAmici.faro.fascio, 15000);
      await dp.waitForTimeout(1200);
      await ctx.shot(dp, 'desktop_faro_notte');
      await dh('ciclo', null);
      ctx.noErrors(D, 'PC');
    });

    await ctx.test('del Faro comune resta il modello acceso; niente cartello, bottone, meta in bussola né pannello', async () => {
      const S = await open('tokL', ctx.B.IPHONE), sp = S.page;
      const s0 = await ctx.getState(sp);
      assert(s0.portoAmici.posti.every((p) => p.id !== 'faro') && s0.portoAmici.posti.some((p) => p.id === 'record'), 'posti: ' + JSON.stringify(s0.portoAmici.posti));
      assert(s0.portoAmici.faro.modello === 'bld_faro_l1' && s0.portoAmici.faro.scala > 1, 'il modello del faro: ' + JSON.stringify(s0.portoAmici.faro));
      assert(await sp.locator('[data-amici="faro"]').count() === 0 && await sp.locator('[data-amici="record"]').count() === 1, 'cartelli');
      const mete = await sp.evaluate(() => [...document.querySelectorAll('#compass [data-id]')].map((r) => r.dataset.id));
      assert(!mete.includes('faro') && mete.includes('record'), 'bussola: ' + mete.join(','));
      assert(await sp.evaluate(() => window.__game.test.amiciApri('faro')) === false, 'il pannello del faro si apre ancora');
      const f = s0.portoAmici.faro.at;
      await sp.evaluate(([x, z]) => window.__game.test.teleport(x + 0.8, z - 2.2), [f.x, f.z]);
      await sp.waitForTimeout(1500);
      const s1 = await ctx.getState(sp);
      assert(s1.portoAmici.near === null && s1.portoAmici.open === null && !(await sp.locator('#mzAmiciBtn.on').count()), 'vicino al faro: ' + JSON.stringify({ near: s1.portoAmici.near, open: s1.portoAmici.open }));
      await ctx.shot(sp, 'iphone_faro_vicino');
      ctx.noErrors(S, 'senza faro');
    });

    await ctx.test('API: il giorno dopo «oggi» è vuoto, «sempre» resta', async () => {
      OFF += DAY;
      const r = (await get('/api/record', 'tokM')).body.voci.find((v) => v.minigame === 'regata');
      assert(r.oggi === null && r.sempre.chi === 'mia', 'giorno dopo: ' + JSON.stringify(r));
    });
  } finally {
    for (const p of pages) await p.close().catch(() => {});
    if (dev) { try { process.kill(-dev.pid, 'SIGTERM'); } catch { /* già finito */ } await sleep(500); try { process.kill(-dev.pid, 'SIGKILL'); } catch { /* ok */ } }
    fs.rmSync(persist, { recursive: true, force: true });
  }
}
