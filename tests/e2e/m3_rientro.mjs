// «Mentre eri via» e libro degli ospiti (#86) sul server locale (wrangler dev, TEST_CLOCK:1: l'ora la sposta X-Test-Now-Offset).
// Bea (slot 0) entra la prima volta (niente cartolina), costruisce Segheria e Cava ed esce. Un'ora dopo Marco (slot 1, telefono) va
// sull'isola di Bea, al leggio vicino al molo: FIRMA, sceglie il saluto, la firma resta nel libro (una sola al giorno: la seconda 409).
// Sei ore dopo Bea rientra dal telefono: la cartolina «Mentre eri via» dice da quanto mancava, i depositi, il cantiere finito, che Marco
// è passato; RACCOGLI TUTTO e le risorse salgono quanto i depositi. Nel feed di Bea la visita; al suo leggio il libro con la firma.
// API: firma sul proprio libro 409, saluto sconosciuto 400, isola inesistente 404. Screenshot del telefono di libro, cartolina e feed.
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
export const timeout = 300000;

const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const H = 3_600_000, MIN = 60_000;

/** Pagina col suo orologio di prova: ogni richiesta (anche quelle dell'avvio) porta X-Test-Now-Offset = `off`. */
async function openAt(ctx, url, viewport, off) {
  const c = await ctx.browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: viewport.deviceScaleFactor, isMobile: viewport.isMobile, hasTouch: viewport.hasTouch });
  const page = await c.newPage();
  await page.setExtraHTTPHeaders({ 'x-test-now-offset': String(off) });
  const p = { page, errors: [], consoleErrors: [], failed: [], close: () => c.close() };
  page.on('pageerror', (e) => p.errors.push(String(e && (e.stack || e.message) || e)));
  page.on('console', (m) => { if (m.type() === 'error') p.consoleErrors.push(m.text()); });
  page.on('requestfailed', (r) => { const why = r.failure()?.errorText || ''; if (why !== 'net::ERR_ABORTED') p.failed.push(r.url() + ' ' + why); });
  await page.goto(url, { waitUntil: 'load' });
  ctx._pages.push(p);
  return p;
}

export default async function (ctx) {
  const { assert } = ctx;
  const SERVER = path.join(ctx.ROOT, 'apps/server');
  const persist = path.join(ctx.OUT, `m3rientro-${process.pid}`);
  const env = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' };
  const wr = (...a) => execFileSync('npx', ['--no-install', 'wrangler', ...a], { cwd: SERVER, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 }).toString();
  const read = (f) => JSON.parse(fs.readFileSync(path.join(ctx.ROOT, 'packages/content/src', f), 'utf8'));
  const islands = read('islands.json'), rientro = read('rientro.json');
  const slots = islands.find((i) => i.id === 'lotto').slots;
  const segCell = slots.find((s) => s.kind === 'segheria').at, cavaCell = slots.find((s) => s.kind === 'cava').at;

  let dev = null, log = '';
  try {
    fs.rmSync(persist, { recursive: true, force: true });
    wr('d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', persist);
    wr('d1', 'execute', 'DB', '--local', '--persist-to', persist, '--command', "INSERT INTO persone (id, nome, token, slot) VALUES ('bea', 'Bea', 'tokB', 0), ('marco', 'Marco', 'tokM', 1);");
    const port = await freePort(), inspector = await freePort();
    dev = spawn('npx', ['--no-install', 'wrangler', 'dev', '--local', '--ip', '127.0.0.1', '--port', String(port), '--inspector-port', String(inspector),
      '--assets', ctx.distDir, '--persist-to', persist, '--var', 'TEST_CLOCK:1', '--show-interactive-dev-session=false'], { cwd: SERVER, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    dev.stdout.on('data', (d) => (log += d)); dev.stderr.on('data', (d) => (log += d));
    const B = `http://127.0.0.1:${port}`;
    let up = false;
    for (let i = 0; i < 120 && !up; i++) { try { up = (await fetch(B + '/api/ping')).ok; } catch { /* non ancora */ } if (!up) await sleep(500); }
    if (!up) throw new Error('wrangler dev non risponde:\n' + log.split('\n').slice(-20).join('\n'));
    const call = async (tok, off, method, p, b) => {
      const r = await fetch(B + p, { method, headers: { 'x-token': tok, 'content-type': 'application/json', 'x-test-now-offset': String(off) }, body: b === undefined ? undefined : JSON.stringify(b) });
      return { status: r.status, body: await r.json() };
    };
    const bea = (off, m, p, b) => call('tokB', off, m, p, b), marco = (off, m, p, b) => call('tokM', off, m, p, b);

    await ctx.test('API: primo ingresso senza cartolina; Bea costruisce Segheria e Cava; firme non valide rifiutate', async () => {
      const r = await bea(0, 'POST', '/api/rientro', {});
      assert(r.status === 200 && r.body.riepilogo === null && r.body.lot.visto > 0, 'primo rientro: ' + JSON.stringify(r.body).slice(0, 200));
      assert((await bea(0, 'POST', '/api/lot/build', { building: 'segheria', cell: segCell })).status === 200, 'segheria');
      assert((await bea(MIN, 'POST', '/api/lot/build', { building: 'cava', cell: cavaCell })).status === 200, 'cava');
      const poco = await bea(2 * MIN, 'POST', '/api/rientro', {});
      assert(poco.body.riepilogo === null, 'dopo due minuti niente cartolina');
      const mio = await bea(2 * MIN, 'POST', '/api/libro/firma', { isola: 'bea', emote: 'saluto' });
      assert(mio.status === 409, 'firma sul proprio libro: ' + mio.status);
      const brutta = await marco(2 * MIN, 'POST', '/api/libro/firma', { isola: 'bea', emote: 'balla' });
      assert(brutta.status === 400, 'saluto sconosciuto: ' + brutta.status);
      const nessuno = await marco(2 * MIN, 'POST', '/api/libro/firma', { isola: 'nessuno', emote: 'saluto' });
      assert(nessuno.status === 404, 'isola inesistente: ' + nessuno.status);
    });

    // ---- Marco, un'ora dopo, sull'isola di Bea (telefono) ----
    await ctx.test('telefono, Marco: al leggio di Bea FIRMA → saluto → firma nel libro; la seconda nello stesso giorno 409', async () => {
      const M = await openAt(ctx, `${B}/?t=tokM&test=1&rientro=1`, ctx.B.IPHONE, H), page = M.page;
      const st = () => ctx.getState(page), hook = (n, ...a) => page.evaluate(([n, a]) => window.__game.test[n](...a), [n, a]);
      await ctx.waitReady(page, 30000);
      await ctx.waitState(page, (s) => s['lot:bea'] && s['lot:bea'].ready && s.libro && s.libro.libri.length === 2, 20000);
      await hook('rientroPronto');
      assert(!(await st()).libro.cartolina, 'Marco entra per la prima volta: niente cartolina');
      const lb = (await st()).libro.libri.find((l) => l.owner === 'bea');
      await hook('teleport', lb.x, lb.z); await hook('setZoom', 0.8);
      await ctx.waitState(page, (s) => s.libro.near === 'bea', 8000);
      await page.waitForSelector('#mzLibroBtn.on', { timeout: 5000 });
      assert(/FIRMA/.test(await page.locator('#mzLibroBtn').innerText()), 'bottone FIRMA');
      await sleep(600);
      await ctx.shot(page, 'iphone_leggio_firma');
      await page.locator('#mzLibroBtn').tap();
      await ctx.waitState(page, (s) => s.libro.open === 'libro', 8000);
      await page.waitForSelector('#mzLibro.on [data-emote="saluto"]', { timeout: 5000 });
      const box = await page.locator('#mzLibro').boundingBox();
      assert(box && box.x >= 0 && box.x + box.width <= 390 && box.y + box.height <= 844, 'pannello fuori schermo: ' + JSON.stringify(box));
      const small = await page.evaluate(() => [...document.querySelectorAll('#mzLibro button')].filter((b) => b.getBoundingClientRect().height < 44).map((b) => b.textContent));
      assert(!small.length, 'bottoni < 44 px: ' + small.join(','));
      await ctx.shot(page, 'iphone_libro_amico');
      await page.locator('#mzLibro [data-emote="saluto"]').tap();
      await ctx.waitState(page, (s) => s.libro.open === null && s.libro.libri.find((l) => l.owner === 'bea').firmato, 8000);
      await ctx.waitState(page, (s) => s.emotes.shown.some((b) => b.who === 'me' && b.id === 'saluto'), 4000);
      await page.waitForSelector('#mzLibroBtn.on', { timeout: 5000 });
      assert(/FIRMATO/.test(await page.locator('#mzLibroBtn').innerText()), 'dopo la firma il bottone dice FIRMATO');
      await ctx.shot(page, 'iphone_firmato');
      const lot = (await marco(H + MIN, 'GET', '/api/lot/bea')).body;
      assert(lot.ospiti.length === 1 && lot.ospiti[0].chi === 'marco' && lot.ospiti[0].nome === 'Marco' && lot.ospiti[0].emote === 'saluto', 'firma salvata: ' + JSON.stringify(lot.ospiti));
      const di2 = await marco(H + 2 * MIN, 'POST', '/api/libro/firma', { isola: 'bea', emote: 'esulta' });
      assert(di2.status === 409 && /già firmato/.test(di2.body.error), 'seconda firma: ' + di2.status + ' ' + JSON.stringify(di2.body));
      ctx.noErrors(M, 'Marco');
      await M.close();
    });

    // ---- Bea rientra dopo sei ore (telefono) ----
    const OFF = 6 * H;
    await ctx.test('telefono, Bea dopo 6 h: cartolina con assenza, depositi, cantiere, la firma di Marco; RACCOGLI TUTTO alza le risorse', async () => {
      const P = await openAt(ctx, `${B}/?t=tokB&test=1&rientro=1`, ctx.B.IPHONE, OFF), page = P.page;
      const st = () => ctx.getState(page), hook = (n, ...a) => page.evaluate(([n, a]) => window.__game.test[n](...a), [n, a]);
      await ctx.waitReady(page, 30000);
      await ctx.waitState(page, (s) => s.lot && s.lot.ready, 20000);
      await hook('rientroPronto');
      await ctx.waitState(page, (s) => s.libro.cartolina && s.libro.cartolina.mostrata && s.libro.open === 'cartolina', 15000);
      const r = (await st()).libro.cartolina.riepilogo;
      ctx.log('riepilogo', JSON.stringify(r));
      assert(r.assenteMs >= 6 * H - 3 * MIN && r.assenteMs <= 6 * H + 10 * MIN, 'assenza: ' + r.assenteMs); // più il tempo vero passato col test
      assert(r.depositi.legno >= 100 && r.depositi.pietra >= 60, 'depositi: ' + JSON.stringify(r.depositi));
      assert(r.cantiere && r.cantiere.building === 'cava', 'cantiere finito: ' + JSON.stringify(r.cantiere));
      assert(r.ospitiTot === 1 && r.ospiti[0].nome === 'Marco', 'ospiti: ' + JSON.stringify(r.ospiti));
      const card = page.locator('#mzRientro');
      const txt = await card.innerText();
      assert(/MENTRE ERI VIA/i.test(txt) && /Mancavi da [56] h/.test(txt) && /Marco/.test(txt) && /Cava/.test(txt), 'cartolina: ' + txt);
      assert(new RegExp(`\\+${r.depositi.legno} Legno`).test(txt) && new RegExp(`\\+${r.depositi.pietra} Pietra`).test(txt), 'depositi nella cartolina: ' + txt);
      const box = await card.boundingBox();
      assert(box && box.x >= 0 && box.x + box.width <= 390 && box.y >= 0 && box.y + box.height <= 844, 'cartolina fuori schermo: ' + JSON.stringify(box));
      const small = await page.evaluate(() => [...document.querySelectorAll('#mzRientro button')].filter((b) => b.getBoundingClientRect().height < 44).map((b) => b.textContent));
      assert(!small.length, 'bottoni < 44 px: ' + small.join(','));
      assert((await st()).libro.ui.righe.includes('ospiti'), 'riga delle firme');
      await sleep(400);
      await ctx.shot(page, 'iphone_cartolina');
      const r0 = (await st()).lot.resources;
      await page.locator('#mzRientro [data-act="raccogli"]').tap();
      await ctx.waitState(page, (s, w) => s.libro.open === null && s.lot.resources.legno >= w.l && s.lot.resources.pietra >= w.p && !s.lot.busy, 15000, { l: r0.legno + r.depositi.legno, p: r0.pietra + r.depositi.pietra });
      const r1 = (await st()).lot.resources;
      ctx.log(`risorse ${JSON.stringify(r0)} → ${JSON.stringify(r1)}`);
      // tra la cartolina e il tocco passa tempo vero (l'orologio di prova sposta solo l'inizio): i depositi possono crescere di un'unità
      const dl = r1.legno - r0.legno - r.depositi.legno, dp = r1.pietra - r0.pietra - r.depositi.pietra;
      assert(dl >= 0 && dl <= 2 && dp >= 0 && dp <= 2, `raccolto diverso dai depositi: ${dl} ${dp}`);
      const srv = (await bea(OFF + MIN, 'GET', '/api/lot')).body;
      assert(srv.resources.legno === r1.legno && srv.resources.pietra === r1.pietra, 'risorse sul server: ' + JSON.stringify(srv.resources));
      await sleep(900);
      await ctx.shot(page, 'iphone_raccolto');

      // feed: la visita di Marco con il suo saluto
      const feed = (await bea(OFF + MIN, 'GET', '/api/feed')).body;
      const v = feed.items.find((i) => i.tipo === 'visita');
      assert(v && v.da === 'marco' && v.emote === 'saluto' && /Marco è passato sulla tua isola/.test(v.testo), 'feed: ' + JSON.stringify(feed.items));
      await hook('openFeed');
      await page.waitForSelector('#mzFeed.on .mz-feed-row[data-tipo="visita"]', { timeout: 8000 });
      await ctx.shot(page, 'iphone_feed_visita');
      await page.locator('#mzFeed [data-act="chiudi"]').tap();

      // il proprio leggio: il libro con la firma di Marco
      const lb = (await st()).libro.libri.find((l) => l.mine);
      await hook('teleport', lb.x, lb.z); await hook('setZoom', 0.8);
      await ctx.waitState(page, (s) => s.libro.near === 'bea', 8000);
      await page.waitForSelector('#mzLibroBtn.on', { timeout: 5000 });
      assert(/LIBRO DEGLI OSPITI/.test(await page.locator('#mzLibroBtn').innerText()), 'bottone del proprio libro');
      await page.locator('#mzLibroBtn').tap();
      await ctx.waitState(page, (s) => s.libro.open === 'libro', 8000);
      await page.waitForSelector('#mzLibro.on [data-firma="marco"]', { timeout: 5000 });
      assert(!(await page.locator('#mzLibro [data-emote]').count()), 'sul proprio libro niente bottoni per firmare');
      await ctx.shot(page, 'iphone_libro_mio');
      await page.locator('#mzLibro [data-act="chiudi"]').tap();
      await ctx.waitState(page, (s) => s.libro.open === null, 3000);
      ctx.noErrors(P, 'Bea');
    });

    await ctx.test('rientro dopo poco: niente cartolina; il «ci sono» sposta l’inizio dell’assenza', async () => {
      const a = await bea(OFF + 5 * MIN, 'POST', '/api/rientro', {});
      assert(a.body.riepilogo === null, 'rientro dopo pochi minuti');
      const p = await bea(OFF + 40 * MIN, 'POST', '/api/presenza', {});
      assert(p.status === 200 && p.body.ok, 'presenza: ' + JSON.stringify(p.body));
      const b = await bea(OFF + 40 * MIN + (rientro.sogliaMinuti - 1) * MIN, 'POST', '/api/rientro', {});
      assert(b.body.riepilogo === null, 'giocava fino a poco fa');
      const c = await bea(OFF + 3 * H, 'POST', '/api/rientro', {});
      assert(c.body.riepilogo && c.body.riepilogo.ospitiTot === 0, 'firme già viste non tornano: ' + JSON.stringify(c.body.riepilogo));
    });
  } finally {
    if (dev) { try { process.kill(-dev.pid, 'SIGTERM'); } catch { /* già finito */ } await sleep(500); try { process.kill(-dev.pid, 'SIGKILL'); } catch { /* ok */ } }
    fs.rmSync(persist, { recursive: true, force: true });
  }
}
