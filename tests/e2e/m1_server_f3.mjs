// M1 · Fetta 3, lato server: look che arriva in presenza (POST /api/look → Zone → snap), emote con pausa di 800 ms senza eco, feed delle
// sfide nel DO Sfide (righe a ogni passaggio di stato, testi composti nel Worker, letto/non letto, 30 righe, niente doppioni in parallelo).
// Solo API + WebSocket grezzi, niente browser. wrangler dev locale con `--var TEST_CLOCK:1` (X-Test-Now-Offset sposta «adesso»).
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
export const timeout = 300000;

const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MIN = 60_000, H = 60 * MIN;
const RES = [['legno', 'Legno'], ['pietra', 'Pietra'], ['perle', 'Perle']];

export default async function (ctx) {
  const { assert } = ctx;
  const SERVER = path.join(ctx.ROOT, 'apps/server');
  const persist = path.join(ctx.OUT, `m1serverf3-${process.pid}`);
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
  const L = tpl ? tpl.rows.flatMap((row, z) => [...row].flatMap((c, x) => (c === 'L' ? [[x, z]] : []))) : [];
  const P = balance.perleMedaglia, perleFor = (m) => Math.max(m ? P[m] : 0, P.sconfitta);

  let dev = null, log = '', OFF = 0;
  const sockets = [];
  try {
    fs.rmSync(persist, { recursive: true, force: true });
    wr('d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', persist);
    const invita = (nome, id, token) => execFileSync(process.execPath, [path.join(SERVER, 'scripts/invita.mjs'), nome, '--id', id, '--token', token, '--persist-to', persist], { env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 });
    invita('Anna', 'anna', 'tokA'); invita('Bruno', 'bruno', 'tokB'); invita('Carlo', 'carlo', 'tokC');

    const port = await freePort(), inspector = await freePort();
    dev = spawn('npx', ['--no-install', 'wrangler', 'dev', '--local', '--ip', '127.0.0.1', '--port', String(port), '--inspector-port', String(inspector),
      '--assets', ctx.distDir, '--persist-to', persist, '--var', 'TEST_CLOCK:1', '--show-interactive-dev-session=false'], { cwd: SERVER, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    dev.stdout.on('data', (d) => (log += d)); dev.stderr.on('data', (d) => (log += d));
    const base = `http://127.0.0.1:${port}`;
    let up = false;
    for (let i = 0; i < 120 && !up; i++) { try { up = (await fetch(base + '/api/ping')).ok; } catch { /* non ancora */ } if (!up) await sleep(500); }
    if (!up) throw new Error('wrangler dev non risponde:\n' + log.split('\n').slice(-20).join('\n'));

    const hdr = (t) => ({ ...(t ? { 'x-token': t } : {}), 'content-type': 'application/json', 'x-test-now-offset': String(OFF) });
    const get = async (p, t) => { const r = await fetch(base + p, { headers: hdr(t) }); return { status: r.status, body: await r.json() }; };
    const post = async (p, t, b) => { const r = await fetch(base + p, { method: 'POST', headers: hdr(t), body: b === undefined ? undefined : JSON.stringify(b) }); return { status: r.status, body: await r.json() }; };
    const feed = async (t) => { const r = await get('/api/feed', t); assert(r.status === 200 && Array.isArray(r.body.items), 'feed: ' + r.status + ' ' + JSON.stringify(r.body).slice(0, 200)); return r.body; };
    const of = (f, sfida, tipo) => f.items.filter((x) => x.sfida === sfida && (!tipo || x.tipo === tipo));
    const race = (seed, difficulty, pigro) => {
      const s = regata.create({ seed, difficulty });
      const rng = createRng(seed), frames = [];
      while (!s.done) { const f = quantize(pigro ? lazyAutopilot(s) : regata.autopilot(s, rng)); frames.push(f); regata.step(s, f); }
      const inputs = packInputs(frames);
      return { inputs, expect: replay('regata', seed, difficulty, inputs) };
    };
    const wsUrl = (t) => `ws://127.0.0.1:${port}/ws/zone/porto?t=${t}`;
    const openWs = (t, hello = true) => new Promise((res, rej) => {
      const w = new WebSocket(wsUrl(t)); w.msgs = []; w.closed = null; sockets.push(w);
      w.onmessage = (e) => w.msgs.push(JSON.parse(e.data)); w.onclose = (e) => (w.closed = e.code); w.onerror = () => {};
      w.onopen = () => { if (hello) w.send(JSON.stringify({ t: 'hello', v: 1, build: 'test' })); res(w); };
      setTimeout(() => rej(new Error('ws timeout')), 5000);
    });
    const waitFor = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = fn(); if (v) return v; await sleep(20); } return fn(); };

    const baseLook = { pelle: 1, capelli: 1, coloreCapelli: 1, vestito: 1, cappello: 0 };
    const paid = avatar.cappelli.findIndex((h) => h.perle > 0);
    await ctx.test('look: indici validi 200, fuori range 400, cappello a Perle non posseduto 400', async () => {
      assert((await post('/api/look', 'tokA', baseLook)).status === 200, 'look valido rifiutato');
      const bad = await post('/api/look', 'tokA', { ...baseLook, vestito: avatar.vestiti.length });
      assert(bad.status === 400 && typeof bad.body.error === 'string', 'vestito fuori range: ' + bad.status);
      assert((await post('/api/look', 'tokA', { ...baseLook, pelle: -1 })).status === 400, 'pelle negativa accettata');
      const hat = await post('/api/look', 'tokA', { ...baseLook, cappello: paid });
      assert(hat.status === 400 && /compralo/.test(hat.body.error), 'cappello a Perle non posseduto: ' + JSON.stringify(hat.body));
      assert((await get('/api/me', 'tokA')).body.look.vestito === 1, 'look non salvato');
    });

    let wa, wb;
    await ctx.test('look in presenza: Bruno riceve lo snap col look nuovo di Anna entro 1 s, Anna niente di sé, il welcome di una terza connessione lo porta', async () => {
      wa = await openWs('tokA'); await sleep(150); wb = await openWs('tokB');
      await waitFor(() => wb.msgs.some((m) => m.t === 'welcome'), 2000);
      const w0 = wb.msgs.find((m) => m.t === 'welcome');
      assert(w0?.peers.find((p) => p.id === 'anna')?.look.vestito === 1, 'welcome di Bruno senza Anna: ' + JSON.stringify(w0).slice(0, 300));
      await sleep(200);
      wa.msgs.length = 0; wb.msgs.length = 0;
      const nuovo = { pelle: 3, capelli: 2, coloreCapelli: 2, vestito: 2, cappello: 2 };
      const t0 = Date.now();
      assert((await post('/api/look', 'tokA', nuovo)).status === 200, 'look rifiutato');
      const snap = await waitFor(() => wb.msgs.find((m) => m.t === 'snap' && m.peers.some((p) => p.id === 'anna')), 1000);
      const ms = Date.now() - t0;
      assert(snap, 'Bruno non ha ricevuto lo snap entro 1 s: ' + JSON.stringify(wb.msgs).slice(0, 300));
      assert(JSON.stringify(snap.peers.find((p) => p.id === 'anna').look) === JSON.stringify(nuovo), 'look nello snap: ' + JSON.stringify(snap));
      ctx.log(`look → snap di Bruno in ${ms} ms`);
      await sleep(250);
      assert(!wa.msgs.some((m) => m.t === 'snap' && m.peers.some((p) => p.id === 'anna')), 'Anna ha ricevuto il proprio look: ' + JSON.stringify(wa.msgs));
      const wc = await openWs('tokC');
      const wel = await waitFor(() => wc.msgs.find((m) => m.t === 'welcome'), 2000);
      assert(JSON.stringify(wel?.peers.find((p) => p.id === 'anna')?.look) === JSON.stringify(nuovo), 'welcome della terza connessione: ' + JSON.stringify(wel).slice(0, 300));
      wc.close(); await sleep(200);
    });

    await ctx.test('emote: 5 in 200 ms → Bruno ne riceve al massimo una, Anna nessuna eco', async () => {
      wa.msgs.length = 0; wb.msgs.length = 0;
      for (const id of ['saluto', 'esulta', 'ride', 'no', 'saluto']) { wa.send(JSON.stringify({ t: 'emote', id })); await sleep(40); }
      await sleep(400);
      const eb = wb.msgs.filter((m) => m.t === 'emote'), ea = wa.msgs.filter((m) => m.t === 'emote');
      assert(eb.length === 1 && eb[0].from === 'anna' && eb[0].id === 'saluto', 'emote a Bruno: ' + JSON.stringify(eb));
      assert(ea.length === 0, 'eco ad Anna: ' + JSON.stringify(ea));
      await sleep(600);
      wa.send(JSON.stringify({ t: 'emote', id: 'ride' }));
      assert(await waitFor(() => wb.msgs.filter((m) => m.t === 'emote').length === 2, 1000), 'dopo 800 ms la emote successiva non passa');
    });
    for (const w of sockets) try { w.close(); } catch { /* già chiusa */ }

    // Tavolo di Anna (5 min di cantiere): poi l'orologio di test va avanti
    assert((await post('/api/lot/build', 'tokA', { building: 'tavolo', cell: L[0] ?? [2, 2] })).status === 200, 'tavolo non avviato');
    OFF = 10 * MIN;
    const stake = { legno: 20, pietra: 0, perle: 0 };
    const sfida = async (st = stake) => { const r = await post('/api/challenges', 'tokA', { minigame: 'regata', to: 'bruno', stake: st }); assert(r.status === 200, 'crea: ' + JSON.stringify(r.body)); return r.body; };
    const netto = (c, side) => {
      const esito = c.winner === 'pari' ? 'parita' : c.winner === side ? 'vittoria' : 'sconfitta';
      const medal = side === 'from' ? c.medalFrom : c.medalTo;
      const n = {};
      for (const [k] of RES) n[k] = esito === 'vittoria' ? c.pot[k] - c.stake[k] : esito === 'sconfitta' ? -c.stake[k] : 0;
      n.perle += perleFor(medal);
      return { esito, txt: RES.filter(([k]) => n[k] !== 0).map(([k, nome]) => `${n[k] > 0 ? '+' : '−'}${Math.abs(n[k])} ${nome}`).join(', ') };
    };

    await ctx.test('feed: crea → niente; gioca → sfida_ricevuta a Bruno; accetta → sfida_accettata ad Anna; chiusa → a entrambi con le cifre giuste', async () => {
      const main = await sfida();
      assert((await feed('tokA')).items.length === 0 && (await feed('tokB')).items.length === 0, 'righe alla creazione');
      const a = race(main.seed, main.difficulty, false);
      assert((await post(`/api/challenges/${main.id}/play`, 'tokA', { inputs: a.inputs })).status === 200, 'play A');
      const fb = await feed('tokB');
      const ric = of(fb, main.id, 'sfida_ricevuta');
      assert(ric.length === 1 && !ric[0].letto && ric[0].da === 'anna' && fb.nonLetti === 1, 'ricevuta: ' + JSON.stringify(fb));
      assert(ric[0].testo === 'Anna ti sfida alla Regata: posta 20 Legno. Rispondi al Tavolo entro 24 h', 'testo: ' + ric[0].testo);
      assert(Math.abs(fb.now - Date.now() - OFF) < 60_000, 'now del feed senza orologio di test');
      assert((await feed('tokA')).items.length === 0, 'riga ad Anna per la propria partita');
      assert((await post(`/api/challenges/${main.id}/accept`, 'tokB')).status === 200, 'accept');
      const fa = await feed('tokA');
      const acc = of(fa, main.id, 'sfida_accettata');
      assert(acc.length === 1 && !acc[0].letto && acc[0].testo === 'Bruno ha accettato la tua sfida', 'accettata: ' + JSON.stringify(fa));
      assert(of(await feed('tokB'), main.id, 'sfida_accettata').length === 0, 'accettata anche a Bruno');
      const b = race(main.seed, main.difficulty, true);
      const pb = await post(`/api/challenges/${main.id}/play`, 'tokB', { inputs: b.inputs });
      const c = pb.body.challenge;
      assert(pb.status === 200 && c.state === 'chiusa' && c.winner === 'from', 'esito: ' + JSON.stringify(pb.body).slice(0, 300));
      const [ca] = of(await feed('tokA'), main.id, 'sfida_chiusa'), [cb] = of(await feed('tokB'), main.id, 'sfida_chiusa');
      assert(ca && !ca.letto && cb && cb.letto, 'chiusa letto/non letto: ' + JSON.stringify([ca, cb]));
      const na = netto(c, 'from'), nb = netto(c, 'to');
      assert(ca.testo === `Hai battuto Bruno: ${na.txt}` && na.txt === `+20 Legno, +${perleFor(c.medalFrom)} Perle`, 'testo A: ' + ca.testo);
      assert(cb.testo === `Anna ti ha battuto: ${nb.txt}` && nb.txt === `−20 Legno, +${perleFor(c.medalTo)} Perle`, 'testo B: ' + cb.testo);
      ctx.log(`A: «${ca.testo}» · B: «${cb.testo}»`);

      const pari = await sfida({ legno: 10, pietra: 5, perle: 0 });
      const lazy = race(pari.seed, pari.difficulty, true);
      await post(`/api/challenges/${pari.id}/play`, 'tokA', { inputs: lazy.inputs });
      await post(`/api/challenges/${pari.id}/accept`, 'tokB');
      const pp = (await post(`/api/challenges/${pari.id}/play`, 'tokB', { inputs: lazy.inputs })).body.challenge;
      assert(pp.winner === 'pari', 'stessa partita non in parità: ' + JSON.stringify(pp).slice(0, 200));
      const [xa] = of(await feed('tokA'), pari.id, 'sfida_chiusa'), [xb] = of(await feed('tokB'), pari.id, 'sfida_chiusa');
      assert(xa?.testo === `Pari con Bruno: posta restituita, +${perleFor(pp.medalFrom)} Perle` && xb?.testo === `Pari con Anna: posta restituita, +${perleFor(pp.medalTo)} Perle`, 'parità: ' + JSON.stringify([xa, xb]));
      const r = of(await feed('tokB'), pari.id, 'sfida_ricevuta')[0];
      assert(r?.testo === 'Anna ti sfida alla Regata: posta 10 Legno e 5 Pietra. Rispondi al Tavolo entro 24 h', 'posta con due risorse: ' + r?.testo);
    });

    await ctx.test('rifiuto → sfida_rifiutata ad Anna; dopo 25 h due GET /api/feed in parallelo danno una sola sfida_scaduta per parte', async () => {
      const d = await sfida({ legno: 10, pietra: 0, perle: 0 });
      await post(`/api/challenges/${d.id}/play`, 'tokA', { inputs: race(d.seed, d.difficulty, true).inputs });
      assert((await post(`/api/challenges/${d.id}/decline`, 'tokB')).status === 200, 'decline');
      const rif = of(await feed('tokA'), d.id, 'sfida_rifiutata');
      assert(rif.length === 1 && !rif[0].letto && rif[0].testo === 'Bruno ha rifiutato: posta restituita', 'rifiutata: ' + JSON.stringify(rif));
      assert(of(await feed('tokB'), d.id, 'sfida_rifiutata').length === 0, 'rifiutata anche a Bruno');
      // la quarta sfida del giorno costa una Perla (Anna le ha vinte): una giocata (aperta) e una no (gioca_sfidante)
      const aperta = await sfida({ legno: 10, pietra: 0, perle: 0 });
      await post(`/api/challenges/${aperta.id}/play`, 'tokA', { inputs: race(aperta.seed, aperta.difficulty, true).inputs });
      const mai = await sfida({ legno: 10, pietra: 0, perle: 0 });
      OFF += 25 * H;
      const [fa1, fb1, fa2, fb2] = await Promise.all([feed('tokA'), feed('tokB'), feed('tokA'), feed('tokB')]);
      for (const [f, chi] of [[fa1, 'A'], [fa2, 'A'], [fb1, 'B'], [fb2, 'B']]) {
        assert(of(f, aperta.id, 'sfida_scaduta').length === 1, `${chi}: scadute (aperta) ${JSON.stringify(of(f, aperta.id))}`);
        assert(of(f, mai.id, 'sfida_scaduta').length === (chi === 'A' ? 1 : 0), `${chi}: scadute (mai giocata) ${JSON.stringify(of(f, mai.id))}`);
      }
      const s = of(fa1, aperta.id, 'sfida_scaduta')[0];
      assert(!s.letto && s.testo === 'La sfida con Bruno è scaduta: posta restituita', 'scaduta: ' + JSON.stringify(s));
      assert(of(fb1, aperta.id, 'sfida_scaduta')[0].testo === 'La sfida con Anna è scaduta: posta restituita', 'scaduta di B');
      const lot = (await get('/api/lot', 'tokA')).body;
      assert(lot.escrow.legno === 0 && Object.keys(lot.holds ?? {}).length === 0, 'posta non rimborsata: ' + JSON.stringify(lot.escrow));
    });

    await ctx.test('letto: { fino } porta nonLetti a 0, una riga nuova resta non letta; massimo 30 righe, recenti prima; 401 senza token, 400 fino rotto', async () => {
      const f0 = await feed('tokB');
      assert(f0.nonLetti > 0, 'Bruno senza righe non lette');
      const fino = f0.items[0].id;
      const r1 = await post('/api/feed/letto', 'tokB', { fino });
      assert(r1.status === 200 && r1.body.ok === true && r1.body.nonLetti === 0, 'letto: ' + JSON.stringify(r1.body));
      assert((await feed('tokB')).items.every((x) => x.letto), 'righe ancora non lette');
      const n = await sfida({ legno: 10, pietra: 0, perle: 0 });
      await post(`/api/challenges/${n.id}/play`, 'tokA', { inputs: race(n.seed, n.difficulty, true).inputs });
      const r2 = await post('/api/feed/letto', 'tokB', { fino });
      const f1 = await feed('tokB');
      assert(r2.body.nonLetti === 1 && f1.nonLetti === 1 && f1.items[0].sfida === n.id && !f1.items[0].letto && f1.items[0].id > fino, 'riga dopo fino: ' + JSON.stringify(f1.items[0]));
      assert((await post(`/api/challenges/${n.id}/decline`, 'tokB')).status === 200, 'decline');
      assert((await post('/api/feed/letto', 'tokB', {})).body.nonLetti === 0, 'letto senza fino');
      assert((await post('/api/feed/letto', 'tokB', { fino: 'tutto' })).status === 400, 'fino rotto accettato');
      assert((await get('/api/feed')).status === 401 && (await post('/api/feed/letto', undefined, {})).status === 401, 'feed senza token');
      // oltre 30 righe per Anna: sfide rifiutate subito, 3 al giorno (gratis) spostando l'orologio
      for (let day = 0; day < 10; day++) {
        OFF += 25 * H;
        for (let i = 0; i < 3; i++) {
          const c = await sfida({ legno: 10, pietra: 0, perle: 0 });
          assert((await post(`/api/challenges/${c.id}/decline`, 'tokB')).status === 200, 'decline in serie');
        }
      }
      const fa = await feed('tokA');
      assert(fa.items.length === 30, 'righe: ' + fa.items.length);
      assert(fa.items.every((x, i) => i === 0 || (x.id < fa.items[i - 1].id && x.quando <= fa.items[i - 1].quando)), 'non in ordine: ' + fa.items.map((x) => x.id).join());
      assert(fa.items[0].tipo === 'sfida_rifiutata' && fa.nonLetti > 30, `nonLetti ${fa.nonLetti}`);
      ctx.log(`Anna: ${fa.items.length} righe mostrate, ${fa.nonLetti} non lette`);
    });

    await ctx.test('nessun errore del server nel log di wrangler (percorsi normali)', async () => {
      await sleep(300);
      const errs = log.split('\n').filter((l) => /\[marea\]|Uncaught|Error:/.test(l));
      assert(errs.length === 0, 'errori nel log:\n' + errs.slice(0, 10).join('\n'));
    });
  } finally {
    for (const w of sockets) try { w.close(); } catch { /* già chiusa */ }
    if (dev) { try { process.kill(-dev.pid, 'SIGTERM'); } catch { /* già finito */ } await sleep(500); try { process.kill(-dev.pid, 'SIGKILL'); } catch { /* ok */ } }
    fs.rmSync(persist, { recursive: true, force: true });
  }
}
