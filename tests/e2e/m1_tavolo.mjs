// M1 · Fetta 2, Tavolo delle Sfide (F2-test): due browser (Anna e Bruno) sul server locale. Anna crea la sfida con posta dal pannello e gioca
// (autopilot della sim), il server la mette aperta con scoreFrom; Bruno accetta e gioca, l'esito è coerente con la posta; una sfida rifiutata
// restituisce la posta; una posta che non c'è mostra l'errore in rosso. Orologio di test: header X-Test-Now-Offset (wrangler con TEST_CLOCK:1)
// aggiunto a ogni richiesta /api dei browser, così il Tavolo (5 min di lavori) è finito senza aspettare.
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
export const timeout = 120000;

const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MIN = 60_000;

export default async function (ctx) {
  const { assert } = ctx;
  const SERVER = path.join(ctx.ROOT, 'apps/server');
  const persist = path.join(ctx.OUT, `m1tavolo-${process.pid}`);
  const env = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' };
  const wr = (...a) => execFileSync('npx', ['--no-install', 'wrangler', ...a], { cwd: SERVER, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 }).toString();
  const sim = async (f) => import(pathToFileURL(path.join(ctx.ROOT, 'packages/sim/src', f)).href);
  const { regata, lazyAutopilot } = await sim('minigames/regata/regata.ts');
  const { packInputs, quantize } = await sim('replay.ts');
  const islands = JSON.parse(fs.readFileSync(path.join(ctx.ROOT, 'packages/content/src/islands.json'), 'utf8'));
  const tpl = islands.find((i) => i.id === 'lotto');
  const slotCells = tpl.rows.flatMap((row, z) => [...row].flatMap((c, x) => (c === 'L' ? [[x, z]] : [])));

  let dev = null, log = '', OFF = 0;
  const pages = [];
  try {
    fs.rmSync(persist, { recursive: true, force: true });
    wr('d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', persist);
    wr('d1', 'execute', 'DB', '--local', '--persist-to', persist, '--command',
      "INSERT INTO persone (id, nome, token, slot) VALUES ('anna', 'Anna', 'tokA', 1), ('bruno', 'Bruno', 'tokB', 2);");
    const port = await freePort(), inspector = await freePort();
    dev = spawn('npx', ['--no-install', 'wrangler', 'dev', '--local', '--ip', '127.0.0.1', '--port', String(port), '--inspector-port', String(inspector),
      '--assets', ctx.distDir, '--persist-to', persist, '--var', 'TEST_CLOCK:1', '--show-interactive-dev-session=false'], { cwd: SERVER, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    dev.stdout.on('data', (d) => (log += d)); dev.stderr.on('data', (d) => (log += d));
    const base = `http://127.0.0.1:${port}`;
    let up = false;
    for (let i = 0; i < 120 && !up; i++) { try { up = (await fetch(base + '/api/ping')).ok; } catch { /* non ancora */ } if (!up) await sleep(500); }
    if (!up) throw new Error('wrangler dev non risponde:\n' + log.split('\n').slice(-20).join('\n'));

    // ---- API diretta (per preparare e per controllare) ----
    const hdr = (t) => ({ 'x-token': t, 'content-type': 'application/json', 'x-test-now-offset': String(OFF) });
    const get = async (p, t) => { const r = await fetch(base + p, { headers: hdr(t) }); return { status: r.status, body: await r.json() }; };
    const post = async (p, t, b) => { const r = await fetch(base + p, { method: 'POST', headers: hdr(t), body: b === undefined ? undefined : JSON.stringify(b) }); return { status: r.status, body: await r.json() }; };
    const lot = async (t) => (await get('/api/lot', t)).body;
    const chall = async (t, id) => (await get('/api/challenges', t)).body.find((c) => c.id === id);
    const lazyInputs = (seed, difficulty) => {
      const s = regata.create({ seed, difficulty }), frames = [];
      while (!s.done) { const f = quantize(lazyAutopilot(s)); frames.push(f); regata.step(s, f); }
      return packInputs(frames);
    };

    // Tavolo costruito da entrambi e finito (orologio di test avanti di 10 minuti)
    for (const t of ['tokA', 'tokB']) {
      const r = await post('/api/lot/build', t, { building: 'tavolo', cell: slotCells[0] });
      assert(r.status === 200, `build tavolo ${t}: ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
    }
    OFF = 10 * MIN;
    const A0 = await lot('tokA'), B0 = await lot('tokB');
    ctx.log(`Anna prima: ${JSON.stringify(A0.resources)} · Bruno: ${JSON.stringify(B0.resources)} · tavolo ${A0.buildings.find((b) => b.building === 'tavolo')?.level}`);

    // ---- due browser, con l'orologio di test su ogni chiamata /api ----
    const open = async (token) => {
      const pg = await ctx.B.openPage(ctx.browser, `${base}/?t=${token}&test=1`, { viewport: ctx.B.DESKTOP });
      pages.push(pg); ctx._pages.push(pg);
      await pg.page.route('**/api/**', (route) => route.continue({ headers: { ...route.request().headers(), 'x-test-now-offset': String(OFF) } }));
      return pg;
    };
    const anna = await open('tokA'), bruno = await open('tokB');
    await Promise.all([ctx.waitReady(anna.page, 30000), ctx.waitReady(bruno.page, 30000)]);
    for (const pg of [anna, bruno]) {
      await ctx.waitState(pg.page, (s) => s.tavolo && s.tavolo.exists === true, 15000);
      await pg.page.evaluate(() => window.__game.test.regataAutopilot(20)); // le gare dal Tavolo le corre l'autopilot, 20 tick per frame
    }
    const nav = (pg, n) => pg.page.locator(`#mzTavolo [data-nav="${n}"]`);
    const panel = (pg, k, ms = 15000) => pg.page.waitForSelector(`#mzTavolo [data-panel="tavolo-${k}"]`, { timeout: ms });
    const panelText = (pg) => pg.page.evaluate(() => document.querySelector('#mzTavolo.on')?.innerText ?? '');
    const openTavolo = async (pg) => {
      await pg.page.evaluate(() => window.__game.test.openTavolo());
      await ctx.waitState(pg.page, (s) => s.tavolo.open === true, 5000);
      await panel(pg, 'home');
    };
    const closeTavolo = async (pg) => {
      await pg.page.keyboard.press('Escape');
      await ctx.waitState(pg.page, (s) => s.tavolo.open === false, 5000).catch(async () => { await pg.page.keyboard.press('Escape'); });
    };
    const ids = {};

    // 1) posta insufficiente: l'errore è rosso e il bottone «SFIDA E GIOCA» resta spento
    await ctx.test('posta insufficiente: nota rossa con «Ti mancano…», nessuna sfida parte', async () => {
      await openTavolo(anna);
      await nav(anna, 'nuova').click();
      await panel(anna, 'amici');
      await nav(anna, 'amico:bruno').click();
      await panel(anna, 'posta');
      // Anna ha Legno e Pietra a sufficienza (360/150): l'unica risorsa che non ha sono le Perle → posta 10 Legno + 5 Perle
      await anna.page.locator('#mzTavolo .mz-step[data-res="pietra"]').focus();
      for (let i = 0; i < 10; i++) await anna.page.keyboard.press('ArrowLeft'); // pietra 40 → 0
      await anna.page.locator('#mzTavolo .mz-step[data-res="perle"]').focus();
      await anna.page.keyboard.press('ArrowRight');
      await anna.page.waitForTimeout(250);
      ctx.log('posta: ' + (await panelText(anna)).replace(/\n/g, ' · ').slice(0, 300));
      const bads = anna.page.locator('#mzTavolo .mz-note.bad');
      assert(await bads.count() > 0, `nessuna nota rossa di errore. Anna ha ${JSON.stringify(A0.resources)}. Pannello: ${(await panelText(anna)).slice(0, 300)}`);
      const errTxt = await bads.first().innerText();
      const color = await bads.first().evaluate((e) => getComputedStyle(e).color);
      const [r, g, b] = color.match(/\d+/g).map(Number);
      ctx.log(`errore: «${errTxt}» colore ${color}`);
      assert(/manc/i.test(errTxt), 'testo errore: ' + errTxt);
      assert(r > 200 && g < 100 && b < 100, `errore non rosso: ${color}`);
      assert(await nav(anna, 'sfida').isDisabled(), 'SFIDA E GIOCA non è spento con la posta insufficiente');
      await ctx.shot(anna.page, 'posta_insufficiente_errore_rosso');
      const before = (await get('/api/challenges', 'tokA')).body.length;
      assert(before === 0, 'una sfida è stata creata con la posta insufficiente');
      await closeTavolo(anna);
    });

    // 2) Anna crea con posta, gioca; il server la mette aperta con scoreFrom
    const STAKE = 10;
    await ctx.test('Anna crea la sfida (posta 10 Legno) e gioca la Regata: server → aperta con scoreFrom', async () => {
      const beforeLot = await lot('tokA');
      await openTavolo(anna);
      await nav(anna, 'nuova').click();
      await panel(anna, 'amici');
      await nav(anna, 'amico:bruno').click();
      await panel(anna, 'posta');
      // la posta scelta prima resta nel pannello (10 Legno + 5 Perle): si riporta a 10 Legno
      await anna.page.locator('#mzTavolo .mz-step[data-res="perle"]').focus();
      await anna.page.keyboard.press('ArrowLeft');
      await anna.page.waitForTimeout(200);
      await ctx.shot(anna.page, 'anna_sceglie_la_posta');
      assert(!(await nav(anna, 'sfida').isDisabled()), 'SFIDA E GIOCA spento con posta valida: ' + (await panelText(anna)).slice(0, 200));
      await nav(anna, 'sfida').click();
      // la gara parte: pannello nascosto, regata attiva
      await ctx.waitState(anna.page, (s) => s.regata.active === true, 15000);
      await ctx.waitState(anna.page, (s) => s.tavolo.open === false, 5000);
      await ctx.waitState(anna.page, (s) => s.regata.phase === 'race', 15000);
      await anna.page.waitForTimeout(500);
      await ctx.shot(anna.page, 'anna_in_gara');
      await panel(anna, 'esito', 40000);
      const txt = await panelText(anna);
      ctx.log('esito Anna: ' + txt.replace(/\n/g, ' · ').slice(0, 250));
      await ctx.shot(anna.page, 'anna_esito_gara_registrata');
      const l = (await get('/api/challenges', 'tokA')).body;
      assert(l.length === 1, 'sfide di Anna: ' + l.length);
      const c = l[0]; ids.c1 = c.id;
      assert(c.state === 'aperta', 'stato dopo la gara di Anna: ' + c.state);
      assert(Number.isFinite(c.scoreFrom) && c.scoreFrom > 0, 'scoreFrom mancante: ' + c.scoreFrom);
      assert(c.stake.legno === STAKE && c.from === 'anna' && c.to === 'bruno', 'sfida: ' + JSON.stringify(c).slice(0, 250));
      const afterLot = await lot('tokA');
      assert(afterLot.escrow.legno === STAKE, 'posta non in escrow: ' + JSON.stringify(afterLot.escrow));
      assert(afterLot.resources.legno <= beforeLot.resources.legno - STAKE + 1, `Legno non scalato: ${beforeLot.resources.legno} → ${afterLot.resources.legno}`);
      await closeTavolo(anna);
    });

    // 3) Bruno vede la sfida, accetta, gioca; esito coerente con la posta
    await ctx.test('Bruno accetta e gioca: esito e risorse coerenti con la posta', async () => {
      const a0 = await lot('tokA'), b0 = await lot('tokB');
      await openTavolo(bruno);
      const acc = nav(bruno, `accetta:${ids.c1}`);
      await acc.waitFor({ timeout: 10000 });
      const txt = await panelText(bruno);
      assert(/Anna ti sfida/i.test(txt) && /da battere/i.test(txt), 'la sfida non mostra chi sfida e il punteggio da battere: ' + txt.slice(0, 250));
      await ctx.shot(bruno.page, 'bruno_vede_la_sfida');
      await acc.click();
      await ctx.waitState(bruno.page, (s) => s.regata.active === true, 15000);
      await panel(bruno, 'esito', 40000);
      const esito = await panelText(bruno);
      ctx.log('esito Bruno: ' + esito.replace(/\n/g, ' · ').slice(0, 250));
      await ctx.shot(bruno.page, 'bruno_esito_sfida');
      const c = await chall('tokB', ids.c1);
      assert(c.state === 'chiusa', 'stato finale: ' + c.state);
      assert(Number.isFinite(c.scoreFrom) && Number.isFinite(c.scoreTo), 'punteggi: ' + JSON.stringify([c.scoreFrom, c.scoreTo]));
      const expected = c.scoreFrom === c.scoreTo ? 'pari' : c.scoreFrom > c.scoreTo ? 'from' : 'to';
      ctx.log(`Anna ${c.scoreFrom} · Bruno ${c.scoreTo} → ${c.winner}`);
      assert(c.winner === expected, `vincitore ${c.winner}, dai punteggi ${expected}`);
      const a1 = await lot('tokA'), b1 = await lot('tokB');
      assert(a1.escrow.legno === 0 && b1.escrow.legno === 0, 'escrow non vuoto a sfida chiusa');
      const dA = a1.resources.legno + a1.escrow.legno - (a0.resources.legno + a0.escrow.legno);
      const dB = b1.resources.legno - (b0.resources.legno + b0.escrow.legno);
      ctx.log(`Legno: Anna ${dA >= 0 ? '+' : ''}${dA} (rispetto a prima + escrow), Bruno ${dB >= 0 ? '+' : ''}${dB}`);
      // A e B con lo stesso piatto: il vincitore guadagna la posta dell'altro (+10), il perdente la perde; pari: ognuno riprende la sua.
      // (tolleranza 2: produzione del lotto nei secondi del test)
      const near = (x, y) => Math.abs(x - y) <= 2;
      if (expected === 'pari') { assert(near(dA, 0) && near(dB, 0), `pari ma le poste si sono mosse: ${dA}/${dB}`); assert(/pari!/i.test(esito), 'esito senza «Pari!»'); }
      else if (expected === 'from') { assert(near(dA, STAKE) && near(dB, -STAKE), `Anna vince: attese +10/−10, ${dA}/${dB}`); assert(/vince anna/i.test(esito), 'esito: ' + esito.slice(0, 120)); }
      else { assert(near(dA, -STAKE) && near(dB, STAKE), `Bruno vince: attese −10/+10, ${dA}/${dB}`); assert(/hai vinto!/i.test(esito), 'esito: ' + esito.slice(0, 120)); }
      await closeTavolo(bruno);
    });

    // 3b) esito deciso: Anna gioca male (input pigri dall'API), Bruno accetta dal pannello e vince con l'autopilot
    await ctx.test('esito deciso: Bruno batte Anna, il piatto va a Bruno (posta 10 Legno)', async () => {
      const a0 = await lot('tokA'), b0 = await lot('tokB');
      const c = (await post('/api/challenges', 'tokA', { minigame: 'regata', to: 'bruno', stake: { legno: STAKE, pietra: 0, perle: 0 } })).body;
      assert(c.id && c.state === 'gioca_sfidante', 'crea: ' + JSON.stringify(c).slice(0, 200));
      const pr = await post(`/api/challenges/${c.id}/play`, 'tokA', { inputs: lazyInputs(c.seed, c.difficulty) });
      assert(pr.status === 200 && pr.body.challenge.state === 'aperta', 'play di Anna: ' + JSON.stringify(pr.body).slice(0, 200));
      await bruno.page.reload({ waitUntil: 'load' });
      await ctx.waitReady(bruno.page, 30000);
      await ctx.waitState(bruno.page, (s) => s.tavolo && s.tavolo.exists === true, 15000);
      await bruno.page.evaluate(() => window.__game.test.regataAutopilot(20));
      await openTavolo(bruno);
      await nav(bruno, `accetta:${c.id}`).click();
      await ctx.waitState(bruno.page, (s) => s.regata.active === true, 15000);
      await panel(bruno, 'esito', 40000);
      const esito = await panelText(bruno);
      ctx.log('esito Bruno: ' + esito.replace(/\n/g, ' · ').slice(0, 250));
      await ctx.shot(bruno.page, 'bruno_vince_la_sfida');
      const cur = await chall('tokB', c.id);
      assert(cur.state === 'chiusa' && cur.winner === 'to', `esito: ${cur.state}/${cur.winner} (${cur.scoreFrom} vs ${cur.scoreTo})`);
      assert(/hai vinto!/i.test(esito), 'Bruno non vede «Hai vinto!»: ' + esito.slice(0, 150));
      const a1 = await lot('tokA'), b1 = await lot('tokB');
      const dA = a1.resources.legno + a1.escrow.legno - (a0.resources.legno + a0.escrow.legno);
      const dB = b1.resources.legno + b1.escrow.legno - (b0.resources.legno + b0.escrow.legno);
      ctx.log(`Legno: Anna ${dA} (in più rispetto a prima con escrow), Bruno ${dB}`);
      // Anna aveva già la posta in escrow (−10 al netto dell'escrow appena rientrato); Bruno prende +10 di Anna
      assert(a1.escrow.legno === 0 && b1.escrow.legno === 0, 'escrow non vuoto');
      assert(Math.abs(a1.resources.legno - (a0.resources.legno + a0.escrow.legno - STAKE)) <= 2, `Anna doveva perdere la posta: ${a0.resources.legno}+${a0.escrow.legno} → ${a1.resources.legno}`);
      assert(Math.abs(b1.resources.legno - (b0.resources.legno + STAKE)) <= 2, `Bruno doveva vincere la posta: ${b0.resources.legno} → ${b1.resources.legno}`);
      // la barra delle risorse segue l'esito subito (non al poll dei 30 s): Perle del server entro 6 s, col pannello ancora aperto
      const barPerle = () => bruno.page.evaluate(() => Number(document.querySelector('.mz-chip[data-res="perle"] b')?.textContent ?? -1));
      await bruno.page.waitForFunction((n) => Number(document.querySelector('.mz-chip[data-res="perle"] b')?.textContent ?? -1) === n, b1.resources.perle, { timeout: 6000 })
        .catch(async () => assert(false, `barra Perle di Bruno ${await barPerle()}, server ${b1.resources.perle}`));
      await closeTavolo(bruno);
    });

    // 4) sfida rifiutata: la posta torna ad Anna
    await ctx.test('sfida rifiutata: la posta torna allo sfidante', async () => {
      const before = await lot('tokA');
      // Anna gioca male dall'API (input di partenza pigri): la sfida passa ad «aperta» senza aspettare un'altra gara nel browser
      const c = (await post('/api/challenges', 'tokA', { minigame: 'regata', to: 'bruno', stake: { legno: STAKE, pietra: 0, perle: 0 } })).body;
      assert(c.id && c.state === 'gioca_sfidante', 'crea: ' + JSON.stringify(c).slice(0, 200));
      const pr = await post(`/api/challenges/${c.id}/play`, 'tokA', { inputs: lazyInputs(c.seed, c.difficulty) });
      assert(pr.status === 200, 'play di Anna: ' + JSON.stringify(pr.body).slice(0, 200));
      ids.c2 = c.id;
      const mid = await lot('tokA');
      assert(mid.escrow.legno === STAKE, 'posta non in escrow prima del rifiuto');
      await bruno.page.reload({ waitUntil: 'load' });
      await ctx.waitReady(bruno.page, 30000);
      await ctx.waitState(bruno.page, (s) => s.tavolo && s.tavolo.exists === true, 15000);
      await openTavolo(bruno);
      await ctx.shot(bruno.page, 'bruno_sfida_da_rifiutare');
      await nav(bruno, `rifiuta:${c.id}`).click();
      await bruno.page.waitForFunction(() => /rifiutata/i.test(document.querySelector('#mzTavolo.on')?.innerText ?? ''), null, { timeout: 10000 });
      await ctx.shot(bruno.page, 'bruno_dopo_il_rifiuto');
      const cur = await chall('tokA', c.id);
      assert(cur.state === 'rifiutata', 'stato: ' + cur.state);
      const after = await lot('tokA');
      assert(after.escrow.legno === 0, 'escrow ancora pieno: ' + JSON.stringify(after.escrow));
      assert(Math.abs(after.resources.legno - (mid.resources.legno + STAKE)) <= 2, `posta non restituita: ${mid.resources.legno} → ${after.resources.legno}`);
      assert(Math.abs(after.resources.legno - before.resources.legno) <= 2, `Anna non è tornata dov'era: ${before.resources.legno} → ${after.resources.legno}`);
      await closeTavolo(bruno);
    });

    await ctx.test('nessun pageerror per Anna e Bruno', async () => {
      ctx.noErrors(anna, 'Anna');
      ctx.noErrors(bruno, 'Bruno');
    });
  } finally {
    for (const pg of pages) await pg.close().catch(() => {});
    if (dev) { try { process.kill(-dev.pid, 'SIGTERM'); } catch { /* già finito */ } await sleep(500); try { process.kill(-dev.pid, 'SIGKILL'); } catch { /* ok */ } }
    fs.rmSync(persist, { recursive: true, force: true });
  }
}
