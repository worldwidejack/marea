// Duello dell'Arena lato server (PROTOCOL.md §10, docs/ARENA.md): il DO Arena dietro `/ws/arena`, provato con WebSocket da Node (niente
// browser). Il set del duello si salva col personaggio (POST /api/rpg {t:'arena'}; quello che non hai no). Coda veloce: i primi due si
// sfidano → `parte` con lo stesso seed, io 0/1 e la fotografia del set di ciascuno, duello aperto nel lotto. Duello: turni uguali ai due,
// i due «client» (lo stesso duello della sim, avanzato coi turni, gli input dall'avversario automatico) restano uguali; linea persa →
// `attesa` all'altro, si ricollega con `?run=&idx=&n=` e riceve i turni persi; `esco` = resa → `fine` con l'esito del replay del server
// (uguale a quello dei client) e il premio nel lotto (monete col tetto del giorno). Sala con codice: codice sbagliato = errore; chi apre la
// sala e poi perde la linea per più di ARENA.rete.staccatoSecondi è dato per arreso. wrangler dev locale (lanciato con node, va su Windows).
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
  const { actDuello, createDuello, hashDuello, stepDuello } = await sim('arena/duello.ts');
  const { botArena } = await sim('arena/bot.ts');
  const { quantizeDungeon, frameOfRiga } = await sim('dungeon/replay.ts');
  const { ARENA } = await import(pathToFileURL(path.join(ctx.ROOT, 'packages/content/src/arena.ts')).href);
  const { RPG } = await import(pathToFileURL(path.join(ctx.ROOT, 'packages/content/src/rpg.ts')).href);
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

    await ctx.test('set del duello: si salva col personaggio, quello che non hai no, i dungeon non cambiano', async () => {
      const prima = await lot('tok_ada');
      const set = { corpo: 'armatura_legno', slot: [{ magia: 'fiammata' }, { arma: 'katana_legno' }, null, { arma: 'arco_legno', frecce: 'frecce_legno' }], pozioni: ['pozione_vita_minore', null] };
      const ok = await post('tok_ada', '/api/rpg', { azione: { t: 'arena', loadout: set } });
      assert(ok.status === 200, 'salvataggio: ' + ok.status + ' ' + JSON.stringify(ok.body).slice(0, 200));
      assert(canon(ok.body.hero.arena) === canon(set), 'set salvato: ' + JSON.stringify(ok.body.hero.arena));
      assert(JSON.stringify(ok.body.hero.equip) === JSON.stringify(prima.hero?.equip ?? ok.body.hero.equip) && JSON.stringify(ok.body.hero.inv) === JSON.stringify(prima.hero?.inv ?? ok.body.hero.inv), 'equipaggiamento o zaino cambiati');
      const no = await post('tok_ada', '/api/rpg', { azione: { t: 'arena', loadout: { ...set, slot: [{ arma: 'spadone_meteorite' }, null, null, null] } } });
      assert(no.status >= 400 && /Non hai/.test(no.body.error), 'un set con quello che non hai: ' + no.status + ' ' + JSON.stringify(no.body));
    });

    let ada, bea, parte;
    await ctx.test('coda veloce: i primi due si sfidano, stesso seed, fotografie del set, duello aperto nel lotto', async () => {
      const no = await fetch(base + '/ws/arena');
      assert(no.status === 426, 'senza WebSocket: ' + no.status);
      ada = await entra('ada', 'modo=coda');
      const at = await ada.aspetta((m) => m.t === 'attendi', 8000, 'ada in coda');
      assert(at.modo === 'coda', 'attendi: ' + JSON.stringify(at));
      bea = await entra('bea', 'modo=coda');
      const pa = await ada.aspetta((m) => m.t === 'parte', 15000, 'parte ada'), pb = await bea.aspetta((m) => m.t === 'parte', 15000, 'parte bea');
      assert(pa.seed === pb.seed && pa.run === pb.run && pa.io === 0 && pb.io === 1 && pa.eroi.length === 2, 'parte: ' + JSON.stringify([pa.run, pb.run, pa.io, pb.io]));
      assert(pa.eroi[0].id === 'ada' && pa.eroi[1].id === 'bea' && JSON.stringify(pa.eroi) === JSON.stringify(pb.eroi), 'eroi diversi tra i due');
      const v0 = pa.eroi[0].eroe.varianti;
      assert(v0.length === ARENA.slot && v0[0]?.manoMagia && v0[1]?.arma.id === 'katana_legno' && v0[2] === null && v0[3]?.frecce?.n === ARENA.frecce, 'il set di ada nella fotografia: ' + JSON.stringify(v0.map((v) => v && [v.arma.id, v.manoMagia, v.frecce?.n])));
      assert(v0.every((v) => !v || (v.arena && v.max.vita === 100)), 'fotografia non da Arena');
      for (const [tok, idx] of [['tok_ada', 0], ['tok_bea', 1]]) {
        const p = (await lot(tok)).arena?.pending;
        assert(p && p.run === pa.run && p.idx === idx, 'duello nel lotto: ' + JSON.stringify(p));
      }
      parte = pa;
    });

    await ctx.test('duello: turni uguali, i client restano uguali; linea persa → attesa e ripresa coi turni persi; resa → fine e premio', async () => {
      ada.manda({ t: 'carico' }); bea.manda({ t: 'carico' });
      const d = createDuello({ seed: parte.seed, eroi: parte.eroi.map((e) => e.eroe) });
      const rng = [createRng(parte.seed).fork('a'), createRng(parte.seed + 1).fork('b')], mandato = ['', ''];
      let conn = [ada, bea], n = 0, staccata = false, ripresa = false, resa = false;
      const monete0 = [(await lot('tok_ada')).hero?.monete ?? RPG.partenza.monete, (await lot('tok_bea')).hero?.monete ?? RPG.partenza.monete];
      const t0 = Date.now();
      while (d.fase !== 'finita' && Date.now() - t0 < 120000) {
        // bea perde la linea dopo 8 s e si ricollega dopo 3; dopo 20 s si arrende
        if (!staccata && Date.now() - t0 > 8000) {
          staccata = true; bea.ws.close(4000, 'prova');
          const at = await ada.aspetta((m) => m.t === 'attesa' && m.chi === 1, 8000, 'attesa per bea');
          assert(at.ms > 0 && at.ms <= ARENA.rete.staccatoSecondi * 1000, 'attesa: ' + JSON.stringify(at));
          const fermo = ada.turni.length;
          await sleep(1500);
          assert(ada.turni.length <= fermo + 1, `il duello va avanti senza bea (${fermo} → ${ada.turni.length})`);
          const visti = bea.turni.length;
          const nuova = await entra('bea', `run=${parte.run}&idx=1&n=${visti}`);
          const rp = await nuova.aspetta((m) => m.t === 'ripresa', 8000, 'ripresa');
          assert(rp.n >= visti, 'ripresa: ' + JSON.stringify(rp));
          nuova.turni.unshift(...bea.turni); bea = nuova; conn = [ada, bea]; ripresa = true;
          await ada.aspetta((m) => m.t === 'attesa' && m.chi === -1, 8000, 'si riparte');
        }
        if (!resa && Date.now() - t0 > 20000) { resa = true; bea.manda({ t: 'esco' }); }
        const t = ada.turni[n];
        if (!t) { await sleep(10); continue; }
        if (bea.turni[n]) assert(JSON.stringify(bea.turni[n]) === JSON.stringify(t), `turno ${n} diverso tra i due`);
        for (const [i, a] of t.az ?? []) actDuello(d, i, a);
        for (let k = 0; k < 3; k++) stepDuello(d, t.f.map((x) => frameOfRiga([3, ...x])));
        n++;
        for (let i = 0; i < 2; i++) {
          if (i === 1 && (resa || staccata && !ripresa)) continue;
          const b = botArena(d, i, rng[i]);
          if (b.azione) conn[i].manda({ t: 'az', a: b.azione });
          const q = quantizeDungeon(b.input), x = [Math.round(q.mx * 8) || 0, Math.round(q.my * 8) || 0, (q.a ? 1 : 0) | (q.b ? 2 : 0)], k = x.join();
          if (k !== mandato[i]) { mandato[i] = k; conn[i].manda({ t: 'in', f: x }); }
        }
      }
      ctx.log(`turni ${n}, tick ${d.tick}, round ${d.round}, vita ${d.s.eroi.map((r) => Math.round(r.hero.vita))}, hash ${hashDuello(d)}`);
      assert(ripresa, 'la ripresa non c’è stata');
      assert(d.fase === 'finita' && d.esito?.vincitore === 0 && d.esito.perche === 'resa', 'esito dei client: ' + JSON.stringify(d.esito));
      const fa = await ada.aspetta((m) => m.t === 'fine', 15000, 'fine ada');
      assert(JSON.stringify(fa.esito) === JSON.stringify(d.esito), `esito del server ${JSON.stringify(fa.esito)} ≠ client ${JSON.stringify(d.esito)}`);
      assert(fa.premio === ARENA.premio.vinta, 'premio di ada: ' + JSON.stringify(fa));
      const la = await lot('tok_ada'), lb = await lot('tok_bea');
      assert(la.hero.monete === monete0[0] + ARENA.premio.vinta && la.arena.vinte === 1 && la.arena.pending === null, 'lotto di ada: ' + JSON.stringify({ m: la.hero.monete, a: la.arena }));
      assert(lb.hero.monete === monete0[1] && lb.arena.perse === 1 && lb.arena.pending === null, 'lotto di bea (arresa: niente premio): ' + JSON.stringify({ m: lb.hero.monete, a: lb.arena }));
      assert(!/non coincide/.test(log), 'il replay del server non coincide col duello dal vivo');
    });

    await ctx.test('sala con codice: codice sbagliato = errore; chi perde la linea e non torna è dato per arreso', async () => {
      const cid = await entra('cid', 'modo=sala');
      const at = await cid.aspetta((m) => m.t === 'attendi' && m.modo === 'sala', 8000, 'codice');
      assert(new RegExp(`^[A-Z]{${ARENA.rete.codice}}$`).test(at.codice), 'codice: ' + JSON.stringify(at));
      const sbagliato = at.codice === 'ZZZZ' ? 'YYYY' : 'ZZZZ';
      const x = await entra('dan', `modo=sala&codice=${sbagliato}`);
      const e = await x.aspetta((m) => m.t === 'errore', 8000, 'errore codice');
      assert(/Sala non trovata/.test(e.msg), 'errore: ' + e.msg);
      const dan = await entra('dan', `modo=sala&codice=${at.codice.toLowerCase()}`);
      const pd = await dan.aspetta((m) => m.t === 'parte', 15000, 'parte dan'), pc = await cid.aspetta((m) => m.t === 'parte', 15000, 'parte cid');
      assert(pd.run === pc.run && pc.io === 0 && pd.io === 1, 'parte: ' + JSON.stringify([pc.io, pd.io]));
      cid.manda({ t: 'carico' }); dan.manda({ t: 'carico' });
      await sleep(1500);
      cid.ws.close(4000, 'via'); // cid perde la linea e non torna
      const t0 = Date.now();
      const f = await dan.aspetta((m) => m.t === 'fine', (ARENA.rete.staccatoSecondi + 15) * 1000, 'fine per abbandono');
      assert(f.esito?.vincitore === 1 && f.esito.perche === 'resa', 'esito: ' + JSON.stringify(f.esito));
      assert(Date.now() - t0 >= ARENA.rete.staccatoSecondi * 1000 - 1500, `dato per arreso troppo presto (${Date.now() - t0} ms)`);
      const lc = await lot('tok_cid');
      assert(lc.arena.perse === 1, 'cid arreso: ' + JSON.stringify(lc.arena));
    });

    await ctx.test('nessun errore interno nel log di wrangler', async () => {
      assert(!/\[marea\] (lot error|errore)/.test(log), 'errori nel log:\n' + log.split('\n').filter((l) => /\[marea\]/.test(l)).slice(0, 5).join('\n'));
      assert(!/duello non partito|premio non salvato/.test(log), 'duello non partito o premio non salvato:\n' + log.split('\n').filter((l) => /arena/.test(l)).slice(-5).join('\n'));
    });
  } finally {
    for (const c of socket) c.chiudi();
    await spegni();
    await sleep(300);
    try { fs.rmSync(persist, { recursive: true, force: true }); } catch { /* file ancora aperti su Windows */ }
  }
}
