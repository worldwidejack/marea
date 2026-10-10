// Corse tra amici lato server (PROTOCOL.md §8): il DO GaraAmici dietro `/ws/gara`, provato con WebSocket da Node (niente browser).
// Sala (entrata in ordine, veicolo da `ciao`, piena a 6, altra scheda), VIA (pista della Spiaggia, almeno 2, una gara alla volta),
// `parte` con io 0/1 e stesso seed, relay di `p` solo agli altri (al massimo 25 al secondo), `fine` e uscite → sala con gara null,
// messaggi rotti → chiusura 1003. wrangler dev locale come m4_templari_server.
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
export const timeout = 180000;

const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const POS = [1, 0, 12.5, -0.3, 0.1, 0.2, 0, 18.4, 0, 1, 0];

/** Socket di prova: tiene tutti i messaggi; `aspetta(pred)` risolve col primo (non ancora letto) che soddisfa pred. */
function apri(base, token) {
  const ws = new WebSocket(base.replace('http', 'ws') + '/ws/gara?t=' + token);
  const c = { ws, msgs: [], letti: 0, chiuso: null };
  ws.addEventListener('message', (e) => { try { c.msgs.push(JSON.parse(String(e.data))); } catch { c.msgs.push({ t: '?', raw: e.data }); } });
  ws.addEventListener('close', (e) => { c.chiuso = e.code; });
  c.aperto = new Promise((res, rej) => { ws.addEventListener('open', () => res(), { once: true }); ws.addEventListener('error', () => rej(new Error('socket non aperta')), { once: true }); });
  c.manda = (m) => ws.send(typeof m === 'string' ? m : JSON.stringify(m));
  c.aspetta = async (pred, ms = 5000, cosa = '') => {
    const t0 = Date.now();
    for (;;) {
      for (let i = c.letti; i < c.msgs.length; i++) if (pred(c.msgs[i])) { c.letti = i + 1; return c.msgs[i]; }
      if (Date.now() - t0 > ms) throw new Error(`messaggio non arrivato (${cosa}); ultimi: ${JSON.stringify(c.msgs.slice(-3)).slice(0, 300)}`);
      await sleep(20);
    }
  };
  c.sala = (pred = () => true, cosa = 'sala') => c.aspetta((m) => m.t === 'sala' && pred(m), 5000, cosa);
  c.chiudi = () => { try { ws.close(); } catch { /* chiusa */ } };
  return c;
}

export default async function (ctx) {
  const { assert } = ctx;
  const SERVER = path.join(ctx.ROOT, 'apps/server');
  const persist = path.join(ctx.OUT, `m4ga-${process.pid}`);
  const env = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' };
  const wr = (...a) => execFileSync('npx', ['--no-install', 'wrangler', ...a], { cwd: SERVER, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 }).toString();
  const nomi = ['ada', 'bea', 'cid', 'dan', 'eva', 'fra', 'gio'];
  const socket = [];
  let dev = null, log = '';
  try {
    fs.rmSync(persist, { recursive: true, force: true });
    wr('d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', persist);
    wr('d1', 'execute', 'DB', '--local', '--persist-to', persist, '--command',
      'INSERT INTO persone (id, nome, token, slot) VALUES ' + nomi.map((n, i) => `('${n}', '${n[0].toUpperCase() + n.slice(1)}', 'tok_${n}', ${i})`).join(', ') + ';');
    const port = await freePort(), inspector = await freePort();
    dev = spawn('npx', ['--no-install', 'wrangler', 'dev', '--local', '--ip', '127.0.0.1', '--port', String(port), '--inspector-port', String(inspector),
      '--assets', ctx.distDir, '--persist-to', persist, '--show-interactive-dev-session=false'], { cwd: SERVER, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    dev.stdout.on('data', (d) => (log += d)); dev.stderr.on('data', (d) => (log += d));
    const base = `http://127.0.0.1:${port}`;
    let up = false;
    for (let i = 0; i < 120 && !up; i++) { try { up = (await fetch(base + '/api/ping')).ok; } catch { /* non ancora */ } if (!up) await sleep(500); }
    if (!up) throw new Error('wrangler dev non risponde:\n' + log.split('\n').slice(-20).join('\n'));
    const entra = async (n) => { const c = apri(base, 'tok_' + n); socket.push(c); await c.aperto; return c; };

    let ada, bea, cid;
    await ctx.test('sala: entrata in ordine, veicolo da ciao (sconosciuto → kart), da soli non si parte', async () => {
      const no = await fetch(base + '/ws/gara');
      assert(no.status === 426, 'senza WebSocket: ' + no.status);
      ada = await entra('ada');
      const s1 = await ada.sala((m) => m.membri.length === 1, 'ada sola');
      assert(s1.max === 6 && s1.gara === null && s1.membri[0].id === 'ada' && s1.membri[0].veicolo === 'kart', 'sala 1: ' + JSON.stringify(s1));
      ada.manda({ t: 'via', pista: 'spiaggia_baia' });
      const e = await ada.aspetta((m) => m.t === 'errore', 5000, 'errore da sola');
      assert(/almeno 2/.test(e.msg), 'errore: ' + e.msg);
      bea = await entra('bea');
      await bea.sala((m) => m.membri.length === 2, 'bea vede 2');
      ada.manda({ t: 'ciao', veicolo: 'moto_acqua' });
      bea.manda({ t: 'ciao', veicolo: 'auto' });
      await ada.sala((m) => m.membri[0].veicolo === 'moto_acqua' && m.membri[1]?.veicolo === 'auto', 'veicoli');
      bea.manda({ t: 'ciao', veicolo: 'razzo' });
      const s2 = await ada.sala((m) => m.membri[1]?.veicolo === 'kart', 'veicolo sconosciuto → kart');
      assert(s2.membri.map((x) => x.id).join() === 'ada,bea', 'ordine: ' + s2.membri.map((x) => x.id));
      assert(s2.membri[0].nome === 'Ada' && s2.membri[0].look && typeof s2.membri[0].look.pelle === 'number', 'membro: ' + JSON.stringify(s2.membri[0]));
    });

    let parteA, parteB;
    await ctx.test('VIA: pista sbagliata no; parte a tutti con io 0 e 1, stesso seed; seconda gara no', async () => {
      bea.manda({ t: 'via', pista: 'prova_anello' });
      const e1 = await bea.aspetta((m) => m.t === 'errore', 5000, 'pista non della spiaggia');
      assert(/Pista/.test(e1.msg), 'errore: ' + e1.msg);
      bea.manda({ t: 'via', pista: 'spiaggia_nessuna' });
      await bea.aspetta((m) => m.t === 'errore', 5000, 'pista inesistente');
      bea.manda({ t: 'via', pista: 'spiaggia_baia' });
      parteA = await ada.aspetta((m) => m.t === 'parte', 5000, 'parte ada');
      parteB = await bea.aspetta((m) => m.t === 'parte', 5000, 'parte bea');
      assert(parteA.io === 0 && parteB.io === 1, `io: ${parteA.io} ${parteB.io}`);
      assert(parteA.gara === parteB.gara && typeof parteA.gara === 'string' && parteA.gara.length > 10, 'gara: ' + parteA.gara + ' ' + parteB.gara);
      assert(parteA.seed === parteB.seed && Number.isInteger(parteA.seed) && parteA.seed >= 0 && parteA.seed < 2 ** 32, 'seed: ' + parteA.seed + ' ' + parteB.seed);
      assert(parteA.pista === 'spiaggia_baia' && parteA.membri.map((x) => x.id).join() === 'ada,bea' && parteA.membri[0].veicolo === 'moto_acqua', 'parte: ' + JSON.stringify(parteA).slice(0, 300));
      const s = await ada.sala((m) => m.gara !== null, 'sala con gara');
      assert(s.gara.pista === 'spiaggia_baia' && s.gara.membri.join() === 'ada,bea', 'gara in sala: ' + JSON.stringify(s.gara));
      ada.manda({ t: 'via', pista: 'spiaggia_porto' });
      const e2 = await ada.aspetta((m) => m.t === 'errore', 5000, 'seconda gara');
      assert(/già una gara/.test(e2.msg), 'errore: ' + e2.msg);
    });

    await ctx.test('posizioni: p girato solo agli altri con l\'indice del mittente, al massimo 25 al secondo', async () => {
      ada.manda({ t: 'p', q: POS });
      const p = await bea.aspetta((m) => m.t === 'p', 5000, 'p di ada a bea');
      assert(p.i === 0 && JSON.stringify(p.q) === JSON.stringify(POS), 'p: ' + JSON.stringify(p));
      bea.manda({ t: 'p', q: POS.map((x) => x + 1) });
      const p2 = await ada.aspetta((m) => m.t === 'p', 5000, 'p di bea ad ada');
      assert(p2.i === 1 && p2.q[0] === 2, 'p2: ' + JSON.stringify(p2));
      ada.manda({ t: 'p', q: [1, 2, 3] }); // forma sbagliata: scartato
      await sleep(1100); // secondo nuovo
      const n0 = bea.msgs.filter((m) => m.t === 'p').length;
      for (let k = 0; k < 60; k++) ada.manda({ t: 'p', q: POS });
      await sleep(600);
      const n = bea.msgs.filter((m) => m.t === 'p').length - n0;
      ctx.log(`raffica di 60 p → ${n} girati`);
      assert(n >= 20 && n <= 50, 'limite p al secondo: ' + n);
      assert(!ada.msgs.some((m) => m.t === 'p' && m.i === 0), 'ada ha ricevuto la sua posizione');
    });

    await ctx.test('fine di tutti: arrivo e ritiro girati agli altri, poi sala con gara null', async () => {
      ada.manda({ t: 'fine', ms: 61234 });
      const f = await bea.aspetta((m) => m.t === 'fine', 5000, 'fine di ada');
      assert(f.i === 0 && f.ms === 61234, 'fine: ' + JSON.stringify(f));
      ada.manda({ t: 'fine', ms: 1 }); // già finita: ignorato
      bea.manda({ t: 'fine', ms: -1 });
      const f2 = await ada.aspetta((m) => m.t === 'fine', 5000, 'ritiro di bea');
      assert(f2.i === 1 && f2.ms === -1, 'fine 2: ' + JSON.stringify(f2));
      await ada.sala((m) => m.gara === null, 'gara chiusa (ada)');
      await bea.sala((m) => m.gara === null, 'gara chiusa (bea)');
      assert(!bea.msgs.some((m) => m.t === 'fine' && m.ms === 1), 'secondo fine di ada girato');
    });

    await ctx.test('uscite in gara: socket chiusa e esco contano come ritiro; ultimo arrivo chiude la gara', async () => {
      cid = await entra('cid');
      await ada.sala((m) => m.membri.length === 3, 'cid in sala');
      cid.manda({ t: 'via', pista: 'spiaggia_lungomare' });
      const pc = await cid.aspetta((m) => m.t === 'parte', 5000, 'parte cid');
      assert(pc.io === 2 && pc.membri.length === 3, 'cid: ' + JSON.stringify(pc).slice(0, 200));
      cid.chiudi();
      const f = await ada.aspetta((m) => m.t === 'fine', 5000, 'cid chiude');
      assert(f.i === 2 && f.ms === -1, 'fine cid: ' + JSON.stringify(f));
      await bea.aspetta((m) => m.t === 'fine' && m.i === 2, 5000, 'bea vede cid');
      const s = await ada.sala((m) => m.membri.length === 2, 'sala senza cid');
      assert(s.gara !== null, 'la gara si è chiusa troppo presto');
      ada.manda({ t: 'esco' });
      const fa = await bea.aspetta((m) => m.t === 'fine', 5000, 'ada esce');
      assert(fa.i === 0 && fa.ms === -1, 'fine ada: ' + JSON.stringify(fa));
      bea.manda({ t: 'fine', ms: 70000 });
      await bea.sala((m) => m.gara === null && m.membri.length === 1, 'gara chiusa, bea sola');
    });

    await ctx.test('chi è arrivato resta in sala e vede ancora gli altri; se poi esce il suo arrivo resta (niente −1)', async () => {
      ada = await entra('ada');
      cid = await entra('cid');
      await bea.sala((m) => m.membri.length === 3, 'di nuovo in 3');
      ada.manda({ t: 'via', pista: 'spiaggia_fuga' });
      for (const c of [bea, ada, cid]) await c.aspetta((m) => m.t === 'parte', 5000, 'parte in 3');
      bea.manda({ t: 'fine', ms: 50000 }); // bea (io 0) arriva prima
      await ada.aspetta((m) => m.t === 'fine' && m.i === 0 && m.ms === 50000, 5000, 'arrivo di bea ad ada');
      await cid.aspetta((m) => m.t === 'fine' && m.i === 0 && m.ms === 50000, 5000, 'arrivo di bea a cid');
      ada.manda({ t: 'p', q: POS });
      const p = await bea.aspetta((m) => m.t === 'p', 5000, 'p di ada a bea già arrivata');
      assert(p.i === 1, 'p: ' + JSON.stringify(p));
      ada.manda({ t: 'fine', ms: 52000 });
      await bea.aspetta((m) => m.t === 'fine' && m.i === 1 && m.ms === 52000, 5000, 'arrivo di ada a bea già arrivata');
      const n0 = cid.msgs.filter((m) => m.t === 'fine').length;
      bea.chiudi();
      const s = await cid.sala((m) => m.membri.length === 2, 'bea uscita');
      assert(s.gara !== null, 'la gara si è chiusa con cid ancora in pista');
      await sleep(200);
      const dopo = cid.msgs.filter((m) => m.t === 'fine').slice(n0);
      assert(!dopo.some((m) => m.i === 0), 'bea già arrivata è diventata −1: ' + JSON.stringify(dopo));
      cid.manda({ t: 'fine', ms: 55000 });
      await cid.sala((m) => m.gara === null, 'gara chiusa');
    });

    await ctx.test('altra scheda sostituisce la vecchia; sala piena a 6 (la 7ª: errore e 1013); messaggi rotti → 1003', async () => {
      ada.chiudi();
      await cid.sala((m) => m.membri.length === 1, 'solo cid');
      const cid2 = await entra('cid');
      const s = await cid2.sala(() => true, 'cid da un\'altra scheda');
      assert(s.membri.length === 1 && s.membri[0].id === 'cid', 'sala dopo altra scheda: ' + JSON.stringify(s.membri.map((x) => x.id)));
      for (let i = 0; i < 40 && cid.chiuso === null; i++) await sleep(50);
      assert(cid.chiuso !== null, 'la vecchia scheda non è stata chiusa');
      const altri = [];
      for (const n of ['ada', 'bea', 'dan', 'eva', 'fra']) altri.push(await entra(n));
      await cid2.sala((m) => m.membri.length === 6, 'sala a 6');
      const gio = apri(base, 'tok_gio'); socket.push(gio);
      const e = await gio.aspetta((m) => m.t === 'errore', 5000, 'sala piena');
      assert(/piena \(6\)/.test(e.msg), 'errore: ' + e.msg);
      for (let i = 0; i < 40 && gio.chiuso === null; i++) await sleep(50);
      assert(gio.chiuso === 1013, 'chiusura sala piena: ' + gio.chiuso);
      const fra = altri[4];
      fra.manda('x'.repeat(600));
      for (let k = 0; k < 9; k++) fra.manda('{"t":"boh"}');
      for (let i = 0; i < 40 && fra.chiuso === null; i++) await sleep(50);
      assert(fra.chiuso === 1003, 'chiusura messaggi rotti: ' + fra.chiuso);
      await cid2.sala((m) => m.membri.length === 5, 'fra fuori dalla sala');
    });

    await ctx.test('nessun errore interno nel log di wrangler', async () => {
      // «Network connection lost» lo stampa wrangler locale quando un DO chiude una socket appena accettata (sala piena; succede uguale
      // con la squadra piena di Spedizioni): non è un errore del DO
      const righe = log.split('\n').filter((l) => /Uncaught|\[marea\] (lot error|errore)/.test(l) && !/Network connection lost/.test(l));
      assert(!righe.length, 'errori nel log:\n' + righe.slice(0, 5).join('\n'));
      });
  } finally {
    for (const c of socket) c.chiudi();
    if (dev) { try { process.kill(-dev.pid, 'SIGTERM'); } catch { /* già finito */ } await sleep(500); try { process.kill(-dev.pid, 'SIGKILL'); } catch { /* ok */ } }
    fs.rmSync(persist, { recursive: true, force: true });
  }
}
