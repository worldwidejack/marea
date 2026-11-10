// Partite dell'Arena lato server (PROTOCOL.md §10, docs/ARENA.md): il DO Arena dietro `/ws/arena`, provato con WebSocket da Node (niente
// browser). La build si salva col personaggio (POST /api/rpg {t:'arena'}; quello che non c'è nel catalogo no). Sala di Rapinatori 2v2 piena di
// persone: squadre in ordine d'arrivo, `parte` con lo stesso seed e la fotografia della build di ciascuno, partita aperta nel lotto; turni
// uguali a tutti, il «client» (la stessa partita della sim avanzata coi turni, gli input dal gladiatore automatico) resta uguale; linea persa
// → `attesa` agli altri, ci si ricollega con `?run=&idx=&n=` e si ricevono i turni persi; la resa di tutta una squadra → `fine` con l'esito del
// replay del server (uguale al client) e il premio a chi vince contro persone. Sala coi gladiatori: solo chi l'ha aperta parte; chi perde la
// linea per più di ARENA.rete.staccatoSecondi è dato per arreso. Coda da soli (gladiatori dopo l'attesa) e Sopravvivenza a 10 con due persone.
// wrangler dev locale (lanciato con node, va su Windows).
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
export const timeout = 300000;

const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Socket di prova: tiene tutti i messaggi (i turni a parte); `aspetta(pred)` risolve col primo non ancora letto che soddisfa pred. */
function apri(url) {
  const ws = new WebSocket(url);
  const c = { ws, msgs: [], letti: 0, chiuso: null, turni: [] };
  ws.addEventListener('message', (e) => { let m; try { m = JSON.parse(String(e.data)); } catch { m = { t: '?', raw: e.data }; } if (m.t === 'T') c.turni.push(m); else c.msgs.push(m); });
  ws.addEventListener('close', (e) => { c.chiuso = e.code; });
  c.aperto = new Promise((res, rej) => { ws.addEventListener('open', () => res(), { once: true }); ws.addEventListener('error', () => rej(new Error('socket non aperta')), { once: true }); });
  c.manda = (m) => { if (ws.readyState === 1) ws.send(typeof m === 'string' ? m : JSON.stringify(m)); };
  c.aspetta = async (pred, ms = 8000, cosa = '') => {
    const t0 = Date.now();
    for (;;) {
      for (let i = c.letti; i < c.msgs.length; i++) if (pred(c.msgs[i])) { c.letti = i + 1; return c.msgs[i]; }
      if (Date.now() - t0 > ms) throw new Error(`messaggio non arrivato (${cosa}); ultimi: ${JSON.stringify(c.msgs.slice(-3)).slice(0, 300)}`);
      await sleep(20);
    }
  };
  c.chiudi = () => { try { ws.close(); } catch { /* chiusa */ } };
  return c;
}

export default async function (ctx) {
  const { assert } = ctx;
  const SERVER = path.join(ctx.ROOT, 'apps/server');
  const WRANGLER = path.join(ctx.ROOT, 'node_modules/wrangler/bin/wrangler.js');
  const persist = path.join(ctx.OUT, `m4ar-${process.pid}`);
  const env = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' };
  const wr = (...a) => execFileSync(process.execPath, [WRANGLER, ...a], { cwd: SERVER, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 90000 }).toString();
  const sim = async (f) => import(pathToFileURL(path.join(ctx.ROOT, 'packages/sim/src', f)).href);
  const { createRng } = await sim('rng.ts');
  const { actPartita, createPartita, hashPartita, stepPartita } = await sim('arena/partita.ts');
  const { botArena } = await sim('arena/bot.ts');
  const { quantizeDungeon, frameOfRiga } = await sim('dungeon/replay.ts');
  const { ARENA } = await import(pathToFileURL(path.join(ctx.ROOT, 'packages/content/src/arena.ts')).href);
  /** JSON con le chiavi in ordine (il server può riscrivere l'oggetto in un altro ordine). */
  const canon = (v) => JSON.stringify(v, (_, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x));
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
      "INSERT INTO persone (id, nome, token, slot) VALUES ('ada', 'Ada', 'tok_ada', 0), ('bea', 'Bea', 'tok_bea', 1), ('cid', 'Cid', 'tok_cid', 2), ('dan', 'Dan', 'tok_dan', 3);");
    const port = await freePort(), inspector = await freePort();
    dev = spawn(process.execPath, [WRANGLER, 'dev', '--local', '--ip', '127.0.0.1', '--port', String(port), '--inspector-port', String(inspector),
      '--assets', ctx.distDir, '--persist-to', persist, '--show-interactive-dev-session=false'], { cwd: SERVER, env, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
    dev.stdout.on('data', (d) => (log += d)); dev.stderr.on('data', (d) => (log += d));
    const base = `http://127.0.0.1:${port}`, wsBase = base.replace('http', 'ws') + '/ws/arena';
    let up = false;
    for (let i = 0; i < 160 && !up; i++) { try { up = (await fetch(base + '/api/ping')).ok; } catch { /* non ancora */ } if (!up) await sleep(500); }
    if (!up) throw new Error('wrangler dev non risponde:\n' + log.split('\n').slice(-20).join('\n'));
    const entra = async (n, q) => { const c = apri(`${wsBase}?t=tok_${n}&${q}`); socket.push(c); await c.aperto; return c; };
    const post = async (tok, p, b) => { const r = await fetch(base + p, { method: 'POST', headers: { 'x-token': tok, 'content-type': 'application/json' }, body: JSON.stringify(b ?? {}) }); return { status: r.status, body: await r.json() }; };
    const lot = async (tok) => (await (await fetch(base + '/api/lot', { headers: { 'x-token': tok } })).json());

    await ctx.test('build dell’Arena: si salvano col personaggio, quelle fuori catalogo no, i dungeon non cambiano', async () => {
      const prima = await lot('tok_ada');
      const builds = { build: [{ dote: 'vita', slot: [{ arma: 'katana_ferro' }, { arma: 'arco_ferro' }], ulti: 'furia' }, { dote: 'magia', slot: [{ magia: 'fiammata' }, { arma: 'katana_ferro' }], ulti: 'marea' }], scelta: 1 };
      const ok = await post('tok_ada', '/api/rpg', { azione: { t: 'arena', builds } });
      assert(ok.status === 200, 'salvataggio: ' + ok.status + ' ' + JSON.stringify(ok.body).slice(0, 200));
      assert(canon(ok.body.hero.arena) === canon(builds), 'build salvate: ' + JSON.stringify(ok.body.hero.arena));
      assert(JSON.stringify(ok.body.hero.equip) === JSON.stringify(prima.hero?.equip ?? ok.body.hero.equip) && JSON.stringify(ok.body.hero.inv) === JSON.stringify(prima.hero?.inv ?? ok.body.hero.inv), 'equipaggiamento o zaino cambiati');
      const no = await post('tok_ada', '/api/rpg', { azione: { t: 'arena', builds: { build: [{ dote: 'vita', slot: [{ arma: 'spadone_meteorite' }, null], ulti: 'furia' }], scelta: 0 } } });
      assert(no.status >= 400 && /non valida/.test(no.body.error), 'una build fuori catalogo: ' + no.status + ' ' + JSON.stringify(no.body));
    });

    /** Le quattro persone in una sala di Rapinatori 2 contro 2: chi la apre e il primo che entra nella squadra 0, gli altri due nella 1. */
    let sala4, parte;
    await ctx.test('sala piena di persone (Rapinatori 2v2): codice sbagliato = errore; squadre in ordine d’arrivo; stesso seed; partita aperta nel lotto', async () => {
      const no = await fetch(base + '/ws/arena');
      assert(no.status === 426, 'senza WebSocket: ' + no.status);
      const cid = await entra('cid', 'modo=sala&m=rapina&f=2');
      const at = await cid.aspetta((m) => m.t === 'attendi' && m.modo === 'sala', 8000, 'codice');
      assert(new RegExp(`^[A-Z]{${ARENA.rete.codice}}$`).test(at.codice) && at.m === 'rapina' && at.f === 2 && at.serve === 4 && at.host === true, 'attendi: ' + JSON.stringify(at));
      const sbagliato = at.codice === 'ZZZZ' ? 'YYYY' : 'ZZZZ';
      const x = await entra('dan', `modo=sala&codice=${sbagliato}`);
      assert(/Sala non trovata/.test((await x.aspetta((m) => m.t === 'errore', 8000, 'errore codice')).msg), 'codice sbagliato');
      const dan = await entra('dan', `modo=sala&codice=${at.codice.toLowerCase()}`);
      await cid.aspetta((m) => m.t === 'attendi' && m.dentro === 2, 8000, 'sala con due');
      const ada = await entra('ada', `modo=sala&codice=${at.codice}`);
      await cid.aspetta((m) => m.t === 'attendi' && m.dentro === 3, 8000, 'sala con tre');
      const bea = await entra('bea', `modo=sala&codice=${at.codice}`); // la quarta riempie la sala: si parte da soli
      const ps = await Promise.all([cid, dan, ada, bea].map((c, k) => c.aspetta((m) => m.t === 'parte', 15000, 'parte ' + k)));
      assert(ps.every((p) => p.run === ps[0].run && p.seed === ps[0].seed && p.m === 'rapina' && p.f === 2 && p.mappa === 'porto'), 'parte: ' + JSON.stringify(ps.map((p) => [p.run, p.m, p.f, p.mappa])));
      assert(ps.map((p) => p.io).join() === '0,1,2,3' && ps[0].eroi.map((e) => e.id).join() === 'cid,dan,ada,bea' && ps[0].eroi.every((e) => !e.bot), 'posti: ' + JSON.stringify(ps.map((p) => p.io)));
      const v = ps[2].eroi[2].eroe.varianti;
      assert(v[0]?.manoMagia && v[1]?.arma.id === 'katana_ferro' && ps[2].eroi[2].eroe.ulti === 'marea' && v.every((y) => !y || (y.arena && y.max.vita === 100 && y.max.magicka === 130)), 'la build scelta di ada nella fotografia');
      for (const [tok, idx] of [['tok_cid', 0], ['tok_ada', 2]]) {
        const pend = (await lot(tok)).arena?.pending;
        assert(pend && pend.run === ps[0].run && pend.idx === idx, 'partita nel lotto: ' + JSON.stringify(pend));
      }
      sala4 = [cid, dan, ada, bea]; parte = ps[0];
    });

    await ctx.test('partita: turni uguali a tutti, il client resta uguale; linea persa → attesa e ripresa coi turni persi; la squadra 0 si arrende → fine, premio a chi vince', async () => {
      for (const c of sala4) c.manda({ t: 'carico' });
      const d = createPartita({ seed: parte.seed, eroi: parte.eroi.map((e) => e.eroe), modo: parte.m, per: parte.f, mappa: parte.mappa });
      const rng = sala4.map((_, i) => createRng(parte.seed + i).fork('p')), mandato = sala4.map(() => '');
      const conn = [...sala4], ada = sala4[2];
      let n = 0, staccata = false, ripresa = false, resa = false;
      const monete0 = await Promise.all(['tok_ada', 'tok_bea', 'tok_cid'].map(async (t) => (await lot(t)).monete));
      const t0 = Date.now();
      while (d.fase !== 'finita' && Date.now() - t0 < 120000) {
        // dan perde la linea dopo 6 s e si ricollega dopo 1,5; dopo 14 s cid e dan si arrendono (dal menu: la socket resta aperta)
        if (!staccata && Date.now() - t0 > 6000) {
          staccata = true; conn[1].ws.close(4000, 'prova');
          const at = await ada.aspetta((m) => m.t === 'attesa' && m.chi === 1, 8000, 'attesa per dan');
          assert(at.ms > 0 && at.ms <= ARENA.rete.staccatoSecondi * 1000, 'attesa: ' + JSON.stringify(at));
          const fermo = ada.turni.length;
          await sleep(1500);
          assert(ada.turni.length <= fermo + 1, `la partita va avanti senza dan (${fermo} → ${ada.turni.length})`);
          const visti = conn[1].turni.length, nuova = await entra('dan', `run=${parte.run}&idx=1&n=${visti}`);
          const rp = await nuova.aspetta((m) => m.t === 'ripresa', 8000, 'ripresa');
          assert(rp.n >= visti, 'ripresa: ' + JSON.stringify(rp));
          nuova.turni.unshift(...conn[1].turni); conn[1] = nuova; ripresa = true;
          await ada.aspetta((m) => m.t === 'attesa' && m.chi === -1, 8000, 'si riparte');
        }
        if (!resa && Date.now() - t0 > 14000) { resa = true; conn[0].manda({ t: 'az', a: { t: 'resa' } }); conn[1].manda({ t: 'az', a: { t: 'resa' } }); }
        const t = ada.turni[n];
        if (!t) { await sleep(10); continue; }
        if (conn[3].turni[n]) assert(JSON.stringify(conn[3].turni[n]) === JSON.stringify(t), `turno ${n} diverso tra ada e bea`);
        for (const [i, a] of t.az ?? []) actPartita(d, i, a);
        for (let k = 0; k < 3; k++) stepPartita(d, t.f.map((x) => frameOfRiga([3, ...x])));
        n++;
        for (let i = 0; i < 4; i++) {
          if ((resa && i < 2) || (i === 1 && staccata && !ripresa)) continue;
          const b = botArena(d, i, rng[i]);
          if (b.azione) conn[i].manda({ t: 'az', a: b.azione });
          const q = quantizeDungeon(b.input), x = [Math.round(q.mx * 8) || 0, Math.round(q.my * 8) || 0, (q.a ? 1 : 0) | (q.b ? 2 : 0)], k = x.join();
          if (k !== mandato[i]) { mandato[i] = k; conn[i].manda({ t: 'in', f: x }); }
        }
      }
      ctx.log(`turni ${n}, tick ${d.tick}, punti ${d.punti}, vita ${d.s.eroi.map((r) => Math.round(r.hero.vita))}, hash ${hashPartita(d)}`);
      assert(ripresa, 'la ripresa non c’è stata');
      assert(d.fase === 'finita' && d.esito?.vincitore === 1 && d.esito.perche === 'resa', 'esito del client: ' + JSON.stringify(d.esito));
      const fa = await ada.aspetta((m) => m.t === 'fine', 15000, 'fine ada');
      assert(JSON.stringify(fa.esito) === JSON.stringify(d.esito), `esito del server ${JSON.stringify(fa.esito)} ≠ client ${JSON.stringify(d.esito)}`);
      assert(fa.premio === ARENA.premio.vinta, 'premio di ada (avversari persone): ' + JSON.stringify(fa));
      const [la, lb, lc] = await Promise.all(['tok_ada', 'tok_bea', 'tok_cid'].map(lot));
      assert(la.monete === monete0[0] + ARENA.premio.vinta && la.arena.vinte === 1 && la.arena.pending === null, 'lotto di ada: ' + JSON.stringify({ m: la.monete, a: la.arena }));
      assert(lb.monete === monete0[1] + ARENA.premio.vinta, 'lotto di bea: ' + lb.monete);
      assert(lc.monete === monete0[2] && lc.arena.perse === 1 && lc.arena.pending === null, 'lotto di cid (arreso: niente premio): ' + JSON.stringify({ m: lc.monete, a: lc.arena }));
      assert(!/non coincide/.test(log), 'il replay del server non coincide con la partita dal vivo');
    });

    await ctx.test('sala coi gladiatori: chi l’ha aperta preme via (gli ospiti no); chi perde la linea e non torna è dato per arreso', async () => {
      const cid = await entra('cid', 'modo=sala&m=rapina&f=2');
      const at = await cid.aspetta((m) => m.t === 'attendi' && m.modo === 'sala', 8000, 'sala');
      const dan = await entra('dan', `modo=sala&codice=${at.codice}`);
      await cid.aspetta((m) => m.t === 'attendi' && m.dentro === 2, 8000, 'sala con due');
      dan.manda({ t: 'via' }); // solo chi ha aperto la sala parte
      await sleep(800);
      assert(!cid.msgs.some((m) => m.t === 'parte'), 'è partita per un ospite');
      cid.manda({ t: 'via' });
      const pc = await cid.aspetta((m) => m.t === 'parte', 15000, 'parte cid'), pd = await dan.aspetta((m) => m.t === 'parte', 15000, 'parte dan');
      assert(pc.run === pd.run && pc.io === 0 && pd.io === 1 && pc.eroi.map((e) => !!e.bot).join() === 'false,false,true,true', 'squadre: ' + JSON.stringify(pc.eroi.map((e) => e.id)));
      cid.manda({ t: 'carico' }); dan.manda({ t: 'carico' });
      await sleep(1500);
      cid.ws.close(4000, 'via'); // cid perde la linea e non torna
      const t0 = Date.now();
      await dan.aspetta((m) => m.t === 'attesa' && m.chi === 0, 8000, 'attesa per cid');
      await dan.aspetta((m) => m.t === 'attesa' && m.chi === -1, (ARENA.rete.staccatoSecondi + 10) * 1000, 'cid dato per arreso: si riparte');
      assert(Date.now() - t0 >= ARENA.rete.staccatoSecondi * 1000 - 2000, `dato per arreso troppo presto (${Date.now() - t0} ms)`);
      dan.manda({ t: 'az', a: { t: 'resa' } }); // ora tutta la squadra 0 è fuori
      const f = await dan.aspetta((m) => m.t === 'fine', 15000, 'fine');
      assert(f.esito?.vincitore === 1 && f.esito.perche === 'resa' && f.premio === 0, 'esito: ' + JSON.stringify(f));
      const lc = await lot('tok_cid');
      assert(lc.arena.perse === 2 && lc.arena.pending === null, 'cid arreso: ' + JSON.stringify(lc.arena));
    });

    await ctx.test('coda da soli (Caccia alle stelle 3v3): passata l’attesa i 5 posti vuoti sono gladiatori; 6 input a ogni turno; chi esce lascia i gladiatori, che si arrendono', async () => {
      const l0 = await lot('tok_ada'), m0 = l0.monete, perse0 = l0.arena?.perse ?? 0;
      const ada2 = await entra('ada', 'modo=coda&m=stelle&f=3');
      const at = await ada2.aspetta((m) => m.t === 'attendi', 8000, 'attendi');
      assert(at.modo === 'coda' && at.m === 'stelle' && at.f === 3 && at.dentro === 1 && at.serve === 6, 'attendi: ' + JSON.stringify(at));
      const t0 = Date.now();
      const p = await ada2.aspetta((m) => m.t === 'parte', (ARENA.rete.attesaBotSecondi + 15) * 1000, 'parte');
      assert(Date.now() - t0 >= ARENA.rete.attesaBotSecondi * 1000 - 1500, `partita prima dell’attesa (${Date.now() - t0} ms)`);
      assert(p.eroi.length === 6 && p.io === 0 && p.eroi[0].id === 'ada' && p.eroi.slice(1).every((e) => e.bot) && p.mappa === 'osservatorio', 'eroi: ' + JSON.stringify(p.eroi.map((e) => [e.id, e.bot])));
      assert(p.eroi.slice(1).every((e) => JSON.stringify(e.eroe) === JSON.stringify(p.eroi[0].eroe)), 'i gladiatori copiano il set di ada');
      ada2.manda({ t: 'carico' });
      for (let i = 0; i < 750 && ada2.turni.length < 160; i++) await sleep(20); // oltre il conto alla rovescia di 3 s (60 turni da 3 tick, 20 al secondo)
      assert(ada2.turni.length >= 160 && ada2.turni.every((t) => t.f.length === 6), 'turni: ' + ada2.turni.length);
      assert(ada2.turni.slice(70).some((t) => t.f.slice(1).some((x) => x[0] !== 0 || x[1] !== 0)), 'i gladiatori stanno fermi');
      ada2.manda({ t: 'esco' });
      let l = null;
      for (let i = 0; i < 300; i++) { l = await lot('tok_ada'); if (l.arena?.pending === null && l.arena.perse > perse0) break; await sleep(100); }
      assert(l.arena.pending === null && l.arena.perse === perse0 + 1 && l.monete === m0, 'lotto di ada dopo l’uscita: ' + JSON.stringify({ m: l.monete, a: l.arena }));
    });

    await ctx.test('Sopravvivenza in coda, due persone: dieci eroi, ognuno nella sua squadra, otto gladiatori', async () => {
      const a = await entra('ada', 'modo=coda&m=sopravvivenza&f=1');
      await a.aspetta((m) => m.t === 'attendi', 8000, 'attendi ada');
      const b = await entra('bea', 'modo=coda&m=sopravvivenza&f=1');
      const at = await b.aspetta((m) => m.t === 'attendi' && m.dentro === 2, 8000, 'attendi in due');
      assert(at.serve === 10, 'attendi: ' + JSON.stringify(at));
      const [pa, pb] = await Promise.all([a, b].map((c) => c.aspetta((m) => m.t === 'parte', (ARENA.rete.attesaBotSecondi + 15) * 1000, 'parte')));
      assert(pa.m === 'sopravvivenza' && pa.mappa === 'naufragio' && pa.eroi.length === 10 && pa.io === 0 && pb.io === 1 && pa.eroi.filter((e) => e.bot).length === 8, 'eroi: ' + JSON.stringify([pa.io, pb.io, pa.eroi.map((e) => e.id)]));
      a.manda({ t: 'esco' }); b.manda({ t: 'esco' });
    });

    await ctx.test('nessun errore interno nel log di wrangler', async () => {
      assert(!/\[marea\] (lot error|errore)/.test(log), 'errori nel log:\n' + log.split('\n').filter((l) => /\[marea\]/.test(l)).slice(0, 5).join('\n'));
      assert(!/non partita|premio non salvato/.test(log), 'partita non partita o premio non salvato:\n' + log.split('\n').filter((l) => /arena/.test(l)).slice(-5).join('\n'));
      assert(!/non coincide/.test(log), 'il replay del server non coincide con la partita dal vivo (anche quelle coi gladiatori)');
    });
  } finally {
    for (const c of socket) c.chiudi();
    await spegni();
    await sleep(300);
    try { fs.rmSync(persist, { recursive: true, force: true }); } catch { /* file ancora aperti su Windows */ }
  }
}
