// Link «gara tra amici» (#204, CONTRACTS §39): tre telefoni in orizzontale aprono il loro link personale con `&gara=amici` e si trovano
// direttamente nella sala delle Corse (senza camminare fino all'isola né passare dalla porta). Ugo sceglie la pista nella sala (Lungomare)
// e preme VIA coi bot: partono tutti e tre sul Lungomare, ognuno vede gli altri due come fantasmi. Poi Esc: ritirati e di nuovo nell'hub.
// Screenshot in tests/out/shots/m4_corse_link_*.png.
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
export const timeout = 420000;
const LAND = { width: 844, height: 390, deviceScaleFactor: 1, isMobile: true, hasTouch: true };
const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function (ctx) {
  const { assert } = ctx;
  const SERVER = path.join(ctx.ROOT, 'apps/server');
  const persist = path.join(ctx.OUT, `m4corselink-${process.pid}`);
  const env = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' };
  const wr = (...a) => execFileSync('npx', ['--no-install', 'wrangler', ...a], { cwd: SERVER, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 }).toString();
  let dev = null, log = '';
  try {
    fs.rmSync(persist, { recursive: true, force: true });
    wr('d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', persist);
    wr('d1', 'execute', 'DB', '--local', '--persist-to', persist, '--command', "INSERT INTO persone (id, nome, token, slot) VALUES ('luca', 'Luca', 'tokL', 0), ('mia', 'Mia', 'tokM', 1), ('ugo', 'Ugo', 'tokU', 2);");
    const port = await freePort(), inspector = await freePort();
    dev = spawn('npx', ['--no-install', 'wrangler', 'dev', '--name', 'marea-test-corse-link', '--local', '--ip', '127.0.0.1', '--port', String(port), '--inspector-port', String(inspector),
      '--assets', ctx.distDir, '--persist-to', persist, '--show-interactive-dev-session=false'], { cwd: SERVER, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    dev.stdout.on('data', (d) => (log += d)); dev.stderr.on('data', (d) => (log += d));
    const base = `http://127.0.0.1:${port}`;
    let up = false;
    for (let i = 0; i < 120 && !up; i++) { try { up = (await fetch(base + '/api/ping')).ok; } catch { /* non ancora */ } if (!up) await sleep(500); }
    if (!up) throw new Error('wrangler dev non risponde:\n' + log.split('\n').slice(-20).join('\n'));

    // tre telefoni col renderer software: qualità bassa e densità 1, se no la CPU non basta anche al server
    const P = [];
    for (const t of ['tokL', 'tokM', 'tokU']) { const p = await ctx.B.openPage(ctx.browser, `${base}/?t=${t}&gara=amici&test=1&quality=low&ruota=0`, { viewport: LAND }); ctx._pages.push(p); P.push(p); }
    const [L, M, U] = P.map((p) => p.page);
    const st = (p) => ctx.getState(p);
    const hook = (p, n, ...a) => p.evaluate(([n, a]) => window.__game.test[n](...a), [n, a]);

    await ctx.test('il link con &gara=amici apre subito la sala delle Corse: tutti e tre nella stessa sala', async () => {
      for (const p of [L, M, U]) await ctx.waitReady(p, 40000);
      for (const p of [L, M, U]) await ctx.waitState(p, (s) => s.corse && s.corse.hub && s.corse.hub.aperto === true && s.corse.sala && s.corse.sala.aperta && s.corse.sala.connesso && s.corse.sala.membri.length === 3, 40000);
      const s = await st(U);
      assert(s.corse.hub.fermo === true && !s.corse.active, 'sotto la sala l\'hub deve essere fermo: ' + JSON.stringify(s.corse.hub));
      const box = await U.locator('#mzGpSala .box').boundingBox();
      assert(box && box.y >= 0 && box.y + box.height <= 390, 'la sala esce dal telefono: ' + JSON.stringify(box));
      assert((await U.locator('#mzGpSala [data-id^="spiaggia_"]').count()) === 4, 'mancano le 4 piste nella sala');
    });

    await ctx.test('Ugo sceglie il Lungomare nella sala e preme VIA coi bot: partono tutti e tre lì, ognuno vede gli altri due', async () => {
      await U.locator('#mzGpSala [data-id="spiaggia_lungomare"]').click();
      await U.locator('#mzGpSala [data-id="spiaggia_lungomare"].on').waitFor({ timeout: 4000 });
      await U.locator('#mzGpSala [data-id="bot_si"]').click();
      await ctx.shot(U, 'sala');
      assert(/Lungomare/.test(await U.locator('#mzGpSalaVia').innerText()), 'il VIA non dice la pista scelta');
      await U.locator('#mzGpSalaVia').click();
      for (const p of [L, M, U]) await ctx.waitState(p, (s) => s.corse.active === true && s.corse.amici === true, 30000);
      for (const p of [L, M, U]) {
        const s = await st(p);
        assert(s.corse.pista === 'spiaggia_lungomare' && s.corse.vista.veicoli === 5, `pista ${s.corse.pista}, veicoli ${s.corse.vista.veicoli}`);
      }
      for (const p of [L, M, U]) await hook(p, 'corseAuto', 3);
      for (const p of [L, M, U]) await ctx.waitState(p, (s) => s.corse.tick > 60 && s.corse.vista.fantasmi === 2, 60000);
      await ctx.shot(U, 'gara');
    });

    await ctx.test('Esc: ritirati, la sala si chiude e si torna nell\'hub; nessun errore', async () => {
      for (const p of [L, M, U]) { await hook(p, 'corseAuto', 0); await p.keyboard.press('Escape'); }
      for (const p of [L, M, U]) await ctx.waitState(p, (s) => !s.corse.active && (s.minigiochi.open || s.corse.hub.aperto), 30000);
      ctx.noErrors(P[0], 'luca'); ctx.noErrors(P[1], 'mia'); ctx.noErrors(P[2], 'ugo');
    });
  } finally {
    if (dev) { try { process.kill(-dev.pid, 'SIGTERM'); } catch { /* già finito */ } await sleep(500); try { process.kill(-dev.pid, 'SIGKILL'); } catch { /* ok */ } }
    fs.rmSync(persist, { recursive: true, force: true });
  }
}
