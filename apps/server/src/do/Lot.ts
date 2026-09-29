// Isola di un giocatore: stato LotState in SQLite del DO, produzione pigra, azioni, replay dei minigiochi. Stub (WP0): risponde 501. WP4 (M1) implementa.
import { DurableObject } from 'cloudflare:workers';
import type { Env } from '../env.ts';
export class Lot extends DurableObject<Env> {
  async fetch(_req: Request): Promise<Response> {
    return new Response(JSON.stringify({ error: 'Le isole arrivano nella prossima versione' }), { status: 501, headers: { 'content-type': 'application/json; charset=utf-8' } });
  }
}
