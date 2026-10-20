// Client HTTP tipizzato di MAREA (M1-isola): /api/me, /api/lot[/:id], azioni sul lotto, minigiochi, feed. Token in `X-Token`.
// Errori sempre come ApiError con messaggio italiano pronto da mostrare (il server manda `{ error, manca? }`, PROTOCOL.md §6).
// Orologio: ogni risposta porta l'ora del server (`now` o `LotState.nowMs`); serverNow() la proietta con l'orologio locale
// SOLO per animare i conti alla rovescia. L'economia la decide il server.
import type { LotState, Mancanza, Medal, PackedInputs, Riepilogo } from '@marea/sim';
import type { BarcaLook, FeedItem, Look, LookSalvato } from '@marea/protocol';
import type { HeroState, RpgAction, RunHero, RunResult } from '@marea/sim/rpg/types.ts';
import type { DungeonAzioni, PackedDungeon } from '@marea/sim/dungeon/types.ts';
import type { TAzioni, TRisultato } from '@marea/sim/templari/types.ts';

/** `look` è quello salvato in D1: anche la barca, se scelta. */
export type Me = { id: string; nome: string; look: LookSalvato; lotto: LotState | null; slot?: number | null };
export type { FeedItem };
/** Chi abita quale slot dell'arcipelago (per le visite in sola lettura). Richiede GET /api/lots lato server. */
export type LotOwner = { slot: number; id: string; nome: string; look?: LookSalvato };
export type Cell = [number, number];
export type { PackedInputs };

/** Partita da solo aperta dal server (POST /api/solo/start): il seed lo sceglie lui. */
export type SoloStart = { minigame: string; seed: number; difficulty: number; /** Opzioni normalizzate dal server (es. { mare } della pesca). */ opzioni: Record<string, string>; lot: LotState };
/** Esito di una partita da solo (POST /api/solo/play): medaglia ricalcolata dal server, premio in monete (zero oltre il tetto del giorno), lotto aggiornato. */
export type SoloResult = { score: number; medal: Medal; detail: Record<string, number>; premio: number; premiata: boolean; lot: LotState;
  /** Tabellone del Porto (#110): la partita è il migliore di oggi / di sempre tra gli amici. */ record?: { oggi: boolean; sempre: boolean } | null;
  /** Discese dell'Adrenalina (3b): posto nella classifica a tempo (0 = non arrivato), quanti c'erano, se è il tuo miglior tempo e il record. */
  posizione?: number; classificati?: number; discesa?: { migliorato: boolean; record?: boolean } | null };
/** Il fantasma del record di una pista dell'Adrenalina (3b): input da rigiocare, chi (nome e look), tempo finale. */
export type Fantasma = { chi: string; nome: string; ms: number; seed: number; opzioni: Record<string, string>; inputs: PackedInputs; look: Look | null };

/** Tabellone dei record (#110, GET /api/record): per minigioco il migliore di oggi e di sempre tra gli amici. */
export type RecordVista = { chi: string; nome: string; score: number; medal: Medal; detail: Record<string, number>; quando: number };
export type RecordRiga = { minigame: string; nome: string; oggi: RecordVista | null; sempre: RecordVista | null };
/** I collezionisti (#457, GET /api/collezione): pesci e insetti consegnati al mobiliere, chi ne ha di più prima. */
export type CollezioneRiga = { id: string; nome: string; pesci: number; insetti: number };

/** Spedizione aperta dal server (POST /api/dungeon/start): seed e fotografia del personaggio. CONTRACTS §15. */
export type DungeonStart = { dungeon: string; seed: number; hero: RunHero; lot: LotState;
  /** Il personaggio all'entrata (per cambiare equipaggiamento nel dungeon) e la lanterna da cui si parte (null = ingresso). */
  stato: HeroState | null; partenza: number | null;
  /** La spedizione di prima era rimasta aperta dopo un altare: il server l'ha chiusa tenendo questo bottino. */
  recuperato: { tenuto: Record<string, number>; monete: number } | null };
/** Salvataggio all'altare (POST /api/dungeon/save): bottino al sicuro secondo il server. */
export type DungeonSave = { ok: boolean; salvato: { bottino: Record<string, number>; monete: number } | null; ticks: number };
/** Esito della spedizione ricalcolato dal server (POST /api/dungeon/finish). */
export type DungeonFinish = { result: RunResult; tenuto: Record<string, number>; monete: number; livelliSu: number; lot: LotState };

/** Isola dei Templari (docs/TEMPLARI.md): partita a ondate aperta dal server (seed) e chiusa col replay (premio delle ondate superate, tetto del giorno). */
export type TemplariStart = { seed: number; subito: boolean; classe?: string | null; lot: LotState };
export type TemplariFinish = { result: TRisultato; premio: number; pieno: number; tetto: boolean; record: boolean; lot: LotState };

/** Rientro (#86, POST /api/rientro): riepilogo dell'assenza (null se mancavi da poco o è il primo ingresso), novità non lette del feed. */
export type Rientro = { riepilogo: Riepilogo | null; novita: number; lot: LotState };

export const MSG_401 = 'Link non valido, chiedi a Jack un link nuovo';
export const MSG_RETE = 'Niente connessione, riprova tra poco';

export class ApiError extends Error {
  status: number;
  manca: Mancanza | undefined;
  constructor(status: number, msg: string, manca?: Mancanza) {
    super(msg);
    this.name = 'ApiError';
    this.status = status;
    this.manca = manca;
  }
}

export type Api = {
  /** false senza token: nessuna chiamata parte, tutte rifiutano con 401. */
  readonly enabled: boolean;
  me(): Promise<Me>;
  /** Senza id: il proprio lotto. Con id: quello di un altro, in sola lettura. */
  lot(id?: string): Promise<LotState>;
  lots(): Promise<LotOwner[]>;
  collect(building: string): Promise<LotState>;
  build(building: string, cell: Cell): Promise<LotState>;
  upgrade(building: string): Promise<LotState>;
  /** Edifici liberi (#382, #403): sposta, ruota di 90°, riponi nel magazzino, riponi tutti, posa dal magazzino, salva intera disposizione. */
  buildingMove(id: string, cell: Cell): Promise<LotState>;
  buildingRotate(id: string): Promise<LotState>;
  buildingStow(id: string): Promise<LotState>;
  buildingStowAll(): Promise<LotState>;
  buildingPlaceStored(id: string, cell: Cell, rot?: number): Promise<LotState>;
  buildingLayout(layout: { placed: { id: string; cell: Cell; rot?: number }[]; stowed?: string[] }): Promise<LotState>;
  decor(decor: string, cell: Cell, rot: number): Promise<LotState>;
  /** Decorazioni libere (#108): sposta in una cella, ruota di 90°, rivendi (metà del prezzo in monete). */
  decorMove(id: string, cell: Cell): Promise<LotState>;
  decorRotate(id: string): Promise<LotState>;
  decorSell(id: string): Promise<LotState>;
  /** La casa arredabile (#265) e la pala (#438): compra (negozio dei mobili), finitura, scegli, posa, sposta, ruota, ritira, baule, amplia, pala. */
  casa(azione: 'compra' | 'finitura' | 'scegli' | 'posa' | 'sposta' | 'ruota' | 'ritira' | 'baule' | 'amplia' | 'pala' | 'retino' | 'canna', body: { id?: string; tipo?: 'pavimento' | 'carta'; cell?: Cell; muro?: 'n' | 'o' | 'e'; rot?: number; da?: number }): Promise<LotState>;
  /** Gli insetti di Borgo Marea (#445): sasso/albero {idx} → {uscito, gia, lot}; cattura {k} → {lot, id}; consegna {id} → {lot}. */
  insetti(op: 'sasso' | 'albero' | 'cattura' | 'consegna', body: { idx?: number; k?: string; id?: string }): Promise<{ lot: LotState; uscito?: { k: string; id: string; t: number } | null; gia?: boolean; id?: string }>;
  /** I pesci (#457): cattura {k} (ombra del turno) → {lot, id}; consegna {id} al mobiliere → {lot}. */
  pesci(op: 'cattura' | 'consegna', body: { k?: string; id?: string }): Promise<{ lot: LotState; id?: string }>;
  /** Botteghe del Borgo (#414): migliora il Fabbro o la barca al Cantiere di un livello; `da` = il livello che vedi (409 se è già cambiato). */
  bottega(azione: 'migliora', body: { bottega: 'fabbro' | 'cantiere'; da: number }): Promise<LotState>;
  /** Minigiochi da solo (senza posta): apre una partita col seed del server; `opzioni` = parametri della partita (es. il mare della pesca). */
  soloStart(minigame: string, opzioni?: Record<string, string>): Promise<SoloStart>;
  /** Consegna gli input della partita da solo: il server la rigioca e premia la medaglia. */
  soloPlay(inputs: PackedInputs, discesa?: { minigame: string; pista: string }): Promise<SoloResult>;
  // ---- Mondo Sotterraneo (CONTRACTS §15) ----
  /** Azione del personaggio (livello, perk, equip, forgia, alchimia, forziere, serra…): risponde col lotto aggiornato. */
  rpg(a: RpgAction): Promise<LotState>;
  /** `da: 'lanterna'` = riparti dalla lanterna da cui sei uscito l'ultima volta (hero.lanterne). */
  dungeonStart(dungeon: string, da?: 'ingresso' | 'lanterna'): Promise<DungeonStart>;
  /** `inputs` come array o già compressi con `encodeDungeon` (stringa, molto più leggera): il server accetta entrambi. `azioni`: dal menu, col tick. */
  dungeonFinish(inputs: PackedDungeon | string, hash: number, azioni?: DungeonAzioni): Promise<DungeonFinish>;
  /** SALVA sulla lanterna: input e azioni fin lì, il server li rigioca e tiene il bottino al sicuro anche se la scheda si chiude. */
  dungeonSave(inputs: PackedDungeon | string, hash: number, azioni?: DungeonAzioni): Promise<DungeonSave>;
  // ---- Isola dei Templari ----
  /** `classe` = l'eroe del menù d'ingresso (il server lo tiene e lo rigioca). */
  templariStart(subito?: boolean, classe?: string): Promise<TemplariStart>;
  /** `inputs` compressi con `encodeDungeon` (o array RLE): il server rigioca e paga. */
  templariFinish(inputs: PackedDungeon | string, hash: number, azioni?: TAzioni): Promise<TemplariFinish>;
  /** Il calice dei Templari dallo scheletro della Tempesta (docs/TEMPLARI.md §2): nel lotto, la nebbia rossa si dirada. */
  templariReliquia(): Promise<{ lot: LotState; nuova: boolean }>;
  /** Isola dell'Adrenalina: firma la liberatoria al cancello della funivia (una volta sola, resta nel lotto). */
  adrenalinaLiberatoria(): Promise<{ lot: LotState; nuova: boolean }>;
  /** Il fantasma del record della pista (null = nessuno ha ancora fatto la discesa). */
  adrenalinaFantasma(pista: string): Promise<Fantasma | null>;
  // ---- Porto (#64) ----
  /** RISCUOTI una missione compiuta della Bacheca (indice 0-2 di oggi): il server verifica, paga e risponde col lotto. */
  riscuoti(i: number): Promise<{ premio: number; lot: LotState }>;
  // ---- Porto tra amici ----
  /** Tabellone dei record: una riga per minigioco da solo. */
  record(): Promise<RecordRiga[]>;
  /** La classifica dei collezionisti (#457): chi ha consegnato più pesci e insetti al mobiliere, tra chi ha un'isola. */
  collezione(): Promise<CollezioneRiga[]>;
  // ---- Rientro e libro degli ospiti (#86) ----
  /** All'ingresso: il server dice cosa è successo mentre eri via e segna che ci sei. */
  rientro(): Promise<Rientro>;
  /** «Ci sono» mentre giochi (ogni RIENTRO.presenzaSecondi): l'assenza si misura da quando esci. */
  presenza(): Promise<void>;
  /** Firma il libro dell'isola di `isola` (id del proprietario) con una emote: risponde col suo lotto. 409 se hai già firmato oggi. */
  firma(isola: string, emote: string): Promise<LotState>;
  // ---- Diario del capitano (#87) ----
  /** Avvistamenti (animali passati vicino, isole visitate): il server tiene solo gli id dei cataloghi, una volta. */
  diarioVisto(v: { animali?: string[]; isole?: string[] }): Promise<{ nuovi: { animali: string[]; isole: string[] }; lot: LotState }>;
  // ---- M1 · Fetta 3 (CONTRACTS §13) ----
  /** Salva il look (POST /api/look). 400 in italiano se il cappello è a pagamento e non è tuo. Aggiorna anche la presenza (gli altri lo vedono). */
  look(l: Look): Promise<void>;
  /** Cambia il nome del personaggio (POST /api/nome, #301). 400 se non è tra 2 e 16 caratteri. Aggiorna anche la presenza (gli altri lo vedono). */
  nome(n: string): Promise<{ ok: boolean; nome: string }>;
  /** Compra un cappello a pagamento, una volta (POST /api/look/hat con l'id di avatar.json). 409 con `manca` senza monete. */
  buyHat(id: string): Promise<LotState>;
  /** La tua barca (#107): colori e nome (POST /api/barca), il server ripulisce il nome e controlla i colori esclusivi. Risponde con la barca salvata. */
  barca(b: BarcaLook): Promise<BarcaLook>;
  /** Compra un colore della barca, una volta (POST /api/barca/colore): le esclusive dal Mercante, le vernici del Cantiere il giorno che sono in vetrina. 409 con `manca` senza monete. */
  buyColore(id: string): Promise<LotState>;
  /** Novità (firme al libro, record battuti…), le più recenti prima; `nonLetti` è il numero per il badge. */
  feed(): Promise<{ items: FeedItem[]; nonLetti: number }>;
  /** Segna letti gli id ≤ `fino` (tutti senza `fino`). Ritorna quanti restano non letti. */
  feedRead(fino?: number): Promise<number>;
  /** Ora del server stimata (ms). Solo per la resa (timer, depositi che crescono): mai per decidere l'economia. */
  serverNow(): number;
  /** Ultimo errore (per i test e l'HUD). */
  lastError: string | null;
};

const RES_NOMI: Record<keyof Mancanza, string> = { monete: 'monete', legno: 'Legno', pietra: 'Pietra', perle: 'Perle' };
/** «ti mancano 20 monete» (le risorse di prima solo nel codice spento: «ti mancano 10 Legno e 20 Pietra»); '' se non manca niente. */
export function mancaText(m: Mancanza | undefined | null): string {
  if (!m) return '';
  const parts = (Object.keys(RES_NOMI) as (keyof Mancanza)[]).filter((k) => (m[k] ?? 0) > 0).map((k) => `${Math.ceil(m[k] ?? 0)} ${RES_NOMI[k]}`);
  if (!parts.length) return '';
  const last = parts.pop();
  return `ti mancano ${parts.length ? parts.join(', ') + ' e ' : ''}${last}`;
}

/** Monete che mancano, detto con garbo (#4): vicino al bottone «Compra» dell'editor e del Mercante, invece dell'errore secco. */
export function moneteText(n: number): string {
  return `Ti mancano ${Math.ceil(n)} monete: si vincono ai minigiochi, ai Templari, nell'Arena e nei dungeon`;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isLot = (v: unknown): v is LotState => isObj(v) && typeof v['owner'] === 'string' && isObj(v['resources']) && Array.isArray(v['buildings']);
const FEED_TIPI: readonly string[] = ['visita', 'record'];
const asFeedItem = (v: unknown): FeedItem | null => {
  if (!isObj(v) || typeof v['id'] !== 'number' || typeof v['tipo'] !== 'string' || !FEED_TIPI.includes(v['tipo']) || typeof v['testo'] !== 'string') return null;
  return {
    id: v['id'], quando: typeof v['quando'] === 'number' ? v['quando'] : 0, tipo: v['tipo'] as FeedItem['tipo'], testo: v['testo'], letto: !!v['letto'],
    ...(typeof v['da'] === 'string' ? { da: v['da'] } : {}),
    ...(typeof v['emote'] === 'string' ? { emote: v['emote'] } : {}),
  };
};

export function createApi(o: { token: string; base?: string; timeoutMs?: number; fetchFn?: typeof fetch }): Api {
  const base = o.base ?? '';
  const doFetch = o.fetchFn ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  let offset = 0; // serverNow − Date.now()
  const clock = (serverMs: unknown) => { if (typeof serverMs === 'number' && Number.isFinite(serverMs) && serverMs > 0) offset = serverMs - Date.now(); };

  async function call(method: 'GET' | 'POST', path: string, body?: unknown): Promise<unknown> {
    if (!o.token) { api.lastError = MSG_401; throw new ApiError(401, MSG_401); }
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), o.timeoutMs ?? 10000);
    let r: Response;
    try {
      r = await doFetch(base + path, {
        method, signal: ctl.signal, cache: 'no-store',
        headers: { 'x-token': o.token, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      api.lastError = MSG_RETE;
      throw new ApiError(0, MSG_RETE);
    } finally { clearTimeout(timer); }
    let data: unknown = null;
    try { data = await r.json(); } catch { /* corpo vuoto o non JSON */ }
    if (!r.ok) {
      const d = isObj(data) ? data : {};
      const msg = r.status === 401 ? MSG_401 : typeof d['error'] === 'string' && d['error'] ? d['error'] : r.status >= 500 ? 'Il server ha un problema, riprova tra poco' : 'Richiesta non riuscita';
      const manca = isObj(d['manca']) ? (d['manca'] as Mancanza) : undefined;
      api.lastError = manca ? `${msg}: ${mancaText(manca)}` : msg;
      throw new ApiError(r.status, msg, manca);
    }
    api.lastError = null;
    if (isObj(data)) clock(data['now']);
    return data;
  }
  /** Le azioni rispondono con LotState (PROTOCOL §4); accetta anche `{ lot, now }` / `{ lotto }` se il server lo avvolge. */
  const asLot = (d: unknown): LotState => {
    const v = isLot(d) ? d : isObj(d) && isLot(d['lot']) ? d['lot'] : isObj(d) && isLot(d['lotto']) ? d['lotto'] : null;
    if (!v) throw new ApiError(500, 'Risposta del server non valida');
    if (!(isObj(d) && typeof d['now'] === 'number')) clock(v.nowMs);
    return v;
  };
  const post = async (path: string, body: unknown) => asLot(await call('POST', path, body));

  const api: Api = {
    enabled: !!o.token,
    lastError: null,
    async me() {
      const d = await call('GET', '/api/me');
      if (!isObj(d) || typeof d['id'] !== 'string') throw new ApiError(500, 'Risposta del server non valida');
      const lotto = isLot(d['lotto']) ? d['lotto'] : null;
      if (lotto && typeof d['now'] !== 'number') clock(lotto.nowMs);
      return { id: d['id'], nome: String(d['nome'] ?? ''), look: d['look'] as Look, lotto, slot: typeof d['slot'] === 'number' ? d['slot'] : null };
    },
    async lot(id) { return asLot(await call('GET', id ? `/api/lot/${encodeURIComponent(id)}` : '/api/lot')); },
    async lots() {
      const d = await call('GET', '/api/lots');
      const list = Array.isArray(d) ? d : isObj(d) && Array.isArray(d['lots']) ? d['lots'] : [];
      return (list as unknown[]).filter((x): x is LotOwner => isObj(x) && typeof x['slot'] === 'number' && typeof x['id'] === 'string')
        .map((x) => ({ slot: x.slot, id: x.id, nome: String(x.nome ?? x.id), ...(isObj(x.look) ? { look: x.look } : {}) }));
    },
    collect: (building) => post('/api/lot/collect', { building }),
    build: (building, cell) => post('/api/lot/build', { building, cell }),
    upgrade: (building) => post('/api/lot/upgrade', { building }),
    buildingMove: (id, cell) => post('/api/lot/building/move', { id, cell }),
    buildingRotate: (id) => post('/api/lot/building/rotate', { id }),
    buildingStow: (id) => post('/api/lot/building/stow', { id }),
    buildingStowAll: () => post('/api/lot/building/stow_all', {}),
    buildingPlaceStored: (id, cell, rot) => post('/api/lot/building/place_stored', { id, cell, rot }),
    buildingLayout: (layout) => post('/api/lot/building/layout', layout),
    decor: (decor, cell, rot) => post('/api/lot/decor', { decor, cell, rot }),
    decorMove: (id, cell) => post('/api/lot/decor/move', { id, cell }),
    decorRotate: (id) => post('/api/lot/decor/rotate', { id }),
    decorSell: (id) => post('/api/lot/decor/sell', { id }),
    casa: (azione, body) => post('/api/lot/casa/' + azione, body),
    insetti: (op, body) => call('POST', '/api/lot/insetti/' + op, body).then((d) => ({ ...(d as object), lot: asLot(op === 'consegna' ? d : (d as Record<string, unknown>)['lot']) })),
    pesci: (op, body) => call('POST', '/api/lot/pesci/' + op, body).then((d) => op === 'consegna' ? { lot: asLot(d) } : { id: String((d as Record<string, unknown>)['id'] ?? ''), lot: asLot((d as Record<string, unknown>)['lot']) }),
    bottega: (azione, body) => post('/api/lot/bottega/' + azione, body),
    async soloStart(minigame, opzioni) {
      const d = await call('POST', '/api/solo/start', opzioni ? { minigame, opzioni } : { minigame });
      if (!isObj(d) || typeof d['seed'] !== 'number') throw new ApiError(500, 'Risposta del server non valida');
      const opz: Record<string, string> = {};
      if (isObj(d['opzioni'])) for (const [k, v] of Object.entries(d['opzioni'])) if (typeof v === 'string') opz[k] = v;
      return { minigame: String(d['minigame'] ?? minigame), seed: d['seed'], difficulty: typeof d['difficulty'] === 'number' ? d['difficulty'] : 2, opzioni: opz, lot: asLot(d['lot']) };
    },
    async soloPlay(inputs, discesa) {
      const d = await call('POST', '/api/solo/play', discesa ? { inputs, ...discesa } : { inputs });
      if (!isObj(d) || typeof d['score'] !== 'number' || typeof d['premio'] !== 'number') throw new ApiError(500, 'Risposta del server non valida');
      const medal = d['medal'] === 'oro' || d['medal'] === 'argento' || d['medal'] === 'bronzo' ? d['medal'] : null;
      const rec = isObj(d['record']) ? { oggi: !!d['record']['oggi'], sempre: !!d['record']['sempre'] } : null;
      const dis = isObj(d['discesa']) ? { migliorato: !!d['discesa']['migliorato'], record: !!d['discesa']['record'] } : null;
      return { score: d['score'], medal, detail: isObj(d['detail']) ? (d['detail'] as Record<string, number>) : {}, premio: d['premio'], premiata: !!d['premiata'], lot: asLot(d['lot']), record: rec,
        ...(typeof d['posizione'] === 'number' ? { posizione: d['posizione'], classificati: typeof d['classificati'] === 'number' ? d['classificati'] : 0, discesa: dis } : {}) };
    },
    async record() {
      const d = await call('GET', '/api/record');
      const list = isObj(d) && Array.isArray(d['voci']) ? d['voci'] : [];
      return (list as unknown[]).filter((x): x is RecordRiga => isObj(x) && typeof x['minigame'] === 'string');
    },
    async collezione() {
      const d = await call('GET', '/api/collezione');
      const list = isObj(d) && Array.isArray(d['righe']) ? d['righe'] : [];
      return (list as unknown[]).filter((x): x is CollezioneRiga => isObj(x) && typeof x['id'] === 'string' && typeof x['pesci'] === 'number' && typeof x['insetti'] === 'number');
    },
    async rpg(a) { return asLot(await call('POST', '/api/rpg', { azione: a })); },
    async dungeonStart(dungeon, da) {
      const d = await call('POST', '/api/dungeon/start', da === 'lanterna' ? { dungeon, da } : { dungeon });
      if (!isObj(d) || typeof d['seed'] !== 'number' || !isObj(d['hero'])) throw new ApiError(500, 'Risposta del server non valida');
      const rec = isObj(d['recuperato']) ? d['recuperato'] : null;
      const recuperato = rec ? { tenuto: isObj(rec['tenuto']) ? (rec['tenuto'] as Record<string, number>) : {}, monete: typeof rec['monete'] === 'number' ? rec['monete'] : 0 } : null;
      return {
        dungeon: String(d['dungeon'] ?? dungeon), seed: d['seed'], hero: d['hero'] as RunHero, lot: asLot(d['lot']), recuperato,
        stato: isObj(d['stato']) ? (d['stato'] as HeroState) : null, partenza: typeof d['partenza'] === 'number' ? d['partenza'] : null,
      };
    },
    async dungeonFinish(inputs, hash, azioni) {
      const d = await call('POST', '/api/dungeon/finish', { inputs, hash, azioni: azioni ?? [] });
      if (!isObj(d) || !isObj(d['result'])) throw new ApiError(500, 'Risposta del server non valida');
      return {
        result: d['result'] as RunResult, tenuto: isObj(d['tenuto']) ? (d['tenuto'] as Record<string, number>) : {},
        monete: typeof d['monete'] === 'number' ? d['monete'] : 0, livelliSu: typeof d['livelliSu'] === 'number' ? d['livelliSu'] : 0, lot: asLot(d['lot']),
      };
    },
    async dungeonSave(inputs, hash, azioni) {
      const d = await call('POST', '/api/dungeon/save', { inputs, hash, azioni: azioni ?? [] });
      if (!isObj(d)) throw new ApiError(500, 'Risposta del server non valida');
      const sv = isObj(d['salvato']) ? d['salvato'] : null;
      return { ok: !!d['ok'], salvato: sv ? { bottino: isObj(sv['bottino']) ? (sv['bottino'] as Record<string, number>) : {}, monete: typeof sv['monete'] === 'number' ? sv['monete'] : 0 } : null, ticks: typeof d['ticks'] === 'number' ? d['ticks'] : 0 };
    },
    async templariStart(subito, classe) {
      const d = await call('POST', '/api/templari/start', { ...(subito ? { subito: true } : {}), ...(classe ? { classe } : {}) });
      if (!isObj(d) || typeof d['seed'] !== 'number') throw new ApiError(500, 'Risposta del server non valida');
      return { seed: d['seed'], subito: !!d['subito'], classe: typeof d['classe'] === 'string' ? d['classe'] : null, lot: asLot(d['lot']) };
    },
    async templariReliquia() {
      const d = await call('POST', '/api/templari/reliquia', {});
      if (!isObj(d)) throw new ApiError(500, 'Risposta del server non valida');
      return { lot: asLot(d['lot']), nuova: d['nuova'] === true };
    },
    async adrenalinaFantasma(pista) {
      const d = await call('GET', '/api/adrenalina/fantasma?pista=' + encodeURIComponent(pista));
      const f = isObj(d) && isObj(d['fantasma']) ? d['fantasma'] : null;
      if (!f || typeof f['chi'] !== 'string' || typeof f['ms'] !== 'number' || !Array.isArray(f['inputs'])) return null;
      return { chi: f['chi'], nome: typeof f['nome'] === 'string' ? f['nome'] : 'Qualcuno', ms: f['ms'], seed: Number(f['seed']) || 0,
        opzioni: isObj(f['opzioni']) ? (f['opzioni'] as Record<string, string>) : {}, inputs: f['inputs'] as PackedInputs, look: isObj(f['look']) ? (f['look'] as unknown as Look) : null };
    },
    async adrenalinaLiberatoria() {
      const d = await call('POST', '/api/adrenalina/liberatoria', {});
      if (!isObj(d)) throw new ApiError(500, 'Risposta del server non valida');
      return { lot: asLot(d['lot']), nuova: d['nuova'] === true };
    },
    async templariFinish(inputs, hash, azioni) {
      const d = await call('POST', '/api/templari/finish', { inputs, hash, azioni: azioni ?? [] });
      if (!isObj(d) || !isObj(d['result'])) throw new ApiError(500, 'Risposta del server non valida');
      const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
      return { result: d['result'] as TRisultato, premio: n(d['premio']), pieno: n(d['pieno']), tetto: !!d['tetto'], record: !!d['record'], lot: asLot(d['lot']) };
    },
    async riscuoti(i) {
      const d = await call('POST', '/api/missioni/riscuoti', { i });
      if (!isObj(d) || typeof d['premio'] !== 'number') throw new ApiError(500, 'Risposta del server non valida');
      return { premio: d['premio'], lot: asLot(d['lot']) };
    },
    async rientro() {
      const d = await call('POST', '/api/rientro', {});
      if (!isObj(d)) throw new ApiError(500, 'Risposta del server non valida');
      return { riepilogo: isObj(d['riepilogo']) ? (d['riepilogo'] as Riepilogo) : null, novita: typeof d['novita'] === 'number' ? d['novita'] : 0, lot: asLot(d['lot']) };
    },
    async presenza() { await call('POST', '/api/presenza', {}); },
    firma: (isola, emote) => post('/api/libro/firma', { isola, emote }),
    async diarioVisto(v) {
      const d = await call('POST', '/api/diario/visto', v);
      const n = isObj(d) && isObj(d['nuovi']) ? d['nuovi'] : {};
      const ids = (x: unknown) => (Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string') : []);
      return { nuovi: { animali: ids(n['animali']), isole: ids(n['isole']) }, lot: asLot(d) };
    },
    async look(l) { await call('POST', '/api/look', { pelle: l.pelle, capelli: l.capelli, coloreCapelli: l.coloreCapelli, vestito: l.vestito, cappello: l.cappello }); },
    async nome(n) {
      const d = await call('POST', '/api/nome', { nome: n });
      if (!isObj(d) || typeof d['nome'] !== 'string') throw new ApiError(500, 'Risposta del server non valida');
      return { ok: true, nome: d['nome'] as string };
    },
    buyHat: (id) => post('/api/look/hat', { cappello: id }),
    async barca(b) {
      const d = await call('POST', '/api/barca', { scafo: b.scafo, vela: b.vela, nome: b.nome });
      if (!isObj(d) || !isObj(d['barca'])) throw new ApiError(500, 'Risposta del server non valida');
      return d['barca'] as BarcaLook;
    },
    buyColore: (id) => post('/api/barca/colore', { id }),
    async feed() {
      const d = await call('GET', '/api/feed');
      const list = Array.isArray(d) ? d : isObj(d) && Array.isArray(d['items']) ? d['items'] : [];
      const items = (list as unknown[]).map(asFeedItem).filter((x): x is FeedItem => !!x);
      const nonLetti = isObj(d) && typeof d['nonLetti'] === 'number' ? d['nonLetti'] : items.filter((i) => !i.letto).length;
      return { items, nonLetti };
    },
    async feedRead(fino) {
      const d = await call('POST', '/api/feed/letto', fino === undefined ? {} : { fino });
      return isObj(d) && typeof d['nonLetti'] === 'number' ? d['nonLetti'] : 0;
    },
    serverNow: () => Date.now() + offset,
  };
  return api;
}
