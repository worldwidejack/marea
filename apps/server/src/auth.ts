import { personaDaToken } from './db.ts';
import type { Env, Persona } from './env.ts';
/** Token da header X-Token o da ?t= (solo per il WebSocket). */
export async function autentica(req: Request, env: Env): Promise<Persona | null> {
  const url = new URL(req.url);
  const token = req.headers.get('x-token') ?? url.searchParams.get('t') ?? '';
  return personaDaToken(env, token);
}
