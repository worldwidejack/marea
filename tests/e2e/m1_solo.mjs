// Primo avvio di un amico (guida «Primi passi» + minigiochi da solo): server locale pulito, Luca entra col suo link. La guida chiede la
// Segheria (cartello evidenziato → conferma già pronta), poi la barca, poi la Regata; al molo della Laguna compare GIOCA, la gara la corre
// l'autopilot, il server rigioca gli input e paga il premio della medaglia (balance.solo); la guida passa a «Costruisci col premio».
// Senza ?sfide=1 niente Tavolo con posta: né al Porto né nel pannello Costruisci. API: play senza partita aperta 409, input rotti 400.
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
export const timeout = 150000;

const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function (ctx) {
  const { assert } = ctx;
  const SERVER = path.join(ctx.ROOT, 'apps/server');
  const persist = path.join(ctx.OUT, `m1solo-${process.pid}`);
  const env = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' };
  const wr = (...a) => execFileSync('npx', ['--no-install', 'wrangler', ...a], { cwd: SERVER, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 }).toString();
  const balance = JSON.parse(fs.readFileSync(path.join(ctx.ROOT, 'packages/content/src/balance.json'), 'utf8'));
  const segheria = JSON.parse(fs.readFileSync(path.join(ctx.ROOT, 'packages/content/src/buildings.json'), 'utf8')).find((b) => b.id === 'segheria');

  let dev = null, log = '', luca = null;
  try {
    fs.rmSync(persist, { recursive: true, force: true });
    wr('d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', persist);
    wr('d1', 'execute', 'DB', '--local', '--persist-to', persist, '--command',
      "INSERT INTO persone (id, nome, token, slot) VALUES ('luca', 'Luca', 'tokL', 0), ('mia', 'Mia', 'tokM', 1); INSERT INTO inviti (codice, creato_da, max_usi) VALUES ('gruppo1', 'jack', 2);");
    const port = await freePort(), inspector = await freePort();
    dev = spawn('npx', ['--no-install', 'wrangler', 'dev', '--local', '--ip', '127.0.0.1', '--port', String(port), '--inspector-port', String(inspector),
      '--assets', ctx.distDir, '--persist-to', persist, '--show-interactive-dev-session=false'], { cwd: SERVER, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    dev.stdout.on('data', (d) => (log += d)); dev.stderr.on('data', (d) => (log += d));
    const base = `http://127.0.0.1:${port}`;
    let up = false;
    for (let i = 0; i < 120 && !up; i++) { try { up = (await fetch(base + '/api/ping')).ok; } catch { /* non ancora */ } if (!up) await sleep(500); }
    if (!up) throw new Error('wrangler dev non risponde:\n' + log.split('\n').slice(-20).join('\n'));
    const post = async (p, t, b) => { const r = await fetch(base + p, { method: 'POST', headers: { 'x-token': t, 'content-type': 'application/json' }, body: JSON.stringify(b ?? {}) }); return { status: r.status, body: await r.json() }; };

    await ctx.test('API: play senza partita aperta 409, minigioco sconosciuto 400, input rotti 400', async () => {
      const a = await post('/api/solo/play', 'tokM', { inputs: [[10, 0, 0, 1, 0]] });
      assert(a.status === 409 && /partita/i.test(a.body.error), `play senza start: ${a.status} ${JSON.stringify(a.body)}`);
      const b = await post('/api/solo/start', 'tokM', { minigame: 'boh' });
      assert(b.status === 400, `minigioco sconosciuto: ${b.status}`);
      const c = await post('/api/solo/start', 'tokM', { minigame: 'regata' });
      assert(c.status === 200 && Number.isInteger(c.body.seed) && c.body.lot?.solo?.pending?.seed === c.body.seed, `start: ${c.status} ${JSON.stringify(c.body).slice(0, 200)}`);
      const d = await post('/api/solo/play', 'tokM', { inputs: 'rotto' });
      assert(d.status === 400, `input rotti: ${d.status}`);
    });

    await ctx.test('API: Lanterne, il server rigioca gli input dell\'autopilota e paga l\'oro', async () => {
      const sim = await import(pathToFileURL(path.join(ctx.ROOT, 'packages/sim/src/index.ts')).href);
      const st = await post('/api/solo/start', 'tokM', { minigame: 'lanterne' });
      assert(st.status === 200 && st.body.minigame === 'lanterne', `start lanterne: ${st.status} ${JSON.stringify(st.body).slice(0, 200)}`);
      const m = sim.getMinigame('lanterne'), s = m.create({ seed: st.body.seed, difficulty: st.body.difficulty }), rng = sim.createRng(1), frames = [];
      for (let i = 0; i < m.maxTicks && !m.result(s).done; i++) { const f = sim.quantize(m.autopilot(s, rng)); frames.push(f); m.step(s, f); }
      const r = await post('/api/solo/play', 'tokM', { inputs: sim.packInputs(frames) });
      assert(r.status === 200 && r.body.medal === 'oro' && r.body.detail.sequenze >= 6, `play lanterne: ${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
      assert(r.body.premiata && JSON.stringify(r.body.premio) === JSON.stringify(balance.solo.premi.oro), 'premio: ' + JSON.stringify(r.body.premio));
    });

    const P = await ctx.B.openPage(ctx.browser, `${base}/?t=tokL&test=1`, { viewport: ctx.B.DESKTOP });
    luca = P; ctx._pages.push(P);
    const page = P.page;
    await ctx.waitReady(page, 30000);
    await ctx.waitState(page, (s) => s.lot && s.lot.ready === true && s.guida, 15000);
    const st = () => ctx.getState(page);
    const hook = (n, ...a) => page.evaluate(([n, a]) => window.__game.test[n](...a), [n, a]);

    await ctx.test('apertura: guida 1/4 «Segheria», cartelli Costruisci con lo slot suggerito, bussola con Porto e Regata, niente Tavolo', async () => {
      const s = await st();
      assert(s.guida.current === 'segheria' && s.guida.total === 4 && s.guida.pointer, 'guida: ' + JSON.stringify(s.guida));
      const signs = s.lot.slotSigns;
      assert(signs.length >= 5 && signs.filter((x) => x.hint).length === 1, 'cartelli: ' + JSON.stringify(signs));
      const rows = await page.evaluate(() => [...document.querySelectorAll('#compass > div')].map((r) => r.dataset.id));
      assert(rows.includes('porto') && rows.includes('regata') && rows.includes('casa'), 'bussola: ' + rows.join(','));
      assert(s.tavolo.exists === false, 'il Tavolo con posta non deve esserci senza ?sfide=1');
      assert(s.minigiochi.spots.some((x) => x.id === 'regata'), 'manca il posto della Regata');
    });
    await ctx.shot(page, '1_apertura');

    await ctx.test('il cartello suggerito apre «Costruire Segheria?», il pannello non offre il Tavolo; costruita → guida 2/4', async () => {
      const s = await st(), h = s.lot.slotSigns.find((x) => x.hint);
      await hook('teleport', (s.lot.origin[0] + h.cell[0] + 0.5) * 2, (s.lot.origin[1] + h.cell[1] + 2.5) * 2); await sleep(1200);
      await page.locator('.mz-lbl.slot.hint').click();
      await page.waitForSelector('#mzSheet [data-panel="conferma"]', { timeout: 5000 });
      assert(/segheria/i.test(await page.locator('#mzSheet').innerText()), 'la conferma non è della Segheria');
      await page.locator('#mzSheet [data-act="annulla"]').click();
      await page.waitForSelector('#mzSheet [data-panel="costruisci"]', { timeout: 5000 });
      assert(await page.locator('#mzSheet [data-building="tavolo"]').count() === 0, 'il pannello offre il Tavolo');
      await page.locator('#mzSheet [data-building="segheria"]').click();
      await page.locator('#mzSheet [data-act="conferma"]').click();
      await ctx.waitState(page, (s) => s.guida.current === 'barca', 8000);
      assert((await st()).lot.resources.legno === balance.partenza.legno - segheria.levels[0].cost.legno, 'Legno dopo la Segheria');
    });
    await ctx.shot(page, '2_barca');

    await ctx.test('in barca → guida 3/4 «Regata»; al molo della Laguna compare GIOCA', async () => {
      await hook('setMode', 'boat');
      await ctx.waitState(page, (s) => s.guida.current === 'regata', 5000);
      await hook('goto', 'laguna');
      await ctx.waitState(page, (s) => s.minigiochi.near === 'regata', 5000);
      await page.waitForSelector('#mzPlay.on', { timeout: 3000 });
    });
    await ctx.shot(page, '3_gioca');

    await ctx.test('GIOCA → gara (autopilot) → il server premia la medaglia; scheda con il premio; guida 4/4', async () => {
      const before = (await st()).lot.resources;
      await hook('regataAutopilot', 20);
      await page.locator('#mzPlay').click();
      await ctx.waitState(page, (s) => s.minigiochi.open === true, 60000);
      const s = await st(), r = s.minigiochi.last;
      ctx.log(`esito ${r.medal} ${r.score} · premio ${JSON.stringify(r.premio)} · ${JSON.stringify(before)} → ${JSON.stringify(r.lot.resources)}`);
      assert(r.medal !== null && r.premiata, 'l\'autopilot deve prendere una medaglia premiata: ' + JSON.stringify(r));
      const prize = balance.solo.premi[r.medal];
      assert(JSON.stringify(r.premio) === JSON.stringify(prize), 'premio diverso da balance.solo');
      for (const k of ['legno', 'pietra', 'perle']) assert(r.lot.resources[k] === before[k] + prize[k], `${k}: ${before[k]} + ${prize[k]} ≠ ${r.lot.resources[k]}`);
      assert(/\+\d+/.test(await page.locator('#mzEsito').innerText()), 'la scheda non mostra il premio');
      await ctx.shot(page, '4_esito');
      await page.locator('#mzEsito [data-act="ok"]').click();
      await ctx.waitState(page, (s) => s.guida.current === 'costruisci' && s.minigiochi.open === false, 5000);
      await ctx.waitState(page, (s, o) => s.lot.resources.legno === o, 10000, r.lot.resources.legno); // la barra si aggiorna subito
    });
    await ctx.shot(page, '5_costruisci');

    await ctx.test('nessun pageerror per Luca', async () => { ctx.noErrors(P, 'Luca'); });

    await ctx.test('link di gruppo: nome → isola sua (slot libero) e guida; nome corto 400; oltre max_usi 403', async () => {
      const G = await ctx.B.openPage(ctx.browser, `${base}/?invito=gruppo1&test=1`, { viewport: ctx.B.IPHONE }); ctx._pages.push(G);
      await G.page.waitForSelector('#mzEntra input', { timeout: 15000 });
      await ctx.shot(G.page, '6_entra');
      await G.page.fill('#mzEntra input', 'Giò Bianchi');
      await G.page.click('#mzEntra button');
      await G.page.waitForURL(/[?&]t=/, { timeout: 15000, waitUntil: 'commit' });
      await ctx.waitReady(G.page, 30000);
      await ctx.waitState(G.page, (s) => s.lot && s.lot.ready === true && s.guida && s.arch, 15000);
      const s = await ctx.getState(G.page);
      assert(s.arch.slot === 2 && s.guida.current === 'segheria', 'Giò: ' + JSON.stringify({ slot: s.arch.slot, guida: s.guida }));
      const tok = await G.page.evaluate(() => localStorage.getItem('marea:token'));
      const me = await (await fetch(base + '/api/me', { headers: { 'x-token': tok } })).json();
      assert(me.nome === 'Giò Bianchi' && /^gio-bianchi-[0-9a-f]{4}$/.test(me.id), 'persona: ' + JSON.stringify({ id: me.id, nome: me.nome }));
      const corto = await fetch(base + '/api/entra', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ invito: 'gruppo1', nome: 'x' }) });
      assert(corto.status === 400, 'nome corto: ' + corto.status);
      const second = await fetch(base + '/api/entra', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ invito: 'gruppo1', nome: 'Ugo' }) });
      assert(second.status === 200, 'secondo ingresso: ' + second.status);
      const third = await fetch(base + '/api/entra', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ invito: 'gruppo1', nome: 'Ada' }) });
      assert(third.status === 403, 'oltre max_usi: ' + third.status);
      ctx.noErrors(G, 'Giò');
    });
  } finally {
    if (luca) await luca.close().catch(() => {});
    if (dev) { try { process.kill(-dev.pid, 'SIGTERM'); } catch { /* già finito */ } await sleep(500); try { process.kill(-dev.pid, 'SIGKILL'); } catch { /* ok */ } }
    fs.rmSync(persist, { recursive: true, force: true });
  }
}
