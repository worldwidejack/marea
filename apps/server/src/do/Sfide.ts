// DO Sfide (una sola istanza: idFromName('tavolo')). È nato per le sfide con posta, tolte dal codice (tag archivio/spenti-sfide; la loro
// tabella `sfide` resta nel database, non si usa più); oggi tiene le cose in comune tra amici. Il nome resta: un Durable Object non si
// rinomina senza una migrazione. Tutte le operazioni passano da un mutex in memoria: una alla volta (sono poche, tra amici).
// Richieste dal Worker (x-persona, x-now): GET /feed · POST /feed_letto {fino?} · POST /visita {chi, emote} (#86, riga «è passato sulla tua isola»).
// Porto tra amici (#110 #111, portoStore.ts): GET /record (tabellone) · POST /record {minigame, score, medal, detail} (dal Worker dopo il replay
// di una partita da solo nel DO del lotto: mai dal client) · GET /faro · POST /faro_versa {legno, pietra, tutti} (versamento al Faro comune:
// intento, poi il lotto paga, poi il faro conta; se sale di livello, riga di feed a tutti e i livelli a ogni lotto).
// Collezionisti (#457): GET/POST /collezione. Buche della pala: GET /buche · POST /buca. Adrenalina: GET /discese, /fantasma · POST /discesa.
import { DurableObject } from 'cloudflare:workers';
import { EconomyError } from '@marea/sim/economy/types.ts';
import type { LotState, Resources } from '@marea/sim/economy/types.ts';
import { getMinigame } from '@marea/sim/minigames/registry.ts';
import { isPackedInputs } from '@marea/sim/replay.ts';
import { nowFromHeader } from '../clock.ts';
import { creaTabellaFeed, leggiFeed, nonLetti, scriviFeed, segnaLetti } from './feedStore.ts';
import { apriDono, chiudiDono, creaTabellePorto, doniAperti, leggiCollezione, leggiFaro, leggiTabellone, scriviCollezione, scriviFaro, scriviTabellone } from './portoStore.ts';
import type { DonoAperto } from './portoStore.ts';
import { dosaDono, faroProssimo, versaNelFaro } from '@marea/sim/economy/faro.ts';
import type { FaroStato } from '@marea/sim/economy/faro.ts';
import { recordDi, segnaRecord } from '@marea/sim/economy/record.ts';
import { MINIGAMES } from '@marea/sim/minigames/registry.ts';
import '@marea/sim/corse/registra.ts'; // Corse: il server rigioca sul motore v2 (#173)
import { handleBuca, listBuche } from './bucheStore.ts';
import '@marea/sim/adrenalina/registra.ts'; // Adrenalina: le discese nel tabellone dei record (passo 3b)
import { SNOWBOARD_PISTE } from '@marea/content/adrenalina.ts';
import { migliora } from '@marea/sim/adrenalina/classifica.ts';
import { classificaDiscese, creaTabellaDiscese, fantasmaDiscesa, scriviDiscesa } from './disceseStore.ts';
import type { Env } from '../env.ts';

const json = (dati: unknown, status = 200): Response =>
  new Response(JSON.stringify(dati), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const RIPROVA_MS = 60_000;

type LotError = { error: string; manca?: Resources; code?: string };
type LotReply = { ok: true; lot: LotState } | { ok: false; status: number; body: LotError };

export class Sfide extends DurableObject<Env> {
  private chain: Promise<unknown> = Promise.resolve();
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    creaTabellaFeed(ctx.storage.sql);
    creaTabellePorto(ctx.storage.sql);
    creaTabellaDiscese(ctx.storage.sql);
  }

  /** Una operazione alla volta, anche mentre si aspettano i DO Lot (l'input gate non basta: le fetch in uscita lo aprono). */
  private locked<T>(fn: () => Promise<T>): Promise<T> {
    const p = this.chain.then(fn, fn);
    this.chain = p.catch(() => undefined);
    return p;
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
  /** Versamenti al faro lasciati a metà (un crash): il lotto è idempotente per id, quindi si richiede e, se ha pagato, il faro conta.
   *  Gira a ogni richiesta e nell'alarm. */
  private async sweep(now: number): Promise<void> {
    for (const d of doniAperti(this.ctx.storage.sql)) {
      try {
        const r = await this.lot(d.persona, 'faro_dona', now, { id: d.id, dono: d.dono });
        if (r.ok) await this.faroConta(d, now); else chiudiDono(this.ctx.storage.sql, d.id);
      } catch (e) { console.error('[marea] sweep faro', d.id, e); }
    }
    await this.scheduleAlarm();
  }
  private async scheduleAlarm(): Promise<void> {
    if (!doniAperti(this.ctx.storage.sql).length) { await this.ctx.storage.deleteAlarm(); return; }
    await this.ctx.storage.setAlarm(Date.now() + RIPROVA_MS);
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
        const sql = this.ctx.storage.sql;
        // il feed porta anche i momenti delle salite del Faro: il Worker li passa al lotto al rientro (#111)
        if (req.method === 'GET' && act === 'feed') return json({ rows: leggiFeed(sql, me), nonLetti: nonLetti(sql, me), faroLivelli: leggiFaro(sql).livelli });
        if (req.method === 'GET' && act === 'record') return json({ tab: recordDi(leggiTabellone(sql), now) });
        if (req.method === 'GET' && act === 'faro') return json({ faro: leggiFaro(sql) });
        if (req.method === 'GET' && act === 'collezione') return json({ collezione: leggiCollezione(sql) });
        if (req.method === 'GET' && act === 'buche') return json({ buche: listBuche(sql), now });
        // Adrenalina (passo 3b): la classifica a tempo di una pista e il fantasma del primo
        if (req.method === 'GET' && (act === 'discese' || act === 'fantasma')) {
          const pista = url.searchParams.get('pista') ?? '';
          if (!Object.hasOwn(SNOWBOARD_PISTE, pista)) return json({ error: 'Pista sconosciuta' }, 400);
          return json(act === 'discese' ? { pista, righe: classificaDiscese(sql, pista) } : { pista, fantasma: fantasmaDiscesa(sql, pista) });
        }
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
        if (act === 'collezione') return this.collezione(me, body, now);
        if (act === 'discesa') return this.discesa(me, body, now);
        if (act === 'faro_versa') return await this.faroVersa(me, body, now);
        if (act === 'buca') return await handleBuca(sql, me, body, now, this.env);
        return json({ error: 'Non trovato' }, 404);
      } catch (e) {
        if (e instanceof EconomyError) return json({ error: e.message }, e.code === 'sconosciuto' ? 400 : 409);
        console.error('[marea] errore nel DO Sfide', e);
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

  /** I collezionisti (#457): dopo una consegna al mobiliere il Worker scrive qui quanti pesci e insetti ha `me` (letti dal suo lotto). */
  private collezione(me: string, body: Record<string, unknown>, now: number): Response {
    const pesci = body['pesci'], insetti = body['insetti'], ok = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 1000;
    if (!ok(pesci) || !ok(insetti)) return json({ error: 'Richiesta non valida' }, 400);
    const sql = this.ctx.storage.sql, c = leggiCollezione(sql);
    scriviCollezione(sql, { ...c, [me]: { pesci, insetti, quando: now } });
    return json({ ok: true });
  }

  /** Discesa dell'Adrenalina già rigiocata dal DO del lotto (passo 3b): se è il miglior tempo finale di `me` su quella pista entra in
   *  classifica con i suoi input (diventa il fantasma, se è la prima). Dal Worker, dopo `solo_play`. */
  private discesa(me: string, body: Record<string, unknown>, now: number): Response {
    const pista = body['pista'], ms = body['ms'], seed = body['seed'], opzioni = body['opzioni'], inputs = body['inputs'];
    if (typeof pista !== 'string' || !Object.hasOwn(SNOWBOARD_PISTE, pista) || typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0 || typeof seed !== 'number'
      || !opzioni || typeof opzioni !== 'object' || !isPackedInputs(inputs, getMinigame('snowboard').maxTicks)) return json({ error: 'Richiesta non valida' }, 400);
    const sql = this.ctx.storage.sql, cl = classificaDiscese(sql, pista), primo = cl[0] ?? null;
    if (!migliora(cl, me, ms)) return json({ migliorato: false });
    scriviDiscesa(sql, pista, { chi: me, ms: Math.round(ms), quando: now, seed, opzioni: opzioni as Record<string, string>, inputs });
    return json({ migliorato: true, record: !primo || ms < primo.ms });
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
    await this.scheduleAlarm();
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
}
