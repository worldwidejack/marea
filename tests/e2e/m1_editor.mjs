// M1 · Fetta 3, editor dell'avatar (F3-avatar, CONTRACTS §13) sul server locale (wrangler dev, TEST_CLOCK:1).
// (1) C apre #mzEditor, le frecce cambiano riga e valore, l'avatar cambia subito, nessuna POST /api/look; (2) Esc ripristina e chiude;
// (3) vestito + Salva → POST 200, dopo il reload /api/me e l'avatar hanno il look nuovo; (4) cappello a Perle: prezzo, «Compra» senza Perle
// → avviso gentile sotto la riga del cappello (#4, arancio, nessuna chiamata al server), Salva spento; un esclusivo del Mercante (#63) non
// ha «Compra» ma l'avviso «dal Mercante»; poi Perle vinte con una sfida chiusa (API) → Compra e Salva; (5) Tavolo aperto: C non apre l'editor;
// (6) «Altro dispositivo»: COPIA LINK / MANDA danno `/?t=token` (mai scritto a schermo), copia rifiutata → campo col link;
// (7) telefono 390×844: il bottone apre il foglio, che lascia libero il centro.
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
export const timeout = 180000;

const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MIN = 60_000;
const KEYS = ['pelle', 'capelli', 'coloreCapelli', 'vestito', 'cappello'];
const sameLook = (a, b) => !!a && !!b && KEYS.every((k) => a[k] === b[k]);
const S = (l) => JSON.stringify(l);

export default async function (ctx) {
  const { assert } = ctx;
  const SERVER = path.join(ctx.ROOT, 'apps/server');
  const persist = path.join(ctx.OUT, `m1editor-${process.pid}`);
  const env = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' };
  const wr = (...a) => execFileSync('npx', ['--no-install', 'wrangler', ...a], { cwd: SERVER, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 }).toString();
  const sim = async (f) => import(pathToFileURL(path.join(ctx.ROOT, 'packages/sim/src', f)).href);
  const { regata, lazyAutopilot } = await sim('minigames/regata/regata.ts');
  const { packInputs, quantize } = await sim('replay.ts');
  const { createRng } = await sim('rng.ts');
  const islands = JSON.parse(fs.readFileSync(path.join(ctx.ROOT, 'packages/content/src/islands.json'), 'utf8'));
  const avatar = JSON.parse(fs.readFileSync(path.join(ctx.ROOT, 'packages/content/src/avatar.json'), 'utf8'));
  const tpl = islands.find((i) => i.id === 'lotto');
  const slotCells = tpl.rows.flatMap((row, z) => [...row].flatMap((c, x) => (c === 'L' ? [[x, z]] : [])));
  const HAT = avatar.cappelli.findIndex((h) => h.id === 'pescatore');

  let dev = null, log = '', OFF = 0;
  const pages = [];
  try {
    fs.rmSync(persist, { recursive: true, force: true });
    wr('d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', persist);
    wr('d1', 'execute', 'DB', '--local', '--persist-to', persist, '--command',
      "INSERT INTO persone (id, nome, token, slot) VALUES ('anna', 'Anna', 'tokA', 1), ('bruno', 'Bruno', 'tokB', 2);");
    const port = await freePort(), inspector = await freePort();
    dev = spawn('npx', ['--no-install', 'wrangler', 'dev', '--local', '--ip', '127.0.0.1', '--port', String(port), '--inspector-port', String(inspector),
      '--assets', ctx.distDir, '--persist-to', persist, '--var', 'TEST_CLOCK:1', '--show-interactive-dev-session=false'], { cwd: SERVER, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    dev.stdout.on('data', (d) => (log += d)); dev.stderr.on('data', (d) => (log += d));
    const base = `http://127.0.0.1:${port}`;
    let up = false;
    for (let i = 0; i < 120 && !up; i++) { try { up = (await fetch(base + '/api/ping')).ok; } catch { /* non ancora */ } if (!up) await sleep(500); }
    if (!up) throw new Error('wrangler dev non risponde:\n' + log.split('\n').slice(-20).join('\n'));

    const hdr = (t) => ({ 'x-token': t, 'content-type': 'application/json', 'x-test-now-offset': String(OFF) });
    const get = async (p, t) => { const r = await fetch(base + p, { headers: hdr(t) }); return { status: r.status, body: await r.json() }; };
    const post = async (p, t, b) => { const r = await fetch(base + p, { method: 'POST', headers: hdr(t), body: b === undefined ? undefined : JSON.stringify(b) }); return { status: r.status, body: await r.json() }; };

    // ---- browser: conta le POST /api/look e /api/look/hat; orologio di test su ogni /api ----
    const posts = { look: [], hat: [] };
    const open = async (token, viewport) => {
      const pg = await ctx.B.openPage(ctx.browser, `${base}/?t=${token}&test=1&sfide=1`, { viewport });
      pages.push(pg); ctx._pages.push(pg);
      await pg.page.route('**/api/**', (route) => {
        const rq = route.request(), u = new URL(rq.url());
        if (rq.method() === 'POST' && u.pathname === '/api/look') posts.look.push(u.pathname);
        if (rq.method() === 'POST' && u.pathname === '/api/look/hat') posts.hat.push(u.pathname);
        return route.continue({ headers: { ...rq.headers(), 'x-test-now-offset': String(OFF) } });
      });
      await ctx.waitReady(pg.page, 30000);
      await ctx.waitState(pg.page, (s) => s.editor && s.wp2_avatar && s.wp2_avatar.look, 15000);
      return pg;
    };
    const st = async (pg) => ctx.getState(pg.page);
    const nav = (pg, n) => pg.page.locator(`#mzEditor [data-nav="${n}"]`);
    const waitOpen = (pg, v) => ctx.waitState(pg.page, (s, want) => s.editor.open === want, 5000, v);
    const focusedRow = (pg) => pg.page.evaluate(() => document.activeElement?.closest('[data-row]')?.dataset.row ?? document.activeElement?.dataset.nav ?? null);

    const anna = await open('tokA', ctx.B.DESKTOP);
    const saved0 = (await get('/api/me', 'tokA')).body.look;
    ctx.log('look iniziale di Anna: ' + S(saved0));

    await ctx.test('desktop: C apre #mzEditor, frecce cambiano riga e valore, avatar dal vivo, zero POST', async () => {
      await anna.page.mouse.click(640, 200); // focus alla pagina (sul canvas), come un giocatore
      await anna.page.keyboard.press('c');
      await waitOpen(anna, true);
      assert(await anna.page.locator('#mzEditor.on').isVisible(), '#mzEditor.on non visibile');
      await ctx.waitState(anna.page, (s) => s.editor.perle !== null, 5000);
      assert((await focusedRow(anna)) === 'pelle', 'focus iniziale non sulla riga Pelle: ' + (await focusedRow(anna)));
      const s0 = await st(anna);
      assert(sameLook(s0.editor.draft, saved0) && sameLook(s0.wp2_avatar.look, saved0), 'bozza/avatar iniziali ≠ salvato: ' + S(s0.editor.draft));
      await anna.page.keyboard.press('ArrowRight'); // pelle +1
      let s = await st(anna);
      assert(s.editor.draft.pelle === (saved0.pelle + 1) % avatar.pelle.length, 'pelle non cambiata: ' + S(s.editor.draft));
      assert(sameLook(s.wp2_avatar.look, s.editor.draft), 'avatar non aggiornato subito: ' + S(s.wp2_avatar.look));
      await anna.page.keyboard.press('ArrowDown');
      assert((await focusedRow(anna)) === 'capelli', 'freccia giù non va alla riga Capelli: ' + (await focusedRow(anna)));
      await anna.page.keyboard.press('ArrowRight'); await anna.page.keyboard.press('ArrowRight');
      await anna.page.keyboard.press('ArrowDown'); await anna.page.keyboard.press('ArrowDown');
      assert((await focusedRow(anna)) === 'vestito', 'riga attesa Vestito: ' + (await focusedRow(anna)));
      await anna.page.keyboard.press('ArrowLeft'); // vestito 0 → ultimo (giro)
      await anna.page.keyboard.press('ArrowUp');
      await anna.page.keyboard.press('ArrowRight'); // colore capelli +1
      s = await st(anna);
      const want = { ...saved0, pelle: (saved0.pelle + 1) % 6, capelli: (saved0.capelli + 2) % 8, coloreCapelli: (saved0.coloreCapelli + 1) % 6, vestito: (saved0.vestito + 5) % 6 };
      assert(sameLook(s.editor.draft, want), `bozza ${S(s.editor.draft)} ≠ attesa ${S(want)}`);
      assert(sameLook(s.wp2_avatar.look, want), 'avatar ≠ bozza: ' + S(s.wp2_avatar.look));
      assert(s.editor.open && sameLook(s.editor.saved, saved0), 'salvato cambiato senza Salva');
      const txt = await anna.page.locator('#mzEditor').innerText();
      assert(txt.includes(avatar.capelli[want.capelli].charAt(0).toUpperCase()) && /Nessuno|Cappello/i.test(txt), 'nomi dai dati mancanti: ' + txt.slice(0, 200));
      // il pannello sta a destra (340 px), il centro dello schermo resta libero per l'avatar
      const box = await anna.page.locator('#mzEditor').boundingBox();
      assert(box && box.x > 640 && box.width <= 342, 'pannello non a destra da 340 px: ' + S(box));
      await ctx.shot(anna.page, 'desktop_editor_aperto');
      assert(posts.look.length === 0, 'POST /api/look durante l’anteprima: ' + posts.look.length);
    });

    await ctx.test('Esc: ripristina il look salvato, chiude, zero POST', async () => {
      await anna.page.keyboard.press('Escape');
      await waitOpen(anna, false);
      const s = await st(anna);
      assert(sameLook(s.wp2_avatar.look, saved0), 'avatar non ripristinato: ' + S(s.wp2_avatar.look));
      assert(!(await anna.page.locator('#mzEditor.on').count()), '#mzEditor ancora .on');
      assert(posts.look.length === 0 && posts.hat.length === 0, `POST partite: look ${posts.look.length}, hat ${posts.hat.length}`);
      assert(sameLook((await get('/api/me', 'tokA')).body.look, saved0), 'il server ha un look diverso');
      // di nuovo C apre e C chiude (annulla anche lui)
      await anna.page.keyboard.press('c'); await waitOpen(anna, true);
      await anna.page.keyboard.press('ArrowRight');
      await anna.page.keyboard.press('c'); await waitOpen(anna, false);
      assert(sameLook((await st(anna)).wp2_avatar.look, saved0), 'C non annulla');
    });

    const V = (saved0.vestito + 2) % avatar.vestiti.length;
    await ctx.test('vestito + Salva → POST 200; dopo il reload /api/me e l’avatar hanno il look nuovo', async () => {
      await anna.page.evaluate(() => window.__game.test.openEditor());
      await waitOpen(anna, true);
      await nav(anna, `vestito:${V}`).click();
      assert((await st(anna)).wp2_avatar.look.vestito === V, 'clic sul campione: avatar non aggiornato');
      assert(posts.look.length === 0, 'POST prima di Salva');
      const [resp] = await Promise.all([
        anna.page.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/look', { timeout: 10000 }),
        nav(anna, 'salva').click(),
      ]);
      assert(resp.status() === 200, 'POST /api/look: ' + resp.status());
      await waitOpen(anna, false);
      const s = await st(anna);
      assert(s.editor.saved.vestito === V && s.wp2_avatar.look.vestito === V, 'dopo Salva: ' + S(s.editor.saved));
      await anna.page.reload({ waitUntil: 'load' });
      await ctx.waitReady(anna.page, 30000);
      await ctx.waitState(anna.page, (x) => x.editor && x.wp2_avatar && x.wp2_avatar.look, 15000);
      const me = (await get('/api/me', 'tokA')).body.look, s2 = await st(anna);
      assert(me.vestito === V && sameLook(me, { ...saved0, vestito: V }), '/api/me: ' + S(me));
      assert(sameLook(s2.wp2_avatar.look, me), 'avatar dopo il reload: ' + S(s2.wp2_avatar.look));
      assert(posts.look.length === 1, 'POST /api/look attese 1: ' + posts.look.length);
    });

    await ctx.test('cappello a Perle: prezzo, «Compra» senza Perle → avviso gentile vicino al bottone, Salva spento; con le Perle vinte compra e salva', async () => {
      await anna.page.evaluate(() => window.__game.test.openEditor());
      await waitOpen(anna, true);
      await ctx.waitState(anna.page, (s) => s.editor.perle !== null, 5000);
      const p0 = (await st(anna)).editor.perle;
      for (let i = 0; i < HAT; i++) await nav(anna, 'cappello:piu').click();
      let s = await st(anna);
      assert(s.editor.draft.cappello === HAT && s.wp2_avatar.look.cappello === HAT, 'cappello pescatore non in anteprima: ' + S(s.editor.draft));
      assert(!s.editor.owned.includes('pescatore'), 'pescatore già posseduto?');
      const row = await anna.page.locator('#mzEditor [data-row="cappello"]').innerText();
      assert(/10 Perle/.test(row) && /pescatore/i.test(row), 'prezzo non visibile: ' + row);
      assert(await nav(anna, 'salva').isDisabled(), 'Salva acceso con un cappello non tuo');
      const hats0 = posts.hat.length;
      await nav(anna, 'compra').click();
      const bad = anna.page.locator('#mzEditor [data-row="cappello"] .mz-ed-miss.bad');
      await bad.waitFor({ timeout: 5000 });
      const errTxt = await bad.innerText(), col = await bad.evaluate((e) => getComputedStyle(e).color);
      ctx.log(`Perle ${p0} · avviso: «${errTxt}» (${col})`);
      assert(/Ti mancano 10 Perle/.test(errTxt) && /minigiochi/.test(errTxt), 'avviso non gentile: ' + errTxt);
      assert(col === 'rgb(242, 163, 58)', 'avviso non arancio (#4: niente rosso da errore): ' + col);
      assert(posts.hat.length === hats0, 'senza Perle «Compra» non deve chiamare il server');
      assert(await nav(anna, 'salva').isDisabled(), 'Salva acceso dopo l’errore');
      await ctx.shot(anna.page, 'cappello_senza_perle_errore');
      // esclusivo del Mercante (#63): si prova, ma niente «Compra»: si compra al Porto
      const EX = avatar.cappelli.findIndex((h) => h.mercante);
      for (let i = HAT; i < EX; i++) await nav(anna, 'cappello:piu').click();
      const rowEx = await anna.page.locator('#mzEditor [data-row="cappello"]').innerText();
      assert(/Mercante/.test(rowEx) && (await nav(anna, 'compra').count()) === 0, 'esclusivo con «Compra» o senza avviso: ' + rowEx);
      assert((await st(anna)).wp2_avatar.look.cappello === EX, 'esclusivo non in anteprima');
      await anna.page.keyboard.press('Escape'); await waitOpen(anna, false);
      assert(posts.look.length === 1, 'POST /api/look con cappello non tuo');

      // Perle vere: Tavolo per entrambi, sfida chiusa via API (Anna con l'autopilot, Bruno pigro)
      for (const t of ['tokA', 'tokB']) { const r = await post('/api/lot/build', t, { building: 'tavolo', cell: slotCells[0] }); assert(r.status === 200, `tavolo ${t}: ${r.status}`); }
      OFF = 10 * MIN;
      const race = (seed, difficulty, pigro) => {
        const x = regata.create({ seed, difficulty }), rng = createRng(seed), frames = [];
        while (!x.done) { const f = quantize(pigro ? lazyAutopilot(x) : regata.autopilot(x, rng)); frames.push(f); regata.step(x, f); }
        return packInputs(frames);
      };
      const c = (await post('/api/challenges', 'tokA', { minigame: 'regata', to: 'bruno', stake: { legno: 10, pietra: 0, perle: 0 } })).body;
      assert(c.id, 'sfida: ' + S(c));
      assert((await post(`/api/challenges/${c.id}/play`, 'tokA', { inputs: race(c.seed, c.difficulty, false) })).status === 200, 'play Anna');
      assert((await post(`/api/challenges/${c.id}/accept`, 'tokB')).status === 200, 'accept Bruno');
      const pb = await post(`/api/challenges/${c.id}/play`, 'tokB', { inputs: race(c.seed, c.difficulty, true) });
      assert(pb.status === 200 && pb.body.challenge.state === 'chiusa', 'sfida non chiusa: ' + S(pb.body).slice(0, 200));
      const perle = (await get('/api/lot', 'tokA')).body.resources.perle;
      ctx.log(`Perle di Anna dopo la sfida: ${perle}`);
      assert(perle >= avatar.cappelli[HAT].perle, 'Perle insufficienti anche dopo la sfida: ' + perle);

      await anna.page.evaluate(() => window.__game.test.openEditor());
      await waitOpen(anna, true);
      await ctx.waitState(anna.page, (x, n) => x.editor.perle === n, 5000, perle);
      for (let i = 0; i < HAT; i++) await nav(anna, 'cappello:piu').click();
      const [r2] = await Promise.all([
        anna.page.waitForResponse((r) => new URL(r.url()).pathname === '/api/look/hat', { timeout: 10000 }),
        nav(anna, 'compra').click(),
      ]);
      assert(r2.status() === 200, 'compra con le Perle: ' + r2.status());
      await ctx.waitState(anna.page, (x) => x.editor.owned.includes('pescatore') && !x.editor.busy, 5000);
      s = await st(anna);
      assert(s.editor.perle === perle - avatar.cappelli[HAT].perle, 'Perle non scalate nel pannello: ' + s.editor.perle);
      assert(!(await nav(anna, 'salva').isDisabled()), 'Salva spento con il cappello comprato');
      await ctx.shot(anna.page, 'cappello_comprato');
      const [r3] = await Promise.all([
        anna.page.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/look', { timeout: 10000 }),
        nav(anna, 'salva').click(),
      ]);
      assert(r3.status() === 200, 'salva col cappello: ' + r3.status());
      await waitOpen(anna, false);
      assert((await get('/api/me', 'tokA')).body.look.cappello === HAT, 'cappello non salvato sul server');
      assert((await st(anna)).wp2_avatar.look.cappello === HAT, 'avatar senza cappello dopo Salva');
    });

    await ctx.test('Tavolo aperto: C non apre l’editor', async () => {
      await anna.page.evaluate(() => window.__game.test.openTavolo());
      await ctx.waitState(anna.page, (s) => s.tavolo.open === true, 5000);
      await anna.page.keyboard.press('c');
      await anna.page.waitForTimeout(300);
      const s = await st(anna);
      assert(s.editor.open === false && s.tavolo.open === true, `editor ${s.editor.open}, tavolo ${s.tavolo.open}`);
      assert(!(await anna.page.locator('#mzEditor.on').count()), '#mzEditor visibile col Tavolo aperto');
      await anna.page.keyboard.press('Escape');
      await ctx.waitState(anna.page, (x) => x.tavolo.open === false, 5000);
    });

    await ctx.test('altro dispositivo: COPIA LINK copia /?t=token (mai a schermo), MANDA condivide, copia rifiutata → campo col link', async () => {
      // appunti e condivisione finti: in headless mancano o chiedono permessi
      await anna.page.evaluate(() => {
        window.__copiato = null; window.__mandato = null; window.__copiaNo = false;
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (t) => { if (window.__copiaNo) throw new Error('negato'); window.__copiato = t; } } });
        navigator.share = async (d) => { window.__mandato = d.url; };
      });
      await anna.page.evaluate(() => window.__game.test.openEditor());
      await waitOpen(anna, true);
      const want = `${base}/?t=tokA`;
      const txt = await anna.page.locator('#mzEditor').innerText();
      assert(/Altro dispositivo/i.test(txt) && !txt.includes('tokA'), 'sezione mancante o token a schermo: ' + txt.slice(-300));
      await nav(anna, 'copia-link').click();
      await anna.page.locator('#mzEditor .mz-note.ok').waitFor({ timeout: 5000 });
      const copiato = await anna.page.evaluate(() => window.__copiato);
      assert(copiato === want, `appunti: ${copiato} ≠ ${want}`);
      await nav(anna, 'manda-link').click();
      await anna.page.waitForFunction(() => window.__mandato !== null, null, { timeout: 5000 });
      const mandato = await anna.page.evaluate(() => window.__mandato);
      assert(mandato === want, `condivisione: ${mandato} ≠ ${want}`);
      await anna.page.evaluate(() => { window.__copiaNo = true; });
      await nav(anna, 'copia-link').click();
      await ctx.waitState(anna.page, (s) => s.editor.linkVisibile === true, 5000);
      const campo = await anna.page.locator('#mzEditor .mz-ed-url').inputValue();
      assert(campo === want, `campo col link: ${campo}`);
      assert(await anna.page.locator('#mzEditor .mz-note.bad').isVisible(), 'nessun avviso dopo la copia rifiutata');
      await ctx.shot(anna.page, 'editor_altro_dispositivo');
      await anna.page.keyboard.press('Escape'); await waitOpen(anna, false);
      assert(!(await st(anna)).editor.linkVisibile, 'il campo col link resta dopo la chiusura');
    });

    await ctx.test('telefono 390×844: tocco su #mzEditorBtn apre il foglio, il centro resta libero', async () => {
      const bruno = await open('tokB', ctx.B.IPHONE);
      const b0 = (await st(bruno)).wp2_avatar.look;
      await bruno.page.locator('#mzEditorBtn').tap();
      await waitOpen(bruno, true);
      const box = await bruno.page.locator('#mzEditor').boundingBox();
      ctx.log('foglio: ' + S(box));
      assert(box && box.y > 844 / 2 + 10, 'il foglio copre il centro del canvas: ' + S(box));
      const sw = await nav(bruno, 'vestito:3').boundingBox();
      assert(sw && sw.width >= 44 && sw.height >= 44, 'campione < 44 px: ' + S(sw));
      await nav(bruno, 'vestito:3').tap();
      assert((await st(bruno)).wp2_avatar.look.vestito === 3, 'tocco sul campione: avatar non aggiornato');
      const salva = await nav(bruno, 'salva').boundingBox();
      assert(salva && salva.y + salva.height <= 844, 'Salva fuori schermo: ' + S(salva));
      await ctx.shot(bruno.page, 'telefono_foglio');
      const copia = nav(bruno, 'copia-link');
      await copia.scrollIntoViewIfNeeded();
      const cb = await copia.boundingBox();
      assert(cb && cb.height >= 44 && cb.y + cb.height <= 844, 'COPIA LINK < 44 px o fuori schermo: ' + S(cb));
      await ctx.shot(bruno.page, 'telefono_altro_dispositivo');
      await nav(bruno, 'annulla').tap();
      await waitOpen(bruno, false);
      assert(sameLook((await st(bruno)).wp2_avatar.look, b0), 'Annulla non ripristina');
    });

    await ctx.test('nessun errore in console (a parte il 409 atteso di «Compra»)', async () => {
      for (const pg of pages) {
        const expected = pg.consoleErrors.filter((e) => /status of 409/.test(e));
        assert(expected.length <= 1, '409 in più: ' + expected.length);
        pg.consoleErrors.splice(0, pg.consoleErrors.length, ...pg.consoleErrors.filter((e) => !/status of 409/.test(e)));
        ctx.noErrors(pg, pg === anna ? 'Anna' : 'Bruno');
      }
    });
  } finally {
    for (const pg of pages) await pg.close().catch(() => {});
    if (dev) { try { process.kill(-dev.pid, 'SIGTERM'); } catch { /* già finito */ } await sleep(500); try { process.kill(-dev.pid, 'SIGKILL'); } catch { /* ok */ } }
    fs.rmSync(persist, { recursive: true, force: true });
  }
}
