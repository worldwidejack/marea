// M2-mira (dungeon v6, #192): la magia si prende in mano come un'arma (Q / bottone C alterna arma e magia, la A la lancia, il menù rapido
// compare solo con la magia in mano) e col mouse si mira: arco e magie vanno dove punta il cursore (l'eroe si gira, linea di mira), con
// un tocco resta la mira assistita. Poi l'autopilot porta la spedizione all'uscita: il server rigioca il log col formato 2 (mira, mani) e
// l'hash coincide. Screenshot in tests/out/shots/m2_mira_*.png. Persone vere su wrangler dev locale (come m2_dungeon).
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
export const timeout = 420000;

const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** Dalla vista a 45° (CAM.YAW): la destra dello schermo è (cos, −sin) = (0,707, −0,707) in assi mondo, l'alto (−0,707, −0,707). */
const DESTRA = [Math.SQRT1_2, -Math.SQRT1_2], SINISTRA = [-Math.SQRT1_2, Math.SQRT1_2], SU = [-Math.SQRT1_2, -Math.SQRT1_2];
const gradi = (a, b) => (Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1]))) * 180) / Math.PI;

export default async function (ctx) {
  const { assert } = ctx;
  const SERVER = path.join(ctx.ROOT, 'apps/server');
  const persist = path.join(ctx.OUT, `m2mira-${process.pid}`);
  const env = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' };
  const wr = (...a) => execFileSync('npx', ['--no-install', 'wrangler', ...a], { cwd: SERVER, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 }).toString();
  let dev = null, log = '';
  try {
    fs.rmSync(persist, { recursive: true, force: true });
    wr('d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', persist);
    wr('d1', 'execute', 'DB', '--local', '--persist-to', persist, '--command', "INSERT INTO persone (id, nome, token, slot) VALUES ('ada', 'Ada', 'tokA', 0);");
    const port = await freePort(), inspector = await freePort();
    dev = spawn('npx', ['--no-install', 'wrangler', 'dev', '--local', '--ip', '127.0.0.1', '--port', String(port), '--inspector-port', String(inspector),
      '--assets', ctx.distDir, '--persist-to', persist, '--show-interactive-dev-session=false'], { cwd: SERVER, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    dev.stdout.on('data', (d) => (log += d)); dev.stderr.on('data', (d) => (log += d));
    const base = `http://127.0.0.1:${port}`;
    let up = false;
    for (let i = 0; i < 120 && !up; i++) { try { up = (await fetch(base + '/api/ping')).ok; } catch { /* non ancora */ } if (!up) await sleep(500); }
    if (!up) throw new Error('wrangler dev non risponde:\n' + log.split('\n').slice(-20).join('\n'));
    const getLot = async (t) => (await (await fetch(base + '/api/lot', { headers: { 'x-token': t } })).json());

    const P = await ctx.B.openPage(ctx.browser, `${base}/?t=tokA&test=1`, { viewport: ctx.B.DESKTOP }); ctx._pages.push(P);
    const page = P.page;
    // Windows: wrangler dev locale risponde in ~3,5 s sulle connessioni riusate (keep-alive): una connessione per richiesta, come m2_insieme
    if (process.platform === 'win32') await page.route(/\/(api|chunk|assets)/, (r) => r.continue({ headers: { ...r.request().headers(), connection: 'close' } }));
    await ctx.waitReady(page, 30000);
    await ctx.waitState(page, (s) => s.lot && s.lot.ready === true && s.ingressi, 15000);
    const st = () => ctx.getState(page);
    const hook = (n, ...a) => page.evaluate(([n, a]) => window.__game.test[n](...a), [n, a]);
    const dirOf = async () => { const h = (await st()).dungeon.hero; return [h.fx, h.fz]; };
    /** Cursore a (dx, dy) pixel dal centro dello schermo (lì sta l'eroe, la camera lo segue). */
    const cursore = async (dx, dy) => { const v = page.viewportSize(); await page.mouse.move(v.width / 2 + dx, v.height / 2 + dy, { steps: 4 }); };

    await ctx.test('Grotta: con l’arma in mano il menù rapido non c’è; Q prende la magia in mano, il menù compare, la A la lancia (e paga Magicka), Q rimette l’arma', async () => {
      await hook('enterDungeon', 'grotta');
      await ctx.waitState(page, (s) => s.dungeon.active && s.dungeon.phase === 'play', 30000);
      await sleep(1200);
      let h = (await st()).dungeon.hero;
      assert(h.magia === null, 'magia in mano già all’inizio: ' + h.magia);
      assert(!(await page.locator('#mzDngMagie.on').count()), 'menù rapido visibile con l’arma in mano');
      await ctx.shot(page, '1_arma_in_mano');
      const m0 = h.magicka;
      await page.keyboard.press('q');
      await ctx.waitState(page, (s) => s.dungeon.hero.magia === 'fiammata', 3000);
      await page.waitForSelector('#mzDngMagie.on button[data-magia="fiammata"].cur', { timeout: 3000 });
      assert(await page.locator('#btnC.mano').count(), 'il bottone C non si accende con la magia in mano');
      await hook('setZoom', 0.4); // da vicino: mani e sfera
      await sleep(900);
      await ctx.shot(page, '2_magia_in_mano');
      await page.keyboard.press('Space'); // la A lancia
      await ctx.waitState(page, (s, m) => s.dungeon.hero.magicka < m, 3000, m0);
      await hook('dungeonPosa', { anim: 'lancia', t: 0.3 });
      await sleep(150);
      await ctx.shot(page, '3_magia_lancio');
      await hook('dungeonPosa', null);
      await hook('setZoom', 1);
      await sleep(700);
      await page.keyboard.press('q');
      await ctx.waitState(page, (s) => s.dungeon.hero.magia === null, 3000);
      assert(!(await page.locator('#mzDngMagie.on').count()), 'menù rapido ancora visibile con l’arma in mano');
      assert((await st()).dungeon.equip.mano === undefined, 'equip.mano resta dopo il ritorno all’arma');
    });

    await ctx.test('Mira col mouse (arco): tenendo il tasto sinistro l’eroe guarda il cursore, anche camminando; al rilascio parte la freccia e scende il numero di frecce', async () => {
      assert(await hook('dungeonAct', { t: 'equip', slot: 'arma', item: 'arco_legno' }) === null, 'equip dell’arco rifiutato');
      await ctx.waitState(page, (s) => s.dungeon.hero.arma === 'arco_legno', 3000);
      await sleep(400);
      const f0 = (await st()).dungeon.hero.frecce;
      assert((await st()).dungeon.mouse === false, 'mouse attivo senza averlo mosso');
      await cursore(320, 0); // a destra
      await ctx.waitState(page, (s) => s.dungeon.mouse === true, 2000);
      await page.mouse.down();
      await sleep(800);
      assert((await st()).dungeon.hero.anim === 'tende', 'l’arco non si tende');
      let d = await dirOf();
      assert(gradi(d, DESTRA) < 20, `tendendo verso destra guarda ${d.map((v) => v.toFixed(2))}`);
      await hook('setZoom', 0.5);
      await sleep(400);
      await ctx.shot(page, '4_arco_mira_destra');
      await hook('setZoom', 1);
      await cursore(-320, 0); // il cursore passa a sinistra tenendo il tasto: l'eroe lo segue
      await sleep(400);
      d = await dirOf();
      assert(gradi(d, SINISTRA) < 20, `tendendo verso sinistra guarda ${d.map((v) => v.toFixed(2))}`);
      await cursore(0, -200); // in alto sullo schermo
      await page.keyboard.down('KeyD'); // e cammina di lato: la faccia resta sul cursore
      await sleep(400);
      d = await dirOf();
      await page.keyboard.up('KeyD');
      assert(gradi(d, SU) < 25, `camminando in verso opposto guarda ${d.map((v) => v.toFixed(2))}`);
      await page.mouse.up();
      await ctx.waitState(page, (s, f) => s.dungeon.hero.frecce === f - 1, 3000, f0);
      d = await dirOf();
      assert(gradi(d, SU) < 25, 'al rilascio la freccia non va verso il cursore');
    });

    await ctx.test('Mira col mouse (magia): con la magia in mano la linea di mira segue il cursore anche senza premere; il lancio guarda il cursore', async () => {
      assert(await hook('dungeonAct', { t: 'equip', slot: 'magia', item: 'fiammata' }) === null, 'magia in mano rifiutata');
      await ctx.waitState(page, (s) => s.dungeon.hero.magia === 'fiammata', 3000);
      await sleep(900);
      await cursore(250, 120); // in basso a destra
      await sleep(300);
      await ctx.shot(page, '5_magia_mira_linea');
      const m0 = (await st()).dungeon.hero.magicka;
      await page.mouse.down(); await sleep(80); await page.mouse.up();
      await ctx.waitState(page, (s, m) => s.dungeon.hero.magicka < m, 3000, m0);
      const d = await dirOf();
      // in basso a destra sullo schermo = verso est (+x) in assi mondo, un po' deviato dalla prospettiva
      assert(gradi(d, [1, 0]) < 35, `il lancio non guarda in basso a destra: ${d.map((v) => v.toFixed(2))}`);
      await sleep(1500);
      // un tocco (pointer touch) spegne la mira col mouse: torna l'assistita
      await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', clientX: 5, clientY: 5, bubbles: true })));
      await ctx.waitState(page, (s) => s.dungeon.mouse === false, 2000);
      await page.mouse.move(400, 300); // il mouse che si rimuove riaccende
      await ctx.waitState(page, (s) => s.dungeon.mouse === true, 2000);
    });

    await ctx.test('il server rigioca la spedizione col log con la mira (formato 2): hash del server = hash del client', async () => {
      await page.keyboard.press('q'); // arma in mano
      await hook('dungeonAct', { t: 'equip', slot: 'arma', item: 'katana_legno' });
      await hook('dungeonAutopilot', true, 12);
      await ctx.waitState(page, (s) => s.dungeonEsito && s.dungeonEsito.open, 200000);
      const s = await st(), r = s.ingressi.lastResult;
      ctx.log(`esito ${r.outcome} · hash server ${r.hash} client ${r.clientHash}`);
      assert(s.ingressi.finishes === 1, 'finish non chiamato');
      assert(r.hash === r.clientHash, `hash del server ${r.hash} ≠ client ${r.clientHash}: il replay non coincide`);
      const lot = await getLot('tokA');
      assert(!lot.dungeon?.pending, 'spedizione ancora aperta dopo finish');
    });
    await ctx.test('nessun errore', async () => { ctx.noErrors(P, 'Ada'); });
  } finally {
    if (dev) { try { process.kill(-dev.pid, 'SIGTERM'); } catch { /* già finito */ } await sleep(500); try { process.kill(-dev.pid, 'SIGKILL'); } catch { /* ok */ } }
    try { fs.rmSync(persist, { recursive: true, force: true }); } catch { /* wrangler tiene ancora i file */ }
  }
}
