// Templari insieme (PROTOCOL.md §9): due persone vere (Ada al PC, Bea al telefono) su wrangler dev locale. Alla porta della chiesa compare
// GIOCA INSIEME; tutte e due entrano nella sala, SI PARTE, ed entrano nella stessa partita a ondate: i turni arrivano, ognuna vede l'altra
// (avatar, nome e vita sopra la testa), le firme dello stato ogni 5 s sono uguali per tutte e due (stessa partita). Il menu non ferma la
// partita. Ada esce dal menu: per Bea è uscita, il server chiude la partita di Ada dal log della squadra; poi esce anche Bea. Nei lotti
// nessuna partita aperta e una partita in più. Screenshot in tests/out/shots/m4_templari_insieme_*.png.
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
  const persist = path.join(ctx.OUT, `m4tplinsieme-${process.pid}`);
  const WRANGLER = path.join(ctx.ROOT, 'node_modules/wrangler/bin/wrangler.js'); // lanciato con node: va anche su Windows
  const env = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' };
  const wr = (...a) => execFileSync(process.execPath, [WRANGLER, ...a], { cwd: SERVER, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 90000 }).toString();
  let dev = null, log = '';
  try {
    fs.rmSync(persist, { recursive: true, force: true });
    wr('d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', persist);
    wr('d1', 'execute', 'DB', '--local', '--persist-to', persist, '--command', "INSERT INTO persone (id, nome, token, slot) VALUES ('ada', 'Ada', 'tokA', 0), ('bea', 'Bea', 'tokB', 1);");
    const port = await freePort(), inspector = await freePort();
    dev = spawn(process.execPath, [WRANGLER, 'dev', '--local', '--ip', '127.0.0.1', '--port', String(port), '--inspector-port', String(inspector),
      '--assets', ctx.distDir, '--persist-to', persist, '--show-interactive-dev-session=false'], { cwd: SERVER, env, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
    dev.stdout.on('data', (d) => (log += d)); dev.stderr.on('data', (d) => (log += d));
    const base = `http://127.0.0.1:${port}`;
    let up = false;
    for (let i = 0; i < 160 && !up; i++) { try { up = (await fetch(base + '/api/ping')).ok; } catch { /* non ancora */ } if (!up) await sleep(500); }
    if (!up) throw new Error('wrangler dev non risponde:\n' + log.split('\n').slice(-20).join('\n'));
    const getLot = async (t) => (await (await fetch(base + '/api/lot', { headers: { 'x-token': t } })).json());

    // due pagine che disegnano insieme col renderer software: qualità bassa e telefono a densità 1, se no la CPU non basta anche al server
    const PA = await ctx.B.openPage(ctx.browser, `${base}/?t=tokA&test=1&quality=low`, { viewport: ctx.B.DESKTOP }); ctx._pages.push(PA);
    const PB = await ctx.B.openPage(ctx.browser, `${base}/?t=tokB&test=1&quality=low`, { viewport: { ...ctx.B.IPHONE, deviceScaleFactor: 1 } }); ctx._pages.push(PB);
    const A = PA.page, B = PB.page;
    // Windows: wrangler dev locale risponde in ~3,5 s alle richieste su una connessione riusata (keep-alive), in 20 ms su una nuova
    if (process.platform === 'win32') for (const p of [A, B]) await p.route(/\/(api|chunk|assets)/, (r) => r.continue({ headers: { ...r.request().headers(), connection: 'close' } }));
    for (const p of [A, B]) { await ctx.waitReady(p, 30000); await ctx.waitState(p, (s) => s.lot && s.lot.ready === true && s.templari, 15000); }
    const st = (p) => ctx.getState(p);
    const hook = (p, n, ...a) => p.evaluate(([n, a]) => window.__game.test[n](...a), [n, a]);
    const partite0 = { tokA: (await getLot('tokA')).templari?.partite ?? 0, tokB: (await getLot('tokB')).templari?.partite ?? 0 };

    await ctx.test('alla porta della chiesa compare GIOCA INSIEME accanto a ENTRA', async () => {
      await hook(A, 'templariPorta'); await hook(B, 'templariPorta');
      await ctx.waitState(A, (s) => s.templari.near === true, 20000);
      await ctx.waitState(B, (s) => s.templari.near === true, 20000);
      await A.waitForSelector('#mzTemplariInsieme.on', { timeout: 5000 });
      await A.waitForSelector('#mzTemplariEntra.on', { timeout: 5000 });
    });
    await ctx.shot(A, '1_porta_1280');

    await ctx.test('sala: tutte e due premono GIOCA INSIEME (da sole non si parte), poi SI PARTE', async () => {
      await A.locator('#mzTemplariInsieme').click();
      await ctx.waitState(A, (s) => s.templari.sala && s.templari.sala.membri.length === 1, 10000);
      assert(await A.locator('#mzTemplariSala [data-act="via"]').isDisabled(), 'da sola non si parte');
      await B.locator('#mzTemplariInsieme').click();
      for (const p of [A, B]) await ctx.waitState(p, (s) => s.templari.sala && s.templari.sala.membri.length === 2, 10000);
      await ctx.shot(A, '2_sala_1280'); await ctx.shot(B, '2_sala_390');
      await A.locator('#mzTemplariSala [data-act="via"]').click();
      for (const [p, P, nome] of [[A, PA, 'Ada'], [B, PB, 'Bea']]) {
        try { await ctx.waitState(p, (s) => s.templari.active && s.templari.fase === 'gioca' && s.templari.insieme && s.templari.insieme.eroi === 2, 60000); } catch (e) {
          const s = await st(p).catch(() => null);
          throw new Error(`${nome} non è dentro: ${e.message}\n  templari ${JSON.stringify(s?.templari ?? null).slice(0, 500)}\n  console ${JSON.stringify((P.logs ?? []).slice(-8))}`);
        }
      }
    });

    await ctx.test('dentro insieme: i turni arrivano, ognuna vede l’altra', async () => {
      for (const p of [A, B]) await ctx.waitState(p, (s) => s.templari.tick > 120, 30000);
      for (const p of [A, B]) {
        const t = (await st(p)).templari;
        assert(t.insieme.compagni.length === 1 && t.insieme.compagni[0].visibile && t.insieme.compagni[0].vita > 0, 'compagno: ' + JSON.stringify(t.insieme.compagni));
      }
      // Ada si muove (pilota automatico): Bea la vede spostarsi
      const da = (await st(B)).templari.insieme.compagni[0];
      await hook(A, 'templariAutopilot', true, 1);
      await ctx.waitState(B, (s, p) => { const c = s.templari.insieme.compagni[0]; return Math.hypot(c.x - p.x, c.z - p.z) > 1.5; }, 40000, da);
      assert(await B.locator('#mzTpl .amico').first().isVisible(), 'nome e vita sopra la testa di Ada');
      await ctx.shot(A, '3_insieme_1280'); await ctx.shot(B, '3_insieme_390');
    });

    await ctx.test('stessa partita per tutte e due: le firme dello stato coincidono', async () => {
      for (const p of [A, B]) await ctx.waitState(p, (s) => s.templari.insieme.firme['600'] !== undefined, 60000);
      const fa = (await st(A)).templari.insieme.firme, fb = (await st(B)).templari.insieme.firme;
      const comuni = Object.keys(fa).filter((k) => k in fb);
      assert(comuni.length >= 2, 'firme in comune: ' + comuni.join(','));
      for (const k of comuni) assert(fa[k] === fb[k], `tick ${k}: Ada ${fa[k]} ≠ Bea ${fb[k]}`);
    });

    await ctx.test('Ada esce dal menu (la partita non si ferma): per Bea è uscita, il server chiude la partita di Ada', async () => {
      await hook(A, 'templariAutopilot', false);
      await A.keyboard.press('Escape');
      await A.waitForSelector('#mzTplPausa.on', { timeout: 3000 });
      const t0 = (await st(A)).templari.tick; await sleep(600);
      assert((await st(A)).templari.tick > t0, 'insieme il menu non deve fermare la partita');
      await A.locator('#mzTplPausa [data-act="esci"]').click();
      await A.locator('#mzTplPausa [data-act="esci"]').click();
      await ctx.waitState(A, (s) => s.templari.finite === 1 || !!s.templari.lastErr, 30000);
      const ta = (await st(A)).templari;
      assert(ta.finite === 1 && !ta.lastErr && ta.lastResult.insieme, 'Ada: ' + JSON.stringify({ err: ta.lastErr, r: ta.lastResult }));
      await ctx.waitState(B, (s) => s.templari.insieme && s.templari.insieme.compagni[0].fuori, 20000);
    });
    await ctx.shot(A, '4_esito_1280');

    await ctx.test('esce anche Bea: nessuna partita aperta, una partita in più per tutte e due', async () => {
      await B.evaluate(() => document.getElementById('mzTplPausaBtn').click());
      await B.waitForSelector('#mzTplPausa.on', { timeout: 3000 });
      await B.locator('#mzTplPausa [data-act="esci"]').click();
      await B.locator('#mzTplPausa [data-act="esci"]').click();
      await ctx.waitState(B, (s) => s.templari.finite === 1 || !!s.templari.lastErr, 30000);
      const tb = (await st(B)).templari;
      assert(tb.finite === 1 && !tb.lastErr, 'Bea: ' + JSON.stringify({ err: tb.lastErr, r: tb.lastResult }));
      for (const t of ['tokA', 'tokB']) {
        const l = await getLot(t);
        assert(!l.templari?.pending, `${t}: partita ancora aperta`);
        assert(l.templari.partite === partite0[t] + 1, `${t}: partite ${l.templari.partite}`);
      }
    });
    await ctx.shot(B, '5_esito_390');
    await ctx.test('nessun errore', async () => { ctx.noErrors(PA, 'Ada'); ctx.noErrors(PB, 'Bea'); });
  } finally {
    if (dev && process.platform === 'win32') { try { execFileSync('taskkill', ['/pid', String(dev.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* già finito */ } }
    else if (dev) { try { process.kill(-dev.pid, 'SIGTERM'); } catch { /* già finito */ } await sleep(500); try { process.kill(-dev.pid, 'SIGKILL'); } catch { /* ok */ } }
    if (process.env['M4_LOG']) console.log('    [m4_templari_insieme] server:\n' + log.split('\n').slice(-80).join('\n'));
    else if (/templari insieme|log dei Templari/.test(log)) console.log('    [m4_templari_insieme] server:\n' + log.split('\n').filter((l) => /templari insieme|log dei Templari/.test(l)).slice(-10).join('\n'));
    try { fs.rmSync(persist, { recursive: true, force: true }); } catch { /* file ancora aperti su Windows */ }
  }
}
