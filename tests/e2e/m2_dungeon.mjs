// M2-dungeon (R-scena, CONTRACTS §15): ingressi nel mondo (coincidono con DUNGEONS), discesa con l'hook enterDungeon, scena, HUD,
// controlli, autopilot fino all'uscita, esito DEL SERVER e bottino nel lotto (/api/lot); uscita con Esc che NON chiama finish (la
// spedizione resta aperta sul server); altare: salvataggio sul server, Esc tiene il bottino dell'altare («SEI RISALITO»); i 4 bottoni
// sul telefono non si sovrappongono; draw call ≤ 100 e triangoli ≤ 150k nel dungeon.
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

  await ctx.test('gli ingressi in game/ingressi.ts coincidono con DUNGEONS (isola, cella, stile, nome, difficoltà)', async () => {
    const src = fs.readFileSync(path.join(ctx.ROOT, 'apps/client/src/game/ingressi.ts'), 'utf8');
    const rows = [...src.matchAll(/\{ id: '(\w+)', nome: '([^']+)', island: '(\w+)', at: \[(\d+), (\d+)\], stile: '(\w+)', difficolta: (\d+) \}/g)].map((m) => ({ id: m[1], nome: m[2], island: m[3], at: [Number(m[4]), Number(m[5])], stile: m[6], difficolta: Number(m[7]) }));
    assert(rows.length === DUNGEONS.length, `ingressi.ts ha ${rows.length} ingressi, DUNGEONS ${DUNGEONS.length}`);
    for (const d of DUNGEONS) {
      const r = rows.find((x) => x.id === d.id);
      assert(r, `manca l'ingresso di ${d.id} in game/ingressi.ts`);
      assert(r.island === d.ingresso.island && r.at[0] === d.ingresso.at[0] && r.at[1] === d.ingresso.at[1] && r.stile === d.stile && r.nome === d.nome && r.difficolta === d.difficolta,
        `${d.id}: ingressi.ts ${JSON.stringify(r)} ≠ dungeons.json ${JSON.stringify({ nome: d.nome, ...d.ingresso, stile: d.stile, difficolta: d.difficolta })}`);
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
    await ctx.waitReady(page, 30000);
    await ctx.waitState(page, (s) => s.lot && s.lot.ready === true && s.ingressi, 15000);
    const st = () => ctx.getState(page);
    const hook = (n, ...a) => page.evaluate(([n, a]) => window.__game.test[n](...a), [n, a]);
    const perfMax = { drawCalls: 0, triangles: 0, samples: 0 };
    const samplePerf = async (n = 4) => { for (let i = 0; i < n; i++) { const p = await ctx.getPerf(page); perfMax.drawCalls = Math.max(perfMax.drawCalls, p.drawCalls); perfMax.triangles = Math.max(perfMax.triangles, p.triangles); perfMax.samples++; await sleep(250); } };

    await ctx.test('nel mondo: tre ingressi dove dice DUNGEONS; in bussola solo il più facile (la Grotta); vicino compare ENTRA', async () => {
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

    await ctx.test('Cripta: si entra, scena e HUD, Q lancia la magia; Esc → «Uscire?» → ESCI: finish NON parte, la spedizione resta aperta', async () => {
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
      await page.waitForSelector('#mzDngAsk.on', { timeout: 3000 });
      const t0 = (await st()).dungeon.tick; await sleep(400);
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
        assert(has >= had + n, `${id}: prima ${had}, tenuto ${n}, adesso ${has}`);
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
      await page.keyboard.press('Escape'); await page.locator('#mzDngAsk [data-act="esci"]').click();
      await ctx.waitState(page, (s) => s.ingressi.aborts === 2 && !s.dungeon.active, 8000);
    });

    await ctx.test('Grotta: fino all’altare (salvato sul server), Esc → «tieni il bottino dell’ultimo altare» → SEI RISALITO, spedizione chiusa', async () => {
      // l'altare più vicino alla scala: ci si arriva camminando (hook dungeonAltare, input registrati come quelli veri)
      const m = parseDungeon(DUNGEONS.find((d) => d.id === 'grotta')), dist = bfs(m, m.exit.cz * m.w + m.exit.cx);
      const n = m.altari.map((a, i) => [dist[a.cz * m.w + a.cx], i]).sort((a, b) => a[0] - b[0])[0][1];
      await hook('enterDungeon', 'grotta');
      await ctx.waitState(page, (s) => s.dungeon.active && s.dungeon.phase === 'play', 30000);
      await hook('dungeonAltare', n);
      await ctx.waitState(page, (s) => !!s.dungeon.salvato && s.ingressi.salvataggi >= 1, 120000);
      const s0 = await st();
      assert(s0.dungeon.altari.filter((a) => a.attivo).length === 1 && s0.dungeon.scene.altareAcceso === n, 'altare acceso: ' + JSON.stringify(s0.dungeon.altari));
      const lot = await getLot('tokA');
      assert(lot.dungeon?.pending?.salvataggio?.ticks > 0, 'salvataggio non arrivato al server: ' + JSON.stringify(lot.dungeon?.pending?.salvataggio ?? null));
      await sleep(300); await samplePerf();
      await ctx.shot(page, '6_altare_1280');
      await page.keyboard.press('Escape');
      await page.waitForSelector('#mzDngAsk.on', { timeout: 3000 });
      assert(/altare/.test(await page.locator('#mzDngAsk').innerText()), 'la domanda d’uscita non dice che si tiene il bottino dell’altare');
      await page.locator('#mzDngAsk [data-act="esci"]').click();
      await ctx.waitState(page, (s) => s.dungeonEsito && s.dungeonEsito.open, 15000);
      const s = await st();
      assert(s.ingressi.finishes === 2 && s.ingressi.aborts === 2 && s.dungeonEsito.outcome === 'risalito' && /RISALITO/.test(s.dungeonEsito.text), 'esito: ' + JSON.stringify({ i: s.ingressi, e: s.dungeonEsito?.outcome }));
      assert(!(await getLot('tokA')).dungeon?.pending, 'la spedizione resta aperta dopo l’uscita con l’altare');
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
    await ctx.test('telefono: dentro la Grotta i 4 bottoni (A B C D) e l\'HUD non si sovrappongono, ≥ 56 px', async () => {
      await thook('dungeonAutopilot', true, 1);
      await tp.locator('#mzDngEntra').click();
      await ctx.waitState(tp, (s) => s.dungeon.active && s.dungeon.phase === 'play', 30000);
      await ctx.waitState(tp, (s) => s.dungeon.vivi < s.dungeon.nemici || ['attacca', 'carica'].includes(s.dungeon.hero.anim), 90000);
      const rects = await tp.evaluate(() => Object.fromEntries(['btnA', 'btnB', 'btnC', 'btnD', 'joystick', 'mzDngHud', 'mzDngQuit'].map((id) => { const r = document.getElementById(id)?.getBoundingClientRect(); return [id, r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null]; })));
      const ids = Object.keys(rects);
      for (const id of ids) assert(rects[id], `manca #${id}`);
      for (const id of ['btnA', 'btnB', 'btnC', 'btnD']) assert(rects[id].w >= 56 && rects[id].h >= 56, `#${id} troppo piccolo: ${JSON.stringify(rects[id])}`);
      const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) assert(!hit(rects[ids[i]], rects[ids[j]]), `#${ids[i]} copre #${ids[j]}: ${JSON.stringify([rects[ids[i]], rects[ids[j]]])}`);
      for (const id of ids) { const r = rects[id]; assert(r.x >= 0 && r.y >= 0 && r.x + r.w <= 390 && r.y + r.h <= 844, `#${id} fuori schermo`); }
    });
    await ctx.shot(tp, '2_grotta_390');
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
