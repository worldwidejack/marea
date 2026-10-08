// Dungeon insieme (#118): due persone vere (Ada al PC, Bea al telefono) su wrangler dev locale. All'ingresso della Grotta, con l'altra
// vicino, compare AFFRONTA INSIEME; tutte e due entrano nella squadra, SCENDIAMO, e scendono nella stessa partita: i turni arrivano, ognuna
// vede l'altra, i nemici hanno più vita (+60%), le firme dello stato ogni 5 s sono uguali per tutte e due (stessa partita). Ada esce dal
// menu: per Bea se n'è andata, il server chiude la spedizione di Ada dal log della squadra; poi esce anche Bea. Nei lotti nessuna
// spedizione aperta e una discesa in più. Screenshot in tests/out/shots/m2_insieme_*.png.
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
export const timeout = 300000;

const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function (ctx) {
  const { assert } = ctx;
  const SERVER = path.join(ctx.ROOT, 'apps/server');
  const persist = path.join(ctx.OUT, `m2insieme-${process.pid}`);
  const env = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' };
  const wr = (...a) => execFileSync('npx', ['--no-install', 'wrangler', ...a], { cwd: SERVER, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 }).toString();
  let dev = null, log = '';
  try {
    fs.rmSync(persist, { recursive: true, force: true });
    wr('d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', persist);
    wr('d1', 'execute', 'DB', '--local', '--persist-to', persist, '--command', "INSERT INTO persone (id, nome, token, slot) VALUES ('ada', 'Ada', 'tokA', 0), ('bea', 'Bea', 'tokB', 1);");
    const port = await freePort(), inspector = await freePort();
    // nome a parte: un `npm run dev:server` acceso sullo stesso computer (stesso worker «marea») non si mescola con quello del test
    dev = spawn('npx', ['--no-install', 'wrangler', 'dev', '--name', 'marea-test-insieme', '--local', '--ip', '127.0.0.1', '--port', String(port), '--inspector-port', String(inspector),
      '--assets', ctx.distDir, '--persist-to', persist, '--show-interactive-dev-session=false'], { cwd: SERVER, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    dev.stdout.on('data', (d) => (log += d)); dev.stderr.on('data', (d) => (log += d));
    const base = `http://127.0.0.1:${port}`;
    let up = false;
    for (let i = 0; i < 120 && !up; i++) { try { up = (await fetch(base + '/api/ping')).ok; } catch { /* non ancora */ } if (!up) await sleep(500); }
    if (!up) throw new Error('wrangler dev non risponde:\n' + log.split('\n').slice(-20).join('\n'));
    const getLot = async (t) => (await (await fetch(base + '/api/lot', { headers: { 'x-token': t } })).json());

    // due pagine che disegnano insieme col renderer software: qualità bassa e telefono a densità 1, se no la CPU non basta anche al server
    const PA = await ctx.B.openPage(ctx.browser, `${base}/?t=tokA&test=1&quality=low`, { viewport: ctx.B.DESKTOP }); ctx._pages.push(PA);
    const PB = await ctx.B.openPage(ctx.browser, `${base}/?t=tokB&test=1&quality=low`, { viewport: { ...ctx.B.IPHONE, deviceScaleFactor: 1 } }); ctx._pages.push(PB);
    const A = PA.page, B = PB.page;
    // Windows: wrangler dev locale risponde in ~3,5 s alle richieste su una connessione riusata (keep-alive), in 20 ms su una nuova
    if (process.platform === 'win32') for (const p of [A, B]) await p.route(/\/(api|chunk|assets)/, (r) => r.continue({ headers: { ...r.request().headers(), connection: 'close' } }));
    for (const p of [A, B]) { await ctx.waitReady(p, 30000); await ctx.waitState(p, (s) => s.lot && s.lot.ready === true && s.ingressi, 15000); }
    const st = (p) => ctx.getState(p);
    const hook = (p, n, ...a) => p.evaluate(([n, a]) => window.__game.test[n](...a), [n, a]);
    const g = (await st(A)).ingressi.spots.find((x) => x.id === 'grotta');

    await ctx.test('all’ingresso con un’altra persona vicino compare AFFRONTA INSIEME', async () => {
      await hook(A, 'teleport', g.x, g.z + 3); await hook(B, 'teleport', g.x + 1.2, g.z + 3);
      await ctx.waitState(A, (s) => s.ingressi.near === 'grotta' && s.ingressi.vicini >= 1, 20000);
      await ctx.waitState(B, (s) => s.ingressi.near === 'grotta' && s.ingressi.vicini >= 1, 20000);
      await A.waitForSelector('#mzDngInsieme.on', { timeout: 5000 });
      await A.waitForSelector('#mzDngEntra.on', { timeout: 5000 });
    });
    await ctx.shot(A, '1_ingresso_1280');

    await ctx.test('squadra: tutte e due premono AFFRONTA INSIEME, poi SCENDIAMO', async () => {
      await A.locator('#mzDngInsieme').click();
      await ctx.waitState(A, (s) => s.ingressi.squadra && s.ingressi.squadra.membri.length === 1, 10000);
      assert(await A.locator('#mzDngSquadra [data-act="via"]').isDisabled(), 'da sola non si scende');
      await B.locator('#mzDngInsieme').click();
      for (const p of [A, B]) await ctx.waitState(p, (s) => s.ingressi.squadra && s.ingressi.squadra.membri.length === 2, 10000);
      await ctx.shot(A, '2_squadra_1280'); await ctx.shot(B, '2_squadra_390');
      await A.locator('#mzDngSquadra [data-act="via"]').click();
      for (const [p, P, nome] of [[A, PA, 'Ada'], [B, PB, 'Bea']]) {
        try { await ctx.waitState(p, (s) => s.dungeon && s.dungeon.active && s.dungeon.phase === 'play' && s.dungeon.insieme && s.dungeon.insieme.eroi === 2, 60000); } catch (e) {
          const s = await st(p).catch(() => null);
          throw new Error(`${nome} non è giù: ${e.message}\n  ingressi ${JSON.stringify(s?.ingressi ?? null).slice(0, 400)}\n  dungeon ${JSON.stringify(s?.dungeon ?? null).slice(0, 300)}\n  console ${JSON.stringify((P.logs ?? []).slice(-8))}`);
        }
      }
    });

    await ctx.test('giù insieme: i turni arrivano, ognuna vede l’altra, nemici con +60% di vita', async () => {
      for (const p of [A, B]) await ctx.waitState(p, (s) => s.dungeon.tick > 120, 30000);
      for (const p of [A, B]) {
        const d = (await st(p)).dungeon;
        assert(d.insieme.compagni.length === 1 && d.insieme.compagni[0].visibile && d.insieme.compagni[0].vita > 0, 'compagno: ' + JSON.stringify(d.insieme.compagni));
        assert(Math.abs(d.insieme.vitaNemici - 1.6) < 1e-6, 'vita dei nemici × ' + d.insieme.vitaNemici);
      }
      // Ada si muove (pilota automatico): Bea la vede spostarsi
      const da = (await st(B)).dungeon.insieme.compagni[0];
      await hook(A, 'dungeonAutopilot', true, 1);
      await ctx.waitState(B, (s, p) => { const c = s.dungeon.insieme.compagni[0]; return Math.hypot(c.x - p.x, c.z - p.z) > 2; }, 40000, da);
      await ctx.shot(A, '3_insieme_1280'); await ctx.shot(B, '3_insieme_390');
    });

    await ctx.test('stessa partita per tutte e due: le firme dello stato coincidono', async () => {
      for (const p of [A, B]) await ctx.waitState(p, (s) => s.dungeon.insieme.firme['600'] !== undefined, 60000);
      const fa = (await st(A)).dungeon.insieme.firme, fb = (await st(B)).dungeon.insieme.firme;
      const comuni = Object.keys(fa).filter((k) => k in fb);
      assert(comuni.length >= 2, 'firme in comune: ' + comuni.join(','));
      for (const k of comuni) assert(fa[k] === fb[k], `tick ${k}: Ada ${fa[k]} ≠ Bea ${fb[k]}`);
    });

    await ctx.test('Ada esce dal menu (la partita non si ferma): per Bea se n’è andata, il server chiude la spedizione di Ada', async () => {
      await hook(A, 'dungeonAutopilot', false);
      await A.keyboard.press('Escape');
      await A.waitForSelector('#mzDngPausa.on', { timeout: 3000 });
      const t0 = (await st(A)).dungeon.tick; await sleep(600);
      assert((await st(A)).dungeon.tick > t0, 'insieme il menu non deve fermare la partita');
      await A.locator('#mzDngPausa [data-act="esci-menu"]').click();
      await A.waitForSelector('#mzDngAsk.on', { timeout: 3000 });
      await A.locator('#mzDngAsk [data-act="esci"]').click();
      await ctx.waitState(A, (s) => s.ingressi.finishes === 1 || !!s.ingressi.lastErr, 30000);
      const ia = (await st(A)).ingressi;
      assert(ia.finishes === 1 && !ia.lastErr, 'Ada: ' + JSON.stringify({ err: ia.lastErr, r: ia.lastResult }));
      assert(ia.lastResult.outcome === null, 'uscita a metà = senza esito: ' + JSON.stringify(ia.lastResult));
      await ctx.waitState(B, (s) => s.dungeon.insieme && s.dungeon.insieme.compagni[0].done, 20000);
    });

    await ctx.test('esce anche Bea: nessuna spedizione aperta, una discesa in più per tutte e due', async () => {
      await B.evaluate(() => document.getElementById('mzDngPausaBtn').click());
      await B.waitForSelector('#mzDngPausa.on', { timeout: 3000 });
      await B.locator('#mzDngPausa [data-act="esci-menu"]').click();
      await B.locator('#mzDngAsk [data-act="esci"]').click();
      await ctx.waitState(B, (s) => s.ingressi.finishes === 1 || !!s.ingressi.lastErr, 30000);
      const ib = (await st(B)).ingressi;
      assert(ib.finishes === 1 && !ib.lastErr, 'Bea: ' + JSON.stringify({ err: ib.lastErr, r: ib.lastResult }));
      for (const t of ['tokA', 'tokB']) {
        const l = await getLot(t);
        assert(!l.dungeon || !l.dungeon.pending, `${t}: spedizione ancora aperta`);
        assert(l.hero && l.hero.discese === 1, `${t}: discese ${l.hero?.discese}`);
      }
    });
    await ctx.shot(B, '4_esito_390');
    await ctx.test('nessun errore', async () => { ctx.noErrors(PA, 'Ada'); ctx.noErrors(PB, 'Bea'); });
  } finally {
    if (dev) { try { process.kill(-dev.pid, 'SIGTERM'); } catch { /* già finito */ } await sleep(500); try { process.kill(-dev.pid, 'SIGKILL'); } catch { /* ok */ } }
    if (process.env['M2_LOG']) console.log('    [m2_insieme] server:\n' + log.split('\n').slice(-80).join('\n'));
    else if (/squadra|insieme/.test(log)) console.log('    [m2_insieme] server:\n' + log.split('\n').filter((l) => /squadra|insieme|log della/.test(l)).slice(-10).join('\n'));
    fs.rmSync(persist, { recursive: true, force: true });
  }
}
