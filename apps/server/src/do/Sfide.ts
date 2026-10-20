// DO Sfide (una sola istanza: idFromName('tavolo')). È nato per le sfide con posta, tolte dal codice (tag archivio/spenti-sfide; la loro
// tabella `sfide` resta nel database, non si usa più); oggi tiene le cose in comune tra amici. Il nome resta: un Durable Object non si
// rinomina senza una migrazione. Tutte le operazioni passano da un mutex in memoria: una alla volta (sono poche, tra amici).
// Richieste dal Worker (x-persona, x-now): GET /feed · POST /feed_letto {fino?} · POST /visita {chi, emote} (riga «è passato sulla tua isola»).
// Porto tra amici (portoStore.ts): GET /record (tabellone) · POST /record {minigame, score, medal, detail} (dal Worker dopo il replay
// di una partita da solo nel DO del lotto: mai dal client). Il Faro comune è stato tolto (tag archivio/spenti-faro).
// Collezionisti: GET/POST /collezione. Buche della pala: GET /buche · POST /buca. Adrenalina: GET /discese, /fantasma · POST /discesa.
import { DurableObject } from 'cloudflare:workers';
import { EconomyError } from '@marea/sim/economy/types.ts';
import { getMinigame } from '@marea/sim/minigames/registry.ts';
import { isPackedInputs } from '@marea/sim/replay.ts';
import { nowFromHeader } from '../clock.ts';
import { creaTabellaFeed, leggiFeed, nonLetti, scriviFeed, segnaLetti } from './feedStore.ts';
import { creaTabellePorto, leggiCollezione, leggiTabellone, scriviCollezione, scriviTabellone } from './portoStore.ts';
import { recordDi, segnaRecord } from '@marea/sim/economy/record.ts';
import { MINIGAMES } from '@marea/sim/minigames/registry.ts';
import '@marea/sim/corse/registra.ts'; // Corse: il server rigioca sul motore v2 (#173)
import { handleBuca, listBuche } from './bucheStore.ts';
import '@marea/sim/adrenalina/registra.ts'; // Adrenalina: le discese nel tabellone dei record (passo 3b)
import { SNOWBOARD_PISTE } from '@marea/content/adrenalina.ts';
import { migliora } from '@marea/sim/adrenalina/classifica.ts';
import { classificaDiscese, creaTabellaDiscese, fantasmaDiscesa, scriviDiscesa } from './disceseStore.ts';
import type { Env } from '../env.ts';
import { json } from '../http.ts';

export class Sfide extends DurableObject<Env> {
  private chain: Promise<unknown> = Promise.resolve();
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    creaTabellaFeed(ctx.storage.sql);
    creaTabellePorto(ctx.storage.sql);
    creaTabellaDiscese(ctx.storage.sql);
  }

  /** Una operazione alla volta, anche mentre si aspetta un altro DO (l'input gate non basta: le fetch in uscita lo aprono). */
  private locked<T>(fn: () => Promise<T>): Promise<T> {
    const p = this.chain.then(fn, fn);
    this.chain = p.catch(() => undefined);
    return p;
  }

  /** Gli alarm di prima (scadenze delle sfide, versamenti al Faro rimasti a metà) non servono più: se ne arriva uno, niente da fare. */
  async alarm(): Promise<void> { /* niente in sospeso */ }

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
        const sql = this.ctx.storage.sql;
        if (req.method === 'GET' && act === 'feed') return json({ rows: leggiFeed(sql, me), nonLetti: nonLetti(sql, me) });
        if (req.method === 'GET' && act === 'record') return json({ tab: recordDi(leggiTabellone(sql), now) });
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
        if (act === 'buca') return await handleBuca(sql, me, body, now, this.env);
        return json({ error: 'Non trovato' }, 404);
      } catch (e) {
        if (e instanceof EconomyError) return json({ error: e.message }, e.code === 'sconosciuto' ? 400 : 409);
        console.error('[marea] errore nel DO Sfide', e);
        return json({ error: 'Errore interno, riprova tra poco' }, 500);
      }
    });
  }

  // ---------- Porto tra amici ----------
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
}
