// DO delle lobby, code e partite dell’Arena (docs/PROTOCOL.md §10).
import { DurableObject } from 'cloudflare:workers';
import { ARENA, arenaModo } from '@marea/content/arena.ts';
import type { ArenaModo } from '@marea/content/arena.ts';
import { botArena } from '@marea/sim/arena/bot.ts';
import { actPartita, createPartita, eroiPer, formatoDi, hashPartita, MAX_TICKS_PARTITA, parseArenaAzione, replayPartita, stepPartita } from '@marea/sim/arena/partita.ts';
import type { ArenaAzione, ArenaAzioni, PartitaEsito, PartitaFormato, PartitaState } from '@marea/sim/arena/partita.ts';
import type { ArenaEroe } from '@marea/sim/rpg/arena.ts';
import type { ArenaRuolo } from '@marea/sim/arena/premio.ts';
import { frameOfRiga } from '@marea/sim/dungeon/replay.ts';
import type { PackedDungeon } from '@marea/sim/dungeon/types.ts';
import { createRng } from '@marea/sim/rng.ts';
import type { Rng } from '@marea/sim/rng.ts';
import type { Look } from '@marea/protocol';
import { AR_LETTERE, SQ_TICKS, SQ_TURNO_MS, isCodiceSala, isModo, parseArClient } from '@marea/protocol/arena.ts';
import type { ArEroe, ArServerMsg, ArTurno, SqInput } from '@marea/protocol/arena.ts';
import type { Env } from '../env.ts';
import { json } from '../http.ts';
import { accoda, apriSocket, chiudi, ospite, passa } from './sala.ts';
import { gladiatore, inputGladiatore, piazza, squadreCoda } from './arena_squadre.ts';
import { configuraSala, inSquadra, mappaSala } from './arena_lobby.ts';
import type { Sala } from './arena_lobby.ts';

const CARICO_MAX_MS = ARENA.rete.caricoSecondi * 1000;
const STACCATO_MAX_MS = ARENA.rete.staccatoSecondi * 1000;
const ATTESA_BOT_MS = ARENA.rete.attesaBotSecondi * 1000;
/** Input in coda oltre questi: si scartano i più vecchi tenendone i bottoni. */
const MAX_CODA = 4;
const MAX_MSG_PER_S = 40;
/** Azioni della barra in coda per turno; oltre si scartano. */
const MAX_AZ = 4;
const FERMO: SqInput = [0, 0, 0];

/** `dove`: in coda, in una sala (col suo codice), in partita. `m`, `f`: modalità ed eroi per squadra scelti. `esce`: ha detto `esco` (niente attesa per ricollegarsi). */
type Conn = { ws: WebSocket; id: string; nome: string; look: Look; dove: 'coda' | 'sala' | 'partita' | 'fuori'; codice: string; m: ArenaModo; f: number; run: Run | null; s: number; n: number; esce: boolean };
/** `staccato`: da quando la sua socket è caduta senza `esco` (0 = collegato); `arreso`: è uscito o è stato dato per arreso (`eliminato`: quando
 *  era già fuori per sempre, nella Sopravvivenza: allora conta come persa, non come resa); `bot`: gladiatore automatico (senza socket), col suo
 *  generatore di numeri. */
type Membro = { m: ArEroe; conn: Conn | null; bot: Rng | null; last: SqInput; coda: SqInput[]; az: ArenaAzione[]; carico: boolean; staccato: number; arreso: boolean; eliminato: boolean; log: PackedDungeon };
/** `pausa`: da quando la partita è ferma per una linea persa (0 = no). */
type Run = { id: string; seed: number; formato: PartitaFormato; squadre: number[]; membri: Membro[]; turni: ArTurno[]; d: PartitaState; azioni: ArenaAzioni; creato: number; t0: number; fine: number; pausa: number };

const intDa = (v: string | null): number | null => (v !== null && /^\d{1,9}$/.test(v) ? Number(v) : null);
const frameOf = (x: SqInput) => frameOfRiga([SQ_TICKS, x[0], x[1], x[2], x[3]]);
/** La coda di un formato (modalità ed eroi per squadra) e quanti posti ha una sua partita. */
const chiave = (m: ArenaModo, f: number): string => `${m}:${f}`;
const posti = (m: ArenaModo, f: number): number => eroiPer({ modo: m, per: f });
/** L'eroe i è a terra e non rinasce più (Sopravvivenza): se se ne va non c'è niente da aspettare. */
const fuoriPerSempre = (r: Run, i: number): boolean => i >= 0 && r.d.fase === 'gioca' && !!r.d.s.eroi[i]?.done && !r.d.torna[i];

export class Arena extends DurableObject<Env> {
  private coda: Conn[] = [];
  private sale = new Map<string, Sala<Conn>>();
  private runs = new Map<string, Run>();
  /** Per formato: il timer che, passata l'attesa, fa partire la coda con i gladiatori. */
  private attese = new Map<string, ReturnType<typeof setTimeout>>();
  private timer: ReturnType<typeof setInterval> | null = null;

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (req.headers.get('upgrade') !== 'websocket') return json({ error: 'WebSocket atteso' }, 426);
    const { id, nome, look } = ospite(url);
    const { server, fatto } = apriSocket();
    if (!id) { this.send(server, { t: 'errore', msg: 'Chi sei?' }); server.close(1008, 'id'); return fatto; }
    const mq = url.searchParams.get('m'), m: ArenaModo = isModo(mq) ? mq : 'stelle', fq = Number(url.searchParams.get('f'));
    const f = arenaModo(m).per.includes(fq) ? fq : arenaModo(m).per[0]!;
    const c: Conn = { ws: server, id, nome, look, dove: 'fuori', codice: '', m, f, run: null, s: 0, n: 0, esce: false };
    server.addEventListener('message', (ev) => this.onMessage(c, ev.data));
    server.addEventListener('close', () => this.via(c));
    server.addEventListener('error', () => this.via(c));
    // ricollegarsi a una partita in corso (linea persa)
    const run = url.searchParams.get('run'), idx = intDa(url.searchParams.get('idx')), n = intDa(url.searchParams.get('n'));
    if (run && idx !== null && n !== null) { this.ricollega(c, run, idx, n); return fatto; }
    // la stessa persona in un'altra scheda: quella vecchia esce dalla coda o dalla sala
    for (const o of [...this.coda, ...[...this.sale.values()].flatMap((s) => s.membri)]) if (o.id === id) { this.via(o); chiudi(o.ws, 1000, 'altra scheda'); }
    const modo = url.searchParams.get('modo'), codice = (url.searchParams.get('codice') ?? '').toUpperCase();
    if (modo === 'sala' && codice) { this.entraInSala(c, codice); return fatto; }
    if (modo === 'sala') {
      let k = '';
      for (let tent = 0; tent < 20 && (!k || this.sale.has(k)); tent++) k = Array.from(crypto.getRandomValues(new Uint8Array(ARENA.rete.codice)), (b) => AR_LETTERE[b % AR_LETTERE.length]).join('');
      if (this.sale.has(k)) { chiudi(c.ws, 1013, 'riprova'); return fatto; }
      c.dove = 'sala'; c.codice = k; this.sale.set(k, { m, f, mappa: mappaSala(m, url.searchParams.get('mappa') ?? ''), membri: [c], squadre: new Map([[c, 0]]), soli: [] });
      this.annuncia(this.sale.get(k)!);
      return fatto;
    }
    // coda veloce: si parte a partita piena o passata l'attesa
    c.dove = 'coda';
    this.coda.push(c);
    this.aggiornaCoda(m, f);
    return fatto;
  }

  private send(ws: WebSocket, m: ArServerMsg): void { try { ws.send(JSON.stringify(m)); } catch { /* chiusa */ } }

  /** Chi c'è in coda per il formato: dillo a tutti; a partita piena si parte, a coda vuota il timer si ferma, se no parte il timer dei gladiatori. */
  private aggiornaCoda(m: ArenaModo, f: number): void {
    const k = chiave(m, f), q = this.coda.filter((o) => o.m === m && o.f === f && o.dove === 'coda'), serve = posti(m, f);
    const t = this.attese.get(k);
    if (!q.length) { if (t) { clearTimeout(t); this.attese.delete(k); } return; }
    if (q.length >= serve) { this.parteCoda(m, f, q.slice(0, serve)); return; }
    for (const o of q) this.send(o.ws, { t: 'attendi', modo: 'coda', codice: '', m, f, dentro: q.length, serve });
    if (!t) this.attese.set(k, setTimeout(() => { this.attese.delete(k); this.riempiCoda(m, f); }, ATTESA_BOT_MS));
  }
  private riempiCoda(m: ArenaModo, f: number): void { const q = this.coda.filter((o) => o.m === m && o.f === f && o.dove === 'coda' && o.ws.readyState === 1); if (q.length) this.parteCoda(m, f, q); else this.aggiornaCoda(m, f); }
  private parteCoda(m: ArenaModo, f: number, q: Conn[]): void {
    const k = chiave(m, f), t = this.attese.get(k);
    if (t) { clearTimeout(t); this.attese.delete(k); }
    this.coda = this.coda.filter((o) => !q.includes(o));
    void this.parti(q, m, f, squadreCoda(q.length, posti(m, f) / f));
    if (this.coda.some((o) => o.m === m && o.f === f)) this.aggiornaCoda(m, f);
  }

  /** La lobby ha la capienza del formato più grande. Solo l’host avvia la partita. */
  private entraInSala(c: Conn, codice: string): void {
    const sala = isCodiceSala(codice, ARENA.rete.codice) ? this.sale.get(codice) : undefined;
    if (!sala) { this.send(c.ws, { t: 'errore', msg: 'Sala non trovata: controlla il codice' }); chiudi(c.ws, 1000, 'sala'); return; }
    const capienza = Math.max(...ARENA.modi.lista.flatMap((m) => m.per.map((f) => posti(m.id, f))));
    if (sala.membri.length >= capienza) { this.send(c.ws, { t: 'errore', msg: 'La lobby è piena' }); chiudi(c.ws, 1000, 'sala'); return; }
    c.codice = codice; c.dove = 'sala'; sala.membri.push(c);
    const q = Array.from({ length: posti(sala.m, sala.f) / sala.f }, (_, i) => i)
      .find((i) => inSquadra(sala, i).length < (sala.soli.includes(i) ? 1 : sala.f));
    sala.squadre.set(c, q ?? -1);
    this.annuncia(sala);
  }
  /** Dice a tutti nella sala chi c'è già; solo chi l'ha aperta può mandare `via`. */
  private annuncia(sala: Sala<Conn>): void {
    const codice = sala.membri[0]!.codice, serve = posti(sala.m, sala.f) - sala.soli.length;
    const membri = sala.membri.map((o) => ({ id: o.id, nome: o.nome, q: sala.squadre.get(o) ?? -1 }));
    sala.membri.forEach((o, i) => this.send(o.ws, { t: 'attendi', modo: 'sala', codice, m: sala.m, f: sala.f, dentro: membri.length, serve, host: i === 0, membri, soli: sala.soli, mappa: sala.mappa }));
  }

  private onMessage(c: Conn, data: unknown): void {
    if (typeof data !== 'string') return;
    if (!passa(c, MAX_MSG_PER_S)) return;
    const m = parseArClient(data);
    if (!m) return;
    if (m.t === 'esco') { c.esce = true; this.via(c); chiudi(c.ws, 1000, 'ciao'); return; }
    if (m.t === 'via' || m.t === 'formato' || m.t === 'squadra' || m.t === 'solo') {
      const sala = c.dove === 'sala' ? this.sale.get(c.codice) : undefined;
      if (!sala || sala.membri[0] !== c) return;
      if (m.t !== 'via') { configuraSala(sala, m); this.annuncia(sala); return; }
      if (m.riempi === 'players') { this.send(c.ws, { t: 'errore', msg: 'Il riempimento con giocatori è in arrivo' }); return; }
      const q = sala.membri.map((o) => sala.squadre.get(o) ?? -1);
      if (q.some((i) => i < 0)) { this.send(c.ws, { t: 'errore', msg: 'Scegli un formato con un posto per ogni giocatore' }); return; }
      this.sale.delete(c.codice);
      void this.parti(sala.membri, sala.m, sala.f, q, sala.mappa, sala.soli);
      return;
    }
    const r = c.run, me = r?.membri.find((x) => x.conn === c);
    if (!r || !me || r.fine || me.arreso) return;
    if (m.t === 'carico') { me.carico = true; this.forsePronti(r); return; }
    if (m.t === 'in') { accoda(me.coda, m.f, MAX_CODA); return; }
    if (m.t === 'az') { const a = parseArenaAzione(m.a); if (a && me.az.length < MAX_AZ) me.az.push(a); }
  }

  /** La connessione se ne va: dalla coda, dalla sala, o dalla partita (con `esco` è una resa; se è caduta la linea la partita aspetta). */
  private via(c: Conn): void {
    const eraInCoda = c.dove === 'coda', sala = c.dove === 'sala' ? this.sale.get(c.codice) : undefined;
    this.coda = this.coda.filter((o) => o !== c);
    c.dove = c.dove === 'partita' ? 'partita' : 'fuori';
    if (eraInCoda) this.aggiornaCoda(c.m, c.f);
    if (sala) this.lasciaSala(c, sala);
    const r = c.run, me = r?.membri.find((x) => x.conn === c);
    c.dove = 'fuori';
    if (!r || !me) return;
    me.conn = null; c.run = null;
    if (r.fine) return;
    if (c.esce || fuoriPerSempre(r, r.membri.indexOf(me))) { this.arrenditi(me, r); return; }
    me.staccato = Date.now(); me.coda = [];
  }
  /** Chi ha aperto la sala se ne va: la sala si chiude per tutti; un altro: gli altri vedono chi resta. */
  private lasciaSala(c: Conn, sala: Sala<Conn>): void {
    if (sala.membri[0] === c) {
      this.sale.delete(c.codice);
      for (const o of sala.membri) if (o !== c) { o.dove = 'fuori'; this.send(o.ws, { t: 'errore', msg: 'Chi aveva aperto la sala se n’è andato' }); chiudi(o.ws, 1000, 'sala chiusa'); }
    } else {
      const q = sala.squadre.get(c) ?? -1;
      sala.membri = sala.membri.filter((o) => o !== c); sala.squadre.delete(c);
      if (q >= 0) {
        const fuori = inSquadra(sala, -1)[0];
        if (fuori) sala.squadre.set(fuori, q);
        else if (!inSquadra(sala, q).length) sala.soli = sala.soli.filter((i) => i !== q);
      }
      this.annuncia(sala);
    }
  }
  private arrenditi(me: Membro, r: Run): void {
    if (me.arreso) return;
    me.arreso = true; me.eliminato = fuoriPerSempre(r, r.membri.indexOf(me)); me.staccato = 0; me.coda = []; me.az = [{ t: 'resa' }];
  }

  /** Trovati i partecipanti (persone, in ordine di arrivo, con la squadra di ciascuna): ogni lotto apre la partita e fa la fotografia della
   *  build; i posti vuoti sono dei gladiatori col set di una delle persone; poi `parte` a tutti. */
  private async parti(umani: Conn[], m: ArenaModo, f: number, squadre: number[], mappa?: string, soli: number[] = []): Promise<void> {
    const runId = crypto.randomUUID(), seed = crypto.getRandomValues(new Uint32Array(1))[0]! >>> 1, now = Date.now();
    const formato = { ...formatoDi(m, f, seed, mappa), soli }, n = eroiPer(formato), posti = piazza(squadre, n / formato.per, formato.per, soli);
    for (const x of umani) { x.dove = 'partita'; x.codice = ''; }
    const foto: ArenaEroe[] = [];
    try {
      await Promise.all(umani.map(async (x, p) => {
        const res = await this.lotto(x.id, 'arena_start', { run: runId, idx: posti.findIndex((po) => po.persona === p) });
        const body = (await res.json()) as { eroe?: ArenaEroe; error?: string };
        if (!res.ok || !body.eroe) throw new Error(body.error ?? 'Partita non aperta');
        foto[p] = body.eroe;
      }));
    } catch (e) {
      console.warn('[marea] partita dell’Arena non partita', e);
      for (const x of umani) { this.send(x.ws, { t: 'errore', msg: 'Non si parte: riprova tra poco' }); chiudi(x.ws, 1000, 'errore'); }
      return;
    }
    let gl = 0;
    const eroi: ArEroe[] = posti.map((po) => {
      if (po.persona !== null) { const x = umani[po.persona]!; return { id: x.id, nome: x.nome, look: x.look, eroe: foto[po.persona]! }; }
      const k = gl++;
      return gladiatore(k, foto[k % foto.length]!); // il set di una delle persone, a rotazione
    });
    const d = createPartita({ seed, eroi: eroi.map((e) => e.eroe), ...formato });
    const r: Run = {
      id: runId, seed, formato, squadre: d.squadre, turni: [], d, azioni: [], creato: now, t0: 0, fine: 0, pausa: 0,
      membri: eroi.map((m, i) => ({ m, conn: posti[i]!.persona === null ? null : umani[posti[i]!.persona!]!, bot: m.bot ? createRng((seed ^ Math.imul(i + 1, 0x9e3779b1)) >>> 0).fork('gladiatore') : null, last: FERMO, coda: [], az: [], carico: !!m.bot, staccato: 0, arreso: false, eliminato: false, log: [] })),
    };
    for (const [k, v] of this.runs) if (v.fine && now - v.fine > 10 * 60_000) this.runs.delete(k);
    this.runs.set(runId, r);
    r.membri.forEach((m, i) => {
      const x = m.conn;
      if (!x) return;
      if (x.ws.readyState !== 1) { m.conn = null; m.staccato = now; return; } // chiuso mentre si apriva: come una linea persa
      x.run = r;
      this.send(x.ws, { t: 'parte', run: runId, seed, io: i, eroi, m: formato.modo, f: formato.per, mappa: formato.mappa, soli });
    });
    console.log(`[marea] arena: partita ${runId} ${formato.modo} da ${formato.per} su ${formato.mappa} (${eroi.map((e) => e.nome).join(', ')})`);
    void this.sveglia(Date.now() + CARICO_MAX_MS);
    this.forsePronti(r);
  }
  private lotto(id: string, act: string, body: Record<string, unknown>): Promise<Response> {
    return this.env.LOT.get(this.env.LOT.idFromName(id)).fetch(new Request(`https://do/${act}`, {
      method: 'POST', headers: { 'x-persona': id, 'x-now': String(Date.now()), 'content-type': 'application/json' }, body: JSON.stringify(body),
    }));
  }

  /** Sveglia: le partite che aspettano ancora il caricamento di qualcuno da più di CARICO_MAX_MS partono lo stesso. */
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

  /** Ogni SQ_TURNO_MS: chi ha perso la linea ferma la partita (fino a STACCATO_MAX_MS, poi è arreso), poi i turni dovuti (a tempo di
   *  orologio: un timer in ritardo recupera). Se non resta nessuna persona, i gladiatori si arrendono. Nessuna partita in corso: l'orologio si ferma. */
  private batti(): void {
    const now = Date.now();
    for (const r of [...this.runs.values()]) {
      if (r.fine || !r.t0) continue;
      for (const [i, m] of r.membri.entries()) if (!m.bot && !m.conn && !m.arreso && fuoriPerSempre(r, i)) this.arrenditi(m, r); // eliminato e uscito: non si aspetta
      const giu = r.membri.findIndex((m) => !m.bot && !m.conn && !m.arreso);
      if (giu >= 0) {
        const m = r.membri[giu]!;
        if (!m.staccato) m.staccato = now;
        if (now - m.staccato <= STACCATO_MAX_MS) {
          if (!r.pausa) { r.pausa = now; this.tutti(r, { t: 'attesa', chi: giu, ms: STACCATO_MAX_MS - (now - m.staccato) }); }
          r.t0 = now - r.turni.length * SQ_TURNO_MS;
          continue;
        }
        this.arrenditi(m, r); // troppo tempo: dato per arreso
      }
      if (!r.membri.some((m) => !m.bot && !m.arreso)) for (const m of r.membri) if (m.bot) this.arrenditi(m, r);
      if (r.pausa) { r.pausa = 0; r.t0 = now - r.turni.length * SQ_TURNO_MS; this.tutti(r, { t: 'attesa', chi: -1, ms: 0 }); }
      const dovuti = Math.floor((now - r.t0) / SQ_TURNO_MS) + 1;
      for (let k = 0; k < 10 && r.turni.length < dovuti && !r.fine; k++) this.turno(r);
    }
    if (![...this.runs.values()].some((r) => r.t0 && !r.fine) && this.timer) { clearInterval(this.timer); this.timer = null; }
  }
  private tutti(r: Run, m: ArServerMsg): void { for (const x of r.membri) if (x.conn) this.send(x.conn.ws, m); }

  /** Un turno: i gladiatori scelgono, le azioni della barra (solo quelle che la partita accetta), l'input di ciascuno (chi è staccato = fermo),
   *  SQ_TICKS passi della partita; a tutti. Finita la partita, si chiude. */
  private turno(r: Run): void {
    r.membri.forEach((m, i) => {
      if (!m.bot || m.arreso) return;
      const b = botArena(r.d, i, m.bot);
      m.last = inputGladiatore(b.input);
      if (b.azione && m.az.length < MAX_AZ) m.az.push(b.azione);
    });
    const az: [number, ArenaAzione][] = [];
    r.membri.forEach((m, i) => {
      for (const a of m.az) if (actPartita(r.d, i, a)) { az.push([i, a]); r.azioni.push([r.d.tick, i, a]); }
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
    for (let k = 0; k < SQ_TICKS; k++) stepPartita(r.d, frames);
    const t: ArTurno = { t: 'T', n: r.turni.length, f, ...(az.length ? { az } : {}) };
    r.turni.push(t);
    const msg = JSON.stringify(t satisfies ArServerMsg);
    for (const m of r.membri) if (m.conn) { try { m.conn.ws.send(msg); } catch { /* chiusa */ } }
    if (r.d.fase === 'finita' || r.d.tick >= MAX_TICKS_PARTITA) void this.finisci(r);
  }

  /** Fine: la partita rigiocata dal log decide l'esito; premio nel lotto di ciascuna persona (niente se tra gli avversari non c'era nessuna
   *  persona), `fine` a tutti, socket chiuse. */
  private async finisci(r: Run): Promise<void> {
    if (r.fine) return;
    r.fine = Date.now();
    const eroi = r.membri.map((m) => m.m.eroe);
    const rep = replayPartita(r.seed, eroi, { inputs: r.membri.map((m) => m.log), azioni: r.azioni }, r.formato);
    if (rep.hash !== hashPartita(r.d)) console.warn('[marea] arena: il replay non coincide con la partita dal vivo', { run: r.id, replay: rep.hash, vivo: hashPartita(r.d) });
    const esito: PartitaEsito | null = rep.esito;
    console.log(`[marea] arena: partita ${r.id} finita`, JSON.stringify(esito), `${rep.ticks} tick`);
    await Promise.all(r.membri.map(async (m, i) => {
      if (m.bot) return;
      let premio = 0, tetto = false;
      const ruolo: ArenaRuolo | null = !esito ? null : esito.vincitore === null ? 'pari' : esito.vincitore === r.squadre[i] && !m.arreso ? 'vinta' : (esito.perche === 'resa' || m.arreso) && !m.eliminato ? 'arreso' : 'persa';
      if (ruolo) {
        const senzaPremio = !r.membri.some((o, j) => !o.bot && r.squadre[j] !== r.squadre[i]);
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

  /** Si ricollega l'eroe `idx` della partita `runId`, che ha ricevuto i turni fino a `n` escluso: riceve quelli persi e la partita riparte. */
  private ricollega(c: Conn, runId: string, idx: number, n: number): void {
    const r = this.runs.get(runId), me = r?.membri[idx];
    if (!r || !me || me.bot || me.m.id !== c.id || r.fine || me.arreso || n > r.turni.length) {
      this.send(c.ws, { t: 'errore', msg: r?.fine ? 'La partita è finita' : 'La partita non c’è più' });
      chiudi(c.ws, 1000, 'fuori');
      return;
    }
    if (me.conn && me.conn !== c) { const old = me.conn; old.run = null; chiudi(old.ws, 1000, 'altra scheda'); }
    me.conn = c; me.staccato = 0; me.carico = true; me.coda = []; // `last` resta: il client riprende con lo stesso input (lo rimanda solo se cambia)
    c.run = r; c.dove = 'partita';
    console.log(`[marea] arena: ${me.m.nome} si ricollega al turno ${n} (server ${r.turni.length})`);
    this.send(c.ws, { t: 'ripresa', n: r.turni.length });
    for (const t of r.turni.slice(n)) this.send(c.ws, t);
    this.forsePronti(r);
  }
}
