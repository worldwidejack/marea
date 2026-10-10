// Corse tra amici (10 ott 2026, CONTRACTS §39): due telefoni in orizzontale (Luca e Mia) su wrangler dev locale. Tutti e due vanno all'Isola
// delle Corse, alla porta della Spiaggia scelgono «CON GLI AMICI» ed entrano nella stessa sala; Luca preme VIA e partono insieme sulla
// pista di Luca, senza bot, ognuno al suo posto in griglia. In gara ognuno vede l'altro come fantasma (veicolo e nome), la classifica è tra
// amici; il pilota automatico finisce le due gare, il server le rigioca e la scheda dice «N° su 2 tra amici»; poi di nuovo nell'hub.
// Screenshot in tests/out/shots/m4_corse_amici_*.png.
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
export const timeout = 420000;
const LAND = { width: 844, height: 390, deviceScaleFactor: 1, isMobile: true, hasTouch: true };
const SPOT = 'corse:corse';
const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function (ctx) {
  const { assert } = ctx;
  const SERVER = path.join(ctx.ROOT, 'apps/server');
  const persist = path.join(ctx.OUT, `m4corseamici-${process.pid}`);
  const env = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' };
  const wr = (...a) => execFileSync('npx', ['--no-install', 'wrangler', ...a], { cwd: SERVER, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 }).toString();
  let dev = null, log = '';
  try {
    fs.rmSync(persist, { recursive: true, force: true });
    wr('d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', persist);
    wr('d1', 'execute', 'DB', '--local', '--persist-to', persist, '--command', "INSERT INTO persone (id, nome, token, slot) VALUES ('luca', 'Luca', 'tokL', 0), ('mia', 'Mia', 'tokM', 1);");
    const port = await freePort(), inspector = await freePort();
    dev = spawn('npx', ['--no-install', 'wrangler', 'dev', '--name', 'marea-test-corse-amici', '--local', '--ip', '127.0.0.1', '--port', String(port), '--inspector-port', String(inspector),
      '--assets', ctx.distDir, '--persist-to', persist, '--show-interactive-dev-session=false'], { cwd: SERVER, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    dev.stdout.on('data', (d) => (log += d)); dev.stderr.on('data', (d) => (log += d));
    const base = `http://127.0.0.1:${port}`;
    let up = false;
    for (let i = 0; i < 120 && !up; i++) { try { up = (await fetch(base + '/api/ping')).ok; } catch { /* non ancora */ } if (!up) await sleep(500); }
    if (!up) throw new Error('wrangler dev non risponde:\n' + log.split('\n').slice(-20).join('\n'));

    // due telefoni col renderer software: qualità bassa e densità 1, se no la CPU non basta anche al server
    const PL = await ctx.B.openPage(ctx.browser, `${base}/?t=tokL&test=1&quality=low&ruota=0`, { viewport: LAND }); ctx._pages.push(PL);
    const PM = await ctx.B.openPage(ctx.browser, `${base}/?t=tokM&test=1&quality=low&ruota=0`, { viewport: LAND }); ctx._pages.push(PM);
    const L = PL.page, M = PM.page;
    if (process.platform === 'win32') for (const p of [L, M]) await p.route(/\/(api|chunk|assets)/, (r) => r.continue({ headers: { ...r.request().headers(), connection: 'close' } }));
    for (const p of [L, M]) { await ctx.waitReady(p, 40000); await ctx.waitState(p, (s) => s.lot && s.lot.ready === true && s.temi && s.compass, 40000); }
    const st = (p) => ctx.getState(p);
    const hook = (p, n, ...a) => p.evaluate(([n, a]) => window.__game.test[n](...a), [n, a]);

    await ctx.test('tutti e due all\'Isola delle Corse → porta della Spiaggia → «CON GLI AMICI» → stessa sala', async () => {
      for (const p of [L, M]) {
        await hook(p, 'temiProva', null);
        const v = await hook(p, 'spotVai', SPOT);
        assert(v && v.aperta === true, 'spotVai: ' + JSON.stringify(v));
        await ctx.waitState(p, (s, id) => s.minigiochi.near === id, 20000, SPOT);
        await sleep(800);
        await p.locator('#mzPlay').click();
        await ctx.waitState(p, (s) => s.corse && s.corse.hub && s.corse.hub.aperto === true, 20000);
        await hook(p, 'corseHubVai', 'spiaggia');
        await ctx.waitState(p, (s) => s.corse.scelta === true, 8000);
      }
      await L.locator('#mzGpIntro [data-id="spiaggia_baia"]').click();
      await ctx.shot(L, 'scelta');
      for (const p of [L, M]) await p.locator('#mzGpAmici').click();
      for (const p of [L, M]) await ctx.waitState(p, (s) => s.corse.sala && s.corse.sala.connesso && s.corse.sala.membri.length === 2, 15000);
      const box = await L.locator('#mzGpSala .box').boundingBox();
      assert(box && box.y >= 0 && box.y + box.height <= 390, 'la sala esce dal telefono: ' + JSON.stringify(box));
      await ctx.shot(L, 'sala');
    });

    await ctx.test('VIA di Luca: partono tutti e due sulla Baia, senza bot, ai loro posti; ognuno vede l\'altro', async () => {
      await L.locator('#mzGpSalaVia').click();
      for (const p of [L, M]) await ctx.waitState(p, (s) => s.corse.active === true && s.corse.amici === true, 20000);
      const [sl, sm] = [await st(L), await st(M)];
      assert(sl.corse.pista === 'spiaggia_baia' && sm.corse.pista === 'spiaggia_baia', `piste ${sl.corse.pista} ${sm.corse.pista}`);
      assert(sl.corse.vista.veicoli === 1 && sm.corse.vista.veicoli === 1, 'ci sono i bot');
      // il gas è sul bottone: una gara a mano per un attimo, poi il pilota automatico
      for (const p of [L, M]) await hook(p, 'corseAuto', 3);
      for (const p of [L, M]) await ctx.waitState(p, (s) => s.corse.tick > 60 && s.corse.vista.fantasmi === 1 && s.corse.sala.amici[0].prog !== null, 40000);
      await sleep(500);
      const [a, b] = [await st(L), await st(M)];
      ctx.log(`Luca vede ${JSON.stringify(a.corse.sala.amici)} ${a.corse.vista.nomi} · Mia vede ${JSON.stringify(b.corse.sala.amici)} ${b.corse.vista.nomi}`);
      assert(a.corse.sala.amici[0].nome === 'Mia' && b.corse.sala.amici[0].nome === 'Luca', 'nomi degli amici');
      assert(a.corse.sala.amici[0].veicolo === b.corse.veicolo && b.corse.sala.amici[0].veicolo === a.corse.veicolo, `il fantasma non ha il veicolo vero: ${a.corse.sala.amici[0].veicolo}/${b.corse.veicolo}, ${b.corse.sala.amici[0].veicolo}/${a.corse.veicolo}`);
      assert(a.corse.vista.nomi.length + b.corse.vista.nomi.length >= 1, 'chi sta dietro non vede il nome di chi sta davanti');
      assert(await L.isVisible('.pp-amici') && (await L.locator('.pp-amici div').count()) === 2, 'manca la classifica tra amici');
      await ctx.shot(L, 'gara_luca');
      await ctx.shot(M, 'gara_mia');
    });

    await ctx.test('il pilota automatico finisce le due gare; il server rigioca; la scheda dice la posizione tra amici; di nuovo nell\'hub', async () => {
      for (const p of [L, M]) await hook(p, 'corseAuto', 12);
      for (const p of [L, M]) await ctx.waitState(p, (s) => s.minigiochi.open === true, 200000);
      for (const [p, nome] of [[L, 'luca'], [M, 'mia']]) {
        const s = await st(p), r = s.minigiochi.last;
        ctx.log(`${nome}: ${r.medal} · ${JSON.stringify(r.detail)}`);
        assert(r.detail.giri === r.detail.tot, `${nome} non ha finito: ` + JSON.stringify(r.detail));
        const testo = await p.locator('#mzEsito').innerText();
        assert(/su 2 tra amici/.test(testo), `${nome}: la scheda non dice la posizione tra amici: ${testo.replace(/\s+/g, ' ').slice(0, 160)}`);
        assert(s.corse.hub.aperto && !s.corse.active && !s.corse.sala.aperta, `${nome}: sotto la scheda non c'è l'hub (o la sala è ancora aperta)`);
      }
      await ctx.shot(L, 'esito');
      for (const p of [L, M]) { await hook(p, 'corseAuto', 0); await p.locator('#mzEsito [data-act="ok"]').click(); }
      for (const p of [L, M]) await ctx.waitState(p, (q) => !q.minigiochi.open && q.corse.hub.aperto && q.corse.hub.vicino === 'spiaggia', 8000);
    });

    await ctx.test('nessun errore in console', async () => { ctx.noErrors(PL, 'luca'); ctx.noErrors(PM, 'mia'); });
  } finally {
    if (dev) { try { process.kill(-dev.pid, 'SIGTERM'); } catch { /* già finito */ } await sleep(500); try { process.kill(-dev.pid, 'SIGKILL'); } catch { /* ok */ } }
    fs.rmSync(persist, { recursive: true, force: true });
  }
}
