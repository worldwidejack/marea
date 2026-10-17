// Duello dell'Arena (PROTOCOL.md §10, docs/ARENA.md): coda veloce, sale con codice e duelli 1v1 in tempo reale. Un'istanza sola
// (idFromName('arena')), socket normali come Spedizioni e TemplariInsieme (finché c'è qualcuno in coda o in duello il DO resta sveglio).
// Coda: `?modo=coda`, i primi due si sfidano. Sala: `?modo=sala` apre una sala con un codice da dire all'amico, che entra con
// `?modo=sala&codice=XXXX`. Trovati i due, il DO del lotto di ciascuno apre il duello (`arena_start`: la fotografia del set) → `parte` a
// tutti e due; quando hanno caricato (o dopo ARENA.rete.caricoSecondi) parte l'orologio: ogni SQ_TURNO_MS un turno con l'ultimo input di
// ciascuno e le azioni della barra (slot, pozioni, resa), mandato ai due. Il DO fa girare lo stesso duello (sim/arena/duello.ts): così sa
// quando finisce; allora lo rigioca dal log (replayDuello), e l'esito del replay decide: `arena_fine` nel lotto di ciascuno (premio col tetto
// del giorno) e `fine` ai due.
// Linea persa (socket caduta senza `esco`): il duello si ferma e aspetta ARENA.rete.staccatoSecondi; chi torna (`?run=&idx=&n=`) riceve i
// turni persi e si riparte, se no è dato per arreso (una `resa` nel turno dopo). `esco` nel duello = resa. Se il DO si riavvia (un deploy)
// i duelli in corso si perdono: nessun premio, si rientra dal colosseo.
import { DurableObject } from 'cloudflare:workers';
import { ARENA } from '@marea/content/arena.ts';
import { actDuello, createDuello, hashDuello, MAX_TICKS_DUELLO, parseArenaAzione, replayDuello, stepDuello } from '@marea/sim/arena/duello.ts';
import type { ArenaAzione, ArenaAzioni, DuelloEsito, DuelloState } from '@marea/sim/arena/duello.ts';
import type { ArenaEroe } from '@marea/sim/rpg/arena.ts';
import type { ArenaRuolo } from '@marea/sim/arena/premio.ts';
import { frameOfRiga } from '@marea/sim/dungeon/replay.ts';
import type { PackedDungeon } from '@marea/sim/dungeon/types.ts';
import type { Look } from '@marea/protocol';
import { AR_LETTERE, SQ_TICKS, SQ_TURNO_MS, isCodiceSala, parseArClient } from '@marea/protocol/arena.ts';
import type { ArEroe, ArServerMsg, ArTurno, SqInput } from '@marea/protocol/arena.ts';
import type { Env } from '../env.ts';

const CARICO_MAX_MS = ARENA.rete.caricoSecondi * 1000;
const STACCATO_MAX_MS = ARENA.rete.staccatoSecondi * 1000;
/** Input in coda oltre questi: si scartano i più vecchi tenendone i bottoni. */
const MAX_CODA = 4;
const MAX_MSG_PER_S = 40;
/** Azioni della barra in coda per turno; oltre si scartano. */
const MAX_AZ = 4;
const FERMO: SqInput = [0, 0, 0];

/** `dove`: in coda, in una sala (col suo codice), in duello. `esce`: ha detto `esco` (niente attesa per ricollegarsi). */
type Conn = { ws: WebSocket; id: string; nome: string; look: Look; dove: 'coda' | 'sala' | 'duello' | 'fuori'; codice: string; run: Run | null; s: number; n: number; esce: boolean };
/** `staccato`: da quando la sua socket è caduta senza `esco` (0 = collegato); `arreso`: è uscito o è stato dato per arreso. */
type Membro = { m: ArEroe; conn: Conn | null; last: SqInput; coda: SqInput[]; az: ArenaAzione[]; carico: boolean; staccato: number; arreso: boolean; log: PackedDungeon };
/** `pausa`: da quando il duello è fermo per una linea persa (0 = no). */
type Run = { id: string; seed: number; membri: Membro[]; turni: ArTurno[]; d: DuelloState; azioni: ArenaAzioni; creato: number; t0: number; fine: number; pausa: number };

const json = (v: unknown, status = 200): Response => new Response(JSON.stringify(v), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
const intDa = (v: string | null): number | null => (v !== null && /^\d{1,9}$/.test(v) ? Number(v) : null);
const frameOf = (x: SqInput) => frameOfRiga([SQ_TICKS, x[0], x[1], x[2], x[3]]);

export class Arena extends DurableObject<Env> {
  private coda: Conn[] = [];
  private sale = new Map<string, Conn>();
  private runs = new Map<string, Run>();
  private timer: ReturnType<typeof setInterval> | null = null;

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (req.headers.get('upgrade') !== 'websocket') return json({ error: 'WebSocket atteso' }, 426);
    const id = url.searchParams.get('id') ?? '', nome = url.searchParams.get('nome') ?? 'Ospite';
    let look: Look = { pelle: 2, capelli: 0, coloreCapelli: 0, vestito: 0, cappello: 1 };
    try { const l = JSON.parse(url.searchParams.get('look') ?? '{}') as Look; if (l && typeof l === 'object') look = { ...look, ...l }; } catch { /* look di default */ }
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    server.accept();
    const fatto = new Response(null, { status: 101, webSocket: client });
    if (!id) { this.send(server, { t: 'errore', msg: 'Chi sei?' }); server.close(1008, 'id'); return fatto; }
    const c: Conn = { ws: server, id, nome, look, dove: 'fuori', codice: '', run: null, s: 0, n: 0, esce: false };
    server.addEventListener('message', (ev) => this.onMessage(c, ev.data));
    server.addEventListener('close', () => this.via(c));
    server.addEventListener('error', () => this.via(c));
    // ricollegarsi a un duello in corso (linea persa)
    const run = url.searchParams.get('run'), idx = intDa(url.searchParams.get('idx')), n = intDa(url.searchParams.get('n'));
    if (run && idx !== null && n !== null) { this.ricollega(c, run, idx, n); return fatto; }
    // la stessa persona in un'altra scheda: quella vecchia esce dalla coda o dalla sala
    for (const o of [...this.coda, ...this.sale.values()]) if (o.id === id) { this.via(o); try { o.ws.close(1000, 'altra scheda'); } catch { /* chiusa */ } }
    const modo = url.searchParams.get('modo'), codice = (url.searchParams.get('codice') ?? '').toUpperCase();
    if (modo === 'sala' && codice) {
      const host = isCodiceSala(codice, ARENA.rete.codice) ? this.sale.get(codice) : undefined;
      if (!host) { this.send(server, { t: 'errore', msg: 'Sala non trovata: controlla il codice' }); server.close(1000, 'sala'); return fatto; }
      this.sale.delete(codice);
      void this.parti(host, c);
      return fatto;
    }
    if (modo === 'sala') {
      let k = '';
      for (let tent = 0; tent < 20 && (!k || this.sale.has(k)); tent++) k = Array.from(crypto.getRandomValues(new Uint8Array(ARENA.rete.codice)), (b) => AR_LETTERE[b % AR_LETTERE.length]).join('');
      c.dove = 'sala'; c.codice = k; this.sale.set(k, c);
      this.send(server, { t: 'attendi', modo: 'sala', codice: k });
      return fatto;
    }
    // coda veloce: se c'è già qualcuno (non io) si parte, se no aspetto
    const altro = this.coda.find((o) => o.id !== id && o.ws.readyState === 1);
    if (altro) { this.coda = this.coda.filter((o) => o !== altro); void this.parti(altro, c); return fatto; }
    c.dove = 'coda'; this.coda.push(c);
    this.send(server, { t: 'attendi', modo: 'coda', codice: '' });
    return fatto;
  }

  private send(ws: WebSocket, m: ArServerMsg): void { try { ws.send(JSON.stringify(m)); } catch { /* chiusa */ } }

  private onMessage(c: Conn, data: unknown): void {
    if (typeof data !== 'string') return;
    const sec = Math.floor(Date.now() / 1000);
    if (sec !== c.s) { c.s = sec; c.n = 0; }
    if (++c.n > MAX_MSG_PER_S) return;
    const m = parseArClient(data);
    if (!m) return;
    if (m.t === 'esco') { c.esce = true; this.via(c); try { c.ws.close(1000, 'ciao'); } catch { /* chiusa */ } return; }
    const r = c.run, me = r?.membri.find((x) => x.conn === c);
    if (!r || !me || r.fine || me.arreso) return;
    if (m.t === 'carico') { me.carico = true; this.forsePronti(r); return; }
    if (m.t === 'in') { me.coda.push(m.f); while (me.coda.length > MAX_CODA) { const old = me.coda.shift()!, h = me.coda[0]!; h[2] |= old[2]; } return; }
    if (m.t === 'az') { const a = parseArenaAzione(m.a); if (a && me.az.length < MAX_AZ) me.az.push(a); }
  }

  /** La connessione se ne va: dalla coda, dalla sala, o dal duello (con `esco` è una resa; se è caduta la linea il duello aspetta). */
  private via(c: Conn): void {
    this.coda = this.coda.filter((o) => o !== c);
    if (c.dove === 'sala' && this.sale.get(c.codice) === c) this.sale.delete(c.codice);
    const r = c.run, me = r?.membri.find((x) => x.conn === c);
    c.dove = 'fuori';
    if (!r || !me) return;
    me.conn = null; c.run = null;
    if (r.fine) return;
    if (c.esce) { this.arrenditi(me); return; }
    me.staccato = Date.now(); me.coda = [];
  }
  private arrenditi(me: Membro): void {
    if (me.arreso) return;
    me.arreso = true; me.staccato = 0; me.coda = []; me.az = [{ t: 'resa' }];
  }

  /** Trovati i due: ogni lotto apre il duello e fa la fotografia del set; poi `parte` a tutti e due. */
  private async parti(a: Conn, b: Conn): Promise<void> {
    const runId = crypto.randomUUID(), seed = crypto.getRandomValues(new Uint32Array(1))[0]! >>> 1, now = Date.now();
    const chi = [a, b], eroi: ArEroe[] = [];
    for (const x of chi) x.dove = 'duello';
    try {
      for (let i = 0; i < 2; i++) {
        const x = chi[i]!;
        const res = await this.lotto(x.id, 'arena_start', { run: runId, idx: i });
        const body = (await res.json()) as { eroe?: ArenaEroe; error?: string };
        if (!res.ok || !body.eroe) throw new Error(body.error ?? 'Duello non aperto');
        eroi.push({ id: x.id, nome: x.nome, look: x.look, eroe: body.eroe });
      }
    } catch (e) {
      console.warn('[marea] duello non partito', e);
      for (const x of chi) { this.send(x.ws, { t: 'errore', msg: 'Non si parte: riprova tra poco' }); try { x.ws.close(1000, 'errore'); } catch { /* chiusa */ } }
      return;
    }
    const d = createDuello({ seed, eroi: eroi.map((e) => e.eroe) });
    const r: Run = { id: runId, seed, membri: eroi.map((m, i) => ({ m, conn: chi[i]!, last: FERMO, coda: [], az: [], carico: false, staccato: 0, arreso: false, log: [] })), turni: [], d, azioni: [], creato: now, t0: 0, fine: 0, pausa: 0 };
    for (const [k, v] of this.runs) if (v.fine && now - v.fine > 10 * 60_000) this.runs.delete(k);
    this.runs.set(runId, r);
    r.membri.forEach((m, i) => {
      const x = m.conn!;
      if (x.ws.readyState !== 1) { m.conn = null; m.staccato = now; return; } // chiuso mentre si apriva: come una linea persa
      x.run = r;
      this.send(x.ws, { t: 'parte', run: runId, seed, io: i, eroi });
    });
    console.log(`[marea] arena: duello ${runId} (${eroi.map((e) => e.nome).join(' vs ')})`);
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
   *  orologio: un timer in ritardo recupera). Nessun duello in corso: l'orologio si ferma. */
  private batti(): void {
    const now = Date.now();
    for (const r of [...this.runs.values()]) {
      if (r.fine || !r.t0) continue;
      const giu = r.membri.findIndex((m) => !m.conn && !m.arreso);
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
      if (r.pausa) { r.pausa = 0; r.t0 = now - r.turni.length * SQ_TURNO_MS; this.tutti(r, { t: 'attesa', chi: -1, ms: 0 }); }
      const dovuti = Math.floor((now - r.t0) / SQ_TURNO_MS) + 1;
      for (let k = 0; k < 10 && r.turni.length < dovuti && !r.fine; k++) this.turno(r);
    }
    if (![...this.runs.values()].some((r) => r.t0 && !r.fine) && this.timer) { clearInterval(this.timer); this.timer = null; }
  }
  private tutti(r: Run, m: ArServerMsg): void { for (const x of r.membri) if (x.conn) this.send(x.conn.ws, m); }

  /** Un turno: le azioni della barra (solo quelle che il duello accetta), l'input di ciascuno (chi è staccato = fermo), SQ_TICKS passi del
   *  duello; a tutti e due. Finito il duello, si chiude. */
  private turno(r: Run): void {
    const az: [number, ArenaAzione][] = [];
    r.membri.forEach((m, i) => {
      for (const a of m.az) if (actDuello(r.d, i, a)) { az.push([i, a]); r.azioni.push([r.d.tick, i, a]); }
      m.az = [];
    });
    const f = r.membri.map((m) => (!m.conn || m.arreso ? FERMO : m.coda.shift() ?? m.last));
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

  /** Fine: il duello rigiocato dal log decide l'esito; premio nel lotto di ciascuno, `fine` a tutti e due, socket chiuse. */
  private async finisci(r: Run): Promise<void> {
    if (r.fine) return;
    r.fine = Date.now();
    const eroi = r.membri.map((m) => m.m.eroe);
    const rep = replayDuello(r.seed, eroi, { inputs: r.membri.map((m) => m.log), azioni: r.azioni });
    if (rep.hash !== hashDuello(r.d)) console.warn('[marea] arena: il replay non coincide col duello dal vivo', { run: r.id, replay: rep.hash, vivo: hashDuello(r.d) });
    const esito: DuelloEsito | null = rep.esito;
    console.log(`[marea] arena: duello ${r.id} finito`, JSON.stringify(esito), `${rep.ticks} tick`);
    await Promise.all(r.membri.map(async (m, i) => {
      let premio = 0, tetto = false;
      const ruolo: ArenaRuolo | null = !esito ? null : esito.vincitore === null ? 'pari' : esito.vincitore === i ? 'vinta' : esito.perche === 'resa' ? 'arreso' : 'persa';
      if (ruolo) {
        try {
          const res = await this.lotto(m.m.id, 'arena_fine', { run: r.id, ruolo });
          const b = (await res.json()) as { premio?: number; tetto?: boolean };
          premio = b.premio ?? 0; tetto = !!b.tetto;
        } catch (e) { console.warn('[marea] arena: premio non salvato', e); }
      }
      const c = m.conn;
      if (c) { this.send(c.ws, { t: 'fine', esito, premio, tetto }); c.run = null; m.conn = null; try { c.ws.close(1000, 'fine'); } catch { /* chiusa */ } }
    }));
  }

  /** Si ricollega l'eroe `idx` del duello `runId`, che ha ricevuto i turni fino a `n` escluso: riceve quelli persi e il duello riparte. */
  private ricollega(c: Conn, runId: string, idx: number, n: number): void {
    const r = this.runs.get(runId), me = r?.membri[idx];
    if (!r || !me || me.m.id !== c.id || r.fine || me.arreso || n > r.turni.length) {
      this.send(c.ws, { t: 'errore', msg: r?.fine ? 'Il duello è finito' : 'Il duello non c’è più' });
      try { c.ws.close(1000, 'fuori'); } catch { /* chiusa */ }
      return;
    }
    if (me.conn && me.conn !== c) { const old = me.conn; old.run = null; try { old.ws.close(1000, 'altra scheda'); } catch { /* chiusa */ } }
    me.conn = c; me.staccato = 0; me.carico = true; me.coda = []; me.last = FERMO;
    c.run = r; c.dove = 'duello';
    console.log(`[marea] arena: ${me.m.nome} si ricollega al turno ${n} (server ${r.turni.length})`);
    this.send(c.ws, { t: 'ripresa', n: r.turni.length });
    for (const t of r.turni.slice(n)) this.send(c.ws, t);
    this.forsePronti(r);
  }
}
