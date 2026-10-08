import type { Env, Persona } from './env.ts';
import type { LookSalvato } from '@marea/protocol';
export async function personaDaToken(env: Env, token: string): Promise<Persona | null> {
  if (!token || token.length > 128) return null;
  const r = await env.DB.prepare('SELECT id, nome, admin, look, slot FROM persone WHERE token = ?1').bind(token).first<Persona>();
  return r ?? null;
}
export async function segnaAccesso(env: Env, id: string): Promise<void> {
  await env.DB.prepare("UPDATE persone SET ultimo_accesso = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id = ?1").bind(id).run();
}
export async function esistePersona(env: Env, id: string): Promise<boolean> {
  return (await env.DB.prepare('SELECT 1 AS x FROM persone WHERE id = ?1').bind(id).first<{ x: number }>()) !== null;
}
/** Look in D1, col titolo del diario (#87) se c'è: è lo stesso JSON che la Zone legge alla connessione. */
export async function salvaLook(env: Env, id: string, look: LookSalvato): Promise<void> {
  await env.DB.prepare('UPDATE persone SET look = ?2 WHERE id = ?1').bind(id, JSON.stringify(look)).run();
}
/** Tutti gli abitanti dell'arcipelago (per scegliere chi sfidare e sapere di chi è ogni lotto). */
export async function elencoPersone(env: Env): Promise<{ id: string; nome: string; slot: number | null; look: string }[]> {
  const r = await env.DB.prepare('SELECT id, nome, slot, look FROM persone ORDER BY slot IS NULL, slot, creato').all<{ id: string; nome: string; slot: number | null; look: string }>();
  return r.results ?? [];
}

const LOOK_A = '{"pelle":2,"capelli":0,"coloreCapelli":0,"vestito":0,"cappello":1}'; // look di partenza (variante A, migrazione 0002)
/** Primo slot di lotto libero (0-7), NULL se l'arcipelago è pieno. Stessa espressione di scripts/invita.mjs. */
const SLOT_LIBERO = "(SELECT value FROM json_each('[0,1,2,3,4,5,6,7]') WHERE value NOT IN (SELECT slot FROM persone WHERE slot IS NOT NULL) ORDER BY value LIMIT 1)";
/**
 * Ingresso dal link di gruppo: se l'invito ha ancora ingressi, crea la persona (primo slot libero) e conta l'uso, in una sola
 * transazione (batch D1). null = invito inesistente o finito.
 */
export async function entraConInvito(env: Env, codice: string, id: string, nome: string, token: string): Promise<{ slot: number | null } | null> {
  const ok = 'EXISTS (SELECT 1 FROM inviti WHERE codice = ?1 AND usi < max_usi)';
  const [ins] = await env.DB.batch([
    env.DB.prepare(`INSERT INTO persone (id, nome, token, admin, look, slot) SELECT ?2, ?3, ?4, 0, '${LOOK_A}', ${SLOT_LIBERO} WHERE ${ok}`).bind(codice, id, nome, token),
    env.DB.prepare(`UPDATE inviti SET usi = usi + 1, usato = strftime('%Y-%m-%dT%H:%M:%SZ','now'), usato_da = ?2 WHERE codice = ?1 AND usi < max_usi AND EXISTS (SELECT 1 FROM persone WHERE id = ?2)`).bind(codice, id),
  ]);
  if (!ins?.meta.changes) return null;
  const r = await env.DB.prepare('SELECT slot FROM persone WHERE id = ?1').bind(id).first<{ slot: number | null }>();
  return { slot: r?.slot ?? null };
}
