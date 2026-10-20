// MAREA Worker: /api/* e /ws/* qui, tutto il resto lo servono gli asset (client). Budget CPU ~10 ms: solo routing, auth e piccoli JSON;
// il lavoro vero sta nei DO (Zone = presenza, Lot = isola). Qui: le socket, il manifest, l'ingresso col link di gruppo e l'autenticazione;
// le rotte /api/* sono una tabella in rotte.ts.
import type { Env } from './env.ts';
import { autentica } from './auth.ts';
import { nowFor } from './clock.ts';
import { segnaAccesso } from './db.ts';
import { json } from './http.ts';
import { NO_TOKEN, entra, smista } from './rotte.ts';
export { Zone } from './do/Zone.ts';
export { Lot } from './do/Lot.ts';
export { Sfide } from './do/Sfide.ts';
export { Spedizioni } from './do/Spedizioni.ts';
export { GaraAmici } from './do/GaraAmici.ts';
export { TemplariInsieme } from './do/TemplariInsieme.ts';
export { Arena } from './do/Arena.ts';

async function buildId(env: Env, url: URL): Promise<string> {
  try {
    const r = await env.ASSETS.fetch(new Request(new URL('/version.json', url.origin)));
    if (r.ok) return ((await r.json()) as { build?: string }).build ?? 'sconosciuta';
  } catch { /* nessun asset */ }
  return 'sconosciuta';
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

/** Socket verso un DO: serve l'upgrade e un link valido; chi sei arriva al DO nell'URL (id, nome, look e `extra`), il token no.
 *  `accesso` = segna l'ultimo accesso (la zona: è la socket che si apre entrando nel mondo). */
async function socket(req: Request, env: Env, stub: DurableObjectStub, extra: Record<string, string> = {}, accesso = false): Promise<Response> {
  if (req.headers.get('upgrade') !== 'websocket') return json({ error: 'Serve un WebSocket' }, 426);
  const p = await autentica(req, env);
  if (!p) return wsRifiuta('token', NO_TOKEN);
  if (accesso) await segnaAccesso(env, p.id);
  const target = new URL(req.url);
  target.searchParams.set('id', p.id); target.searchParams.set('nome', p.nome); target.searchParams.set('look', p.look);
  for (const [k, v] of Object.entries(extra)) target.searchParams.set(k, v);
  target.searchParams.delete('t');
  return stub.fetch(new Request(target.toString(), req));
}

/** Manifest dell'app installabile. `t` finisce solo nello start_url (come nel link personale), mai nei log. */
function manifesto(t: string): Response {
  const token = /^[A-Za-z0-9_-]{8,128}$/.test(t) ? t : '';
  const body = {
    name: 'MAREA', short_name: 'MAREA', lang: 'it',
    description: "L'arcipelago con gli amici",
    // id diverso per ogni persona: per il telefono ogni link è un'app a sé (con lo stesso id l'icona nuova si teneva l'account di prima)
    start_url: token ? `/?t=${token}` : '/', scope: '/', id: token ? `/?t=${token}` : '/',
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

      // la zona (presenza, emote), il dungeon insieme (squadra all'ingresso e spedizione, tutte nel DO Spedizioni) e le sale in tempo
      // reale con un DO solo: Templari insieme (PROTOCOL §9), corse tra amici (§8, gara a fantasmi), Arena (§10, coda e duelli 1v1)
      const zona = path.match(/^\/ws\/zone\/([a-z0-9_:-]{1,40})$/);
      if (zona) return socket(req, env, env.ZONE.get(env.ZONE.idFromName(zona[1] ?? 'porto')), {}, true);
      const sq = path.match(/^\/ws\/squadra\/([a-z0-9_-]{1,40})$/);
      if (sq) return socket(req, env, env.SPEDIZIONI.get(env.SPEDIZIONI.idFromName('spedizioni')), { dungeon: sq[1]! });
      const sala = path === '/ws/templari' ? env.TEMPLARI_INSIEME.get(env.TEMPLARI_INSIEME.idFromName('templari'))
        : path === '/ws/gara' ? env.GARA_AMICI.get(env.GARA_AMICI.idFromName('garaamici'))
        : path === '/ws/arena' ? env.ARENA.get(env.ARENA.idFromName('arena')) : null;
      if (sala) return socket(req, env, sala);

      // app installabile (PWA): il manifest porta dentro il link personale, così l'icona sul telefono entra come sé
      if (path === '/manifest.webmanifest') return manifesto(url.searchParams.get('t') ?? '');

      if (!path.startsWith('/api/')) {
        if (path.startsWith('/ws/')) return json({ error: 'Non trovato' }, 404);
        return env.ASSETS.fetch(req);
      }

      // link di gruppo: senza token, con il codice dell'invito e il nome scelto → persona nuova e il suo token
      if (path === '/api/entra' && req.method === 'POST') return entra(req, env);
      const p = await autentica(req, env);
      if (!p) return json({ error: NO_TOKEN }, 401);
      return smista(req, env, url, now, p);
    } catch (e) {
      console.error('[marea] errore', e);
      return json({ error: 'Errore interno, riprova tra poco' }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
