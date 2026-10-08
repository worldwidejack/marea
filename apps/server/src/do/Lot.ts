// Isola di un giocatore: LotState in una riga JSON dello storage SQLite del DO, produzione pigra (`advance` a ogni lettura con l'ora del
// server), azioni economiche pure di @marea/sim. Il Worker instrada qui con idFromName(persona.id) e passa il proprietario in `x-persona`
// e l'ora in `x-now` (vedi clock.ts). Il DO serializza le richieste (input gate) e lo storage SQL è sincrono: niente corse tra due azioni.
// Richieste dal Worker: GET /state · POST /collect {building} · /build {building, cell} · /upgrade {building} · /decor {decor, cell, rot} · /hat {hat}.
// Decorazioni libere (#108): POST /decor_move {id, cell} · /decor_rotate {id} · /decor_sell {id} → LotState (rimborso da BALANCE.decor).
// · /barca {id} (#107: colore esclusivo della barca, una volta).
// Minigiochi da solo: POST /solo_start {minigame, opzioni?} → {seed, difficulty, opzioni, lot} · /solo_play {inputs} → il server rigioca gli input, premia la
// medaglia (balance.solo) e risponde {score, medal, detail, premio, premiata, lot}.
// Bacheca del Porto (#64): POST /missione {i} → RISCUOTI {premio, missione, lot}. I contatori delle missioni di oggi li aggiornano qui
// le azioni che il server verifica davvero (raccolte, cantieri, acquisti, partite da solo, spedizioni): `tracciaMissioni` di @marea/sim.
// Diario del capitano (#87): POST /diario_visto {animali, isole} (avvistamenti dal client, solo id dei cataloghi) · /diario_riscuoti {id, amici}
// → {premio, traguardo, lot} · /diario_titolo {id | null} → LotState. Pesci, perle, medaglie e partite li scrive `solo_play` dopo il replay,
// le spedizioni `dungeon_finish` (registraPartita / registraDiscesa di @marea/sim/economy/diario.ts).
// Mondo Sotterraneo (lot_rpg.ts): POST /rpg {azione} · /dungeon_start {dungeon} · /dungeon_save {inputs, hash} · /dungeon_finish {inputs, hash}.
// Rientro e libro degli ospiti (#86): POST /rientro {} → {riepilogo, lot} (riepilogo dell'assenza se mancavi da abbastanza, poi visto = adesso)
// · /visto {} → {ok} («ci sono» del client che gioca) · /firma {chi, nome, emote} → LotState (un amico firma il libro di questa isola).
// Richieste dal DO Sfide (mai esposte dal Worker): POST /hold {cid, stake, kind} · /release {cid, release}: idempotenti per id sfida.
// Faro comune (#111), sempre dal DO Sfide: POST /faro_dona {id, dono} (Legno e Pietra escono dal lotto, idempotente per id) ·
// /faro_livelli {livelli} (i momenti in cui il faro è salito: il bonus di produzione lo applica `advance`). Anche /rientro può portare
// `faro` (i livelli, letti dal Worker): così chi entra dopo una salita la impara subito.
import { DurableObject } from 'cloudflare:workers';
import { AVATAR, BUILDINGS, DECOR } from '@marea/content';
import { build, buyHat, collect, moveDecor, newLot, placeDecor, rotateDecor, sellDecor, upgrade } from '@marea/sim/economy/actions.ts';
import { compraColoreBarca } from '@marea/sim/economy/barca.ts';
import { advance } from '@marea/sim/economy/advance.ts';
import { defaultTemplate, fitToTemplate } from '@marea/sim/economy/cells.ts';
import { holdStake, releaseStake } from '@marea/sim/economy/challenge.ts';
import type { Release } from '@marea/sim/economy/challenge.ts';
import { finishSolo, soloOf, startSolo } from '@marea/sim/economy/rewards.ts';
import { EconomyError } from '@marea/sim/economy/types.ts';
import { eventiPartita, eventiRaccolta, riscuotiMissione, tracciaMissioni } from '@marea/sim/economy/missioni.ts';
import type { EventiMissione } from '@marea/sim/economy/missioni.ts';
import { firmaLibro, rientra, segnaVisto } from '@marea/sim/economy/rientro.ts';
import { donaAlFaro, segnaFaro } from '@marea/sim/economy/faro.ts';
import { MINIGAMES, getMinigame } from '@marea/sim/minigames/registry.ts';
import { isPackedInputs, replayPartita } from '@marea/sim/replay.ts';
import { registraDiscesa, registraPartita, registraVisti, riscuotiTraguardo, scegliTitolo } from '@marea/sim/economy/diario.ts';
import { fitHero } from '@marea/sim/rpg/hero.ts';
import { chiudiScaduta } from '@marea/sim/dungeon/settle.ts';
import type { EconomyErrorCode, LotState, Resources } from '@marea/sim/economy/types.ts';
import { nowFromHeader } from '../clock.ts';
import type { Env } from '../env.ts';
import { RPG_ACTS, json, rpgRoute } from './lot_rpg.ts';

const isCell = (v: unknown): v is [number, number] => Array.isArray(v) && v.length === 2 && v.every((n) => Number.isInteger(n) && n >= 0 && n < 256);
const isId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 40;
const isRes = (v: unknown): v is Resources => {
  if (!v || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  return (['legno', 'pietra', 'perle'] as const).every((k) => Number.isInteger(r[k]) && (r[k] as number) >= 0);
};
/** Lista di id dal client: al massimo 20, stringhe corte. null = forma sbagliata. */
const idList = (v: unknown): string[] | null => {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) && v.length <= 20 && v.every((x) => typeof x === 'string' && x.length > 0 && x.length <= 48) ? (v as string[]) : null;
};
const MEDALS: readonly unknown[] = ['oro', 'argento', 'bronzo', null];
function isRelease(v: unknown): v is Release {
  if (!v || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  if (r['esito'] === 'rimborso') return true;
  if (!MEDALS.includes(r['medal'])) return false;
  return r['esito'] === 'persa' || r['esito'] === 'pari' || (r['esito'] === 'vinta' && isRes(r['pot']));
}
/** Contatori delle missioni mossi da un'azione andata a buon fine (le poste delle sfide non contano). */
function eventiAzione(act: string, prima: LotState, dopo: LotState): EventiMissione {
  if (act === 'collect') return eventiRaccolta(prima, dopo);
  if (act === 'build' || act === 'upgrade') return { cantiere: 1 };
  if (act === 'decor' || act === 'hat' || act === 'barca') return { mercante: 1 };
  return {};
}
/** Stato HTTP di un errore economico: richiesta rotta 400, cosa inesistente 404, il resto è un conflitto con lo stato (409). */
const STATUS: Partial<Record<EconomyErrorCode, number>> = { sconosciuto: 404, posizione: 400, posta: 400 };
/** Partite e spedizioni contano anche nel diario del capitano (#87). */
const tornatoDaSpedizione = (l: LotState, now: number): LotState => registraDiscesa(tracciaMissioni(l, { dungeon: 1 }, now));

export class Lot extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS stato (k INTEGER PRIMARY KEY, json TEXT NOT NULL)');
  }
  private load(owner: string, now: number): LotState {
    const row = this.ctx.storage.sql.exec<{ json: string }>('SELECT json FROM stato WHERE k = 1').toArray()[0];
    if (!row) {
      const lot = newLot(owner, now);
      this.save(lot);
      return lot;
    }
    const lot = JSON.parse(row.json) as LotState;
    // lotti nati prima del template `lotto` (celle arbitrarie): Molo sul molo, edifici sugli slot L; poi resta com'è
    // e personaggi con abilità o perk che non esistono più (Navigazione): via, i perk tornano punti
    const fit = fitHero(fitToTemplate(lot, defaultTemplate()));
    // spedizione abbandonata da un pezzo con un altare toccato: si chiude tenendo il bottino dell'altare
    const chiusa = chiudiScaduta(fit, now);
    if (chiusa) { this.save(chiusa.lot); return chiusa.lot; }
    if (fit !== lot) this.save(fit);
    return fit;
  }
  private save(lot: LotState): void {
    this.ctx.storage.sql.exec('INSERT OR REPLACE INTO stato (k, json) VALUES (1, ?)', JSON.stringify(lot));
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const owner = req.headers.get('x-persona') ?? '';
    if (!owner) return json({ error: 'Manca la persona' }, 400);
    const now = nowFromHeader(req);
    const act = url.pathname.replace(/^\/+/, '');
    try {
      const lot = this.load(owner, now);
      if (req.method === 'GET' && act === 'state') {
        const next = advance(lot, now);
        this.save(next);
        return json(next);
      }
      if (req.method !== 'POST') return json({ error: 'Metodo non consentito' }, 405);
      let body: Record<string, unknown>;
      try { body = (await req.json()) as Record<string, unknown>; } catch { return json({ error: 'Richiesta non valida' }, 400); }
      if (!body || typeof body !== 'object') return json({ error: 'Richiesta non valida' }, 400);
      if (act === 'solo_start' || act === 'solo_play') return this.solo(lot, act, body, now);
      if (RPG_ACTS.has(act)) return rpgRoute(lot, act, body, now, (l) => this.save(l), (l) => tornatoDaSpedizione(l, now));
      if (act === 'faro_dona' || act === 'faro_livelli') return this.faro(lot, act, body, now);
      if (act === 'rientro') {
        const out = rientra(Array.isArray(body['faro']) ? segnaFaro(lot, body['faro']) : lot, now);
        this.save(out.lot);
        return json({ riepilogo: out.riepilogo, lot: out.lot });
      }
      if (act === 'visto') {
        const next = segnaVisto(lot, now);
        if (next !== lot) this.save(next);
        return json({ ok: true, now });
      }
      if (act === 'firma') {
        const chi = body['chi'], nome = body['nome'], emote = body['emote'];
        if (!isId(chi) || typeof nome !== 'string' || nome.length > 64 || !isId(emote)) return json({ error: 'Firma non valida' }, 400);
        const next = firmaLibro(lot, chi, nome, emote, now);
        this.save(next);
        return json(next);
      }
      if (act.startsWith('diario_')) return this.diario(lot, act, body, now);
      if (act === 'missione') {
        const i = body['i'];
        if (typeof i !== 'number' || !Number.isInteger(i) || i < 0 || i > 9) return json({ error: 'Missione non valida' }, 400);
        const out = riscuotiMissione(lot, i, now);
        this.save(out.lot);
        return json({ premio: out.premio, missione: out.missione, lot: out.lot });
      }
      const next0 = this.act(lot, act, body, now);
      if (next0 instanceof Response) return next0;
      const next = tracciaMissioni(next0, eventiAzione(act, lot, next0), now);
      this.save(next);
      return json(next);
    } catch (e) {
      if (e instanceof EconomyError) {
        const status = STATUS[e.code] ?? 409;
        return json(e.manca ? { error: e.message, manca: e.manca, code: e.code } : { error: e.message, code: e.code }, status);
      }
      console.error('[marea] lot error', e);
      return json({ error: 'Errore interno, riprova tra poco' }, 500);
    }
  }

  /** Partita da solo: il seed lo sceglie il server, il punteggio lo ricalcola il server rigiocando gli input. */
  private solo(lot: LotState, act: 'solo_start' | 'solo_play', body: Record<string, unknown>, now: number): Response {
    if (act === 'solo_start') {
      const mg = body['minigame'];
      if (typeof mg !== 'string' || !Object.hasOwn(MINIGAMES, mg)) return json({ error: 'Minigioco sconosciuto' }, 400);
      const seed = crypto.getRandomValues(new Uint32Array(1))[0]! >>> 1;
      // opzioni della partita (es. il mare della pesca): le normalizza il modulo; senza `opzioni` nel modulo si ignorano
      const mod = getMinigame(mg), opzioni = mod.opzioni ? mod.opzioni(body['opzioni']) : undefined;
      const next = startSolo(lot, mg, seed, now, 2, opzioni);
      this.save(next);
      const p = soloOf(next, now).pending!;
      return json({ minigame: p.minigame, seed: p.seed, difficulty: p.difficulty, opzioni: p.opzioni ?? {}, lot: next });
    }
    const p = soloOf(lot, now).pending;
    if (!p) return json({ error: 'Nessuna partita aperta: riparti dal via', code: 'partita' }, 409);
    const inputs = body['inputs'];
    if (!isPackedInputs(inputs, getMinigame(p.minigame).maxTicks)) return json({ error: 'Partita non valida' }, 400);
    const { result: r, raccolta } = replayPartita(p.minigame, p.seed, p.difficulty, inputs, p.opzioni);
    const out = finishSolo(lot, r.medal, now);
    const next = registraPartita(tracciaMissioni(out.lot, eventiPartita(r.medal), now), p.minigame, r.medal, raccolta);
    this.save(next);
    return json({ minigame: p.minigame, score: r.score, medal: r.medal, detail: r.detail, premio: out.premio, premiata: out.premiata, lot: next });
  }

  /** Faro comune (#111): versamento (idempotente per id: il coordinatore può ripeterlo dopo un crash) e livelli raggiunti. */
  private faro(lot: LotState, act: 'faro_dona' | 'faro_livelli', body: Record<string, unknown>, now: number): Response {
    if (act === 'faro_livelli') {
      if (!Array.isArray(body['livelli'])) return json({ error: 'Richiesta non valida' }, 400);
      const next = segnaFaro(lot, body['livelli']);
      if (next !== lot) this.save(next);
      return json(next);
    }
    const id = body['id'], dono = body['dono'] as Record<string, unknown> | null;
    if (!isId(id) || !dono || typeof dono !== 'object') return json({ error: 'Richiesta non valida' }, 400);
    const legno = dono['legno'], pietra = dono['pietra'];
    if (!Number.isInteger(legno) || !Number.isInteger(pietra) || (legno as number) < 0 || (pietra as number) < 0) return json({ error: 'Versamento non valido' }, 400);
    const next = donaAlFaro(lot, id, { legno: legno as number, pietra: pietra as number }, now);
    if (next !== lot) this.save(next);
    return json(next);
  }

  /** Diario del capitano (#87): avvistamenti, RISCUOTI di un traguardo (paga il server, una volta), titolo sotto il nome. */
  private diario(lot: LotState, act: string, body: Record<string, unknown>, now: number): Response {
    if (act === 'diario_visto') {
      const animali = idList(body['animali']), isole = idList(body['isole']);
      if (!animali || !isole) return json({ error: 'Avvistamenti non validi' }, 400);
      const out = registraVisti(lot, { animali, isole });
      if (out.lot !== lot) this.save(out.lot);
      return json({ nuovi: out.nuovi, lot: out.lot });
    }
    if (act === 'diario_riscuoti') {
      const id = body['id'], amici = body['amici'];
      if (!isId(id)) return json({ error: 'Traguardo non valido' }, 400);
      const ctx = { amici: typeof amici === 'number' && Number.isInteger(amici) && amici >= 0 && amici < 1000 ? amici : 0 };
      const out = riscuotiTraguardo(lot, id, now, ctx);
      this.save(out.lot);
      return json({ premio: out.premio, traguardo: out.traguardo, lot: out.lot });
    }
    if (act === 'diario_titolo') {
      const id = body['id'];
      if (id !== null && !isId(id)) return json({ error: 'Titolo non valido' }, 400);
      const next = scegliTitolo(lot, id);
      if (next !== lot) this.save(next);
      return json(next);
    }
    return json({ error: 'Non trovato' }, 404);
  }

  private act(lot: LotState, act: string, body: Record<string, unknown>, now: number): LotState | Response {
    switch (act) {
      case 'collect':
        if (!isId(body['building'])) return json({ error: 'Manca l’edificio' }, 400);
        return collect(lot, body['building'], now);
      case 'upgrade':
        if (!isId(body['building'])) return json({ error: 'Manca l’edificio' }, 400);
        return upgrade(lot, body['building'], now);
      case 'build': {
        const b = body['building'], cell = body['cell'];
        if (!isId(b) || !BUILDINGS.some((d) => d.id === b)) return json({ error: 'Edificio sconosciuto' }, 400);
        if (!isCell(cell)) return json({ error: 'Cella non valida' }, 400);
        return build(lot, b, cell, now);
      }
      case 'decor': {
        const d = DECOR.find((x) => x.id === body['decor']), cell = body['cell'], rot = body['rot'] ?? 0;
        if (!d) return json({ error: 'Decorazione sconosciuta' }, 400);
        if (!isCell(cell)) return json({ error: 'Cella non valida' }, 400);
        if (typeof rot !== 'number' || !Number.isInteger(rot) || rot < 0 || rot > 3) return json({ error: 'Rotazione non valida (0-3)' }, 400);
        return placeDecor(lot, d.id, cell, rot, now, d.perle);
      }
      case 'decor_move': case 'decor_rotate': case 'decor_sell': {
        const id = body['id'], cell = body['cell'];
        if (!isId(id)) return json({ error: 'Manca la decorazione' }, 400);
        if (act === 'decor_rotate') return rotateDecor(lot, id, now);
        if (act === 'decor_sell') return sellDecor(lot, id, now).lot;
        if (!isCell(cell)) return json({ error: 'Cella non valida' }, 400);
        return moveDecor(lot, id, cell, now);
      }
      case 'hat': {
        const h = body['hat'];
        if (!isId(h) || !AVATAR.cappelli.some((x) => x.id === h)) return json({ error: 'Cappello sconosciuto' }, 400);
        return buyHat(lot, h, now);
      }
      case 'barca': {
        const id = body['id'];
        if (!isId(id)) return json({ error: 'Colore sconosciuto' }, 400);
        return compraColoreBarca(lot, id, now);
      }
      case 'hold': {
        const cid = body['cid'], stake = body['stake'], kind = body['kind'];
        if (!isId(cid) || !isRes(stake) || (kind !== 'apri' && kind !== 'accetta')) return json({ error: 'Richiesta non valida' }, 400);
        return holdStake(lot, cid, stake, kind, now);
      }
      case 'release': {
        const cid = body['cid'], rel = body['release'];
        if (!isId(cid) || !isRelease(rel)) return json({ error: 'Richiesta non valida' }, 400);
        return releaseStake(lot, cid, rel, now);
      }
      default:
        return json({ error: 'Non trovato' }, 404);
    }
  }
}
