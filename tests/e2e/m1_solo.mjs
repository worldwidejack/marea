// Primo avvio di un amico (guida «Primi passi» + minigiochi da solo): server locale pulito, Luca entra col suo link. La guida chiede di
// entrare in casa (freccia sulla porta, A entra), poi la barca, poi la Regata; al molo della Laguna compare GIOCA, la gara la corre
// l'autopilot, il server rigioca gli input e paga il premio della medaglia (balance.solo); la guida passa a «Spendi le monete».
// API: play senza partita aperta 409, input rotti 400.
// La guida non parte da sola (VISIONE §1): al primo ingresso è spenta, c'è solo il toast che la indica; Luca la accende dalle Impostazioni.
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

    const P = await ctx.B.openPage(ctx.browser, `${base}/?t=tokL&test=1`, { viewport: ctx.B.DESKTOP });
    luca = P; ctx._pages.push(P);
    const page = P.page;
    await ctx.waitReady(page, 30000);
    await ctx.waitState(page, (s) => s.lot && s.lot.ready === true && s.guida, 15000);
    const st = () => ctx.getState(page);
    const hook = (n, ...a) => page.evaluate(([n, a]) => window.__game.test[n](...a), [n, a]);

    await ctx.test('primo ingresso: la guida non parte da sola (solo il toast che la indica); dalle Impostazioni si accende', async () => {
      const s0 = await st();
      assert(s0.guida.chiusa === true && s0.guida.current === null && !s0.guida.visibile && s0.guida.primaVolta, 'guida al primo ingresso: ' + JSON.stringify(s0.guida));
      assert(await page.locator('#mzGuida.on').count() === 0 && !s0.guida.pointer, 'la scheda della guida si vede');
      const toast = await page.evaluate(() => document.getElementById('toast')?.textContent ?? '');
      assert(/Primi passi/.test(toast) && /Impostazioni/.test(toast), 'toast: ' + toast);
      await ctx.shot(page, '0_primo_ingresso');
      await page.locator('#mzSetBtn').click();
      await page.waitForSelector('#mzSet.on [data-set="guida"]', { timeout: 5000 });
      assert(/NO/.test(await page.locator('#mzSet [data-set="guida"] .sw').innerText()), 'la riga della guida deve dire NO');
      await page.locator('#mzSet [data-set="guida"]').click();
      await ctx.waitState(page, (s) => s.guida.chiusa === false && s.guida.current === 'casa', 3000);
      await ctx.shot(page, '0_impostazioni_guida');
      await page.locator('#mzSet .mz-x').click();
      await ctx.waitState(page, (s) => s.guida.visibile, 5000);
    });

    await ctx.test('apertura: guida 1/8 «Entra in casa tua» con la freccia, bussola con Casa, Porto e Regata', async () => {
      const s = await st();
      assert(s.guida.current === 'casa' && s.guida.total === 8 && s.guida.pointer, 'guida: ' + JSON.stringify(s.guida));
      const rows = await page.evaluate(() => [...document.querySelectorAll('#compass [data-id]')].map((r) => r.dataset.id));
      assert(rows.includes('porto') && rows.includes('regata') && rows.includes('casa'), 'bussola: ' + rows.join(','));
      assert(s.minigiochi.spots.some((x) => x.id === 'regata'), 'manca il posto della Regata');
    });
    await ctx.shot(page, '1_apertura');

    await ctx.test('davanti alla porta A entra in casa → guida 2/8 «Sali in barca»; si riesce in città', async () => {
      const s = await st(), porta = s.borgo.porte.find((q) => q.mia);
      await hook('teleport', porta.x, porta.z);
      await ctx.waitState(page, (q) => q.borgo.near && q.borgo.near.dove === 'entra', 5000);
      await page.keyboard.press('KeyE');
      await ctx.waitState(page, (q, slot) => q.stanza.dentro === slot && q.guida.current === 'barca', 15000, porta.slot);
      await hook('esciDiCasa', porta.slot);
      await ctx.waitState(page, (q) => q.stanza.dentro === null, 5000);
    });
    await ctx.shot(page, '2_barca');

    await ctx.test('in barca → guida 3/8 «Regata»; alla Laguna A al molo sale e scende (la Regata non parte), in barca compare GIOCA (R)', async () => {
      await hook('setMode', 'boat');
      await ctx.waitState(page, (s) => s.guida.current === 'regata', 5000);
      await hook('goto', 'laguna'); // a piedi, con la barca ormeggiata accanto al molo della Laguna
      const dock = (await st()).island.dock;
      await hook('teleport', dock.x, dock.z); await sleep(300);
      assert((await st()).minigiochi.near === null, 'a piedi la Regata non deve comparire');
      await page.keyboard.press('KeyE'); // A sul molo: in barca (prima partiva la Regata)
      await ctx.waitState(page, (s) => s.mode === 'boat' && s.minigiochi.near === 'regata', 5000);
      await page.waitForSelector('#mzPlay.on', { timeout: 3000 });
      assert(/R/.test(await page.locator('#mzPlay small').innerText()), 'il bottone della Regata deve dire R, non A');
      await page.keyboard.press('KeyE'); // A con la barca ferma al molo: a terra, la Regata non parte
      await ctx.waitState(page, (s) => s.mode === 'walk', 5000);
      const s = await st();
      assert(!s.minigiochi.busy && !s.regata?.active, 'A al molo della Laguna ha fatto partire la Regata');
      await page.keyboard.press('KeyE'); // e di nuovo in barca
      await ctx.waitState(page, (s) => s.mode === 'boat' && s.minigiochi.near === 'regata', 5000);
    });
    await ctx.shot(page, '3_gioca');

    await ctx.test('GIOCA → gara (autopilot) → il server premia la medaglia; scheda con il premio; guida 4/8', async () => {
      const before = (await st()).lot.monete;
      await hook('regataAutopilot', 20);
      await page.locator('#mzPlay').click();
      await ctx.waitState(page, (s) => s.minigiochi.open === true, 60000);
      const s = await st(), r = s.minigiochi.last;
      ctx.log(`esito ${r.medal} ${r.score} · premio ${JSON.stringify(r.premio)} · ${before} → ${r.lot.monete} monete`);
      assert(r.medal !== null && r.premiata, 'l\'autopilot deve prendere una medaglia premiata: ' + JSON.stringify(r));
      const prize = balance.solo.premi[r.medal];
      assert(JSON.stringify(r.premio) === JSON.stringify(prize), 'premio diverso da balance.solo');
      assert(r.lot.monete === before + prize, `monete: ${before} + ${prize} ≠ ${r.lot.monete}`);
      assert(/\+\d+/.test(await page.locator('#mzEsito').innerText()), 'la scheda non mostra il premio');
      await ctx.shot(page, '4_esito');
      await page.locator('#mzEsito [data-act="ok"]').click();
      await ctx.waitState(page, (s) => s.guida.current === 'spendi' && s.minigiochi.open === false, 5000);
      await ctx.waitState(page, (s, o) => s.lot.monete === o, 10000, r.lot.monete); // il contatore si aggiorna subito
      await ctx.waitState(page, (s, o) => Number(document.querySelector('.mz-chip[data-res="monete"] b')?.textContent ?? -1) === o, 10000, r.lot.monete).catch(() => assert(false, 'il contatore delle monete non segue il lotto'));
    });
    await ctx.shot(page, '5_spendi');

    await ctx.test('nessun pageerror per Luca', async () => { ctx.noErrors(P, 'Luca'); });

    await ctx.test('link di gruppo: nome → isola sua (slot libero), guida spenta; nome corto 400; oltre max_usi 403', async () => {
      const G = await ctx.B.openPage(ctx.browser, `${base}/?invito=gruppo1&test=1`, { viewport: ctx.B.IPHONE }); ctx._pages.push(G);
      await G.page.waitForSelector('#mzEntra input', { timeout: 15000 });
      await ctx.shot(G.page, '6_entra');
      await G.page.fill('#mzEntra input', 'Giò Bianchi');
      await G.page.click('#mzEntra button');
      await G.page.waitForURL(/[?&]t=/, { timeout: 15000, waitUntil: 'commit' });
      await ctx.waitReady(G.page, 30000);
      await ctx.waitState(G.page, (s) => s.lot && s.lot.ready === true && s.guida && s.arch, 15000);
      const s = await ctx.getState(G.page);
      assert(s.arch.slot === 2 && s.guida.chiusa === true && s.guida.current === null && s.guida.total === 8, 'Giò: ' + JSON.stringify({ slot: s.arch.slot, guida: s.guida }));
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
