// MAREA Worker: /api/* e /ws/* qui, tutto il resto lo servono gli asset (client). Budget CPU ~10 ms: niente lavoro pesante qui.
import type { Env } from './env.ts';
import { autentica } from './auth.ts';
import { segnaAccesso } from './db.ts';
export { Zone } from './do/Zone.ts';
export { Lot } from './do/Lot.ts';

const json = (dati: unknown, status = 200): Response =>
  new Response(JSON.stringify(dati), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

async function buildId(env: Env, url: URL): Promise<string> {
  try {
    const r = await env.ASSETS.fetch(new Request(new URL('/version.json', url.origin)));
    if (r.ok) return ((await r.json()) as { build?: string }).build ?? 'sconosciuta';
  } catch { /* nessun asset */ }
  return 'sconosciuta';
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    try {
      if (url.pathname === '/api/ping') return json({ ok: true, build: await buildId(env, url), now: Date.now() });
      if (url.pathname === '/api/me') {
        const p = await autentica(req, env);
        if (!p) return json({ error: 'Link non valido: chiedi a Jack un invito nuovo' }, 401);
        return json({ id: p.id, nome: p.nome, look: JSON.parse(p.look) as unknown });
      }
      const ws = url.pathname.match(/^\/ws\/zone\/([a-z0-9_:-]{1,40})$/);
      if (ws) {
        const p = await autentica(req, env);
        if (!p) return json({ error: 'Link non valido: chiedi a Jack un invito nuovo' }, 401);
        await segnaAccesso(env, p.id);
        const zone = ws[1] ?? 'porto';
        const stub = env.ZONE.get(env.ZONE.idFromName(zone));
        const target = new URL(req.url);
        target.searchParams.set('id', p.id); target.searchParams.set('nome', p.nome); target.searchParams.set('look', p.look); target.searchParams.delete('t');
        return stub.fetch(new Request(target.toString(), req));
      }
      if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws/')) return json({ error: 'Non trovato' }, 404);
      return env.ASSETS.fetch(req);
    } catch (e) {
      console.error('[marea] errore', e);
      return json({ error: 'Errore interno, riprova tra poco' }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
