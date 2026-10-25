// M1 · Fetta 3, editor dell'avatar (F3-avatar, CONTRACTS §13) sul server locale (wrangler dev, TEST_CLOCK:1).
// (1) C apre #mzEditor, le frecce cambiano riga e valore, l'avatar cambia subito, nessuna POST /api/look; (2) Esc ripristina e chiude;
// (3) colore dei capelli + Salva → POST 200, dopo il reload /api/me e l'avatar hanno il look nuovo; (4) niente righe Vestito e Cappello
// (si comprano dal Mercante e si indossano dalla Borsa): un cappello comprato e messo (API) resta nel look quando si salva dall'Aspetto;
// (5) «Altro dispositivo»: COPIA LINK / MANDA danno `/?t=token` (mai scritto a schermo), copia rifiutata → campo col link;
// (6) telefono 390×844: il bottone apre il foglio, che lascia libero il centro.
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
  const { vetrinaMercante } = await sim('economy/mercante.ts');
  const avatar = JSON.parse(fs.readFileSync(path.join(ctx.ROOT, 'packages/content/src/avatar.json'), 'utf8'));

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
      const pg = await ctx.B.openPage(ctx.browser, `${base}/?t=${token}&test=1`, { viewport });
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
      await ctx.waitState(anna.page, (s) => s.editor.monete !== null, 5000);
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
      await anna.page.keyboard.press('ArrowDown');
      assert((await focusedRow(anna)) === 'coloreCapelli', 'riga attesa Colore capelli: ' + (await focusedRow(anna)));
      await anna.page.keyboard.press('ArrowRight'); // colore capelli +1
      s = await st(anna);
      const want = { ...saved0, pelle: (saved0.pelle + 1) % 6, capelli: (saved0.capelli + 2) % 8, coloreCapelli: (saved0.coloreCapelli + 1) % 6 };
      assert(sameLook(s.editor.draft, want), `bozza ${S(s.editor.draft)} ≠ attesa ${S(want)}`);
      assert(sameLook(s.wp2_avatar.look, want), 'avatar ≠ bozza: ' + S(s.wp2_avatar.look));
      assert(s.editor.open && sameLook(s.editor.saved, saved0), 'salvato cambiato senza Salva');
      const txt = await anna.page.locator('#mzEditor').innerText();
      assert(txt.includes(avatar.capelli[want.capelli].charAt(0).toUpperCase()), 'nomi dai dati mancanti: ' + txt.slice(0, 200));
      assert((await anna.page.locator('#mzEditor [data-row="vestito"], #mzEditor [data-row="cappello"]').count()) === 0, 'righe Vestito/Cappello ancora nell’Aspetto');
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

    const V = (saved0.coloreCapelli + 2) % avatar.coloriCapelli.length;
    await ctx.test('colore dei capelli + Salva → POST 200; dopo il reload /api/me e l’avatar hanno il look nuovo', async () => {
      await anna.page.evaluate(() => window.__game.test.openEditor());
      await waitOpen(anna, true);
      await nav(anna, `coloreCapelli:${V}`).click();
      assert((await st(anna)).wp2_avatar.look.coloreCapelli === V, 'clic sul campione: avatar non aggiornato');
      assert(posts.look.length === 0, 'POST prima di Salva');
      const [resp] = await Promise.all([
        anna.page.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/look', { timeout: 10000 }),
        nav(anna, 'salva').click(),
      ]);
      assert(resp.status() === 200, 'POST /api/look: ' + resp.status());
      await waitOpen(anna, false);
      const s = await st(anna);
      assert(s.editor.saved.coloreCapelli === V && s.wp2_avatar.look.coloreCapelli === V, 'dopo Salva: ' + S(s.editor.saved));
      await anna.page.reload({ waitUntil: 'load' });
      await ctx.waitReady(anna.page, 30000);
      await ctx.waitState(anna.page, (x) => x.editor && x.wp2_avatar && x.wp2_avatar.look, 15000);
      const me = (await get('/api/me', 'tokA')).body.look, s2 = await st(anna);
      assert(me.coloreCapelli === V && sameLook(me, { ...saved0, coloreCapelli: V }), '/api/me: ' + S(me));
      assert(sameLook(s2.wp2_avatar.look, me), 'avatar dopo il reload: ' + S(s2.wp2_avatar.look));
      assert(posts.look.length === 1, 'POST /api/look attese 1: ' + posts.look.length);
    });

    await ctx.test('cappello comprato dal Mercante (API) e messo: salvando dall’Aspetto resta nel look', async () => {
      // monete vere: Regate da solo via API con l'autopilot, poi il cappello del giorno più economico
      OFF = 10 * MIN;
      const oggi = vetrinaMercante(Date.now() + OFF).cappelli.map((id) => avatar.cappelli.findIndex((h) => h.id === id)).sort((x, y) => avatar.cappelli[x].monete - avatar.cappelli[y].monete);
      const HAT = oggi[0], prezzo = avatar.cappelli[HAT].monete;
      const race = (seed, difficulty, pigro) => {
        const x = regata.create({ seed, difficulty }), rng = createRng(seed), frames = [];
        while (!x.done) { const f = quantize(pigro ? lazyAutopilot(x) : regata.autopilot(x, rng)); frames.push(f); regata.step(x, f); }
        return packInputs(frames);
      };
      for (let i = 0; i < 6 && (await get('/api/lot', 'tokA')).body.monete < prezzo; i++) {
        const g = (await post('/api/solo/start', 'tokA', { minigame: 'regata' })).body;
        assert(Number.isInteger(g.seed), 'solo start: ' + S(g).slice(0, 200));
        assert((await post('/api/solo/play', 'tokA', { inputs: race(g.seed, g.difficulty, false) })).status === 200, 'solo play');
      }
      const perle = (await get('/api/lot', 'tokA')).body.monete;
      ctx.log(`monete di Anna dopo le Regate: ${perle}, cappello ${avatar.cappelli[HAT].id} (${prezzo})`);
      assert(perle >= prezzo, 'monete insufficienti anche dopo le Regate: ' + perle);
      assert((await post('/api/look/hat', 'tokA', { cappello: avatar.cappelli[HAT].id })).status === 200, 'acquisto dal Mercante');
      const conCappello = { ...(await get('/api/me', 'tokA')).body.look, cappello: HAT };
      assert((await post('/api/look', 'tokA', conCappello)).status === 200, 'look col cappello comprato');
      await anna.page.reload({ waitUntil: 'load' });
      await ctx.waitReady(anna.page, 30000);
      await ctx.waitState(anna.page, (x, h) => x.editor && x.wp2_avatar?.look?.cappello === h, 15000, HAT);
      await anna.page.evaluate(() => window.__game.test.openEditor());
      await waitOpen(anna, true);
      await nav(anna, `pelle:${(conCappello.pelle + 1) % avatar.pelle.length}`).click();
      const [r3] = await Promise.all([
        anna.page.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/look', { timeout: 10000 }),
        nav(anna, 'salva').click(),
      ]);
      assert(r3.status() === 200, 'salva: ' + r3.status());
      await waitOpen(anna, false);
      const me = (await get('/api/me', 'tokA')).body.look;
      assert(me.cappello === HAT && me.pelle === (conCappello.pelle + 1) % avatar.pelle.length, 'il cappello si è perso salvando: ' + S(me));
      assert((await st(anna)).wp2_avatar.look.cappello === HAT, 'avatar senza cappello dopo Salva');
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

    await ctx.test('telefono 390×844: AVATAR → Aspetto apre il foglio (#417), il centro resta libero', async () => {
      const bruno = await open('tokB', ctx.B.IPHONE);
      const b0 = (await st(bruno)).wp2_avatar.look;
      await bruno.page.locator('#mzAvatarBtn').tap();
      await bruno.page.locator('#mzAvatarMenu [data-voce="aspetto"]').tap();
      await waitOpen(bruno, true);
      // si misura quando è arrivato il lotto chiesto all'apertura: se cambia qualcosa il foglio si rifà e i bottoni di prima si staccano (#166)
      await ctx.waitState(bruno.page, (s) => s.editor.lotFresco === true, 15000);
      const box = await bruno.page.locator('#mzEditor').boundingBox();
      ctx.log('foglio: ' + S(box));
      assert(box && box.y > 844 / 2 + 10, 'il foglio copre il centro del canvas: ' + S(box));
      const sw = await nav(bruno, 'coloreCapelli:3').boundingBox();
      assert(sw && sw.width >= 44 && sw.height >= 44, 'campione < 44 px: ' + S(sw));
      await nav(bruno, 'coloreCapelli:3').tap();
      assert((await st(bruno)).wp2_avatar.look.coloreCapelli === 3, 'tocco sul campione: avatar non aggiornato');
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

    await ctx.test('editor: modifica del nome del personaggio e SALVA (#301)', async () => {
      await anna.page.evaluate(() => window.__game.test.openEditor());
      await waitOpen(anna, true);
      const input = anna.page.locator('#mzEditor [data-nav="avatar-nome"]');
      assert(await input.isVisible(), 'campo nome non visibile');
      assert((await input.inputValue()) === 'Anna', 'nome iniziale in input non corretto: ' + (await input.inputValue()));
      await input.fill('X');
      assert(await nav(anna, 'salva').isDisabled(), 'Salva non disabilitato con nome di 1 lettera');
      await input.fill('Annarella');
      assert(!(await nav(anna, 'salva').isDisabled()), 'Salva disabilitato con nome valido');
      const [resp] = await Promise.all([
        anna.page.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/nome', { timeout: 10000 }),
        nav(anna, 'salva').click(),
      ]);
      assert(resp.status() === 200, 'POST /api/nome fallita: ' + resp.status());
      await waitOpen(anna, false);
      const me = (await get('/api/me', 'tokA')).body;
      assert(me.nome === 'Annarella', '/api/me non ha il nuovo nome: ' + me.nome);
      await post('/api/nome', 'tokA', { nome: 'Anna' });
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
