// Gestione di inviti e link personali riservata a chi ha `admin = 1` (i dev del gruppo): nessuno deve passare da una persona sola
// (e dal suo login Cloudflare) per far entrare un amico o ritrovare il link di un personaggio. Rotte: POST /api/admin/{invito,link,admin}.
// Script per usarle: apps/server/scripts/admin.mjs. Errori sempre `{ error }` in italiano.
import type { Env, Persona } from './env.ts';
import { json } from './http.ts';

/** Token e codici nuovi: 18 byte casuali in base64url. */
export function nuovoToken(): string {
  const rnd = crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...rnd)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

type Riga = { id: string; nome: string; token: string; admin: number };
/** Una persona dal nome (come lo vedi in gioco, maiuscole indifferenti) o dall'id esatto. Più di una col stesso nome → lista, a te scegliere l'id. */
async function trova(env: Env, chi: string): Promise<Riga[]> {
  const r = await env.DB.prepare('SELECT id, nome, token, admin FROM persone WHERE id = ?1 OR lower(nome) = lower(?1) ORDER BY creato').bind(chi).all<Riga>();
  const esatta = r.results.find((p) => p.id === chi);
  return esatta ? [esatta] : r.results;
}

/** `via` = 'invito' | 'link' | 'admin'. `origin` = indirizzo da cui è arrivata la richiesta (i link restituiti puntano lì). */
export async function rottaAdmin(env: Env, p: Persona, via: string, b: Record<string, unknown>, origin: string): Promise<Response> {
  if (!p.admin) return json({ error: 'Solo chi sviluppa MAREA (admin) può farlo: chiedi a un dev di promuoverti' }, 403);
  if (via === 'invito') {
    const usi = b['usi'] === undefined ? 7 : b['usi'];
    if (typeof usi !== 'number' || !Number.isInteger(usi) || usi < 1 || usi > 50) return json({ error: 'usi: un numero da 1 a 50' }, 400);
    const codice = nuovoToken().slice(0, 12);
    await env.DB.prepare('INSERT INTO inviti (codice, creato_da, max_usi) VALUES (?1, ?2, ?3)').bind(codice, p.id, usi).run();
    console.log(`[admin] ${p.id} crea invito da ${usi} usi`);
    return json({ codice, usi, url: `${origin}/?invito=${codice}` });
  }
  const chi = typeof b['persona'] === 'string' ? b['persona'].trim() : '';
  if (!chi || chi.length > 60) return json({ error: 'Scrivi il nome del personaggio' }, 400);
  const trovate = await trova(env, chi);
  if (trovate.length === 0) return json({ error: `Nessun personaggio chiamato «${chi}»` }, 404);
  if (trovate.length > 1) return json({ error: `Più personaggi si chiamano «${chi}»: usa l'id`, scelte: trovate.map((t) => ({ id: t.id, nome: t.nome })) }, 409);
  const t = trovate[0]!;
  if (via === 'link') {
    let token = t.token;
    if (b['ruota'] === true) {
      token = nuovoToken();
      await env.DB.prepare('UPDATE persone SET token = ?2 WHERE id = ?1').bind(t.id, token).run();
    }
    console.log(`[admin] ${p.id} legge il link di ${t.id}${b['ruota'] === true ? ' (token cambiato)' : ''}`);
    return json({ id: t.id, nome: t.nome, ruotato: b['ruota'] === true, url: `${origin}/?t=${token}` });
  }
  if (via === 'admin') {
    const su = b['admin'] !== false;
    if (!su && t.id === p.id) return json({ error: 'Non puoi toglierti da solo il ruolo di admin' }, 400);
    await env.DB.prepare('UPDATE persone SET admin = ?2 WHERE id = ?1').bind(t.id, su ? 1 : 0).run();
    console.log(`[admin] ${p.id} ${su ? 'promuove' : 'toglie il ruolo a'} ${t.id}`);
    return json({ id: t.id, nome: t.nome, admin: su });
  }
  return json({ error: 'Non trovato' }, 404);
}
