// Templari insieme (PROTOCOL.md §9, 10 ott 2026): la sala alla porta della chiesa e le partite in tempo reale. Un'istanza sola
// (idFromName('templari')), socket normali come Spedizioni (finché c'è qualcuno in sala o in partita il DO resta sveglio).
// Sala: chi preme GIOCA INSIEME apre `/ws/templari` ed entra (al massimo TI_MAX); SI PARTE (chiunque, con almeno 2) → seed, e per ogni membro
// il DO del suo lotto apre la partita insieme (`templari_party_start`) → `parte` a tutti. Partita: quando tutti hanno caricato (o dopo
// CARICO_MAX_MS) parte l'orologio; ogni SQ_TURNO_MS un turno con l'ultimo input di ciascuno (chi è staccato = fermo) mandato a tutti e
// scritto nel log; chi esce (`esco`) va in `via` nel turno dopo (la sim lo toglie: ritira). Il DO del lotto chiede il log a fine partita
// (POST /log {run, idx}: quell'eroe è fuori da adesso) e lo rigioca con replayTemplariInsieme. Il server non simula niente: la partita
// finisce quando escono tutti (o al tetto dei 60 minuti).
// Ripresa (15 ott 2026, #326): la partita si salva ogni SALVA_MS (log, turno, membri). Se la socket di uno cade senza `esco` il suo eroe
// sta fermo e lui ha STACCATO_MAX_MS per ricollegarsi (`?run=&idx=&n=`): riceve i turni persi e continua. Se cade il DO (ogni deploy lo
// riavvia, e tutte le socket si chiudono) la partita si ricarica dallo storage al primo che si ricollega e aspetta gli altri (al massimo
// RIPRESA_MAX_MS): ognuno rimanda in `storia` i turni ricevuti dopo l'ultimo salvataggio, il server li rimette nel log (sono uguali per
// tutti) e riparte da lì. Chi è più avanti di quello che il server riesce a ricostruire esce dalla partita.
import { DurableObject } from 'cloudflare:workers';
import { decodeDungeon, encodeDungeon } from '@marea/sim/dungeon/replay.ts';
import type { PackedDungeon } from '@marea/sim/dungeon/types.ts';
import { MAX_TICKS } from '@marea/sim/templari/templari.ts';
import { parseTAzioniInsieme } from '@marea/sim/templari/replay.ts';
import type { TAzioniInsieme } from '@marea/sim/templari/replay.ts';
import type { TAzione } from '@marea/sim/templari/types.ts';
import type { Look } from '@marea/protocol';
import { eroeDef } from '@marea/content/templari.ts';
import type { TClasse } from '@marea/content/templari.ts';
import { SQ_TICKS, SQ_TURNO_MS, TI_MAX, isTiTurno, parseTiClient } from '@marea/protocol/templari_insieme.ts';
import type { SqInput, TiMembro, TiServerMsg, TiTurno } from '@marea/protocol/templari_insieme.ts';
import type { Env } from '../env.ts';
import type { LogTemplari } from './lot_templari.ts';

const CARICO_MAX_MS = 20_000;
const SALVA_MS = 5_000;
const TIENI_MS = 24 * 3600_000;
/** Chi perde la linea ha tanto per ricollegarsi; poi esce dalla partita. */
const STACCATO_MAX_MS = 30_000;
/** Partita ricaricata dopo un riavvio del DO: aspetta che si ricolleghino tutti, ma non oltre. */
const RIPRESA_MAX_MS = 10_000;
/** Input in coda oltre questi: si scartano i più vecchi tenendone i bottoni. */
const MAX_CODA = 4;
const MAX_MSG_PER_S = 40;
/** Acquisti in coda per eroe (nel turno dopo); oltre si scartano. */
const MAX_AZ = 4;
const FERMO: SqInput = [0, 0, 0];

/** `classe`: l'eroe scelto nel menù prima di entrare in sala (null = senza). `prossimo`: il primo turno che il client non ha ancora
 *  (per la ripresa); `esce`: ha detto `esco` (niente attesa per ricollegarsi). */
type Conn = { ws: WebSocket; id: string; nome: string; look: Look; classe: TClasse | null; run: Run | null; s: number; n: number; prossimo: number; esce: boolean };
/** `staccato`: da quando la sua socket è caduta senza `esco` (0 = collegato); `storia`: ha risposto alla ripresa. */
type Membro = { m: TiMembro; conn: Conn | null; last: SqInput; coda: SqInput[]; az: TAzione[]; fuori: boolean; uscita: number | null; annuncia: boolean; carico: boolean; log: PackedDungeon; staccato: number; storia: boolean };
/** `ripresa`: da quando la partita, ricaricata dallo storage, aspetta che si ricolleghino (0 = no). */
type Run = { id: string; seed: number; membri: Membro[]; turno: number; creato: number; t0: number; fine: number; salvato: number; azioni: TAzioniInsieme; ripresa: number };
/** Quello che sta nello storage: il log per il DO del lotto, più quanto serve per riprendere la partita. */
type Salvata = LogTemplari & { quando: number; turno?: number; membri?: TiMembro[]; fuori?: boolean[]; last?: SqInput[]; creato?: number; fine?: number };

const json = (v: unknown, status = 200): Response => new Response(JSON.stringify(v), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
const intDa = (v: string | null): number | null => (v !== null && /^\d{1,9}$/.test(v) ? Number(v) : null);

export class TemplariInsieme extends DurableObject<Env> {
  private sala: Conn[] = [];
  private runs = new Map<string, Run>();
  private caricando = new Map<string, Promise<Run | null>>();
  private timer: ReturnType<typeof setInterval> | null = null;

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === 'POST' && url.pathname === '/log') return this.logPer(req);
    if (req.headers.get('upgrade') !== 'websocket') return new Response('WebSocket atteso', { status: 426 });
    const id = url.searchParams.get('id') ?? '', nome = url.searchParams.get('nome') ?? 'Ospite';
    let look: Look = { pelle: 2, capelli: 0, coloreCapelli: 0, vestito: 0, cappello: 1 };
    try { const l = JSON.parse(url.searchParams.get('look') ?? '{}') as Look; if (l && typeof l === 'object') look = { ...look, ...l }; } catch { /* look di default */ }
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    server.accept();
    const fatto = new Response(null, { status: 101, webSocket: client });
    if (!id) { this.send(server, { t: 'errore', msg: 'Chi sei?' }); server.close(1008, 'id'); return fatto; }
    const c: Conn = { ws: server, id, nome, look, classe: eroeDef(url.searchParams.get('classe'))?.id ?? null, run: null, s: 0, n: 0, prossimo: 0, esce: false };
    server.addEventListener('message', (ev) => this.onMessage(c, ev.data));
    server.addEventListener('close', () => this.via(c));
    server.addEventListener('error', () => this.via(c));
    // ricollegarsi a una partita in corso (linea persa o DO riavviato)
    const run = url.searchParams.get('run'), idx = intDa(url.searchParams.get('idx')), n = intDa(url.searchParams.get('n'));
    if (run && idx !== null && n !== null) { void this.ricollega(c, run, idx, n); return fatto; }
    // la stessa persona in un'altra scheda: quella vecchia esce
    for (const o of [...this.sala]) if (o.id === id) { this.via(o); try { o.ws.close(1000, 'altra scheda'); } catch { /* chiusa */ } }
    if (this.sala.length >= TI_MAX) { this.send(server, { t: 'errore', msg: `La sala è piena (${TI_MAX})` }); server.close(1013, 'piena'); return fatto; }
    this.sala.push(c);
    this.annuncia();
    return fatto;
  }

  private send(ws: WebSocket, m: TiServerMsg): void { try { ws.send(JSON.stringify(m)); } catch { /* chiusa */ } }
  private membro(c: Conn): TiMembro { return { id: c.id, nome: c.nome, look: c.look, ...(c.classe ? { classe: c.classe } : {}) }; }
  private annuncia(): void {
    const s = JSON.stringify({ t: 'sala', membri: this.sala.map((c) => this.membro(c)), max: TI_MAX } satisfies TiServerMsg);
    for (const c of this.sala) { try { c.ws.send(s); } catch { /* chiusa */ } }
  }

  private onMessage(c: Conn, data: unknown): void {
    if (typeof data !== 'string') return;
    const sec = Math.floor(Date.now() / 1000);
    if (sec !== c.s) { c.s = sec; c.n = 0; }
    if (++c.n > MAX_MSG_PER_S) return;
    const m = parseTiClient(data);
    if (!m) return;
    if (m.t === 'esco') { c.esce = true; this.via(c); try { c.ws.close(1000, 'ciao'); } catch { /* chiusa */ } return; }
    if (m.t === 'via') { void this.parti(c); return; }
    const r = c.run, me = r?.membri.find((x) => x.conn === c);
    if (!r || !me || me.fuori) return;
    if (m.t === 'storia') { this.storia(r, me, m.turni); return; }
    if (m.t === 'carico') { me.carico = true; this.forsePronti(r); return; }
    if (m.t === 'in') { me.coda.push(m.f); while (me.coda.length > MAX_CODA) { const old = me.coda.shift()!, h = me.coda[0]!; h[2] |= old[2]; } }
    if (m.t === 'az') { const ok = parseTAzioniInsieme([[0, 0, m.a]], 1); if (ok?.[0] && me.az.length < MAX_AZ) me.az.push(ok[0][2]); }
  }

  /** La connessione se ne va: dalla sala, o dalla partita. Con `esco` (o a partita finita) l'eroe esce nel turno dopo; se è caduta la linea
   *  resta fermo e aspetta che si ricolleghi (STACCATO_MAX_MS). */
  private via(c: Conn): void {
    const k = this.sala.indexOf(c);
    if (k >= 0) { this.sala.splice(k, 1); this.annuncia(); }
    const r = c.run, me = r?.membri.find((x) => x.conn === c);
    if (!r || !me) return;
    me.conn = null; c.run = null;
    if (c.esce || r.fine) { this.fuori(r, me); return; }
    me.staccato = Date.now(); me.coda = []; me.az = [];
    if (r.ripresa) this.forseRiparti(r);
  }
  private fuori(r: Run, me: Membro): void {
    if (me.fuori) return;
    me.fuori = true; me.coda = []; me.az = []; me.annuncia = true; me.staccato = 0;
    if (r.membri.every((x) => x.fuori)) this.chiudi(r);
    else if (r.ripresa) this.forseRiparti(r);
    else this.forsePronti(r);
  }

  /** SI PARTE: tutta la sala entra in chiesa. Ogni lotto apre la sua partita insieme col seed comune. */
  private async parti(c: Conn): Promise<void> {
    if (!this.sala.includes(c)) return;
    if (this.sala.length < 2) { this.send(c.ws, { t: 'errore', msg: 'Serve almeno un compagno: deve premere GIOCA INSIEME anche lui' }); return; }
    const chi = [...this.sala];
    this.sala = [];
    const runId = crypto.randomUUID(), seed = crypto.getRandomValues(new Uint32Array(1))[0]! >>> 1, now = Date.now();
    const r: Run = { id: runId, seed, membri: [], turno: 0, creato: now, t0: 0, fine: 0, salvato: 0, azioni: [], ripresa: 0 };
    try {
      for (let i = 0; i < chi.length; i++) {
        const x = chi[i]!;
        const res = await this.env.LOT.get(this.env.LOT.idFromName(x.id)).fetch(new Request('https://do/templari_party_start', {
          method: 'POST', headers: { 'x-persona': x.id, 'x-now': String(Date.now()), 'content-type': 'application/json' },
          body: JSON.stringify({ seed, run: runId, idx: i }),
        }));
        if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? 'Partita non aperta');
        r.membri.push({ m: this.membro(x), conn: x, last: FERMO, coda: [], az: [], fuori: false, uscita: null, annuncia: false, carico: false, log: [], staccato: 0, storia: false });
      }
    } catch (e) {
      console.warn('[marea] templari insieme non partiti', e);
      for (const x of chi) this.send(x.ws, { t: 'errore', msg: 'Non si parte: riprova tra poco' });
      // la sala torna com'era (chi è ancora connesso)
      this.sala.push(...chi.filter((x) => x.ws.readyState === 1 && !this.sala.includes(x)));
      this.annuncia();
      return;
    }
    for (const [k, v] of this.runs) if (v.fine && now - v.fine > 10 * 60_000) this.runs.delete(k);
    this.runs.set(runId, r);
    this.annuncia();
    const membri = r.membri.map((m) => m.m);
    r.membri.forEach((m, i) => {
      if (m.conn) { m.conn.run = r; if (m.conn.ws.readyState === 1) { this.send(m.conn.ws, { t: 'parte', run: runId, seed, io: i, membri }); return; } }
      m.conn = null; this.fuori(r, m); // chiuso mentre si apriva la partita
    });
    console.log(`[marea] templari insieme: ${r.membri.length} eroi, run ${runId}`);
    void this.sveglia(Date.now() + CARICO_MAX_MS);
    this.forsePronti(r);
  }

  /** Sveglia: le partite che aspettano ancora qualcuno da più di CARICO_MAX_MS partono lo stesso, quelle ricaricate dopo un riavvio
   *  ripartono anche senza chi non è tornato in RIPRESA_MAX_MS. */
  async alarm(): Promise<void> {
    const now = Date.now();
    for (const r of this.runs.values()) {
      if (r.fine) continue;
      if (r.ripresa) { if (now - r.ripresa >= RIPRESA_MAX_MS - 100) this.riparti(r); }
      else if (!r.t0 && now - r.creato >= CARICO_MAX_MS - 100) this.inizia(r);
    }
    const presto = [...this.runs.values()].filter((r) => !r.fine && (r.ripresa || !r.t0)).map((r) => (r.ripresa ? r.ripresa + RIPRESA_MAX_MS : r.creato + CARICO_MAX_MS));
    if (presto.length) await this.sveglia(Math.min(...presto));
  }
  private async sveglia(quando: number): Promise<void> {
    try { const a = await this.ctx.storage.getAlarm(); if (a === null || a > quando) await this.ctx.storage.setAlarm(quando); } catch (e) { console.warn('[marea] sveglia dei Templari insieme', e); }
  }

  private forsePronti(r: Run): void { if (!r.t0 && !r.ripresa && r.membri.every((m) => m.carico || m.fuori)) this.inizia(r); }
  private inizia(r: Run): void {
    if (r.t0 || r.fine) return;
    r.t0 = Date.now();
    this.batte();
  }
  private batte(): void { if (!this.timer) this.timer = setInterval(() => this.batti(), SQ_TURNO_MS); }
  /** Ogni SQ_TURNO_MS: i turni dovuti (a tempo di orologio: un timer in ritardo recupera), chi è staccato da troppo esce, i salvataggi.
   *  Con nessuno collegato la partita si ferma (aspetta che qualcuno torni). */
  private batti(): void {
    const now = Date.now();
    for (const r of [...this.runs.values()]) {
      if (r.fine || !r.t0 || r.ripresa) continue;
      for (const m of r.membri) if (!m.fuori && !m.conn && m.staccato && now - m.staccato > STACCATO_MAX_MS) this.fuori(r, m);
      if (r.fine) continue;
      if (r.membri.every((m) => m.fuori || !m.conn)) { r.t0 = now - r.turno * SQ_TURNO_MS; continue; }
      const dovuti = Math.floor((now - r.t0) / SQ_TURNO_MS) + 1;
      for (let k = 0; k < 10 && r.turno < dovuti && !r.fine; k++) this.turno(r);
      if (!r.fine && now - r.salvato > SALVA_MS) { r.salvato = now; void this.persisti(r); }
    }
    if (![...this.runs.values()].some((r) => r.t0 && !r.fine && !r.ripresa) && this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  /** Un turno nuovo: l'input di ciascuno (chi è staccato o fuori = fermo), le uscite e gli acquisti; a tutti i collegati. */
  private turno(r: Run): void {
    const f: SqInput[] = [], via: number[] = [], az: [number, TAzione][] = [];
    r.membri.forEach((m, i) => {
      if (m.annuncia) via.push(i);
      for (const a of m.az) az.push([i, a]);
      m.az = [];
      f.push(m.fuori || !m.conn ? FERMO : m.coda.shift() ?? m.last);
    });
    const t: TiTurno = { t: 'T', n: r.turno, f, ...(via.length ? { via } : {}), ...(az.length ? { az } : {}) };
    this.registra(r, t);
    const msg = JSON.stringify(t satisfies TiServerMsg);
    for (const m of r.membri) if (m.conn && !m.fuori) { try { m.conn.ws.send(msg); } catch { /* chiusa */ } m.conn.prossimo = r.turno; }
    if (r.turno * SQ_TICKS >= MAX_TICKS) { for (const m of r.membri) if (m.conn) { try { m.conn.ws.close(1000, 'alba'); } catch { /* chiusa */ } } this.chiudi(r); }
  }
  /** Il turno r.turno nel log (dal server o, nella ripresa, dalla storia di un client): uscite, acquisti, input di ciascuno. */
  private registra(r: Run, t: TiTurno): void {
    const tick = r.turno * SQ_TICKS;
    for (const i of t.via ?? []) { const m = r.membri[i]; if (m) { m.uscita = tick; m.annuncia = false; m.fuori = true; } }
    for (const [i, a] of t.az ?? []) r.azioni.push([tick, i, a]);
    r.membri.forEach((m, i) => {
      const x = t.f[i] ?? FERMO, mira = x[3] ?? 0, ult = m.log[m.log.length - 1];
      if (!m.fuori && m.conn) m.last = x;
      if (ult && ult[1] === x[0] && ult[2] === x[1] && ult[3] === x[2] && (ult[4] ?? 0) === mira) ult[0] += SQ_TICKS;
      else m.log.push(mira ? [SQ_TICKS, x[0], x[1], x[2], mira] : [SQ_TICKS, x[0], x[1], x[2]]);
    });
    r.turno++;
  }
  /** I turni da `da` a r.turno escluso, ricostruiti dal log (per chi si ricollega e ne ha persi). */
  private turniDa(r: Run, da: number): TiTurno[] {
    const n = Math.max(0, r.turno - da);
    if (!n) return [];
    const col = r.membri.map((m) => {
      const out: SqInput[] = [], t0 = da * SQ_TICKS;
      let t = 0;
      for (const [k, mx, my, b, mi] of m.log) {
        // le righe del log sono lunghe un multiplo di SQ_TICKS: i turni che cominciano dentro questa riga
        for (let s = Math.max(t, t0); s < t + k && out.length < n; s += SQ_TICKS) out.push(mi ? [mx!, my!, b!, mi] : [mx!, my!, b!]);
        t += k;
        if (out.length >= n) break;
      }
      return out;
    });
    const turni: TiTurno[] = [];
    for (let k = 0; k < n; k++) {
      const tick = (da + k) * SQ_TICKS, via: number[] = [], az: [number, TAzione][] = [];
      r.membri.forEach((m, i) => { if (m.uscita === tick) via.push(i); });
      for (const [tt, i, a] of r.azioni) if (tt === tick) az.push([i, a]);
      turni.push({ t: 'T', n: da + k, f: col.map((c) => c[k] ?? FERMO), ...(via.length ? { via } : {}), ...(az.length ? { az } : {}) });
    }
    return turni;
  }

  // ---- ripresa ----

  /** Si ricollega l'eroe `idx` della partita `runId`, che ha ricevuto i turni fino a `n` escluso. */
  private async ricollega(c: Conn, runId: string, idx: number, n: number): Promise<void> {
    const r = await this.trova(runId);
    const me = r && !r.fine ? r.membri[idx] : undefined;
    if (c.ws.readyState !== 1) return;
    if (!r || !me || me.m.id !== c.id || me.fuori) { this.butta(c, 'La partita insieme non c’è più'); return; }
    if (me.conn && me.conn !== c) { const old = me.conn; old.run = null; try { old.ws.close(1000, 'altra scheda'); } catch { /* chiusa */ } }
    me.conn = c; me.staccato = 0; me.carico = true; me.coda = []; me.az = []; me.last = FERMO;
    c.run = r; c.classe = me.m.classe ?? null; c.prossimo = n;
    console.log(`[marea] templari insieme: ${me.m.nome} si ricollega al turno ${n} (server ${r.turno}${r.ripresa ? ', in ripresa' : ''})`);
    if (r.ripresa) { me.storia = false; this.send(c.ws, { t: 'ripresa', n: r.turno }); return; }
    // partita viva: gli mando i turni che ha perso (se è più avanti del server non si può rimettere insieme)
    if (n > r.turno) { this.butta(c, 'La partita è andata avanti senza di te'); me.conn = null; this.fuori(r, me); return; }
    this.send(c.ws, { t: 'ripresa', n: r.turno });
    this.recupera(r, c);
  }
  private butta(c: Conn, msg: string): void {
    this.send(c.ws, { t: 'errore', msg });
    c.run = null;
    try { c.ws.close(1000, 'fuori'); } catch { /* chiusa */ }
  }
  private recupera(r: Run, c: Conn): void {
    for (const t of this.turniDa(r, c.prossimo)) this.send(c.ws, t);
    c.prossimo = r.turno;
  }
  /** Risposta a `ripresa`: i turni che il server non ha salvato li prende dal primo che li ha (sono uguali per tutti). */
  private storia(r: Run, me: Membro, turni: unknown[]): void {
    if (!r.ripresa) return;
    for (const t of turni) {
      if (!isTiTurno(t, r.membri.length)) break;
      if (t.n < r.turno) continue;
      if (t.n > r.turno) break; // un buco: da qui non si va avanti
      const az = t.az?.length ? parseTAzioniInsieme(t.az.map(([i, a]) => [0, i, a]), r.membri.length) : [];
      if (!az) break;
      this.registra(r, { ...t, ...(az.length ? { az: az.map(([, i, a]) => [i, a] as [number, TAzione]) } : {}) });
    }
    me.storia = true;
    this.forseRiparti(r);
  }
  private forseRiparti(r: Run): void { if (r.ripresa && r.membri.every((m) => m.fuori || (m.conn && m.storia))) this.riparti(r); }
  /** La partita ricaricata riparte dal turno a cui è arrivato il server: chi ha già più turni di così esce (non si rimette insieme). */
  private riparti(r: Run): void {
    if (!r.ripresa || r.fine) return;
    r.ripresa = 0;
    for (const m of r.membri) {
      if (m.fuori || !m.conn) continue;
      if (m.conn.prossimo > r.turno) { const c = m.conn; m.conn = null; this.butta(c, 'Non riesco a rimettere insieme la partita: esci e rientra'); this.fuori(r, m); continue; }
      this.recupera(r, m.conn);
    }
    if (r.fine) return;
    console.log(`[marea] templari insieme: partita ${r.id} ripresa al turno ${r.turno}`);
    r.t0 = Date.now() - r.turno * SQ_TURNO_MS; r.salvato = 0;
    this.batte();
  }
  /** La partita in memoria, o (dopo un riavvio) ricaricata dallo storage: aspetta in ripresa che si ricolleghino. */
  private async trova(runId: string): Promise<Run | null> {
    const r = this.runs.get(runId);
    if (r) return r;
    let p = this.caricando.get(runId);
    if (!p) { p = this.carica(runId); this.caricando.set(runId, p); }
    try { return await p; } finally { this.caricando.delete(runId); }
  }
  private async carica(runId: string): Promise<Run | null> {
    let v: Salvata | undefined;
    try { v = await this.ctx.storage.get<Salvata>(`run:${runId}`); } catch (e) { console.warn('[marea] partita insieme non letta', e); return null; }
    if (!v || v.fine || !Number.isInteger(v.turno) || !Array.isArray(v.membri) || v.membri.length !== v.inputs.length) return null;
    const turno = v.turno!, tick = turno * SQ_TICKS, now = Date.now();
    const log = v.inputs.map((x) => decodeDungeon(x, MAX_TICKS));
    if (log.some((l) => !l || l.reduce((t, e) => t + e[0], 0) !== tick)) { console.warn('[marea] partita insieme salvata non valida', runId); return null; }
    const r: Run = {
      id: runId, seed: v.seed, turno, creato: v.creato ?? now, t0: 0, fine: 0, salvato: now, azioni: v.azioni ?? [], ripresa: now,
      membri: v.membri.map((m, i) => {
        // un'uscita al tick del turno dopo l'ultimo salvato era annunciata e non ancora mandata
        const u = v.uscite[i] ?? null, annuncia = u !== null && u >= tick;
        return { m, conn: null, last: v.last?.[i] ?? FERMO, coda: [], az: [], fuori: !!v.fuori?.[i] || annuncia, uscita: annuncia ? null : u, annuncia, carico: true, log: log[i]!, staccato: now, storia: false };
      }),
    };
    if (r.membri.every((m) => m.fuori)) return null;
    this.runs.set(runId, r);
    console.log(`[marea] templari insieme: partita ${runId} ricaricata al turno ${turno}`);
    void this.sveglia(now + RIPRESA_MAX_MS);
    return r;
  }

  private chiudi(r: Run): void {
    if (r.fine) return;
    r.fine = Date.now(); r.ripresa = 0;
    void this.persisti(r);
    console.log(`[marea] templari insieme finiti: ${r.turno} turni, run ${r.id}`);
  }

  /** Il log fin qui; chi è appena uscito (non ancora in un turno) esce al tick del prossimo turno. */
  private logOf(r: Run): LogTemplari {
    const tick = r.turno * SQ_TICKS;
    return { seed: r.seed, inputs: r.membri.map((m) => encodeDungeon(m.log)), uscite: r.membri.map((m) => m.uscita ?? (m.annuncia ? tick : null)), azioni: r.azioni, classi: r.membri.map((m) => m.m.classe ?? null) };
  }
  private async persisti(r: Run): Promise<void> {
    try {
      const v: Salvata = { ...this.logOf(r), quando: Date.now(), turno: r.turno, membri: r.membri.map((m) => m.m), fuori: r.membri.map((m) => m.fuori), last: r.membri.map((m) => m.last), creato: r.creato, ...(r.fine ? { fine: r.fine } : {}) };
      await this.ctx.storage.put(`run:${r.id}`, v);
      if (!r.salvato || r.fine) {
        const vecchi = await this.ctx.storage.list<{ quando?: number }>({ prefix: 'run:' });
        const via = [...vecchi].filter(([, x]) => !x?.quando || Date.now() - x.quando > TIENI_MS).map(([k]) => k);
        if (via.length) await this.ctx.storage.delete(via.slice(0, 128));
      }
    } catch (e) { console.warn('[marea] log dei Templari insieme non salvato', e); }
  }

  /** Dal DO del lotto, a fine partita: l'eroe idx è fuori da adesso; risponde col log per rigiocarla. 404 se non c'è più. */
  private async logPer(req: Request): Promise<Response> {
    let b: { run?: unknown; idx?: unknown };
    try { b = await req.json(); } catch { return json({ error: 'Richiesta non valida' }, 400); }
    const run = typeof b.run === 'string' ? b.run : '', idx = typeof b.idx === 'number' && Number.isInteger(b.idx) ? b.idx : -1;
    const r = this.runs.get(run);
    if (r) {
      const me = r.membri[idx];
      if (!me) return json({ error: 'Eroe sconosciuto' }, 404);
      if (me.conn) { const c = me.conn; me.conn = null; c.run = null; try { c.ws.close(1000, 'fine'); } catch { /* chiusa */ } }
      this.fuori(r, me);
      return json(this.logOf(r));
    }
    const salvato = await this.ctx.storage.get<Salvata>(`run:${run}`);
    if (!salvato || idx < 0 || idx >= salvato.inputs.length) return json({ error: 'Partita insieme non trovata' }, 404);
    return json({ seed: salvato.seed, inputs: salvato.inputs, uscite: salvato.uscite, azioni: salvato.azioni, classi: salvato.classi } satisfies LogTemplari);
  }
}
