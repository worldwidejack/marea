// M1 · Fetta 3, feed delle novità (F3-emote-feed). Server locale (wrangler, orologio di test) per /api/me e la rete; il feed:
//  1) finto via page.route: all'avvio badge 2 e toast; F apre #mzFeed.on coi testi; POST /letto con fino = id massimo e badge via;
//     feedRefresh() con una riga nuova → badge 1 + toast; Esc chiude.
//  2) poll: scheda visibile → almeno un giro in 35 s (poll a 30 s); scheda nascosta (visibilityState finto) → zero giri, e un giro subito
//     quando torna visibile. Il telefono 390×844 apre il feed dalla campanella.
//  3) server vero: Anna sfida Bruno e gioca (input pigri come m1_server), Bruno entra e il badge vale 1. Se /api/feed risponde 404
//     (F3-server non ha ancora finito) è un warn, non un fallimento.
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
export const timeout = 240000;

const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MIN = 60_000;

export default async function (ctx) {
  const { assert } = ctx;
  const SERVER = path.join(ctx.ROOT, 'apps/server');
  const persist = path.join(ctx.OUT, `m1feed-${process.pid}`);
  const env = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' };
  const wr = (...a) => execFileSync('npx', ['--no-install', 'wrangler', ...a], { cwd: SERVER, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 }).toString();
  const sim = async (f) => import(pathToFileURL(path.join(ctx.ROOT, 'packages/sim/src', f)).href);
  const { regata, lazyAutopilot } = await sim('minigames/regata/regata.ts');
  const { packInputs, quantize } = await sim('replay.ts');
  const tpl = JSON.parse(fs.readFileSync(path.join(ctx.ROOT, 'packages/content/src/islands.json'), 'utf8')).find((i) => i.id === 'lotto');
  const slotCells = tpl.rows.flatMap((row, z) => [...row].flatMap((c, x) => (c === 'L' ? [[x, z]] : [])));
  let dev = null, log = '', OFF = 0;
  try {
    fs.rmSync(persist, { recursive: true, force: true });
    wr('d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', persist);
    wr('d1', 'execute', 'DB', '--local', '--persist-to', persist, '--command',
      "INSERT INTO persone (id, nome, token, slot) VALUES ('anna', 'Anna', 'tokA', 1), ('bruno', 'Bruno', 'tokB', 2), ('carla', 'Carla', 'tokC', 3), ('dario', 'Dario', 'tokD', 4);");
    const port = await freePort(), inspector = await freePort();
    dev = spawn('npx', ['--no-install', 'wrangler', 'dev', '--local', '--ip', '127.0.0.1', '--port', String(port), '--inspector-port', String(inspector),
      '--assets', ctx.distDir, '--persist-to', persist, '--var', 'TEST_CLOCK:1', '--show-interactive-dev-session=false'], { cwd: SERVER, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    dev.stdout.on('data', (d) => (log += d)); dev.stderr.on('data', (d) => (log += d));
    const base = `http://127.0.0.1:${port}`;
    let up = false;
    for (let i = 0; i < 120 && !up; i++) { try { up = (await fetch(base + '/api/ping')).ok; } catch { /* non ancora */ } if (!up) await sleep(500); }
    if (!up) throw new Error('wrangler dev non risponde:\n' + log.split('\n').slice(-20).join('\n'));

    /** Feed finto per una pagina: righe modificabili, conta le GET, registra le POST /letto. */
    const fakeFeed = async (pg, rows) => {
      const f = { rows, gets: [], reads: [] };
      await pg.page.route('**/api/feed**', async (route) => {
        const req = route.request();
        if (req.method() === 'POST') {
          const body = JSON.parse(req.postData() || '{}'); f.reads.push(body);
          for (const r of f.rows) if (body.fino === undefined || r.id <= body.fino) r.letto = true;
          return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, nonLetti: f.rows.filter((r) => !r.letto).length }) });
        }
        f.gets.push(Date.now());
        const items = [...f.rows].sort((a, b) => b.id - a.id);
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items, nonLetti: items.filter((r) => !r.letto).length, now: Date.now() }) });
      });
      return f;
    };
    const open = async (token, viewport, o = {}) => {
      const pg = await ctx.B.openPage(ctx.browser, 'about:blank', { viewport });
      ctx._pages.push(pg);
      if (o.hidden) await pg.page.addInitScript(() => {
        let vis = 'hidden';
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => vis });
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => vis !== 'visible' });
        window.__setVisible = (v) => { vis = v ? 'visible' : 'hidden'; document.dispatchEvent(new Event('visibilitychange')); };
      });
      const feed = o.rows ? await fakeFeed(pg, o.rows) : null;
      await pg.page.route('**/api/**', (route) => route.fallback({ headers: { ...route.request().headers(), 'x-test-now-offset': String(OFF) } }));
      await pg.page.goto(`${base}/?t=${token}&test=1`, { waitUntil: 'load' });
      await ctx.waitReady(pg.page, 30000);
      return { pg, feed };
    };
    const now = Date.now();
    const badge = (page) => page.evaluate(() => { const b = document.querySelector('#mzFeedBtn .mz-badge.on'); return b ? b.textContent : ''; });
    const toast = (page) => page.evaluate(() => { const t = document.getElementById('toast'); return t && t.style.opacity === '1' ? t.textContent : ''; });

    // ---- 1) feed finto ----
    const rows = [
      { id: 3, quando: now - 26 * 3600_000, tipo: 'sfida_chiusa', testo: 'Hai battuto Bruno: +20 Legno, +10 Perle', sfida: 'c1', da: 'bruno', letto: true },
      { id: 5, quando: now - 2 * MIN, tipo: 'sfida_accettata', testo: 'Bruno ha accettato la tua sfida', sfida: 'c2', da: 'bruno', letto: false },
      { id: 7, quando: now - 20_000, tipo: 'sfida_ricevuta', testo: 'Anna ti sfida alla Regata: posta 20 Legno. Rispondi al Tavolo entro 24 h', sfida: 'c3', da: 'anna', letto: false },
    ];
    const { pg: carla, feed: cf } = await open('tokC', ctx.B.DESKTOP, { rows });
    await ctx.test('avvio: campanella con badge 2 e toast «2 novità» (primo giro ~3 s)', async () => {
      assert(await carla.page.$('#mzFeedBtn'), 'manca #mzFeedBtn');
      await ctx.waitState(carla.page, (s) => s.feed.unread === 2, 8000);
      const b = await badge(carla.page), t = await toast(carla.page);
      ctx.log(`badge «${b}», toast «${t}», GET ${cf.gets.length}`);
      assert(b === '2', 'badge: ' + b);
      assert(/2 novità/.test(t), 'toast: ' + t);
      assert(cf.gets.length === 1, 'GET all\'avvio: ' + cf.gets.length);
    });
    await ctx.test('F apre #mzFeed coi testi, POST /letto fino = 7, badge via; F chiude', async () => {
      await carla.page.bringToFront();
      await carla.page.keyboard.press('KeyF');
      await carla.page.waitForSelector('#mzFeed.on', { timeout: 2000 });
      const txt = await carla.page.textContent('#mzFeed');
      assert(txt.includes('Anna ti sfida alla Regata') && txt.includes('Bruno ha accettato') && txt.includes('Hai battuto Bruno'), 'testi: ' + txt);
      assert(/2 min fa/.test(txt) && /adesso/.test(txt) && /ieri/.test(txt), 'ore relative: ' + txt);
      const hi = await carla.page.$$eval('#mzFeed .mz-feed-row.new', (r) => r.map((x) => x.dataset.feed));
      assert(hi.join() === '7,5', 'righe in evidenza: ' + hi);
      await ctx.waitState(carla.page, (s) => s.feed.unread === 0, 3000);
      await sleep(300);
      ctx.log('POST /letto: ' + JSON.stringify(cf.reads));
      assert(cf.reads.length >= 1 && cf.reads[0].fino === 7, 'fino: ' + JSON.stringify(cf.reads));
      assert((await badge(carla.page)) === '', 'badge ancora acceso');
      const s = await ctx.getState(carla.page);
      assert(s.feed.open === true, 'state().feed.open');
    });
    await ctx.shot(carla.page, 'aperto_1280');
    await ctx.test('F chiude; Esc chiude; i tasti non restano incollati', async () => {
      await carla.page.keyboard.press('KeyF');
      await carla.page.waitForSelector('#mzFeed.on', { state: 'detached', timeout: 2000 }).catch(() => {});
      assert(!(await carla.page.$('#mzFeed.on')), 'F non chiude');
      await carla.page.click('#mzFeedBtn');
      await carla.page.waitForSelector('#mzFeed.on', { timeout: 2000 });
      await carla.page.keyboard.press('Escape');
      assert(!(await carla.page.$('#mzFeed.on')), 'Esc non chiude');
      const s = await ctx.getState(carla.page);
      assert(s.feed.open === false && s.feed.unread === 0, 'stato dopo la chiusura: ' + JSON.stringify(s.feed));
      // a pannello chiuso il gioco riceve di nuovo i tasti (freccia → l'avatar si muove)
      const a0 = s.avatar;
      await carla.page.keyboard.down('ArrowUp'); await sleep(600); await carla.page.keyboard.up('ArrowUp');
      const a1 = (await ctx.getState(carla.page)).avatar;
      assert(Math.hypot(a1.x - a0.x, a1.z - a0.z) > 0.2, 'avatar fermo dopo la chiusura del feed');
    });
    await ctx.test('feedRefresh() con una riga nuova → badge 1 + toast col testo', async () => {
      cf.rows.push({ id: 9, quando: Date.now(), tipo: 'sfida_ricevuta', testo: 'Dario ti sfida alla Regata: posta 30 Pietra. Rispondi al Tavolo entro 24 h', sfida: 'c4', da: 'dario', letto: false });
      await carla.page.evaluate(() => window.__game.test.feedRefresh());
      const b = await badge(carla.page), t = await toast(carla.page);
      ctx.log(`badge «${b}», toast «${t}»`);
      assert(b === '1', 'badge: ' + b);
      assert(t.startsWith('Dario ti sfida alla Regata'), 'toast: ' + t);
      // un secondo giro senza novità non ripete il toast
      await carla.page.evaluate(() => { document.getElementById('toast').style.opacity = '0'; });
      await carla.page.evaluate(() => window.__game.test.feedRefresh());
      assert((await toast(carla.page)) === '', 'toast ripetuto senza novità');
      ctx.noErrors(carla, 'Carla');
    });

    // ---- 2) poll: Carla visibile, Dario (telefono) con la scheda «nascosta» ----
    const drows = [{ id: 11, quando: now - 5 * MIN, tipo: 'sfida_rifiutata', testo: 'Bruno ha rifiutato: posta restituita', sfida: 'c5', da: 'bruno', letto: false }];
    const { pg: dario, feed: df } = await open('tokD', ctx.B.IPHONE, { rows: drows, hidden: true });
    await ctx.test('poll: scheda visibile ≥ 1 giro in 35 s, scheda nascosta 0 giri; tornata visibile → un giro subito', async () => {
      const c0 = cf.gets.length, t0 = Date.now();
      await sleep(35_000);
      const cN = cf.gets.length - c0, dN = df.gets.length;
      ctx.log(`in ${((Date.now() - t0) / 1000).toFixed(0)} s: visibile ${cN} GET, nascosta ${dN} GET (pollMs ${(await ctx.getState(carla.page)).feed.pollMs})`);
      assert(cN >= 1 && cN <= 2, 'giri a scheda visibile: ' + cN);
      assert(dN === 0, 'giri a scheda nascosta: ' + dN);
      await dario.page.evaluate(() => window.__setVisible(true));
      await ctx.waitState(dario.page, (s) => s.feed.unread === 1, 3000);
      assert(df.gets.length === 1, 'giri al ritorno visibile: ' + df.gets.length);
    });
    await ctx.test('telefono 390×844: la campanella apre il foglio del feed', async () => {
      await dario.page.bringToFront();
      assert((await badge(dario.page)) === '1', 'badge sul telefono');
      await dario.page.tap('#mzFeedBtn');
      await dario.page.waitForSelector('#mzFeed.on', { timeout: 2000 });
      const r = await dario.page.$eval('#mzFeed', (e) => { const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom }; });
      ctx.log('foglio: ' + JSON.stringify(r));
      assert(r.l >= 0 && r.r <= 390 && r.b <= 844 && r.t > 300, 'foglio fuori posto');
      await sleep(300);
      assert(df.reads[0]?.fino === 11, 'fino: ' + JSON.stringify(df.reads));
      await ctx.shot(dario.page, 'aperto_390');
      await dario.page.tap('#mzFeed .mz-x');
      assert(!(await dario.page.$('#mzFeed.on')), '× non chiude');
      ctx.noErrors(dario, 'Dario');
    });
    await dario.close(); ctx._pages.splice(ctx._pages.indexOf(dario), 1);
    await carla.close(); ctx._pages.splice(ctx._pages.indexOf(carla), 1);

    // ---- 3) server vero ----
    const hdr = (t) => ({ 'x-token': t, 'content-type': 'application/json', 'x-test-now-offset': String(OFF) });
    const post = async (p, t, b) => { const r = await fetch(base + p, { method: 'POST', headers: hdr(t), body: b === undefined ? undefined : JSON.stringify(b) }); return { status: r.status, body: await r.json().catch(() => null) }; };
    const get = async (p, t) => { const r = await fetch(base + p, { headers: hdr(t) }); return { status: r.status, body: await r.json().catch(() => null) }; };
    const probe = await get('/api/feed', 'tokB');
    if (probe.status === 404) {
      ctx.warn('server vero: Anna sfida Bruno → badge 1 su Bruno', '/api/feed risponde 404: F3-server non ha ancora finito, test rimandato');
    } else {
      await ctx.test('server vero: Anna sfida Bruno e gioca, Bruno entra e il badge vale 1', async () => {
        const b = await post('/api/lot/build', 'tokA', { building: 'tavolo', cell: slotCells[0] });
        assert(b.status === 200, 'build tavolo: ' + b.status + ' ' + JSON.stringify(b.body).slice(0, 200));
        OFF = 10 * MIN;
        const c = await post('/api/challenges', 'tokA', { minigame: 'regata', to: 'bruno', stake: { legno: 20, pietra: 0, perle: 0 } });
        assert(c.status === 200, 'sfida: ' + JSON.stringify(c.body).slice(0, 200));
        const s = regata.create({ seed: c.body.seed, difficulty: c.body.difficulty }), frames = [];
        while (!s.done) { const f = quantize(lazyAutopilot(s)); frames.push(f); regata.step(s, f); }
        const p = await post(`/api/challenges/${c.body.id}/play`, 'tokA', { inputs: packInputs(frames) });
        assert(p.status === 200 && p.body.challenge.state === 'aperta', 'play: ' + JSON.stringify(p.body).slice(0, 200));
        const f = await get('/api/feed', 'tokB');
        ctx.log('feed di Bruno: ' + JSON.stringify(f.body).slice(0, 300));
        assert(f.status === 200 && f.body.nonLetti === 1, 'feed di Bruno: ' + f.status);
        const { pg: bruno } = await open('tokB', ctx.B.DESKTOP);
        await ctx.waitState(bruno.page, (st) => st.feed.unread === 1, 10000);
        assert((await badge(bruno.page)) === '1', 'badge di Bruno');
        const t = await toast(bruno.page);
        ctx.log(`toast di Bruno «${t}»`);
        assert(/Anna/.test(t), 'toast di Bruno: ' + t);
        await ctx.shot(bruno.page, 'bruno_sfidato_1280');
        await bruno.page.keyboard.press('KeyF');
        await bruno.page.waitForSelector('#mzFeed.on', { timeout: 2000 });
        await ctx.waitState(bruno.page, (st) => st.feed.unread === 0, 5000);
        await sleep(500);
        assert((await get('/api/feed', 'tokB')).body.nonLetti === 0, 'il server non ha segnato letto');
        ctx.noErrors(bruno, 'Bruno');
      });
    }
  } finally {
    if (dev) { try { process.kill(-dev.pid, 'SIGTERM'); } catch { /* già finito */ } await sleep(500); try { process.kill(-dev.pid, 'SIGKILL'); } catch { /* ok */ } }
    fs.rmSync(persist, { recursive: true, force: true });
  }
}
