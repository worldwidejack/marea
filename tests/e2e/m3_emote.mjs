// Emote da 4 a 8 + ruota rapida (#90). PC (1280×720, senza rete): G apre la ruota attorno al cursore, 8 spicchi che non coprono
// l'avatar; 1-8 con la ruota aperta; G tenuto + mouse + rilascio; G premuto + clic; Esc chiude. Le emote nuove fanno un saltello/giro.
// Telefono (390×844, senza rete): dal #417 la faccina non è più nell'HUD, si controlla solo che non si veda. Rete (wrangler, due browser): Bruno vede la emote nuova di Anna e il suo gesto.
// Screenshot: ruota aperta sul PC.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { freePort } from '../lib/wrangler.mjs';
export const timeout = 300000;
const R = 120; // raggio della ruota (WHEEL_R in game/emote.ts)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Centro (px pagina) dello spicchio `id` della ruota aperta. */
const tileAt = (page, id) => page.$eval(`#mzEmoteWheel.on .mz-wheel-t[data-emote="${id}"]`, (t) => { const r = t.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
/** Spicchi della ruota (rettangoli) + l'avatar (rettangolo, fumetto compreso) dallo stato. */
const geometry = (page) => page.evaluate(() => ({
  tiles: [...document.querySelectorAll('#mzEmoteWheel.on .mz-wheel-t')].map((t) => { const r = t.getBoundingClientRect(); return { id: t.dataset.emote, l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; }),
  wheel: window.__game.state().emotes.wheel, vw: innerWidth, vh: innerHeight,
}));
function checkWheel(ctx, g, what) {
  const { assert } = ctx;
  assert(g.wheel.open && g.tiles.length === 8, `${what}: ruota ${JSON.stringify(g.wheel)} con ${g.tiles.length} spicchi`);
  assert(g.tiles.map((t) => t.id).join() === 'saluto,esulta,ride,no,applauso,cuore,sorpresa,balla', `${what}: ordine ${g.tiles.map((t) => t.id)}`);
  assert(g.tiles.every((t) => t.w >= 44 && t.h >= 44), `${what}: spicchi sotto i 44 px`);
  assert(g.tiles.every((t) => t.l >= 0 && t.t >= 0 && t.r <= g.vw && t.b <= g.vh), `${what}: spicchi fuori dallo schermo`);
  const a = g.wheel.avatar;
  assert(a, `${what}: avatar non sullo schermo`);
  const over = g.tiles.filter((t) => t.l < a.r && t.r > a.l && t.t < a.b && t.b > a.t);
  assert(!over.length, `${what}: spicchi sopra l'avatar ${JSON.stringify(over.map((t) => t.id))} (avatar ${JSON.stringify(a)})`);
  const nx = Math.max(a.l, Math.min(g.wheel.x, a.r)), ny = Math.max(a.t, Math.min(g.wheel.y, a.b));
  assert(Math.hypot(g.wheel.x - nx, g.wheel.y - ny) >= R, `${what}: lo sfondo della ruota tocca l'avatar`);
}
const bubble = (page, who, id, timeout = 1500) => page.waitForSelector(`.mz-emote[data-who="${who}"][data-emote="${id}"]`, { state: 'attached', timeout });
const ready = (ctx, page) => ctx.waitState(page, (s) => s.emotes.cooldown === 0 && !s.emotes.gesti.length, 6000);

export default async function (ctx) {
  const { assert } = ctx;

  // ---------------- PC ----------------
  const pc = await ctx.open('?test=1&net=0', { viewport: ctx.B.DESKTOP });
  await ctx.waitReady(pc.page, 30000);
  const P = pc.page, st = () => ctx.getState(P);

  await ctx.test('PC: 8 emote, G apre la ruota attorno al cursore senza coprire l\'avatar', async () => {
    const s = await st();
    assert(s.emotes.ids === 8 && s.emotes.coarse === false, `emote ${s.emotes.ids}, coarse ${s.emotes.coarse}`);
    await P.mouse.move(330, 300);
    await P.keyboard.press('KeyG');
    await ctx.waitState(P, (x) => x.emotes.wheel.open && x.emotes.wheel.via === 'tasto', 3000);
    const g = await geometry(P);
    ctx.log('ruota PC ' + JSON.stringify(g.wheel));
    checkWheel(ctx, g, 'PC');
    assert(Math.hypot(g.wheel.x - 330, g.wheel.y - 300) < 2, `ruota lontana dal cursore: (${g.wheel.x}, ${g.wheel.y})`);
    const nums = await P.$$eval('#mzEmoteWheel.on .mz-wheel-t i', (is) => is.map((i) => i.textContent).join(''));
    assert(nums === '12345678', 'numeri sugli spicchi: ' + nums);
    const c = await tileAt(P, 'cuore'); await P.mouse.move(c.x, c.y, { steps: 4 });
    await ctx.waitState(P, (x) => x.emotes.wheel.sel === 5, 2000);
    assert((await P.textContent('#mzEmoteWheel .mz-wheel-c')) === 'Grazie!', 'etichetta al centro');
    await ctx.shot(P, 'ruota_1280');
  });

  await ctx.test('PC: con la ruota aperta il tasto 7 manda «sorpresa», saltello, ruota chiusa', async () => {
    await P.keyboard.press('Digit7');
    await bubble(P, 'me', 'sorpresa');
    assert((await P.textContent('.mz-emote[data-who="me"]')).includes('Oh!'), 'manca «Oh!»');
    await ctx.waitState(P, (x) => !x.emotes.wheel.open, 1000);
    await ctx.waitState(P, (x) => x.emotes.gesti.some((g) => g.who === 'me' && g.id === 'sorpresa' && g.hop > 0.05), 2000);
    await ctx.waitState(P, (x) => !x.emotes.gesti.length, 3000); // il gesto finisce e il corpo torna fermo
  });

  await ctx.test('PC: G tenuto, mouse sullo spicchio 8, rilascio → «balla» col giro', async () => {
    await ready(ctx, P);
    await P.mouse.move(330, 300);
    await P.keyboard.down('KeyG');
    await ctx.waitState(P, (x) => x.emotes.wheel.open, 3000);
    const b = await tileAt(P, 'balla'); await P.mouse.move(b.x, b.y, { steps: 6 });
    await ctx.waitState(P, (x) => x.emotes.wheel.sel === 7, 2000);
    await P.waitForTimeout(400); // il tasto va tenuto oltre i 350 ms del «tieni premuto»
    await P.keyboard.up('KeyG');
    await bubble(P, 'me', 'balla');
    await ctx.waitState(P, (x) => x.emotes.gesti.some((g) => g.who === 'me' && g.id === 'balla' && Math.abs(g.spin) > 0.5), 2000);
    await ctx.shot(P, 'balla_1280');
  });

  await ctx.test('PC: G premuto e lasciato + clic su «applauso»; Esc chiude senza mandare', async () => {
    await ready(ctx, P);
    await P.mouse.move(900, 420);
    await P.keyboard.press('KeyG');
    await ctx.waitState(P, (x) => x.emotes.wheel.open, 3000);
    checkWheel(ctx, await geometry(P), 'PC a destra');
    const a = await tileAt(P, 'applauso'); await P.mouse.click(a.x, a.y);
    await bubble(P, 'me', 'applauso');
    await ctx.waitState(P, (x) => !x.emotes.wheel.open && x.emotes.last?.id === 'applauso', 1000);
    await ready(ctx, P);
    await P.keyboard.press('KeyG');
    await ctx.waitState(P, (x) => x.emotes.wheel.open, 3000);
    await P.keyboard.press('Escape');
    await ctx.waitState(P, (x) => !x.emotes.wheel.open, 1000);
    assert((await st()).emotes.last.id === 'applauso', 'Esc ha mandato una emote');
    // tasti 5-8 anche a ruota chiusa
    await P.keyboard.press('Digit6');
    await bubble(P, 'me', 'cuore');
    ctx.noErrors(pc, 'PC');
  });
  await pc.close(); ctx._pages.splice(ctx._pages.indexOf(pc), 1);

  // ---------------- telefono ----------------
  // #417: la faccina non è più nell'HUD (scelta del gruppo); la ruota resta da tastiera sul PC (sopra).
  const ph = await ctx.open('?test=1&net=0');
  await ctx.waitReady(ph.page, 30000);
  const T = ph.page;
  await ctx.test('telefono: niente faccina in vista (#417)', async () => {
    assert((await ctx.getState(T)).emotes.coarse === true, 'iPhone senza pointer: coarse');
    assert(await T.$('#mzEmoteBtn') && !(await T.isVisible('#mzEmoteBtn')), 'la faccina è ancora in vista');
    ctx.noErrors(ph, 'telefono');
  });
  await ph.close(); ctx._pages.splice(ctx._pages.indexOf(ph), 1);

  // ---------------- rete: il peer vede la emote nuova ----------------
  const SERVER = path.join(ctx.ROOT, 'apps/server');
  const persist = path.join(ctx.OUT, `m3emote-${process.pid}`);
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

    const open = async (q) => { const p = await ctx.B.openPage(ctx.browser, `${base}/${q}`, { viewport: ctx.B.DESKTOP }); ctx._pages.push(p); return p; };
    const A = await open('?t=tokA&test=1'), Bp = await open('?t=tokB&test=1');
    await ctx.test('rete: Anna manda «balla» dalla ruota, Bruno vede fumetto e gesto sopra Anna', async () => {
      await Promise.all([ctx.waitReady(A.page, 60000), ctx.waitReady(Bp.page, 60000)]); // tempi larghi: col Mac carico (altri test in parallelo) la prima connessione è lenta
      const dbg = async (e) => { for (const [n, p] of [['Anna', A], ['Bruno', Bp]]) { const s = await ctx.getState(p.page); ctx.log(n, JSON.stringify(s.net), JSON.stringify(s.peersDrawn)); } throw e; };
      await ctx.waitState(A.page, (s) => s.net.status === 'on' && s.net.peers === 1, 45000).catch(dbg);
      await ctx.waitState(Bp.page, (s) => s.net.status === 'on' && s.net.peers === 1, 45000).catch(dbg);
      const a = await A.page.evaluate(() => window.__game.test.goto('porto'));
      await Bp.page.evaluate((p) => { window.__game.test.goto('porto'); window.__game.test.teleport(p.x + 2.1, p.z + 2.1); }, a);
      await ctx.waitState(Bp.page, (s, o) => { const d = (s.peersDrawn ?? []).find((x) => x.id === 'anna'); return !!d && d.walk && Math.hypot(d.x - o.x, d.z - o.z) < 0.3; }, 45000, a).catch(dbg);
      await Bp.page.bringToFront(); // Bruno davanti (per lo screenshot); Anna apre la ruota e preme 8 dalla sua scheda
      // il gesto dura 1 s e il fumetto 2,5 s: su GitHub (2-4 fps) quando il test arrivava a guardare a volte erano già finiti («Bruno non
      // vede il gesto», textContent in attesa 30 s). Si segnano nella pagina di Bruno nell'istante in cui il fumetto di Anna compare
      await Bp.page.evaluate(() => {
        const visto = { testo: null, gesti: null }; window.__balla = visto;
        const o = new MutationObserver(() => {
          const e = document.querySelector('.mz-emote[data-who="anna"][data-emote="balla"]');
          if (!e) return;
          visto.testo = e.textContent; visto.gesti = window.__game.state().emotes.gesti; o.disconnect();
        });
        o.observe(document.body, { childList: true, subtree: true });
      });
      assert(await A.page.evaluate(() => window.__game.test.emoteWheel()), 'emoteWheel() ha risposto false');
      await A.page.keyboard.press('Digit8');
      await bubble(A.page, 'me', 'balla');
      await Bp.page.waitForFunction(() => window.__balla.testo !== null, null, { timeout: process.env.CI ? 8000 : 2500 });
      const visto = await Bp.page.evaluate(() => window.__balla);
      assert(visto.testo.includes('Si balla!'), 'testo del fumetto di Anna: ' + visto.testo);
      ctx.log('gesti su Bruno ' + JSON.stringify(visto.gesti));
      assert(visto.gesti.some((g) => g.who === 'anna' && g.id === 'balla'), 'Bruno non vede il gesto di Anna');
      // screenshot indicativo: col Mac carico (0,5-1 fps, uno scatto 10-30 s) il fumetto può essere già sparito quando la foto finisce
      await ctx.shot(Bp.page, 'bruno_vede_balla_1280');
      ctx.log('fumetto di Anna ' + ((await Bp.page.$('.mz-emote[data-who="anna"]')) ? 'nella foto' : 'sparito prima della fine dello scatto'));
      ctx.noErrors(A, 'Anna'); ctx.noErrors(Bp, 'Bruno');
    });
  } finally {
    if (dev) { try { process.kill(-dev.pid, 'SIGTERM'); } catch { /* già finito */ } await sleep(500); try { process.kill(-dev.pid, 'SIGKILL'); } catch { /* ok */ } }
    fs.rmSync(persist, { recursive: true, force: true });
  }
}
