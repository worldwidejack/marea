// M1-isola: vista economica della propria isola (game/lot.ts + net/api.ts + ui/) su wrangler dev locale con D1 in una cartella propria.
// Pagina di prova apps/client/src/ui/lot_harness.html (costruita qui con vite): isola del template + LotView, senza world.ts.
// Flusso: entra → barra risorse = partenza del balance → tap vero su uno slot → build mode → Segheria → timer → errore del server in italiano
// → cantiere finito → deposito ≥ 1 → tap vero sull'edificio → raccogli (volo) → migliora → «ti mancano» → visita in sola lettura → link non valido.
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
export const timeout = 480000;

const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const RES = ['legno', 'pietra', 'perle'];
const NOMI = { legno: 'Legno', pietra: 'Pietra', perle: 'Perle' };
const mancaText = (m) => { const p = RES.filter((k) => m[k] > 0).map((k) => `${m[k]} ${NOMI[k]}`); const l = p.pop(); return l ? `ti mancano ${p.length ? p.join(', ') + ' e ' : ''}${l}` : ''; };
/**
 * Errori della pagina. Chrome stampa ogni risposta HTTP ≥ 400 come «Failed to load resource» senza URL: si confrontano con le risposte
 * registrate (p.bad) e si tollerano solo quelle attese dal test (`allow`: [status, pezzo di URL]).
 */
const errorsOf = (p, allow = []) => [
  ...p.errors.map((e) => 'pageerror: ' + e),
  ...p.consoleErrors.filter((e) => !e.startsWith('Failed to load resource')).map((e) => 'console: ' + e),
  ...p.bad.filter((b) => !allow.some(([st, u]) => b.status === st && b.url.includes(u))).map((b) => `http ${b.status}: ${b.url}`),
  ...p.failed.map((e) => 'request: ' + e),
];
/** Come B.openPage, ma registra le risposte HTTP ≥ 400 fin dal primo caricamento. */
async function openPage(browser, url, IPHONE) {
  const c = await browser.newContext({ viewport: { width: IPHONE.width, height: IPHONE.height }, deviceScaleFactor: IPHONE.deviceScaleFactor, isMobile: true, hasTouch: true });
  const page = await c.newPage();
  const p = { page, errors: [], consoleErrors: [], failed: [], bad: [], close: () => c.close() };
  page.on('pageerror', (e) => p.errors.push(String(e && (e.stack || e.message) || e)));
  page.on('console', (m) => { if (m.type() === 'error') p.consoleErrors.push(m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) p.bad.push({ status: r.status(), url: r.url() }); });
  page.on('requestfailed', (r) => { const why = r.failure()?.errorText || ''; if (why !== 'net::ERR_ABORTED') p.failed.push(r.url() + ' ' + why); });
  await page.goto(url, { waitUntil: 'load' });
  return p;
}

export default async function (ctx) {
  const CLIENT = path.join(ctx.ROOT, 'apps/client'), SERVER = path.join(ctx.ROOT, 'apps/server');
  const dist = path.join(ctx.OUT, `m1_isola-dist-${process.pid}`), persist = path.join(ctx.OUT, `m1_isola-${process.pid}`);
  const balance = JSON.parse(fs.readFileSync(path.join(ctx.ROOT, 'packages/content/src/balance.json'), 'utf8'));
  const buildings = JSON.parse(fs.readFileSync(path.join(ctx.ROOT, 'packages/content/src/buildings.json'), 'utf8'));
  const env = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' };
  const wr = (...a) => execFileSync('npx', ['--no-install', 'wrangler', ...a], { cwd: SERVER, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 }).toString();
  let dev = null, log = '';
  const pages = [];
  try {
    // --- pagina di prova: vite build con la config del client e l'html della prova come unico ingresso ---
    const { build } = await import('vite');
    await build({ configFile: path.join(CLIENT, 'vite.config.ts'), root: CLIENT, logLevel: 'error', build: { outDir: dist, emptyOutDir: true, rollupOptions: { input: { prova: path.join(CLIENT, 'src/ui/lot_harness.html') } } } });
    const htmlRel = 'src/ui/lot_harness.html';
    ctx.log('pagina di prova costruita');
    ctx.assert(fs.existsSync(path.join(dist, htmlRel)), 'la pagina di prova non è stata costruita');

    fs.rmSync(persist, { recursive: true, force: true });
    wr('d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', persist);
    wr('d1', 'execute', 'DB', '--local', '--persist-to', persist, '--command', "INSERT INTO persone (id, nome, token) VALUES ('isola', 'Isola', 'tokI'), ('amico', 'Amico', 'tokA');");
    ctx.log('D1 pronto');
    const port = await freePort(), inspector = await freePort();
    dev = spawn('npx', ['--no-install', 'wrangler', 'dev', '--local', '--ip', '127.0.0.1', '--port', String(port), '--inspector-port', String(inspector),
      '--assets', dist, '--persist-to', persist, '--var', 'MAREA_TEST:1', '--show-interactive-dev-session=false'], { cwd: SERVER, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    dev.stdout.on('data', (d) => (log += d)); dev.stderr.on('data', (d) => (log += d));
    const base = `http://127.0.0.1:${port}`;
    let up = false;
    for (let i = 0; i < 120 && !up; i++) { try { up = (await fetch(base + '/api/ping')).ok; } catch { /* non ancora */ } if (!up) await sleep(500); }
    if (!up) throw new Error('wrangler dev non risponde:\n' + log.split('\n').slice(-20).join('\n'));
    ctx.log('wrangler dev pronto su ' + base);
    // orologio di prova del server (richiesta a M1-server): se c'è, si salta il tempo invece di aspettarlo
    const skip = async (ms) => (await fetch(base + '/api/test/skip', { method: 'POST', headers: { 'x-token': 'tokI', 'content-type': 'application/json' }, body: JSON.stringify({ ms }) })).ok;

    const P = await openPage(ctx.browser, `${base}/${htmlRel}?t=tokI&test=1`, ctx.B.IPHONE); pages.push(P);
    const page = P.page;
    const st = async () => (await ctx.getState(page)).lot;
    const hook = (name, ...a) => page.evaluate(([n, args]) => window.__game.test[n](...args), [name, a]);
    const center = async (cell) => { await hook('look', (cell[0] + 0.5) * 2, (cell[1] + 0.5) * 2 + 1.5, 1.0); await sleep(300); };
    const realTap = async (target) => {
      const p = await hook('lotScreen', target);
      ctx.assert(p && p.on, 'bersaglio fuori schermo: ' + JSON.stringify(p));
      await page.touchscreen.tap(p.x, p.y);
    };
    const bigEnough = async () => page.evaluate(() => [...document.querySelectorAll('#mzSheet button, .mz-lbl.bubble')].filter((b) => b.offsetParent).map((b) => { const r = b.getBoundingClientRect(); return { t: b.textContent.slice(0, 24), w: Math.round(r.width), h: Math.round(r.height) }; }).filter((r) => r.w < 44 || r.h < 44));

    let start, slotA, slotB;
    await ctx.test('entra: barra risorse = partenza del balance', async () => {
      await ctx.waitReady(page, 20000);
      await ctx.waitState(page, (s) => s.lot && s.lot.ready, 10000);
      const s = await st();
      start = s.resources;
      for (const k of RES) ctx.assert(start[k] === balance.partenza[k], `${k}: ${start[k]} ≠ partenza ${balance.partenza[k]}`);
      const bar = await page.evaluate(() => { const b = document.getElementById('mzBar'); return { on: b.classList.contains('on'), text: b.textContent, h: b.getBoundingClientRect().height, top: b.getBoundingClientRect().top }; });
      ctx.assert(bar.on && bar.text.includes(String(start.legno)) && bar.text.includes(String(start.pietra)), 'barra risorse non mostrata: ' + JSON.stringify(bar));
      ctx.log(`partenza ${JSON.stringify(start)} · barra alta ${bar.h} px · slot liberi ${JSON.stringify(s.freeSlots)}`);
      ctx.assert(s.freeSlots.length >= 2, 'servono almeno 2 slot L liberi nel template');
      [slotA, slotB] = s.freeSlots;
    });
    await ctx.shot(page, 'barra_risorse');

    await ctx.test('tap vero su uno slot libero → build mode con i costi, pulsanti ≥ 44 px', async () => {
      await center(slotA);
      await realTap(slotA);
      await ctx.waitState(page, (s) => s.lot.panel && s.lot.panel.kind === 'costruisci', 5000);
      const rows = await page.evaluate(() => [...document.querySelectorAll('#mzSheet button[data-building]')].map((b) => ({ id: b.dataset.building, dis: b.disabled, t: b.textContent })));
      ctx.log('build mode: ' + rows.map((r) => `${r.id}${r.dis ? '(grigio)' : ''}`).join(' '));
      ctx.assert(rows.some((r) => r.id === 'segheria' && !r.dis), 'Segheria non costruibile: ' + JSON.stringify(rows));
      const small = await bigEnough();
      ctx.assert(!small.length, 'pulsanti sotto 44 px: ' + JSON.stringify(small));
    });
    await ctx.shot(page, 'build_mode');

    await ctx.test('costruisce la Segheria: spesa immediata e timer «Segheria tra 0:xx»', async () => {
      await page.click('#mzSheet button[data-building="segheria"]');
      await ctx.waitState(page, (s) => s.lot.panel && s.lot.panel.chosen === 'segheria', 3000);
      await page.click('#mzSheet button[data-act="conferma"]');
      await ctx.waitState(page, (s) => s.lot.construction && s.lot.construction.building === 'segheria', 8000);
      const s = await st();
      const cost = buildings.find((b) => b.id === 'segheria').levels[0].cost;
      ctx.assert(s.resources.legno === start.legno - cost.legno, `legno ${s.resources.legno}, atteso ${start.legno - cost.legno}`);
      await sleep(400);
      const lbl = (await st()).labels.find((l) => l.id === s.construction.placedId);
      const work = await page.textContent('#mzWork');
      ctx.log(`etichetta: «${lbl && lbl.text}» · chip: «${work}» · cantiere ${s.construction.leftS} s`);
      ctx.assert(lbl && /^Segheria tra \d+:\d\d$/.test(lbl.text), 'timer del cantiere assente: ' + JSON.stringify(lbl));
      ctx.assert(/Segheria tra \d+:\d\d/.test(work), 'chip del cantiere assente');
      ctx.assert((await st()).panel === null, 'il pannello doveva chiudersi');
    });
    await center(slotA);
    await ctx.shot(page, 'cantiere');

    await ctx.test('azione rifiutata dal server: errore in italiano (409, un solo cantiere)', async () => {
      const r = await hook('lotAct', 'build', 'cava', slotB);
      ctx.log('errore: ' + r.error);
      ctx.assert(!r.ok && /cantiere/i.test(r.error || ''), 'atteso errore sul cantiere: ' + JSON.stringify(r));
      const toast = await page.textContent('#toast');
      ctx.assert(toast.includes(r.error.split(':')[0]), 'toast senza errore: ' + toast);
    });

    await ctx.test('cantiere finito → Segheria L1 col suo modello', async () => {
      const s0 = await st();
      if (!(await skip(s0.construction.leftS * 1000 + 500))) ctx.log('orologio di prova assente: aspetto il tempo vero');
      await ctx.waitState(page, (s) => s.lot.buildings.some((b) => b.building === 'segheria' && b.level === 1 && b.model && !/cantiere/.test(b.model)) && !s.lot.construction, 90000);
      const b = (await st()).buildings.find((x) => x.building === 'segheria');
      ctx.log(`segheria ${b.id} cella ${b.cell} modello ${b.model}`);
      ctx.assert(/^(bld_segheria_l1|segnaposto_segheria)$/.test(b.model), 'modello sbagliato: ' + b.model);
    });

    let seg;
    await ctx.test('deposito ≥ 1 visibile, tap vero sull\'edificio → pannello, raccogli (volo nella barra)', async () => {
      const t0 = Date.now();
      if (!(await skip(3 * 3600 * 1000))) ctx.log('orologio di prova assente: aspetto che la Segheria produca 1 Legno (~3 min)');
      else await hook('lotRefresh');
      await ctx.waitState(page, (s) => s.lot.buildings.some((b) => b.building === 'segheria' && b.buffer >= 1), 260000);
      ctx.log(`deposito pronto in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
      seg = (await st()).buildings.find((x) => x.building === 'segheria');
      await center(seg.cell); await sleep(400);
      const lbl = (await st()).labels.find((l) => l.id === seg.id);
      ctx.assert(lbl && /\d/.test(lbl.text) && /bubble/.test(lbl.cls), 'bolla del deposito assente: ' + JSON.stringify(lbl));
      await ctx.shot(page, 'deposito');
      await realTap(seg.id);
      await ctx.waitState(page, (s) => s.lot.panel && s.lot.panel.kind === 'edificio', 5000);
      const small = await bigEnough();
      ctx.assert(!small.length, 'pulsanti sotto 44 px: ' + JSON.stringify(small));
      await ctx.shot(page, 'pannello_edificio');
      const before = (await st()).resources.legno;
      await page.click('#mzSheet button[data-act="raccogli"]');
      const flew = await page.waitForSelector('.mz-fly', { timeout: 3000 }).then(() => true).catch(() => false);
      await ctx.waitState(page, (s, b) => s.lot.resources.legno > b, 8000, before);
      await sleep(900);
      const after = await st();
      const bar = await page.textContent('#mzBar [data-res="legno"]');
      ctx.log(`raccolti ${after.resources.legno - before} Legno · volo ${flew} · barra «${bar.trim()}»`);
      ctx.assert(flew, 'nessuna risorsa in volo');
      ctx.assert(bar.trim() === String(after.resources.legno), 'barra non aggiornata dopo il volo');
    });

    await ctx.test('migliora (spesa + timer) e «ti mancano …» in grigio nella build mode', async () => {
      const s = await st();
      const l2 = buildings.find((b) => b.id === 'segheria').levels[1].cost;
      const can = RES.every((k) => s.resources[k] >= l2[k]);
      if (can) {
        await page.click('#mzSheet button[data-act="migliora"]');
        await ctx.waitState(page, (x) => x.lot.construction && x.lot.construction.level === 2, 8000);
      } else {
        const t = await page.textContent('#mzSheet button[data-act="migliora"]');
        ctx.assert(t.includes(mancaText({ legno: Math.max(0, l2.legno - s.resources.legno), pietra: Math.max(0, l2.pietra - s.resources.pietra), perle: 0 })), 'migliora senza «ti mancano»: ' + t);
      }
      const res = (await st()).resources;
      await center(slotB); await hook('lotTap', slotB);
      await ctx.waitState(page, (x) => x.lot.panel && x.lot.panel.kind === 'costruisci', 3000);
      const rows = await page.evaluate(() => [...document.querySelectorAll('#mzSheet button[data-building]')].map((b) => ({ id: b.dataset.building, dis: b.disabled, t: b.textContent })));
      let checked = 0;
      for (const r of rows) {
        const c = buildings.find((b) => b.id === r.id).levels[0].cost;
        const m = { legno: Math.max(0, c.legno - res.legno), pietra: Math.max(0, c.pietra - res.pietra), perle: Math.max(0, c.perle - res.perle) };
        if (!mancaText(m)) continue;
        ctx.assert(r.dis && r.t.includes(mancaText(m)), `${r.id}: atteso grigio con «${mancaText(m)}», trovato ${JSON.stringify(r)}`);
        checked++;
      }
      ctx.log(`risorse ${JSON.stringify(res)} · righe con «ti mancano»: ${checked}`);
      ctx.assert(checked > 0, 'nessuna riga senza risorse da controllare');
    });
    await ctx.shot(page, 'ti_mancano');

    await ctx.test('zero errori console (tranne il 409 voluto)', async () => {
      const errs = errorsOf(P, [[409, '/api/lot/build']]);
      ctx.assert(!errs.length, errs.join('\n'));
    });

    await ctx.test('visita in sola lettura: niente barra, niente azioni', async () => {
      const V = await openPage(ctx.browser, `${base}/${htmlRel}?t=tokA&test=1&ro=isola`, ctx.B.IPHONE); pages.push(V);
      await ctx.waitReady(V.page, 20000);
      await ctx.waitState(V.page, (s) => s['lot:isola'] && s['lot:isola'].ready, 10000);
      const s = (await ctx.getState(V.page))['lot:isola'];
      ctx.assert(s.readonly && s.buildings.some((b) => b.building === 'segheria') && !s.freeSlots.length, 'visita incompleta: ' + JSON.stringify(s).slice(0, 300));
      await V.page.evaluate(() => window.__game.test['lotTap@isola']('segheria'));
      await ctx.waitState(V.page, (x) => x['lot:isola'].panel, 3000);
      const ui = await V.page.evaluate(() => ({ bar: document.getElementById('mzBar').classList.contains('on'), acts: [...document.querySelectorAll('#mzSheet button[data-act]')].map((b) => b.dataset.act), text: document.getElementById('mzSheet').textContent }));
      ctx.assert(!ui.bar && ui.acts.join() === 'chiudi' && ui.text.includes('solo da guardare'), 'visita con azioni: ' + JSON.stringify(ui));
      const errs = errorsOf(V); ctx.assert(!errs.length, errs.join('\n'));
    });

    await ctx.test('link non valido → «Link non valido, chiedi a Jack un link nuovo»', async () => {
      const X = await openPage(ctx.browser, `${base}/${htmlRel}?t=sbagliato&test=1`, ctx.B.IPHONE); pages.push(X);
      await ctx.waitReady(X.page, 20000);
      const b = await X.page.textContent('#mzBanner');
      ctx.assert(b === 'Link non valido, chiedi a Jack un link nuovo', 'avviso: ' + b);
      await ctx.shot(X.page, 'link_non_valido');
      const errs = errorsOf(X, [[401, '/api/lot']]); ctx.assert(!errs.length, errs.join('\n'));
    });
  } finally {
    for (const p of pages) await p.close().catch(() => {});
    if (dev) { try { process.kill(-dev.pid, 'SIGTERM'); } catch { /* già finito */ } await sleep(500); try { process.kill(-dev.pid, 'SIGKILL'); } catch { /* ok */ } }
    fs.rmSync(persist, { recursive: true, force: true });
    fs.rmSync(dist, { recursive: true, force: true });
  }
}
