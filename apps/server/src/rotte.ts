// Le rotte /api/* del Worker in una tabella: metodo, indirizzo (testo o espressione), quanto corpo si legge e cosa si fa. Una rotta nuova
// è una riga in ROTTE. Il lavoro vero sta nei DO (Lot = l'isola della persona, Sfide = Porto, feed e classifiche): qui solo smistamento,
// controlli e piccoli JSON (budget CPU del Worker ~10 ms). Errori sempre `{ error }` in italiano, mai il dettaglio tecnico.
import { AVATAR } from '@marea/content';
import type { Look, LookSalvato, Me, PersonaVista, Rientro } from '@marea/protocol';
import type { LotState, Riepilogo } from '@marea/sim';
import { coloreBarca, validaBarca } from '@marea/sim/economy/barca.ts';
import type { Env, Persona } from './env.ts';
import { elencoPersone, entraConInvito, esistePersona, salvaLook, salvaNome } from './db.ts';
import { toFeedItem } from './feed.ts';
import type { FeedRow } from './feed.ts';
import { json } from './http.ts';
import { avvisaZona, avvisaZonaNome, conSalvato, hatId, sincIndossa, validaLook } from './look.ts';
import { collezioneConNomi, recordConNomi, segnaCollezioneDa, segnaRecordDa } from './porto_amici.ts';
import { disceseConNomi, giocaSolo } from './adrenalina.ts';

const MAX_BODY = 4096;
/** Input log dei minigiochi da solo: una Regata da 120 s sta sotto i 100 KB (7.200 righe al massimo); le Consegne durano fino a
 *  150 s col joystick che cambia quasi a ogni tick (9.000 righe ≈ 150 KB): tetto a 256 KB. */
const MAX_PLAY_BODY = 262144;
/** Input log di una spedizione nel dungeon (fino a 20 minuti, RLE): ≤ 512 KB. */
const MAX_DUNGEON_BODY = 524288;
/** Input log della partita a ondate dei Templari (fino a 60 minuti, compressi con encodeDungeon: ~1 KB al minuto col pilota, fino a ~10
 *  con un pollice nervoso): tetto a 1 MB. */
const MAX_TEMPLARI_BODY = 1048576;
export const NO_TOKEN = 'Link non valido: chiedi a Jack un invito nuovo';

/** Corpo JSON piccolo; null = rotto, 'grande' = oltre `max`. */
async function leggiCorpo(req: Request, max = MAX_BODY): Promise<Record<string, unknown> | null | 'grande'> {
  if (Number(req.headers.get('content-length') ?? 0) > max) return 'grande';
  const text = await req.text();
  if (text.length > max) return 'grande';
  if (!text.trim()) return {}; // accept/decline senza corpo
  try { const v: unknown = JSON.parse(text); return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null; } catch { return null; }
}
/** Il corpo, o la risposta d'errore già pronta. */
async function corpoDi(req: Request, max = MAX_BODY): Promise<Record<string, unknown> | Response> {
  const body = await leggiCorpo(req, max);
  if (body === 'grande') return json({ error: 'Richiesta troppo grande' }, 413);
  return body ?? json({ error: 'Richiesta non valida' }, 400);
}

/** Richiesta interna a un DO: proprietario in x-persona, ora del server (eventualmente di test) in x-now. */
function doReq(ns: DurableObjectNamespace, name: string, persona: string, now: number, path: string, body?: unknown): Promise<Response> {
  return ns.get(ns.idFromName(name)).fetch(new Request('https://do/' + path, {
    method: body === undefined ? 'GET' : 'POST', body: body === undefined ? undefined : JSON.stringify(body),
    headers: { 'x-persona': persona, 'x-now': String(now), 'content-type': 'application/json' },
  }));
}
type Chiama = (path: string, body?: unknown) => Promise<Response>;

/** Link di gruppo: senza token, con il codice dell'invito e il nome scelto → persona nuova e il suo token. */
export async function entra(req: Request, env: Env): Promise<Response> {
  const body = await leggiCorpo(req);
  if (body === 'grande' || !body) return json({ error: 'Richiesta non valida' }, 400);
  const codice = body['invito'], nome = typeof body['nome'] === 'string' ? body['nome'].replace(/[\p{C}<>]/gu, '').trim().replace(/\s+/g, ' ') : '';
  if (typeof codice !== 'string' || !/^[A-Za-z0-9_-]{4,40}$/.test(codice)) return json({ error: 'Link di invito non valido: chiedi a Jack quello giusto' }, 400);
  if (nome.length < 2 || nome.length > 16) return json({ error: 'Scrivi un nome da 2 a 16 lettere' }, 400);
  const base = nome.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'amico';
  const rnd = crypto.getRandomValues(new Uint8Array(18)), suf = crypto.getRandomValues(new Uint8Array(2)); // token e id da byte diversi
  const id = `${base}-${Array.from(suf, (b) => b.toString(16).padStart(2, '0')).join('')}`;
  const token = btoa(String.fromCharCode(...rnd)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const r = await entraConInvito(env, codice, id, nome, token);
  if (!r) return json({ error: 'Questo invito è finito o non esiste: chiedi a Jack un link nuovo' }, 403);
  return json({ token, id, nome, slot: r.slot });
}

/** Quello che una rotta ha a disposizione: la richiesta, chi è (già autenticato), l'ora del server e le chiamate ai DO. */
type Ctx = { req: Request; env: Env; url: URL; path: string; now: number; p: Persona; lotto: Chiama; sfide: Chiama };
type Fa = (c: Ctx, b: Record<string, unknown>, x: RegExpMatchArray) => Promise<Response> | Response;
/** `max` = corpo massimo (POST, di serie 4 KB); `senzaCorpo` = il corpo non si legge; `soloLocale` = solo dal server locale (test), online 403. */
type Rotta = { m: 'GET' | 'POST'; via: string | RegExp; fa: Fa; max?: number; senzaCorpo?: true; soloLocale?: true };

/** Solo questi campi del corpo (gli altri non arrivano al DO). */
const scegli = (b: Record<string, unknown>, campi: readonly string[]) => Object.fromEntries(campi.map((k) => [k, b[k]]));
/** Rotta che passa al DO del lotto l'azione `azione` col corpo intero o con solo `campi`. */
const alLotto = (azione: string, campi?: readonly string[]): Fa => (c, b) => c.lotto(azione, campi ? scegli(b, campi) : b);
const nomePulito = (v: unknown) => (typeof v === 'string' ? v.replace(/[\p{C}<>]/gu, '').trim().replace(/\s+/g, ' ') : '');

const ROTTE: readonly Rotta[] = [
  { m: 'GET', via: '/api/me', fa: async (c) => {
    const r = await c.lotto('state');
    const lotto = r.ok ? ((await r.clone().json()) as LotState) : null;
    await sincIndossa(c.env, c.p, r);
    return json({ id: c.p.id, nome: c.p.nome, look: JSON.parse(c.p.look) as LookSalvato, slot: c.p.slot ?? null, now: c.now, lotto } satisfies Me);
  } },
  // chi abita l'arcipelago: /api/persone tutti, /api/lots solo chi ha un lotto (per le visite)
  { m: 'GET', via: /^\/api\/(persone|lots)$/, fa: async (c, _b, x) => {
    const tutte = (await elencoPersone(c.env)).filter((p) => x[1] === 'persone' || p.slot !== null);
    return json(tutte.map((p) => ({ id: p.id, nome: p.nome, slot: p.slot ?? null, look: JSON.parse(p.look) as LookSalvato })) satisfies PersonaVista[]);
  } },
  { m: 'POST', via: '/api/look', fa: async (c, b) => {
    const look = validaLook(b);
    if (typeof look === 'string') return json({ error: look }, 400);
    const hat = AVATAR.cappelli[look.cappello];
    if (hat && hat.monete > 0) {
      const r = await c.lotto('state');
      const lot = r.ok ? ((await r.json()) as { posseduti?: string[] }) : null;
      if (!lot?.posseduti?.includes(hat.id)) return json({ error: `${hat.nome}: non è tuo, compralo prima (${hat.monete} monete)` }, 400);
    }
    const salvato = conSalvato(look, c.p.look);
    await salvaLook(c.env, c.p.id, salvato);
    await avvisaZona(c.env, c.p.id, salvato);
    return json({ ok: true });
  } },
  { m: 'POST', via: '/api/nome', fa: async (c, b) => {
    const nome = nomePulito(b['nome']);
    if (nome.length < 2 || nome.length > 16) return json({ error: 'Scrivi un nome da 2 a 16 lettere' }, 400);
    await salvaNome(c.env, c.p.id, nome);
    c.p.nome = nome;
    await avvisaZonaNome(c.env, c.p.id, nome);
    return json({ ok: true, nome });
  } },
  { m: 'POST', via: '/api/look/hat', fa: (c, b) => {
    const id = hatId(b['cappello']);
    return id ? c.lotto('hat', { hat: id }) : json({ error: 'Cappello sconosciuto' }, 400);
  } },
  // la tua barca: colori e nome nel look in D1 (così la Zone la manda agli amici); i colori esclusivi si comprano dal Mercante
  { m: 'POST', via: '/api/barca', fa: async (c, b) => {
    const r = await c.lotto('state');
    if (!r.ok) return r;
    const barca = validaBarca(b, (await r.json()) as Parameters<typeof validaBarca>[1]);
    if (typeof barca === 'string') return json({ error: barca }, 400);
    let base: Look | string;
    try { base = validaLook(JSON.parse(c.p.look) as Record<string, unknown>); } catch { base = 'look rotto'; }
    const salvato = conSalvato(typeof base === 'string' ? { pelle: 2, capelli: 0, coloreCapelli: 0, vestito: 0, cappello: 1 } : base, c.p.look, barca);
    await salvaLook(c.env, c.p.id, salvato);
    await avvisaZona(c.env, c.p.id, salvato);
    return json({ ok: true, barca });
  } },
  { m: 'POST', via: '/api/barca/colore', fa: (c, b) => {
    const id = b['id'];
    return typeof id === 'string' && coloreBarca(id) ? c.lotto('barca', { id }) : json({ error: 'Colore sconosciuto' }, 400);
  } },
  { m: 'GET', via: '/api/lot', fa: async (c) => sincIndossa(c.env, c.p, await c.lotto('state')) },
  { m: 'POST', via: /^\/api\/lot\/(collect|build|upgrade|decor)$/, fa: (c, b, x) => c.lotto(x[1]!, b) },
  // edifici liberi: sposta, ruota, riponi, riponi tutto, posa dal magazzino, disposizione
  { m: 'POST', via: '/api/lot/building/move', fa: alLotto('building_move', ['id', 'cell']) },
  { m: 'POST', via: '/api/lot/building/rotate', fa: alLotto('building_rotate', ['id']) },
  { m: 'POST', via: '/api/lot/building/stow', fa: alLotto('building_stow', ['id']) },
  { m: 'POST', via: '/api/lot/building/stow_all', fa: alLotto('building_stow_all', []) },
  { m: 'POST', via: '/api/lot/building/place_stored', fa: alLotto('building_place_stored', ['id', 'cell', 'rot']) },
  { m: 'POST', via: '/api/lot/building/layout', fa: alLotto('building_layout', ['placed', 'stowed']) },
  { m: 'POST', via: '/api/lot/move', fa: alLotto('building_move', ['id', 'cell']) },
  // decorazioni libere: sposta, ruota, rivendi (solo le proprie: il DO è quello della persona)
  { m: 'POST', via: /^\/api\/lot\/decor\/(move|rotate|sell)$/, fa: (c, b, x) => c.lotto('decor_' + x[1], scegli(b, ['id', 'cell'])) },
  // la casa arredabile, la pala e il retino: negozio dei mobili e ARREDA (solo la propria casa)
  { m: 'POST', via: /^\/api\/lot\/casa\/(compra|finitura|scegli|posa|sposta|ruota|ritira|baule|amplia|pala|retino|canna)$/,
    fa: (c, b, x) => c.lotto('casa_' + x[1], scegli(b, ['id', 'tipo', 'cell', 'muro', 'rot', 'da'])) },
  // botteghe del Borgo: migliora il Fabbro o la barca al Cantiere (la merce passa da /api/rpg e /api/barca/colore)
  { m: 'POST', via: '/api/lot/bottega/migliora', fa: alLotto('bottega_migliora', ['bottega', 'da']) },
  // gli insetti di Borgo Marea e i pesci: la consegna al mobiliere aggiorna anche la classifica dei collezionisti
  { m: 'POST', via: /^\/api\/lot\/insetti\/(sasso|albero|cattura|consegna)$/, fa: async (c, b, x) => {
    const r = await c.lotto('insetti_' + x[1], scegli(b, ['idx', 'k', 'id']));
    return x[1] === 'consegna' ? segnaCollezioneDa(r, c.sfide) : r;
  } },
  { m: 'POST', via: /^\/api\/lot\/pesci\/(cattura|consegna)$/, fa: async (c, b, x) => {
    const r = await c.lotto('pesci_' + x[1], scegli(b, ['k', 'id']));
    return x[1] === 'consegna' ? segnaCollezioneDa(r, c.sfide) : r;
  } },
  // minigiochi da solo (senza posta): il DO del lotto apre la partita e la premia; il punteggio vero (dal replay) va anche al tabellone
  // dei record del Porto; le discese dell'Adrenalina passano dalla classifica a tempo (adrenalina.ts)
  { m: 'POST', via: '/api/solo/start', fa: alLotto('solo_start', ['minigame', 'opzioni']) },
  { m: 'POST', via: '/api/solo/play', max: MAX_PLAY_BODY, fa: async (c, b) => segnaRecordDa(await giocaSolo(b, (q) => c.lotto('solo_play', q), c.sfide), c.sfide) },
  // Bacheca del Porto: le missioni di oggi le calcola anche il client dal lotto; qui solo RISCUOTI (il DO verifica e paga)
  { m: 'POST', via: '/api/missioni/riscuoti', fa: alLotto('missione', ['i']) },
  // Rientro: il DO del lotto risponde col riepilogo dell'assenza (null se mancavi da poco) e segna «visto»; qui si aggiungono le novità
  // non lette del feed che non sono visite (le visite stanno già nel riepilogo, come firme del libro)
  { m: 'POST', via: '/api/rientro', senzaCorpo: true, fa: async (c) => {
    let novita = 0;
    try {
      const f = await c.sfide('feed');
      if (f.ok) novita = ((await f.json()) as { rows: FeedRow[] }).rows.filter((x) => !x.letto && x.tipo !== 'visita').length;
    } catch { /* senza feed la scheda esce lo stesso */ }
    const r = await c.lotto('rientro', {});
    if (!r.ok) return r;
    const d = (await r.json()) as { riepilogo: Riepilogo | null; lot: LotState };
    return json({ riepilogo: d.riepilogo, novita, lot: d.lot, now: c.now } satisfies Rientro);
  } },
  { m: 'POST', via: '/api/presenza', senzaCorpo: true, fa: (c) => c.lotto('visto', {}) },
  // Libro degli ospiti: firmi il libro dell'isola di un amico (nome dal tuo link, emote di avatar.json); il DO del suo lotto controlla
  // «una al giorno» e risponde col suo LotState; poi una riga nel suo feed (best-effort)
  { m: 'POST', via: '/api/libro/firma', fa: async (c, b) => {
    const isola = b['isola'], emote = b['emote'];
    if (typeof isola !== 'string' || !/^[a-z0-9_-]{1,40}$/.test(isola)) return json({ error: 'Isola non valida' }, 400);
    if (typeof emote !== 'string' || !AVATAR.emote.includes(emote)) return json({ error: 'Saluto sconosciuto' }, 400);
    if (isola === c.p.id) return json({ error: 'È il tuo libro: qui firmano gli amici che passano', code: 'firma' }, 409);
    if (!(await esistePersona(c.env, isola))) return json({ error: 'Isola non trovata' }, 404);
    const r = await doReq(c.env.LOT, isola, isola, c.now, 'firma', { chi: c.p.id, nome: c.p.nome, emote });
    if (!r.ok) return r;
    const lot: unknown = await r.json();
    try { const f = await doReq(c.env.SFIDE, 'tavolo', isola, c.now, 'visita', { chi: c.p.id, emote }); await f.body?.cancel(); } catch { /* il libro è firmato lo stesso */ }
    return json(lot);
  } },
  // Diario del capitano: avvistamenti (i lotti contano solo se sono di amici veri)
  { m: 'POST', via: '/api/diario/visto', fa: async (c, b) => {
    let isole = b['isole'];
    if (Array.isArray(isole) && isole.some((i) => typeof i === 'string' && i.startsWith('lotto:'))) {
      const amici = new Set((await elencoPersone(c.env)).filter((x) => x.slot !== null && x.id !== c.p.id).map((x) => x.id));
      isole = isole.filter((i) => typeof i !== 'string' || !i.startsWith('lotto:') || amici.has(i.slice(6)));
    }
    return c.lotto('diario_visto', { animali: b['animali'], isole });
  } },
  // Mondo Sotterraneo: azioni del personaggio e spedizioni; il replay lo fa il DO del lotto, mai il Worker
  { m: 'POST', via: '/api/rpg', fa: async (c, b) => sincIndossa(c.env, c.p, await c.lotto('rpg', { azione: b['azione'] })) },
  { m: 'POST', via: '/api/dungeon/start', fa: alLotto('dungeon_start', ['dungeon', 'da']) },
  { m: 'POST', via: /^\/api\/dungeon\/(finish|save)$/, max: MAX_DUNGEON_BODY,
    fa: async (c, b, x) => sincIndossa(c.env, c.p, await c.lotto('dungeon_' + x[1], scegli(b, ['inputs', 'azioni', 'hash']))) },
  // monete e inventario di prova: solo dal server locale (gli e2e che comprano cose care)
  { m: 'POST', via: '/api/test/monete', soloLocale: true, fa: alLotto('test_monete') },
  { m: 'POST', via: '/api/test/inv', soloLocale: true, fa: alLotto('test_inv') },
  // Isola dei Templari: apre la partita a ondate (seed dal DO) e la chiude (il DO rigioca e paga le ondate superate)
  { m: 'POST', via: '/api/templari/start', fa: (c, b) => c.lotto('templari_start', { subito: b['subito'], classe: typeof b['classe'] === 'string' ? b['classe'].slice(0, 24) : undefined }) },
  { m: 'POST', via: '/api/templari/reliquia', senzaCorpo: true, fa: (c) => c.lotto('templari_reliquia', {}) },
  { m: 'POST', via: '/api/templari/finish', max: MAX_TEMPLARI_BODY, fa: alLotto('templari_finish', ['inputs', 'azioni', 'hash']) },
  // Isola dell'Adrenalina: la liberatoria firmata al cancello della funivia; classifica a tempo e fantasma del record di una pista
  { m: 'POST', via: '/api/adrenalina/liberatoria', senzaCorpo: true, fa: (c) => c.lotto('adrenalina_liberatoria', {}) },
  { m: 'GET', via: /^\/api\/adrenalina\/(discese|fantasma)$/, fa: (c, _b, x) => disceseConNomi(x[1] as 'discese' | 'fantasma', c.url.searchParams.get('pista') ?? '', c.env, c.sfide) },
  // Porto tra amici: tabellone dei record e collezionisti coi nomi; le buche della pala del Borgo (stato nel DO Sfide)
  { m: 'GET', via: '/api/record', fa: (c) => recordConNomi(c.env, c.sfide) },
  { m: 'GET', via: '/api/collezione', fa: (c) => collezioneConNomi(c.env, c.sfide) },
  { m: 'GET', via: '/api/borgo/buche', fa: (c) => c.sfide('buche') },
  { m: 'POST', via: '/api/borgo/buca', fa: (c, b) => c.sfide('buca', scegli(b, ['op', 'cell', 'dono'])) },
  // l'isola di un altro (sola lettura)
  { m: 'GET', via: /^\/api\/lot\/([a-z0-9_-]{1,40})$/, fa: async (c, _b, x) => {
    const id = x[1]!;
    if (!(await esistePersona(c.env, id))) return json({ error: 'Isola non trovata' }, 404);
    return doReq(c.env.LOT, id, id, c.now, 'state');
  } },
  // feed: righe strutturate dal DO Sfide, nomi da D1, testo composto qui (feed.ts)
  { m: 'GET', via: '/api/feed', fa: async (c) => {
    const r = await c.sfide('feed');
    if (!r.ok) return r;
    const d = (await r.json()) as { rows: FeedRow[]; nonLetti: number };
    const nomi = new Map(d.rows.length ? (await elencoPersone(c.env)).map((x) => [x.id, x.nome] as const) : []);
    const nomeDi = (id: string): string => nomi.get(id) ?? 'Qualcuno';
    return json({ items: d.rows.map((x) => toFeedItem(x, nomeDi)), nonLetti: d.nonLetti, now: c.now });
  } },
  { m: 'POST', via: '/api/feed/letto', fa: (c, b) => {
    const fino = b['fino'];
    if (fino !== undefined && fino !== null && (typeof fino !== 'number' || !Number.isFinite(fino))) return json({ error: 'Richiesta non valida' }, 400);
    return c.sfide('feed_letto', typeof fino === 'number' ? { fino } : {});
  } },
];

/** Smista una richiesta /api/* di una persona autenticata: la prima rotta di ROTTE che combacia; se no, 404. */
export async function smista(req: Request, env: Env, url: URL, now: number, p: Persona): Promise<Response> {
  const path = url.pathname;
  const lotto: Chiama = (q, b) => doReq(env.LOT, p.id, p.id, now, q, b);
  const sfide: Chiama = (q, b) => doReq(env.SFIDE, 'tavolo', p.id, now, q, b);
  for (const r of ROTTE) {
    if (r.m !== req.method) continue;
    const x = typeof r.via === 'string' ? (r.via === path ? [path] as RegExpMatchArray : null) : path.match(r.via);
    if (!x) continue;
    if (r.soloLocale && url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') return json({ error: 'Vietato' }, 403);
    let b: Record<string, unknown> = {};
    if (r.m === 'POST' && !r.senzaCorpo) {
      const c = await corpoDi(req, r.max);
      if (c instanceof Response) return c;
      b = c;
    }
    return r.fa({ req, env, url, path, now, p, lotto, sfide }, b, x);
  }
  return json({ error: 'Non trovato' }, 404);
}
