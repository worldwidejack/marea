// M1 · Fetta 3, emote (F3-emote-feed): due browser (Anna e Bruno) sul server locale, entrambi al Porto a ~3 m. Tasto 1 da Anna → fumetto
// proprio subito, fumetto sopra Anna da Bruno entro 1,5 s, via dopo ~2,5 s; 10 pressioni in 1 s → un solo frame `emote`; niente emote col
// Tavolo aperto; telefono 390×844: #mzEmoteBtn apre la riga di 4. Il feed (non è questo il test) risponde vuoto via page.route.
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
export const timeout = 200000;
// Latenza massima del fumetto visto da un altro: 1,5 s (requisito, misurato sul Mac). Su GitHub Actions il rendering software va a 2-4 fps: lì si controlla che arrivi, con margine.
const LAT = process.env.CI ? 4000 : 1500;

const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Come B.openPage, ma i frame WebSocket `emote` inviati si contano dal primo istante (listener prima del goto). */
async function openPage(ctx, url, viewport) {
  const c = await ctx.browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: viewport.deviceScaleFactor, isMobile: viewport.isMobile, hasTouch: viewport.hasTouch });
  const page = await c.newPage();
  const p = { page, errors: [], consoleErrors: [], failed: [], logs: [], sent: [], close: () => c.close() };
  page.on('pageerror', (e) => p.errors.push(String(e && (e.stack || e.message) || e)));
  page.on('console', (m) => { const tx = m.text(); p.logs.push(`[${m.type()}] ${tx}`); if (m.type() === 'error') p.consoleErrors.push(tx); });
  page.on('requestfailed', (r) => { const u = r.url(); if (r.failure()?.errorText === 'net::ERR_ABORTED' || u.includes('/ws/')) return; p.failed.push(u + ' ' + r.failure()?.errorText); });
  page.on('websocket', (ws) => ws.on('framesent', (f) => { try { const m = JSON.parse(String(f.payload)); if (m.t === 'emote') p.sent.push({ at: Date.now(), id: m.id }); } catch { /* non JSON */ } }));
  await page.route('**/api/feed**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(route.request().method() === 'POST' ? { ok: true, nonLetti: 0 } : { items: [], nonLetti: 0, now: Date.now() }) }));
  ctx._pages.push(p);
  await page.goto(url, { waitUntil: 'load' });
  return p;
}

export default async function (ctx) {
  const { assert } = ctx;
  const SERVER = path.join(ctx.ROOT, 'apps/server');
  const persist = path.join(ctx.OUT, `m1emote-${process.pid}`);
  const env = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' };
  const wr = (...a) => execFileSync('npx', ['--no-install', 'wrangler', ...a], { cwd: SERVER, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 }).toString();
  let dev = null, log = '';
  try {
    fs.rmSync(persist, { recursive: true, force: true });
    wr('d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', persist);
    wr('d1', 'execute', 'DB', '--local', '--persist-to', persist, '--command', "INSERT INTO persone (id, nome, token) VALUES ('anna', 'Anna', 'tokA'), ('bruno', 'Bruno', 'tokB');");
    const port = await freePort(), inspector = await freePort();
    dev = spawn('npx', ['--no-install', 'wrangler', 'dev', '--local', '--ip', '127.0.0.1', '--port', String(port), '--inspector-port', String(inspector),
      '--assets', ctx.distDir, '--persist-to', persist, '--show-interactive-dev-session=false'], { cwd: SERVER, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    dev.stdout.on('data', (d) => (log += d)); dev.stderr.on('data', (d) => (log += d));
    const base = `http://127.0.0.1:${port}`;
    let up = false;
    for (let i = 0; i < 120 && !up; i++) { try { up = (await fetch(base + '/api/ping')).ok; } catch { /* non ancora */ } if (!up) await sleep(500); }
    if (!up) throw new Error('wrangler dev non risponde:\n' + log.split('\n').slice(-20).join('\n'));

    let anna = await openPage(ctx, `${base}/?t=tokA&test=1&sfide=1`, ctx.B.DESKTOP);
    const bruno = await openPage(ctx, `${base}/?t=tokB&test=1&sfide=1`, ctx.B.DESKTOP);
    const st = (p) => ctx.getState(p.page);
    /** Anna e Bruno al Porto, Bruno a ~3 m da Anna; Bruno disegna Anna ferma dov'è. */
    const place = async () => {
      const a = await anna.page.evaluate(() => window.__game.test.goto('porto'));
      await bruno.page.evaluate((p) => { window.__game.test.goto('porto'); window.__game.test.teleport(p.x + 2.1, p.z + 2.1); }, a);
      await ctx.waitState(bruno.page, (s, o) => { const d = (s.peersDrawn ?? []).find((x) => x.id === 'anna'); return !!d && d.walk && Math.hypot(d.x - o.x, d.z - o.z) < 0.3; }, 15000, a);
      return a;
    };
    let annaAt;
    await ctx.test('due browser al Porto, Bruno a ~3 m da Anna e la disegna', async () => {
      await Promise.all([ctx.waitReady(anna.page, 30000), ctx.waitReady(bruno.page, 30000)]);
      await ctx.waitState(anna.page, (s) => s.net.status === 'on' && s.net.peers === 1, 15000);
      await ctx.waitState(bruno.page, (s) => s.net.status === 'on' && s.net.peers === 1, 15000);
      annaAt = await place();
      const b = (await st(bruno)).avatar;
      ctx.log(`Anna (${annaAt.x.toFixed(1)}, ${annaAt.z.toFixed(1)}) · Bruno (${b.x.toFixed(1)}, ${b.z.toFixed(1)}) · ${Math.hypot(b.x - annaAt.x, b.z - annaAt.z).toFixed(2)} m`);
      assert((await st(anna)).emotes.coarse === false, 'desktop con pointer: coarse');
      assert(!(await anna.page.$('#mzEmoteBtn')), '#mzEmoteBtn sul desktop');
    });

    let pressAt = 0;
    await ctx.test('tasto 1 da Anna: fumetto proprio entro 300 ms, un frame emote saluto', async () => {
      await anna.page.bringToFront();
      anna.sent.length = 0;
      pressAt = Date.now();
      await anna.page.keyboard.press('Digit1');
      await anna.page.waitForSelector('.mz-emote[data-who="me"][data-emote="saluto"]', { state: 'attached', timeout: 1000 });
      const ms = Date.now() - pressAt;
      ctx.log(`fumetto proprio dopo ${ms} ms; testo «${await anna.page.textContent('.mz-emote[data-who="me"]')}»`);
      assert(ms < 300, `fumetto proprio dopo ${ms} ms`);
      assert((await anna.page.textContent('.mz-emote[data-who="me"]')).includes('Ciao!'), 'manca «Ciao!»');
      await sleep(200);
      assert(anna.sent.length === 1 && anna.sent[0].id === 'saluto', 'frame inviati: ' + JSON.stringify(anna.sent));
      const s = await st(anna);
      assert(s.emotes.shown.some((x) => x.who === 'me' && x.on), 'fumetto proprio non visibile: ' + JSON.stringify(s.emotes.shown));
    });
    await ctx.shot(anna.page, 'anna_saluta_1280');

    let seenAt = 0;
    await ctx.test('Bruno vede il fumetto sopra Anna entro 1,5 s, sulla sua testa', async () => {
      // polling a intervallo (non a requestAnimationFrame: la scheda di Bruno è dietro); il ritardo vero lo dice l'età del fumetto
      await bruno.page.waitForFunction(() => !!document.querySelector('.mz-emote[data-who="anna"][data-emote="saluto"]'), null, { timeout: LAT, polling: 30 });
      seenAt = Date.now();
      const born = await bruno.page.evaluate(() => Date.now() - 1000 * (window.__game.state().emotes.shown.find((x) => x.who === 'anna')?.age ?? 0));
      ctx.log(`Bruno lo trova dopo ${seenAt - pressAt} ms (fumetto nato ${born - pressAt} ms dopo la pressione)`);
      assert(seenAt - pressAt < LAT && born - pressAt < LAT, `Bruno lo vede dopo ${seenAt - pressAt} ms`);
      await bruno.page.bringToFront(); await sleep(150);
      const g = await bruno.page.evaluate(() => {
        const e = document.querySelector('.mz-emote[data-who="anna"]'), r = e.getBoundingClientRect(), c = document.getElementById('gl').getBoundingClientRect();
        const s = window.__game.state().emotes.shown.find((x) => x.who === 'anna');
        return { bx: r.left + r.width / 2, bottom: r.bottom, w: r.width, h: r.height, vis: getComputedStyle(e).visibility, c: { l: c.left, t: c.top, w: c.width, h: c.height }, s };
      });
      ctx.log('fumetto su Bruno: ' + JSON.stringify(g));
      assert(g.s && g.s.on && g.vis === 'visible', 'fumetto nascosto');
      // la punta della coda (bordo basso + 10 px) sta sulla proiezione dell'ancora sopra la testa di Anna
      assert(Math.hypot(g.bx - g.s.x, g.bottom + 10 - g.s.y) < 40, `fumetto lontano dalla testa di Anna: centro (${g.bx}, ${g.bottom + 10}) vs (${g.s.x}, ${g.s.y})`);
      assert(g.s.x > g.c.l && g.s.x < g.c.l + g.c.w && g.s.y > g.c.t && g.s.y < g.c.t + g.c.h, 'testa di Anna fuori dal canvas');
      // controllo indipendente dalla proiezione: la testa di Anna sta vicino al centro (camera su Bruno, 3 m) e sopra Bruno di almeno 1 m in px
      assert(Math.abs(g.s.x - (g.c.l + g.c.w / 2)) < g.c.w * 0.35 && Math.abs(g.s.y - (g.c.t + g.c.h / 2)) < g.c.h * 0.4, 'testa di Anna lontana dal centro della vista');
      assert(g.w > 60 && g.h >= 28, 'fumetto troppo piccolo');
      // Bruno fa l'emote 2: la sua testa (stessa quota) e quella di Anna distano in px quanto ~3 m, non 0 e non mezza schermata
      await bruno.page.keyboard.press('Digit2');
      await bruno.page.waitForSelector('.mz-emote[data-who="me"][data-emote="esulta"]', { state: 'attached', timeout: 1000 });
      const both = (await st(bruno)).emotes.shown;
      const me = both.find((x) => x.who === 'me'), an = both.find((x) => x.who === 'anna');
      const d = Math.hypot(me.x - an.x, me.y - an.y);
      ctx.log(`teste in px: Bruno (${me.x}, ${me.y}) · Anna (${an.x}, ${an.y}) · ${d.toFixed(0)} px`);
      assert(d > 25 && d < 640, 'distanza tra le teste in px non plausibile: ' + d);
    });
    await ctx.shot(bruno.page, 'bruno_vede_anna_1280');

    await ctx.test('il fumetto su Bruno sparisce dopo ~2,5 s', async () => {
      await bruno.page.waitForSelector('.mz-emote[data-who="anna"]', { state: 'detached', timeout: 4000 });
      const life = Date.now() - pressAt;
      ctx.log(`fumetto di Anna su Bruno durato ~${life} ms dalla pressione`);
      assert(life > 2100 && life < 3600, 'durata del fumetto: ' + life);
    });

    await ctx.test('10 pressioni in 1 s → un solo frame emote', async () => {
      await anna.page.bringToFront();
      await ctx.waitState(anna.page, (s) => s.emotes.cooldown === 0, 5000);
      anna.sent.length = 0;
      for (let i = 0; i < 10; i++) { await anna.page.keyboard.press('Digit3'); await sleep(100); }
      await sleep(300);
      ctx.log('frame emote inviati: ' + JSON.stringify(anna.sent.map((x) => x.id)));
      assert(anna.sent.length === 1 && anna.sent[0].id === 'ride', 'frame inviati: ' + anna.sent.length);
      // Bruno ne vede uno solo
      await bruno.page.waitForSelector('.mz-emote[data-who="anna"][data-emote="ride"]', { state: 'attached', timeout: 1500 });
      assert((await bruno.page.$$('.mz-emote[data-who="anna"]')).length === 1, 'più fumetti di Anna su Bruno');
    });

    await ctx.test('Tavolo aperto: niente fumetto né frame', async () => {
      await anna.page.bringToFront();
      await ctx.waitState(anna.page, (s) => s.emotes.cooldown === 0 && !(s.emotes.shown ?? []).length, 5000);
      assert(await anna.page.evaluate(() => window.__game.test.openTavolo()), 'openTavolo ha risposto false');
      await ctx.waitState(anna.page, (s) => s.tavolo.open === true, 5000);
      await ctx.waitState(anna.page, (s) => s.emotes.blocked === true, 5000); // world.frozen arriva al frame dopo (a 2 fps, su GitHub, sono 500 ms)
      anna.sent.length = 0;
      await anna.page.keyboard.press('Digit4');
      const viaHook = await anna.page.evaluate(() => window.__game.test.emote('no'));
      await sleep(300);
      assert(anna.sent.length === 0, 'frame con Tavolo aperto: ' + JSON.stringify(anna.sent));
      assert(viaHook === false, 'emote() col Tavolo aperto ha risposto true');
      assert(!(await anna.page.$('.mz-emote[data-who="me"]')), 'fumetto col Tavolo aperto');
      await anna.page.keyboard.press('Escape');
      await ctx.waitState(anna.page, (s) => s.tavolo.open === false, 5000).catch(async () => { await anna.page.keyboard.press('Escape'); await ctx.waitState(anna.page, (s) => s.tavolo.open === false, 5000); });
      ctx.noErrors(anna, 'Anna'); ctx.noErrors(bruno, 'Bruno');
    });

    // ---- telefono: Anna rientra da un iPhone (la connessione desktop viene sostituita) ----
    await ctx.test('telefono 390×844: #mzEmoteBtn apre la riga di 4, tocco → fumetto e frame', async () => {
      await anna.close(); ctx._pages.splice(ctx._pages.indexOf(anna), 1);
      anna = await openPage(ctx, `${base}/?t=tokA&test=1&sfide=1`, ctx.B.IPHONE);
      await ctx.waitReady(anna.page, 30000);
      await ctx.waitState(anna.page, (s) => s.net.status === 'on' && s.net.peers === 1, 15000);
      annaAt = await place();
      await anna.page.bringToFront();
      const s0 = await st(anna);
      assert(s0.emotes.coarse === true, 'iPhone senza pointer: coarse');
      const btn = await anna.page.$('#mzEmoteBtn');
      assert(btn && (await btn.isVisible()), 'manca #mzEmoteBtn');
      await btn.tap();
      await anna.page.waitForSelector('#mzEmoteRow.on', { timeout: 2000 });
      const picks = await anna.page.$$eval('#mzEmoteRow.on .mz-emote-pick', (bs) => bs.map((b) => { const r = b.getBoundingClientRect(); return { id: b.dataset.emote, w: r.width, h: r.height, l: r.left, r: r.right, t: r.top }; }));
      ctx.log('riga: ' + JSON.stringify(picks));
      assert(picks.length === 4 && picks.map((p) => p.id).join() === 'saluto,esulta,ride,no', 'riga sbagliata');
      assert(picks.every((p) => p.w >= 44 && p.h >= 44 && p.l >= 0 && p.r <= 390), 'bottoni sotto i 44 px o fuori schermo');
      await ctx.shot(anna.page, 'riga_390');
      anna.sent.length = 0;
      await anna.page.tap('#mzEmoteRow .mz-emote-pick[data-emote="esulta"]');
      await anna.page.waitForSelector('.mz-emote[data-who="me"][data-emote="esulta"]', { state: 'attached', timeout: 1000 });
      assert(!(await anna.page.$('#mzEmoteRow.on')), 'la riga resta aperta dopo il tocco');
      await sleep(250);
      assert(anna.sent.length === 1 && anna.sent[0].id === 'esulta', 'frame dal telefono: ' + JSON.stringify(anna.sent));
      await bruno.page.waitForSelector('.mz-emote[data-who="anna"][data-emote="esulta"]', { state: 'attached', timeout: 1500 });
      await ctx.shot(anna.page, 'anna_esulta_390');
      ctx.noErrors(anna, 'Anna'); ctx.noErrors(bruno, 'Bruno');
    });
  } finally {
    if (dev) { try { process.kill(-dev.pid, 'SIGTERM'); } catch { /* già finito */ } await sleep(500); try { process.kill(-dev.pid, 'SIGKILL'); } catch { /* ok */ } }
    fs.rmSync(persist, { recursive: true, force: true });
  }
}
