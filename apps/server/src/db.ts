import type { Env, Persona } from './env.ts';
export async function personaDaToken(env: Env, token: string): Promise<Persona | null> {
  if (!token || token.length > 128) return null;
  const r = await env.DB.prepare('SELECT id, nome, admin, look FROM persone WHERE token = ?1').bind(token).first<Persona>();
  return r ?? null;
}
export async function segnaAccesso(env: Env, id: string): Promise<void> {
  await env.DB.prepare("UPDATE persone SET ultimo_accesso = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id = ?1").bind(id).run();
}
