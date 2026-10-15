// Templari insieme, ripresa (#326, PROTOCOL §9): la partita insieme sopravvive alla linea persa e al riavvio del server. Prima Bea perde la
// linea (socket chiusa senza `esco`) e si ricollega con `?run=&idx=&n=`: riceve i turni persi e continua. Poi wrangler dev si spegne e si
// riaccende a metà partita (come il DO a ogni deploy): tutte e due si ricollegano, il server ricarica la partita dallo storage, chiede la
// `storia` dei turni che non aveva salvato e riparte. I due «client» sono i piloti della sim avanzati SOLO coi turni del server: i turni
// devono restare uguali per tutte e due e, a fine partita, il server deve rigiocare la stessa partita (stesso hash) e pagare.
// wrangler dev locale (lanciato con node, va anche su Windows).
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
export const timeout = 360000;

const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Un giocatore: i turni arrivati (indice = numero del turno, come `prossimo` del client vero) e gli altri messaggi, attraverso le socket
 *  che apre una dopo l'altra. */
function giocatore(tok) {
  const p = { tok, ws: null, turni: [], msgs: [], letti: 0, chiuso: null, run: null, io: 0 };
  p.apri = (base, extra = '') => new Promise((res, rej) => {
    const ws = new WebSocket(base.replace('http', 'ws') + '/ws/templari?t=' + tok + extra);
    p.ws = ws; p.chiuso = null;
    ws.addEventListener('message', (e) => {
      if (p.ws !== ws) return;
      let m; try { m = JSON.parse(String(e.data)); } catch { return; }
      if (m.t === 'T') { if (m.n === p.turni.length) p.turni.push(m); else if (m.n > p.turni.length) p.buco = `${tok}: turno ${m.n} con ${p.turni.length} arrivati`; return; }
      p.msgs.push(m);
    });
    ws.addEventListener('close', (e) => { if (p.ws === ws) p.chiuso = e.code; });
    ws.addEventListener('open', () => res(), { once: true });
    ws.addEventListener('error', () => rej(new Error('socket non aperta')), { once: true });
  });
  p.manda = (m) => { try { if (p.ws?.readyState === 1) p.ws.send(JSON.stringify(m)); } catch { /* chiusa */ } };
  p.aspetta = async (pred, ms = 10000, cosa = '') => {
    const t0 = Date.now();
    for (;;) {
      for (let i = p.letti; i < p.msgs.length; i++) if (pred(p.msgs[i])) { p.letti = i + 1; return p.msgs[i]; }
      if (Date.now() - t0 > ms) throw new Error(`messaggio non arrivato (${cosa}); ultimi: ${JSON.stringify(p.msgs.slice(-3)).slice(0, 300)}`);
      await sleep(20);
    }
  };
  /** Si ricollega alla partita (riprova finché il server non risponde) e risponde alla ripresa con la storia, come il client vero. */
  p.ricollega = async (base, ms = 40000) => {
    const t0 = Date.now();
    for (;;) {
      try { await p.apri(base, `&run=${p.run}&idx=${p.io}&n=${p.turni.length}`); break; } catch { if (Date.now() - t0 > ms) throw new Error(p.tok + ': non si ricollega'); await sleep(700); }
    }
    const r = await p.aspetta((m) => m.t === 'ripresa' || m.t === 'errore', 15000, p.tok + ' ripresa');
    if (r.t === 'errore') throw new Error(p.tok + ': ' + r.msg);
    p.manda({ t: 'storia', turni: p.turni.slice(r.n) });
    return r.n;
  };
  p.chiudi = (code = 4000) => { try { p.ws?.close(code); } catch { /* chiusa */ } };
  return p;
}

export default async function (ctx) {
  const { assert } = ctx;
  const SERVER = path.join(ctx.ROOT, 'apps/server');
  const WRANGLER = path.join(ctx.ROOT, 'node_modules/wrangler/bin/wrangler.js');
  const persist = path.join(ctx.OUT, `m4tpr-${process.pid}`);
  const env = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' };
  const wr = (...a) => execFileSync(process.execPath, [WRANGLER, ...a], { cwd: SERVER, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 90000 }).toString();
  const sim = async (f) => import(pathToFileURL(path.join(ctx.ROOT, 'packages/sim/src', f)).href);
  const { createRng } = await sim('rng.ts');
  const { templari, stepTemplariInsieme } = await sim('templari/templari.ts');
  const { quantizeDungeon } = await sim('dungeon/replay.ts');
  const { usa } = await sim('templari/stato.ts');
  const giocatori = [];
  let dev = null, log = '', port = 0, inspector = 0;
  const spegni = async () => {
    if (!dev) return;
    const d = dev; dev = null;
    if (process.platform === 'win32') { try { execFileSync('taskkill', ['/pid', String(d.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* già finito */ } }
    else { try { process.kill(-d.pid, 'SIGTERM'); } catch { /* già finito */ } await sleep(500); try { process.kill(-d.pid, 'SIGKILL'); } catch { /* ok */ } }
  };
  const accendi = async () => {
    dev = spawn(process.execPath, [WRANGLER, 'dev', '--local', '--ip', '127.0.0.1', '--port', String(port), '--inspector-port', String(inspector),
      '--assets', ctx.distDir, '--persist-to', persist, '--show-interactive-dev-session=false'], { cwd: SERVER, env, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
    dev.stdout.on('data', (d) => (log += d)); dev.stderr.on('data', (d) => (log += d));
    let up = false;
    for (let i = 0; i < 160 && !up; i++) { try { up = (await fetch(base() + '/api/ping')).ok; } catch { /* non ancora */ } if (!up) await sleep(500); }
    if (!up) throw new Error('wrangler dev non risponde:\n' + log.split('\n').slice(-20).join('\n'));
  };
  const base = () => `http://127.0.0.1:${port}`;
  const post = async (tok, p, b) => { const r = await fetch(base() + p, { method: 'POST', headers: { 'x-token': tok, 'content-type': 'application/json' }, body: JSON.stringify(b ?? {}) }); return { status: r.status, body: await r.json() }; };
  try {
    fs.rmSync(persist, { recursive: true, force: true });
    wr('d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', persist);
    wr('d1', 'execute', 'DB', '--local', '--persist-to', persist, '--command',
      "INSERT INTO persone (id, nome, token, slot) VALUES ('ada', 'Ada', 'tok_ada', 0), ('bea', 'Bea', 'tok_bea', 1);");
    port = await freePort(); inspector = await freePort();
    await accendi();

    const ada = giocatore('tok_ada'), bea = giocatore('tok_bea'), conn = [ada, bea];
    giocatori.push(ada, bea);
    let s = null, n = 0;
    const rng = [], mandato = ['', ''];
    /** I due piloti giocano sui turni arrivati ad Ada (e controllano che Bea abbia gli stessi) per `ms`, o finché `fino()`; `ferma[i]` = l'eroe i
     *  sta fermo. */
    const gioca = async (ms, fino = () => false, ferma = [false, false]) => {
      const t0 = Date.now();
      while (!s.done && Date.now() - t0 < ms && !fino()) {
        const t = ada.turni[n];
        if (!t) { await sleep(10); continue; }
        if (bea.turni[n]) assert(JSON.stringify(bea.turni[n]) === JSON.stringify(t), `turno ${n} diverso tra le due`);
        for (const i of t.via ?? []) templari.act(s, { t: 'ritira', eroe: i });
        for (let k = 0; k < 3 && !s.done; k++) stepTemplariInsieme(s, t.f.map((x) => ({ mx: x[0] / 8, my: x[1] / 8, a: (x[2] & 1) !== 0, b: (x[2] & 2) !== 0, c: (x[2] & 4) !== 0, d: (x[2] & 8) !== 0 })));
        n++;
        for (let i = 0; i < 2; i++) {
          const h = s.eroi[i];
          if (h.giu || h.fuori) continue;
          usa(s, i);
          const q = ferma[i] ? { mx: 0, my: 0, a: false, b: false, c: false, d: false } : quantizeDungeon(templari.autopilot(s, rng[i]));
          const x = [Math.round(q.mx * 8), Math.round(q.my * 8), (q.a ? 1 : 0) | (q.b ? 2 : 0) | (q.c ? 4 : 0) | (q.d ? 8 : 0)], k = x.join();
          if (k !== mandato[i]) { mandato[i] = k; conn[i].manda({ t: 'in', f: x }); }
        }
      }
    };

    await ctx.test('si parte in due: turni a tutte e due', async () => {
      await ada.apri(base()); await bea.apri(base());
      await bea.aspetta((m) => m.t === 'sala' && m.membri.length === 2, 10000, 'sala da 2');
      bea.manda({ t: 'via' });
      const pa = await ada.aspetta((m) => m.t === 'parte', 15000, 'parte ada'), pb = await bea.aspetta((m) => m.t === 'parte', 15000, 'parte bea');
      ada.run = pa.run; ada.io = pa.io; bea.run = pb.run; bea.io = pb.io;
      assert(pa.run === pb.run && pa.io === 0 && pb.io === 1, 'parte: ' + JSON.stringify([pa, pb]).slice(0, 200));
      s = templari.create({ seed: pa.seed, opzioni: { subito: true, eroi: 2 } });
      rng.push(createRng(pa.seed).fork('a'), createRng(pa.seed + 1).fork('b'));
      ada.manda({ t: 'carico' }); bea.manda({ t: 'carico' });
      await gioca(6000);
      assert(n > 60, 'pochi turni: ' + n);
    });

    await ctx.test('Bea perde la linea: il suo eroe sta fermo, si ricollega, riceve i turni persi e continua', async () => {
      bea.chiudi(4000);
      const prima = bea.turni.length;
      await gioca(2500, () => false, [false, true]);
      assert(ada.turni.length > prima + 20, 'Ada non va avanti senza Bea');
      const ferma = ada.turni.slice(prima + 2).every((t) => t.f[1].join() === '0,0,0');
      assert(ferma, 'l’eroe di Bea staccata non sta fermo');
      const da = await bea.ricollega(base());
      mandato[1] = '';
      assert(da >= ada.turni.length - 2, `ripresa al turno ${da}, Ada ne ha ${ada.turni.length}`);
      const t0 = Date.now();
      while (bea.turni.length < ada.turni.length && Date.now() - t0 < 5000) await sleep(20);
      assert(bea.turni.length >= ada.turni.length - 1, `Bea non ha recuperato: ${bea.turni.length} su ${ada.turni.length}`);
      assert(!bea.buco, bea.buco);
      for (let k = 0; k < Math.min(ada.turni.length, bea.turni.length); k++) assert(JSON.stringify(ada.turni[k]) === JSON.stringify(bea.turni[k]), `turno ${k} diverso dopo la ripresa`);
      await gioca(3000);
    });

    let salvato = 0;
    await ctx.test('il server si riavvia a metà partita: tutte e due si ricollegano, riprende dal salvataggio con la storia', async () => {
      await gioca(4000); // almeno un salvataggio dopo la ripresa di Bea (ogni 5 s)
      const na = ada.turni.length;
      await spegni();
      await sleep(300);
      assert(ada.chiuso !== null && bea.chiuso !== null, 'le socket non si sono chiuse');
      await accendi();
      const [ra, rb] = await Promise.all([ada.ricollega(base()), bea.ricollega(base())]);
      salvato = ra;
      ctx.log(`riavvio: Ada aveva ${na} turni, Bea ${bea.turni.length}; il server aveva salvato fino al ${ra}`);
      mandato[0] = mandato[1] = ''; // come il client vero: dopo un ricollegamento l'input si rimanda
      // la seconda può avere una ripresa più avanti: la storia della prima è già nel log
      assert(ra > 0 && ra <= na && rb >= Math.min(ra, rb) && rb <= Math.max(na, bea.turni.length), `salvataggio strano: ${ra} e ${rb} su ${na}`);
      const t0 = Date.now();
      while (ada.turni.length < na + 40 && Date.now() - t0 < 20000) await sleep(20);
      assert(ada.turni.length >= na + 40, `dopo il riavvio i turni non ripartono: ${ada.turni.length} (prima ${na})`);
      assert(!ada.buco && !bea.buco, ada.buco ?? bea.buco);
      await gioca(3000);
    });

    await ctx.test('fine partita: il server rigioca il log ricostruito, stesso hash dei client, e paga', async () => {
      await gioca(4000);
      bea.manda({ t: 'esco' });
      // poi Ada sta ferma finché gli zombie non la prendono (la partita finisce da sé: hash confrontabile)
      await gioca(180000, () => false, [true, true]);
      const r = templari.result(s);
      ctx.log(`turni ${n}, ondata ${r.ondata}, superate ${r.superate}, esito ${r.esito}, ripresa dal turno ${salvato}`);
      assert(s.done && r.esito === 'morto', 'la partita non è finita: ' + r.esito);
      const ra = await post('tok_ada', '/api/templari/finish', {});
      assert(ra.status === 200, 'finish ada: ' + ra.status + ' ' + JSON.stringify(ra.body).slice(0, 200));
      assert(ra.body.result.hash === r.hash, `hash diverso: server ${ra.body.result.hash}, client ${r.hash}`);
      assert(ra.body.result.superate === r.superate, `ondate: server ${ra.body.result.superate}, client ${r.superate}`);
      const rb = await post('tok_bea', '/api/templari/finish', {});
      assert(rb.status === 200, 'finish bea: ' + rb.status + ' ' + JSON.stringify(rb.body).slice(0, 200));
    });

    await ctx.test('nessun errore interno nel log di wrangler', async () => {
      assert(/ricaricata al turno/.test(log), 'la partita non è stata ricaricata dallo storage');
      assert(!/\[marea\] (lot error|errore)/.test(log), 'errori nel log:\n' + log.split('\n').filter((l) => /\[marea\]/.test(l)).slice(0, 5).join('\n'));
    });
  } finally {
    for (const g of giocatori) g.chiudi(1000);
    await spegni();
    await sleep(300);
    try { fs.rmSync(persist, { recursive: true, force: true }); } catch { /* file ancora aperti su Windows */ }
  }
}
