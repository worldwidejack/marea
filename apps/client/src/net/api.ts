// Client HTTP tipizzato di MAREA (M1-isola, F2-tavolo): /api/me, /api/lot[/:id], azioni sul lotto, /api/persone, sfide. Token in `X-Token`.
// Errori sempre come ApiError con messaggio italiano pronto da mostrare (il server manda `{ error, manca? }`, PROTOCOL.md §6).
// Orologio: ogni risposta porta l'ora del server (`now` o `LotState.nowMs`); serverNow() la proietta con l'orologio locale
// SOLO per animare i conti alla rovescia. L'economia la decide il server.
import type { Challenge, LotState, Medal, PackedInputs, Resources } from '@marea/sim';
import type { FeedItem, Look } from '@marea/protocol';

export type Me = { id: string; nome: string; look: Look; lotto: LotState | null; slot?: number | null };
export type { FeedItem };
/** Chi abita quale slot dell'arcipelago (per le visite in sola lettura). Richiede GET /api/lots lato server. */
export type LotOwner = { slot: number; id: string; nome: string };
export type Cell = [number, number];
/** Chiunque abiti l'arcipelago (GET /api/persone): serve per scegliere chi sfidare. */
export type Persona = { id: string; nome: string; slot: number | null; look: Look };
export type { Challenge, PackedInputs };
/** Risposta di POST /api/challenges/:id/play: il punteggio lo decide il replay del server. */
export type PlayResult = { score: number; medal: Medal; detail: Record<string, number>; challenge: Challenge };

/** Partita da solo aperta dal server (POST /api/solo/start): il seed lo sceglie lui. */
export type SoloStart = { minigame: string; seed: number; difficulty: number; lot: LotState };
/** Esito di una partita da solo (POST /api/solo/play): medaglia ricalcolata dal server, premio (zero oltre il tetto del giorno), lotto aggiornato. */
export type SoloResult = { score: number; medal: Medal; detail: Record<string, number>; premio: Resources; premiata: boolean; lot: LotState };

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
  /** Minigiochi da solo (senza posta): apre una partita col seed del server. */
  soloStart(minigame: string): Promise<SoloStart>;
  /** Consegna gli input della partita da solo: il server la rigioca e premia la medaglia. */
  soloPlay(inputs: PackedInputs): Promise<SoloResult>;
  // ---- M1 · Fetta 3 (CONTRACTS §13) ----
  /** Salva il look (POST /api/look). 400 in italiano se il cappello è a Perle e non è tuo. Aggiorna anche la presenza (gli altri lo vedono). */
  look(l: Look): Promise<void>;
  /** Compra un cappello a Perle, una volta (POST /api/look/hat con l'id di avatar.json). 409 con `manca` senza Perle. */
  buyHat(id: string): Promise<LotState>;
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

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isLot = (v: unknown): v is LotState => isObj(v) && typeof v['owner'] === 'string' && isObj(v['resources']) && Array.isArray(v['buildings']);
const isChallenge = (v: unknown): v is Challenge => isObj(v) && typeof v['id'] === 'string' && typeof v['from'] === 'string' && typeof v['to'] === 'string' && typeof v['state'] === 'string' && isObj(v['stake']);
const asChallenge = (d: unknown): Challenge => {
  const v = isChallenge(d) ? d : isObj(d) && isChallenge(d['challenge']) ? d['challenge'] : null;
  if (!v) throw new ApiError(500, 'Risposta del server non valida');
  return v;
};
const cid = (id: string) => `/api/challenges/${encodeURIComponent(id)}`;
const FEED_TIPI: readonly string[] = ['sfida_ricevuta', 'sfida_accettata', 'sfida_rifiutata', 'sfida_scaduta', 'sfida_chiusa'];
const asFeedItem = (v: unknown): FeedItem | null => {
  if (!isObj(v) || typeof v['id'] !== 'number' || typeof v['tipo'] !== 'string' || !FEED_TIPI.includes(v['tipo']) || typeof v['testo'] !== 'string') return null;
  return {
    id: v['id'], quando: typeof v['quando'] === 'number' ? v['quando'] : 0, tipo: v['tipo'] as FeedItem['tipo'], testo: v['testo'], letto: !!v['letto'],
    ...(typeof v['sfida'] === 'string' ? { sfida: v['sfida'] } : {}), ...(typeof v['da'] === 'string' ? { da: v['da'] } : {}),
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
      return (list as unknown[]).filter((x): x is LotOwner => isObj(x) && typeof x['slot'] === 'number' && typeof x['id'] === 'string').map((x) => ({ slot: x.slot, id: x.id, nome: String(x.nome ?? x.id) }));
    },
    collect: (building) => post('/api/lot/collect', { building }),
    build: (building, cell) => post('/api/lot/build', { building, cell }),
    upgrade: (building) => post('/api/lot/upgrade', { building }),
    decor: (decor, cell, rot) => post('/api/lot/decor', { decor, cell, rot }),
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
    async soloStart(minigame) {
      const d = await call('POST', '/api/solo/start', { minigame });
      if (!isObj(d) || typeof d['seed'] !== 'number') throw new ApiError(500, 'Risposta del server non valida');
      return { minigame: String(d['minigame'] ?? minigame), seed: d['seed'], difficulty: typeof d['difficulty'] === 'number' ? d['difficulty'] : 2, lot: asLot(d['lot']) };
    },
    async soloPlay(inputs) {
      const d = await call('POST', '/api/solo/play', { inputs });
      if (!isObj(d) || typeof d['score'] !== 'number' || !isObj(d['premio'])) throw new ApiError(500, 'Risposta del server non valida');
      const medal = d['medal'] === 'oro' || d['medal'] === 'argento' || d['medal'] === 'bronzo' ? d['medal'] : null;
      return { score: d['score'], medal, detail: isObj(d['detail']) ? (d['detail'] as Record<string, number>) : {}, premio: d['premio'] as Resources, premiata: !!d['premiata'], lot: asLot(d['lot']) };
    },
    async look(l) { await call('POST', '/api/look', { pelle: l.pelle, capelli: l.capelli, coloreCapelli: l.coloreCapelli, vestito: l.vestito, cappello: l.cappello }); },
    buyHat: (id) => post('/api/look/hat', { cappello: id }),
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
