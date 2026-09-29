// MAREA Worker: /api/* e /ws/* qui, tutto il resto lo servono gli asset (client). Budget CPU ~10 ms: solo routing, auth e piccoli JSON;
// il lavoro vero sta nei DO (Zone = presenza, Lot = isola). Errori sempre `{ error }` in italiano, mai il dettaglio tecnico.
import { AVATAR } from '@marea/content';
import type { Look } from '@marea/protocol';
import type { Env } from './env.ts';
import { autentica } from './auth.ts';
import { esistePersona, salvaLook, segnaAccesso } from './db.ts';
export { Zone } from './do/Zone.ts';
export { Lot } from './do/Lot.ts';

const MAX_BODY = 4096;
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

/** Corpo JSON piccolo; null = rotto, 'grande' = oltre MAX_BODY. */
async function leggiCorpo(req: Request): Promise<Record<string, unknown> | null | 'grande'> {
  if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY) return 'grande';
  const text = await req.text();
  if (text.length > MAX_BODY) return 'grande';
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

function lotStub(env: Env, id: string) { return env.LOT.get(env.LOT.idFromName(id)); }
function lotReq(env: Env, owner: string, path: string, init?: { method: string; body: string }): Promise<Response> {
  return lotStub(env, owner).fetch(new Request('https://lot/' + path, { method: init?.method ?? 'GET', body: init?.body, headers: { 'x-persona': owner, 'content-type': 'application/json' } }));
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;
    try {
      if (path === '/api/ping') return json({ ok: true, build: await buildId(env, url), now: Date.now() });

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

      if (!path.startsWith('/api/')) {
        if (path.startsWith('/ws/')) return json({ error: 'Non trovato' }, 404);
        return env.ASSETS.fetch(req);
      }

      const p = await autentica(req, env);
      if (!p) return json({ error: NO_TOKEN }, 401);

      if (path === '/api/me' && req.method === 'GET') {
        const r = await lotReq(env, p.id, 'state');
        const lotto: unknown = r.ok ? await r.json() : null;
        return json({ id: p.id, nome: p.nome, look: JSON.parse(p.look) as unknown, lotto });
      }
      if (path === '/api/look' && req.method === 'POST') {
        const body = await leggiCorpo(req);
        if (body === 'grande') return json({ error: 'Richiesta troppo grande' }, 413);
        if (!body) return json({ error: 'Richiesta non valida' }, 400);
        const look = validaLook(body);
        if (typeof look === 'string') return json({ error: look }, 400);
        await salvaLook(env, p.id, look);
        return json({ ok: true });
      }
      if (path === '/api/lot' && req.method === 'GET') return lotReq(env, p.id, 'state');
      const azione = path.match(/^\/api\/lot\/(collect|build|upgrade)$/);
      if (azione && req.method === 'POST') {
        const body = await leggiCorpo(req);
        if (body === 'grande') return json({ error: 'Richiesta troppo grande' }, 413);
        if (!body) return json({ error: 'Richiesta non valida' }, 400);
        return lotReq(env, p.id, azione[1] ?? '', { method: 'POST', body: JSON.stringify(body) });
      }
      const altrui = path.match(/^\/api\/lot\/([a-z0-9_-]{1,40})$/);
      if (altrui && req.method === 'GET') {
        const id = altrui[1] ?? '';
        if (!(await esistePersona(env, id))) return json({ error: 'Isola non trovata' }, 404);
        return lotReq(env, id, 'state');
      }
      return json({ error: 'Non trovato' }, 404);
    } catch (e) {
      console.error('[marea] errore', e);
      return json({ error: 'Errore interno, riprova tra poco' }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
