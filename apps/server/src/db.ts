import type { Env, Persona } from './env.ts';
import type { Look } from '@marea/protocol';
export async function personaDaToken(env: Env, token: string): Promise<Persona | null> {
  if (!token || token.length > 128) return null;
  const r = await env.DB.prepare('SELECT id, nome, admin, look FROM persone WHERE token = ?1').bind(token).first<Persona>();
  return r ?? null;
}
export async function segnaAccesso(env: Env, id: string): Promise<void> {
  await env.DB.prepare("UPDATE persone SET ultimo_accesso = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id = ?1").bind(id).run();
}
export async function esistePersona(env: Env, id: string): Promise<boolean> {
  return (await env.DB.prepare('SELECT 1 AS x FROM persone WHERE id = ?1').bind(id).first<{ x: number }>()) !== null;
}
export async function salvaLook(env: Env, id: string, look: Look): Promise<void> {
  await env.DB.prepare('UPDATE persone SET look = ?2 WHERE id = ?1').bind(id, JSON.stringify(look)).run();
}
