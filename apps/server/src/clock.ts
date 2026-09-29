// Orologio del server. In test (solo wrangler dev locale con TEST_CLOCK=1 e richiesta da localhost) l'header `X-Test-Now-Offset: <ms>`
// sposta «adesso» in avanti: serve agli e2e per far finire cantieri e scadere sfide. In produzione TEST_CLOCK non esiste: header ignorato.
// Il Worker calcola l'ora una volta per richiesta e la passa ai DO in `x-now` (i DO non sono raggiungibili da fuori).
import type { Env } from './env.ts';

const LOCAL = new Set(['127.0.0.1', 'localhost', '[::1]']);
const MAX_OFFSET = 400 * 24 * 3_600_000;

export function testClockOn(env: Env, req: Request): boolean {
  return env.TEST_CLOCK === '1' && LOCAL.has(new URL(req.url).hostname);
}

export function nowFor(req: Request, env: Env): number {
  const now = Date.now();
  if (!testClockOn(env, req)) return now;
  const off = Number(req.headers.get('x-test-now-offset') ?? 0);
  return Number.isFinite(off) && Math.abs(off) <= MAX_OFFSET ? now + Math.trunc(off) : now;
}

/** Nei DO: l'ora passata dal Worker (x-now), altrimenti quella vera (es. alarm). */
export function nowFromHeader(req: Request): number {
  const n = Number(req.headers.get('x-now'));
  return Number.isFinite(n) && n > 0 ? n : Date.now();
}
