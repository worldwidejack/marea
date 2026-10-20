// Le botteghe del Borgo (#414) sul server locale (wrangler dev): API (vetrina di oggi sì, il resto 409; Fabbro e barca al Cantiere salgono
// di livello col `da`; le vernici del Cantiere solo il loro giorno) e nel browser: le tre casette sparse per il Borgo coi bottegai,
// davanti al banco il bottone col nome e A apre il pannello; Compra dalla vetrina (monete giù, oggetto nello zaino), Forgia, Livello →
// Migliora, Barca. Telefono 390×844: carta, schede e bottoni dentro lo schermo, ≥ 44 px. Screenshot: le botteghe da fuori (PC e telefono),
// i pannelli delle tre botteghe, coi loro caratteri.
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
  const persist = path.join(ctx.OUT, `m3botteghe-${process.pid}`);
  const env = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' };
  const wr = (...a) => execFileSync('npx', ['--no-install', 'wrangler', ...a], { cwd: SERVER, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 }).toString();
  const sim = async (f) => import(pathToFileURL(path.join(ctx.ROOT, 'packages/sim/src', f)).href);
  const { vetrinaBottega } = await sim('economy/botteghe.ts');
  const { vetrinaOggetti, prezzoVetrina } = await sim('rpg/botteghe.ts');
  const botteghe = JSON.parse(fs.readFileSync(path.join(ctx.ROOT, 'packages/content/src/botteghe.json'), 'utf8'));

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
    const rpg = (azione, tok = 'tokL') => post('/api/rpg', { azione }, tok);
    for (const tok of ['tokL', 'tokA']) assert((await post('/api/test/monete', { n: 6000 }, tok)).status === 200, 'monete di prova');

    await ctx.test('API: si compra solo la vetrina di oggi; Fabbro e barca salgono di livello col `da`; le vernici del Cantiere solo il loro giorno', async () => {
      const ora = Date.now(), m0 = (await get('/api/lot', 'tokA')).body.monete;
      const pezzo = vetrinaOggetti('fabbro', ora)[0], prezzo = prezzoVetrina('fabbro', pezzo);
      const ok = await rpg({ t: 'vetrina', bottega: 'fabbro', item: pezzo, n: 1 }, 'tokA');
      assert(ok.status === 200 && (ok.body.hero.inv[pezzo] ?? 0) + (ok.body.forziere?.[pezzo] ?? 0) >= 1 && ok.body.monete === m0 - prezzo, 'vetrina del Fabbro: ' + JSON.stringify(ok.body).slice(0, 200));
      const fuori = botteghe.fabbro.scomparti.flat().flatMap((t) => botteghe.fabbro.materiali.map((m) => `${t}_${m}`)).find((id) => !vetrinaOggetti('fabbro', ora).includes(id));
      const no = await rpg({ t: 'vetrina', bottega: 'fabbro', item: fuori, n: 1 }, 'tokA');
      assert(no.status === 409 && no.body.code === 'oggetto', 'fuori vetrina: ' + JSON.stringify(no));
      const f1 = await post('/api/lot/bottega/migliora', { bottega: 'fabbro', da: 1 }, 'tokA');
      assert(f1.status === 200 && f1.body.botteghe?.fabbro === 2, 'Fabbro al 2: ' + JSON.stringify(f1.body).slice(0, 200));
      const doppio = await post('/api/lot/bottega/migliora', { bottega: 'fabbro', da: 1 }, 'tokA');
      assert(doppio.status === 409 && doppio.body.code === 'livello', 'stesso `da` due volte: ' + JSON.stringify(doppio));
      const c1 = await post('/api/lot/bottega/migliora', { bottega: 'cantiere', da: 1 }, 'tokA');
      assert(c1.status === 200 && c1.body.buildings.find((b) => b.building === 'molo')?.level === 2, 'barca al 2: ' + JSON.stringify(c1.body).slice(0, 200));
      const rotto = await post('/api/lot/bottega/migliora', { bottega: 'segheria', da: 1 }, 'tokA');
      assert(rotto.status === 400, 'bottega sconosciuta: ' + rotto.status);
      const oggi = vetrinaBottega('cantiere', ora), domani = botteghe.cantiere.scomparti.flat().find((id) => !oggi.includes(id));
      const v = await post('/api/barca/colore', { id: oggi[0] }, 'tokA');
      assert(v.status === 200 && v.body.posseduti?.includes('barca:' + oggi[0]), 'vernice di oggi: ' + JSON.stringify(v.body).slice(0, 200));
      const vd = await post('/api/barca/colore', { id: domani }, 'tokA');
      assert(vd.status === 409, 'vernice non in vetrina: ' + JSON.stringify(vd));
    });

    const open = async (viewport, tok = 'tokL', q = '') => {
      const pg = await ctx.B.openPage(ctx.browser, `${BASE}/?t=${tok}&test=1${q}`, { viewport });
      pages.push(pg); ctx._pages.push(pg);
      await ctx.waitReady(pg.page, 30000);
      await ctx.waitState(pg.page, (s) => s.lot && s.lot.ready && s.botteghe && s.botteghe.posti.length === 3 && s.botteghe.posti.every((p) => p.bottegaio), 40000);
      const hook = (n, ...a) => pg.page.evaluate(([n, a]) => window.__game.test[n](...a), [n, a]);
      return { pg, page: pg.page, hook, st: () => ctx.getState(pg.page) };
    };
    const davanti = async (V, id) => {
      await V.hook('bottegaVai', id, 0);
      await ctx.waitState(V.page, (s, b) => s.botteghe.near === b, 8000, id);
      await V.page.waitForTimeout(600);
    };
    const pannello = async (V, id) => {
      await V.page.locator('#mzBottegaBtn.on').click();
      await ctx.waitState(V.page, (s, b) => s.bottegaUi && s.bottegaUi.aperta === b && s.bottegaUi.righe.length >= 1, 8000, id);
      await V.page.waitForTimeout(700); // il ritratto
    };

    await ctx.test('PC: le tre casette nel Borgo coi bottegai; davanti al banco il bottone; il pannello del Fabbro, Compra dalla vetrina', async () => {
      const V = await open(ctx.B.DESKTOP);
      await V.page.evaluate(() => { const c = document.getElementById('compass'); if (c?.classList.contains('open')) c.querySelector('.mz-mete-head button')?.click(); }); // la lista delle mete copre la spiaggia
      await V.hook('setZoom', 1.2);
      for (const id of ['fabbro', 'alchimista', 'cantiere']) { await V.hook('bottegaVai', id, 3.2); await V.page.waitForTimeout(2600); await ctx.shot(V.page, 'botteghe_pc_fuori_' + id); }
      await davanti(V, 'fabbro');
      const testo = await V.page.locator('#mzBottegaBtn').innerText();
      assert(/FABBRO/.test(testo), 'bottone: ' + testo);
      await pannello(V, 'fabbro');
      await ctx.shot(V.page, 'botteghe_pc_fabbro');
      const m0 = (await V.st()).lot.monete;
      await V.page.locator('#mzBottega [data-k^="vetrina:"] [data-act="vetrina"]').first().click();
      await ctx.waitState(V.page, (s, m) => s.lot.monete < m && !s.bottegaUi.busy, 10000, m0);
      await V.page.locator('#mzBottega [data-tab="forgia"]').click();
      await V.page.waitForTimeout(300);
      await ctx.shot(V.page, 'botteghe_pc_forgia');
      await V.page.locator('#mzBottega [data-tab="livello"]').click();
      await V.page.waitForTimeout(300);
      await ctx.shot(V.page, 'botteghe_pc_livello');
      await V.page.locator('#mzBottega [data-act="migliora"]').first().click();
      await ctx.waitState(V.page, (s) => !s.bottegaUi.busy && s.bottegaUi.righe.some((r) => r.k === 'livello:2' && r.off), 10000);
      assert((await get('/api/lot')).body.botteghe?.fabbro === 2, 'Fabbro al 2 dal pannello');
      await V.page.keyboard.press('Escape');
      await ctx.waitState(V.page, (s) => !s.bottegaUi.aperta, 5000);
      await davanti(V, 'alchimista'); await pannello(V, 'alchimista');
      await ctx.shot(V.page, 'botteghe_pc_alchimista');
      await V.page.locator('#mzBottega [data-act="chiudi"]').click();
      await davanti(V, 'cantiere'); await pannello(V, 'cantiere');
      await ctx.shot(V.page, 'botteghe_pc_cantiere');
      await V.page.locator('#mzBottega [data-tab="barca"]').click();
      await V.page.waitForTimeout(300);
      await ctx.shot(V.page, 'botteghe_pc_barca');
      ctx.noErrors(V.pg);
    });

    await ctx.test('telefono 390×844: carta e bottoni dentro lo schermo, ≥ 44 px; un carattere per bottega, titolo su una riga lontano dalla X', async () => {
      const V = await open(ctx.B.IPHONE, 'tokA');
      await V.hook('bottegaVai', 'fabbro', 3.2);
      await V.hook('setZoom', 1.3);
      await V.page.waitForTimeout(2800);
      await ctx.shot(V.page, 'botteghe_tel_fuori');
      await davanti(V, 'fabbro'); await pannello(V, 'fabbro');
      const vw = await V.page.evaluate(() => ({ w: innerWidth, h: innerHeight }));
      const r = await V.page.locator('#mzBottega .bt-carta').boundingBox();
      assert(r && r.x >= 0 && r.y >= 0 && r.x + r.width <= vw.w && r.y + r.height <= vw.h, 'carta fuori schermo: ' + JSON.stringify(r));
      for (const b of await V.page.locator('#mzBottega .bt-compra, #mzBottega .bt-x, #mzBottega .bt-tab').all()) {
        const bb = await b.boundingBox();
        if (bb && bb.y < vw.h) assert(bb.height >= 40 && bb.width >= 40, 'bottone piccolo: ' + JSON.stringify(bb));
      }
      // i caratteri delle botteghe (uno per bottega) arrivati e il titolo su una riga, dentro, che non tocca la X
      await V.page.evaluate(() => document.fonts.ready);
      const fonti = await V.page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/["']/g, '')));
      for (const f of ['MzCinzel', 'MzAlegreyaSans']) assert(fonti.includes(f), 'carattere non caricato: ' + f + ' in ' + fonti.join(','));
      await ctx.shot(V.page, 'botteghe_tel_fabbro');
      for (const id of ['alchimista', 'cantiere']) {
        await V.page.locator('#mzBottega [data-act="chiudi"]').click();
        await davanti(V, id); await pannello(V, id); await V.page.evaluate(() => document.fonts.ready); await V.page.waitForTimeout(300);
        const t = await V.page.locator('#mzBottega .bt-titolo').boundingBox(), x = await V.page.locator('#mzBottega .bt-x').boundingBox();
        assert(t && x && t.x + t.width <= x.x + 1 && t.height < 60, `${id}: titolo addosso alla X o su due righe ` + JSON.stringify({ t, x }));
        await ctx.shot(V.page, 'botteghe_tel_' + id);
      }
      await V.page.locator('#mzBottega [data-act="chiudi"]').click();
      ctx.noErrors(V.pg);
    });
  } finally {
    for (const p of pages) await p.close().catch(() => {});
    if (dev) { try { process.kill(-dev.pid, 'SIGTERM'); } catch { /* già finito */ } await sleep(500); try { process.kill(-dev.pid, 'SIGKILL'); } catch { /* ok */ } }
    fs.rmSync(persist, { recursive: true, force: true });
  }
}
