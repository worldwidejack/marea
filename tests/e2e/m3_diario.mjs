// Diario del capitano sul server locale (wrangler dev, D1 e DO in una cartella privata). API: una caccia alle perle dell'autopilota
// rigiocata dal server dà la medaglia e le partite, due pesci presi con la canna riempiono la pagina Pesci; avvistamenti validati
// (niente id inventati, niente la propria isola, solo lotti di amici veri); le rotte dei traguardi (tolti, tag archivio/spenti-traguardi)
// non ci sono più e il look salvato non porta titoli. Browser telefono 390×844 (Luca): J apre l'album sui pesci, scheda di un pesce, niente
// targhetta sopra la propria testa né avvisi di traguardi. PC (Mia): davanti a casa di Luca vede il suo nome sopra la testa, la casa non si segna
// come isola, J apre il diario (6 pagine, niente Traguardi), sfoglia quello di Luca.
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
export const timeout = 240000;

const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function (ctx) {
  const { assert } = ctx;
  const SERVER = path.join(ctx.ROOT, 'apps/server');
  const persist = path.join(ctx.OUT, `m3diario-${process.pid}`);
  const env = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' };
  const wr = (...a) => execFileSync('npx', ['--no-install', 'wrangler', ...a], { cwd: SERVER, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 }).toString();
  const read = (f) => JSON.parse(fs.readFileSync(path.join(ctx.ROOT, 'packages/content/src', f), 'utf8'));
  const pescaCfg = read('pesci.json');
  const pages = [];
  let dev = null, log = '';
  try {
    fs.rmSync(persist, { recursive: true, force: true });
    wr('d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', persist);
    wr('d1', 'execute', 'DB', '--local', '--persist-to', persist, '--command',
      "INSERT INTO persone (id, nome, token, slot) VALUES ('luca', 'Luca', 'tokL', 0), ('mia', 'Mia', 'tokM', 1);");
    const port = await freePort(), inspector = await freePort();
    dev = spawn('npx', ['--no-install', 'wrangler', 'dev', '--local', '--ip', '127.0.0.1', '--port', String(port), '--inspector-port', String(inspector),
      '--assets', ctx.distDir, '--persist-to', persist, '--show-interactive-dev-session=false'], { cwd: SERVER, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    dev.stdout.on('data', (d) => (log += d)); dev.stderr.on('data', (d) => (log += d));
    const base = `http://127.0.0.1:${port}`;
    let up = false;
    for (let i = 0; i < 120 && !up; i++) { try { up = (await fetch(base + '/api/ping')).ok; } catch { /* non ancora */ } if (!up) await sleep(500); }
    if (!up) throw new Error('wrangler dev non risponde:\n' + log.split('\n').slice(-20).join('\n'));
    const post = async (p, t, b) => { const r = await fetch(base + p, { method: 'POST', headers: { 'x-token': t, 'content-type': 'application/json' }, body: JSON.stringify(b ?? {}) }); return { status: r.status, body: await r.json() }; };
    const get = async (p, t) => { const r = await fetch(base + p, { headers: { 'x-token': t } }); return { status: r.status, body: await r.json() }; };
    const sim = await import(pathToFileURL(path.join(ctx.ROOT, 'packages/sim/src/index.ts')).href);
    const simPesci = await import(pathToFileURL(path.join(ctx.ROOT, 'packages/sim/src/economy/pesci.ts')).href);
    const autoplay = (id, seed, difficulty, opzioni) => {
      const m = sim.getMinigame(id), s = m.create({ seed, difficulty, opzioni }), rng = sim.createRng(1), frames = [];
      for (let i = 0; i < m.maxTicks && !m.result(s).done; i++) { const f = sim.quantize(m.autopilot(s, rng)); frames.push(f); m.step(s, f); }
      return { frames, r: m.result(s), presi: s.presi ?? [] };
    };
    let presi = [];

    await ctx.test('API: una caccia alle perle rigiocata dal server dà medaglia e partite; i pesci della canna riempiono la pagina Pesci', async () => {
      const st = await post('/api/solo/start', 'tokL', { minigame: 'perle' });
      assert(st.status === 200, 'start: ' + st.status);
      const local = autoplay('perle', st.body.seed, st.body.difficulty, st.body.opzioni);
      const r = await post('/api/solo/play', 'tokL', { inputs: sim.packInputs(local.frames) });
      assert(r.status === 200 && r.body.medal === 'oro', 'play: ' + JSON.stringify(r.body).slice(0, 200));
      const d = r.body.lot.diario;
      assert(d.medaglie.perle === 'oro' && d.giocati.perle === 1 && !d.medaglie.pesca, 'medaglia/partite: ' + JSON.stringify(d));
      assert((await post('/api/test/monete', 'tokL', { n: 600 })).status === 200, 'monete di prova');
      assert((await post('/api/lot/casa/canna', 'tokL')).status === 200, 'la canna');
      const ombre = simPesci.ombreDelTurno(simPesci.turnoPesciAt(Date.now())).filter((o, i, l) => l.findIndex((x) => x.id === o.id) === i).slice(0, 2);
      for (const o of ombre) {
        const c = await post('/api/lot/pesci/cattura', 'tokL', { k: o.k });
        assert(c.status === 200 && c.body.id === o.id, 'cattura: ' + JSON.stringify(c.body).slice(0, 200));
      }
      presi = ombre.map((o) => o.id);
      ctx.log(`pesci: ${presi.join(', ')}`);
    });

    await ctx.test('API: avvistamenti validati (id inventati, la propria isola e lotti di sconosciuti scartati), una volta sola', async () => {
      const a = await post('/api/diario/visto', 'tokL', { animali: ['gabbiano', 'drago'], isole: ['porto', 'lotto:mia', 'lotto:luca', 'lotto:nessuno', 'atlantide'] });
      assert(a.status === 200 && JSON.stringify(a.body.nuovi) === JSON.stringify({ animali: ['gabbiano'], isole: ['porto', 'lotto:mia'] }), 'visto: ' + JSON.stringify(a.body.nuovi));
      const b = await post('/api/diario/visto', 'tokL', { animali: ['gabbiano'] });
      assert(b.status === 200 && b.body.nuovi.animali.length === 0, 'doppione: ' + JSON.stringify(b.body.nuovi));
      const c = await post('/api/diario/visto', 'tokL', { animali: 'gabbiano' });
      assert(c.status === 400, 'forma sbagliata: ' + c.status);
    });

    await ctx.test('API: le rotte dei traguardi non ci sono più; il look salvato non porta titoli', async () => {
      assert((await post('/api/diario/riscuoti', 'tokL', { id: 'primo_pesce' })).status === 404, 'riscuoti ancora vivo');
      assert((await post('/api/diario/titolo', 'tokL', { id: 'primo_pesce' })).status === 404, 'titolo ancora vivo');
      const lk = await post('/api/look', 'tokL', { pelle: 1, capelli: 2, coloreCapelli: 1, vestito: 3, cappello: 0 });
      assert(lk.status === 200, 'look: ' + lk.status);
      const l = (await get('/api/lots', 'tokM')).body.find((x) => x.id === 'luca');
      assert(l.look.vestito === 3 && !('titolo' in l.look), 'dopo /api/look: ' + JSON.stringify(l.look));
    });

    // ---------- telefono (Luca) ----------
    const P = await ctx.B.openPage(ctx.browser, `${base}/?t=tokL&test=1`, { viewport: ctx.B.IPHONE }); pages.push(P); ctx._pages.push(P);
    const page = P.page;
    await ctx.waitReady(page, 30000);
    await ctx.waitState(page, (s) => s.lot && s.lot.ready === true && s.diario && s.animali, 30000);
    const hook = (n, ...a) => page.evaluate(([n, a]) => window.__game.test[n](...a), [n, a]);
    await hook('animali', false); // gli avvistamenti li decide il test (gli animali veri ne segnerebbero da soli)
    const st = () => ctx.getState(page);

    await ctx.test('telefono: il libro non è più in vista (#417); J apre l\'album sui Pesci', async () => {
      assert(!(await page.locator('#mzDiarioBtn').isVisible()), 'il bottone del libro è ancora in vista');
      await page.keyboard.press('KeyJ');
      await ctx.waitState(page, (s) => s.diario.open && s.diario.ui && s.diario.ui.tab === 'pesci', 15000);
      const box = await page.locator('#mzDiario').boundingBox();
      assert(box && box.x >= 0 && box.x + box.width <= 390 && box.y >= 0 && box.y + box.height <= 844, 'il diario esce dal telefono: ' + JSON.stringify(box));
      for (const id of new Set(presi)) assert(await page.locator(`#mzDiario [data-cella="${id}"]:not(.no)`).count() === 1, `pesce ${id} non segnato`);
      const mai = pescaCfg.pesci.find((p) => !presi.includes(p.id));
      assert(await page.locator(`#mzDiario [data-cella="${mai.id}"].no`).count() === 1, `pesce mai preso ${mai.id} non è grigio`);
      const tab = await page.locator('#mzDiario [data-tab="pesci"]').innerText();
      assert(tab.includes(`${new Set(presi).size}/${pescaCfg.pesci.length}`), 'contatore: ' + tab);
      await page.locator(`#mzDiario [data-cella="${presi[0]}"]`).click();
      const nome = pescaCfg.pesci.find((p) => p.id === presi[0]).nome;
      await page.waitForFunction((n) => document.querySelector('#mzDiario .mz-dia-nota')?.textContent.includes(n), nome, { timeout: 5000 });
      await sleep(250);
      await ctx.shot(page, 'iphone_1_pesci');
    });

    await ctx.test('telefono: chiuso il diario, niente targhetta sopra di sé né avvisi; gli animali avvistati si segnano', async () => {
      await page.locator('#mzDiario [data-act="chiudi"]').click();
      await ctx.waitState(page, (s) => !s.diario.open, 5000);
      for (const a of ['gatto', 'granchio', 'pesce', 'delfino']) await hook('diarioAvvista', a);
      await hook('diarioFlush');
      await ctx.waitState(page, (s) => s.diario.animali.length === 5, 15000);
      await sleep(1000);
      const s = await st();
      assert(!s.targhette.some((t) => t.who === 'me'), 'targhetta sopra di sé: ' + JSON.stringify(s.targhette));
      assert(!(await page.locator('#mzTrag').count()), 'c\'è ancora l\'avviso dei traguardi');
      await ctx.shot(page, 'iphone_2_animali');
      ctx.noErrors(P, 'telefono');
    });

    // ---------- PC (Mia) ----------
    const D = await ctx.B.openPage(ctx.browser, `${base}/?t=tokM&test=1`, { viewport: ctx.B.DESKTOP }); pages.push(D); ctx._pages.push(D);
    const dp = D.page;
    await ctx.waitReady(dp, 60000);
    await ctx.waitState(dp, (s) => s.lot && s.lot.ready === true && s.diario, 60000);
    const dhook = (n, ...a) => dp.evaluate(([n, a]) => window.__game.test[n](...a), [n, a]);

    await ctx.test('PC: davanti a casa di Luca (Borgo, #237) si vede il suo nome sopra la testa; entrare in casa sua non segna un\'isola nel diario di Mia', async () => {
      await dhook('porta', 0);
      await ctx.waitState(dp, (s) => s.stanza.dentro === 0, 10000);
      await sleep(1500); // gli avvistamenti si controllano ogni mezzo secondo
      assert(!(await ctx.getState(dp)).diario.isole.some((i) => i.startsWith('lotto:')), 'casa di Luca segnata come isola: ' + JSON.stringify((await ctx.getState(dp)).diario.isole));
      await dhook('esciDiCasa', 0);
      const porta = (await ctx.getState(dp)).borgo.porte.find((p) => p.slot === 0);
      await dhook('teleport', porta.x + 2, porta.z);
      await ctx.waitState(dp, (s) => s.targhette.some((t) => t.who === 'luca' && t.nome === 'Luca' && t.on), 20000);
      await sleep(300);
      await ctx.shot(dp, 'desktop_1_targa');
    });

    await ctx.test('PC: J apre il diario (album vuoto, caselle col «?», 6 pagine senza Traguardi), si sfoglia quello di Luca, J chiude', async () => {
      await dp.keyboard.press('KeyJ');
      await ctx.waitState(dp, (s) => s.diario.open && s.diario.ui && s.diario.ui.tab === 'pesci', 15000);
      const s = await ctx.getState(dp);
      assert(s.diario.tabs.length === 6 && !s.diario.tabs.includes('traguardi'), 'linguette: ' + s.diario.tabs.join(','));
      assert(await dp.locator('#mzDiario [data-tab]').count() === 6 && await dp.locator('#mzDiario [data-tab="traguardi"]').count() === 0, 'linguetta Traguardi nel DOM');
      assert(await dp.locator('#mzDiario .mz-dia-cell.no').count() === pescaCfg.pesci.length, 'Mia non ha pescato niente: tutte grigie');
      await sleep(200);
      await ctx.shot(dp, 'desktop_2_vuoto');
      await dp.locator('#mzDiario .mz-dia-chi [data-chi="luca"]').click();
      await ctx.waitState(dp, (s) => s.diario.ui.chi === 'luca' && !s.diario.ui.carica, 10000);
      await dp.locator('#mzDiario [data-tab="medaglie"]').click();
      await ctx.waitState(dp, (s) => s.diario.ui.tab === 'medaglie', 5000);
      assert(/oro/i.test(await dp.locator('#mzDiario [data-minigioco="perle"]').innerText()), 'medaglia di Luca alle perle');
      const ct = await dp.locator('#mzDiario .chi-t').innerText();
      assert(/Luca/.test(ct) && !/titolo|«/.test(ct), 'testata: ' + ct);
      await sleep(200);
      await ctx.shot(dp, 'desktop_3_luca');
      await dp.keyboard.press('KeyJ');
      await ctx.waitState(dp, (s) => !s.diario.open, 5000);
    });

    await ctx.test('telefono (Luca): tutti gli animali avvistati, nessun avviso; aprire sui traguardi apre sui Pesci', async () => {
      await page.bringToFront();
      for (const a of ['gabbiano', 'lucciola']) await hook('diarioAvvista', a);
      await hook('diarioFlush');
      await ctx.waitState(page, (s) => s.diario.animali.length === 6, 15000);
      await hook('diarioApri', 'traguardi');
      await ctx.waitState(page, (s) => s.diario.open && s.diario.ui && s.diario.ui.tab === 'pesci', 15000);
      assert(await page.locator('#mzDiario [data-tab]').count() === 6, 'linguette sul telefono');
      const box = await page.locator('#mzDiario').boundingBox();
      assert(box && box.x >= 0 && box.x + box.width <= 390 && box.y >= 0 && box.y + box.height <= 844, 'il diario esce dal telefono: ' + JSON.stringify(box));
      await sleep(250);
      await ctx.shot(page, 'iphone_3_album');
      ctx.noErrors(P, 'telefono');
      ctx.noErrors(D, 'PC');
    });
  } finally {
    for (const p of pages) await p.close().catch(() => {});
    if (dev) { try { process.kill(-dev.pid, 'SIGTERM'); } catch { /* già finito */ } await sleep(500); try { process.kill(-dev.pid, 'SIGKILL'); } catch { /* ok */ } }
    fs.rmSync(persist, { recursive: true, force: true });
  }
}
