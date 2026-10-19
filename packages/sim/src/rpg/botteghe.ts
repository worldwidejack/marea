// Le vetrine di oggetti delle botteghe del Borgo (#414): il Fabbro espone ogni giorno tre pezzi già forgiati (un'arma leggera, una pesante o
// un arco, un'armatura, di bronzo, ferro, argento, oro o vetro), l'Alchimista due pozioni e un ingrediente raro. Prezzo = valore del
// Contrabbandiere (rpg/contrabbando.ts `valoreDi`) × `ricarico` di botteghe.json. Sempre in vendita, a prezzo fisso, la roba di base di
// RPG.bottega (rpg/balance.json): lingotti dal Fabbro, erbe dall'Alchimista (al posto della Serra). Puro.
import { BOTTEGHE } from '@marea/content/botteghe.ts';
import { RPG } from '@marea/content/rpg.ts';
import { vetrinaBottega } from '../economy/botteghe.ts';
import { valoreDi } from './contrabbando.ts';
import { hasItem, itemDef } from './items.ts';

/** Le botteghe che vendono oggetti (nello zaino). */
export type BottegaOggetti = 'fabbro' | 'alchimista';

/** Quanto costa un pezzo della vetrina (almeno 1 moneta). */
export const prezzoVetrina = (b: BottegaOggetti, id: string): number => Math.max(1, Math.ceil(valoreDi(id) * (BOTTEGHE[b].ricarico ?? 1.5) - 1e-9));
/** La vetrina di oggi di una bottega: id degli oggetti, uno per scomparto. */
export const vetrinaOggetti = (b: BottegaOggetti, ms: number): string[] => vetrinaBottega(b, ms).filter((id) => hasItem(id));
/** La roba di base sempre in vendita (RPG.bottega, prezzo fisso): materiali dal Fabbro, ingredienti dall'Alchimista. */
export function sempreInVendita(b: BottegaOggetti): { id: string; monete: number }[] {
  const kind = b === 'fabbro' ? 'materiale' : 'ingrediente';
  return Object.entries(RPG.bottega).filter(([id]) => hasItem(id) && itemDef(id).kind === kind).map(([id, monete]) => ({ id, monete }));
}
