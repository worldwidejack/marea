// Templari insieme lato server (PROTOCOL.md §9): il DO TemplariInsieme dietro `/ws/templari`, provato con WebSocket da Node (niente browser).
// Sala (in ordine, da soli non si parte), SI PARTE → `parte` con lo stesso seed e io 0/1 a tutti e la partita insieme aperta nel lotto di
// ciascuno; carico → turni ogni 50 ms con un input per eroe; chi esce compare in `via` del turno dopo; a fine partita POST
// /api/templari/finish senza input: il DO del lotto rigioca il log della squadra. La partita la giocano qui i due piloti della sim sui turni
// del server (come i client): stesso hash e stesse ondate del server, e il premio di chi è uscito prima conta le ondate fino a lì.
// wrangler dev locale (lanciato con node, va anche su Windows).
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
export const timeout = 300000;

const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Socket di prova: tiene tutti i messaggi; `aspetta(pred)` risolve col primo (non ancora letto) che soddisfa pred. */
function apri(base, token) {
  const ws = new WebSocket(base.replace('http', 'ws') + '/ws/templari?t=' + token);
  const c = { ws, msgs: [], letti: 0, chiuso: null, turni: [] };
  ws.addEventListener('message', (e) => { let m; try { m = JSON.parse(String(e.data)); } catch { m = { t: '?', raw: e.data }; } if (m.t === 'T') c.turni.push(m); else c.msgs.push(m); });
  ws.addEventListener('close', (e) => { c.chiuso = e.code; });
  c.aperto = new Promise((res, rej) => { ws.addEventListener('open', () => res(), { once: true }); ws.addEventListener('error', () => rej(new Error('socket non aperta')), { once: true }); });
  c.manda = (m) => ws.send(typeof m === 'string' ? m : JSON.stringify(m));
  c.aspetta = async (pred, ms = 8000, cosa = '') => {
    const t0 = Date.now();
    for (;;) {
      for (let i = c.letti; i < c.msgs.length; i++) if (pred(c.msgs[i])) { c.letti = i + 1; return c.msgs[i]; }
      if (Date.now() - t0 > ms) throw new Error(`messaggio non arrivato (${cosa}); ultimi: ${JSON.stringify(c.msgs.slice(-3)).slice(0, 300)}`);
      await sleep(20);
    }
  };
  c.sala = (pred = () => true, cosa = 'sala') => c.aspetta((m) => m.t === 'sala' && pred(m), 8000, cosa);
  c.chiudi = () => { try { ws.close(); } catch { /* chiusa */ } };
  return c;
}

export default async function (ctx) {
  const { assert } = ctx;
  const SERVER = path.join(ctx.ROOT, 'apps/server');
  const WRANGLER = path.join(ctx.ROOT, 'node_modules/wrangler/bin/wrangler.js');
  const persist = path.join(ctx.OUT, `m4tpi-${process.pid}`);
  const env = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' };
  const wr = (...a) => execFileSync(process.execPath, [WRANGLER, ...a], { cwd: SERVER, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 90000 }).toString();
  const sim = async (f) => import(pathToFileURL(path.join(ctx.ROOT, 'packages/sim/src', f)).href);
  const { createRng } = await sim('rng.ts');
  const { templari, stepTemplariInsieme } = await sim('templari/templari.ts');
  const { quantizeDungeon } = await sim('dungeon/replay.ts');
  const { usa } = await sim('templari/stato.ts');
  const { TEMPLARI } = await import(pathToFileURL(path.join(ctx.ROOT, 'packages/content/src/templari.ts')).href);
  const socket = [];
  let dev = null, log = '';
  const spegni = async () => {
    if (!dev) return;
    if (process.platform === 'win32') { try { execFileSync('taskkill', ['/pid', String(dev.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* già finito */ } }
    else { try { process.kill(-dev.pid, 'SIGTERM'); } catch { /* già finito */ } await sleep(500); try { process.kill(-dev.pid, 'SIGKILL'); } catch { /* ok */ } }
  };
  try {
    fs.rmSync(persist, { recursive: true, force: true });
    wr('d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', persist);
    wr('d1', 'execute', 'DB', '--local', '--persist-to', persist, '--command',
      "INSERT INTO persone (id, nome, token, slot) VALUES ('ada', 'Ada', 'tok_ada', 0), ('bea', 'Bea', 'tok_bea', 1), ('cid', 'Cid', 'tok_cid', 2);");
    const port = await freePort(), inspector = await freePort();
    dev = spawn(process.execPath, [WRANGLER, 'dev', '--local', '--ip', '127.0.0.1', '--port', String(port), '--inspector-port', String(inspector),
      '--assets', ctx.distDir, '--persist-to', persist, '--show-interactive-dev-session=false'], { cwd: SERVER, env, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
    dev.stdout.on('data', (d) => (log += d)); dev.stderr.on('data', (d) => (log += d));
    const base = `http://127.0.0.1:${port}`;
    let up = false;
    for (let i = 0; i < 160 && !up; i++) { try { up = (await fetch(base + '/api/ping')).ok; } catch { /* non ancora */ } if (!up) await sleep(500); }
    if (!up) throw new Error('wrangler dev non risponde:\n' + log.split('\n').slice(-20).join('\n'));
    const entra = async (n) => { const c = apri(base, 'tok_' + n); socket.push(c); await c.aperto; return c; };
    const post = async (tok, p, b) => { const r = await fetch(base + p, { method: 'POST', headers: { 'x-token': tok, 'content-type': 'application/json' }, body: JSON.stringify(b ?? {}) }); return { status: r.status, body: await r.json() }; };
    const lot = async (tok) => (await (await fetch(base + '/api/lot', { headers: { 'x-token': tok } })).json());

    let ada, bea, parte;
    await ctx.test('sala: in ordine, da soli non si parte; SI PARTE → stesso seed a tutti e partita insieme nel lotto', async () => {
      const no = await fetch(base + '/ws/templari');
      assert(no.status === 426, 'senza WebSocket: ' + no.status);
      ada = await entra('ada');
      const s1 = await ada.sala((m) => m.membri.length === 1, 'ada sola');
      assert(s1.max === 4 && s1.membri[0].id === 'ada' && s1.membri[0].nome === 'Ada', 'sala 1: ' + JSON.stringify(s1));
      ada.manda({ t: 'via' });
      const e = await ada.aspetta((m) => m.t === 'errore', 8000, 'errore da sola');
      assert(/almeno un compagno/.test(e.msg), 'errore: ' + e.msg);
      bea = await entra('bea');
      const s2 = await bea.sala((m) => m.membri.length === 2, 'bea vede 2');
      assert(s2.membri.map((x) => x.id).join() === 'ada,bea', 'ordine: ' + s2.membri.map((x) => x.id));
      bea.manda({ t: 'via' });
      const pa = await ada.aspetta((m) => m.t === 'parte', 15000, 'parte ada'), pb = await bea.aspetta((m) => m.t === 'parte', 15000, 'parte bea');
      assert(pa.seed === pb.seed && pa.run === pb.run && pa.io === 0 && pb.io === 1 && pa.membri.length === 2, 'parte: ' + JSON.stringify([pa, pb]).slice(0, 300));
      parte = pa;
      for (const [tok, idx] of [['tok_ada', 0], ['tok_bea', 1]]) {
        const p = (await lot(tok)).templari?.pending;
        assert(p && p.seed === pa.seed && p.subito === true && p.party?.run === pa.run && p.party?.idx === idx, 'lotto: ' + JSON.stringify(p));
      }
      // la sala si è svuotata: chi arriva adesso è da solo
      const cid = await entra('cid');
      await cid.sala((m) => m.membri.length === 1 && m.membri[0].id === 'cid', 'cid solo in sala');
      cid.chiudi();
    });

    await ctx.test('partita: turni a tutti uguali, i piloti giocano sui turni, chi esce va in `via`; il server rigioca e paga', async () => {
      ada.manda({ t: 'carico' }); bea.manda({ t: 'carico' });
      // i due «client»: la stessa sim, avanzata SOLO coi turni del server; ognuno manda il suo input (il pilota) quando cambia
      const s = templari.create({ seed: parte.seed, opzioni: { subito: true, eroi: 2 } });
      const rng = [createRng(parte.seed).fork('a'), createRng(parte.seed + 1).fork('b')], conn = [ada, bea], mandato = ['', ''];
      let n = 0, beaFuori = false, uscitaBea = -1;
      const t0 = Date.now();
      // bea esce dopo 20 s; poi ada sta ferma finché gli zombie non la prendono (la partita finisce da sé: hash confrontabile)
      while (!s.done && Date.now() - t0 < 180000) {
        const t = ada.turni[n];
        if (!t) { await sleep(10); continue; }
        if (bea.turni[n]) assert(JSON.stringify(bea.turni[n]) === JSON.stringify(t), `turno ${n} diverso tra i due`);
        for (const i of t.via ?? []) { templari.act(s, { t: 'ritira', eroe: i }); if (i === 1) uscitaBea = s.tick; }
        for (let k = 0; k < 3 && !s.done; k++) stepTemplariInsieme(s, t.f.map((x) => ({ mx: x[0] / 8, my: x[1] / 8, a: (x[2] & 1) !== 0, b: (x[2] & 2) !== 0, c: (x[2] & 4) !== 0, d: (x[2] & 8) !== 0 })));
        n++;
        for (let i = 0; i < 2; i++) {
          if (i === 1 && beaFuori) continue;
          const h = s.eroi[i];
          if (h.giu || h.fuori) continue;
          usa(s, i);
          const q = beaFuori ? { mx: 0, my: 0, a: false, b: false, c: false, d: false } : quantizeDungeon(templari.autopilot(s, rng[i]));
          const x = [Math.round(q.mx * 8), Math.round(q.my * 8), (q.a ? 1 : 0) | (q.b ? 2 : 0) | (q.c ? 4 : 0) | (q.d ? 8 : 0)], k = x.join();
          if (k !== mandato[i]) { mandato[i] = k; conn[i].manda({ t: 'in', f: x }); }
        }
        if (!beaFuori && Date.now() - t0 > 20000) { beaFuori = true; bea.manda({ t: 'esco' }); }
      }
      const r = templari.result(s);
      ctx.log(`turni ${n}, ondata ${r.ondata}, superate ${r.superate}, uccisioni ${r.uccisioni}, esito ${r.esito}, bea uscita al tick ${uscitaBea}`);
      assert(n > 100, 'pochi turni: ' + n);
      assert(uscitaBea > 0, 'l’uscita di bea non è arrivata in `via`');
      const ra = await post('tok_ada', '/api/templari/finish', {});
      assert(ra.status === 200, 'finish ada: ' + ra.status + ' ' + JSON.stringify(ra.body).slice(0, 200));
      assert(s.done && r.esito === 'morto', 'la partita non è finita: ' + r.esito);
      assert(ra.body.result.hash === r.hash, `hash diverso: server ${ra.body.result.hash}, client ${r.hash}`);
      assert(ra.body.result.superate === r.superate, `ondate: server ${ra.body.result.superate}, client ${r.superate}`);
      const sup = Math.min(TEMPLARI.premio.maxOndate, r.superate), pp = TEMPLARI.premio.perOndata;
      assert(ra.body.premio.legno === pp.legno * sup, 'premio di ada: ' + JSON.stringify(ra.body.premio));
      assert(ra.body.lot.templari.pending === null, 'partita di ada ancora aperta');
      const rb = await post('tok_bea', '/api/templari/finish', {});
      assert(rb.status === 200, 'finish bea: ' + rb.status + ' ' + JSON.stringify(rb.body).slice(0, 200));
      assert(rb.body.result.superate <= r.superate, `bea uscita prima ma con più ondate: ${rb.body.result.superate} > ${r.superate}`);
      const again = await post('tok_ada', '/api/templari/finish', {});
      assert(again.status === 409, 'la stessa partita si chiude due volte: ' + again.status);
    });

    await ctx.test('nessun errore interno nel log di wrangler', async () => {
      assert(!/\[marea\] (lot error|errore)/.test(log), 'errori nel log:\n' + log.split('\n').filter((l) => /\[marea\]/.test(l)).slice(0, 5).join('\n'));
    });
  } finally {
    for (const c of socket) c.chiudi();
    await spegni();
    await sleep(300);
    try { fs.rmSync(persist, { recursive: true, force: true }); } catch { /* file ancora aperti su Windows */ }
  }
}
