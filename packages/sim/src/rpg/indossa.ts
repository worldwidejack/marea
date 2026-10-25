// Equipaggiamento che si vede addosso (#190): armatura o veste sul corpo, arma (sulla schiena fuori dal dungeon) e frecce nella faretra.
// Sono solo id del catalogo: li ricava il server dal `hero.equip` vero (così nessuno si vede addosso quello che non ha), la Zone ne controlla
// la forma e il client li veste (game/indossa.ts). Puro.
import { hasItem, itemDef } from './items.ts';
import type { EquipSlot } from './types.ts';

export type Indossa = { corpo?: string; arma?: string; frecce?: string; corpoFuori?: boolean };
const KINDI: Record<'corpo' | 'arma' | 'frecce', readonly string[]> = { corpo: ['armatura', 'veste'], arma: ['arma', 'arco'], frecce: ['frecce'] };

/** Solo ciò che esiste nel catalogo e sta nello slot giusto; `undefined` se non resta niente da vedere. Accetta qualsiasi valore (viene dalla rete). */
export function indossaValida(v: unknown): Indossa | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Record<string, unknown>, out: Indossa = {};
  for (const k of Object.keys(KINDI) as ('corpo' | 'arma' | 'frecce')[]) {
    const id = o[k];
    if (typeof id === 'string' && id.length <= 48 && hasItem(id) && KINDI[k].includes(itemDef(id).kind)) out[k] = id;
  }
  if (o['corpoFuori'] === true) out.corpoFuori = true;
  return out.corpo || out.arma || out.frecce ? out : undefined;
}
/** Quello che si vede di un equipaggiamento (HeroState.equip, e se si mostra l'armatura fuori dai dungeon). */
export function indossaDa(equip: Partial<Record<EquipSlot, string>> | undefined, corpoFuori?: boolean): Indossa | undefined {
  return indossaValida({ corpo: equip?.corpo, arma: equip?.arma, frecce: equip?.frecce, corpoFuori: corpoFuori ? true : undefined });
}
export const stessoIndossa = (a: Indossa | undefined, b: Indossa | undefined): boolean =>
  (a?.corpo ?? '') === (b?.corpo ?? '') && (a?.arma ?? '') === (b?.arma ?? '') && (a?.frecce ?? '') === (b?.frecce ?? '') && (a?.corpoFuori ?? false) === (b?.corpoFuori ?? false);
