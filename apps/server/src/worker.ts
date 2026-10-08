// MAREA Worker: /api/* e /ws/* qui, tutto il resto lo servono gli asset (client). Budget CPU ~10 ms: solo routing, auth e piccoli JSON;
// il lavoro vero sta nei DO (Zone = presenza, Lot = isola). Errori sempre `{ error }` in italiano, mai il dettaglio tecnico.
import { AVATAR } from '@marea/content';
import type { Look, LookSalvato } from '@marea/protocol';
import { barcaDi, coloreBarca, diSerie, validaBarca } from '@marea/sim/economy/barca.ts';
import type { BarcaLook } from '@marea/sim/economy/barca.ts';
import type { Env } from './env.ts';
import { autentica } from './auth.ts';
import { nowFor } from './clock.ts';
import { elencoPersone, entraConInvito, esistePersona, salvaLook, segnaAccesso } from './db.ts';
import { toFeedItem } from './feed.ts';
import type { FeedRow } from './feed.ts';
import { rottePortoAmici, segnaRecordDa } from './porto_amici.ts';
export { Zone } from './do/Zone.ts';
export { Lot } from './do/Lot.ts';
export { Sfide } from './do/Sfide.ts';
export { Spedizioni } from './do/Spedizioni.ts';

const MAX_BODY = 4096;
/** Input log dei minigiochi da solo: una Regata da 120 s sta sotto i 100 KB (7.200 righe al massimo); le Consegne durano fino a
 *  150 s col joystick che cambia quasi a ogni tick (9.000 righe ≈ 150 KB): tetto a 256 KB. */
const MAX_PLAY_BODY = 262144;
/** Input log di una spedizione nel dungeon (fino a 20 minuti, RLE): CONTRACTS §15, ≤ 512 KB. */
const MAX_DUNGEON_BODY = 524288;
/** Input log della partita a ondate dei Templari (fino a 60 minuti, compressi con encodeDungeon: ~1 KB al minuto col pilota, fino a ~10
 *  con un pollice nervoso): tetto a 1 MB. */
const MAX_TEMPLARI_BODY = 1048576;
const NO_TOKEN = 'Link non valido: chiedi a Jack un invito nuovo';
const json = (dati: unknown, status = 200): Response =>
  new Response(JSON.stringify(dati), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

async function buildId(env: Env, url: URL): Promise<string> {
  try {
    const r = await env.ASSETS.fetch(new Request(new URL('/version.json', url.origin)));
    if (r.ok) return ((await r.json()) as { build?: string }).build ?? 'sconosciuta';
  } catch { /* nessun asset */ }
  return 'sconosciuta';
}

/** Corpo JSON piccolo; null = rotto, 'grande' = oltre `max`. */
async function leggiCorpo(req: Request, max = MAX_BODY): Promise<Record<string, unknown> | null | 'grande'> {
  if (Number(req.headers.get('content-length') ?? 0) > max) return 'grande';
  const text = await req.text();
  if (text.length > max) return 'grande';
  if (!text.trim()) return {}; // accept/decline senza corpo
  try { const v: unknown = JSON.parse(text); return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null; } catch { return null; }
}

/** Look valido: indici interi dentro gli array di avatar.json. Ritorna il Look pulito o un errore in italiano. */
export function validaLook(v: Record<string, unknown>): Look | string {
  const campi: [keyof Look, number][] = [
    ['pelle', AVATAR.pelle.length], ['capelli', AVATAR.capelli.length], ['coloreCapelli', AVATAR.coloriCapelli.length],
    ['vestito', AVATAR.vestiti.length], ['cappello', AVATAR.cappelli.length],
  ];
  const out = {} as Look;
  for (const [k, n] of campi) {
    const x = v[k];
    if (typeof x !== 'number' || !Number.isInteger(x) || x < 0 || x >= n) return `Scelta non valida: ${k}`;
    out[k] = x;
  }
  return out;
}

/** WebSocket rifiutato con un messaggio leggibile dal client (`error token`), invece di un 401 che il browser non mostra. */
function wsRifiuta(code: 'token' | 'interno', msg: string): Response {
  const pair = new WebSocketPair();
  const [client, server] = [pair[0], pair[1]];
  server.accept();
  server.send(JSON.stringify({ t: 'error', code, msg, now: Date.now() }));
  server.close(1008, code);
  return new Response(null, { status: 101, webSocket: client });
}

/** Richiesta interna a un DO: proprietario in x-persona, ora del server (eventualmente di test) in x-now. */
function doReq(ns: DurableObjectNamespace, name: string, persona: string, now: number, path: string, body?: unknown): Promise<Response> {
  return ns.get(ns.idFromName(name)).fetch(new Request('https://do/' + path, {
    method: body === undefined ? 'GET' : 'POST', body: body === undefined ? undefined : JSON.stringify(body),
    headers: { 'x-persona': persona, 'x-now': String(now), 'content-type': 'application/json' },
  }));
}
const lotReq = (env: Env, owner: string, now: number, path: string, body?: unknown) => doReq(env.LOT, owner, owner, now, path, body);
const sfideReq = (env: Env, me: string, now: number, path: string, body?: unknown) => doReq(env.SFIDE, 'tavolo', me, now, path, body);
/** Look nuovo alla zona `porto` (i socket vivi di quella persona lo mandano nel prossimo snap), col titolo del diario se c'è (#87). Best-effort: se fallisce, pazienza. */
async function avvisaZona(env: Env, persona: string, look: LookSalvato): Promise<void> {
  try {
    const r = await env.ZONE.get(env.ZONE.idFromName('porto')).fetch('https://zone/look', {
      method: 'POST', headers: { 'x-persona': persona, 'content-type': 'application/json' }, body: JSON.stringify(look),
    });
    await r.body?.cancel();
  } catch { /* la zona si aggiorna alla prossima connessione */ }
}
/** Il look salvato in D1 (JSON) col titolo del diario sostituito: `titolo` null lo toglie (#87). La barca (#107) resta quella salvata,
 *  o quella passata (`barca`; la barca di serie non si scrive). */
function conTitolo(look: Look, salvato: string, titolo?: string | null, barca?: BarcaLook): LookSalvato {
  let old: Record<string, unknown> = {};
  try { const v: unknown = JSON.parse(salvato); if (v && typeof v === 'object') old = v as Record<string, unknown>; } catch { /* look rotto */ }
  const t: unknown = titolo === undefined ? old['titolo'] : titolo, b = barca ?? barcaDi(old);
  return { ...look, ...(typeof t === 'string' && t ? { titolo: t } : {}), ...(diSerie(b) ? {} : { barca: b }) };
}
/** Quanti altri hanno un'isola (per i traguardi «tutti gli amici», #87) e i loro id. */
async function amiciConIsola(env: Env, me: string): Promise<string[]> {
  return (await elencoPersone(env)).filter((x) => x.slot !== null && x.id !== me).map((x) => x.id);
}
/** Id del cappello da indice (come in Look) o da id. */
function hatId(v: unknown): string | null {
  if (typeof v === 'number' && Number.isInteger(v)) return AVATAR.cappelli[v]?.id ?? null;
  return typeof v === 'string' && AVATAR.cappelli.some((h) => h.id === v) ? v : null;
}

/** Manifest dell'app installabile. `t` finisce solo nello start_url (come nel link personale), mai nei log. */
function manifesto(t: string): Response {
  const token = /^[A-Za-z0-9_-]{8,128}$/.test(t) ? t : '';
  const body = {
    name: 'MAREA', short_name: 'MAREA', lang: 'it',
    description: "L'arcipelago con gli amici",
    start_url: token ? `/?t=${token}` : '/', scope: '/', id: '/',
    display: 'fullscreen', orientation: 'any',
    background_color: '#163F73', theme_color: '#163F73',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
  return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/manifest+json; charset=utf-8', 'cache-control': 'no-store' } });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;
    try {
      const now = nowFor(req, env);
      if (path === '/api/ping') return json({ ok: true, build: await buildId(env, url), now });

      const ws = path.match(/^\/ws\/zone\/([a-z0-9_:-]{1,40})$/);
      if (ws) {
        if (req.headers.get('upgrade') !== 'websocket') return json({ error: 'Serve un WebSocket' }, 426);
        const p = await autentica(req, env);
        if (!p) return wsRifiuta('token', NO_TOKEN);
        await segnaAccesso(env, p.id);
        const zone = ws[1] ?? 'porto';
        const stub = env.ZONE.get(env.ZONE.idFromName(zone));
        const target = new URL(req.url);
        target.searchParams.set('id', p.id); target.searchParams.set('nome', p.nome); target.searchParams.set('look', p.look); target.searchParams.delete('t');
        return stub.fetch(new Request(target.toString(), req));
      }
      // dungeon insieme (#118): squadra all'ingresso e spedizione in tempo reale, tutte nel DO Spedizioni
      const sq = path.match(/^\/ws\/squadra\/([a-z0-9_-]{1,40})$/);
      if (sq) {
        if (req.headers.get('upgrade') !== 'websocket') return json({ error: 'Serve un WebSocket' }, 426);
        const p = await autentica(req, env);
        if (!p) return wsRifiuta('token', NO_TOKEN);
        const target = new URL(req.url);
        target.searchParams.set('id', p.id); target.searchParams.set('nome', p.nome); target.searchParams.set('look', p.look); target.searchParams.set('dungeon', sq[1]!); target.searchParams.delete('t');
        return env.SPEDIZIONI.get(env.SPEDIZIONI.idFromName('spedizioni')).fetch(new Request(target.toString(), req));
      }

      // app installabile (PWA): il manifest porta dentro il link personale, così l'icona sul telefono entra come sé
      if (path === '/manifest.webmanifest') return manifesto(url.searchParams.get('t') ?? '');

      if (!path.startsWith('/api/')) {
        if (path.startsWith('/ws/')) return json({ error: 'Non trovato' }, 404);
        return env.ASSETS.fetch(req);
      }

      // link di gruppo: senza token, con il codice dell'invito e il nome scelto → persona nuova e il suo token
      if (path === '/api/entra' && req.method === 'POST') {
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

      const p = await autentica(req, env);
      if (!p) return json({ error: NO_TOKEN }, 401);
      const corpo = async (max = MAX_BODY): Promise<Record<string, unknown> | Response> => {
        const body = await leggiCorpo(req, max);
        if (body === 'grande') return json({ error: 'Richiesta troppo grande' }, 413);
        return body ?? json({ error: 'Richiesta non valida' }, 400);
      };

      if (path === '/api/me' && req.method === 'GET') {
        const r = await lotReq(env, p.id, now, 'state');
        const lotto: unknown = r.ok ? await r.json() : null;
        return json({ id: p.id, nome: p.nome, look: JSON.parse(p.look) as unknown, slot: p.slot ?? null, now, lotto });
      }
      // chi abita l'arcipelago: /api/persone tutti (per scegliere chi sfidare), /api/lots solo chi ha un lotto (per le visite)
      if ((path === '/api/persone' || path === '/api/lots') && req.method === 'GET') {
        const tutte = (await elencoPersone(env)).filter((x) => path === '/api/persone' || x.slot !== null);
        return json(tutte.map((x) => ({ id: x.id, nome: x.nome, slot: x.slot ?? null, look: JSON.parse(x.look) as unknown })));
      }
      if (path === '/api/look' && req.method === 'POST') {
        const body = await corpo();
        if (body instanceof Response) return body;
        const look = validaLook(body);
        if (typeof look === 'string') return json({ error: look }, 400);
        const hat = AVATAR.cappelli[look.cappello];
        if (hat && hat.perle > 0) {
          const r = await lotReq(env, p.id, now, 'state');
          const lot = r.ok ? ((await r.json()) as { posseduti?: string[] }) : null;
          if (!lot?.posseduti?.includes(hat.id)) return json({ error: `${hat.nome}: non è tuo, compralo prima (${hat.perle} Perle)` }, 400);
        }
        const salvato = conTitolo(look, p.look); // il titolo del diario (#87) resta quello scelto: l'editor non lo conosce
        await salvaLook(env, p.id, salvato);
        await avvisaZona(env, p.id, salvato);
        return json({ ok: true });
      }
      if (path === '/api/look/hat' && req.method === 'POST') {
        const body = await corpo();
        if (body instanceof Response) return body;
        const id = hatId(body['cappello']);
        if (!id) return json({ error: 'Cappello sconosciuto' }, 400);
        return lotReq(env, p.id, now, 'hat', { hat: id });
      }
      // La tua barca (#107): colori e nome nel look in D1 (così la Zone la manda agli amici); i colori esclusivi si comprano dal Mercante
      if (path === '/api/barca' && req.method === 'POST') {
        const body = await corpo();
        if (body instanceof Response) return body;
        const r = await lotReq(env, p.id, now, 'state');
        if (!r.ok) return r;
        const barca = validaBarca(body, (await r.json()) as Parameters<typeof validaBarca>[1]);
        if (typeof barca === 'string') return json({ error: barca }, 400);
        let base: Look | string;
        try { base = validaLook(JSON.parse(p.look) as Record<string, unknown>); } catch { base = 'look rotto'; }
        const salvato = conTitolo(typeof base === 'string' ? { pelle: 2, capelli: 0, coloreCapelli: 0, vestito: 0, cappello: 1 } : base, p.look, undefined, barca);
        await salvaLook(env, p.id, salvato);
        await avvisaZona(env, p.id, salvato);
        return json({ ok: true, barca });
      }
      if (path === '/api/barca/colore' && req.method === 'POST') {
        const body = await corpo();
        if (body instanceof Response) return body;
        const id = body['id'];
        if (typeof id !== 'string' || !coloreBarca(id)) return json({ error: 'Colore sconosciuto' }, 400);
        return lotReq(env, p.id, now, 'barca', { id });
      }
      if (path === '/api/lot' && req.method === 'GET') return lotReq(env, p.id, now, 'state');
      const azione = path.match(/^\/api\/lot\/(collect|build|upgrade|decor)$/);
      if (azione && req.method === 'POST') {
        const body = await corpo();
        if (body instanceof Response) return body;
        return lotReq(env, p.id, now, azione[1] ?? '', body);
      }
      // decorazioni libere (#108): sposta, ruota, rivendi (solo le proprie: il DO è quello della persona)
      const dec = path.match(/^\/api\/lot\/decor\/(move|rotate|sell)$/);
      if (dec && req.method === 'POST') {
        const body = await corpo();
        if (body instanceof Response) return body;
        return lotReq(env, p.id, now, 'decor_' + (dec[1] ?? ''), { id: body['id'], cell: body['cell'] });
      }
      // minigiochi da solo (senza posta): il DO del lotto apre la partita e la premia
      if (path === '/api/solo/start' && req.method === 'POST') {
        const body = await corpo();
        if (body instanceof Response) return body;
        return lotReq(env, p.id, now, 'solo_start', { minigame: body['minigame'], opzioni: body['opzioni'] });
      }
      if (path === '/api/solo/play' && req.method === 'POST') {
        const body = await corpo(MAX_PLAY_BODY);
        if (body instanceof Response) return body;
        // il punteggio vero (dal replay) va anche al tabellone dei record del Porto (#110)
        return segnaRecordDa(await lotReq(env, p.id, now, 'solo_play', { inputs: body['inputs'] }), (q, b) => sfideReq(env, p.id, now, q, b));
      }
      // Bacheca del Porto (#64): le missioni di oggi le calcola anche il client dal lotto; qui solo RISCUOTI (il DO verifica e paga)
      if (path === '/api/missioni/riscuoti' && req.method === 'POST') {
        const body = await corpo();
        if (body instanceof Response) return body;
        return lotReq(env, p.id, now, 'missione', { i: body['i'] });
      }
      // Rientro (#86): all'ingresso il DO del lotto risponde col riepilogo dell'assenza (null se mancavi da poco) e segna «visto»; qui si
      // aggiungono le novità non lette del feed che non sono visite (le visite stanno già nel riepilogo, come firme del libro)
      // e i momenti delle salite del Faro comune (#111), che il lotto impara qui se se li era persi
      if (path === '/api/rientro' && req.method === 'POST') {
        let novita = 0, faro: number[] | undefined;
        try {
          const f = await sfideReq(env, p.id, now, 'feed');
          if (f.ok) {
            const fd = (await f.json()) as { rows: FeedRow[]; faroLivelli?: number[] };
            novita = fd.rows.filter((x) => !x.letto && x.tipo !== 'visita').length;
            faro = fd.faroLivelli;
          }
        } catch { /* senza feed la scheda esce lo stesso */ }
        const r = await lotReq(env, p.id, now, 'rientro', faro?.length ? { faro } : {});
        if (!r.ok) return r;
        const d = (await r.json()) as { riepilogo: unknown; lot: unknown };
        return json({ riepilogo: d.riepilogo, novita, lot: d.lot, now });
      }
      const pa = await rottePortoAmici(path, req, env, (q, b) => sfideReq(env, p.id, now, q, b), corpo);
      if (pa) return pa;
      if (path === '/api/presenza' && req.method === 'POST') return lotReq(env, p.id, now, 'visto', {});
      // Libro degli ospiti (#86): firmi il libro dell'isola di un amico (nome dal tuo link, emote di avatar.json); il DO del suo lotto
      // controlla «una al giorno» e risponde col suo LotState; poi una riga nel suo feed (best-effort)
      if (path === '/api/libro/firma' && req.method === 'POST') {
        const body = await corpo();
        if (body instanceof Response) return body;
        const isola = body['isola'], emote = body['emote'];
        if (typeof isola !== 'string' || !/^[a-z0-9_-]{1,40}$/.test(isola)) return json({ error: 'Isola non valida' }, 400);
        if (typeof emote !== 'string' || !AVATAR.emote.includes(emote)) return json({ error: 'Saluto sconosciuto' }, 400);
        if (isola === p.id) return json({ error: 'È il tuo libro: qui firmano gli amici che passano', code: 'firma' }, 409);
        if (!(await esistePersona(env, isola))) return json({ error: 'Isola non trovata' }, 404);
        const r = await lotReq(env, isola, now, 'firma', { chi: p.id, nome: p.nome, emote });
        if (!r.ok) return r;
        const lot: unknown = await r.json();
        try { const f = await doReq(env.SFIDE, 'tavolo', isola, now, 'visita', { chi: p.id, emote }); await f.body?.cancel(); } catch { /* il libro è firmato lo stesso */ }
        return json(lot);
      }
      // Diario del capitano (#87): avvistamenti (i lotti solo di amici veri), RISCUOTI di un traguardo (il DO verifica e paga), titolo sotto il nome
      if (path === '/api/diario/visto' && req.method === 'POST') {
        const body = await corpo();
        if (body instanceof Response) return body;
        let isole = body['isole'];
        if (Array.isArray(isole) && isole.some((i) => typeof i === 'string' && i.startsWith('lotto:'))) {
          const amici = new Set(await amiciConIsola(env, p.id));
          isole = isole.filter((i) => typeof i !== 'string' || !i.startsWith('lotto:') || amici.has(i.slice(6)));
        }
        return lotReq(env, p.id, now, 'diario_visto', { animali: body['animali'], isole });
      }
      if (path === '/api/diario/riscuoti' && req.method === 'POST') {
        const body = await corpo();
        if (body instanceof Response) return body;
        return lotReq(env, p.id, now, 'diario_riscuoti', { id: body['id'], amici: (await amiciConIsola(env, p.id)).length });
      }
      if (path === '/api/diario/titolo' && req.method === 'POST') {
        const body = await corpo();
        if (body instanceof Response) return body;
        const id = body['id'] ?? null;
        const r = await lotReq(env, p.id, now, 'diario_titolo', { id });
        if (!r.ok) return r;
        const lot = await r.text();
        let base: Look | string;
        try { base = validaLook(JSON.parse(p.look) as Record<string, unknown>); } catch { base = 'look rotto'; }
        if (typeof base !== 'string') { // il titolo va col look (D1 + presenza): così gli amici lo vedono sotto il nome
          const salvato = conTitolo(base, p.look, typeof id === 'string' ? id : null);
          await salvaLook(env, p.id, salvato);
          await avvisaZona(env, p.id, salvato);
        }
        return new Response(lot, { status: 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
      }
      // Mondo Sotterraneo: azioni del personaggio e spedizioni; il replay lo fa il DO del lotto, mai il Worker (10 ms di CPU)
      if (path === '/api/rpg' && req.method === 'POST') {
        const body = await corpo();
        if (body instanceof Response) return body;
        return lotReq(env, p.id, now, 'rpg', { azione: body['azione'] });
      }
      if (path === '/api/dungeon/start' && req.method === 'POST') {
        const body = await corpo();
        if (body instanceof Response) return body;
        return lotReq(env, p.id, now, 'dungeon_start', { dungeon: body['dungeon'], da: body['da'] });
      }
      if ((path === '/api/dungeon/finish' || path === '/api/dungeon/save') && req.method === 'POST') {
        const body = await corpo(MAX_DUNGEON_BODY);
        if (body instanceof Response) return body;
        return lotReq(env, p.id, now, path.endsWith('save') ? 'dungeon_save' : 'dungeon_finish', { inputs: body['inputs'], azioni: body['azioni'], hash: body['hash'] });
      }
      // Isola dei Templari (docs/TEMPLARI.md): apre la partita a ondate (seed dal DO) e la chiude (il DO rigioca e paga le ondate superate)
      if (path === '/api/templari/start' && req.method === 'POST') {
        const body = await corpo();
        if (body instanceof Response) return body;
        return lotReq(env, p.id, now, 'templari_start', { subito: body['subito'] });
      }
      if (path === '/api/templari/reliquia' && req.method === 'POST') return lotReq(env, p.id, now, 'templari_reliquia', {});
      if (path === '/api/templari/finish' && req.method === 'POST') {
        const body = await corpo(MAX_TEMPLARI_BODY);
        if (body instanceof Response) return body;
        return lotReq(env, p.id, now, 'templari_finish', { inputs: body['inputs'], azioni: body['azioni'], hash: body['hash'] });
      }
      const altrui = path.match(/^\/api\/lot\/([a-z0-9_-]{1,40})$/);
      if (altrui && req.method === 'GET') {
        const id = altrui[1] ?? '';
        if (!(await esistePersona(env, id))) return json({ error: 'Isola non trovata' }, 404);
        return lotReq(env, id, now, 'state');
      }

      // feed: righe strutturate dal DO Sfide, nomi da D1, testo composto qui (feed.ts)
      if (path === '/api/feed' && req.method === 'GET') {
        const r = await sfideReq(env, p.id, now, 'feed');
        if (!r.ok) return r;
        const d = (await r.json()) as { rows: FeedRow[]; nonLetti: number };
        const nomi = new Map(d.rows.length ? (await elencoPersone(env)).map((x) => [x.id, x.nome] as const) : []);
        const nomeDi = (id: string): string => nomi.get(id) ?? 'Qualcuno';
        return json({ items: d.rows.map((x) => toFeedItem(x, nomeDi)), nonLetti: d.nonLetti, now });
      }
      if (path === '/api/feed/letto' && req.method === 'POST') {
        const body = await corpo();
        if (body instanceof Response) return body;
        const fino = body['fino'];
        if (fino !== undefined && fino !== null && (typeof fino !== 'number' || !Number.isFinite(fino))) return json({ error: 'Richiesta non valida' }, 400);
        return sfideReq(env, p.id, now, 'feed_letto', typeof fino === 'number' ? { fino } : {});
      }

      if (path === '/api/challenges') {
        if (req.method === 'GET') return sfideReq(env, p.id, now, 'list');
        if (req.method === 'POST') {
          const body = await corpo();
          if (body instanceof Response) return body;
          const to = body['to'];
          if (typeof to !== 'string' || to.length > 40) return json({ error: 'Chi vuoi sfidare?' }, 400);
          if (to === p.id) return json({ error: 'Non puoi sfidare te stesso' }, 400);
          if (!(await esistePersona(env, to))) return json({ error: 'Persona non trovata' }, 404);
          return sfideReq(env, p.id, now, 'create', { minigame: body['minigame'], to, stake: body['stake'] });
        }
      }
      const sfida = path.match(/^\/api\/challenges\/([a-z0-9-]{1,40})\/(play|accept|decline)$/);
      if (sfida && req.method === 'POST') {
        const body = await corpo(sfida[2] === 'play' ? MAX_PLAY_BODY : MAX_BODY);
        if (body instanceof Response) return body;
        return sfideReq(env, p.id, now, sfida[2] ?? '', { id: sfida[1], inputs: body['inputs'] });
      }
      return json({ error: 'Non trovato' }, 404);
    } catch (e) {
      console.error('[marea] errore', e);
      return json({ error: 'Errore interno, riprova tra poco' }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
