// Templari insieme (PROTOCOL.md §9, 10 ott 2026): la sala alla porta della chiesa e le partite in tempo reale. Un'istanza sola
// (idFromName('templari')), socket normali come Spedizioni (finché c'è qualcuno in sala o in partita il DO resta sveglio).
// Sala: chi preme GIOCA INSIEME apre `/ws/templari` ed entra (al massimo TI_MAX); SI PARTE (chiunque, con almeno 2) → seed, e per ogni membro
// il DO del suo lotto apre la partita insieme (`templari_party_start`) → `parte` a tutti. Partita: quando tutti hanno caricato (o dopo
// CARICO_MAX_MS) parte l'orologio; ogni SQ_TURNO_MS un turno con l'ultimo input di ciascuno (chi è uscito = fermo) mandato a tutti e scritto
// nel log; chi chiude o esce va in `via` nel turno dopo (la sim lo toglie: ritira). Il DO del lotto chiede il log a fine partita (POST /log
// {run, idx}: quell'eroe è fuori da adesso) e lo rigioca con replayTemplariInsieme. Log salvati nello storage (anche durante la partita,
// ogni SALVA_MS) e tenuti un giorno. Il server non simula niente: la partita finisce quando escono tutti (o al tetto dei 60 minuti).
import { DurableObject } from 'cloudflare:workers';
import { encodeDungeon } from '@marea/sim/dungeon/replay.ts';
import type { PackedDungeon } from '@marea/sim/dungeon/types.ts';
import { MAX_TICKS } from '@marea/sim/templari/templari.ts';
import { parseTAzioniInsieme } from '@marea/sim/templari/replay.ts';
import type { TAzioniInsieme } from '@marea/sim/templari/replay.ts';
import type { TAzione } from '@marea/sim/templari/types.ts';
import type { Look } from '@marea/protocol';
import { SQ_TICKS, SQ_TURNO_MS, TI_MAX, parseTiClient } from '@marea/protocol/templari_insieme.ts';
import type { SqInput, TiMembro, TiServerMsg } from '@marea/protocol/templari_insieme.ts';
import type { Env } from '../env.ts';
import type { LogTemplari } from './lot_templari.ts';

const CARICO_MAX_MS = 20_000;
const SALVA_MS = 10_000;
const TIENI_MS = 24 * 3600_000;
/** Input in coda oltre questi: si scartano i più vecchi tenendone i bottoni. */
const MAX_CODA = 4;
const MAX_MSG_PER_S = 40;
/** Acquisti in coda per eroe (nel turno dopo); oltre si scartano. */
const MAX_AZ = 4;

type Conn = { ws: WebSocket; id: string; nome: string; look: Look; run: Run | null; s: number; n: number };
type Membro = { m: TiMembro; conn: Conn | null; last: SqInput; coda: SqInput[]; az: TAzione[]; fuori: boolean; uscita: number | null; annuncia: boolean; carico: boolean; log: PackedDungeon };
type Run = { id: string; seed: number; membri: Membro[]; turno: number; creato: number; t0: number; fine: number; salvato: number; azioni: TAzioniInsieme };

const json = (v: unknown, status = 200): Response => new Response(JSON.stringify(v), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });

export class TemplariInsieme extends DurableObject<Env> {
  private sala: Conn[] = [];
  private runs = new Map<string, Run>();
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
    // la stessa persona in un'altra scheda: quella vecchia esce
    for (const o of [...this.sala]) if (o.id === id) { this.via(o); try { o.ws.close(1000, 'altra scheda'); } catch { /* chiusa */ } }
    if (this.sala.length >= TI_MAX) { this.send(server, { t: 'errore', msg: `La sala è piena (${TI_MAX})` }); server.close(1013, 'piena'); return fatto; }
    const c: Conn = { ws: server, id, nome, look, run: null, s: 0, n: 0 };
    server.addEventListener('message', (ev) => this.onMessage(c, ev.data));
    server.addEventListener('close', () => this.via(c));
    server.addEventListener('error', () => this.via(c));
    this.sala.push(c);
    this.annuncia();
    return fatto;
  }

  private send(ws: WebSocket, m: TiServerMsg): void { try { ws.send(JSON.stringify(m)); } catch { /* chiusa */ } }
  private membro(c: Conn): TiMembro { return { id: c.id, nome: c.nome, look: c.look }; }
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
    if (m.t === 'esco') { this.via(c); try { c.ws.close(1000, 'ciao'); } catch { /* chiusa */ } return; }
    if (m.t === 'via') { void this.parti(c); return; }
    const r = c.run, me = r?.membri.find((x) => x.conn === c);
    if (!r || !me || me.fuori) return;
    if (m.t === 'carico') { me.carico = true; this.forsePronti(r); return; }
    if (m.t === 'in') { me.coda.push(m.f); while (me.coda.length > MAX_CODA) { const old = me.coda.shift()!, h = me.coda[0]!; h[2] |= old[2]; } }
    if (m.t === 'az') { const ok = parseTAzioniInsieme([[0, 0, m.a]], 1); if (ok?.[0] && me.az.length < MAX_AZ) me.az.push(ok[0][2]); }
  }

  /** La connessione se ne va: dalla sala, o dalla partita (esce nel turno dopo). */
  private via(c: Conn): void {
    const k = this.sala.indexOf(c);
    if (k >= 0) { this.sala.splice(k, 1); this.annuncia(); }
    const r = c.run, me = r?.membri.find((x) => x.conn === c);
    if (r && me) { me.conn = null; this.fuori(r, me); }
  }
  private fuori(r: Run, me: Membro): void {
    if (me.fuori) return;
    me.fuori = true; me.coda = []; me.az = []; me.annuncia = true;
    if (r.membri.every((x) => x.fuori)) this.chiudi(r);
    else this.forsePronti(r);
  }

  /** SI PARTE: tutta la sala entra in chiesa. Ogni lotto apre la sua partita insieme col seed comune. */
  private async parti(c: Conn): Promise<void> {
    if (!this.sala.includes(c)) return;
    if (this.sala.length < 2) { this.send(c.ws, { t: 'errore', msg: 'Serve almeno un compagno: deve premere GIOCA INSIEME anche lui' }); return; }
    const chi = [...this.sala];
    this.sala = [];
    const runId = crypto.randomUUID(), seed = crypto.getRandomValues(new Uint32Array(1))[0]! >>> 1, now = Date.now();
    const r: Run = { id: runId, seed, membri: [], turno: 0, creato: now, t0: 0, fine: 0, salvato: 0, azioni: [] };
    try {
      for (let i = 0; i < chi.length; i++) {
        const x = chi[i]!;
        const res = await this.env.LOT.get(this.env.LOT.idFromName(x.id)).fetch(new Request('https://do/templari_party_start', {
          method: 'POST', headers: { 'x-persona': x.id, 'x-now': String(Date.now()), 'content-type': 'application/json' },
          body: JSON.stringify({ seed, run: runId, idx: i }),
        }));
        if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? 'Partita non aperta');
        r.membri.push({ m: this.membro(x), conn: x, last: [0, 0, 0], coda: [], az: [], fuori: false, uscita: null, annuncia: false, carico: false, log: [] });
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
    void this.ctx.storage.setAlarm(Date.now() + CARICO_MAX_MS);
    this.forsePronti(r);
  }

  /** Sveglia: le partite che aspettano ancora qualcuno da più di CARICO_MAX_MS partono lo stesso. */
  async alarm(): Promise<void> {
    const now = Date.now();
    for (const r of this.runs.values()) if (!r.t0 && !r.fine && now - r.creato >= CARICO_MAX_MS - 100) this.inizia(r);
    const presto = [...this.runs.values()].filter((r) => !r.t0 && !r.fine).map((r) => r.creato + CARICO_MAX_MS);
    if (presto.length) await this.ctx.storage.setAlarm(Math.min(...presto));
  }

  private forsePronti(r: Run): void { if (!r.t0 && r.membri.every((m) => m.carico || m.fuori)) this.inizia(r); }
  private inizia(r: Run): void {
    if (r.t0 || r.fine) return;
    r.t0 = Date.now();
    if (!this.timer) this.timer = setInterval(() => this.batti(), SQ_TURNO_MS);
  }
  /** Ogni SQ_TURNO_MS: i turni dovuti (a tempo di orologio: un timer in ritardo recupera) e i salvataggi. */
  private batti(): void {
    const now = Date.now();
    for (const r of [...this.runs.values()]) {
      if (r.fine || !r.t0) continue;
      const dovuti = Math.floor((now - r.t0) / SQ_TURNO_MS) + 1;
      for (let k = 0; k < 10 && r.turno < dovuti && !r.fine; k++) this.turno(r);
      if (!r.fine && now - r.salvato > SALVA_MS) { r.salvato = now; void this.persisti(r); }
    }
    if (![...this.runs.values()].some((r) => r.t0 && !r.fine) && this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  private turno(r: Run): void {
    const tick = r.turno * SQ_TICKS, f: SqInput[] = [], via: number[] = [], az: [number, TAzione][] = [];
    r.membri.forEach((m, i) => {
      if (m.annuncia) { m.annuncia = false; m.uscita = tick; via.push(i); }
      for (const a of m.az) { az.push([i, a]); r.azioni.push([tick, i, a]); }
      m.az = [];
      const x: SqInput = m.fuori ? [0, 0, 0] : m.coda.shift() ?? m.last;
      m.last = x; f.push(x);
      const ult = m.log[m.log.length - 1], mira = x[3] ?? 0;
      if (ult && ult[1] === x[0] && ult[2] === x[1] && ult[3] === x[2] && (ult[4] ?? 0) === mira) ult[0] += SQ_TICKS;
      else m.log.push(mira ? [SQ_TICKS, x[0], x[1], x[2], mira] : [SQ_TICKS, x[0], x[1], x[2]]);
    });
    const msg = JSON.stringify({ t: 'T', n: r.turno, f, ...(via.length ? { via } : {}), ...(az.length ? { az } : {}) } satisfies TiServerMsg);
    for (const m of r.membri) if (m.conn && !m.fuori) { try { m.conn.ws.send(msg); } catch { /* chiusa */ } }
    r.turno++;
    if (r.turno * SQ_TICKS >= MAX_TICKS) { for (const m of r.membri) if (m.conn) { try { m.conn.ws.close(1000, 'alba'); } catch { /* chiusa */ } } this.chiudi(r); }
  }

  private chiudi(r: Run): void {
    if (r.fine) return;
    r.fine = Date.now();
    void this.persisti(r);
    console.log(`[marea] templari insieme finiti: ${r.turno} turni, run ${r.id}`);
  }

  /** Il log fin qui; chi è appena uscito (non ancora in un turno) esce al tick del prossimo turno. */
  private logOf(r: Run): LogTemplari {
    const tick = r.turno * SQ_TICKS;
    return { seed: r.seed, inputs: r.membri.map((m) => encodeDungeon(m.log)), uscite: r.membri.map((m) => m.uscita ?? (m.annuncia ? tick : null)), azioni: r.azioni };
  }
  private async persisti(r: Run): Promise<void> {
    try {
      await this.ctx.storage.put(`run:${r.id}`, { ...this.logOf(r), quando: Date.now() });
      if (!r.salvato || r.fine) {
        const vecchi = await this.ctx.storage.list<{ quando?: number }>({ prefix: 'run:' });
        const via = [...vecchi].filter(([, v]) => !v?.quando || Date.now() - v.quando > TIENI_MS).map(([k]) => k);
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
    const salvato = await this.ctx.storage.get<LogTemplari & { quando: number }>(`run:${run}`);
    if (!salvato || idx < 0 || idx >= salvato.inputs.length) return json({ error: 'Partita insieme non trovata' }, 404);
    return json(salvato);
  }
}
