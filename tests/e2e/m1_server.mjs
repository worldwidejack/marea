// M1-server: slot dei lotti (migrazione + invita.mjs), celle del template `lotto`, decorazioni e cappelli a Perle, sfide differite con posta
// alla Regata (replay lato server), rifiuto, scadenza con l'orologio di test, concorrenza, e il libro mastro in pari alla fine.
// wrangler dev locale con `--var TEST_CLOCK:1`: l'header X-Test-Now-Offset sposta «adesso» in avanti (solo qui, mai in produzione).
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
export const timeout = 300000;

const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MIN = 60_000, H = 60 * MIN;
const RES = ['legno', 'pietra', 'perle'];

export default async function (ctx) {
  const { assert } = ctx;
  const SERVER = path.join(ctx.ROOT, 'apps/server');
  const persist = path.join(ctx.OUT, `m1server-${process.pid}`);
  const env = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' };
  const wr = (...a) => execFileSync('npx', ['--no-install', 'wrangler', ...a], { cwd: SERVER, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 }).toString();
  const sim = async (f) => import(pathToFileURL(path.join(ctx.ROOT, 'packages/sim/src', f)).href);
  const { regata, lazyAutopilot } = await sim('minigames/regata/regata.ts');
  const { packInputs, quantize, replay } = await sim('replay.ts');
  const { createRng } = await sim('rng.ts');
  const islands = JSON.parse(fs.readFileSync(path.join(ctx.ROOT, 'packages/content/src/islands.json'), 'utf8'));
  const avatar = JSON.parse(fs.readFileSync(path.join(ctx.ROOT, 'packages/content/src/avatar.json'), 'utf8'));
  const balance = JSON.parse(fs.readFileSync(path.join(ctx.ROOT, 'packages/content/src/balance.json'), 'utf8'));
  const tpl = islands.find((i) => i.id === 'lotto');
  const cellsOf = (ch) => (tpl ? tpl.rows.flatMap((row, z) => [...row].flatMap((c, x) => (c === ch ? [[x, z]] : []))) : []);

  let dev = null, log = '', OFF = 0;
  try {
    fs.rmSync(persist, { recursive: true, force: true });
    wr('d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', persist);
    // una persona «vecchia» senza slot, poi due inviti veri: invita.mjs deve dare il primo slot libero
    wr('d1', 'execute', 'DB', '--local', '--persist-to', persist, '--command', "INSERT INTO persone (id, nome, token, slot) VALUES ('zero', 'Zero', 'tok0', 0);");
    const invita = (nome, id, token) => execFileSync(process.execPath, [path.join(SERVER, 'scripts/invita.mjs'), nome, '--id', id, '--token', token, '--persist-to', persist], { env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 }).toString();
    const outA = invita('Anna', 'anna', 'tokA');
    invita('Bruno', 'bruno', 'tokB');
    ctx.log(outA.trim().split('\n')[0]);

    const port = await freePort(), inspector = await freePort();
    dev = spawn('npx', ['--no-install', 'wrangler', 'dev', '--local', '--ip', '127.0.0.1', '--port', String(port), '--inspector-port', String(inspector),
      '--assets', ctx.distDir, '--persist-to', persist, '--var', 'TEST_CLOCK:1', '--show-interactive-dev-session=false'], { cwd: SERVER, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    dev.stdout.on('data', (d) => (log += d)); dev.stderr.on('data', (d) => (log += d));
    const base = `http://127.0.0.1:${port}`;
    let up = false;
    for (let i = 0; i < 120 && !up; i++) { try { up = (await fetch(base + '/api/ping')).ok; } catch { /* non ancora */ } if (!up) await sleep(500); }
    if (!up) throw new Error('wrangler dev non risponde:\n' + log.split('\n').slice(-20).join('\n'));

    const hdr = (t) => ({ 'x-token': t, 'content-type': 'application/json', 'x-test-now-offset': String(OFF) });
    const get = async (p, t) => { const r = await fetch(base + p, { headers: hdr(t) }); return { status: r.status, body: await r.json() }; };
    const post = async (p, t, b) => { const r = await fetch(base + p, { method: 'POST', headers: hdr(t), body: b === undefined ? undefined : JSON.stringify(b) }); return { status: r.status, body: await r.json() }; };
    const lot = async (t) => (await get('/api/lot', t)).body;
    /** Invariante per lotto e globale: Σ risorse + escrow = generato − speso; escrow = somma delle poste per sfida. */
    const ledger = async (what) => {
      const lots = [await lot('tokA'), await lot('tokB')];
      const tot = { have: 0, should: 0 };
      for (const l of lots) for (const k of RES) {
        const have = l.resources[k] + l.escrow[k], should = l.ledger.generated[k] - l.ledger.spent[k];
        assert(have === should, `${what}: ${l.owner} ${k} in giro ${have}, dovrebbe essere ${should}`);
        const held = Object.values(l.holds ?? {}).reduce((s, r) => s + r[k], 0);
        assert(held === l.escrow[k], `${what}: ${l.owner} escrow ${k} ${l.escrow[k]} ≠ poste ${held}`);
        assert(l.resources[k] >= 0, `${what}: ${l.owner} ${k} negativo`);
        tot.have += have; tot.should += should;
      }
      assert(tot.have === tot.should, `${what}: globale ${tot.have} ≠ ${tot.should}`);
      return lots;
    };
    /** Input di una Regata giocata nel Node con l'autopilot (buono) o il pilota pigro. */
    const race = (seed, difficulty, pigro) => {
      const s = regata.create({ seed, difficulty });
      const rng = createRng(seed), frames = [];
      while (!s.done) { const f = quantize(pigro ? lazyAutopilot(s) : regata.autopilot(s, rng)); frames.push(f); regata.step(s, f); }
      const inputs = packInputs(frames);
      return { inputs, expect: replay('regata', seed, difficulty, inputs) };
    };

    await ctx.test('slot: migrazione + invita.mjs danno il primo libero; /api/me e /api/persone lo restituiscono', async () => {
      const a = await get('/api/me', 'tokA'), b = await get('/api/me', 'tokB'), z = await get('/api/me', 'tok0');
      assert(z.body.slot === 0 && a.body.slot === 1 && b.body.slot === 2, `slot ${z.body.slot} ${a.body.slot} ${b.body.slot}`);
      const pp = (await get('/api/persone', 'tokA')).body;
      assert(pp.length === 3 && pp.map((p) => p.slot).join() === '0,1,2' && pp[1].nome === 'Anna', 'persone: ' + JSON.stringify(pp));
      const lots = (await get('/api/lots', 'tokB')).body;
      assert(lots.length === 3 && lots[2].id === 'bruno' && lots[2].slot === 2, 'lots: ' + JSON.stringify(lots));
      assert(Math.abs(a.body.now - Date.now()) < 60_000, '/api/me senza now');
      if (tpl) {
        const molo = a.body.lotto.buildings.find((x) => x.building === 'molo');
        assert(tpl.rows[molo.cell[1]][molo.cell[0]] === 'd', 'il Molo non sta sul d del template: ' + molo.cell);
      } else ctx.warn('template lotto', 'islands.json senza `lotto`: celle non validate (fallback)');
    });

    const L = cellsOf('L');
    const slot = (i) => L[i] ?? [2 + i, 2];
    await ctx.test('celle: edifici solo su L libere, decorazioni solo su sabbia/erba (altrimenti 400), occupata 409', async () => {
      const bad = tpl ? cellsOf('d')[0] : [999, 0];
      const r1 = await post('/api/lot/build', 'tokA', { building: 'tavolo', cell: bad });
      assert(r1.status === 400 && /costruire|Cella/.test(r1.body.error), 'cella non valida: ' + r1.status + ' ' + JSON.stringify(r1.body));
      if (tpl) {
        const r2 = await post('/api/lot/build', 'tokA', { building: 'tavolo', cell: cellsOf('g')[0] });
        assert(r2.status === 400, 'erba non-slot accettata per un edificio');
        const r3 = await post('/api/lot/decor', 'tokA', { decor: 'barile', cell: L[0], rot: 0 });
        assert(r3.status === 400 && /decorazione/.test(r3.body.error), 'decor su slot L: ' + r3.status);
      }
      const r4 = await post('/api/lot/build', 'tokA', { building: 'tavolo', cell: slot(0) });
      assert(r4.status === 200 && r4.body.construction?.building === 'tavolo', 'tavolo non avviato: ' + JSON.stringify(r4.body).slice(0, 200));
      const r5 = await post('/api/lot/decor', 'tokA', { decor: 'barile', cell: tpl ? cellsOf('g')[0] : [9, 9], rot: 1 });
      assert(r5.status === 409 && r5.body.manca?.perle === 5, 'decor senza Perle: ' + JSON.stringify(r5.body));
      const r6 = await post('/api/lot/decor', 'tokA', { decor: 'nave_spaziale', cell: [1, 1], rot: 0 });
      assert(r6.status === 400, 'decorazione sconosciuta accettata');
    });

    const paid = avatar.cappelli.findIndex((h) => h.perle > 0);
    const baseLook = { pelle: 2, capelli: 0, coloreCapelli: 0, vestito: 0 };
    await ctx.test('cappelli: non posseduto → 400, senza Perle non si compra (409), i gratuiti vanno sempre', async () => {
      assert((await post('/api/look', 'tokA', { ...baseLook, cappello: paid })).status === 400, 'cappello non posseduto accettato');
      assert((await post('/api/look', 'tokA', { ...baseLook, cappello: 2 })).status === 200, 'cappello gratuito rifiutato');
      const r = await post('/api/look/hat', 'tokA', { cappello: paid });
      assert(r.status === 409 && r.body.manca?.perle === avatar.cappelli[paid].perle, 'compra senza Perle: ' + JSON.stringify(r.body));
      assert((await post('/api/look/hat', 'tokA', { cappello: 1 })).status === 409, 'comprato un cappello gratuito');
    });

    OFF = 10 * MIN; // il Tavolo L1 (5 min) è finito
    const stake = { legno: 20, pietra: 0, perle: 0 };
    let A0, B0, main;
    await ctx.test('sfida: A sfida B alla Regata (posta 20 Legno in escrow, seed dal server), B non può accettare prima che A giochi', async () => {
      [A0, B0] = await ledger('prima');
      assert(A0.buildings.find((b) => b.building === 'tavolo')?.level === 1, 'tavolo non finito col clock di test');
      assert((await post('/api/challenges', 'tokB', { minigame: 'regata', to: 'anna', stake })).status === 409, 'sfida senza Tavolo accettata');
      assert((await post('/api/challenges', 'tokA', { minigame: 'regata', to: 'anna', stake })).status === 400, 'sfida a se stessi');
      assert((await post('/api/challenges', 'tokA', { minigame: 'regata', to: 'bruno', stake: { legno: 60, pietra: 0, perle: 0 } })).status === 409, 'oltre il tetto del Tavolo');
      assert((await post('/api/challenges', 'tokA', { minigame: 'regata', to: 'bruno', stake: { legno: 5, pietra: 0, perle: 0 } })).status === 400, 'sotto la posta minima');
      const r = await post('/api/challenges', 'tokA', { minigame: 'regata', to: 'bruno', stake });
      assert(r.status === 200 && r.body.state === 'gioca_sfidante' && Number.isInteger(r.body.seed), 'crea: ' + JSON.stringify(r.body));
      main = r.body;
      const a = await lot('tokA');
      assert(a.escrow.legno === 20 && a.resources.legno === A0.resources.legno - 20, 'posta non in escrow');
      const acc = await post(`/api/challenges/${main.id}/accept`, 'tokB');
      assert(acc.status === 409, 'accettata prima del turno dello sfidante');
      assert((await post(`/api/challenges/${main.id}/play`, 'tokB', { inputs: [[1, 0, 0, 0, 0]] })).status === 409, 'B gioca fuori turno');
      await ledger('dopo la creazione');
    });

    let resA, resB;
    await ctx.test('A gioca (replay lato server = replay locale), B accetta e gioca peggio, A vince: piatto, Perle, ledger in pari', async () => {
      const a = race(main.seed, main.difficulty, false);
      const t0 = Date.now();
      const pa = await post(`/api/challenges/${main.id}/play`, 'tokA', { inputs: a.inputs });
      const ms = Date.now() - t0;
      assert(pa.status === 200 && pa.body.score === a.expect.score && pa.body.challenge.state === 'aperta', 'play A: ' + JSON.stringify(pa.body).slice(0, 300));
      ctx.log(`A: ${pa.body.score} punti (${pa.body.medal}), ${JSON.stringify(a.inputs).length} byte di input, richiesta ${ms} ms`);
      assert((await post(`/api/challenges/${main.id}/play`, 'tokA', { inputs: a.inputs })).status === 409, 'A gioca due volte');
      assert((await post(`/api/challenges/${main.id}/accept`, 'tokA')).status === 403, 'lo sfidante accetta la propria sfida');
      const lb = (await get('/api/challenges', 'tokB')).body;
      assert(lb.some((c) => c.id === main.id && c.state === 'aperta' && c.scoreFrom === a.expect.score), 'B non vede la sfida aperta');
      const acc = await post(`/api/challenges/${main.id}/accept`, 'tokB');
      assert(acc.status === 200 && acc.body.state === 'accettata', 'accept: ' + JSON.stringify(acc.body));
      assert((await lot('tokB')).escrow.legno === 20, 'posta di B non in escrow');
      await ledger('dopo l’accettazione');
      const b = race(main.seed, main.difficulty, true);
      const bad = await post(`/api/challenges/${main.id}/play`, 'tokB', { inputs: [[99999, 0, 0, 1, 0]] });
      assert(bad.status === 400, 'input log fuori misura accettato');
      const pb = await post(`/api/challenges/${main.id}/play`, 'tokB', { inputs: b.inputs });
      assert(pb.status === 200 && pb.body.score === b.expect.score, 'play B: ' + JSON.stringify(pb.body).slice(0, 300));
      const c = pb.body.challenge;
      assert(c.state === 'chiusa' && c.winner === 'from' && c.pot.legno === 40, 'esito: ' + JSON.stringify(c));
      [resA, resB] = await ledger('dopo il regolamento');
      const P = balance.perleMedaglia, perle = (m) => Math.max(m ? P[m] : 0, P.sconfitta);
      assert(resA.resources.legno === A0.resources.legno + 20 && resA.escrow.legno === 0, `A legno ${resA.resources.legno}`);
      assert(resB.resources.legno === B0.resources.legno - 20 && resB.escrow.legno === 0, `B legno ${resB.resources.legno}`);
      assert(resA.resources.perle === perle(a.expect.medal) && resB.resources.perle === perle(b.expect.medal), `perle ${resA.resources.perle} ${resB.resources.perle}`);
      assert((await post(`/api/challenges/${main.id}/play`, 'tokB', { inputs: b.inputs })).status === 409, 'sfida chiusa rigiocata');
    });

    await ctx.test('cappello comprato con le Perle vinte: poi /api/look lo accetta', async () => {
      const need = avatar.cappelli[paid].perle;
      if (resA.resources.perle < need) { ctx.warn('cappello', `A ha ${resA.resources.perle} Perle, ne servono ${need}: salto l’acquisto`); return; }
      const r = await post('/api/look/hat', 'tokA', { cappello: avatar.cappelli[paid].id });
      assert(r.status === 200 && r.body.posseduti.includes(avatar.cappelli[paid].id), 'acquisto: ' + JSON.stringify(r.body).slice(0, 200));
      assert((await post('/api/look/hat', 'tokA', { cappello: paid })).status === 409, 'comprato due volte');
      assert((await post('/api/look', 'tokA', { ...baseLook, cappello: paid })).status === 200, 'cappello comprato rifiutato');
      assert((await get('/api/me', 'tokA')).body.look.cappello === paid, 'look non salvato');
      await ledger('dopo il cappello');
    });

    await ctx.test('rifiuto: la posta torna allo sfidante', async () => {
      const before = await lot('tokA');
      const c = (await post('/api/challenges', 'tokA', { minigame: 'regata', to: 'bruno', stake: { legno: 10, pietra: 5, perle: 0 } })).body;
      // caso peggiore per la CPU: 120 s pieni (7.200 tick) di barca che gira in tondo senza finire
      const t0 = Date.now();
      const worst = await post(`/api/challenges/${c.id}/play`, 'tokA', { inputs: [[regata.maxTicks, 32, 0, 1, 0]] });
      ctx.log(`replay Regata da 120 s (${regata.maxTicks} tick) nel DO: richiesta ${Date.now() - t0} ms, ${worst.body.score} punti`);
      assert(worst.status === 200 && worst.body.detail.ms === regata.maxTicks * 1000 / 60, 'replay da 120 s: ' + JSON.stringify(worst.body).slice(0, 200));
      assert((await post(`/api/challenges/${c.id}/decline`, 'tokA')).status === 403, 'lo sfidante rifiuta');
      const d = await post(`/api/challenges/${c.id}/decline`, 'tokB');
      assert(d.status === 200 && d.body.state === 'rifiutata', 'decline: ' + JSON.stringify(d.body));
      const after = await lot('tokA');
      assert(after.resources.legno === before.resources.legno && after.resources.pietra === before.resources.pietra && after.escrow.legno === 0, 'rimborso sbagliato');
      assert((await post(`/api/challenges/${c.id}/accept`, 'tokB')).status === 409, 'accettata dopo il rifiuto');
      await ledger('dopo il rifiuto');
    });

    await ctx.test('scadenza: dopo 24 h (orologio di test) la sfida scade e la posta torna', async () => {
      const before = await lot('tokA');
      const c = (await post('/api/challenges', 'tokA', { minigame: 'regata', to: 'bruno', stake })).body;
      assert(c.expiresMs - c.createdMs === balance.wager.scadenzaOre * H, 'scadenza non a 24 h');
      assert((await lot('tokA')).escrow.legno === 20, 'posta non in escrow');
      OFF += 25 * H;
      const lb = (await get('/api/challenges', 'tokB')).body;
      assert(lb.find((x) => x.id === c.id)?.state === 'scaduta', 'non scaduta: ' + JSON.stringify(lb.map((x) => [x.id, x.state])));
      const after = await lot('tokA');
      assert(after.resources.legno === before.resources.legno && after.escrow.legno === 0, 'posta non rimborsata alla scadenza');
      assert((await post(`/api/challenges/${c.id}/play`, 'tokA', { inputs: [[1, 0, 0, 0, 0]] })).status === 409, 'gioca una sfida scaduta');
      await ledger('dopo la scadenza');
    });

    await ctx.test('concorrenza: sfide parallele, accept/decline doppi e play doppi → una sola vince, ledger in pari, escrow vuoto', async () => {
      const mk = () => post('/api/challenges', 'tokA', { minigame: 'regata', to: 'bruno', stake: { legno: 10, pietra: 0, perle: 0 } });
      const [c1, c2] = (await Promise.all([mk(), mk()])).map((r) => r.body);
      assert(c1.id && c2.id && c1.id !== c2.id && c1.seed !== c2.seed, 'creazioni parallele');
      await Promise.all([c1, c2].map((c) => post(`/api/challenges/${c.id}/play`, 'tokA', { inputs: race(c.seed, c.difficulty, true).inputs })));
      const rs = await Promise.all([post(`/api/challenges/${c1.id}/accept`, 'tokB'), post(`/api/challenges/${c1.id}/accept`, 'tokB'), post(`/api/challenges/${c1.id}/decline`, 'tokB'),
        post(`/api/challenges/${c2.id}/decline`, 'tokB'), post(`/api/challenges/${c2.id}/accept`, 'tokB')]);
      assert(rs.slice(0, 3).filter((r) => r.status === 200).length === 1, 'c1: esiti ' + rs.slice(0, 3).map((r) => r.status));
      assert(rs.slice(3).filter((r) => r.status === 200).length === 1, 'c2: esiti ' + rs.slice(3).map((r) => r.status));
      await ledger('dopo accept/decline paralleli');
      for (const c of [c1, c2]) {
        const cur = (await get('/api/challenges', 'tokB')).body.find((x) => x.id === c.id);
        if (cur.state !== 'accettata') continue;
        const inputs = race(c.seed, c.difficulty, false).inputs;
        const plays = await Promise.all([1, 2, 3].map(() => post(`/api/challenges/${c.id}/play`, 'tokB', { inputs })));
        assert(plays.filter((p) => p.status === 200).length === 1, 'play doppi: ' + plays.map((p) => p.status));
      }
      const [a, b] = await ledger('fine');
      for (const l of [a, b]) assert(RES.every((k) => l.escrow[k] === 0) && Object.keys(l.holds ?? {}).length === 0, `${l.owner}: escrow non vuoto ${JSON.stringify(l.escrow)}`);
      const all = (await get('/api/challenges', 'tokA')).body;
      ctx.log('sfide di A: ' + all.map((c) => `${c.state}${c.winner ? '/' + c.winner : ''}`).join(' '));
      assert(all.every((c) => ['chiusa', 'rifiutata', 'scaduta'].includes(c.state)), 'sfide rimaste aperte');
    });
  } finally {
    if (dev) { try { process.kill(-dev.pid, 'SIGTERM'); } catch { /* già finito */ } await sleep(500); try { process.kill(-dev.pid, 'SIGKILL'); } catch { /* ok */ } }
    fs.rmSync(persist, { recursive: true, force: true });
  }
}
