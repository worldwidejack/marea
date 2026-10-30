// Il lotto di un giocatore (casa, monete, personaggio, collezioni): LotState in una riga JSON dello storage SQLite del DO, azioni
// economiche pure di @marea/sim con l'ora del server. Il Worker instrada qui con idFromName(persona.id) e passa il proprietario in `x-persona`
// e l'ora in `x-now` (vedi clock.ts). Il DO serializza le richieste (input gate) e lo storage SQL è sincrono: niente corse tra due azioni.
// Richieste dal Worker: GET /state · POST /decor {decor} (nel magazzino di casa) · /hat {hat}.
// · /barca {id} (#107: colore esclusivo della barca, una volta).
// Minigiochi da solo: POST /solo_start {minigame, opzioni?} → {seed, difficulty, opzioni, lot} · /solo_play {inputs} → il server rigioca gli input, premia la
// medaglia (balance.solo) e risponde {score, medal, detail, premio, premiata, lot}.
// Bacheca del Porto (#64): POST /missione {i} → RISCUOTI {premio, missione, lot}. I contatori delle missioni di oggi li aggiornano qui
// le azioni che il server verifica davvero (acquisti, partite da solo, spedizioni): `tracciaMissioni` di @marea/sim.
// Diario del capitano: POST /diario_visto {animali, isole} (avvistamenti dal client, solo id dei cataloghi). Pesci, perle, medaglie e
// partite li scrive `solo_play` dopo il replay, le spedizioni `dungeon_finish` (registraPartita / registraDiscesa di @marea/sim/economy/diario.ts).
// Dungeon insieme (#118): /dungeon_party_start arriva dal DO Spedizioni; con pending.party il lotto chiede il log della squadra (POST /log) e lo rigioca.
// Mondo Sotterraneo (lot_rpg.ts): POST /rpg {azione} · /dungeon_start {dungeon} · /dungeon_save {inputs, hash} · /dungeon_finish {inputs, hash}.
// Isola dei Templari (lot_templari.ts): POST /templari_start {subito?} · /templari_finish {inputs, azioni, hash} (replay e premio delle ondate) ·
// /templari_reliquia (il calice della Tempesta) · /templari_party_start (solo dal DO TemplariInsieme; il finish insieme rigioca il suo log).
// Isola dell'Adrenalina (docs/ADRENALINA.md §2): POST /adrenalina_liberatoria {} → {lot, nuova} (la firma al cancello della funivia, una volta sola).
// Storia delle prime ore (lot_storia.ts, GDD §9): POST /storia_<azione>; a ogni lettura `avanzaStoria` segna i passi che si vedono dal lotto.
// Rientro e libro degli ospiti (#86): POST /rientro {} → {riepilogo, lot} (riepilogo dell'assenza se mancavi da abbastanza, poi visto = adesso)
// · /visto {} → {ok} («ci sono» del client che gioca) · /firma {chi, nome, emote} → LotState (un amico firma il libro di questa isola).
import { DurableObject } from 'cloudflare:workers';
import { AVATAR, DECOR } from '@marea/content';
import { buyHat, newLot } from '@marea/sim/economy/actions.ts';
import { buyAbito } from '@marea/sim/economy/mercante.ts';
import { compraColoreDelGiorno, miglioraBottega } from '@marea/sim/economy/botteghe.ts';
import { ampliaCasa, compraFinituraDelGiorno, compraMobileDelGiorno, posaMobile, ritiraMobile, ruotaBaule, ruotaMobile, scegliFinitura, spostaBaule, spostaMobile, svuotaStanza } from '@marea/sim/economy/casa.ts';
import type { PostoMobile } from '@marea/sim/economy/casa.ts';
import { advance } from '@marea/sim/economy/advance.ts';
import { aggiornaSalvataggio } from '@marea/sim/economy/cambio.ts';
import type { LottoDiPrima } from '@marea/sim/economy/cambio.ts';
import { compraDecor } from '@marea/sim/economy/decorazioni.ts';
import { guadagna } from '@marea/sim/economy/monete.ts';
import { finishSolo, soloOf, startSolo } from '@marea/sim/economy/rewards.ts';
import { EconomyError } from '@marea/sim/economy/types.ts';
import { eventiPartita, riscuotiMissione, tracciaMissioni } from '@marea/sim/economy/missioni.ts';
import type { EventiMissione } from '@marea/sim/economy/missioni.ts';
import { firmaLibro, rientra, segnaVisto } from '@marea/sim/economy/rientro.ts';
import { MINIGAMES, getMinigame } from '@marea/sim/minigames/registry.ts';
import '@marea/sim/corse/registra.ts'; // Corse: il server rigioca sul motore v2 (#173)
import '@marea/sim/minigames/lava_registra.ts'; // Vulcano: la corsa senza fine della Fuga dalla lava
import { PISTA_SNOWBOARD } from '@marea/content/adrenalina.ts';
import '@marea/sim/adrenalina/registra.ts'; // Adrenalina: le discese dello snowboard (passo 3b)
import { medagliaDaPosizione, posizioneDiscesa } from '@marea/sim/adrenalina/classifica.ts';
import { isPackedInputs, replayPartita } from '@marea/sim/replay.ts';
import { registraDiscesa, registraPartita, registraVisti } from '@marea/sim/economy/diario.ts';
import { fitHero, newHero } from '@marea/sim/rpg/hero.ts';
import { chiudiScaduta } from '@marea/sim/dungeon/settle.ts';
import type { EconomyErrorCode, LotState } from '@marea/sim/economy/types.ts';
import { nowFromHeader } from '../clock.ts';
import type { Env } from '../env.ts';
import { RPG_ACTS, SERVE_GRUPPO, json, rpgRoute } from './lot_rpg.ts';
import { TEMPLARI_ACTS, templariRoute } from './lot_templari.ts';
import { ARENA_ACTS, arenaRoute } from './lot_arena.ts';
import { firmaLiberatoria } from '@marea/sim/adrenalina/liberatoria.ts';
import { GIOCHI_IN_BARCA, avanzaStoria, haBarca } from '@marea/sim/economy/storia.ts';
import { STORIA_ACTS, storiaRoute } from './lot_storia.ts';

const isCell = (v: unknown): v is [number, number] => Array.isArray(v) && v.length === 2 && v.every((n) => Number.isInteger(n) && n >= 0 && n < 256);
/** Un id dal client. 64: gli id dei mobili arrivano a 44 caratteri e quello di un mobile posato è `<id>-<n>` (con 40 quattro mobili non si compravano né si posavano). */
const isId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 64;
/** Lista di id dal client: al massimo 20, stringhe corte. null = forma sbagliata. */
const idList = (v: unknown): string[] | null => {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) && v.length <= 20 && v.every((x) => typeof x === 'string' && x.length > 0 && x.length <= 48) ? (v as string[]) : null;
};
/** Contatori delle missioni mossi da un'azione andata a buon fine. */
function eventiAzione(act: string): EventiMissione {
  if (act === 'decor' || act === 'hat' || act === 'abito' || act === 'barca' || act === 'casa_compra' || act === 'casa_finitura') return { mercante: 1 }; // anche il negozio dei mobili (#265)
  return {};
}
/** Stato HTTP di un errore economico: richiesta rotta 400, cosa inesistente 404, il resto è un conflitto con lo stato (409). */
const STATUS: Partial<Record<EconomyErrorCode, number>> = { sconosciuto: 404, posizione: 400 };
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
    const lot = JSON.parse(row.json) as LotState | LottoDiPrima;
    // salvataggi di prima: monete, niente giardino, decorazioni in casa, baule di serie (economy/cambio.ts), una volta sola;
    // e personaggi con abilità o perk che non esistono più (Navigazione): via, i perk tornano punti; poi i passi della storia che si vedono dal lotto
    const fit = avanzaStoria(fitHero(aggiornaSalvataggio(lot)));
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
      if (act === 'solo_start' || act === 'solo_play') return this.solo(lot, act, body, now, owner);
      if (RPG_ACTS.has(act)) {
        const g = lot.dungeon?.pending?.party;
        // spedizione insieme aperta (#118): prima il log della squadra dal DO Spedizioni, poi il lotto riletto (nell'attesa può essere cambiato)
        if (g && SERVE_GRUPPO.has(act)) {
          const gruppo = await this.logGruppo(g);
          return rpgRoute(this.load(owner, now), act, { ...body, gruppo }, now, (l) => this.save(l), (l) => tornatoDaSpedizione(l, now));
        }
        return rpgRoute(lot, act, body, now, (l) => this.save(l), (l) => tornatoDaSpedizione(l, now));
      }
      if (ARENA_ACTS.has(act)) return arenaRoute(lot, act, body, now, (l) => this.save(l)); // solo dal DO Arena
      if (STORIA_ACTS.has(act)) return storiaRoute(lot, act, body, now, (l) => this.save(l));
      if (TEMPLARI_ACTS.has(act)) {
        // partita insieme aperta: prima il log della squadra dal DO TemplariInsieme, poi il lotto riletto (nell'attesa può essere cambiato)
        const g = lot.templari?.pending?.party;
        if (g && act === 'templari_finish') {
          const gruppo = await this.logTemplari(g);
          return templariRoute(this.load(owner, now), act, { ...body, gruppo }, now, (l) => this.save(l));
        }
        return templariRoute(lot, act, body, now, (l) => this.save(l));
      }
      if (act === 'test_inv') {
        const item = body['item'], q = typeof body['q'] === 'number' ? body['q'] : 1;
        if (typeof item === 'string') {
          const hero = lot.hero ? { ...lot.hero } : newHero();
          const inv = { ...(hero.inv ?? {}) };
          inv[item] = (inv[item] ?? 0) + q;
          const next: LotState = { ...lot, hero: { ...hero, inv } };
          this.save(next);
          return json(next);
        }
        return json({ error: 'Manca item' }, 400);
      }
      if (act === 'test_monete') { // solo dalla rotta di prova del Worker (wrangler dev locale con TEST_CLOCK)
        const n = body['n'];
        if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > 1_000_000) return json({ error: 'Quante monete?' }, 400);
        const next = guadagna(lot, n);
        this.save(next);
        return json(next);
      }
      if (act === 'adrenalina_liberatoria') { const r = firmaLiberatoria(lot); if (r.nuova) this.save(r.lot); return json({ lot: r.lot, nuova: r.nuova }); }
      if (act === 'rientro') {
        const out = rientra(lot, now);
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
      if (act.startsWith('diario_')) return this.diario(lot, act, body);
      if (act === 'missione') {
        const i = body['i'];
        if (typeof i !== 'number' || !Number.isInteger(i) || i < 0 || i > 9) return json({ error: 'Missione non valida' }, 400);
        const out = riscuotiMissione(lot, i, now);
        this.save(out.lot);
        return json({ premio: out.premio, missione: out.missione, lot: out.lot });
      }
      const next0 = this.act(lot, act, body, now);
      if (next0 instanceof Response) return next0;
      const next = tracciaMissioni(next0, eventiAzione(act), now);
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

  /** Log della spedizione insieme (DO Spedizioni: da adesso questo eroe è fuori); null se non si trova più. */
  /** Templari insieme: il log della partita dal DO TemplariInsieme (l'eroe idx è fuori da adesso). null se non c'è più. */
  private async logTemplari(g: { run: string; idx: number }): Promise<unknown> {
    try {
      const r = await this.env.TEMPLARI_INSIEME.get(this.env.TEMPLARI_INSIEME.idFromName('templari')).fetch(new Request('https://templari/log', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ run: g.run, idx: g.idx }),
      }));
      return r.ok ? await r.json() : null;
    } catch (e) { console.warn('[marea] log dei Templari insieme non letto', e); return null; }
  }

  private async logGruppo(g: { run: string; idx: number }): Promise<unknown> {
    try {
      const r = await this.env.SPEDIZIONI.get(this.env.SPEDIZIONI.idFromName('spedizioni')).fetch(new Request('https://spedizioni/log', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ run: g.run, idx: g.idx }),
      }));
      return r.ok ? await r.json() : null;
    } catch (e) { console.warn('[marea] log della squadra non letto', e); return null; }
  }

  /** Partita da solo: il seed lo sceglie il server, il punteggio lo ricalcola il server rigiocando gli input. */
  private solo(lot: LotState, act: 'solo_start' | 'solo_play', body: Record<string, unknown>, now: number, owner: string): Response {
    if (act === 'solo_start') {
      const mg = body['minigame'];
      if (typeof mg !== 'string' || !Object.hasOwn(MINIGAMES, mg)) return json({ error: 'Minigioco sconosciuto' }, 400);
      if (GIOCHI_IN_BARCA.has(mg) && !haBarca(lot)) return json({ error: 'Ti serve una barca: Bepi al Cantiere te la vende', code: 'requisito' }, 409);
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
    // le discese dell'Adrenalina (passo 3b): la medaglia è la posizione nella classifica a tempo della pista (oro = batti il record,
    // argento secondo, bronzo terzo; nessuno davanti = oro). La classifica la passa il Worker; senza, la partita resta aperta.
    let medal = r.medal, discesa: Record<string, unknown> = {};
    if (p.minigame === 'snowboard') {
      const pista = p.opzioni?.['pista'] ?? PISTA_SNOWBOARD, cl = body['classifica'] as { pista?: unknown; righe?: unknown } | undefined;
      if (!cl || cl.pista !== pista || !Array.isArray(cl.righe)) return json({ error: 'Serve la classifica della pista', code: 'classifica', pista }, 409);
      const righe = (cl.righe as unknown[]).filter((x): x is { chi: string; ms: number } => !!x && typeof (x as { chi?: unknown }).chi === 'string' && typeof (x as { ms?: unknown }).ms === 'number');
      const arrivato = r.detail['arrivato'] === 1, posizione = arrivato ? posizioneDiscesa(righe, owner, r.detail['finale']!) : 0;
      medal = arrivato ? medagliaDaPosizione(posizione) : null;
      discesa = { pista, posizione, classificati: righe.length, seed: p.seed, opzioni: p.opzioni ?? {} };
    }
    const out = finishSolo(lot, medal, now);
    const next = registraPartita(tracciaMissioni(out.lot, eventiPartita(medal), now), p.minigame, medal, raccolta);
    this.save(next);
    return json({ minigame: p.minigame, score: r.score, medal, detail: r.detail, premio: out.premio, premiata: out.premiata, lot: next, ...discesa });
  }

  /** Diario del capitano (#87): avvistamenti, RISCUOTI di un traguardo (paga il server, una volta), titolo sotto il nome. */
  private diario(lot: LotState, act: string, body: Record<string, unknown>): Response {
    if (act === 'diario_visto') {
      const animali = idList(body['animali']), isole = idList(body['isole']);
      if (!animali || !isole) return json({ error: 'Avvistamenti non validi' }, 400);
      const out = registraVisti(lot, { animali, isole });
      if (out.lot !== lot) this.save(out.lot);
      return json({ nuovi: out.nuovi, lot: out.lot });
    }
    return json({ error: 'Non trovato' }, 404);
  }

  private act(lot: LotState, act: string, body: Record<string, unknown>, now: number): LotState | Response {
    switch (act) {
      // le decorazioni del Mercante vanno nel magazzino di casa: si posano con ARREDA come i mobili (casa_posa)
      case 'decor': {
        const d = DECOR.find((x) => x.id === body['decor']);
        return d ? compraDecor(lot, d.id) : json({ error: 'Decorazione sconosciuta' }, 400);
      }
      // la casa arredabile (#265, economy/casa.ts): compra (negozio dei mobili), posa, sposta, gira, ritira; finiture; il baule
      case 'casa_compra': return isId(body['id']) ? compraMobileDelGiorno(lot, body['id'], now) : json({ error: 'Mobile sconosciuto' }, 400);
      case 'casa_finitura': case 'casa_scegli': {
        const tipo = body['tipo'], id = body['id'], stanza = body['stanza'] === 'piano' ? 'piano' : 'terra';
        if ((tipo !== 'pavimento' && tipo !== 'carta') || !isId(id)) return json({ error: 'Finitura non valida' }, 400);
        return act === 'casa_finitura' ? compraFinituraDelGiorno(lot, tipo, id, now) : scegliFinitura(lot, tipo, id, now, stanza);
      }
      case 'casa_posa': case 'casa_sposta': {
        const id = body['id'], cell = body['cell'], muro = body['muro'], rot = body['rot'] ?? 0;
        if (!isId(id) || !isCell(cell) || (muro !== undefined && muro !== 'n' && muro !== 'o' && muro !== 'e')) return json({ error: 'Posto non valido' }, 400);
        const p: PostoMobile = muro ? { cell, muro } : { cell };
        if (act === 'casa_sposta') return spostaMobile(lot, id, p, now);
        if (typeof rot !== 'number' || !Number.isInteger(rot) || rot < 0 || rot > 3) return json({ error: 'Rotazione non valida (0-3)' }, 400);
        return posaMobile(lot, id, p, rot, now);
      }
      case 'casa_ruota': case 'casa_ritira': {
        const id = body['id'];
        if (!isId(id)) return json({ error: 'Manca il mobile' }, 400);
        return act === 'casa_ruota' ? ruotaMobile(lot, id, now) : ritiraMobile(lot, id, now);
      }
      case 'casa_svuota': {
        const stanza = body['stanza'];
        if (stanza !== 'terra' && stanza !== 'cantina' && stanza !== 'piano') return json({ error: 'Stanza non valida' }, 400);
        return svuotaStanza(lot, stanza, now);
      }
      // il mobiliere ingrandisce la casa (#386): `da` = il livello che il giocatore vede (se è cambiato nel frattempo, niente si paga due volte)
      case 'casa_amplia': return Number.isInteger(body['da']) ? ampliaCasa(lot, body['da'] as number, now) : json({ error: 'Livello della casa non valido' }, 400);
      // botteghe del Borgo (#414): il Fabbro sale di livello, il Cantiere potenzia la barca; `da` come per gli ampliamenti
      case 'bottega_migliora': {
        const b = body['bottega'], da = body['da'];
        if ((b !== 'fabbro' && b !== 'cantiere') || !Number.isInteger(da)) return json({ error: 'Bottega o livello non valido' }, 400);
        return miglioraBottega(lot, b, da as number, now);
      }
      case 'casa_baule': {
        const cell = body['cell'];
        if (cell === undefined) return ruotaBaule(lot, now);
        return isCell(cell) ? spostaBaule(lot, cell, now) : json({ error: 'Cella non valida' }, 400);
      }
      case 'hat': {
        const h = body['hat'];
        if (!isId(h) || !AVATAR.cappelli.some((x) => x.id === h)) return json({ error: 'Cappello sconosciuto' }, 400);
        return buyHat(lot, h, now);
      }
      case 'abito': {
        const a = body['abito'];
        if (!isId(a) || !AVATAR.abiti.some((x) => x.id === a)) return json({ error: 'Vestito sconosciuto' }, 400);
        return buyAbito(lot, a, now);
      }
      case 'barca': {
        const id = body['id'];
        if (!isId(id)) return json({ error: 'Colore sconosciuto' }, 400);
        return compraColoreDelGiorno(lot, id, now); // le vernici del Cantiere solo il loro giorno (#414)
      }
      default:
        return json({ error: 'Non trovato' }, 404);
    }
  }
}
