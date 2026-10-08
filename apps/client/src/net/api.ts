// Client HTTP tipizzato di MAREA (M1-isola, F2-tavolo): /api/me, /api/lot[/:id], azioni sul lotto, /api/persone, sfide. Token in `X-Token`.
// Errori sempre come ApiError con messaggio italiano pronto da mostrare (il server manda `{ error, manca? }`, PROTOCOL.md §6).
// Orologio: ogni risposta porta l'ora del server (`now` o `LotState.nowMs`); serverNow() la proietta con l'orologio locale
// SOLO per animare i conti alla rovescia. L'economia la decide il server.
import type { Challenge, LotState, Medal, PackedInputs, Resources, Riepilogo } from '@marea/sim';
import type { BarcaLook, FeedItem, Look, LookSalvato } from '@marea/protocol';
import type { HeroState, RpgAction, RunHero, RunResult } from '@marea/sim/rpg/types.ts';
import type { DungeonAzioni, PackedDungeon } from '@marea/sim/dungeon/types.ts';

/** `look` è quello salvato in D1: anche titolo (#87) e barca (#107) se scelti. */
export type Me = { id: string; nome: string; look: LookSalvato; lotto: LotState | null; slot?: number | null };
export type { FeedItem };
/** Chi abita quale slot dell'arcipelago (per le visite in sola lettura). Richiede GET /api/lots lato server. */
export type LotOwner = { slot: number; id: string; nome: string; look?: LookSalvato };
export type Cell = [number, number];
/** Chiunque abiti l'arcipelago (GET /api/persone): serve per scegliere chi sfidare. */
export type Persona = { id: string; nome: string; slot: number | null; look: Look };
export type { Challenge, PackedInputs };
/** Risposta di POST /api/challenges/:id/play: il punteggio lo decide il replay del server. */
export type PlayResult = { score: number; medal: Medal; detail: Record<string, number>; challenge: Challenge };

/** Partita da solo aperta dal server (POST /api/solo/start): il seed lo sceglie lui. */
export type SoloStart = { minigame: string; seed: number; difficulty: number; /** Opzioni normalizzate dal server (es. { mare } della pesca). */ opzioni: Record<string, string>; lot: LotState };
/** Esito di una partita da solo (POST /api/solo/play): medaglia ricalcolata dal server, premio (zero oltre il tetto del giorno), lotto aggiornato. */
export type SoloResult = { score: number; medal: Medal; detail: Record<string, number>; premio: Resources; premiata: boolean; lot: LotState;
  /** Tabellone del Porto (#110): la partita è il migliore di oggi / di sempre tra gli amici. */ record?: { oggi: boolean; sempre: boolean } | null };

/** Tabellone dei record (#110, GET /api/record): per minigioco il migliore di oggi e di sempre tra gli amici. */
export type RecordVista = { chi: string; nome: string; score: number; medal: Medal; detail: Record<string, number>; quando: number };
export type RecordRiga = { minigame: string; nome: string; oggi: RecordVista | null; sempre: RecordVista | null };
/** Faro comune del Porto (#111, GET /api/faro): totali, livello, prossima soglia, bonus attuale, chi ha versato di più. */
export type FaroVista = {
  legno: number; pietra: number; livello: number; max: number; livelli: number[]; bonus: number;
  prossimo: { livello: number; legno: number; pietra: number; bonus: number } | null;
  classifica: { id: string; nome: string; legno: number; pietra: number }[];
};
export type FaroVersato = { faro: FaroVista; saliti: number[]; dono: { legno: number; pietra: number }; lot: LotState };

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

/** Rientro (#86, POST /api/rientro): riepilogo dell'assenza (null se mancavi da poco o è il primo ingresso), novità non lette del feed. */
export type Rientro = { riepilogo: Riepilogo | null; novita: number; lot: LotState };

export const MSG_401 = 'Link non valido, chiedi a Jack un link nuovo';
export const MSG_RETE = 'Niente connessione, riprova tra poco';

export class ApiError extends Error {
  status: number;
  manca: Resources | undefined;
  constructor(status: number, msg: string, manca?: Resources) {
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
  decor(decor: string, cell: Cell, rot: number): Promise<LotState>;
  /** Decorazioni libere (#108): sposta in una cella, ruota di 90°, rivendi (metà delle Perle). */
  decorMove(id: string, cell: Cell): Promise<LotState>;
  decorRotate(id: string): Promise<LotState>;
  decorSell(id: string): Promise<LotState>;
  /** Tutte le persone dell'arcipelago (me compreso). */
  persone(): Promise<Persona[]>;
  /** Le mie sfide: in gioco (mandate e ricevute) e chiuse degli ultimi 7 giorni, le più recenti prima. */
  challenges(): Promise<Challenge[]>;
  /** Lancia una sfida (posta in escrow, stato `gioca_sfidante`: ora tocca a me giocare). 409 con `manca` se non bastano le risorse. */
  createChallenge(to: string, stake: Resources, minigame?: string): Promise<Challenge>;
  accept(id: string): Promise<Challenge>;
  decline(id: string): Promise<Challenge>;
  /** Manda gli input della mia partita; il server la rigioca e risponde con punteggio, medaglia e sfida aggiornata. */
  play(id: string, inputs: PackedInputs): Promise<PlayResult>;
  /** Minigiochi da solo (senza posta): apre una partita col seed del server; `opzioni` = parametri della partita (es. il mare della pesca). */
  soloStart(minigame: string, opzioni?: Record<string, string>): Promise<SoloStart>;
  /** Consegna gli input della partita da solo: il server la rigioca e premia la medaglia. */
  soloPlay(inputs: PackedInputs): Promise<SoloResult>;
  // ---- Mondo Sotterraneo (CONTRACTS §15) ----
  /** Azione del personaggio (livello, perk, equip, forgia, alchimia, forziere, serra…): risponde col lotto aggiornato. */
  rpg(a: RpgAction): Promise<LotState>;
  /** `da: 'lanterna'` = riparti dalla lanterna da cui sei uscito l'ultima volta (hero.lanterne). */
  dungeonStart(dungeon: string, da?: 'ingresso' | 'lanterna'): Promise<DungeonStart>;
  /** `inputs` come array o già compressi con `encodeDungeon` (stringa, molto più leggera): il server accetta entrambi. `azioni`: dal menu, col tick. */
  dungeonFinish(inputs: PackedDungeon | string, hash: number, azioni?: DungeonAzioni): Promise<DungeonFinish>;
  /** SALVA sulla lanterna: input e azioni fin lì, il server li rigioca e tiene il bottino al sicuro anche se la scheda si chiude. */
  dungeonSave(inputs: PackedDungeon | string, hash: number, azioni?: DungeonAzioni): Promise<DungeonSave>;
  // ---- Porto (#64) ----
  /** RISCUOTI una missione compiuta della Bacheca (indice 0-2 di oggi): il server verifica, paga e risponde col lotto. */
  riscuoti(i: number): Promise<{ premio: Resources; lot: LotState }>;
  // ---- Porto tra amici (#110 #111) ----
  /** Tabellone dei record: una riga per minigioco da solo. */
  record(): Promise<RecordRiga[]>;
  faro(): Promise<FaroVista>;
  /** Versa Legno e Pietra al Faro comune (dal tuo Magazzino; mai oltre quello che manca): risponde col faro e col tuo lotto. */
  faroVersa(legno: number, pietra: number): Promise<FaroVersato>;
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
  /** RISCUOTI un traguardo compiuto: il server verifica, paga le Perle (una volta) e risponde col lotto. */
  diarioRiscuoti(id: string): Promise<{ premio: Resources; lot: LotState }>;
  /** Titolo sotto il nome (id di un traguardo riscosso; null = nessuno): lo vedono anche gli amici. */
  diarioTitolo(id: string | null): Promise<LotState>;
  // ---- M1 · Fetta 3 (CONTRACTS §13) ----
  /** Salva il look (POST /api/look). 400 in italiano se il cappello è a Perle e non è tuo. Aggiorna anche la presenza (gli altri lo vedono). */
  look(l: Look): Promise<void>;
  /** Compra un cappello a Perle, una volta (POST /api/look/hat con l'id di avatar.json). 409 con `manca` senza Perle. */
  buyHat(id: string): Promise<LotState>;
  /** La tua barca (#107): colori e nome (POST /api/barca), il server ripulisce il nome e controlla i colori esclusivi. Risponde con la barca salvata. */
  barca(b: BarcaLook): Promise<BarcaLook>;
  /** Compra un colore esclusivo della barca dal Mercante, una volta (POST /api/barca/colore). 409 con `manca` senza Perle. */
  buyColore(id: string): Promise<LotState>;
  /** Novità (sfide ricevute, accettate, esiti…), le più recenti prima; `nonLetti` è il numero per il badge. */
  feed(): Promise<{ items: FeedItem[]; nonLetti: number }>;
  /** Segna letti gli id ≤ `fino` (tutti senza `fino`). Ritorna quanti restano non letti. */
  feedRead(fino?: number): Promise<number>;
  /** Ora del server stimata (ms). Solo per la resa (timer, depositi che crescono): mai per decidere l'economia. */
  serverNow(): number;
  /** Ultimo errore (per i test e l'HUD). */
  lastError: string | null;
};

const RES_NOMI: Record<keyof Resources, string> = { legno: 'Legno', pietra: 'Pietra', perle: 'Perle' };
/** «ti mancano 20 Pietra» / «ti mancano 10 Legno e 20 Pietra»; '' se non manca niente. */
export function mancaText(m: Resources | undefined | null): string {
  if (!m) return '';
  const parts = (Object.keys(RES_NOMI) as (keyof Resources)[]).filter((k) => (m[k] ?? 0) > 0).map((k) => `${Math.ceil(m[k])} ${RES_NOMI[k]}`);
  if (!parts.length) return '';
  const last = parts.pop();
  return `ti mancano ${parts.length ? parts.join(', ') + ' e ' : ''}${last}`;
}

/** Perle che mancano, detto con garbo (#4): vicino al bottone «Compra» dell'editor e del Mercante, invece dell'errore secco. */
export function perleText(n: number): string {
  return `Ti mancano ${Math.ceil(n)} Perle: si vincono ai minigiochi e con le missioni della Bacheca, al Porto`;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isLot = (v: unknown): v is LotState => isObj(v) && typeof v['owner'] === 'string' && isObj(v['resources']) && Array.isArray(v['buildings']);
const isChallenge = (v: unknown): v is Challenge => isObj(v) && typeof v['id'] === 'string' && typeof v['from'] === 'string' && typeof v['to'] === 'string' && typeof v['state'] === 'string' && isObj(v['stake']);
const asChallenge = (d: unknown): Challenge => {
  const v = isChallenge(d) ? d : isObj(d) && isChallenge(d['challenge']) ? d['challenge'] : null;
  if (!v) throw new ApiError(500, 'Risposta del server non valida');
  return v;
};
const cid = (id: string) => `/api/challenges/${encodeURIComponent(id)}`;
const FEED_TIPI: readonly string[] = ['sfida_ricevuta', 'sfida_accettata', 'sfida_rifiutata', 'sfida_scaduta', 'sfida_chiusa', 'visita', 'record', 'faro'];
const isFaro = (v: unknown): v is FaroVista => isObj(v) && typeof v['livello'] === 'number' && typeof v['legno'] === 'number' && Array.isArray(v['classifica']);
const asFeedItem = (v: unknown): FeedItem | null => {
  if (!isObj(v) || typeof v['id'] !== 'number' || typeof v['tipo'] !== 'string' || !FEED_TIPI.includes(v['tipo']) || typeof v['testo'] !== 'string') return null;
  return {
    id: v['id'], quando: typeof v['quando'] === 'number' ? v['quando'] : 0, tipo: v['tipo'] as FeedItem['tipo'], testo: v['testo'], letto: !!v['letto'],
    ...(typeof v['sfida'] === 'string' ? { sfida: v['sfida'] } : {}), ...(typeof v['da'] === 'string' ? { da: v['da'] } : {}),
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
      const manca = isObj(d['manca']) ? (d['manca'] as Resources) : undefined;
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
    decor: (decor, cell, rot) => post('/api/lot/decor', { decor, cell, rot }),
    decorMove: (id, cell) => post('/api/lot/decor/move', { id, cell }),
    decorRotate: (id) => post('/api/lot/decor/rotate', { id }),
    decorSell: (id) => post('/api/lot/decor/sell', { id }),
    async persone() {
      const d = await call('GET', '/api/persone');
      const list = Array.isArray(d) ? d : isObj(d) && Array.isArray(d['persone']) ? d['persone'] : [];
      return (list as unknown[]).filter((x): x is Persona => isObj(x) && typeof x['id'] === 'string')
        .map((x) => ({ id: x.id, nome: String(x.nome ?? x.id), slot: typeof x.slot === 'number' ? x.slot : null, look: x.look }));
    },
    async challenges() {
      const d = await call('GET', '/api/challenges');
      const list = Array.isArray(d) ? d : isObj(d) && Array.isArray(d['challenges']) ? d['challenges'] : [];
      return (list as unknown[]).filter(isChallenge);
    },
    async createChallenge(to, stake, minigame = 'regata') {
      return asChallenge(await call('POST', '/api/challenges', { minigame, to, stake: { legno: stake.legno, pietra: stake.pietra, perle: stake.perle } }));
    },
    accept: async (id) => asChallenge(await call('POST', cid(id) + '/accept', {})),
    decline: async (id) => asChallenge(await call('POST', cid(id) + '/decline', {})),
    async play(id, inputs) {
      const d = await call('POST', cid(id) + '/play', { inputs });
      if (!isObj(d) || typeof d['score'] !== 'number') throw new ApiError(500, 'Risposta del server non valida');
      const medal = d['medal'] === 'oro' || d['medal'] === 'argento' || d['medal'] === 'bronzo' ? d['medal'] : null;
      return { score: d['score'], medal, detail: isObj(d['detail']) ? (d['detail'] as Record<string, number>) : {}, challenge: asChallenge(d['challenge']) };
    },
    async soloStart(minigame, opzioni) {
      const d = await call('POST', '/api/solo/start', opzioni ? { minigame, opzioni } : { minigame });
      if (!isObj(d) || typeof d['seed'] !== 'number') throw new ApiError(500, 'Risposta del server non valida');
      const opz: Record<string, string> = {};
      if (isObj(d['opzioni'])) for (const [k, v] of Object.entries(d['opzioni'])) if (typeof v === 'string') opz[k] = v;
      return { minigame: String(d['minigame'] ?? minigame), seed: d['seed'], difficulty: typeof d['difficulty'] === 'number' ? d['difficulty'] : 2, opzioni: opz, lot: asLot(d['lot']) };
    },
    async soloPlay(inputs) {
      const d = await call('POST', '/api/solo/play', { inputs });
      if (!isObj(d) || typeof d['score'] !== 'number' || !isObj(d['premio'])) throw new ApiError(500, 'Risposta del server non valida');
      const medal = d['medal'] === 'oro' || d['medal'] === 'argento' || d['medal'] === 'bronzo' ? d['medal'] : null;
      const rec = isObj(d['record']) ? { oggi: !!d['record']['oggi'], sempre: !!d['record']['sempre'] } : null;
      return { score: d['score'], medal, detail: isObj(d['detail']) ? (d['detail'] as Record<string, number>) : {}, premio: d['premio'] as Resources, premiata: !!d['premiata'], lot: asLot(d['lot']), record: rec };
    },
    async record() {
      const d = await call('GET', '/api/record');
      const list = isObj(d) && Array.isArray(d['voci']) ? d['voci'] : [];
      return (list as unknown[]).filter((x): x is RecordRiga => isObj(x) && typeof x['minigame'] === 'string');
    },
    async faro() {
      const d = await call('GET', '/api/faro');
      if (!isObj(d) || !isFaro(d['faro'])) throw new ApiError(500, 'Risposta del server non valida');
      return d['faro'];
    },
    async faroVersa(legno, pietra) {
      const d = await call('POST', '/api/faro/versa', { legno, pietra });
      if (!isObj(d) || !isFaro(d['faro'])) throw new ApiError(500, 'Risposta del server non valida');
      const dono = isObj(d['dono']) ? { legno: Number(d['dono']['legno'] ?? 0), pietra: Number(d['dono']['pietra'] ?? 0) } : { legno: 0, pietra: 0 };
      return { faro: d['faro'], saliti: Array.isArray(d['saliti']) ? d['saliti'].filter((x): x is number => typeof x === 'number') : [], dono, lot: asLot(d['lot']) };
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
    async riscuoti(i) {
      const d = await call('POST', '/api/missioni/riscuoti', { i });
      if (!isObj(d) || !isObj(d['premio'])) throw new ApiError(500, 'Risposta del server non valida');
      return { premio: d['premio'] as Resources, lot: asLot(d['lot']) };
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
    async diarioRiscuoti(id) {
      const d = await call('POST', '/api/diario/riscuoti', { id });
      if (!isObj(d) || !isObj(d['premio'])) throw new ApiError(500, 'Risposta del server non valida');
      return { premio: d['premio'] as Resources, lot: asLot(d['lot']) };
    },
    diarioTitolo: (id) => post('/api/diario/titolo', { id }),
    async look(l) { await call('POST', '/api/look', { pelle: l.pelle, capelli: l.capelli, coloreCapelli: l.coloreCapelli, vestito: l.vestito, cappello: l.cappello }); },
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
