// La storia delle prime ore (GDD §9, storia/): server locale pulito, Luca entra la prima volta col telefono (390×844) e `?storia=1`.
// Naufragio → risveglio con Nonna Pina → scheda obbligatoria (niente SALTA né ×) → casa → ARREDA (il lume, posato via API) → il regalo di
// Fulvio (il retino) → un insetto (via API) → venduto al Furetto (via API) → Bepi → Gigi → la barca: senza, il viaggio rapido non si apre
// e la barca al molo non c'è; Bepi dice quanto manca, con le monete di prova la vende. Poi le missioni: Remo dà la Laguna, una Regata
// (autopilot), Remo paga e la Laguna entra nel viaggio rapido; la riga del dungeon sotto. La scheda sta nello schermo e non copre A né joystick.
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
export const timeout = 420000;

const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function (ctx) {
  const { assert } = ctx;
  const SERVER = path.join(ctx.ROOT, 'apps/server');
  const persist = path.join(ctx.OUT, `m4storia-${process.pid}`);
  const env = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' };
  const wr = (...a) => execFileSync('npx', ['--no-install', 'wrangler', ...a], { cwd: SERVER, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 }).toString();
  const storia = JSON.parse(fs.readFileSync(path.join(ctx.ROOT, 'packages/content/src/storia.json'), 'utf8'));
  let dev = null, log = '';
  try {
    fs.rmSync(persist, { recursive: true, force: true });
    wr('d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', persist);
    wr('d1', 'execute', 'DB', '--local', '--persist-to', persist, '--command', "INSERT INTO persone (id, nome, token, slot) VALUES ('luca', 'Luca', 'tokL', 0);");
    const port = await freePort(), inspector = await freePort();
    dev = spawn('npx', ['--no-install', 'wrangler', 'dev', '--local', '--ip', '127.0.0.1', '--port', String(port), '--inspector-port', String(inspector),
      '--assets', ctx.distDir, '--persist-to', persist, '--show-interactive-dev-session=false'], { cwd: SERVER, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    dev.stdout.on('data', (d) => (log += d)); dev.stderr.on('data', (d) => (log += d));
    const base = `http://127.0.0.1:${port}`;
    let up = false;
    for (let i = 0; i < 120 && !up; i++) { try { up = (await fetch(base + '/api/ping')).ok; } catch { /* non ancora */ } if (!up) await sleep(500); }
    if (!up) throw new Error('wrangler dev non risponde:\n' + log.split('\n').slice(-20).join('\n'));
    const api = async (p, b) => { const r = await fetch(base + p, { method: b ? 'POST' : 'GET', headers: { 'x-token': 'tokL', 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }); return { status: r.status, body: await r.json() }; };

    const P = await ctx.B.openPage(ctx.browser, `${base}/?t=tokL&test=1&storia=1`, { viewport: ctx.B.IPHONE }); ctx._pages.push(P);
    const page = P.page;
    await ctx.waitReady(page, 30000);
    const st = () => ctx.getState(page);
    const hook = (n, ...a) => page.evaluate(([n, a]) => window.__game.test[n](...a), [n, a]);
    const passo = (id, ms = 30000) => ctx.waitState(page, (s, id) => s.storia && (s.storia.passo === id || s.storia.fase === id), ms, id);
    /** Sfoglia la scheda di chi parla: AVANTI, poi `scegli` se c'è, se no CIAO. Restituisce le scelte se si ferma lì. */
    const sfoglia = async (scegli) => {
      for (let i = 0; i < 14; i++) {
        if ((await st()).porto?.open !== 'parla') return null;
        const acts = await page.$$eval('#mzDialogo.on button[data-act]', (bs) => bs.map((b) => b.dataset.act));
        if (!acts.length) { await sleep(200); continue; }
        const a = acts.includes('avanti') ? 'avanti' : scegli && acts.includes(scegli) ? scegli : acts.includes('ciao') ? 'ciao' : null;
        if (!a) return acts;
        await page.click(`#mzDialogo.on button[data-act="${a}"]`); await sleep(350);
      }
      return null;
    };
    const parla = async (fai) => { await fai(); await ctx.waitState(page, (s) => s.porto?.open === 'parla', 10000); await sleep(300); };
    /** La scheda (`sel`) si vede, sta nello schermo e non copre A, joystick, la barra in alto e le risorse. */
    const scheda = async (sel, tag) => {
      await page.waitForSelector(sel + '.on', { timeout: 8000 }).catch(() => {}); // appena nata, o dopo una scheda di dialogo: un frame
      await sleep(300);
      const m = await page.evaluate((sel) => {
        const box = (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
        const c = document.querySelector(sel + '.on'), vw = innerWidth, vh = innerHeight;
        if (!c) return { manca: true };
        const r = box(c), sopra = [];
        for (const e of document.querySelectorAll('#btnA, #joystick, #mzTop > *, #mzBar > *')) {
          const o = box(e);
          if (o.w < 2 || getComputedStyle(e).display === 'none') continue;
          const ox = Math.min(r.x + r.w, o.x + o.w) - Math.max(r.x, o.x), oy = Math.min(r.y + r.h, o.y + o.h) - Math.max(r.y, o.y);
          if (ox > 2 && oy > 2) sopra.push(e.id || e.className);
        }
        return { manca: false, fuori: r.x < 0 || r.y < 0 || r.x + r.w > vw || r.y + r.h > vh, sopra };
      }, sel);
      await ctx.shot(page, tag);
      assert(!m.manca, `${tag}: la scheda ${sel} non si vede`);
      assert(!m.fuori && m.sopra.length === 0, `${tag}: scheda fuori dallo schermo o sopra ${m.sopra.join(', ')}`);
    };

    await ctx.test('naufragio e risveglio: Nonna Pina parla, poi la scheda «Storia» obbligatoria punta casa tua', async () => {
      await ctx.waitState(page, (s) => s.storia?.fase === 'naufragio', 30000);
      await ctx.shot(page, '1_naufragio');
      await ctx.waitState(page, (s) => s.porto?.open === 'parla', 90000);
      await ctx.shot(page, '2_pina');
      await sfoglia();
      await passo('casa', 20000);
      await ctx.waitState(page, (s) => s.storiaGuida?.current === 'casa' && s.storiaGuida.pointer, 10000);
      const s = await st();
      assert(s.storiaGuida.total === 8, 'passi della scheda: ' + JSON.stringify(s.storiaGuida));
      assert(await page.locator('#mzStoria button').count() === 0, 'la scheda della storia ha dei bottoni (SALTA, ×)');
      await scheda('#mzStoria', '3_scheda_casa');
    });

    await ctx.test('casa → ARREDA (il lume di Pina) → il regalo di Fulvio: il retino', async () => {
      const slot = (await st()).borgo.porte.find((q) => q.mia).slot;
      await hook('porta', slot, false);
      await passo('arreda', 20000);
      let posato = false;
      for (const cell of [[14, 29], [15, 30], [13, 30], [16, 28]]) if ((await api('/api/lot/casa/posa', { id: storia.regaloPina, cell, stanza: 'terra' })).status === 200) { posato = true; break; }
      assert(posato, 'il lume non si posa');
      await hook('lotRefresh'); await hook('esciDiCasa', slot);
      await passo('attrezzo', 30000);
      // Bepi troppo presto: non vende e non apre la bottega («Ce l'hai»), rimanda al passo da fare
      await parla(async () => { await hook('bottegaVai', 'cantiere', 0); await hook('bottegaApri', 'cantiere'); });
      const presto = await page.locator('#mzDialogo.on').innerText();
      assert(/non ancora/i.test(presto), 'Bepi troppo presto: ' + presto);
      await sfoglia();
      assert(await page.locator('#mzBottega.on').count() === 0, 'la bottega del Cantiere si apre prima del tempo');
      await hook('negozio', false); await sleep(800);
      const banco = (await st()).negozio.pezzi.find((p) => p.kind === 'banco');
      await hook('teleport', banco.x, banco.z); await sleep(400);
      await parla(() => page.keyboard.press('KeyE'));
      const scelte = await sfoglia();
      assert(scelte && scelte.includes('canna') && scelte.includes('retino'), 'Fulvio: scelte ' + JSON.stringify(scelte));
      await ctx.shot(page, '4_fulvio_regalo');
      await page.click('#mzDialogo.on button[data-act="retino"]'); await sleep(800);
      await sfoglia();
      await passo('cattura', 10000);
      assert((await api('/api/lot')).body.storia.attrezzo === 'retino', 'il regalo non è segnato');
    });

    await ctx.test('un insetto, venduto al Furetto → Bepi dice il prezzo → Gigi consiglia la Grotta', async () => {
      const turno = (await st()).insetti.turno;
      let preso = null;
      for (const k of [0, 1, 2, 3, 4, 5].flatMap((i) => [`p:${turno}:${i}`, `p:${turno}:${i}:0`])) { const r = await api('/api/lot/insetti/cattura', { k }); if (r.status === 200) { preso = r.body.id; break; } }
      assert(preso, 'nessun insetto libero');
      await hook('lotRefresh');
      await passo('vendi', 30000);
      const v = await api('/api/rpg', { azione: { t: 'contrabbando', op: 'vendi', item: preso, n: 1 } });
      assert(v.status === 200, 'vendita al Furetto: ' + v.status);
      await hook('lotRefresh');
      await passo('bepi', 30000);
      await parla(async () => { await hook('bottegaVai', 'cantiere', 0); await hook('bottegaApri', 'cantiere'); });
      await ctx.shot(page, '5_bepi');
      await sfoglia();
      await passo('gigi', 10000);
      await parla(() => hook('portoApri', 'gigi'));
      await sfoglia();
      await ctx.waitState(page, (s) => s.storia?.fase === 'barca' && s.storiaGuida?.current === 'barca', 15000);
      await scheda('#mzStoria', '6_scheda_barca');
    });

    await ctx.test('senza barca: il viaggio rapido non si apre, la barca al molo non c\'è; Bepi dice quanto manca, poi la vende', async () => {
      await page.click('#mzTeleBtn'); await sleep(500);
      assert(await page.locator('#mzTele.on').count() === 0, 'il viaggio rapido si apre senza barca');
      // A vicino al posto della barca: niente barca, il toast manda da Bepi
      const boat = (await st()).boat;
      let detto = false;
      for (const [dx, dz] of [[0, -2], [0, 2], [-2, 0], [2, 0], [0, -3], [0, 3], [-3, 0], [3, 0]]) {
        await hook('teleport', boat.x + dx, boat.z + dz); await sleep(250);
        await page.keyboard.press('KeyE'); await sleep(300);
        if (await page.evaluate(() => document.body.innerText.includes('Non hai una barca'))) { detto = true; break; }
      }
      assert(detto && (await st()).mode === 'walk', 'A al molo senza barca: niente toast, o si è saliti');
      await parla(async () => { await hook('bottegaVai', 'cantiere', 0); await hook('bottegaApri', 'cantiere'); });
      const t = await page.locator('#mzDialogo.on').innerText();
      assert(/mancano \d+ monete/i.test(t), 'Bepi senza monete: ' + t);
      await page.click('#mzDialogo.on button[data-act="ciao"]'); await sleep(500);
      assert((await api('/api/test/monete', { n: storia.barca.prezzo })).status === 200, 'monete di prova');
      await hook('lotRefresh'); await sleep(800);
      await parla(async () => { await hook('bottegaVai', 'cantiere', 0); await hook('bottegaApri', 'cantiere'); });
      await page.click('#mzDialogo.on button[data-act="compra"]'); await sleep(1000);
      await ctx.shot(page, '7_barca_comprata');
      await sfoglia();
      await ctx.waitState(page, (s) => s.storia?.barca === true, 10000);
    });

    await ctx.test('missioni: Remo dà la Laguna, una Regata, Remo paga e la Laguna è nel viaggio rapido; il dungeon nella riga sotto', async () => {
      await ctx.waitState(page, (s) => s.missioniGuida?.current === 'remo', 30000);
      await scheda('#mzMissioni', '8_missioni_remo');
      await parla(() => hook('portoApri', 'remo'));
      assert(/Laguna/.test(await page.locator('#mzDialogo.on').innerText()), 'Remo non dà la Laguna');
      await sfoglia();
      await ctx.waitState(page, (s) => s.missioniGuida?.current === 'isola:laguna' && s.missioniGuida.pointer, 10000);
      // la riga del dungeon (dopo il «Fatto!» del passo di Remo)
      await ctx.waitState(page, (s) => /Dungeon: /.test(s.missioniGuida?.nota ?? ''), 5000).catch(async () => assert(false, 'manca la riga del dungeon: ' + JSON.stringify((await st()).missioniGuida)));
      await scheda('#mzMissioni', '8b_missioni_laguna');
      await hook('goto', 'laguna');
      const dock = (await st()).island.dock;
      await hook('teleport', dock.x, dock.z); await sleep(300);
      await page.keyboard.press('KeyE');
      await ctx.waitState(page, (s) => s.mode === 'boat' && s.minigiochi.near === 'regata', 8000);
      await hook('regataAutopilot', 20);
      await page.locator('#mzPlay').click();
      await ctx.waitState(page, (s) => s.minigiochi.open === true, 90000);
      await page.locator('#mzEsito [data-act="ok"]').click();
      await hook('lotRefresh');
      await hook('goto', 'porto'); await sleep(500);
      const prima = (await api('/api/lot')).body;
      await parla(() => hook('portoApri', 'remo'));
      await sfoglia('riscuoti');
      await ctx.waitState(page, (s) => s.missioniGuida?.current === 'isola:corse', 10000);
      const dopo = (await api('/api/lot')).body, premio = storia.isole[0].premio;
      assert(dopo.storia.isole.join() === 'laguna' && dopo.ledger.monete.generated === prima.ledger.monete.generated + premio, `Remo: ${JSON.stringify(dopo.storia)}`);
      await page.click('#mzTeleBtn');
      await page.waitForSelector('#mzTele.on', { timeout: 5000 });
      const isole = await page.$$eval('#mzTele.on button[data-isola]', (bs) => bs.map((b) => b.dataset.isola));
      assert(isole.join() === 'porto,laguna', 'viaggio rapido: ' + isole.join());
      await ctx.shot(page, '9_viaggio_rapido');
      await page.click('#mzTele.on .x');
    });

    await ctx.test('nessun pageerror', async () => { ctx.noErrors(P, 'Luca'); });
  } finally {
    if (dev) { try { process.kill(-dev.pid, 'SIGTERM'); } catch { /* già finito */ } await sleep(500); try { process.kill(-dev.pid, 'SIGKILL'); } catch { /* ok */ } }
    fs.rmSync(persist, { recursive: true, force: true });
  }
}
