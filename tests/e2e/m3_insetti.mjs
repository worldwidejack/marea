// Gli insetti di Borgo Marea (#445): il retino si compra al negozio dei mobili (500 monete, zaino «Strumenti», peso 0); con la pala in
// mano si colpiscono i sassi, a mani nude o col retino si scuotono gli alberi (una volta al giorno a testa); un insetto preso col retino
// va nello zaino a peso 0 e diventa «visto» nella pagina Insetti del Diario; consegnato al mobiliere sparisce e diventa «posseduto»;
// venduto al Contrabbandiere dà il suo prezzo ma non conta come posseduto.
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
export const timeout = 420000;

const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function (ctx) {
  const { assert } = ctx;
  const SERVER = path.join(ctx.ROOT, 'apps/server');
  const WRANGLER_BIN = path.join(ctx.ROOT, 'node_modules/wrangler/bin/wrangler.js');
  const persist = path.join(ctx.OUT, `m3insetti-${process.pid}`);
  const env = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' };
  const wr = (...a) => execFileSync(process.execPath, [WRANGLER_BIN, ...a], { cwd: SERVER, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 }).toString();
  const { INSETTI } = await import(pathToFileURL(path.join(ctx.ROOT, 'packages/content/src/insetti.ts')).href);

  let dev = null, log = '';
  const pages = [];
  try {
    fs.rmSync(persist, { recursive: true, force: true });
    wr('d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', persist);
    wr('d1', 'execute', 'DB', '--local', '--persist-to', persist, '--command', "INSERT INTO persone (id, nome, token, slot) VALUES ('luca', 'Luca', 'tokL', 0);");
    const port = await freePort(), inspector = await freePort();
    dev = spawn(process.execPath, [WRANGLER_BIN, 'dev', '--local', '--ip', '127.0.0.1', '--port', String(port), '--inspector-port', String(inspector),
      '--assets', ctx.distDir, '--persist-to', persist, '--var', 'TEST_CLOCK:1', '--show-interactive-dev-session=false'], { cwd: SERVER, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    dev.stdout.on('data', (d) => (log += d)); dev.stderr.on('data', (d) => (log += d));
    const BASE = `http://127.0.0.1:${port}`;
    let up = false;
    for (let i = 0; i < 120 && !up; i++) { try { up = (await fetch(BASE + '/api/ping')).ok; } catch { /* non ancora */ } if (!up) await sleep(500); }
    if (!up) throw new Error('wrangler dev non risponde:\n' + log.split('\n').slice(-20).join('\n'));

    const hdr = { 'x-token': 'tokL', 'content-type': 'application/json' };
    const get = async (p) => { const r = await fetch(BASE + p, { headers: hdr }); return { status: r.status, body: await r.json() }; };
    const post = async (p, b) => { const r = await fetch(BASE + p, { method: 'POST', headers: hdr, body: JSON.stringify(b ?? {}) }); return { status: r.status, body: await r.json() }; };
    await get('/api/lot');
    assert((await post('/api/test/monete', { n: 2000 })).status === 200, 'monete di prova');
    assert((await post('/api/lot/casa/pala')).status === 200, 'la pala');

    const pg = await ctx.B.openPage(ctx.browser, `${BASE}/?t=tokL&test=1`, { viewport: ctx.B.DESKTOP });
    pages.push(pg); ctx._pages.push(pg);
    const page = pg.page;
    if (process.platform === 'win32') await page.route((u) => /^\/(api|chunk|assets)/.test(u.pathname), (r) => r.continue({ headers: { ...r.request().headers(), connection: 'close' } }));
    await ctx.waitReady(page, 30000);
    await ctx.waitState(page, (s) => s.lot && s.lot.ready && s.negozio && s.insetti, 30000);
    const hook = (n, ...a) => page.evaluate(([n, a]) => window.__game.test[n](...a), [n, a]);
    const st = () => ctx.getState(page);

    await ctx.test('1. Il retino al negozio dei mobili: 500 monete, nello zaino in «Strumenti» a peso 0, in mano subito', async () => {
      await hook('negozio', false);
      await ctx.waitState(page, (s) => s.negozio.dentro, 5000);
      const pz = (await st()).negozio.pezzi.find((p) => p.kind === 'retino');
      assert(pz && pz.monete === 500, 'manca l’espositore del retino da 500: ' + JSON.stringify((await st()).negozio.pezzi.map((p) => p.kind)));
      const m0 = (await get('/api/lot')).body.monete;
      await hook('teleport', pz.x, pz.z);
      await ctx.waitState(page, (s) => s.negozio.near === 'retino', 5000);
      await page.keyboard.press('KeyE');
      await ctx.waitState(page, (s) => s.negozio.aperto === 'retino', 3000);
      await ctx.fulvioFinoA(page, 'compra');
      await page.locator('#mzNegozio [data-act="compra"]').click();
      await ctx.waitState(page, (s) => s.insetti.retino === true, 8000);
      const l = (await get('/api/lot')).body;
      assert(l.monete === m0 - 500 && l.hero.inv.retino === 1, `retino comprato: ${l.monete} vs ${m0 - 500}`);
      assert((await st()).insetti.attrezzo === 'retino', 'appena comprato è in mano');
      assert((await post('/api/lot/casa/retino')).status === 409, 'il secondo retino no');
      const { uscita } = (await st()).negozio;
      await hook('teleport', uscita.x, uscita.z);
      await page.keyboard.down('ArrowDown');
      try { await ctx.waitState(page, (s) => !s.negozio.dentro && s.arch.place === 'porto', 20000); } finally { await page.keyboard.up('ArrowDown'); }
      await page.waitForFunction(() => !window.__game.state().velo.attivo, null, { timeout: 5000 });
      // rientro nel negozio con il retino in mano: resta impugnato e non fluttua sulla porta (#486)
      await hook('negozio', false);
      await ctx.waitState(page, (s) => s.negozio.dentro, 5000);
      assert((await st()).insetti.attrezzo === 'retino', 'rientrando nel negozio il retino resta in mano');
      await ctx.shot(page, 'pc_negozio_rientro_retino');
      await hook('teleport', uscita.x, uscita.z);
      await page.keyboard.down('ArrowDown');
      try { await ctx.waitState(page, (s) => !s.negozio.dentro && s.arch.place === 'porto', 20000); } finally { await page.keyboard.up('ArrowDown'); }
      await page.waitForFunction(() => !window.__game.state().velo.attivo, null, { timeout: 5000 });
    });

    let preso = null;
    await ctx.test('2. Sassi con la pala in mano e alberi: una volta al giorno a testa; quello che esce si prende col retino (zaino, «visto»)', async () => {
      const s0 = await st();
      assert(s0.insetti.sassi.length === 10 && s0.insetti.alberi.length >= 8, 'sassi e alberi del Borgo');
      // vicino al sasso: col retino in mano niente bottone per il sasso, con la pala sì
      const sa = s0.insetti.sassi[0];
      await hook('teleport', sa.x + 1.2, sa.z + 0.5);
      await hook('insettiAttrezzo', 'pala');
      await ctx.waitState(page, (s) => s.insetti.ctx === 'sasso' && /colpisci/i.test(s.insetti.bottone ?? ''), 3000);
      let uscito = null;
      for (let i = 0; i < s0.insetti.sassi.length && !uscito; i++) {
        const r = await hook('insettiSasso', i);
        assert(r && r.gia === false, `sasso ${i}: ` + JSON.stringify(r));
        uscito = r.uscito;
      }
      assert(uscito, 'da nessun sasso è uscito un insetto');
      assert((await hook('insettiSasso', 0)).gia === true, 'lo stesso sasso due volte nello stesso giorno: niente');
      const def = INSETTI.find((i) => i.id === uscito.id);
      assert(def && def.tipo === 'sasso', 'esce dai sassi: ' + uscito.id);
      assert(await hook('insettiCattura', uscito.k), 'cattura dell’insetto del sasso');
      await ctx.waitState(page, (s, id) => (s.insetti.collezione.visti[id] ?? 0) === 1 && s.insetti.cartello, 5000, uscito.id);
      const l = (await get('/api/lot')).body;
      assert(l.hero.inv[uscito.id] === 1, 'nello zaino');
      assert(l.insetti.visti[uscito.id] === 1 && !l.insetti.posseduti.includes(uscito.id), 'visto, non ancora posseduto');
      preso = uscito.id;
      await ctx.shot(page, 'pc_insetti_preso');
      // un albero: senza attrezzi (si scuote a mani nude), una volta al giorno
      await hook('insettiAttrezzo', 'nulla');
      const al = s0.insetti.alberi[0];
      await hook('teleport', al.x + 1.4, al.z + 0.8);
      await ctx.waitState(page, (s) => s.insetti.ctx === 'albero', 3000);
      const ra = await hook('insettiAlbero', 0);
      assert(ra && ra.gia === false, 'albero scosso: ' + JSON.stringify(ra));
      assert((await hook('insettiAlbero', 0)).gia === true, 'lo stesso albero due volte: niente');
    });

    await ctx.test('3. Col retino in mano un colpo prende l’insetto in giro davanti a te', async () => {
      await hook('insettiAttrezzo', 'retino');
      // chi gira cambia ogni 4 minuti (liberiDelTurno): uno nato sulla riva, allertato dal colpo, può finire in acqua prima che il
      // retino si chiuda; locuste e farfalle a volte scappano lo stesso. Si prova prima chi sta più lontano dall'acqua ('~', ',', 'B' del
      // template porto, 1 cella = 2 m) e, se il colpo va a vuoto, il prossimo: due giri della lista.
      const porto = JSON.parse(fs.readFileSync(path.join(ctx.ROOT, 'packages/content/src/islands.json'), 'utf8')).find((i) => i.id === 'porto');
      const c0 = await hook('palaCellWorld', [0, 0]), T = porto.tile;
      const asciutta = (cx, cz) => !['~', ',', 'B', undefined].includes(porto.rows[cz]?.[cx]);
      const riva = (x, z) => {
        const cx = Math.floor((x - c0.x) / T + 0.5), cz = Math.floor((z - c0.z) / T + 0.5);
        let d = 8;
        for (let dz = -8; dz <= 8; dz++) for (let dx = -8; dx <= 8; dx++) if (!asciutta(cx + dx, cz + dz)) d = Math.min(d, Math.hypot(dx, dz));
        return d * T;
      };
      const inGiro = async () => (await st()).insetti.attori.filter((x) => x.k.startsWith('p:') && x.prendibile).map((x) => ({ ...x, riva: riva(x.x, x.z) })).sort((p, q) => q.riva - p.riva);
      const tutti = await inGiro();
      assert(tutti.length, 'nessun insetto in giro: ' + JSON.stringify((await st()).insetti.attori));
      // cattura: col retino in mano il colpo prende l'insetto davanti a te; si guarda la collezione (non il cartello del passo 2)
      let a = null;
      for (const t of [...tutti, ...tutti]) {
        const cur = (await inGiro()).find((x) => x.k === t.k);
        if (!cur) continue;
        const prima = (await st()).insetti.collezione.visti[cur.id] ?? 0;
        await hook('teleport', cur.x, cur.z);
        await hook('insettiRetino');
        await ctx.waitState(page, (s) => s.insetti.colpo === 0, 8000);
        const dopo = (await st()).insetti.attori.find((x) => x.k === cur.k);
        if (dopo && dopo.stato !== 'preso') { console.log(`  m3_insetti: insetto ${cur.k} (${cur.id}, a ${cur.riva.toFixed(1)} m dall'acqua) mancato: ${dopo.stato}`); continue; }
        a = cur;
        await ctx.waitState(page, (s, [id, n]) => (s.insetti.collezione.visti[id] ?? 0) > n, 8000, [cur.id, prima]).catch(() => {});
        break;
      }
      assert(a, 'nessun insetto in giro preso col retino: ' + JSON.stringify(tutti));
      const l = (await get('/api/lot')).body;
      assert(l.insetti.presi.includes(a.k) && l.hero.inv[a.id] >= 1, 'preso dal server: ' + JSON.stringify(l.insetti));
      assert((await post('/api/lot/insetti/cattura', { k: a.k })).status === 409, 'lo stesso insetto due volte no');
      // verifica fuga (#458): se manchi il colpo vicino a un insetto, scappa senza sparire e resta prendibile (lontano dall'acqua, se no ci cade)
      const a2 = (await inGiro()).find((x) => x.riva >= 6);
      if (a2) {
        await hook('teleport', a2.x + 1.2, a2.z + 1.2);
        await hook('insettiRetino');
        await ctx.waitState(page, (s) => s.insetti.colpo === 0, 3000);
        const a2Fuga = (await st()).insetti.attori.find((x) => x.k === a2.k);
        assert(a2Fuga && a2Fuga.stato !== 'via', 'l’insetto allertato non deve sparire (stato via)');
        assert(a2Fuga && a2Fuga.prendibile, 'l’insetto in fuga deve restare prendibile: ' + JSON.stringify(a2Fuga));
      }
    });

    await ctx.test('4. Al mobiliere lo consegni (sparisce, posseduto, scheda nel Diario); al Contrabbandiere lo vendi (non posseduto)', async () => {
      await hook('diarioApri', 'insetti');
      await page.locator(`#mzDiario [data-cella="${preso}"]`).click();
      const prima = (await page.locator('#mzDiario').textContent()) ?? '';
      const def = INSETTI.find((i) => i.id === preso);
      assert(prima.includes('non ancora registrato') && !prima.includes(def.descr), 'preso ma non registrato: nel Diario non c’è');
      await hook('diarioChiudi');
      await hook('negozio', false);
      await ctx.waitState(page, (s) => s.negozio.dentro, 5000);
      const banco = (await st()).negozio.pezzi.find((p) => p.kind === 'banco');
      await hook('teleport', banco.x, banco.z);
      await ctx.waitState(page, (s) => s.negozio.near === 'banco', 5000);
      await page.keyboard.press('KeyE');
      await ctx.fulvioFinoA(page, 'registra');
      await page.locator('#mzNegozio [data-act="registra"]').click();
      await page.locator(`#mzNegozio [data-insetto="${preso}"]`).click();
      await ctx.waitState(page, (s) => s.negozio.consegnati === 1, 8000);
      const l = (await get('/api/lot')).body;
      assert(l.insetti.posseduti.includes(preso) && !(l.hero.inv[preso] > 0), 'posseduto e sparito dallo zaino');
      await page.keyboard.press('Escape');
      await hook('diarioApri', 'insetti');
      await page.locator(`#mzDiario [data-cella="${preso}"]`).click();
      assert(((await page.locator('#mzDiario').textContent()) ?? '').includes(def.descr), 'posseduto: la scheda si legge');
      await ctx.shot(page, 'pc_insetti_diario');
      await hook('diarioChiudi');
      // l'altro preso in giro si vende al Contrabbandiere a prezzo pieno
      const altro = Object.keys(l.hero.inv).find((id) => INSETTI.some((i) => i.id === id) && l.hero.inv[id] > 0);
      assert(altro, 'resta un insetto da vendere');
      const v = await post('/api/rpg', { azione: { t: 'contrabbando', op: 'vendi', item: altro, n: 1 } });
      assert(v.status === 200 && v.body.monete === l.monete + INSETTI.find((i) => i.id === altro).prezzo, 'venduto a prezzo pieno: ' + JSON.stringify(v.body).slice(0, 200));
      assert(altro === preso || !v.body.insetti.posseduti.includes(altro), 'venduto non è posseduto');
      ctx.noErrors(pg, 'm3_insetti');
    });
  } finally {
    for (const p of pages) await p.close().catch(() => {});
    if (dev?.pid) { try { process.kill(-dev.pid, 'SIGKILL'); } catch { try { dev.kill('SIGKILL'); } catch { /* già morto */ } } }
    await sleep(300);
    fs.rmSync(persist, { recursive: true, force: true });
  }
}
