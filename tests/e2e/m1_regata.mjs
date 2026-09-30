// M1 · Fetta 2, Regata (F2-test): Anna al Porto col server locale. E al Tavolo apre il pannello; una gara intera con l'autopilot della sim
// (hook startRegataAuto) dà lo stesso risultato a schermo e nel replay locale; boe disegnate sulla laguna; budget draw call/triangoli
// in gara; Esc annulla e riporta a piedi; blur azzera gli input; nessun pageerror. Server: wrangler dev --local (login con ?t=).
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
export const timeout = 90000;

const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BUDGET = { drawCalls: 100, triangles: 150000 };

export default async function (ctx) {
  const { assert } = ctx;
  const SERVER = path.join(ctx.ROOT, 'apps/server');
  const persist = path.join(ctx.OUT, `m1regata-${process.pid}`);
  const env = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' };
  const wr = (...a) => execFileSync('npx', ['--no-install', 'wrangler', ...a], { cwd: SERVER, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 }).toString();
  let dev = null, log = '', p = null;
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

    p = await ctx.B.openPage(ctx.browser, `${base}/?t=tokA&test=1&sfide=1`, { viewport: ctx.B.DESKTOP });
    ctx._pages.push(p);
    const page = p.page;
    const hook = (fn, ...args) => page.evaluate(([f, a]) => window.__game.test[f](...a), [fn, args]);
    const st = () => ctx.getState(page);
    const shotsOf = async (label) => ctx.shot(page, label);

    await ctx.waitReady(page, 30000);
    await ctx.waitState(page, (s) => s.tavolo && s.tavolo.exists === true, 15000);

    await ctx.test('Anna al Porto: E vicino al Tavolo apre il pannello, Esc lo chiude', async () => {
      await hook('goto', 'porto');
      const at = (await st()).tavolo.at;
      assert(at && Number.isFinite(at.x), 'il Porto non ha un Tavolo: ' + JSON.stringify(at));
      await hook('setZoom', 0.9);
      await hook('teleport', at.x, at.z + 2.5);
      await ctx.waitState(page, (s) => s.tavolo.near === true, 5000);
      assert(!(await st()).tavolo.open, 'pannello già aperto prima di E');
      await page.keyboard.press('KeyE');
      await ctx.waitState(page, (s) => s.tavolo.open === true, 5000);
      const title = await page.evaluate(() => document.querySelector('#mzTavolo.on')?.innerText ?? '');
      ctx.log('pannello: ' + title.replace(/\n/g, ' · ').slice(0, 120));
      assert(/Tavolo delle Sfide/i.test(title), 'pannello senza titolo: ' + title);
      await page.waitForTimeout(400);
      await shotsOf('tavolo_aperto_con_E');
      await page.keyboard.press('Escape');
      await ctx.waitState(page, (s) => s.tavolo.open === false, 5000);
    });

    let liveRes = null;
    await ctx.test('gara con l\'autopilot: boe disegnate sulla laguna, budget in gara, live = replay locale', async () => {
      await hook('startRegataAuto', 1, 2, 20);
      await ctx.waitState(page, (s) => s.regata.active === true, 5000);
      const r0 = (await st()).regata;
      assert(r0.total >= 3 && r0.buoys.length === r0.total, `boe ${r0.buoys.length}/${r0.total}`);
      const lag = (await st()).arch.places?.find?.((x) => x.role === 'laguna');
      assert(r0.off && r0.off.x > 100 && r0.off.z > 100, 'offset della laguna assente: ' + JSON.stringify(r0.off));
      if (lag) ctx.log('laguna: ' + JSON.stringify(lag).slice(0, 120));
      // conto alla rovescia: la barca è ferma alla partenza, le boe sono già in acqua → prova visiva (pixel arancio/rosso della boa)
      await page.waitForTimeout(500);
      await shotsOf('partenza_conto_alla_rovescia');
      const px = await ctx.B.samplePixels(page, 60000, { hideUi: true });
      const near = (r, g, b, c) => Math.hypot(r - c[0], g - c[1], b - c[2]) < 40;
      let hot = 0;
      for (let i = 0; i < px.length; i += 3) if (near(px[i], px[i + 1], px[i + 2], [0xF2, 0xA3, 0x3A]) || near(px[i], px[i + 1], px[i + 2], [0xE8, 0x43, 0x3F])) hot++;
      ctx.log(`pixel arancio/rosso (boe) nella vista di partenza: ${hot} su 60000`);
      assert(hot > 5, `boe non visibili nella vista di partenza (${hot} pixel arancio/rosso)`);
      await ctx.waitState(page, (s) => s.regata.phase === 'race', 15000);
      await page.waitForTimeout(500);
      const s1 = (await st()).regata;
      assert(s1.buoysDrawn > 0, 'nessuna boa disegnata (buoysDrawn=0)');
      // le boe stanno sull'isola della laguna: coordinate mondo vicino all'origine (340, 226) m, dentro una finestra generosa
      for (const b of s1.buoys) assert(Math.abs(b.x - r0.off.x) < 250 && Math.abs(b.z - r0.off.z) < 250, `boa fuori dalla laguna: ${JSON.stringify(b)}`);
      const bx = s1.boat;
      assert(Math.hypot(bx.x - r0.off.x, bx.z - r0.off.z) < 250, 'barca fuori dalla laguna: ' + JSON.stringify([bx.x, bx.z]));
      await shotsOf('gara_boe_sulla_laguna');
      // budget: qualche campione mentre si corre
      const perfs = [];
      for (let i = 0; i < 4; i++) { perfs.push(await ctx.getPerf(page)); await page.waitForTimeout(400); }
      const worst = { drawCalls: Math.max(...perfs.map((x) => x.drawCalls)), triangles: Math.max(...perfs.map((x) => x.triangles)) };
      ctx.log('in gara: ' + JSON.stringify(worst) + ' fps ' + perfs.map((x) => x.fps.toFixed(0)).join('/'));
      assert(worst.drawCalls > 0 && worst.drawCalls <= BUDGET.drawCalls, `draw call ${worst.drawCalls} > ${BUDGET.drawCalls}`);
      assert(worst.triangles <= BUDGET.triangles, `triangoli ${worst.triangles} > ${BUDGET.triangles}`);
      // fine gara + esito a schermo, poi ritorno (l'esito dura ~3 s: A dopo un attimo lo salta)
      await ctx.waitState(page, (s) => s.regata.phase === 'end' || (s.regata.last && !s.regata.active), 60000);
      if ((await st()).regata.active) { await page.waitForTimeout(600); await shotsOf('gara_esito'); }
      await ctx.waitState(page, (s) => s.regata.last && s.regata.active === false, 20000);
      const last = (await st()).regata.last;
      liveRes = last;
      ctx.log(`gara: ${last.ticks} tick, ${last.rows} righe, live ${JSON.stringify(last.live)} replay ${JSON.stringify(last.replay)}`);
      assert(!last.cancelled && last.rows > 0 && last.ticks > 60, 'gara non completata: ' + JSON.stringify({ ...last, live: 0, replay: 0 }));
      assert(last.live && last.replay, 'live o replay mancanti');
      assert(JSON.stringify(last.live) === JSON.stringify(last.replay), `live ≠ replay: ${JSON.stringify(last.live)} vs ${JSON.stringify(last.replay)}`);
      assert(last.live.score > 0, 'punteggio zero con l\'autopilot: ' + JSON.stringify(last.live));
    });

    await ctx.test('a fine gara si torna a piedi, avatar al suo posto', async () => {
      const s = await st();
      assert(s.mode === 'walk', 'modalità dopo la gara: ' + s.mode);
      assert(s.regata.active === false && s.regata.phase === null, 'regata ancora attiva');
    });

    await ctx.test('Esc annulla la gara e riporta a piedi', async () => {
      await hook('startRegata', 7, 2);
      await ctx.waitState(page, (s) => s.regata.active === true && s.regata.phase !== null, 5000);
      await page.waitForTimeout(300);
      assert((await st()).mode === 'boat' || (await st()).regata.active, 'gara non partita');
      await shotsOf('gara_a_mano_prima_di_Esc');
      await page.keyboard.press('Escape');
      await ctx.waitState(page, (s) => s.regata.active === false, 5000);
      const s = await st();
      assert(s.regata.last?.cancelled === true, 'last.cancelled non vero: ' + JSON.stringify(s.regata.last));
      assert(s.mode === 'walk', 'dopo Esc non si è a piedi: ' + s.mode);
      assert(s.tavolo.open === false, 'Esc ha aperto/lasciato aperto il Tavolo');
      await page.waitForTimeout(300);
      await shotsOf('dopo_Esc_a_piedi');
    });

    await ctx.test('blur (e scheda nascosta) azzerano gli input in gara', async () => {
      await hook('startRegata', 3, 2);
      await ctx.waitState(page, (s) => s.regata.phase === 'race', 15000);
      await page.keyboard.down('ArrowRight');
      await page.keyboard.down('ArrowUp');
      await page.waitForTimeout(400);
      const held = (await st()).wp2_input;
      ctx.log('input premuti: ' + JSON.stringify(held));
      assert(Math.hypot(held.sx ?? 0, held.sy ?? 0) > 0.1, 'input a tasti premuti non letto: ' + JSON.stringify(held));
      await page.evaluate(() => window.dispatchEvent(new Event('blur')));
      await page.waitForTimeout(300);
      const after = (await st()).wp2_input;
      assert(Math.hypot(after.sx ?? 0, after.sy ?? 0) < 1e-6 && !after.a && !after.b, 'dopo blur gli input non sono a zero: ' + JSON.stringify(after));
      // scheda nascosta: stesso effetto
      await page.keyboard.down('ArrowLeft');
      await page.waitForTimeout(300);
      assert(Math.hypot((await st()).wp2_input.sx ?? 0, (await st()).wp2_input.sy ?? 0) > 0.1, 'tasto sinistra non letto');
      await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
      await page.waitForTimeout(300);
      const hid = (await st()).wp2_input;
      assert(Math.hypot(hid.sx ?? 0, hid.sy ?? 0) < 1e-6, 'visibilitychange non azzera gli input: ' + JSON.stringify(hid));
      await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); });
      for (const k of ['ArrowRight', 'ArrowUp', 'ArrowLeft']) await page.keyboard.up(k);
      await hook('regataCancel');
      await ctx.waitState(page, (s) => s.regata.active === false, 5000);
    });

    await ctx.test('nessun pageerror né errore in console', async () => {
      ctx.noErrors(p, 'Anna');
      assert(liveRes, 'gara completa non eseguita');
    });
  } finally {
    if (p) await p.close().catch(() => {});
    if (dev) { try { process.kill(-dev.pid, 'SIGTERM'); } catch { /* già finito */ } await sleep(500); try { process.kill(-dev.pid, 'SIGKILL'); } catch { /* ok */ } }
    fs.rmSync(persist, { recursive: true, force: true });
  }
}
