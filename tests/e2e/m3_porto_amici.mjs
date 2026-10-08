// Porto tra amici (#110 #111) sul server locale (wrangler dev, TEST_CLOCK:1). API: Luca fa una Regata ferma (0 punti) e una Pesca col
// pilota; Mia fa la Regata col pilota e gli toglie il record (riga nel feed di Luca); il tabellone dà il migliore di oggi e di sempre coi
// nomi. Faro comune: Segheria e Cava, l'orologio di prova avanza di 10 h alla volta, i due raccolgono e versano tutto finché il faro sale
// al livello 1 (soglie di content); libro mastro in pari (risorse uscite dai lotti = totale del faro), riga «Faro» nel feed, livelli
// spinti a ogni lotto e bonus di produzione applicato dal server (uguale alla sim). Telefono 390×844 (Luca): faro spento al livello 0,
// pannello del tabellone, faro cresciuto e acceso al livello 1, pannello del faro e VERSA 50. PC (Mia): E apre tabellone e faro, di notte
// il fascio gira. Alla fine il giorno dopo «oggi» si svuota e «sempre» resta. Screenshot di tutto.
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
  const read = (f) => JSON.parse(fs.readFileSync(path.join(ctx.ROOT, 'packages/content/src', f), 'utf8'));
  const amici = read('porto_amici.json'), islands = read('islands.json');
  const L1 = amici.faro.livelli[0];
  const slot = (k) => islands.find((i) => i.id === 'lotto').slots.find((s) => s.kind === k).at;
  const imp = (f) => import(pathToFileURL(path.join(ctx.ROOT, 'packages/sim/src', f)).href);
  const sim = await imp('index.ts');
  const { advance } = await imp('economy/advance.ts');
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
      const c = await solo('tokL', 'pesca', pilota('pesca'), { mare: 'porto' });
      assert(c.status === 200 && c.body.score > 0 && c.body.record?.sempre, 'pesca di Luca: ' + c.status);
      pescaLuca = c.body;
      // una partita peggiore non tocca il record
      const d = await solo('tokM', 'regata', ferma);
      assert(d.status === 200 && d.body.record && !d.body.record.oggi && !d.body.record.sempre, 'regata peggiore: ' + JSON.stringify(d.body.record));
      const r = await get('/api/record', 'tokL');
      assert(r.status === 200 && Array.isArray(r.body.voci), 'record: ' + r.status);
      const reg = r.body.voci.find((v) => v.minigame === 'regata'), pes = r.body.voci.find((v) => v.minigame === 'pesca');
      assert(reg.sempre.chi === 'mia' && reg.sempre.nome === 'Mia' && reg.sempre.score === regataMia.score && reg.oggi.chi === 'mia', 'regata: ' + JSON.stringify(reg));
      assert(typeof reg.sempre.detail.ms === 'number' && reg.sempre.medal === regataMia.medal, 'detail e medaglia: ' + JSON.stringify(reg.sempre));
      assert(pes.sempre.chi === 'luca' && pes.sempre.score === pescaLuca.score, 'pesca: ' + JSON.stringify(pes));
      assert(r.body.voci.find((v) => v.minigame === 'koi').sempre === null, 'koi mai giocato');
      const f = await get('/api/feed', 'tokL');
      const riga = f.body.items.find((x) => x.tipo === 'record');
      assert(riga && riga.testo === 'Mia ha battuto il tuo record alla Regata' && riga.da === 'mia' && !riga.sfida, 'feed di Luca: ' + JSON.stringify(f.body.items));
      assert(!(await get('/api/feed', 'tokM')).body.items.some((x) => x.tipo === 'record'), 'Mia non ha perso niente');
      ctx.log(`regata Mia ${regataMia.score} (${regataMia.detail.ms} ms, ${regataMia.medal}) · pesca Luca ${pescaLuca.score}`);
    });

    // ---- telefono (Luca) ----
    const open = async (t, viewport, extra = '') => {
      const pg = await ctx.B.openPage(ctx.browser, `${B}/?t=${t}&test=1${extra}`, { viewport });
      pages.push(pg); ctx._pages.push(pg);
      await pg.page.route('**/api/**', (route) => { const rq = route.request(); return route.continue({ headers: { ...rq.headers(), 'x-test-now-offset': String(OFF) } }); });
      await ctx.waitReady(pg.page, 60000);
      await ctx.waitState(pg.page, (s) => s.lot && s.lot.ready && s.portoAmici && s.portoAmici.faro.modello !== '', 60000);
      await pg.page.evaluate(() => window.__game.test.amiciPronto());
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

    await ctx.test('telefono: faro al livello 0 (spento); tabellone: Mia alla Regata col tempo, Luca alla Pesca coi punti', async () => {
      const s0 = await tst();
      assert(s0.portoAmici.faro.livello === 0 && !s0.portoAmici.faro.acceso && s0.portoAmici.faro.modello === 'bld_faro_l1' && s0.portoAmici.faro.luci > 0, 'faro al via: ' + JSON.stringify(s0.portoAmici.faro));
      const f = await posto(tp, 'faro');
      await th('teleport', f.x - 3, f.z - 3); await th('setZoom', 1.6);
      await tp.waitForTimeout(900);
      await ctx.shot(tp, 'iphone_faro_l0');
      const t = await posto(tp, 'record');
      await th('teleport', t.fronte.x + 1, t.fronte.z + 2.5); await th('setZoom', 0.9);
      await tp.waitForTimeout(2500); // il cartellino «Mia ha battuto il tuo record» se ne va
      await ctx.shot(tp, 'iphone_tabellone');
      await th('teleport', t.fronte.x, t.fronte.z); await th('setZoom', 0.8);
      await ctx.waitState(tp, (s) => s.portoAmici.near === 'record', 8000);
      await tp.locator('#mzAmiciBtn').tap();
      await ctx.waitState(tp, (s) => s.portoAmici.open === 'record' && s.portoAmici.ui.righe, 15000);
      const reg = tp.locator('#mzAmiciPanel [data-minigioco="regata"] [data-cella="sempre"]');
      assert((await reg.getAttribute('data-chi')) === 'mia', 'regata: non c\'è Mia');
      const secs = (regataMia.detail.ms / 1000).toFixed(1).replace('.', ',');
      assert((await reg.innerText()).includes(`${secs} s`), `tempo della regata ${secs}: ${await reg.innerText()}`);
      const pes = tp.locator('#mzAmiciPanel [data-minigioco="pesca"] [data-cella="oggi"]');
      assert((await pes.getAttribute('data-chi')) === 'luca' && (await pes.innerText()).includes(`${pescaLuca.score} punti`), 'pesca: ' + await pes.innerText());
      assert(await tp.locator('#mzAmiciPanel [data-minigioco="pesca"] .mz-pa-cell.io').count() === 2, 'la riga di Luca è evidenziata');
      await dentro(tp, '#mzAmiciPanel', 390, 844);
      await tp.waitForTimeout(250);
      await ctx.shot(tp, 'iphone_record');
      await tp.locator('#mzAmiciPanel [data-act="chiudi"]').tap();
      await ctx.waitState(tp, (s) => s.portoAmici.open === null, 5000);
    });

    // ---- Faro comune: si costruisce e si versa finché sale al livello 1 ----
    let salito = null;
    await ctx.test('API: versamenti validati; a 10 h alla volta Luca e Mia raccolgono e versano tutto finché il faro sale al livello 1', async () => {
      for (const t of ['tokL', 'tokM']) {
        assert((await post('/api/lot/build', t, { building: 'segheria', cell: slot('segheria') })).status === 200, 'segheria ' + t);
      }
      OFF += 60_000;
      for (const t of ['tokL', 'tokM']) assert((await post('/api/lot/build', t, { building: 'cava', cell: slot('cava') })).status === 200, 'cava ' + t);
      OFF += 5 * 60_000;
      const vuoto = await post('/api/faro/versa', 'tokL', { legno: 0, pietra: 0 });
      assert(vuoto.status === 400, 'versamento vuoto: ' + vuoto.status);
      const troppo = await post('/api/faro/versa', 'tokL', { legno: 999999 });
      assert(troppo.status === 409 && troppo.body.manca?.legno > 0, 'oltre il Magazzino: ' + JSON.stringify(troppo.body));
      const f0 = (await get('/api/faro', 'tokL')).body.faro;
      assert(f0.livello === 0 && f0.legno === 0 && f0.prossimo.legno === L1.legno && f0.classifica.length === 0, 'faro al via: ' + JSON.stringify(f0));
      for (let giro = 0; giro < 8 && !salito; giro++) {
        if (giro) OFF += 10 * H;
        for (const t of ['tokL', 'tokM']) {
          let lot = (await get('/api/lot', t)).body;
          for (const b of lot.buildings.filter((x) => x.building === 'segheria' || x.building === 'cava')) lot = (await post('/api/lot/collect', t, { building: b.id })).body;
          const v = await post('/api/faro/versa', t, { legno: lot.resources.legno, pietra: lot.resources.pietra });
          assert(v.status === 200, `versa ${t}: ${v.status} ${JSON.stringify(v.body)}`);
          assert(v.body.lot.resources.legno === lot.resources.legno - v.body.dono.legno && v.body.lot.resources.pietra === lot.resources.pietra - v.body.dono.pietra, 'risorse uscite dal lotto');
          if (v.body.saliti.length) { salito = { t, offset: OFF, faro: v.body.faro, lot: v.body.lot }; break; }
        }
      }
      assert(salito && salito.faro.livello === 1 && salito.faro.legno >= L1.legno && salito.faro.pietra >= L1.pietra, 'il faro non è salito: ' + JSON.stringify(salito?.faro));
      ctx.log(`faro al livello 1 dopo ${salito.offset / H} h: ${salito.faro.legno} Legno, ${salito.faro.pietra} Pietra · classifica ${salito.faro.classifica.map((c) => c.nome).join(', ')}`);
    });

    await ctx.test('API: libro mastro in pari, livelli a ogni lotto, riga «Faro» nel feed, bonus di produzione uguale alla sim', async () => {
      const lotL = (await get('/api/lot', 'tokL')).body, f = (await get('/api/faro', 'tokM')).body.faro;
      // Mia raccoglie adesso (depositi vuoti): da qui la produzione si confronta con la sim
      let lotM = (await get('/api/lot', 'tokM')).body;
      for (const b of lotM.buildings.filter((x) => x.building === 'segheria' || x.building === 'cava')) lotM = (await post('/api/lot/collect', 'tokM', { building: b.id })).body;
      for (const k of ['legno', 'pietra']) assert(lotL.faro.versato[k] + lotM.faro.versato[k] === f[k], `${k}: lotti ${lotL.faro.versato[k]} + ${lotM.faro.versato[k]} ≠ faro ${f[k]}`);
      const perNome = Object.fromEntries(f.classifica.map((c) => [c.id, c]));
      assert(perNome.luca.legno === lotL.faro.versato.legno && perNome.mia.pietra === lotM.faro.versato.pietra && perNome.luca.nome === 'Luca', 'classifica: ' + JSON.stringify(f.classifica));
      assert(sim.checkInvariant([lotL]) === null && sim.checkInvariant([lotM]) === null, 'Σ risorse ≠ generato − speso');
      assert(lotL.faro.livelli.length === 1 && lotM.faro.livelli.length === 1 && lotL.faro.livelli[0] === lotM.faro.livelli[0], 'livelli nei lotti: ' + JSON.stringify([lotL.faro, lotM.faro]));
      for (const t of ['tokL', 'tokM']) {
        const riga = (await get('/api/feed', t)).body.items.find((x) => x.tipo === 'faro');
        assert(riga && /Faro del Porto è salito al livello 1/.test(riga.testo) && riga.testo.includes(`+${Math.round(L1.bonus * 100)} %`), `feed ${t}: ${JSON.stringify(riga)}`);
      }
      // due ore dopo: la Segheria di Mia è cresciuta come dice la sim col faro, più che senza
      OFF += 2 * H;
      const dopo = (await get('/api/lot', 'tokM')).body;
      const conSim = advance(lotM, dopo.nowMs), senza = advance({ ...lotM, faro: { ...lotM.faro, livelli: [] } }, dopo.nowMs);
      for (const b of ['segheria', 'cava']) {
        const buf = (l) => l.buildings.find((x) => x.building === b).buffer;
        assert(Math.abs(buf(dopo) - buf(conSim)) < 1e-6, `${b}: server ${buf(dopo)} ≠ sim ${buf(conSim)}`);
        assert(buf(dopo) > buf(senza) + 0.5, `${b}: senza bonus ${buf(senza)}, col faro ${buf(dopo)}`);
      }
      ctx.log(`bonus: Segheria di Mia ${dopo.buildings.find((x) => x.building === 'segheria').buffer.toFixed(1)} invece di ${senza.buildings.find((x) => x.building === 'segheria').buffer.toFixed(1)}`);
      // Luca raccoglie dopo 6 h: gli servono un po' di Legno per versare dal telefono
      OFF += 4 * H;
      for (const b of (await get('/api/lot', 'tokL')).body.buildings.filter((x) => x.building === 'segheria' || x.building === 'cava')) await post('/api/lot/collect', 'tokL', { building: b.id });
    });

    await ctx.test('telefono: il faro cresce e si accende al livello 1; pannello del faro e VERSA 50 Legno', async () => {
      await th('amiciFaro');
      await ctx.waitState(tp, (s) => s.portoAmici.faro.livello === 1 && s.portoAmici.faro.acceso && s.portoAmici.faro.scala > 1 && s.portoAmici.faro.luci > 0, 15000);
      const f = await posto(tp, 'faro');
      await th('teleport', f.x - 3, f.z - 3); await th('setZoom', 1.6);
      await tp.waitForTimeout(3800); // il cartellino «il Faro è al livello 1» se ne va
      await ctx.shot(tp, 'iphone_faro_l1');
      await th('teleport', f.fronte.x, f.fronte.z); await th('setZoom', 0.8);
      await ctx.waitState(tp, (s) => s.portoAmici.near === 'faro', 8000);
      await tp.locator('#mzAmiciBtn').tap();
      await ctx.waitState(tp, (s) => s.portoAmici.open === 'faro', 10000);
      await tp.waitForSelector('#mzAmiciPanel [data-versa="legno"] [data-q="50"]:not(:disabled)', { timeout: 15000 });
      const p0 = (await get('/api/faro', 'tokL')).body.faro.legno, l0 = (await get('/api/lot', 'tokL')).body.resources.legno;
      await ctx.waitState(tp, (s, w) => s.portoAmici.faro.dati.legno === w.p && s.lot.resources.legno === w.l, 15000, { p: p0, l: l0 });
      assert((await tp.locator('#mzAmiciPanel .mz-pa-lv').innerText()).includes('1/3'), 'livello in testata');
      await tp.locator('#mzAmiciPanel [data-versa="legno"] [data-q="50"]').tap();
      await ctx.waitState(tp, (s, w) => s.portoAmici.faro.dati.legno === w.p && s.lot.resources.legno === w.l && !s.portoAmici.ui.busy, 15000, { p: p0 + 50, l: l0 - 50 });
      assert(/Versati 50 Legno/.test((await tst()).portoAmici.ui.note ?? ''), 'nota: ' + (await tst()).portoAmici.ui.note);
      await dentro(tp, '#mzAmiciPanel', 390, 844);
      await tp.waitForTimeout(250);
      await ctx.shot(tp, 'iphone_faro');
      await tp.locator('#mzAmiciPanel').evaluate((e) => { e.scrollTop = e.scrollHeight; });
      await tp.waitForTimeout(250);
      await ctx.shot(tp, 'iphone_faro_classifica');
      await th('amiciChiudi');
      // come sarà al livello 3 (solo resa: i dati restano al livello 1)
      await th('amiciMostra', 3); await th('teleport', f.x - 3, f.z - 3); await th('setZoom', 1.6);
      await ctx.waitState(tp, (s) => s.portoAmici.faro.modello === 'bld_faro_l2' && s.portoAmici.faro.scala > 1.4, 10000);
      await tp.waitForTimeout(700);
      await ctx.shot(tp, 'iphone_faro_l3_resa');
      await th('amiciMostra', 1);
      ctx.noErrors(T, 'telefono');
    });

    await ctx.test('PC (Mia): E apre tabellone e faro; di notte il fascio del faro gira', async () => {
      const D = await open('tokM', ctx.B.DESKTOP, '&serie=1'), dp = D.page;
      const dh = (n, ...a) => dp.evaluate(([n, a]) => window.__game.test[n](...a), [n, a]);
      const t = await posto(dp, 'record');
      await dh('teleport', t.fronte.x, t.fronte.z); await dh('setZoom', 0.9);
      await ctx.waitState(dp, (s) => s.portoAmici.near === 'record', 8000);
      await dp.keyboard.press('KeyE');
      try { await ctx.waitState(dp, (s) => s.portoAmici.open === 'record' && s.portoAmici.ui.righe, 15000); }
      catch (e) { const s = await ctx.getState(dp); ctx.log('DEBUG', JSON.stringify({ pa: { ...s.portoAmici, faro: undefined }, porto: s.porto?.open, libro: s.libro?.open })); await ctx.shot(dp, 'debug'); throw e; }
      await dp.waitForTimeout(300);
      await ctx.shot(dp, 'desktop_record');
      await dp.keyboard.press('Escape');
      await ctx.waitState(dp, (s) => s.portoAmici.open === null, 5000);
      const f = await posto(dp, 'faro');
      await dh('teleport', f.fronte.x, f.fronte.z); await dh('setZoom', 0.9);
      await ctx.waitState(dp, (s) => s.portoAmici.near === 'faro', 8000);
      await dp.waitForTimeout(400);
      await dp.keyboard.press('KeyE');
      await ctx.waitState(dp, (s) => s.portoAmici.open === 'faro' && s.portoAmici.faro.dati?.livello === 1, 15000);
      await dp.waitForSelector('#mzAmiciPanel [data-chi="luca"]', { timeout: 10000 });
      await dp.waitForTimeout(300);
      await ctx.shot(dp, 'desktop_faro');
      await dp.keyboard.press('Escape');
      await ctx.waitState(dp, (s) => s.portoAmici.open === null, 5000);
      await dp.evaluate(() => window.__game.test.aspettoPronto());
      await dh('ciclo', 0.78);
      await dh('teleport', f.x + 4, f.z + 22); await dh('setZoom', 1.6);
      await ctx.waitState(dp, (s) => s.aspetto.momento === 'notte' && s.portoAmici.faro.fascio, 15000);
      await dp.waitForTimeout(1200);
      await ctx.shot(dp, 'desktop_faro_notte');
      await dh('ciclo', null);
      ctx.noErrors(D, 'PC');
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
