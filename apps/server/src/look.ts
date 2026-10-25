// Il look delle persone (D1) visto dal Worker: validazione, cosa si salva, l'equipaggiamento che si vede addosso e l'avviso alla zona.
import { AVATAR } from '@marea/content';
import type { Look, LookSalvato } from '@marea/protocol';
import { barcaDi, diSerie } from '@marea/sim/economy/barca.ts';
import type { BarcaLook } from '@marea/sim/economy/barca.ts';
import type { LotState } from '@marea/sim';
import { heroOf } from '@marea/sim/rpg/hero.ts';
import { indossaDa, indossaValida, stessoIndossa } from '@marea/sim/rpg/indossa.ts';
import type { Env, Persona } from './env.ts';
import { salvaLook } from './db.ts';

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
  // il vestito intero del Mercante: assente = la T-shirt di base (0)
  const a = v['abito'] ?? 0;
  if (typeof a !== 'number' || !Number.isInteger(a) || a < 0 || a >= AVATAR.abiti.length) return 'Scelta non valida: abito';
  out.abito = a;
  return out;
}

/** Una novità della persona alla zona `porto` (i suoi socket vivi la mandano nel prossimo snap). Best-effort: se fallisce, pazienza. */
async function avvisa(env: Env, persona: string, cosa: 'look' | 'nome', dati: unknown): Promise<void> {
  try {
    const r = await env.ZONE.get(env.ZONE.idFromName('porto')).fetch('https://zone/' + cosa, {
      method: 'POST', headers: { 'x-persona': persona, 'content-type': 'application/json' }, body: JSON.stringify(dati),
    });
    await r.body?.cancel();
  } catch { /* la zona si aggiorna alla prossima connessione */ }
}
export const avvisaZona = (env: Env, persona: string, look: LookSalvato): Promise<void> => avvisa(env, persona, 'look', look);
export const avvisaZonaNome = (env: Env, persona: string, nome: string): Promise<void> => avvisa(env, persona, 'nome', { nome });

/** Il look nuovo da salvare in D1 (JSON): la barca resta quella salvata, o quella passata (`barca`; la barca di serie non si scrive);
 *  l'equipaggiamento resta quello salvato (lo scrive sincIndossa). */
export function conSalvato(look: Look, salvato: string, barca?: BarcaLook): LookSalvato {
  let old: Record<string, unknown> = {};
  try { const v: unknown = JSON.parse(salvato); if (v && typeof v === 'object') old = v as Record<string, unknown>; } catch { /* look rotto */ }
  const b = barca ?? barcaDi(old), ind = indossaValida(old['indossa']);
  return { ...look, ...(diSerie(b) ? {} : { barca: b }), ...(ind ? { indossa: ind } : {}) };
}

/** Quello che si vede addosso, ricavato dal personaggio vero (`hero.equip` nel lotto): se è cambiato rispetto al look salvato lo scrive in D1
 *  e lo manda alla zona, così gli amici vedono armatura e arma solo se le hai davvero. Legge la risposta del DO (LotState, o `{ lot }` / `{ lotto }`)
 *  senza consumarla; best-effort: se qualcosa va storto, la risposta passa lo stesso. */
export async function sincIndossa(env: Env, p: Persona, r: Response): Promise<Response> {
  if (!r.ok) return r;
  try {
    const j: unknown = await r.clone().json();
    const o = j && typeof j === 'object' ? (j as Record<string, unknown>) : null;
    const lot = (o?.['lot'] ?? o?.['lotto'] ?? o) as LotState | null;
    if (!lot || typeof lot !== 'object' || typeof lot.owner !== 'string') return r; // non c'è un lotto nella risposta: nulla da confrontare
    const nuovo = indossaDa(heroOf(lot).equip); // senza personaggio salvato vale quello di partenza (tela, katana di legno, arco…)
    let old: Record<string, unknown> = {};
    try { const v: unknown = JSON.parse(p.look); if (v && typeof v === 'object') old = v as Record<string, unknown>; } catch { /* look rotto */ }
    if (stessoIndossa(indossaValida(old['indossa']), nuovo)) return r;
    const { indossa: _via, ...resto } = old;
    const salvato = { ...resto, ...(nuovo ? { indossa: nuovo } : {}) } as LookSalvato;
    await salvaLook(env, p.id, salvato);
    p.look = JSON.stringify(salvato);
    await avvisaZona(env, p.id, salvato);
  } catch { /* si vede alla prossima */ }
  return r;
}

/** Id del cappello da indice (come in Look) o da id. */
export function hatId(v: unknown): string | null {
  if (typeof v === 'number' && Number.isInteger(v)) return AVATAR.cappelli[v]?.id ?? null;
  return typeof v === 'string' && AVATAR.cappelli.some((h) => h.id === v) ? v : null;
}
