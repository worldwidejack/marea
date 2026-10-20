// M1-server: slot dei lotti (migrazione + invita.mjs), celle del template `lotto`, decorazioni e cappelli a monete (#414), il replay più lungo
// della Regata nel DO del lotto (partita da solo), e il libro mastro in pari a ogni passo.
// wrangler dev locale con `--var TEST_CLOCK:1`: l'header X-Test-Now-Offset sposta «adesso» in avanti (solo qui, mai in produzione).
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
export const timeout = 300000;

const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const RES = ['legno', 'pietra', 'perle'];

export default async function (ctx) {
  const { assert } = ctx;
  const SERVER = path.join(ctx.ROOT, 'apps/server');
  const persist = path.join(ctx.OUT, `m1server-${process.pid}`);
  const WIN = process.platform === 'win32';
  const env = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' };
  const wr = (...a) => execFileSync('npx', ['--no-install', 'wrangler', ...a], { cwd: SERVER, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000, shell: WIN }).toString();
  const sim = async (f) => import(pathToFileURL(path.join(ctx.ROOT, 'packages/sim/src', f)).href);
  const { regata, lazyAutopilot } = await sim('minigames/regata/regata.ts');
  const { packInputs, quantize, replay } = await sim('replay.ts');
  const { createRng } = await sim('rng.ts');
  const islands = JSON.parse(fs.readFileSync(path.join(ctx.ROOT, 'packages/content/src/islands.json'), 'utf8'));
  const avatar = JSON.parse(fs.readFileSync(path.join(ctx.ROOT, 'packages/content/src/avatar.json'), 'utf8'));
  const balance = JSON.parse(fs.readFileSync(path.join(ctx.ROOT, 'packages/content/src/balance.json'), 'utf8'));
  const decor = JSON.parse(fs.readFileSync(path.join(ctx.ROOT, 'packages/content/src/decor.json'), 'utf8'));
  const tpl = islands.find((i) => i.id === 'lotto');
  const cellsOf = (ch) => (tpl ? tpl.rows.flatMap((row, z) => [...row].flatMap((c, x) => (c === ch ? [[x, z]] : []))) : []);

  let dev = null, log = '', OFF = 0;
  try {
    fs.rmSync(persist, { recursive: true, force: true });
    wr('d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', persist);
    const sql = path.join(persist, 'persone.sql');
    fs.mkdirSync(persist, { recursive: true });
    fs.writeFileSync(sql, "INSERT INTO persone (id, nome, token, slot) VALUES ('zero', 'Zero', 'tok0', 0);\n");
    wr('d1', 'execute', 'DB', '--local', '--persist-to', persist, '--file', sql);
    const invita = (nome, id, token) => execFileSync(process.execPath, [path.join(SERVER, 'scripts/invita.mjs'), nome, '--id', id, '--token', token, '--persist-to', persist], { env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 }).toString();
    const outA = invita('Anna', 'anna', 'tokA');
    invita('Bruno', 'bruno', 'tokB');
    ctx.log(outA.trim().split('\n')[0]);

    const port = await freePort(), inspector = await freePort();
    dev = spawn('npx', ['--no-install', 'wrangler', 'dev', '--local', '--ip', '127.0.0.1', '--port', String(port), '--inspector-port', String(inspector),
      '--assets', ctx.distDir, '--persist-to', persist, '--var', 'TEST_CLOCK:1', '--show-interactive-dev-session=false'], { cwd: SERVER, env, detached: !WIN, shell: WIN, stdio: ['ignore', 'pipe', 'pipe'] });
    dev.stdout.on('data', (d) => (log += d)); dev.stderr.on('data', (d) => (log += d));
    const base = `http://127.0.0.1:${port}`;
    let up = false;
    for (let i = 0; i < 120 && !up; i++) { try { up = (await fetch(base + '/api/ping')).ok; } catch { /* non ancora */ } if (!up) await sleep(500); }
    if (!up) throw new Error('wrangler dev non risponde:\n' + log.split('\n').slice(-20).join('\n'));

    const hdr = (t) => ({ 'x-token': t, 'content-type': 'application/json', 'x-test-now-offset': String(OFF) });
    const get = async (p, t) => { const r = await fetch(base + p, { headers: hdr(t) }); return { status: r.status, body: await r.json() }; };
    const post = async (p, t, b) => { const r = await fetch(base + p, { method: 'POST', headers: hdr(t), body: b === undefined ? undefined : JSON.stringify(b) }); return { status: r.status, body: await r.json() }; };
    const lot = async (t) => (await get('/api/lot', t)).body;
    /** Invariante per lotto e globale: Σ risorse + escrow = generato − speso; monete = guadagnate − spese. */
    const ledger = async (what) => {
      const lots = [await lot('tokA'), await lot('tokB')];
      const tot = { have: 0, should: 0 };
      for (const l of lots) for (const k of RES) {
        const have = l.resources[k] + l.escrow[k], should = l.ledger.generated[k] - l.ledger.spent[k];
        assert(have === should, `${what}: ${l.owner} ${k} in giro ${have}, dovrebbe essere ${should}`);
        assert(l.resources[k] >= 0, `${what}: ${l.owner} ${k} negativo`);
        tot.have += have; tot.should += should;
      }
      for (const l of lots) { const m = l.ledger.monete ?? { generated: 0, spent: 0 }; assert(l.monete >= 0 && l.monete === m.generated - m.spent, `${what}: ${l.owner} monete ${l.monete} ≠ ${m.generated} − ${m.spent}`); }
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

    await ctx.test('/api/nome: cambia il nome della persona e aggiorna /api/me e /api/persone (#301)', async () => {
      const rCorto = await post('/api/nome', 'tokA', { nome: 'A' });
      assert(rCorto.status === 400 && /lettere/i.test(rCorto.body.error), 'nome troppo corto non rifiutato: ' + JSON.stringify(rCorto.body));
      const rLungo = await post('/api/nome', 'tokA', { nome: 'UnNomeCheSuperaSediciCaratteri' });
      assert(rLungo.status === 400 && /lettere/i.test(rLungo.body.error), 'nome troppo lungo non rifiutato: ' + JSON.stringify(rLungo.body));
      const rOk = await post('/api/nome', 'tokA', { nome: 'Annina' });
      assert(rOk.status === 200 && rOk.body.nome === 'Annina', 'cambio nome non riuscito: ' + JSON.stringify(rOk.body));
      const me = (await get('/api/me', 'tokA')).body;
      assert(me.nome === 'Annina', '/api/me non aggiornato: ' + me.nome);
      const pp = (await get('/api/persone', 'tokA')).body;
      assert(pp.find((p) => p.id === 'anna')?.nome === 'Annina', '/api/persone non aggiornato');
      // Ripristina per i test successivi
      await post('/api/nome', 'tokA', { nome: 'Anna' });
    });

    await ctx.test('nessun nome regala monete: rinominarsi «riccc» non cambia il portafoglio', async () => {
      const prima = (await lot('tokA')).monete;
      const r = await post('/api/nome', 'tokA', { nome: 'riccc' });
      assert(r.status === 200, 'cambio nome non riuscito: ' + JSON.stringify(r.body));
      const dopo = (await lot('tokA')).monete;
      assert(dopo === prima, `rinominarsi «riccc» ha cambiato le monete: ${prima} → ${dopo}`);
      await post('/api/nome', 'tokA', { nome: 'Anna' });
    });

    const L = cellsOf('L');
    const slot = (i) => L[i] ?? [2 + i, 2];
    await ctx.test('celle: edifici solo su posizioni valide, decorazioni solo su sabbia/erba (altrimenti 400), occupata 409', async () => {
      const bad = tpl ? cellsOf('d')[0] : [999, 0];
      const r1 = await post('/api/lot/build', 'tokA', { building: 'tavolo', cell: bad });
      assert(r1.status === 400 && /costruire|Cella/.test(r1.body.error), 'cella non valida: ' + r1.status + ' ' + JSON.stringify(r1.body));
      if (tpl) {
        const r2 = await post('/api/lot/build', 'tokA', { building: 'tavolo', cell: cellsOf('~')[0] });
        assert(r2.status === 400 && /costruire|Cella/.test(r2.body.error), 'acqua accettata per un edificio');
        const r3 = await post('/api/lot/decor', 'tokA', { decor: 'barile', cell: L[0], rot: 0 });
        assert(r3.status === 400 && /decorazione/.test(r3.body.error), 'decor su slot L: ' + r3.status);
      }
      const r4 = await post('/api/lot/build', 'tokA', { building: 'tavolo', cell: slot(0) });
      assert(r4.status === 200 && r4.body.construction?.building === 'tavolo', 'tavolo non avviato: ' + JSON.stringify(r4.body).slice(0, 200));
      const caro = decor.find((d) => !d.mercante && d.monete > balance.monete.partenza);
      const r5 = await post('/api/lot/decor', 'tokA', { decor: caro.id, cell: tpl ? cellsOf('g')[0] : [9, 9], rot: 1 });
      assert(r5.status === 409 && r5.body.manca?.monete === caro.monete - balance.monete.partenza, 'decor senza monete: ' + JSON.stringify(r5.body));
      const r6 = await post('/api/lot/decor', 'tokA', { decor: 'nave_spaziale', cell: [1, 1], rot: 0 });
      assert(r6.status === 400, 'decorazione sconosciuta accettata');
    });

    const paid = avatar.cappelli.findIndex((h) => h.monete > 0);
    const baseLook = { pelle: 2, capelli: 0, coloreCapelli: 0, vestito: 0 };
    await ctx.test('cappelli: non posseduto → 400, senza monete non si compra (409), i gratuiti vanno sempre', async () => {
      assert((await post('/api/look', 'tokA', { ...baseLook, cappello: paid })).status === 400, 'cappello non posseduto accettato');
      assert((await post('/api/look', 'tokA', { ...baseLook, cappello: 2 })).status === 200, 'cappello gratuito rifiutato');
      const r = await post('/api/look/hat', 'tokA', { cappello: paid });
      assert(r.status === 409 && r.body.manca?.monete === avatar.cappelli[paid].monete - balance.monete.partenza, 'compra senza monete: ' + JSON.stringify(r.body));
      assert((await post('/api/look/hat', 'tokA', { cappello: 1 })).status === 409, 'comprato un cappello gratuito');
    });

    await ctx.test('cappello comprato con le monete vinte da solo: poi /api/look lo accetta', async () => {
      const need = avatar.cappelli[paid].monete;
      for (let i = 0; i < 10 && (await lot('tokA')).monete < need; i++) {
        const st = await post('/api/solo/start', 'tokA', { minigame: 'regata' });
        assert(st.status === 200, 'solo start: ' + JSON.stringify(st.body).slice(0, 200));
        assert((await post('/api/solo/play', 'tokA', { inputs: race(st.body.seed, st.body.difficulty, false).inputs })).status === 200, 'solo play');
      }
      const m = (await lot('tokA')).monete;
      if (m < need) { ctx.warn('cappello', `A ha ${m} monete, ne servono ${need}: salto l’acquisto`); return; }
      const r = await post('/api/look/hat', 'tokA', { cappello: avatar.cappelli[paid].id });
      assert(r.status === 200 && r.body.posseduti.includes(avatar.cappelli[paid].id), 'acquisto: ' + JSON.stringify(r.body).slice(0, 200));
      assert((await post('/api/look/hat', 'tokA', { cappello: paid })).status === 409, 'comprato due volte');
      assert((await post('/api/look', 'tokA', { ...baseLook, cappello: paid })).status === 200, 'cappello comprato rifiutato');
      assert((await get('/api/me', 'tokA')).body.look.cappello === paid, 'look non salvato');
      await ledger('dopo il cappello');
    });

    await ctx.test('replay più lungo nel DO del lotto: una Regata da 120 s che non finisce, come partita da solo', async () => {
      const st = await post('/api/solo/start', 'tokB', { minigame: 'regata' });
      assert(st.status === 200, 'solo start: ' + JSON.stringify(st.body).slice(0, 200));
      // caso peggiore per la CPU: 120 s pieni (7.200 tick) di barca che gira in tondo senza finire
      const t0 = Date.now();
      const worst = await post('/api/solo/play', 'tokB', { inputs: [[regata.maxTicks, 32, 0, 1, 0]] });
      ctx.log(`replay Regata da 120 s (${regata.maxTicks} tick) nel DO: richiesta ${Date.now() - t0} ms, ${worst.body.score} punti`);
      assert(worst.status === 200 && worst.body.detail.ms === regata.maxTicks * 1000 / 60, 'replay da 120 s: ' + JSON.stringify(worst.body).slice(0, 200));
      await ledger('dopo la Regata lunga');
    });
  } finally {
    if (dev) {
      if (WIN) { try { execFileSync('taskkill', ['/pid', String(dev.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* ok */ } }
      else { try { process.kill(-dev.pid, 'SIGTERM'); } catch { /* già finito */ } await sleep(500); try { process.kill(-dev.pid, 'SIGKILL'); } catch { /* ok */ } }
    }
    fs.rmSync(persist, { recursive: true, force: true });
  }
}
