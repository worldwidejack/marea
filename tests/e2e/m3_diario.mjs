// Diario del capitano e traguardi (#87) sul server locale (wrangler dev, D1 e DO in una cartella privata). API: una pesca dell'autopilota
// rigiocata dal server riempie la pagina Pesci (specie e quante volte), la medaglia e le partite; avvistamenti validati (niente id
// inventati, niente la propria isola, solo lotti di amici veri); RISCUOTI una volta sola (Perle nel lotto), titolo solo se riscosso, e
// il titolo resta anche quando l'editor salva il look. Browser telefono 390×844 (Luca): bottone col libro, album sui pesci, scheda di un
// pesce, Traguardi → RISCUOTI → USA TITOLO, targhetta col titolo sopra la testa, avviso quando si compie un traguardo. PC (Mia): sull'isola
// di Luca vede «Campione» sotto il suo nome (e il cambio dal vivo), la visita si segna nel diario, J apre il diario, sfoglia quello di Luca.
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
  const { traguardi } = read('traguardi.json'), pescaCfg = read('minigames/pesca.json');
  const T = (id) => traguardi.find((t) => t.id === id);
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
    const autoplay = (id, seed, difficulty, opzioni) => {
      const m = sim.getMinigame(id), s = m.create({ seed, difficulty, opzioni }), rng = sim.createRng(1), frames = [];
      for (let i = 0; i < m.maxTicks && !m.result(s).done; i++) { const f = sim.quantize(m.autopilot(s, rng)); frames.push(f); m.step(s, f); }
      return { frames, r: m.result(s), presi: s.presi ?? [] };
    };
    let presi = [];

    await ctx.test('API: una pesca rigiocata dal server riempie il diario (specie e quante, medaglia, partite)', async () => {
      const st = await post('/api/solo/start', 'tokL', { minigame: 'pesca', opzioni: { mare: 'porto' } });
      assert(st.status === 200, 'start: ' + st.status);
      const local = autoplay('pesca', st.body.seed, st.body.difficulty, { mare: 'porto' });
      const r = await post('/api/solo/play', 'tokL', { inputs: sim.packInputs(local.frames) });
      assert(r.status === 200 && r.body.medal === 'oro', 'play: ' + JSON.stringify(r.body).slice(0, 200));
      presi = local.presi;
      const d = r.body.lot.diario, conta = {};
      for (const id of presi) conta[id] = (conta[id] ?? 0) + 1;
      assert(JSON.stringify(Object.entries(d.pesci).sort()) === JSON.stringify(Object.entries(conta).sort()), `pesci ${JSON.stringify(d.pesci)} ≠ presi ${JSON.stringify(conta)}`);
      assert(d.medaglie.pesca === 'oro' && d.giocati.pesca === 1, 'medaglia/partite: ' + JSON.stringify(d));
      ctx.log(`pesca: ${presi.length} pesci, ${Object.keys(conta).length} specie`);
    });

    await ctx.test('API: avvistamenti validati (id inventati, la propria isola e lotti di sconosciuti scartati), una volta sola', async () => {
      const a = await post('/api/diario/visto', 'tokL', { animali: ['gabbiano', 'drago'], isole: ['porto', 'lotto:mia', 'lotto:luca', 'lotto:nessuno', 'atlantide'] });
      assert(a.status === 200 && JSON.stringify(a.body.nuovi) === JSON.stringify({ animali: ['gabbiano'], isole: ['porto', 'lotto:mia'] }), 'visto: ' + JSON.stringify(a.body.nuovi));
      const b = await post('/api/diario/visto', 'tokL', { animali: ['gabbiano'] });
      assert(b.status === 200 && b.body.nuovi.animali.length === 0, 'doppione: ' + JSON.stringify(b.body.nuovi));
      const c = await post('/api/diario/visto', 'tokL', { animali: 'gabbiano' });
      assert(c.status === 400, 'forma sbagliata: ' + c.status);
    });

    await ctx.test('API: RISCUOTI una volta sola (Perle nel lotto), non compiuto 409, sconosciuto 404; titolo solo se riscosso', async () => {
      const prima = (await get('/api/lot', 'tokL')).body.resources.perle;
      const no = await post('/api/diario/riscuoti', 'tokL', { id: 'avventuriero' });
      assert(no.status === 409 && /Non ancora/.test(no.body.error), 'non compiuto: ' + JSON.stringify(no));
      assert((await post('/api/diario/riscuoti', 'tokL', { id: 'boh' })).status === 404, 'sconosciuto');
      const ok = await post('/api/diario/riscuoti', 'tokL', { id: 'primo_pesce' });
      assert(ok.status === 200 && ok.body.premio.perle === T('primo_pesce').perle && ok.body.lot.resources.perle === prima + T('primo_pesce').perle, 'riscuoti: ' + JSON.stringify(ok.body).slice(0, 200));
      const due = await post('/api/diario/riscuoti', 'tokL', { id: 'primo_pesce' });
      assert(due.status === 409 && /già riscosso/.test(due.body.error), 'seconda volta: ' + JSON.stringify(due));
      assert((await get('/api/lot', 'tokL')).body.resources.perle === prima + T('primo_pesce').perle, 'pagato due volte');
      const tNo = await post('/api/diario/titolo', 'tokL', { id: 'avventuriero' });
      assert(tNo.status === 409, 'titolo non riscosso: ' + tNo.status);
      const t = await post('/api/diario/titolo', 'tokL', { id: 'primo_pesce' });
      assert(t.status === 200 && t.body.diario.titolo === 'primo_pesce', 'titolo: ' + JSON.stringify(t.body.diario));
      const me = (await get('/api/me', 'tokL')).body;
      assert(me.look.titolo === 'primo_pesce', 'il titolo va col look: ' + JSON.stringify(me.look));
      // l'editor salva il look senza titolo: il titolo resta
      const lk = await post('/api/look', 'tokL', { pelle: 1, capelli: 2, coloreCapelli: 1, vestito: 3, cappello: 0 });
      assert(lk.status === 200, 'look: ' + lk.status);
      const lots = (await get('/api/lots', 'tokM')).body;
      const l = lots.find((x) => x.id === 'luca');
      assert(l.look.titolo === 'primo_pesce' && l.look.vestito === 3, 'dopo /api/look: ' + JSON.stringify(l.look));
    });

    // ---------- telefono (Luca) ----------
    const P = await ctx.B.openPage(ctx.browser, `${base}/?t=tokL&test=1`, { viewport: ctx.B.IPHONE }); pages.push(P); ctx._pages.push(P);
    const page = P.page;
    await ctx.waitReady(page, 30000);
    await ctx.waitState(page, (s) => s.lot && s.lot.ready === true && s.diario && s.animali, 30000);
    const hook = (n, ...a) => page.evaluate(([n, a]) => window.__game.test[n](...a), [n, a]);
    await hook('animali', false); // gli avvistamenti li decide il test (gli animali veri ne segnerebbero da soli)
    const st = () => ctx.getState(page);

    await ctx.test('telefono: bottone col libro con il numerino dei traguardi da riscuotere; J/tocco apre l\'album sui Pesci', async () => {
      const s = await st();
      assert(s.diario.badge >= 2, 'badge: ' + s.diario.badge);
      assert(await page.locator('#mzDiarioBtn .mz-badge.on').count() === 1, 'numerino non visibile');
      await page.locator('#mzDiarioBtn').click();
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

    await ctx.test('telefono: Traguardi → RISCUOTI «Primo oro» (Perle in tasca) → USA TITOLO', async () => {
      await page.locator('#mzDiario [data-tab="traguardi"]').click();
      await ctx.waitState(page, (s) => s.diario.ui.tab === 'traguardi', 5000);
      await sleep(200);
      await ctx.shot(page, 'iphone_2_traguardi');
      const perle = (await st()).lot.resources.perle;
      await page.locator('#mzDiario [data-traguardo="primo_oro"] [data-act="riscuoti"]').click();
      await ctx.waitState(page, (s) => s.diario.riscossi.includes('primo_oro') && !s.diario.ui.busy, 10000);
      const s1 = await st();
      assert(s1.lot.resources.perle === perle + T('primo_oro').perle, `Perle ${perle} → ${s1.lot.resources.perle}`);
      await page.locator('#mzDiario [data-traguardo="primo_oro"] [data-act="titolo"]').click();
      await ctx.waitState(page, (s) => s.diario.titolo === 'primo_oro' && !s.diario.ui.busy, 10000);
      assert(/Campione/.test(await page.locator('#mzDiario .chi-t').innerText()), 'titolo in testata');
      await page.locator('#mzDiario [data-traguardo="primo_oro"]').scrollIntoViewIfNeeded();
      await sleep(250);
      await ctx.shot(page, 'iphone_3_titolo');
    });

    await ctx.test('telefono: chiuso il diario, sopra la testa c\'è il nome col titolo; un traguardo nuovo fa comparire l\'avviso', async () => {
      await page.locator('#mzDiario [data-act="chiudi"]').click();
      await ctx.waitState(page, (s) => !s.diario.open, 5000);
      await ctx.waitState(page, (s) => s.targhette.some((t) => t.who === 'me' && t.titolo === 'Campione' && t.on), 5000);
      for (const a of ['gatto', 'granchio', 'pesce', 'delfino']) await hook('diarioAvvista', a);
      await ctx.waitState(page, (s) => s.diario.avviso === 'Cinque animali', 15000);
      await sleep(250);
      await ctx.shot(page, 'iphone_4_avviso');
      const s = await st();
      assert(s.diario.animali.length === 5, 'animali: ' + s.diario.animali.join(','));
      ctx.noErrors(P, 'telefono');
    });

    // ---------- PC (Mia) ----------
    const D = await ctx.B.openPage(ctx.browser, `${base}/?t=tokM&test=1`, { viewport: ctx.B.DESKTOP }); pages.push(D); ctx._pages.push(D);
    const dp = D.page;
    await ctx.waitReady(dp, 60000);
    await ctx.waitState(dp, (s) => s.lot && s.lot.ready === true && s.diario, 60000);
    const dhook = (n, ...a) => dp.evaluate(([n, a]) => window.__game.test[n](...a), [n, a]);

    await ctx.test('PC: sull\'isola di Luca si vede «Campione» sotto il suo nome; la visita finisce nel diario di Mia', async () => {
      await dhook('goto', 'lotto:0');
      await ctx.waitState(dp, (s) => s.targhette.some((t) => t.who === 'luca' && t.nome === 'Luca' && t.titolo === 'Campione' && t.on), 20000);
      await ctx.waitState(dp, (s) => s.diario.isole.includes('lotto:luca'), 10000);
      await sleep(300);
      await ctx.shot(dp, 'desktop_1_targa');
    });

    await ctx.test('PC: J apre il diario (album vuoto, caselle col «?»), si sfoglia quello di Luca, J chiude', async () => {
      await dp.keyboard.press('KeyJ');
      await ctx.waitState(dp, (s) => s.diario.open && s.diario.ui && s.diario.ui.tab === 'pesci', 15000);
      assert(await dp.locator('#mzDiario .mz-dia-cell.no').count() === pescaCfg.pesci.length, 'Mia non ha pescato niente: tutte grigie');
      await sleep(200);
      await ctx.shot(dp, 'desktop_2_vuoto');
      await dp.locator('#mzDiario .mz-dia-chi [data-chi="luca"]').click();
      await ctx.waitState(dp, (s) => s.diario.ui.chi === 'luca' && !s.diario.ui.carica, 10000);
      await dp.locator('#mzDiario [data-tab="medaglie"]').click();
      await ctx.waitState(dp, (s) => s.diario.ui.tab === 'medaglie', 5000);
      assert(/oro/i.test(await dp.locator('#mzDiario [data-minigioco="pesca"]').innerText()), 'medaglia di Luca alla pesca');
      assert(/Campione/.test(await dp.locator('#mzDiario .chi-t').innerText()), 'titolo di Luca in testata');
      await dp.locator('#mzDiario [data-tab="traguardi"]').click();
      assert(await dp.locator('#mzDiario [data-act="riscuoti"]').count() === 0, 'nel diario di un altro non si riscuote');
      await dp.locator('#mzDiario [data-tab="medaglie"]').click();
      await sleep(200);
      await ctx.shot(dp, 'desktop_3_luca');
      await dp.keyboard.press('KeyJ');
      await ctx.waitState(dp, (s) => !s.diario.open, 5000);
    });

    await ctx.test('PC: Luca cambia titolo e Mia lo vede cambiare dal vivo', async () => {
      const r = await post('/api/diario/titolo', 'tokL', { id: 'primo_pesce' });
      assert(r.status === 200, 'titolo: ' + r.status);
      await ctx.waitState(dp, (s) => s.targhette.some((t) => t.who === 'luca' && t.titolo === 'Mozzo'), 15000);
      const via = await post('/api/diario/titolo', 'tokL', { id: null });
      assert(via.status === 200 && via.body.diario.titolo === null, 'togli titolo');
      await ctx.waitState(dp, (s) => s.targhette.some((t) => t.who === 'luca' && t.titolo === null), 15000);
      ctx.noErrors(D, 'PC');
    });
  } finally {
    for (const p of pages) await p.close().catch(() => {});
    if (dev) { try { process.kill(-dev.pid, 'SIGTERM'); } catch { /* già finito */ } await sleep(500); try { process.kill(-dev.pid, 'SIGKILL'); } catch { /* ok */ } }
    fs.rmSync(persist, { recursive: true, force: true });
  }
}
