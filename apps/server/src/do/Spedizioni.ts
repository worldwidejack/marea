// Dungeon insieme (#118, PROTOCOL.md §7): squadre all'ingresso dei dungeon e spedizioni in tempo reale. Un'istanza sola
// (idFromName('spedizioni')), socket normali (niente ibernazione: finché c'è una squadra o una spedizione il DO resta sveglio).
// Squadra: chi preme AFFRONTA INSIEME apre `/ws/squadra/<dungeon>` ed entra nella squadra di quel dungeon (al massimo RPG.dungeon.gruppo.max);
// VIA (chiunque, con almeno 2) → seed, e per ogni membro il DO del suo lotto apre la spedizione (`dungeon_party_start`: fotografia
// dell'eroe e pending.party) → `parte` a tutti. Spedizione: quando tutti hanno caricato (o dopo CARICO_MAX_MS) parte l'orologio; ogni
// SQ_TURNO_MS un turno con l'ultimo input di ciascuno (chi è andato via = fermo) e le azioni arrivate, mandato a tutti e scritto nel log
// (un PackedDungeon e una lista di azioni per eroe). Chi chiude o esce: azione `ritira` nel turno dopo. Il DO del lotto chiede il log a fine
// spedizione (POST /log {run, idx}: quell'eroe è fuori da adesso) e lo rigioca con replayParty. Log salvati nello storage (anche durante la
// spedizione, ogni SALVA_MS) e tenuti un giorno: se il DO si riavvia a metà, i lotti chiudono la spedizione fin dove era arrivata.
import { DurableObject } from 'cloudflare:workers';
import { DUNGEONS, RPG } from '@marea/content/rpg.ts';
import { dungeon as sim } from '@marea/sim/dungeon/dungeon.ts';
import { encodeDungeon, parseDungeonAzione } from '@marea/sim/dungeon/replay.ts';
import type { DungeonAzione, DungeonAzioni, PackedDungeon } from '@marea/sim/dungeon/types.ts';
import type { HeroState, RunHero } from '@marea/sim/rpg/types.ts';
import type { Look } from '@marea/protocol';
import { SQ_TICKS, SQ_TURNO_MS, parseSqClient } from '@marea/protocol/squadra.ts';
import type { SqInput, SqServerMsg } from '@marea/protocol/squadra.ts';
import type { Env } from '../env.ts';

const MAX_SQUADRA = RPG.dungeon?.gruppo?.max ?? 4;
const CARICO_MAX_MS = 20_000;
const SALVA_MS = 10_000;
const TIENI_MS = 24 * 3600_000;
/** Azioni dal menu per eroe (parseDungeonAzioni ne accetta 400: qualcuna resta per `ritira`). */
const MAX_AZIONI = 390;
/** Input in coda oltre questi (il client corre più del turno, o arriva a raffiche): si scartano i più vecchi tenendone i bottoni. */
const MAX_CODA = 4;
const MAX_MSG_PER_S = 40;

type Conn = { ws: WebSocket; id: string; nome: string; look: Look; dungeon: string; run: Run | null; s: number; n: number };
type Membro = {
  id: string; nome: string; look: Look; conn: Conn | null; hero: RunHero; stato: HeroState | null;
  last: SqInput; coda: SqInput[]; az: DungeonAzione[]; fuori: boolean; carico: boolean;
  log: PackedDungeon; azioni: DungeonAzioni;
};
type Run = {
  id: string; dungeon: string; seed: number; membri: Membro[]; turno: number; creato: number; t0: number; fine: number; salvato: number;
};
/** Quello che il DO del lotto riceve (e lo storage tiene). */
export type LogSquadra = { dungeon: string; seed: number; eroi: { hero: RunHero; stato: HeroState | null }[]; inputs: string[]; azioni: DungeonAzioni[] };

const json = (v: unknown, status = 200): Response => new Response(JSON.stringify(v), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });

export class Spedizioni extends DurableObject<Env> {
  private squadre = new Map<string, Conn[]>();
  private runs = new Map<string, Run>();
  private timer: ReturnType<typeof setInterval> | null = null;

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === 'POST' && url.pathname === '/log') return this.logPer(req);
    if (req.headers.get('upgrade') !== 'websocket') return new Response('WebSocket atteso', { status: 426 });
    const id = url.searchParams.get('id') ?? '', nome = url.searchParams.get('nome') ?? 'Ospite', dungeon = url.searchParams.get('dungeon') ?? '';
    let look: Look = { pelle: 2, capelli: 0, coloreCapelli: 0, vestito: 0, cappello: 1 };
    try { const l = JSON.parse(url.searchParams.get('look') ?? '{}') as Look; if (l && typeof l === 'object') look = { ...look, ...l }; } catch { /* look di default */ }
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    server.accept();
    if (!id || !DUNGEONS.some((d) => d.id === dungeon)) { this.send(server, { t: 'errore', msg: 'Dungeon sconosciuto' }); server.close(1008, 'dungeon'); return new Response(null, { status: 101, webSocket: client }); }
    const c: Conn = { ws: server, id, nome, look, dungeon, run: null, s: 0, n: 0 };
    server.addEventListener('message', (ev) => this.onMessage(c, ev.data));
    server.addEventListener('close', () => this.via(c));
    server.addEventListener('error', () => this.via(c));
    // la stessa persona in un'altra scheda: quella vecchia esce
    for (const [, sq] of this.squadre) for (const o of [...sq]) if (o.id === id) { this.via(o); try { o.ws.close(1000, 'altra scheda'); } catch { /* chiusa */ } }
    const sq = this.squadre.get(dungeon) ?? [];
    if (sq.length >= MAX_SQUADRA) { this.send(server, { t: 'errore', msg: `La squadra è piena (${MAX_SQUADRA})` }); server.close(1013, 'piena'); return new Response(null, { status: 101, webSocket: client }); }
    sq.push(c); this.squadre.set(dungeon, sq);
    this.annuncia(dungeon);
    return new Response(null, { status: 101, webSocket: client });
  }

  private send(ws: WebSocket, m: SqServerMsg): void { try { ws.send(JSON.stringify(m)); } catch { /* chiusa */ } }
  private annuncia(dungeon: string): void {
    const sq = this.squadre.get(dungeon) ?? [];
    const m: SqServerMsg = { t: 'squadra', dungeon, membri: sq.map((c) => ({ id: c.id, nome: c.nome })), max: MAX_SQUADRA };
    for (const c of sq) this.send(c.ws, m);
  }

  private onMessage(c: Conn, data: unknown): void {
    if (typeof data !== 'string') return;
    const sec = Math.floor(Date.now() / 1000);
    if (sec !== c.s) { c.s = sec; c.n = 0; }
    if (++c.n > MAX_MSG_PER_S) return;
    const m = parseSqClient(data);
    if (!m) return;
    if (m.t === 'esco') { this.via(c); try { c.ws.close(1000, 'ciao'); } catch { /* chiusa */ } return; }
    if (m.t === 'via') { void this.parti(c); return; }
    const r = c.run, me = r?.membri.find((x) => x.conn === c);
    if (!r || !me || me.fuori) return;
    if (m.t === 'carico') { me.carico = true; this.forsePronti(r); return; }
    if (m.t === 'in') { me.coda.push(m.f); while (me.coda.length > MAX_CODA) { const old = me.coda.shift()!, h = me.coda[0]!; h[2] |= old[2]; if (old[3] && !h[3]) h[3] = old[3]; } return; }
    if (m.t === 'az') {
      const a = parseDungeonAzione(m.a);
      if (a && a.t !== 'ritira' && me.azioni.length + me.az.length < MAX_AZIONI) me.az.push(a);
    }
  }

  /** La connessione se ne va: dalla squadra, o dalla spedizione (ritira). */
  private via(c: Conn): void {
    const sq = this.squadre.get(c.dungeon);
    if (sq?.includes(c)) { sq.splice(sq.indexOf(c), 1); if (!sq.length) this.squadre.delete(c.dungeon); else this.annuncia(c.dungeon); }
    const r = c.run, me = r?.membri.find((x) => x.conn === c);
    if (r && me) { me.conn = null; this.fuori(r, me); }
  }
  private fuori(r: Run, me: Membro): void {
    if (me.fuori) return;
    me.fuori = true; me.coda = []; me.az.push({ t: 'ritira' });
    if (r.membri.every((x) => x.fuori)) this.chiudi(r);
    else this.forsePronti(r);
  }

  /** VIA: la squadra di quel dungeon scende. Ogni lotto apre la sua spedizione col seed comune. */
  private async parti(c: Conn): Promise<void> {
    const sq = this.squadre.get(c.dungeon);
    if (!sq?.includes(c)) return;
    if (sq.length < 2) { this.send(c.ws, { t: 'errore', msg: 'Serve almeno un compagno: deve premere AFFRONTA INSIEME anche lui' }); return; }
    const chi = [...sq];
    this.squadre.delete(c.dungeon);
    const runId = crypto.randomUUID(), seed = crypto.getRandomValues(new Uint32Array(1))[0]! >>> 1, now = Date.now();
    const r: Run = { id: runId, dungeon: c.dungeon, seed, membri: [], turno: 0, creato: now, t0: 0, fine: 0, salvato: 0 };
    try {
      for (let i = 0; i < chi.length; i++) {
        const x = chi[i]!;
        const res = await this.env.LOT.get(this.env.LOT.idFromName(x.id)).fetch(new Request('https://do/dungeon_party_start', {
          method: 'POST', headers: { 'x-persona': x.id, 'x-now': String(Date.now()), 'content-type': 'application/json' },
          body: JSON.stringify({ dungeon: c.dungeon, seed, run: runId, idx: i }),
        }));
        const b = (await res.json()) as { hero?: RunHero; stato?: HeroState | null; error?: string };
        if (!res.ok || !b.hero) throw new Error(b.error ?? 'Spedizione non aperta');
        r.membri.push({ id: x.id, nome: x.nome, look: x.look, conn: x, hero: b.hero, stato: b.stato ?? null, last: [0, 0, 0], coda: [], az: [], fuori: false, carico: false, log: [], azioni: [] });
      }
    } catch (e) {
      console.warn('[marea] squadra non partita', e);
      for (const x of chi) this.send(x.ws, { t: 'errore', msg: 'Non si parte: riprova tra poco' });
      // la squadra torna com'era (chi è ancora connesso)
      const vivi = chi.filter((x) => x.ws.readyState === 1);
      if (vivi.length) { this.squadre.set(c.dungeon, [...(this.squadre.get(c.dungeon) ?? []), ...vivi]); this.annuncia(c.dungeon); }
      return;
    }
    for (const [k, v] of this.runs) if (v.fine && now - v.fine > 10 * 60_000) this.runs.delete(k);
    this.runs.set(runId, r);
    const eroi =r.membri.map((m) => ({ id: m.id, nome: m.nome, look: m.look, hero: m.hero, stato: m.stato }));
    r.membri.forEach((m, i) => {
      if (m.conn) { m.conn.run = r; if (m.conn.ws.readyState === 1) { this.send(m.conn.ws, { t: 'parte', run: runId, dungeon: r.dungeon, seed, io: i, eroi }); return; } }
      m.conn = null; this.fuori(r, m); // chiuso mentre si apriva la spedizione
    });
    console.log(`[marea] squadra giù: ${r.dungeon}, ${r.membri.length} eroi, run ${runId}`);
    // si aspetta che tutti abbiano caricato il dungeon, ma non più di CARICO_MAX_MS (sveglia del DO, non un timer: vedi inizia)
    void this.ctx.storage.setAlarm(Date.now() + CARICO_MAX_MS);
    this.forsePronti(r);
  }

  /** Sveglia: le spedizioni che aspettano ancora qualcuno da più di CARICO_MAX_MS partono lo stesso. */
  async alarm(): Promise<void> {
    const now = Date.now();
    for (const r of this.runs.values()) if (!r.t0 && !r.fine && now - r.creato >= CARICO_MAX_MS - 100) this.inizia(r);
    const presto = [...this.runs.values()].filter((r) => !r.t0 && !r.fine).map((r) => r.creato + CARICO_MAX_MS);
    if (presto.length) await this.ctx.storage.setAlarm(Math.min(...presto));
  }

  /** Tutti hanno caricato (o se ne sono andati): si parte. */
  private forsePronti(r: Run): void { if (!r.t0 && r.membri.every((m) => m.carico || m.fuori)) this.inizia(r); }
  /** Parte l'orologio dei turni di questa spedizione (un timer solo per tutte, acceso solo mentre ce n'è una in corso: un timer JS in
   *  attesa senza niente da mandare rallentava wrangler dev in locale, per questo l'attesa del caricamento usa la sveglia del DO). */
  private inizia(r: Run): void {
    if (r.t0 || r.fine) return;
    r.t0 = Date.now();
    if (!this.timer) this.timer = setInterval(() => this.batti(), SQ_TURNO_MS);
  }
  /** Ogni SQ_TURNO_MS: i turni dovuti (a tempo di orologio, non di timer: un timer in ritardo recupera) e i salvataggi. */
  private batti(): void {
    const now = Date.now();
    for (const r of [...this.runs.values()]) {
      if (r.fine || !r.t0) continue;
      const dovuti = Math.floor((now - r.t0) / SQ_TURNO_MS) + 1;
      for (let k = 0; k < 10 && r.turno < dovuti && !r.fine; k++) this.turno(r);
      if (!r.fine && now - r.salvato > SALVA_MS) { r.salvato = now; void this.persisti(r); }
    }
    // nessuna spedizione in corso: l'orologio si ferma (quelle finite restano in memoria per i log, e comunque nello storage)
    if (![...this.runs.values()].some((r) => r.t0 && !r.fine) && this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  private turno(r: Run): void {
    const tick = r.turno * SQ_TICKS;
    const f: SqInput[] = [], az: [number, DungeonAzione][] = [];
    r.membri.forEach((m, i) => {
      const x: SqInput = m.fuori ? [0, 0, 0] : m.coda.shift() ?? m.last;
      m.last = x; f.push(x);
      for (const a of m.az) { az.push([i, a]); m.azioni.push([tick, a]); }
      m.az = [];
      const ult = m.log[m.log.length - 1], mira = x[3] ?? 0;
      if (ult && ult[1] === x[0] && ult[2] === x[1] && ult[3] === x[2] && (ult[4] ?? 0) === mira) ult[0] += SQ_TICKS;
      else m.log.push(mira ? [SQ_TICKS, x[0], x[1], x[2], mira] : [SQ_TICKS, x[0], x[1], x[2]]);
    });
    const msg = JSON.stringify({ t: 'T', n: r.turno, f, ...(az.length ? { az } : {}) } satisfies SqServerMsg);
    for (const m of r.membri) if (m.conn && !m.fuori) { try { m.conn.ws.send(msg); } catch { /* chiusa */ } }
    r.turno++;
    if ((r.turno * SQ_TICKS) >= sim.maxTicks) { for (const m of r.membri) if (m.conn) { try { m.conn.ws.close(1000, 'tempo'); } catch { /* chiusa */ } } this.chiudi(r); }
  }

  private chiudi(r: Run): void {
    if (r.fine) return;
    r.fine = Date.now();
    void this.persisti(r);
    console.log(`[marea] spedizione insieme finita: ${r.dungeon}, ${r.turno} turni`);
  }

  /** Il log fin qui; con `subito` le azioni in attesa (il `ritira` di chi è appena uscito) al tick del prossimo turno. */
  private logOf(r: Run): LogSquadra {
    const tick = r.turno * SQ_TICKS;
    return {
      dungeon: r.dungeon, seed: r.seed, eroi: r.membri.map((m) => ({ hero: m.hero, stato: m.stato })),
      inputs: r.membri.map((m) => encodeDungeon(m.log)),
      azioni: r.membri.map((m) => [...m.azioni, ...m.az.map((a): [number, DungeonAzione] => [tick, a])]),
    };
  }
  private async persisti(r: Run): Promise<void> {
    try {
      await this.ctx.storage.put(`run:${r.id}`, { ...this.logOf(r), quando: Date.now() });
      // pulizia: via i log più vecchi di un giorno
      if (!r.salvato || r.fine) {
        const vecchi = await this.ctx.storage.list<{ quando?: number }>({ prefix: 'run:' });
        const via = [...vecchi].filter(([, v]) => !v?.quando || Date.now() - v.quando > TIENI_MS).map(([k]) => k);
        if (via.length) await this.ctx.storage.delete(via.slice(0, 128));
      }
    } catch (e) { console.warn('[marea] log della squadra non salvato', e); }
  }

  /** Dal DO del lotto, a fine spedizione: l'eroe idx è fuori da adesso; risponde col log per rigiocarla. 404 se non c'è più. */
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
    // finita da un pezzo, o il DO si è riavviato a metà: il log salvato (chi non era uscito finisce dove era arrivato, senza esito)
    const salvato = await this.ctx.storage.get<LogSquadra & { quando: number }>(`run:${run}`);
    if (!salvato || !salvato.eroi[idx]) return json({ error: 'Spedizione insieme non trovata' }, 404);
    return json(salvato);
  }
}
