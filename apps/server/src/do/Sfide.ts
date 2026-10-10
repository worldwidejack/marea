// Coordinatore unico delle sfide con posta (una sola istanza: idFromName('tavolo')). Le poste stanno nell'escrow dei due lotti, che vivono
// in due DO Lot diversi: non esiste una transazione tra i due. Quindi:
//  - ogni operazione su un lotto è idempotente per id sfida (holdStake/releaseStake in @marea/sim) e da sola tiene l'invariante di quel lotto;
//  - qui si scrive PRIMA cosa va fatto (fase/pending nella riga della sfida), POI si chiamano i lotti, e si ripete finché non va a buon fine
//    (a ogni richiesta e con un alarm): un crash a metà non perde né raddoppia niente;
//  - tutte le operazioni passano da un mutex in memoria: una alla volta (sono poche, tra amici).
// Richieste dal Worker (x-persona, x-now): GET /list · POST /create {minigame, to, stake} · /play {id, inputs} · /accept {id} · /decline {id}
// · GET /feed · POST /feed_letto {fino?} · POST /visita {chi, emote} (#86, riga «è passato sulla tua isola»). Feed: una riga per persona a ogni passaggio di stato, scritta nella stessa transazione del `put`.
// Porto tra amici (#110 #111, portoStore.ts): GET /record (tabellone) · POST /record {minigame, score, medal, detail} (dal Worker dopo il replay
// di una partita da solo nel DO del lotto: mai dal client) · GET /faro · POST /faro_versa {legno, pietra, tutti} (versamento al Faro comune:
// intento, poi il lotto paga, poi il faro conta; se sale di livello, riga di feed a tutti e i livelli a ogni lotto).
import { DurableObject } from 'cloudflare:workers';
import { acceptChallenge, actionError, closeOutcome, isActive, isExpired, newChallenge, playTurn, refundsFor } from '@marea/sim/economy/challenge.ts';
import type { HoldKind, Release } from '@marea/sim/economy/challenge.ts';
import { perleFor } from '@marea/sim/economy/rewards.ts';
import { EconomyError } from '@marea/sim/economy/types.ts';
import type { Challenge, LotState, Resources } from '@marea/sim/economy/types.ts';
import { getMinigame } from '@marea/sim/minigames/registry.ts';
import { isPackedInputs, replay } from '@marea/sim/replay.ts';
import type { FeedTipo } from '@marea/protocol';
import { nowFromHeader } from '../clock.ts';
import type { FeedDati } from '../feed.ts';
import { creaTabellaFeed, leggiFeed, nonLetti, scriviFeed, segnaLetti } from './feedStore.ts';
import { apriDono, chiudiDono, creaTabellePorto, doniAperti, leggiFaro, leggiTabellone, scriviFaro, scriviTabellone } from './portoStore.ts';
import type { DonoAperto } from './portoStore.ts';
import { dosaDono, faroProssimo, versaNelFaro } from '@marea/sim/economy/faro.ts';
import type { FaroStato } from '@marea/sim/economy/faro.ts';
import { recordDi, segnaRecord } from '@marea/sim/economy/record.ts';
import { MINIGAMES } from '@marea/sim/minigames/registry.ts';
import '@marea/sim/corse/registra.ts'; // Corse: il server rigioca sul motore v2 (#173)
import type { Env } from '../env.ts';

const json = (dati: unknown, status = 200): Response =>
  new Response(JSON.stringify(dati), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const DAY = 86_400_000;
const RECENTI_MS = 7 * DAY;
const RIPROVA_MS = 60_000;

type Pending = { owner: string; release: Release };
/** fase: operazione su un lotto iniziata e non ancora confermata ('nuova' = posta dello sfidante, 'accettando' = posta di chi risponde). */
type Row = { id: string; c: Challenge; fase: 'nuova' | 'accettando' | null; pending: Pending[] };
type LotError = { error: string; manca?: Resources; code?: string };
type LotReply = { ok: true; lot: LotState } | { ok: false; status: number; body: LotError };

export class Sfide extends DurableObject<Env> {
  private chain: Promise<unknown> = Promise.resolve();
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS sfide (
      id TEXT PRIMARY KEY, da TEXT NOT NULL, a TEXT NOT NULL, stato TEXT NOT NULL, creata INTEGER NOT NULL, scade INTEGER NOT NULL,
      fase TEXT, pending TEXT NOT NULL DEFAULT '[]', json TEXT NOT NULL)`);
    ctx.storage.sql.exec('CREATE INDEX IF NOT EXISTS sfide_da ON sfide (da, creata)');
    ctx.storage.sql.exec('CREATE INDEX IF NOT EXISTS sfide_a ON sfide (a, creata)');
    creaTabellaFeed(ctx.storage.sql);
    creaTabellePorto(ctx.storage.sql);
  }

  /** Una operazione alla volta, anche mentre si aspettano i DO Lot (l'input gate non basta: le fetch in uscita lo aprono). */
  private locked<T>(fn: () => Promise<T>): Promise<T> {
    const p = this.chain.then(fn, fn);
    this.chain = p.catch(() => undefined);
    return p;
  }

  // ---------- storage ----------
  private get(id: string): Row | null {
    const r = this.ctx.storage.sql.exec<{ json: string; fase: string | null; pending: string }>('SELECT json, fase, pending FROM sfide WHERE id = ?', id).toArray()[0];
    return r ? { id, c: JSON.parse(r.json) as Challenge, fase: r.fase as Row['fase'], pending: JSON.parse(r.pending) as Pending[] } : null;
  }
  private put(r: Row): void {
    this.ctx.storage.sql.exec('INSERT OR REPLACE INTO sfide (id, da, a, stato, creata, scade, fase, pending, json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      r.id, r.c.from, r.c.to, r.c.state, r.c.createdMs, r.c.expiresMs, r.fase, JSON.stringify(r.pending), JSON.stringify(r.c));
  }
  /** Registra la sfida e le sue righe di feed in una sola transazione (nessun `await` in mezzo). */
  private commit(r: Row, feed?: () => void): void {
    this.ctx.storage.transactionSync(() => { this.put(r); feed?.(); });
  }
  /** Riga di feed per `persona` su questa sfida (`altro` = l'altra persona); `letto` = è lei che ha fatto l'azione. */
  private note(persona: string, tipo: FeedTipo, r: Row, dati: FeedDati, letto: boolean, now: number): void {
    scriviFeed(this.ctx.storage.sql, { persona, tipo, sfida: r.id, altro: persona === r.c.from ? r.c.to : r.c.from, dati, letto, quando: now });
  }
  private base(r: Row): FeedDati { return { stake: r.c.stake, minigame: r.c.minigame }; }
  /** Sfida chiusa: una riga a testa con posta, piatto, medaglia, esito e Perle (netto = pot − stake a chi vince, −stake a chi perde). */
  private noteChiusa(r: Row, me: string, now: number): void {
    for (const side of ['from', 'to'] as const) {
      const persona = r.c[side];
      const esito = r.c.winner === 'pari' ? 'parita' : r.c.winner === side ? 'vittoria' : 'sconfitta';
      const medal = side === 'from' ? r.c.medalFrom : r.c.medalTo;
      this.note(persona, 'sfida_chiusa', r, { ...this.base(r), pot: r.c.pot, medal, esito, perle: perleFor({ medal, esito }) }, persona === me, now);
    }
  }
  private del(id: string): void { this.ctx.storage.sql.exec('DELETE FROM sfide WHERE id = ?', id); }
  /** Righe con lavoro in sospeso o ancora in gioco. */
  private open(): Row[] {
    return this.ctx.storage.sql.exec<{ id: string }>(`SELECT id FROM sfide WHERE fase IS NOT NULL OR pending != '[]' OR stato IN ('gioca_sfidante','aperta','accettata')`)
      .toArray().map((x) => this.get(x.id)).filter((x): x is Row => !!x);
  }

  // ---------- chiamate ai lotti ----------
  private async lot(owner: string, path: string, now: number, body?: unknown): Promise<LotReply> {
    const stub = this.env.LOT.get(this.env.LOT.idFromName(owner));
    const r = await stub.fetch(new Request('https://lot/' + path, {
      method: body === undefined ? 'GET' : 'POST', body: body === undefined ? undefined : JSON.stringify(body),
      headers: { 'x-persona': owner, 'x-now': String(now), 'content-type': 'application/json' },
    }));
    if (r.ok) return { ok: true, lot: (await r.json()) as LotState };
    if (r.status >= 500) throw new Error(`lot ${owner} ${path}: ${r.status}`);
    return { ok: false, status: r.status, body: (await r.json()) as LotError };
  }
  private hold(owner: string, cid: string, stake: Resources, kind: HoldKind, now: number): Promise<LotReply> {
    return this.lot(owner, 'hold', now, { cid, stake, kind });
  }
  /** Esegue i rimborsi/pagamenti in sospeso; quelli riusciti escono dalla lista. true = tutto fatto. */
  private async drive(r: Row, now: number): Promise<boolean> {
    while (r.pending.length) {
      const p = r.pending[0]!;
      try {
        const res = await this.lot(p.owner, 'release', now, { cid: r.id, release: p.release });
        if (!res.ok) console.error('[marea] release rifiutato', r.id, p.owner, res.status, res.body.error); // non deve succedere: lo si toglie per non ripeterlo all'infinito
      } catch (e) {
        console.error('[marea] release da riprovare', r.id, p.owner, e);
        return false;
      }
      r.pending.shift();
      this.put(r);
    }
    return true;
  }

  /** Rimette in pari le operazioni lasciate a metà (crash) e fa scadere le sfide vecchie. Gira a ogni richiesta e nell'alarm. */
  private async sweep(now: number): Promise<void> {
    for (const r of this.open()) {
      try {
        if (r.fase === 'nuova') {
          const h = await this.hold(r.c.from, r.id, r.c.stake, 'apri', now);
          if (!h.ok || !h.lot.holds?.[r.id]) { this.del(r.id); continue; }
          r.fase = null; this.put(r);
        } else if (r.fase === 'accettando') {
          const h = await this.hold(r.c.to, r.id, r.c.stake, 'accetta', now);
          if (h.ok && h.lot.holds?.[r.id]) {
            const a = await this.lot(r.c.from, 'state', now);
            r.c = acceptChallenge(r.c, a.ok ? a.lot : h.lot, h.lot);
          }
          r.fase = null;
          this.commit(r, () => { if (r.c.state === 'accettata') this.note(r.c.from, 'sfida_accettata', r, this.base(r), false, now); });
        }
        if (isExpired(r.c, now)) {
          const prima = r.c.state;
          const out = refundsFor(r.c, 'scaduta', now);
          r.c = out.challenge; r.pending.push(...out.releases);
          // la scadenza non è l'azione di nessuno: righe non lette per tutti
          this.commit(r, () => {
            this.note(r.c.from, 'sfida_scaduta', r, this.base(r), false, now);
            if (prima === 'aperta' || prima === 'accettata') this.note(r.c.to, 'sfida_scaduta', r, this.base(r), false, now);
          });
        }
        await this.drive(r, now);
      } catch (e) { console.error('[marea] sweep', r.id, e); }
    }
    // versamenti al faro lasciati a metà: il lotto è idempotente per id, quindi si richiede e, se ha pagato, il faro conta
    for (const d of doniAperti(this.ctx.storage.sql)) {
      try {
        const r = await this.lot(d.persona, 'faro_dona', now, { id: d.id, dono: d.dono });
        if (r.ok) await this.faroConta(d, now); else chiudiDono(this.ctx.storage.sql, d.id);
      } catch (e) { console.error('[marea] sweep faro', d.id, e); }
    }
    await this.scheduleAlarm(now);
  }
  private async scheduleAlarm(now: number): Promise<void> {
    const rows = this.open(), doni = doniAperti(this.ctx.storage.sql).length;
    if (!rows.length && !doni) { await this.ctx.storage.deleteAlarm(); return; }
    const retry = doni || rows.some((r) => r.pending.length || r.fase) ? Date.now() + RIPROVA_MS : Infinity;
    // l'alarm usa l'ora vera: con l'orologio di test spostato in avanti le scadenze si fanno già nello sweep delle richieste
    const next = Math.min(retry, ...rows.filter((r) => isActive(r.c)).map((r) => Date.now() + Math.max(0, r.c.expiresMs - now)));
    if (Number.isFinite(next)) await this.ctx.storage.setAlarm(next);
  }
  async alarm(): Promise<void> {
    await this.locked(() => this.sweep(Date.now()));
  }

  // ---------- API ----------
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const me = req.headers.get('x-persona') ?? '';
    if (!me) return json({ error: 'Manca la persona' }, 400);
    const now = nowFromHeader(req);
    const act = url.pathname.replace(/^\/+/, '');
    let body: Record<string, unknown> = {};
    if (req.method === 'POST') {
      try { body = (await req.json()) as Record<string, unknown>; } catch { return json({ error: 'Richiesta non valida' }, 400); }
      if (!body || typeof body !== 'object') return json({ error: 'Richiesta non valida' }, 400);
    }
    return this.locked(async () => {
      try {
        await this.sweep(now);
        if (req.method === 'GET' && act === 'list') return json(this.list(me, now));
        const sql = this.ctx.storage.sql;
        // il feed porta anche i momenti delle salite del Faro: il Worker li passa al lotto al rientro (#111)
        if (req.method === 'GET' && act === 'feed') return json({ rows: leggiFeed(sql, me), nonLetti: nonLetti(sql, me), faroLivelli: leggiFaro(sql).livelli });
        if (req.method === 'GET' && act === 'record') return json({ tab: recordDi(leggiTabellone(sql), now) });
        if (req.method === 'GET' && act === 'faro') return json({ faro: leggiFaro(sql) });
        if (req.method === 'POST' && act === 'feed_letto') {
          const fino = body['fino'];
          if (fino !== undefined && (typeof fino !== 'number' || !Number.isFinite(fino))) return json({ error: 'Richiesta non valida' }, 400);
          segnaLetti(sql, me, fino);
          return json({ ok: true, nonLetti: nonLetti(sql, me) });
        }
        if (req.method !== 'POST') return json({ error: 'Metodo non consentito' }, 405);
        if (act === 'visita') { // #86: un amico ha firmato il libro dell'isola di `me` (una riga al giorno per amico)
          const chi = body['chi'], emote = body['emote'], giorno = Math.floor(now / 86_400_000);
          if (typeof chi !== 'string' || !chi || chi.length > 40 || typeof emote !== 'string' || emote.length > 40) return json({ error: 'Richiesta non valida' }, 400);
          scriviFeed(sql, { persona: me, tipo: 'visita', sfida: `visita:${giorno}:${chi}`, altro: chi, dati: { emote }, letto: false, quando: now });
          return json({ ok: true });
        }
        if (act === 'record') return this.record(me, body, now);
        if (act === 'faro_versa') return await this.faroVersa(me, body, now);
        if (act === 'create') return await this.create(me, body, now);
        const row = typeof body['id'] === 'string' ? this.get(body['id']) : null;
        if (!row) return json({ error: 'Sfida non trovata' }, 404);
        if (act === 'play') return await this.play(me, row, body['inputs'], now);
        if (act === 'accept') return await this.accept(me, row, now);
        if (act === 'decline') return await this.decline(me, row, now);
        return json({ error: 'Non trovato' }, 404);
      } catch (e) {
        if (e instanceof EconomyError) return json({ error: e.message }, e.code === 'sconosciuto' || e.code === 'posta' ? 400 : 409);
        console.error('[marea] sfide error', e);
        return json({ error: 'Errore interno, riprova tra poco' }, 500);
      }
    });
  }

  // ---------- Porto tra amici (#110 #111) ----------
  /** Partita da solo verificata dal DO del lotto: se è un record entra nel tabellone; chi perde il record di sempre lo legge nel feed. */
  private record(me: string, body: Record<string, unknown>, now: number): Response {
    const mg = body['minigame'], score = body['score'], medal = body['medal'] ?? null;
    if (typeof mg !== 'string' || !Object.hasOwn(MINIGAMES, mg) || typeof score !== 'number' || !Number.isFinite(score) || !(medal === null || medal === 'oro' || medal === 'argento' || medal === 'bronzo'))
      return json({ error: 'Richiesta non valida' }, 400);
    const sql = this.ctx.storage.sql, tab = leggiTabellone(sql);
    const out = segnaRecord(tab, mg, { chi: me, score, medal, detail: body['detail'] }, now);
    if (out.tab !== tab) {
      this.ctx.storage.transactionSync(() => {
        scriviTabellone(sql, out.tab);
        if (out.superato) scriviFeed(sql, { persona: out.superato, tipo: 'record', sfida: `record:${mg}:${now}:${me}`, altro: me, dati: { minigame: mg }, letto: false, quando: now });
      });
    }
    return json({ oggi: out.oggi, sempre: out.sempre });
  }

  /** Versa al Faro comune: intento → il lotto paga (idempotente per id) → il faro conta. Risponde col faro e col lotto aggiornati. */
  private async faroVersa(me: string, body: Record<string, unknown>, now: number): Promise<Response> {
    const sql = this.ctx.storage.sql, f = leggiFaro(sql);
    if (!faroProssimo(f)) return json({ error: 'Il Faro è già al massimo: grazie a tutti!', code: 'faro' }, 409);
    const dono = dosaDono(f, { legno: body['legno'], pietra: body['pietra'] });
    if (dono.legno + dono.pietra <= 0) return json({ error: 'Niente da versare', code: 'faro' }, 400);
    const tutti = Array.isArray(body['tutti']) ? body['tutti'].filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length <= 40).slice(0, 64) : [];
    const d: DonoAperto = { id: 'faro-' + crypto.randomUUID().slice(0, 13), persona: me, dono, tutti, quando: now };
    apriDono(sql, d); // prima l'intento, poi il lotto: se qui si muore, lo sweep riprende
    const r = await this.lot(me, 'faro_dona', now, { id: d.id, dono });
    if (!r.ok) { chiudiDono(sql, d.id); return json(r.body, r.status); }
    const out = await this.faroConta(d, now);
    await this.scheduleAlarm(now);
    return json({ faro: out.faro, saliti: out.saliti, dono, lot: out.lotti.get(me) ?? r.lot });
  }
  /** Il lotto ha pagato: il faro conta il versamento (e chiude l'intento) in una transazione; se sale, feed a tutti e livelli a ogni lotto. */
  private async faroConta(d: DonoAperto, now: number): Promise<{ faro: FaroStato; saliti: number[]; lotti: Map<string, LotState> }> {
    const sql = this.ctx.storage.sql, chi = [...new Set([...d.tutti, d.persona])];
    let out = { faro: leggiFaro(sql), saliti: [] as number[] };
    this.ctx.storage.transactionSync(() => {
      out = versaNelFaro(leggiFaro(sql), d.persona, d.dono, now);
      scriviFaro(sql, out.faro);
      chiudiDono(sql, d.id);
      for (const lv of out.saliti) for (const p of chi) scriviFeed(sql, { persona: p, tipo: 'faro', sfida: `faro:${lv}`, altro: d.persona, dati: { livello: lv }, letto: p === d.persona, quando: now });
    });
    const lotti = new Map<string, LotState>();
    if (out.saliti.length) { // best-effort: chi non lo riceve adesso lo impara al rientro (il Worker passa i livelli al lotto)
      const res = await Promise.allSettled(chi.map(async (p) => [p, await this.lot(p, 'faro_livelli', now, { livelli: out.faro.livelli })] as const));
      for (const x of res) if (x.status === 'fulfilled' && x.value[1].ok) lotti.set(x.value[0], x.value[1].lot);
    }
    return { ...out, lotti };
  }

  /** Le mie sfide: quelle in gioco (mandate e ricevute) e le chiuse degli ultimi 7 giorni, le più recenti prima. */
  private list(me: string, now: number): Challenge[] {
    return this.ctx.storage.sql.exec<{ json: string }>(
      `SELECT json FROM sfide WHERE (da = ?1 OR a = ?1) AND fase IS NULL AND (stato IN ('gioca_sfidante','aperta','accettata') OR creata >= ?2)
       ORDER BY creata DESC LIMIT 50`, me, now - RECENTI_MS,
    ).toArray().map((r) => JSON.parse(r.json) as Challenge);
  }

  private async create(me: string, body: Record<string, unknown>, now: number): Promise<Response> {
    const to = body['to'], minigame = body['minigame'], stake = body['stake'] as Resources;
    if (typeof to !== 'string' || typeof minigame !== 'string' || !stake || typeof stake !== 'object') return json({ error: 'Richiesta non valida' }, 400);
    const seed = crypto.getRandomValues(new Uint32Array(1))[0]! >>> 1;
    const c = newChallenge({ id: crypto.randomUUID().slice(0, 13), minigame, from: me, to, stake: { legno: stake.legno, pietra: stake.pietra, perle: stake.perle }, seed, nowMs: now });
    const row: Row = { id: c.id, c, fase: 'nuova', pending: [] };
    this.put(row); // prima si scrive, poi si tocca il lotto: se qui si muore, lo sweep riprende da capo
    const h = await this.hold(me, c.id, c.stake, 'apri', now);
    if (!h.ok) { this.del(c.id); return json(h.body, h.status); }
    row.fase = null;
    this.put(row);
    await this.scheduleAlarm(now);
    return json(c);
  }

  private async play(me: string, row: Row, inputs: unknown, now: number): Promise<Response> {
    const err = actionError(row.c, me, 'play', now);
    if (err) return json({ error: err }, err === 'Questa sfida non è tua' ? 403 : 409);
    const m = getMinigame(row.c.minigame);
    if (!isPackedInputs(inputs, m.maxTicks)) return json({ error: 'Partita non valida' }, 400);
    const result = replay(row.c.minigame, row.c.seed, row.c.difficulty, inputs); // il punteggio lo decide il server
    row.c = playTurn(row.c, me, result);
    if (me === row.c.to) {
      const out = closeOutcome(row.c, now);
      row.c = out.challenge;
      row.pending = out.releases;
    }
    this.commit(row, () => {
      // lo sfidato viene avvisato solo adesso che lo sfidante ha giocato (niente riga alla creazione)
      if (row.c.state === 'aperta') this.note(row.c.to, 'sfida_ricevuta', row, this.base(row), false, now);
      else if (row.c.state === 'chiusa') this.noteChiusa(row, me, now);
    });
    await this.drive(row, now);
    await this.scheduleAlarm(now);
    return json({ score: result.score, medal: result.medal, detail: result.detail, challenge: row.c });
  }

  private async accept(me: string, row: Row, now: number): Promise<Response> {
    const err = actionError(row.c, me, 'accept', now);
    if (err) return json({ error: err }, err === 'Questa sfida non è tua' || err === 'Solo chi è sfidato può rispondere' ? 403 : 409);
    row.fase = 'accettando';
    this.put(row);
    const h = await this.hold(me, row.id, row.c.stake, 'accetta', now);
    if (!h.ok) { row.fase = null; this.put(row); return json(h.body, h.status); }
    const a = await this.lot(row.c.from, 'state', now);
    row.c = acceptChallenge(row.c, a.ok ? a.lot : h.lot, h.lot);
    row.fase = null;
    this.commit(row, () => this.note(row.c.from, 'sfida_accettata', row, this.base(row), false, now));
    return json(row.c);
  }

  private async decline(me: string, row: Row, now: number): Promise<Response> {
    const err = actionError(row.c, me, 'decline', now);
    if (err) return json({ error: err }, err === 'Questa sfida non è tua' || err === 'Solo chi è sfidato può rispondere' ? 403 : 409);
    const out = refundsFor(row.c, 'rifiutata', now);
    row.c = out.challenge;
    row.pending = out.releases;
    this.commit(row, () => this.note(row.c.from, 'sfida_rifiutata', row, this.base(row), false, now));
    await this.drive(row, now);
    await this.scheduleAlarm(now);
    return json(row.c);
  }
}
