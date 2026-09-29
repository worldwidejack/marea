// Client HTTP tipizzato di MAREA (M1-isola): /api/me, /api/lot[/:id], azioni sul lotto. Token in `X-Token`.
// Errori sempre come ApiError con messaggio italiano pronto da mostrare (il server manda `{ error, manca? }`, PROTOCOL.md §6).
// Orologio: ogni risposta porta l'ora del server (`now` o `LotState.nowMs`); serverNow() la proietta con l'orologio locale
// SOLO per animare i conti alla rovescia. L'economia la decide il server.
import type { LotState, Resources } from '@marea/sim';
import type { Look } from '@marea/protocol';

export type Me = { id: string; nome: string; look: Look; lotto: LotState | null; slot?: number | null };
/** Chi abita quale slot dell'arcipelago (per le visite in sola lettura). Richiede GET /api/lots lato server. */
export type LotOwner = { slot: number; id: string; nome: string };
export type Cell = [number, number];

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
    serverNow: () => Date.now() + offset,
  };
  return api;
}
