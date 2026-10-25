// La pala a Borgo Marea (#438): si compra al negozio dei mobili per 500 monete; la si ritrova nella Borsa (menù AVATAR) tra gli
// «Strumenti» (nello zaino del personaggio pesa 0); permette di scavare buche aperte nel terreno di Borgo Marea, chiuderle (il terreno torna normale) o
// seppellirci oggetti dello zaino, mobili non piazzati nella casa e quantità a scelta di monete (rimane una croce stile Animal Crossing
// a tempo indeterminato finché un giocatore non la scava fuori per passare oggetti da un player all'altro).
// Ogni giorno in un punto casuale di Borgo Marea spawna un «bottino» seppellito (10–200 monete) che sparisce solo per l'utente che lo scava.
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
  const persist = path.join(ctx.OUT, `m3pala-${process.pid}`);
  const env = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' };
  const wr = (...a) => execFileSync(process.execPath, [WRANGLER_BIN, ...a], { cwd: SERVER, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 }).toString();
  const sim = async (f) => import(pathToFileURL(path.join(ctx.ROOT, 'packages/sim/src', f)).href);
  const read = (f) => JSON.parse(fs.readFileSync(path.join(ctx.ROOT, 'packages/content/src', f), 'utf8'));
  const mobili = read('mobili.json').mobili;
  const { vetrinaOra } = await sim('economy/vetrina.ts');
  const { celleScavabiliBorgo, bottinoDelGiorno } = await sim('economy/pala.ts');
  const oggi = vetrinaOra(Date.now()), def = (id) => mobili.find((m) => m.id === id);
  const mobileProva = oggi.terra.map(def).filter(Boolean).sort((a, b) => a.monete - b.monete)[0];
  assert(mobileProva, 'manca un mobile nella vetrina di oggi');
  const botOggi = bottinoDelGiorno(Date.now());
  const scavabili = celleScavabiliBorgo().filter((c) => c[0] !== botOggi.cell[0] || c[1] !== botOggi.cell[1]);
  assert(scavabili.length >= 10, 'poche celle scavabili nel Borgo');

  let dev = null, log = '';
  const pages = [];
  try {
    fs.rmSync(persist, { recursive: true, force: true });
    wr('d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', persist);
    wr('d1', 'execute', 'DB', '--local', '--persist-to', persist, '--command', "INSERT INTO persone (id, nome, token, slot) VALUES ('luca', 'Luca', 'tokL', 0), ('ada', 'Ada', 'tokA', 1);");
    const port = await freePort(), inspector = await freePort();
    dev = spawn(process.execPath, [WRANGLER_BIN, 'dev', '--local', '--ip', '127.0.0.1', '--port', String(port), '--inspector-port', String(inspector),
      '--assets', ctx.distDir, '--persist-to', persist, '--var', 'TEST_CLOCK:1', '--show-interactive-dev-session=false'], { cwd: SERVER, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    dev.stdout.on('data', (d) => (log += d)); dev.stderr.on('data', (d) => (log += d));
    const BASE = `http://127.0.0.1:${port}`;
    let up = false;
    for (let i = 0; i < 120 && !up; i++) { try { up = (await fetch(BASE + '/api/ping')).ok; } catch { /* non ancora */ } if (!up) await sleep(500); }
    if (!up) throw new Error('wrangler dev non risponde:\n' + log.split('\n').slice(-20).join('\n'));

    const hdr = (tok) => ({ 'x-token': tok, 'content-type': 'application/json' });
    const get = async (p, tok = 'tokL') => { const r = await fetch(BASE + p, { headers: hdr(tok) }); return { status: r.status, body: await r.json() }; };
    const post = async (p, b, tok = 'tokL') => { const r = await fetch(BASE + p, { method: 'POST', headers: hdr(tok), body: JSON.stringify(b ?? {}) }); return { status: r.status, body: await r.json() }; };

    // Diamo a Luca e Ada monete a sufficienza per comprare la pala (500), un mobile e seppellire monete
    await get('/api/lot', 'tokL');
    await get('/api/lot', 'tokA');
    assert((await post('/api/test/monete', { n: 2000 }, 'tokL')).status === 200, 'monete Luca');
    assert((await post('/api/test/monete', { n: 1000 }, 'tokA')).status === 200, 'monete Ada');
    // Luca compra anche un mobile da lasciare in magazzino per poi seppellirlo
    assert((await post('/api/lot/casa/compra', { id: mobileProva.id }, 'tokL')).status === 200, 'mobile di prova per Luca');

    const open = async (viewport, tok = 'tokL') => {
      const pg = await ctx.B.openPage(ctx.browser, `${BASE}/?t=${tok}&test=1`, { viewport });
      pages.push(pg); ctx._pages.push(pg);
      await ctx.waitReady(pg.page, 30000);
      await ctx.waitState(pg.page, (s) => s.lot && s.lot.ready && s.negozio && s.negozio.pezzi.length >= 3 && s.pala, 30000);
      const hook = (n, ...a) => pg.page.evaluate(([n, a]) => window.__game.test[n](...a), [n, a]);
      return { pg, page: pg.page, hook, st: () => ctx.getState(pg.page) };
    };
    const cammina = async (page, tasti, fatto, ms = 15000) => { for (const k of tasti) await page.keyboard.down(k); try { await ctx.waitState(page, fatto, ms); } finally { for (const k of tasti) await page.keyboard.up(k); } };

    await ctx.test('1. Al negozio dei mobili: la Pala costa 500 monete; acquistata, si vede nella Borsa tra gli «Strumenti»', async () => {
      const L = await open(ctx.B.DESKTOP, 'tokL');
      globalThis.__luca = L;
      await L.hook('negozio', false);
      await ctx.waitState(L.page, (s) => s.negozio.dentro, 5000);
      const s0 = await L.st();
      const pzPala = s0.negozio.pezzi.find((p) => p.kind === 'pala');
      assert(pzPala && pzPala.monete === 500, 'manca l’espositore della pala da 500 monete: ' + JSON.stringify(s0.negozio.pezzi));

      const monetePrima = (await get('/api/lot', 'tokL')).body.monete;
      await L.hook('teleport', pzPala.x, pzPala.z);
      await ctx.waitState(L.page, (s) => s.negozio.near === 'pala', 5000);
      await L.page.keyboard.press('KeyE');
      await ctx.waitState(L.page, (s) => s.negozio.aperto === 'pala', 3000);
      await ctx.shot(L.page, 'pc_pala_negozio');

      await ctx.fulvioFinoA(L.page, 'compra');
      await L.page.locator('#mzNegozio [data-act="compra"]').click();
      await ctx.waitState(L.page, (s) => s.pala && s.pala.posseduta === true, 8000);
      const lotDopo = (await get('/api/lot', 'tokL')).body;
      assert(lotDopo.monete === monetePrima - 500, `monete dopo acquisto pala: ${lotDopo.monete} vs ${monetePrima - 500}`);
      assert(lotDopo.hero.inv.pala === 1, 'pala nello zaino');

      // Usciamo dal negozio passando per il corridoio e apriamo la Borsa (menù AVATAR): la pala sta tra gli Strumenti, non nello zaino
      const { uscita } = (await L.st()).negozio;
      await L.hook('teleport', uscita.x, uscita.z);
      await cammina(L.page, ['ArrowDown'], (s) => !s.negozio.dentro && s.arch.place === 'porto', 20000);
      await L.page.waitForFunction(() => !window.__game.state().velo.attivo, null, { timeout: 5000 });

      await L.page.evaluate(() => document.getElementById('mzBorsaBtn')?.click());
      await L.page.locator('#mzBorsa.on [data-tab="strumenti"]').waitFor({ state: 'visible', timeout: 8000 });
      await L.page.locator('#mzBorsa [data-tab="strumenti"]').click();
      const testoBorsa = (await L.page.locator('#mzBorsa').textContent()) ?? '';
      assert(testoBorsa.includes('Pala'), 'Borsa, Strumenti: ' + testoBorsa);
      await ctx.shot(L.page, 'pc_pala_borsa');
      await L.page.keyboard.press('Escape');
    });

    await ctx.test('2. Scavare una buca aperta in Borgo Marea e chiuderla: il terreno torna normale', async () => {
      const L = globalThis.__luca;
      const cell = [...scavabili[0]];
      const w = await L.hook('palaCellWorld', cell);
      await L.hook('teleport', w.x, w.z);
      await L.page.waitForTimeout(300);

      const rScava = await L.hook('palaScava', cell);
      assert(rScava && rScava.esito === 'aperta', 'scavo buca aperta: ' + JSON.stringify(rScava));
      await ctx.waitState(L.page, (s, c) => s.pala.buche.some((b) => b.cell[0] === c[0] && b.cell[1] === c[1] && b.stato === 'aperta'), 5000, cell);
      await ctx.shot(L.page, 'pc_buca_aperta');

      // Avvicinandosi alla buca aperta si apre il foglio (Chiudi la buca / Seppellisci)
      await L.hook('palaApriBuca', cell);
      await ctx.waitState(L.page, (s) => s.pala.sheetOpen === true, 3000);
      await ctx.shot(L.page, 'pc_pala_sheet');

      // Scegliamo di chiudere la buca: il terreno torna normale
      await L.page.locator('#mzPalaSheet [data-act="chiudi-buca"]').click();
      await ctx.waitState(L.page, (s, c) => !s.pala.buche.some((b) => b.cell[0] === c[0] && b.cell[1] === c[1]), 5000, cell);
    });

    await ctx.test('3. Seppellire oggetto dello zaino, mobile non posato e monete → croce nel terreno; un altro player li scava fuori', async () => {
      const L = globalThis.__luca;
      const cOggetto = [...scavabili[1]], cMobile = [...scavabili[2]], cMonete = [...scavabili[3]];

      // Luca scava 3 buche e seppellisce: 1 pozione_vita_minore, 1 mobileProva, 135 monete
      assert((await L.hook('palaScava', cOggetto))?.esito === 'aperta', 'scava buca oggetto');
      assert((await L.hook('palaSeppellisci', { tipo: 'oggetto', id: 'pozione_vita_minore', n: 1 }, cOggetto)) === true, 'seppellisci oggetto');

      assert((await L.hook('palaScava', cMobile))?.esito === 'aperta', 'scava buca mobile');
      assert((await L.hook('palaSeppellisci', { tipo: 'mobile', id: mobileProva.id, n: 1 }, cMobile)) === true, 'seppellisci mobile');

      assert((await L.hook('palaScava', cMonete))?.esito === 'aperta', 'scava buca monete');
      assert((await L.hook('palaSeppellisci', { tipo: 'monete', monete: 135 }, cMonete)) === true, 'seppellisci monete');

      const sL = await L.st();
      for (const c of [cOggetto, cMobile, cMonete]) {
        assert(sL.pala.buche.some((b) => b.cell[0] === c[0] && b.cell[1] === c[1] && b.stato === 'seppellita'), 'croce seppellita in ' + c.join(','));
      }
      const wCroce = await L.hook('palaCellWorld', cOggetto);
      await L.hook('teleport', wCroce.x, wCroce.z + 1.2);
      await L.page.waitForTimeout(300);
      await ctx.shot(L.page, 'pc_buca_croce');

      // Ada compra la pala e scava fuori tutte e 3 le croci lasciate da Luca
      assert((await post('/api/lot/casa/pala', {}, 'tokA')).status === 200, 'Ada compra la pala');
      const A = await open(ctx.B.DESKTOP, 'tokA');
      globalThis.__ada = A;
      await A.hook('palaRefresh');
      await ctx.waitState(A.page, (s) => s.pala.buche.length >= 3, 5000);

      const lotAdaPrima = (await get('/api/lot', 'tokA')).body;
      const pozPrima = lotAdaPrima.hero.inv.pozione_vita_minore ?? 0;
      const mobPrima = lotAdaPrima.casa?.magazzino?.[mobileProva.id] ?? 0;
      const monPrima = lotAdaPrima.monete;

      const r1 = await A.hook('palaScava', cOggetto);
      assert(r1 && r1.esito === 'trovato', 'Ada dissotterra oggetto: ' + JSON.stringify(r1));
      const r2 = await A.hook('palaScava', cMobile);
      assert(r2 && r2.esito === 'trovato', 'Ada dissotterra mobile: ' + JSON.stringify(r2));
      const r3 = await A.hook('palaScava', cMonete);
      assert(r3 && r3.esito === 'trovato', 'Ada dissotterra monete: ' + JSON.stringify(r3));

      const lotAdaDopo = (await get('/api/lot', 'tokA')).body;
      assert((lotAdaDopo.hero.inv.pozione_vita_minore ?? 0) === pozPrima + 1, 'Ada ha ricevuto la pozione nello zaino');
      assert((lotAdaDopo.casa?.magazzino?.[mobileProva.id] ?? 0) === mobPrima + 1, 'Ada ha ricevuto il mobile nel magazzino di casa');
      assert(lotAdaDopo.monete === monPrima + 135, `Ada ha ricevuto 135 monete (${lotAdaDopo.monete} vs ${monPrima + 135})`);
    });

    await ctx.test('4. Bottino giornaliero (10–200 monete): Luca lo scava e per lui sparisce, ma per Ada c’è ancora a disposizione', async () => {
      const L = globalThis.__luca, A = globalThis.__ada;
      const sL0 = await L.st(), sA0 = await A.st();
      const bL = sL0.pala.bottino, bA = sA0.pala.bottino;
      assert(bL.visibile && bA.visibile, 'bottino giornaliero visibile per entrambi all’inizio');
      assert(bL.cell[0] === bA.cell[0] && bL.cell[1] === bA.cell[1], 'stessa cella del bottino giornaliero');
      assert(bL.monete >= 10 && bL.monete <= 200, `monete bottino fuori intervallo 10..200: ${bL.monete}`);

      const monLuca0 = (await get('/api/lot', 'tokL')).body.monete;
      const rLuca = await L.hook('palaScava', bL.cell);
      assert(rLuca && rLuca.esito === 'bottino' && rLuca.monete === bL.monete, 'Luca scava il bottino: ' + JSON.stringify(rLuca));
      const monLuca1 = (await get('/api/lot', 'tokL')).body.monete;
      assert(monLuca1 === monLuca0 + bL.monete, 'monete accreditate a Luca');

      const sL1 = await L.st();
      assert(sL1.pala.bottino.visibile === false, 'il bottino è sparito per Luca');

      // Per Ada il bottino è ancora visibile e scavabile!
      await A.hook('palaRefresh');
      const sA1 = await A.st();
      assert(sA1.pala.bottino.visibile === true, 'il bottino è ancora visibile per Ada');
      const monAda0 = (await get('/api/lot', 'tokA')).body.monete;
      const rAda = await A.hook('palaScava', bA.cell);
      assert(rAda && rAda.esito === 'bottino' && rAda.monete === bA.monete, 'Ada scava il bottino: ' + JSON.stringify(rAda));
      const monAda1 = (await get('/api/lot', 'tokA')).body.monete;
      assert(monAda1 === monAda0 + bA.monete, 'monete accreditate ad Ada');
      const sA2 = await A.st();
      assert(sA2.pala.bottino.visibile === false, 'ora il bottino è sparito anche per Ada');
      for (const p of pages) ctx.noErrors(p, 'm3_pala');
    });
  } finally {
    for (const p of pages) await p.close().catch(() => {});
    if (dev?.pid) { try { process.kill(-dev.pid, 'SIGKILL'); } catch { try { dev.kill('SIGKILL'); } catch { /* già morto */ } } }
    await sleep(300);
    fs.rmSync(persist, { recursive: true, force: true });
    delete globalThis.__luca;
    delete globalThis.__ada;
  }
}
