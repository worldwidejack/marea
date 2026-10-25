// M1 · Fetta 3, lato server: look che arriva in presenza (POST /api/look → Zone → snap), emote con pausa di 800 ms senza eco, feed nel
// DO Sfide con le firme al libro degli ospiti (testi composti nel Worker, una al giorno, letto/non letto, 30 righe, niente doppioni in parallelo).
// Solo API + WebSocket grezzi, niente browser. wrangler dev locale con `--var TEST_CLOCK:1` (X-Test-Now-Offset sposta «adesso»).
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
export const timeout = 300000;

const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MIN = 60_000, H = 60 * MIN;

export default async function (ctx) {
  const { assert } = ctx;
  const SERVER = path.join(ctx.ROOT, 'apps/server');
  const persist = path.join(ctx.OUT, `m1serverf3-${process.pid}`);
  const env = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' };
  const wr = (...a) => execFileSync('npx', ['--no-install', 'wrangler', ...a], { cwd: SERVER, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 }).toString();
  const avatar = JSON.parse(fs.readFileSync(path.join(ctx.ROOT, 'packages/content/src/avatar.json'), 'utf8'));

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
    const firma = (t, isola, emote = 'saluto') => post('/api/libro/firma', t, { isola, emote });
    const wsUrl = (t) => `ws://127.0.0.1:${port}/ws/zone/porto?t=${t}`;
    const openWs = (t, hello = true) => new Promise((res, rej) => {
      const w = new WebSocket(wsUrl(t)); w.msgs = []; w.closed = null; sockets.push(w);
      w.onmessage = (e) => w.msgs.push(JSON.parse(e.data)); w.onclose = (e) => (w.closed = e.code); w.onerror = () => {};
      w.onopen = () => { if (hello) w.send(JSON.stringify({ t: 'hello', v: 1, build: 'test' })); res(w); };
      setTimeout(() => rej(new Error('ws timeout')), 5000);
    });
    const waitFor = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = fn(); if (v) return v; await sleep(20); } return fn(); };

    const baseLook = { pelle: 1, capelli: 1, coloreCapelli: 1, vestito: 1, cappello: 0 };
    const paid = avatar.cappelli.findIndex((h) => h.monete > 0);
    await ctx.test('look: indici validi 200, fuori range 400, cappello a pagamento non posseduto 400', async () => {
      assert((await post('/api/look', 'tokA', baseLook)).status === 200, 'look valido rifiutato');
      const bad = await post('/api/look', 'tokA', { ...baseLook, vestito: avatar.vestiti.length });
      assert(bad.status === 400 && typeof bad.body.error === 'string', 'vestito fuori range: ' + bad.status);
      assert((await post('/api/look', 'tokA', { ...baseLook, pelle: -1 })).status === 400, 'pelle negativa accettata');
      const hat = await post('/api/look', 'tokA', { ...baseLook, cappello: paid });
      assert(hat.status === 400 && /compralo/.test(hat.body.error), 'cappello a pagamento non posseduto: ' + JSON.stringify(hat.body));
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
      const atteso = { ...nuovo, abito: 0 }; // chi gioca senza vestito del Mercante ha quello di base (Zone.asLook)
      assert(JSON.stringify(snap.peers.find((p) => p.id === 'anna').look) === JSON.stringify(atteso), 'look nello snap: ' + JSON.stringify(snap));
      ctx.log(`look → snap di Bruno in ${ms} ms`);
      await sleep(250);
      assert(!wa.msgs.some((m) => m.t === 'snap' && m.peers.some((p) => p.id === 'anna')), 'Anna ha ricevuto il proprio look: ' + JSON.stringify(wa.msgs));
      const wc = await openWs('tokC');
      const wel = await waitFor(() => wc.msgs.find((m) => m.t === 'welcome'), 2000);
      assert(JSON.stringify(wel?.peers.find((p) => p.id === 'anna')?.look) === JSON.stringify(atteso), 'welcome della terza connessione: ' + JSON.stringify(wel).slice(0, 300));
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

    await ctx.test('feed: Anna firma il libro di Bruno → una riga «visita» a Bruno col testo e il saluto, ad Anna niente; una firma al giorno', async () => {
      assert((await feed('tokA')).items.length === 0 && (await feed('tokB')).items.length === 0, 'righe prima delle firme');
      const r = await firma('tokA', 'bruno');
      assert(r.status === 200, 'firma: ' + r.status + ' ' + JSON.stringify(r.body).slice(0, 200));
      const fb = await feed('tokB');
      const [v] = fb.items;
      assert(fb.items.length === 1 && v.tipo === 'visita' && v.da === 'anna' && !v.letto && v.emote === 'saluto' && fb.nonLetti === 1, 'visita: ' + JSON.stringify(fb));
      assert(v.testo === 'Anna è passato da casa tua e ha firmato il libro', 'testo: ' + v.testo);
      assert(Math.abs(fb.now - Date.now() - OFF) < 60_000, 'now del feed senza orologio di test');
      assert((await feed('tokA')).items.length === 0, 'riga ad Anna per la propria firma');
      assert((await firma('tokA', 'bruno')).status === 409, 'seconda firma nello stesso giorno accettata');
      assert((await feed('tokB')).items.length === 1, 'doppione dopo la seconda firma');
      assert((await firma('tokA', 'anna')).status === 409, 'firma sul proprio libro accettata');
      OFF += 25 * H;
      assert((await firma('tokA', 'bruno', 'esulta')).status === 200, 'firma del giorno dopo');
      const fb2 = await feed('tokB');
      assert(fb2.items.length === 2 && fb2.items[0].emote === 'esulta' && fb2.nonLetti === 2, 'giorno dopo: ' + JSON.stringify(fb2.items));
    });

    await ctx.test('due firme in parallelo sullo stesso libro: una sola passa, una sola riga', async () => {
      const rs = await Promise.all([firma('tokA', 'carlo'), firma('tokA', 'carlo')]);
      assert(rs.filter((r) => r.status === 200).length === 1, 'esiti: ' + rs.map((r) => r.status));
      const fc = await feed('tokC');
      assert(fc.items.filter((x) => x.tipo === 'visita' && x.da === 'anna').length === 1, 'righe di Carlo: ' + JSON.stringify(fc.items));
    });

    await ctx.test('letto: { fino } porta nonLetti a 0, una riga nuova resta non letta; massimo 30 righe, recenti prima; 401 senza token, 400 fino rotto', async () => {
      const f0 = await feed('tokB');
      assert(f0.nonLetti > 0, 'Bruno senza righe non lette');
      const fino = f0.items[0].id;
      const r1 = await post('/api/feed/letto', 'tokB', { fino });
      assert(r1.status === 200 && r1.body.ok === true && r1.body.nonLetti === 0, 'letto: ' + JSON.stringify(r1.body));
      assert((await feed('tokB')).items.every((x) => x.letto), 'righe ancora non lette');
      assert((await firma('tokC', 'bruno')).status === 200, 'firma di Carlo');
      const r2 = await post('/api/feed/letto', 'tokB', { fino });
      const f1 = await feed('tokB');
      assert(r2.body.nonLetti === 1 && f1.nonLetti === 1 && f1.items[0].da === 'carlo' && !f1.items[0].letto && f1.items[0].id > fino, 'riga dopo fino: ' + JSON.stringify(f1.items[0]));
      assert((await post('/api/feed/letto', 'tokB', {})).body.nonLetti === 0, 'letto senza fino');
      assert((await post('/api/feed/letto', 'tokB', { fino: 'tutto' })).status === 400, 'fino rotto accettato');
      assert((await get('/api/feed')).status === 401 && (await post('/api/feed/letto', undefined, {})).status === 401, 'feed senza token');
      // oltre 30 righe per Bruno: Anna e Carlo firmano il suo libro un giorno dopo l'altro, spostando l'orologio
      for (let day = 0; day < 16; day++) {
        OFF += 25 * H;
        for (const t of ['tokA', 'tokC']) assert((await firma(t, 'bruno')).status === 200, 'firma in serie');
      }
      const fb = await feed('tokB');
      assert(fb.items.length === 30, 'righe: ' + fb.items.length);
      assert(fb.items.every((x, i) => i === 0 || (x.id < fb.items[i - 1].id && x.quando <= fb.items[i - 1].quando)), 'non in ordine: ' + fb.items.map((x) => x.id).join());
      assert(fb.items[0].tipo === 'visita' && fb.nonLetti > 30, `nonLetti ${fb.nonLetti}`);
      ctx.log(`Bruno: ${fb.items.length} righe mostrate, ${fb.nonLetti} non lette`);
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
