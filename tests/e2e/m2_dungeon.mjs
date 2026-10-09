// M2-dungeon (R-scena, CONTRACTS §15): ingressi nel mondo (coincidono con DUNGEONS), discesa con l'hook enterDungeon, scena, HUD,
// controlli, autopilot fino all'uscita, esito DEL SERVER e bottino nel lotto (/api/lot); Esc = Pausa (partita ferma) → Esci → «Uscire?»
// che NON chiama finish (la spedizione resta aperta sul server); lanterna: SALVA (sul server), Esci tiene il bottino salvato («SEI RISALITO»);
// zaino nel dungeon (cambio d'arma, Butta via, partita in pausa), ESCI dalla lanterna e ripartenza da lì; i bottoni sul telefono non si
// sovrappongono (anche la lanterna); draw call ≤ 100 e triangoli ≤ 150k nel dungeon. Impianto di Drenaggio (#142): si entra, acqua e
// valvole disegnate, l'autopilota gira una valvola e l'acqua scende; lore (RPG.md §2c): scritta col nome, voci dell'altoparlante (una
// volta sola), LEGGI accanto al registro che un tocco al volo non apre e L tenuto sì (dungeon fermo), Esc chiude senza Pausa.
// Screenshot a 1280×720 e 390×844 in tests/out/shots/m2_dungeon_*.png. Persone vere su wrangler dev locale (come m1_solo).
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
  const imp = (f) => import(pathToFileURL(path.join(ctx.ROOT, f)).href);
  const { DUNGEONS } = await imp('packages/content/src/rpg.ts');
  const { ARCHIPELAGO, ISLANDS } = await imp('packages/content/src/index.ts');
  const { composeArchipelago } = await imp('packages/sim/src/index.ts');
  const { bfs, parseDungeon } = await imp('packages/sim/src/dungeon/map.ts');

  await ctx.test('gli ingressi in game/ingressi.ts coincidono con DUNGEONS (isola, cella, stile, nome, difficoltà, porta sigillata)', async () => {
    const src = fs.readFileSync(path.join(ctx.ROOT, 'apps/client/src/game/ingressi.ts'), 'utf8');
    const rows = [...src.matchAll(/\{ id: '(\w+)', nome: '([^']+)', island: '(\w+)', at: \[(\d+), (\d+)\], stile: '(\w+)', difficolta: (\d+)(?:, richiede: '(\w+)')? \}/g)].map((m) => ({ id: m[1], nome: m[2], island: m[3], at: [Number(m[4]), Number(m[5])], stile: m[6], difficolta: Number(m[7]), richiede: m[8] }));
    assert(rows.length === DUNGEONS.length, `ingressi.ts ha ${rows.length} ingressi, DUNGEONS ${DUNGEONS.length}`);
    for (const d of DUNGEONS) {
      const r = rows.find((x) => x.id === d.id);
      assert(r, `manca l'ingresso di ${d.id} in game/ingressi.ts`);
      assert(r.island === d.ingresso.island && r.at[0] === d.ingresso.at[0] && r.at[1] === d.ingresso.at[1] && r.stile === d.stile && r.nome === d.nome && r.difficolta === d.difficolta && r.richiede === d.richiede,
        `${d.id}: ingressi.ts ${JSON.stringify(r)} ≠ dungeons.json ${JSON.stringify({ nome: d.nome, ...d.ingresso, stile: d.stile, difficolta: d.difficolta, richiede: d.richiede })}`);
    }
  });

  const persist = path.join(ctx.OUT, `m2dungeon-${process.pid}`);
  const env = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' };
  const wr = (...a) => execFileSync('npx', ['--no-install', 'wrangler', ...a], { cwd: SERVER, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 }).toString();
  let dev = null, log = '';
  try {
    fs.rmSync(persist, { recursive: true, force: true });
    wr('d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', persist);
    wr('d1', 'execute', 'DB', '--local', '--persist-to', persist, '--command', "INSERT INTO persone (id, nome, token, slot) VALUES ('ada', 'Ada', 'tokA', 0), ('bea', 'Bea', 'tokB', 1);");
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
    const perfMax = { drawCalls: 0, triangles: 0, samples: 0 };
    const samplePerf = async (n = 4) => { for (let i = 0; i < n; i++) { const p = await ctx.getPerf(page); perfMax.drawCalls = Math.max(perfMax.drawCalls, p.drawCalls); perfMax.triangles = Math.max(perfMax.triangles, p.triangles); perfMax.samples++; await sleep(250); } };

    await ctx.test('nel mondo: gli ingressi dove dice DUNGEONS; in bussola solo il più facile (la Grotta); vicino compare ENTRA', async () => {
      const arch = composeArchipelago(ARCHIPELAGO, ISLANDS), s = await st();
      for (const d of DUNGEONS) {
        const p = arch.places.find((q) => q.island === d.ingresso.island);
        const want = { x: (p.origin[0] + d.ingresso.at[0] + 0.5) * arch.tile, z: (p.origin[1] + d.ingresso.at[1] + 0.5) * arch.tile };
        const got = s.ingressi.spots.find((x) => x.id === d.id);
        assert(got && Math.abs(got.x - want.x) < 1e-6 && Math.abs(got.z - want.z) < 1e-6, `${d.id}: ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`);
      }
      // eroe nuovo: nessun dungeon completato → la bussola mostra solo quello con la difficoltà più bassa
      const easiest = [...DUNGEONS].sort((a, b) => a.difficolta - b.difficolta)[0].id;
      assert(s.ingressi.next === easiest, `prossimo dungeon ${s.ingressi.next}, atteso ${easiest}`);
      const shown = await page.evaluate(() => [...document.querySelectorAll('#compass [data-id]')].filter((r) => getComputedStyle(r).display !== 'none').map((r) => r.dataset.id));
      const dng = shown.filter((id) => DUNGEONS.some((d) => d.id === id));
      assert(dng.length === 1 && dng[0] === easiest, 'bussola: ' + shown.join(','));
      const g = s.ingressi.spots.find((x) => x.id === 'grotta');
      await hook('teleport', g.x, g.z + 3); await sleep(900);
      await ctx.waitState(page, (s) => s.ingressi.near === 'grotta', 5000);
      await page.waitForSelector('#mzDngEntra.on', { timeout: 3000 });
    });
    await ctx.shot(page, '1_ingresso_1280');

    await ctx.test('Archivio, Fucina e Mausoleo (Epopea 2, 3 e 4): porte sigillate finché non completi il dungeon di prima (niente ENTRA né AFFRONTA INSIEME); il server rifiuta', async () => {
      const s = await st();
      assert(s.ingressi.sigillati.includes('archivio') && s.ingressi.sigillati.includes('fucina') && s.ingressi.sigillati.includes('mausoleo') && !s.ingressi.sigillati.includes('drenaggio'), 'sigillati: ' + JSON.stringify(s.ingressi.sigillati));
      const a = s.ingressi.spots.find((x) => x.id === 'archivio');
      await hook('teleport', a.x, a.z + 3); await sleep(900);
      await ctx.waitState(page, (s) => s.ingressi.near === 'archivio', 5000);
      await page.waitForSelector('#mzDngEntra.on.sig', { timeout: 3000 });
      assert(!(await page.locator('#mzDngInsieme.on').count()), 'AFFRONTA INSIEME su una porta sigillata');
      await ctx.shot(page, '1b_archivio_sigillato_1280');
      await hook('enterDungeon', 'archivio');
      await ctx.waitState(page, (s) => /Sigillato/.test(s.ingressi.lastErr ?? ''), 3000);
      assert(!(await st()).dungeon.active, 'entrato in un dungeon sigillato');
      const r = await fetch(base + '/api/dungeon/start', { method: 'POST', headers: { 'x-token': 'tokA', 'content-type': 'application/json' }, body: JSON.stringify({ dungeon: 'archivio' }) });
      const b = await r.json();
      assert(!r.ok && /sigillata/.test(b.error ?? ''), `il server non rifiuta: ${r.status} ${JSON.stringify(b)}`);
      const r3 = await fetch(base + '/api/dungeon/start', { method: 'POST', headers: { 'x-token': 'tokA', 'content-type': 'application/json' }, body: JSON.stringify({ dungeon: 'fucina' }) });
      assert(!r3.ok && /Archivio/.test((await r3.json()).error ?? ''), 'la Fucina si apre senza l’Archivio');
      const r4 = await fetch(base + '/api/dungeon/start', { method: 'POST', headers: { 'x-token': 'tokA', 'content-type': 'application/json' }, body: JSON.stringify({ dungeon: 'mausoleo' }) });
      assert(!r4.ok && /Fucina/.test((await r4.json()).error ?? ''), 'il Mausoleo si apre senza la Fucina');
    });

    await ctx.test('Cripta: si entra, scena e HUD, Q lancia la magia; Esc → Pausa (ferma) → Esci → «Uscire?» → ESCI: finish NON parte, la spedizione resta aperta', async () => {
      await hook('enterDungeon', 'cripta');
      await ctx.waitState(page, (s) => s.dungeon.active && s.dungeon.phase === 'play', 30000);
      await page.waitForSelector('#mzDngHud', { timeout: 3000 });
      await page.waitForFunction(() => document.body.classList.contains('mz-sotto'), null, { timeout: 3000 }).catch(() => { throw new Error('body.mz-sotto assente'); });
      assert(!(await page.locator('#compass').isVisible()), 'la bussola si vede nel dungeon');
      await sleep(1200); await samplePerf();
      const m0 = (await st()).dungeon.hero.magicka;
      await page.keyboard.press('q'); // Q = C: la magia preparata (Fiammata) costa Magicka
      await ctx.waitState(page, (s, m) => s.dungeon.hero.magicka < m, 3000, m0);
      await sleep(150);
      await ctx.shot(page, '3_cripta_1280');
      await page.keyboard.press('Escape');
      await page.waitForSelector('#mzDngPausa.on', { timeout: 3000 });
      const t0 = (await st()).dungeon.tick; await sleep(400);
      assert((await st()).dungeon.tick === t0 && (await st()).dungeon.paused, 'in pausa la partita deve stare ferma');
      await ctx.shot(page, '3b_pausa_1280');
      await page.locator('#mzDngPausa [data-act="esci-menu"]').click();
      await page.waitForSelector('#mzDngAsk.on', { timeout: 3000 });
      assert((await st()).dungeon.tick === t0, 'con la domanda aperta la partita deve stare ferma');
      await page.locator('#mzDngAsk [data-act="esci"]').click();
      await ctx.waitState(page, (s) => s.ingressi.aborts === 1 && !s.dungeon.active && !s.ingressi.busy, 8000);
      const s = await st();
      assert(s.ingressi.finishes === 0, 'finish chiamato dopo Esc');
      const lot = await getLot('tokA');
      assert(lot.dungeon?.pending?.dungeon === 'cripta', 'la spedizione dovrebbe restare aperta sul server: ' + JSON.stringify(lot.dungeon));
      // la classe la toglie main.ts al frame dopo l'uscita: sotto carico (suite completa) il frame può tardare
      const sotto = await page.waitForFunction(() => !document.body.classList.contains('mz-sotto'), null, { timeout: 5000 }).then(() => false, () => true);
      assert(!sotto, 'mz-sotto resta dopo l\'uscita');
    });

    let before = null;
    await ctx.test('Grotta: combattimento, poi autopilot fino alla scala; l\'esito del server arriva e il bottino è nel lotto', async () => {
      before = await getLot('tokA');
      await hook('dungeonAutopilot', true, 1);
      await hook('enterDungeon', 'grotta');
      await ctx.waitState(page, (s) => s.dungeon.active && s.dungeon.phase === 'play', 30000);
      // a velocità 1 finché non si combatte (un nemico ferito o morto), per lo screenshot
      await ctx.waitState(page, (s) => s.dungeon.vivi < s.dungeon.nemici || ['attacca', 'carica'].includes(s.dungeon.hero.anim), 90000);
      await sleep(300); await samplePerf();
      await ctx.shot(page, '2_grotta_combattimento_1280');
      await hook('dungeonAutopilot', true, 12);
      await ctx.waitState(page, (s) => s.dungeonEsito && s.dungeonEsito.open, 150000);
      const s = await st(), r = s.ingressi.lastResult;
      ctx.log(`esito ${r.outcome} · tenuto ${JSON.stringify(r.tenuto)} · monete ${r.monete} · hash server ${r.hash} client ${r.clientHash}`);
      assert(s.ingressi.finishes === 1 && r.outcome === 'uscito', 'esito: ' + JSON.stringify(r));
      assert(r.hash === r.clientHash, `hash del server ${r.hash} ≠ client ${r.clientHash}: il replay non coincide`);
      assert(/USCITO/.test(s.dungeonEsito.text), 'la scheda non dice USCITO');
      const after = await getLot('tokA');
      for (const [id, n] of Object.entries(r.tenuto)) {
        const had = (before.hero?.inv?.[id] ?? 0) + (before.forziere?.[id] ?? 0), has = (after.hero?.inv?.[id] ?? 0) + (after.forziere?.[id] ?? 0);
        // pozioni bevute e frecce tirate (usati) e armi rotte escono dallo zaino: il bottino si conta al netto di quelle
        const via = (r.usati?.[id] ?? 0) + (r.rotti?.[id] ?? 0);
        assert(has >= had + n - via, `${id}: prima ${had}, tenuto ${n}, usati ${via}, adesso ${has}`);
      }
      assert(Object.keys(r.tenuto).length > 0, 'l\'autopilot nella Grotta dovrebbe portare a casa qualcosa');
      assert((after.hero?.monete ?? 0) === (before.hero?.monete ?? 0) + r.monete, 'monete non arrivate');
      assert(!after.dungeon?.pending, 'spedizione ancora aperta dopo finish');
      // capo della Grotta ucciso (lo dice il server) = Grotta completata, e la bussola passa alla Cripta
      const fatta = (after.hero?.completati ?? []).includes('grotta');
      assert(fatta === !!r.capo, `capo ${r.capo}, completati ${JSON.stringify(after.hero?.completati)}`);
      await ctx.waitState(page, (s, c) => s.ingressi.next === (c ? 'cripta' : 'grotta'), 3000, fatta);
      ctx.log(`capo della Grotta ${fatta ? 'ucciso: prossimo dungeon la Cripta' : 'vivo: la bussola resta sulla Grotta'}`);
    });
    await ctx.shot(page, '5_esito_1280');
    await ctx.test('OK chiude la scheda e si torna all\'ingresso', async () => {
      await page.locator('#mzDngEsito [data-act="ok"]').click();
      await ctx.waitState(page, (s) => !s.dungeonEsito.open && !s.ingressi.busy && !s.dungeon.active, 5000);
      await hook('dungeonAutopilot', false);
    });

    await ctx.test('Vuoto: si entra e si vede; uscita con Esc', async () => {
      await hook('enterDungeon', 'vuoto');
      await ctx.waitState(page, (s) => s.dungeon.active && s.dungeon.phase === 'play', 30000);
      await sleep(1200); await samplePerf();
      await ctx.shot(page, '4_vuoto_1280');
      await page.keyboard.press('Escape');
      await page.waitForSelector('#mzDngPausa.on', { timeout: 3000 });
      await page.locator('#mzDngPausa [data-act="esci-menu"]').click();
      await page.waitForSelector('#mzDngAsk.on', { timeout: 3000 });
      await page.locator('#mzDngAsk [data-act="esci"]').click();
      await ctx.waitState(page, (s) => s.ingressi.aborts === 2 && !s.dungeon.active, 8000);
    });

    await ctx.test('Drenaggio: si entra (3 bacini pieni, 3 valvole); si cammina alla valvola, la si gira e l’acqua scende; uscita con Esc', async () => {
      await hook('enterDungeon', 'drenaggio');
      await ctx.waitState(page, (s) => s.dungeon.active && s.dungeon.phase === 'play', 30000);
      const d0 = (await st()).dungeon;
      assert(d0.acque.length === 3 && d0.acque.every((a) => a.livello === 1) && d0.valvole.length === 3 && d0.fx?.valvole === 3, 'drenaggio: ' + JSON.stringify({ acque: d0.acque, valvole: d0.valvole, fx: d0.fx }));
      assert(d0.testi?.titolo, 'drenaggio: scritta col nome ' + JSON.stringify(d0.testi));
      await sleep(1200); await samplePerf();
      await ctx.shot(page, '4b_drenaggio_1280');
      // si cammina dritti fino alla valvola 1 (sala delle pompe) e si preme il suo bottone: niente autopilota, che con l'eroe di partenza
      // arrivava alla valvola solo qualche volta su dieci (dipende dai nemici e dal seed); a piedi ci arriva sempre (sim: 60 seed su 60)
      const v1 = parseDungeon(DUNGEONS.find((d) => d.id === 'drenaggio')).valvole.find((v) => v.n === 1);
      await hook('dungeonVai', v1.cx, v1.cz);
      await ctx.waitState(page, (s) => s.dungeon.vicinoValvola || !s.dungeon.active, 150000);
      await page.waitForSelector('#mzDngValvola.on', { timeout: 5000 });
      await page.locator('#mzDngValvola').click();
      await ctx.waitState(page, (s) => s.dungeon.acque.some((a) => a.livello < 1), 5000);
      await sleep(600); await samplePerf(2);
      await ctx.shot(page, '4c_drenaggio_valvola_1280');
      // lore: dopo la scritta col nome ha parlato l'altoparlante dell'ingresso, poi quello della sala pompe (dove sta la valvola 1)
      await ctx.waitState(page, (s) => ['ingresso', 'pompe'].every((v) => s.dungeon.testi?.viste.includes('drenaggio:' + v)), 20000);
      await page.keyboard.press('Escape');
      await page.waitForSelector('#mzDngPausa.on', { timeout: 3000 });
      await page.locator('#mzDngPausa [data-act="esci-menu"]').click();
      await page.waitForSelector('#mzDngAsk.on', { timeout: 3000 });
      await page.locator('#mzDngAsk [data-act="esci"]').click();
      await ctx.waitState(page, (s) => s.ingressi.aborts === 3 && !s.dungeon.active, 8000);
    });

    await ctx.test('Drenaggio, lore: accanto al registro LEGGI; un tocco al volo non apre, L tenuto sì (dungeon fermo); Esc chiude senza Pausa', async () => {
      await hook('enterDungeon', 'drenaggio');
      await ctx.waitState(page, (s) => s.dungeon.active && s.dungeon.phase === 'play', 30000);
      assert((await st()).dungeon.testi?.viste.includes('drenaggio:ingresso'), 'la voce dell’ingresso si sente una volta sola');
      await hook('dungeonVai', 11, 27);
      await ctx.waitState(page, (s) => s.dungeon.testi?.vicino === 'registro', 30000);
      await page.waitForSelector('#mzDngLeggi.on', { timeout: 3000 });
      await page.locator('#mzDngLeggi').click();
      await sleep(400);
      assert((await st()).dungeon.testi.aperta === null, 'un tocco al volo non apre la lettura');
      await page.keyboard.down('KeyL');
      await ctx.waitState(page, (s) => s.dungeon.testi?.aperta === 'registro', 15000); // 0,8 s di dt: a pochi fps ci vuole di più
      await page.keyboard.up('KeyL');
      await page.waitForSelector('#mzDngLettura.on', { timeout: 3000 });
      const tk = (await st()).dungeon.tick;
      await sleep(500);
      assert((await st()).dungeon.tick === tk, 'da solo, mentre leggi il dungeon sta fermo');
      await ctx.shot(page, '4b_drenaggio_registro_1280');
      await page.keyboard.press('Escape');
      await ctx.waitState(page, (s) => s.dungeon.testi?.aperta === null && !s.dungeon.paused && s.dungeon.testi.lette.includes('drenaggio:registro'), 3000);
      await page.keyboard.press('Escape');
      await page.waitForSelector('#mzDngPausa.on', { timeout: 3000 });
      await page.locator('#mzDngPausa [data-act="esci-menu"]').click();
      await page.waitForSelector('#mzDngAsk.on', { timeout: 3000 });
      await page.locator('#mzDngAsk [data-act="esci"]').click();
      await ctx.waitState(page, (s) => s.ingressi.aborts === 4 && !s.dungeon.active, 8000);
    });

    const lanternaVicina = () => { const m = parseDungeon(DUNGEONS.find((d) => d.id === 'grotta')), dist = bfs(m, m.exit.cz * m.w + m.exit.cx); return m.altari.map((a, i) => [dist[a.cz * m.w + a.cx], i]).sort((a, b) => a[0] - b[0])[0][1]; };
    await ctx.test('Grotta: fino alla lanterna (non salva da sola), SALVA (sul server), Esci → «tieni il bottino salvato alla lanterna» → SEI RISALITO', async () => {
      // l'altare più vicino alla scala: ci si arriva camminando (hook dungeonAltare, input registrati come quelli veri)
      const m = parseDungeon(DUNGEONS.find((d) => d.id === 'grotta')), dist = bfs(m, m.exit.cz * m.w + m.exit.cx);
      const n = m.altari.map((a, i) => [dist[a.cz * m.w + a.cx], i]).sort((a, b) => a[0] - b[0])[0][1];
      await hook('enterDungeon', 'grotta');
      await ctx.waitState(page, (s) => s.dungeon.active && s.dungeon.phase === 'play', 30000);
      await hook('dungeonAltare', n);
      await ctx.waitState(page, (s, n) => s.dungeon.lanterna === n, 120000, n);
      await page.waitForSelector('#mzDngLanterna.on', { timeout: 3000 });
      assert(!(await st()).dungeon.salvato, 'passandoci sopra la lanterna non deve salvare da sola');
      await ctx.shot(page, '6a_lanterna_1280');
      await page.locator('#mzDngLanterna [data-act="salva"]').click();
      await ctx.waitState(page, (s) => !!s.dungeon.salvato && s.dungeon.salvatoQui && s.ingressi.salvataggi >= 1, 15000);
      assert(/SALVATO/.test(await page.locator('#mzDngBig').innerText()), 'manca la scritta SALVATO');
      assert(/SALVATO/.test(await page.locator('#mzDngLanterna [data-act="salva"]').innerText()), 'il bottone non dice SALVATO');
      const s0 = await st();
      assert(s0.dungeon.altari.filter((a) => a.attivo).length === 1 && s0.dungeon.scene.altareAcceso === n, 'altare acceso: ' + JSON.stringify(s0.dungeon.altari));
      const lot = await getLot('tokA');
      assert(lot.dungeon?.pending?.salvataggio?.ticks > 0, 'salvataggio non arrivato al server: ' + JSON.stringify(lot.dungeon?.pending?.salvataggio ?? null));
      await sleep(300); await samplePerf();
      await ctx.shot(page, '6_altare_1280');
      await page.keyboard.press('Escape');
      await page.waitForSelector('#mzDngPausa.on', { timeout: 3000 });
      await page.locator('#mzDngPausa [data-act="esci-menu"]').click();
      await page.waitForSelector('#mzDngAsk.on', { timeout: 3000 });
      assert(/lanterna/.test(await page.locator('#mzDngAsk').innerText()), 'la domanda d’uscita non dice che si tiene il bottino della lanterna');
      await page.locator('#mzDngAsk [data-act="esci"]').click();
      await ctx.waitState(page, (s) => s.dungeonEsito && s.dungeonEsito.open, 15000);
      const s = await st();
      assert(s.ingressi.finishes === 2 && s.ingressi.aborts === 4 && s.dungeonEsito.outcome === 'risalito' && /RISALITO/.test(s.dungeonEsito.text), 'esito: ' + JSON.stringify({ i: s.ingressi, e: s.dungeonEsito?.outcome }));
      assert(!(await getLot('tokA')).dungeon?.pending, 'la spedizione resta aperta dopo l’uscita con l’altare');
      await page.locator('#mzDngEsito [data-act="ok"]').click();
      await ctx.waitState(page, (s) => !s.dungeonEsito.open && !s.ingressi.busy && !s.dungeon.active, 5000);
    });

    await ctx.test('Grotta: ZAINO nel dungeon (partita ferma): arco in mano, Butta via una freccia; ESCI dalla lanterna → arco e lanterna sul server', async () => {
      const n = lanternaVicina();
      await hook('enterDungeon', 'grotta');
      await ctx.waitState(page, (s) => s.dungeon.active && s.dungeon.phase === 'play', 30000);
      await page.locator('#mzDngZaino').click();
      await page.waitForSelector('#mzEroe.on.sotto', { state: 'visible', timeout: 5000 });
      await ctx.waitState(page, (s) => s.eroe.sotto && s.eroe.tab === 'zaino' && s.dungeon.pannello, 3000);
      const t0 = (await st()).dungeon.tick; await sleep(400);
      assert((await st()).dungeon.tick === t0, 'con lo zaino aperto la partita deve stare ferma');
      const click = async (sel) => { const l = page.locator(sel).first(); await l.scrollIntoViewIfNeeded(); await l.click(); };
      await click('#mzEroe [data-item="arco_legno"]');
      await click('#mzEroe [data-det="arco_legno"] [data-act="equipaggia"]');
      await ctx.waitState(page, (s) => s.dungeon.hero.arma === 'arco_legno' && s.dungeon.azioni === 1, 3000);
      const f0 = (await st()).dungeon.hero.frecce, inv0 = (await getLot('tokA')).hero.inv.frecce_legno;
      await click('#mzEroe [data-item="frecce_legno"]');
      await click('#mzEroe [data-det="frecce_legno"] [data-act="butta"]');
      await ctx.shot(page, '7_zaino_dungeon_1280');
      await click('#mzEroe [data-det="frecce_legno"] [data-act="butta-sicuro"]');
      await ctx.waitState(page, (s, f) => s.dungeon.hero.frecce === f - 1 && s.dungeon.azioni === 2, 3000, f0);
      await page.keyboard.press('KeyI');
      await ctx.waitState(page, (s) => !s.eroe.open && !s.dungeon.paused, 3000);
      await hook('dungeonAltare', n);
      await ctx.waitState(page, (s, n) => s.dungeon.lanterna === n, 120000, n);
      await page.waitForSelector('#mzDngLanterna.on', { timeout: 3000 });
      await page.locator('#mzDngLanterna [data-act="esci-lanterna"]').click();
      await ctx.waitState(page, (s) => s.dungeonEsito && s.dungeonEsito.open, 15000);
      const s = await st();
      assert(s.dungeonEsito.outcome === 'uscito' && /lanterna/.test(s.dungeonEsito.text), 'esito: ' + JSON.stringify(s.dungeonEsito));
      await ctx.shot(page, '8_esito_lanterna_1280');
      const lot = await getLot('tokA');
      assert(lot.hero?.lanterne?.grotta === n, 'lanterna non ricordata: ' + JSON.stringify(lot.hero?.lanterne));
      assert(lot.hero?.equip?.arma === 'arco_legno', 'arco non rimasto in mano: ' + JSON.stringify(lot.hero?.equip));
      assert(lot.hero?.inv?.frecce_legno === inv0 - 1, `freccia buttata non tolta: ${inv0} → ${lot.hero?.inv?.frecce_legno}`);
      assert(s.ingressi.lastResult.hash === s.ingressi.lastResult.clientHash, 'replay con le azioni diverso dal client');
      await page.locator('#mzDngEsito [data-act="ok"]').click();
      await ctx.waitState(page, (s) => !s.dungeonEsito.open && !s.ingressi.busy && !s.dungeon.active, 5000);
    });

    await ctx.test('Grotta: rientrando «Da dove parti?» → DALLA LANTERNA: si parte sulla lanterna, già quella dei risvegli', async () => {
      const n = lanternaVicina();
      const g = (await st()).ingressi.spots.find((x) => x.id === 'grotta');
      await hook('teleport', g.x, g.z + 3); await sleep(600);
      await page.locator('#mzDngEntra').click();
      await page.waitForSelector('#mzDngDa', { timeout: 5000 });
      await ctx.shot(page, '9_da_dove_1280');
      await page.locator('#mzDngDa [data-act="lanterna"]').click();
      await ctx.waitState(page, (s) => s.dungeon.active && s.dungeon.phase === 'play', 30000);
      const s = await st();
      assert(s.dungeon.partenza === n && s.dungeon.lanterna === n && s.dungeon.salvato, 'partenza: ' + JSON.stringify({ p: s.dungeon.partenza, l: s.dungeon.lanterna, sv: s.dungeon.salvato }));
      assert((await getLot('tokA')).dungeon?.pending?.partenza === n, 'il server non sa della lanterna di partenza');
      await page.keyboard.press('Escape');
      await page.waitForSelector('#mzDngPausa.on', { timeout: 3000 });
      await page.locator('#mzDngPausa [data-act="esci-menu"]').click();
      await page.waitForSelector('#mzDngAsk.on', { timeout: 3000 });
      await page.locator('#mzDngAsk [data-act="esci"]').click();
      await ctx.waitState(page, (s) => s.dungeonEsito && s.dungeonEsito.open, 15000);
      await page.locator('#mzDngEsito [data-act="ok"]').click();
      await ctx.waitState(page, (s) => !s.dungeonEsito.open && !s.ingressi.busy && !s.dungeon.active, 5000);
    });

    await ctx.test(`prestazioni nel dungeon: draw call ≤ 100, triangoli ≤ 150k`, async () => {
      ctx.log(`dungeon: max ${perfMax.drawCalls} draw call, ${perfMax.triangles} triangoli su ${perfMax.samples} campioni`);
      assert(perfMax.samples > 0 && perfMax.drawCalls <= 100 && perfMax.triangles <= 150000, JSON.stringify(perfMax));
    });
    await ctx.test('nessun errore per Ada', async () => { ctx.noErrors(P, 'Ada'); });

    // ---- telefono ----
    const T = await ctx.B.openPage(ctx.browser, `${base}/?t=tokB&test=1`, { viewport: ctx.B.IPHONE }); ctx._pages.push(T);
    const tp = T.page;
    await ctx.waitReady(tp, 30000);
    await ctx.waitState(tp, (s) => s.lot && s.lot.ready === true && s.ingressi, 30000);
    const thook = (n, ...a) => tp.evaluate(([n, a]) => window.__game.test[n](...a), [n, a]);
    await ctx.test('telefono: ingresso nel mondo', async () => {
      const g = (await ctx.getState(tp)).ingressi.spots.find((x) => x.id === 'grotta');
      await thook('teleport', g.x, g.z + 3); await sleep(900);
      await tp.waitForSelector('#mzDngEntra.on', { timeout: 5000 });
    });
    await ctx.shot(tp, '1_ingresso_390');
    await ctx.test('telefono: dentro la Grotta i 4 bottoni (A B C D), l\'HUD, Zaino e Pausa non si sovrappongono, ≥ 56 px', async () => {
      await thook('dungeonAutopilot', true, 1);
      await tp.locator('#mzDngEntra').click();
      await ctx.waitState(tp, (s) => s.dungeon.active && s.dungeon.phase === 'play', 30000);
      await ctx.waitState(tp, (s) => s.dungeon.vivi < s.dungeon.nemici || ['attacca', 'carica'].includes(s.dungeon.hero.anim), 90000);
      const rects = await tp.evaluate(() => Object.fromEntries(['btnA', 'btnB', 'btnC', 'btnD', 'joystick', 'mzDngHud', 'mzDngZaino', 'mzDngPausaBtn'].map((id) => { const r = document.getElementById(id)?.getBoundingClientRect(); return [id, r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null]; })));
      const ids = Object.keys(rects);
      for (const id of ids) assert(rects[id], `manca #${id}`);
      for (const id of ['btnA', 'btnB', 'btnC', 'btnD']) assert(rects[id].w >= 56 && rects[id].h >= 56, `#${id} troppo piccolo: ${JSON.stringify(rects[id])}`);
      const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) assert(!hit(rects[ids[i]], rects[ids[j]]), `#${ids[i]} copre #${ids[j]}: ${JSON.stringify([rects[ids[i]], rects[ids[j]]])}`);
      for (const id of ids) { const r = rects[id]; assert(r.x >= 0 && r.y >= 0 && r.x + r.w <= 390 && r.y + r.h <= 844, `#${id} fuori schermo`); }
    });
    await ctx.shot(tp, '2_grotta_390');
    await ctx.test('telefono: zaino nel dungeon e lanterna (SALVA/ESCI dentro lo schermo, sopra i bottoni senza coprirli)', async () => {
      await thook('dungeonAutopilot', false);
      await tp.locator('#mzDngZaino').click();
      await tp.waitForSelector('#mzEroe.on.sotto', { state: 'visible', timeout: 5000 });
      await ctx.shot(tp, '3_zaino_390');
      await tp.locator('#mzEroe [data-act="chiudi"]').click();
      await ctx.waitState(tp, (s) => !s.eroe.open, 3000);
      const m = parseDungeon(DUNGEONS.find((d) => d.id === 'grotta')), dist = bfs(m, m.exit.cz * m.w + m.exit.cx);
      const n = m.altari.map((a, i) => [dist[a.cz * m.w + a.cx], i]).sort((a, b) => a[0] - b[0])[0][1];
      await thook('dungeonAltare', n);
      await ctx.waitState(tp, (s, n) => s.dungeon.lanterna === n || !!s.dungeon.outcome, 120000, n);
      if ((await ctx.getState(tp)).dungeon.lanterna !== n) return; // caduto per strada (autopilot di prima): la lanterna si prova al desktop
      await tp.waitForSelector('#mzDngLanterna.on', { timeout: 3000 });
      const rects = await tp.evaluate(() => Object.fromEntries(['btnA', 'btnB', 'btnC', 'btnD', 'joystick', 'mzDngLanterna'].map((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [id, { x: r.x, y: r.y, w: r.width, h: r.height }]; })));
      const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      for (const id of ['btnA', 'btnB', 'btnC', 'btnD', 'joystick']) assert(!hit(rects.mzDngLanterna, rects[id]), `la lanterna copre #${id}`);
      const L = rects.mzDngLanterna; assert(L.x >= 0 && L.x + L.w <= 390 && L.y >= 0 && L.y + L.h <= 844, 'lanterna fuori schermo');
      await ctx.shot(tp, '4_lanterna_390');
    });
    await ctx.test('telefono: autopilot fino all\'esito', async () => {
      await thook('dungeonAutopilot', true, 12);
      await ctx.waitState(tp, (s) => s.dungeonEsito && s.dungeonEsito.open, 150000);
    });
    await ctx.shot(tp, '5_esito_390');
    await ctx.test('nessun errore per Bea', async () => { ctx.noErrors(T, 'Bea'); });
  } finally {
    if (dev) { try { process.kill(-dev.pid, 'SIGTERM'); } catch { /* già finito */ } await sleep(500); try { process.kill(-dev.pid, 'SIGKILL'); } catch { /* ok */ } }
    fs.rmSync(persist, { recursive: true, force: true });
    if (/dungeon hash diverso/.test(log)) console.log('    [m2_dungeon] il server ha registrato un hash diverso:\n' + log.split('\n').filter((l) => /hash diverso/.test(l)).join('\n'));
  }
}
