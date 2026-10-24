// Duello dell'Arena (PROTOCOL.md §10, docs/ARENA.md): coda veloce, sale con codice e partite 1v1, 2v2 e 3v3 in tempo reale. Un'istanza sola
// (idFromName('arena')), socket normali come Spedizioni e TemplariInsieme (finché c'è qualcuno in coda o in duello il DO resta sveglio).
// Formato `f` = eroi per squadra (1, 2 o 3). Coda: `?modo=coda&f=2`; nel duello (f=1) i primi due si sfidano, nei formati a squadre si parte
// quando ci sono 2×f persone o, passato ARENA.rete.attesaBotSecondi, con chi c'è (gli altri posti sono dei gladiatori automatici: arena_squadre.ts).
// Sala: `?modo=sala&f=2` apre una sala con un codice da dire agli amici, che entrano con `?modo=sala&codice=XXXX`; si parte quando è piena o
// quando chi l'ha aperta manda `via`. Trovati i partecipanti, il DO del lotto di ciascuno apre il duello (`arena_start`: la fotografia del set)
// → `parte` a tutti; quando hanno caricato (o dopo ARENA.rete.caricoSecondi) parte l'orologio: ogni SQ_TURNO_MS un turno con l'ultimo input di
// ciascuno (quello dei gladiatori lo decide il server, sim/arena/bot.ts) e le azioni della barra (slot, pozioni, resa), mandato a tutti. Il DO
// fa girare lo stesso duello (sim/arena/duello.ts): così sa quando finisce; allora lo rigioca dal log (replayDuello), e l'esito del replay
// decide: `arena_fine` nel lotto di ciascuno (premio col tetto del giorno, niente se tra gli avversari c'erano gladiatori) e `fine` a tutti.
// Linea persa (socket caduta senza `esco`): il duello si ferma e aspetta ARENA.rete.staccatoSecondi; chi torna (`?run=&idx=&n=`) riceve i
// turni persi e si riparte, se no è dato per arreso (una `resa` nel turno dopo). `esco` nel duello = resa. Se il DO si riavvia (un deploy)
// i duelli in corso si perdono: nessun premio, si rientra dal colosseo.
import { DurableObject } from 'cloudflare:workers';
import { ARENA, mappaPer } from '@marea/content/arena.ts';
import { botArena } from '@marea/sim/arena/bot.ts';
import { actDuello, createDuello, formatoDi, hashDuello, MAX_TICKS_DUELLO, parseArenaAzione, replayDuello, stepDuello } from '@marea/sim/arena/duello.ts';
import type { ArenaAzione, ArenaAzioni, DuelloEsito, DuelloState } from '@marea/sim/arena/duello.ts';
import type { ArenaEroe } from '@marea/sim/rpg/arena.ts';
import type { ArenaRuolo } from '@marea/sim/arena/premio.ts';
import { frameOfRiga } from '@marea/sim/dungeon/replay.ts';
import type { PackedDungeon } from '@marea/sim/dungeon/types.ts';
import { createRng } from '@marea/sim/rng.ts';
import type { Rng } from '@marea/sim/rng.ts';
import type { Look } from '@marea/protocol';
import { AR_LETTERE, SQ_TICKS, SQ_TURNO_MS, isCodiceSala, isFormato, parseArClient } from '@marea/protocol/arena.ts';
import type { ArEroe, ArServerMsg, ArTurno, SqInput } from '@marea/protocol/arena.ts';
import type { Env } from '../env.ts';
import { json } from '../http.ts';
import { accoda, apriSocket, chiudi, ospite, passa } from './sala.ts';
import { gladiatore, inputGladiatore, piazza, squadreCoda, squadreSala } from './arena_squadre.ts';

const CARICO_MAX_MS = ARENA.rete.caricoSecondi * 1000;
const STACCATO_MAX_MS = ARENA.rete.staccatoSecondi * 1000;
const ATTESA_BOT_MS = ARENA.rete.attesaBotSecondi * 1000;
/** Input in coda oltre questi: si scartano i più vecchi tenendone i bottoni. */
const MAX_CODA = 4;
const MAX_MSG_PER_S = 40;
/** Azioni della barra in coda per turno; oltre si scartano. */
const MAX_AZ = 4;
const FERMO: SqInput = [0, 0, 0];

/** `dove`: in coda, in una sala (col suo codice), in duello. `f`: eroi per squadra del formato scelto. `esce`: ha detto `esco` (niente attesa per ricollegarsi). */
type Conn = { ws: WebSocket; id: string; nome: string; look: Look; dove: 'coda' | 'sala' | 'duello' | 'fuori'; codice: string; f: number; run: Run | null; s: number; n: number; esce: boolean };
/** Una sala: il formato e chi c'è, in ordine di arrivo (il primo l'ha aperta). */
type Sala = { f: number; membri: Conn[] };
/** `staccato`: da quando la sua socket è caduta senza `esco` (0 = collegato); `arreso`: è uscito o è stato dato per arreso; `bot`: gladiatore
 *  automatico (senza socket), col suo generatore di numeri. */
type Membro = { m: ArEroe; conn: Conn | null; bot: Rng | null; last: SqInput; coda: SqInput[]; az: ArenaAzione[]; carico: boolean; staccato: number; arreso: boolean; log: PackedDungeon };
/** `pausa`: da quando il duello è fermo per una linea persa (0 = no). */
type Run = { id: string; seed: number; f: number; mappa: string; squadre: number[]; membri: Membro[]; turni: ArTurno[]; d: DuelloState; azioni: ArenaAzioni; creato: number; t0: number; fine: number; pausa: number };

const intDa = (v: string | null): number | null => (v !== null && /^\d{1,9}$/.test(v) ? Number(v) : null);
const frameOf = (x: SqInput) => frameOfRiga([SQ_TICKS, x[0], x[1], x[2], x[3]]);

export class Arena extends DurableObject<Env> {
  private coda: Conn[] = [];
  private sale = new Map<string, Sala>();
  private runs = new Map<string, Run>();
  /** Per formato a squadre: il timer che, passata l'attesa, fa partire la coda con i gladiatori. */
  private attese = new Map<number, ReturnType<typeof setTimeout>>();
  private timer: ReturnType<typeof setInterval> | null = null;

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (req.headers.get('upgrade') !== 'websocket') return json({ error: 'WebSocket atteso' }, 426);
    const { id, nome, look } = ospite(url);
    const { server, fatto } = apriSocket();
    if (!id) { this.send(server, { t: 'errore', msg: 'Chi sei?' }); server.close(1008, 'id'); return fatto; }
    const fq = Number(url.searchParams.get('f')), f = isFormato(fq) ? fq : 1;
    const c: Conn = { ws: server, id, nome, look, dove: 'fuori', codice: '', f, run: null, s: 0, n: 0, esce: false };
    server.addEventListener('message', (ev) => this.onMessage(c, ev.data));
    server.addEventListener('close', () => this.via(c));
    server.addEventListener('error', () => this.via(c));
    // ricollegarsi a un duello in corso (linea persa)
    const run = url.searchParams.get('run'), idx = intDa(url.searchParams.get('idx')), n = intDa(url.searchParams.get('n'));
    if (run && idx !== null && n !== null) { this.ricollega(c, run, idx, n); return fatto; }
    // la stessa persona in un'altra scheda: quella vecchia esce dalla coda o dalla sala
    for (const o of [...this.coda, ...[...this.sale.values()].flatMap((s) => s.membri)]) if (o.id === id) { this.via(o); chiudi(o.ws, 1000, 'altra scheda'); }
    const modo = url.searchParams.get('modo'), codice = (url.searchParams.get('codice') ?? '').toUpperCase();
    if (modo === 'sala' && codice) { this.entraInSala(c, codice); return fatto; }
    if (modo === 'sala') {
      let k = '';
      for (let tent = 0; tent < 20 && (!k || this.sale.has(k)); tent++) k = Array.from(crypto.getRandomValues(new Uint8Array(ARENA.rete.codice)), (b) => AR_LETTERE[b % AR_LETTERE.length]).join('');
      c.dove = 'sala'; c.codice = k; this.sale.set(k, { f, membri: [c] });
      this.annuncia(this.sale.get(k)!);
      return fatto;
    }
    // coda veloce. Duello: se c'è già qualcuno (non io) si parte. Squadre: si parte a 2×f persone o passata l'attesa.
    c.dove = 'coda';
    if (f === 1) {
      const altro = this.coda.find((o) => o.f === 1 && o.id !== id && o.ws.readyState === 1);
      if (altro) { this.coda = this.coda.filter((o) => o !== altro); void this.parti([altro, c], 1, squadreCoda(2)); return fatto; }
      this.coda.push(c);
      this.send(server, { t: 'attendi', modo: 'coda', codice: '', f: 1, dentro: 1, serve: 2 });
      return fatto;
    }
    this.coda.push(c);
    this.aggiornaCoda(f);
    return fatto;
  }

  private send(ws: WebSocket, m: ArServerMsg): void { try { ws.send(JSON.stringify(m)); } catch { /* chiusa */ } }

  /** Chi c'è in coda per il formato `f` (a squadre): dillo a tutti; a 2×f si parte, a coda vuota il timer si ferma, se no parte il timer dei gladiatori. */
  private aggiornaCoda(f: number): void {
    const q = this.coda.filter((o) => o.f === f && o.dove === 'coda');
    const t = this.attese.get(f);
    if (!q.length) { if (t) { clearTimeout(t); this.attese.delete(f); } return; }
    if (q.length >= 2 * f) { this.parteCoda(f, q.slice(0, 2 * f)); return; }
    for (const o of q) this.send(o.ws, { t: 'attendi', modo: 'coda', codice: '', f, dentro: q.length, serve: 2 * f });
    if (!t) this.attese.set(f, setTimeout(() => { this.attese.delete(f); this.riempiCoda(f); }, ATTESA_BOT_MS));
  }
  private riempiCoda(f: number): void { const q = this.coda.filter((o) => o.f === f && o.dove === 'coda' && o.ws.readyState === 1); if (q.length) this.parteCoda(f, q); else this.aggiornaCoda(f); }
  private parteCoda(f: number, q: Conn[]): void {
    const t = this.attese.get(f);
    if (t) { clearTimeout(t); this.attese.delete(f); }
    this.coda = this.coda.filter((o) => !q.includes(o));
    void this.parti(q, f, squadreCoda(q.length));
    if (this.coda.some((o) => o.f === f)) this.aggiornaCoda(f);
  }

  /** Entra nella sala col codice: nel duello si parte subito, a squadre quando la sala è piena. */
  private entraInSala(c: Conn, codice: string): void {
    const sala = isCodiceSala(codice, ARENA.rete.codice) ? this.sale.get(codice) : undefined;
    if (!sala) { this.send(c.ws, { t: 'errore', msg: 'Sala non trovata: controlla il codice' }); chiudi(c.ws, 1000, 'sala'); return; }
    if (sala.membri.length >= 2 * sala.f) { this.send(c.ws, { t: 'errore', msg: 'La sala è piena' }); chiudi(c.ws, 1000, 'sala'); return; }
    c.f = sala.f; c.codice = codice; sala.membri.push(c);
    if (sala.membri.length < 2 * sala.f) { c.dove = 'sala'; this.annuncia(sala); return; }
    this.sale.delete(codice);
    void this.parti(sala.membri, sala.f, squadreSala(sala.membri.length, sala.f));
  }
  /** Dice a tutti nella sala chi c'è già; solo chi l'ha aperta può mandare `via`. */
  private annuncia(sala: Sala): void {
    const codice = sala.membri[0]!.codice;
    sala.membri.forEach((o, i) => this.send(o.ws, { t: 'attendi', modo: 'sala', codice, f: sala.f, dentro: sala.membri.length, serve: 2 * sala.f, host: i === 0 }));
  }

  private onMessage(c: Conn, data: unknown): void {
    if (typeof data !== 'string') return;
    if (!passa(c, MAX_MSG_PER_S)) return;
    const m = parseArClient(data);
    if (!m) return;
    if (m.t === 'esco') { c.esce = true; this.via(c); chiudi(c.ws, 1000, 'ciao'); return; }
    if (m.t === 'via') {
      const sala = c.dove === 'sala' ? this.sale.get(c.codice) : undefined;
      if (sala && sala.f > 1 && sala.membri[0] === c) { this.sale.delete(c.codice); void this.parti(sala.membri, sala.f, squadreSala(sala.membri.length, sala.f)); }
      return;
    }
    const r = c.run, me = r?.membri.find((x) => x.conn === c);
    if (!r || !me || r.fine || me.arreso) return;
    if (m.t === 'carico') { me.carico = true; this.forsePronti(r); return; }
    if (m.t === 'in') { accoda(me.coda, m.f, MAX_CODA); return; }
    if (m.t === 'az') { const a = parseArenaAzione(m.a); if (a && me.az.length < MAX_AZ) me.az.push(a); }
  }

  /** La connessione se ne va: dalla coda, dalla sala, o dal duello (con `esco` è una resa; se è caduta la linea il duello aspetta). */
  private via(c: Conn): void {
    const eraInCoda = c.dove === 'coda', sala = c.dove === 'sala' ? this.sale.get(c.codice) : undefined;
    this.coda = this.coda.filter((o) => o !== c);
    c.dove = c.dove === 'duello' ? 'duello' : 'fuori';
    if (eraInCoda && c.f > 1) this.aggiornaCoda(c.f);
    if (sala) this.lasciaSala(c, sala);
    const r = c.run, me = r?.membri.find((x) => x.conn === c);
    c.dove = 'fuori';
    if (!r || !me) return;
    me.conn = null; c.run = null;
    if (r.fine) return;
    if (c.esce) { this.arrenditi(me); return; }
    me.staccato = Date.now(); me.coda = [];
  }
  /** Chi ha aperto la sala se ne va: la sala si chiude per tutti; un altro: gli altri vedono chi resta. */
  private lasciaSala(c: Conn, sala: Sala): void {
    if (sala.membri[0] === c) {
      this.sale.delete(c.codice);
      for (const o of sala.membri) if (o !== c) { o.dove = 'fuori'; this.send(o.ws, { t: 'errore', msg: 'Chi aveva aperto la sala se n’è andato' }); chiudi(o.ws, 1000, 'sala chiusa'); }
    } else { sala.membri = sala.membri.filter((o) => o !== c); this.annuncia(sala); }
  }
  private arrenditi(me: Membro): void {
    if (me.arreso) return;
    me.arreso = true; me.staccato = 0; me.coda = []; me.az = [{ t: 'resa' }];
  }

  /** Trovati i partecipanti (persone, in ordine di arrivo, con la squadra di ciascuna): ogni lotto apre il duello e fa la fotografia del set; i
   *  posti vuoti sono dei gladiatori col set di una delle persone; poi `parte` a tutti. */
  private async parti(umani: Conn[], f: number, squadre: (0 | 1)[]): Promise<void> {
    const runId = crypto.randomUUID(), seed = crypto.getRandomValues(new Uint32Array(1))[0]! >>> 1, now = Date.now();
    const posti = piazza(squadre, f);
    for (const x of umani) { x.dove = 'duello'; x.codice = ''; }
    const foto: ArenaEroe[] = [];
    try {
      await Promise.all(umani.map(async (x, p) => {
        const res = await this.lotto(x.id, 'arena_start', { run: runId, idx: posti.findIndex((po) => po.persona === p) });
        const body = (await res.json()) as { eroe?: ArenaEroe; error?: string };
        if (!res.ok || !body.eroe) throw new Error(body.error ?? 'Duello non aperto');
        foto[p] = body.eroe;
      }));
    } catch (e) {
      console.warn('[marea] duello non partito', e);
      for (const x of umani) { this.send(x.ws, { t: 'errore', msg: 'Non si parte: riprova tra poco' }); chiudi(x.ws, 1000, 'errore'); }
      return;
    }
    const mappa = mappaPer(f, seed), formato = formatoDi(f, mappa.id);
    let gl = 0;
    const eroi: ArEroe[] = posti.map((po) => {
      if (po.persona !== null) { const x = umani[po.persona]!; return { id: x.id, nome: x.nome, look: x.look, eroe: foto[po.persona]! }; }
      const k = gl++;
      return gladiatore(k, foto[k % foto.length]!); // il set di una delle persone, a rotazione
    });
    const d = createDuello({ seed, eroi: eroi.map((e) => e.eroe), ...formato });
    const r: Run = {
      id: runId, seed, f, mappa: mappa.id, squadre: formato.squadre, turni: [], d, azioni: [], creato: now, t0: 0, fine: 0, pausa: 0,
      membri: eroi.map((m, i) => ({ m, conn: posti[i]!.persona === null ? null : umani[posti[i]!.persona!]!, bot: m.bot ? createRng((seed ^ Math.imul(i + 1, 0x9e3779b1)) >>> 0).fork('gladiatore') : null, last: FERMO, coda: [], az: [], carico: !!m.bot, staccato: 0, arreso: false, log: [] })),
    };
    for (const [k, v] of this.runs) if (v.fine && now - v.fine > 10 * 60_000) this.runs.delete(k);
    this.runs.set(runId, r);
    r.membri.forEach((m, i) => {
      const x = m.conn;
      if (!x) return;
      if (x.ws.readyState !== 1) { m.conn = null; m.staccato = now; return; } // chiuso mentre si apriva: come una linea persa
      x.run = r;
      this.send(x.ws, { t: 'parte', run: runId, seed, io: i, eroi, squadre: formato.squadre, mappa: mappa.id });
    });
    console.log(`[marea] arena: duello ${runId} ${f}v${f} su ${mappa.id} (${eroi.map((e) => e.nome).join(', ')})`);
    void this.sveglia(Date.now() + CARICO_MAX_MS);
    this.forsePronti(r);
  }
  private lotto(id: string, act: string, body: Record<string, unknown>): Promise<Response> {
    return this.env.LOT.get(this.env.LOT.idFromName(id)).fetch(new Request(`https://do/${act}`, {
      method: 'POST', headers: { 'x-persona': id, 'x-now': String(Date.now()), 'content-type': 'application/json' }, body: JSON.stringify(body),
    }));
  }

  /** Sveglia: i duelli che aspettano ancora il caricamento di qualcuno da più di CARICO_MAX_MS partono lo stesso. */
  async alarm(): Promise<void> {
    const now = Date.now();
    for (const r of this.runs.values()) if (!r.t0 && !r.fine && now - r.creato >= CARICO_MAX_MS - 100) this.inizia(r);
    const presto = [...this.runs.values()].filter((r) => !r.t0 && !r.fine).map((r) => r.creato + CARICO_MAX_MS);
    if (presto.length) await this.sveglia(Math.min(...presto));
  }
  private async sveglia(quando: number): Promise<void> {
    try { const a = await this.ctx.storage.getAlarm(); if (a === null || a > quando) await this.ctx.storage.setAlarm(quando); } catch (e) { console.warn('[marea] sveglia dell\'Arena', e); }
  }
  private forsePronti(r: Run): void { if (!r.t0 && r.membri.every((m) => m.carico || !m.conn)) this.inizia(r); }
  private inizia(r: Run): void {
    if (r.t0 || r.fine) return;
    r.t0 = Date.now();
    if (!this.timer) this.timer = setInterval(() => this.batti(), SQ_TURNO_MS);
  }

  /** Ogni SQ_TURNO_MS: chi ha perso la linea ferma il duello (fino a STACCATO_MAX_MS, poi è arreso), poi i turni dovuti (a tempo di
   *  orologio: un timer in ritardo recupera). Se non resta nessuna persona, i gladiatori si arrendono. Nessun duello in corso: l'orologio si ferma. */
  private batti(): void {
    const now = Date.now();
    for (const r of [...this.runs.values()]) {
      if (r.fine || !r.t0) continue;
      const giu = r.membri.findIndex((m) => !m.bot && !m.conn && !m.arreso);
      if (giu >= 0) {
        const m = r.membri[giu]!;
        if (!m.staccato) m.staccato = now;
        if (now - m.staccato <= STACCATO_MAX_MS) {
          if (!r.pausa) { r.pausa = now; this.tutti(r, { t: 'attesa', chi: giu, ms: STACCATO_MAX_MS - (now - m.staccato) }); }
          r.t0 = now - r.turni.length * SQ_TURNO_MS;
          continue;
        }
        this.arrenditi(m); // troppo tempo: dato per arreso
      }
      if (!r.membri.some((m) => !m.bot && !m.arreso)) for (const m of r.membri) if (m.bot) this.arrenditi(m);
      if (r.pausa) { r.pausa = 0; r.t0 = now - r.turni.length * SQ_TURNO_MS; this.tutti(r, { t: 'attesa', chi: -1, ms: 0 }); }
      const dovuti = Math.floor((now - r.t0) / SQ_TURNO_MS) + 1;
      for (let k = 0; k < 10 && r.turni.length < dovuti && !r.fine; k++) this.turno(r);
    }
    if (![...this.runs.values()].some((r) => r.t0 && !r.fine) && this.timer) { clearInterval(this.timer); this.timer = null; }
  }
  private tutti(r: Run, m: ArServerMsg): void { for (const x of r.membri) if (x.conn) this.send(x.conn.ws, m); }

  /** Un turno: i gladiatori scelgono, le azioni della barra (solo quelle che il duello accetta), l'input di ciascuno (chi è staccato = fermo),
   *  SQ_TICKS passi del duello; a tutti. Finito il duello, si chiude. */
  private turno(r: Run): void {
    r.membri.forEach((m, i) => {
      if (!m.bot || m.arreso) return;
      const b = botArena(r.d, i, m.bot);
      m.last = inputGladiatore(b.input);
      if (b.azione && m.az.length < MAX_AZ) m.az.push(b.azione);
    });
    const az: [number, ArenaAzione][] = [];
    r.membri.forEach((m, i) => {
      for (const a of m.az) if (actDuello(r.d, i, a)) { az.push([i, a]); r.azioni.push([r.d.tick, i, a]); }
      m.az = [];
    });
    const f = r.membri.map((m) => (m.arreso || (!m.conn && !m.bot) ? FERMO : m.bot ? m.last : m.coda.shift() ?? m.last));
    r.membri.forEach((m, i) => {
      const x = f[i]!, mira = x[3] ?? 0, ult = m.log[m.log.length - 1];
      if (m.conn) m.last = x;
      if (ult && ult[1] === x[0] && ult[2] === x[1] && ult[3] === x[2] && (ult[4] ?? 0) === mira) ult[0] += SQ_TICKS;
      else m.log.push(mira ? [SQ_TICKS, x[0], x[1], x[2], mira] : [SQ_TICKS, x[0], x[1], x[2]]);
    });
    const frames = f.map(frameOf);
    for (let k = 0; k < SQ_TICKS; k++) stepDuello(r.d, frames);
    const t: ArTurno = { t: 'T', n: r.turni.length, f, ...(az.length ? { az } : {}) };
    r.turni.push(t);
    const msg = JSON.stringify(t satisfies ArServerMsg);
    for (const m of r.membri) if (m.conn) { try { m.conn.ws.send(msg); } catch { /* chiusa */ } }
    if (r.d.fase === 'finita' || r.d.tick >= MAX_TICKS_DUELLO) void this.finisci(r);
  }

  /** Fine: il duello rigiocato dal log decide l'esito; premio nel lotto di ciascuna persona (niente se tra gli avversari c'erano gladiatori),
   *  `fine` a tutti, socket chiuse. */
  private async finisci(r: Run): Promise<void> {
    if (r.fine) return;
    r.fine = Date.now();
    const eroi = r.membri.map((m) => m.m.eroe);
    const rep = replayDuello(r.seed, eroi, { inputs: r.membri.map((m) => m.log), azioni: r.azioni }, { squadre: r.squadre, mappa: r.mappa });
    if (rep.hash !== hashDuello(r.d)) console.warn('[marea] arena: il replay non coincide col duello dal vivo', { run: r.id, replay: rep.hash, vivo: hashDuello(r.d) });
    const esito: DuelloEsito | null = rep.esito;
    console.log(`[marea] arena: duello ${r.id} finito`, JSON.stringify(esito), `${rep.ticks} tick`);
    await Promise.all(r.membri.map(async (m, i) => {
      if (m.bot) return;
      let premio = 0, tetto = false;
      const ruolo: ArenaRuolo | null = !esito ? null : esito.vincitore === null ? 'pari' : esito.vincitore === r.squadre[i] && !m.arreso ? 'vinta' : esito.perche === 'resa' || m.arreso ? 'arreso' : 'persa';
      if (ruolo) {
        const senzaPremio = r.membri.some((o, j) => !!o.bot && r.squadre[j] !== r.squadre[i]);
        try {
          const res = await this.lotto(m.m.id, 'arena_fine', { run: r.id, ruolo, ...(senzaPremio ? { senzaPremio: true } : {}) });
          const b = (await res.json()) as { premio?: number; tetto?: boolean };
          premio = b.premio ?? 0; tetto = !!b.tetto;
        } catch (e) { console.warn('[marea] arena: premio non salvato', e); }
      }
      const c = m.conn;
      if (c) { this.send(c.ws, { t: 'fine', esito, premio, tetto }); c.run = null; m.conn = null; chiudi(c.ws, 1000, 'fine'); }
    }));
  }

  /** Si ricollega l'eroe `idx` del duello `runId`, che ha ricevuto i turni fino a `n` escluso: riceve quelli persi e il duello riparte. */
  private ricollega(c: Conn, runId: string, idx: number, n: number): void {
    const r = this.runs.get(runId), me = r?.membri[idx];
    if (!r || !me || me.bot || me.m.id !== c.id || r.fine || me.arreso || n > r.turni.length) {
      this.send(c.ws, { t: 'errore', msg: r?.fine ? 'Il duello è finito' : 'Il duello non c’è più' });
      chiudi(c.ws, 1000, 'fuori');
      return;
    }
    if (me.conn && me.conn !== c) { const old = me.conn; old.run = null; chiudi(old.ws, 1000, 'altra scheda'); }
    me.conn = c; me.staccato = 0; me.carico = true; me.coda = []; // `last` resta: il client riprende con lo stesso input (lo rimanda solo se cambia)
    c.run = r; c.dove = 'duello';
    console.log(`[marea] arena: ${me.m.nome} si ricollega al turno ${n} (server ${r.turni.length})`);
    this.send(c.ws, { t: 'ripresa', n: r.turni.length });
    for (const t of r.turni.slice(n)) this.send(c.ws, t);
    this.forsePronti(r);
  }
}
