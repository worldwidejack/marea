// I preferiti del dungeon (richiesta di Riccardo): tre posti per l'arma o la magia che vuoi cambiare al volo, bottoni a schermo accanto
// ad A e B e tasti 1-2-3 (dungeon_preferiti_ui.ts). Sono una comodità di chi gioca e non toccano la sim: cambiare è la stessa azione `equip`
// dello zaino (quindi vale anche in squadra e il server la rigioca). Cosa c'è nei tre posti si ricorda su questo dispositivo; finché non ne
// scegli uno, partono quelli fatti dal personaggio (arma in mano, una magia, un'altra arma).
import { spellDef } from '@marea/content/rpg.ts';
import type { DungeonAzione } from '@marea/sim/dungeon/types.ts';
import { hasItem, itemDef } from '@marea/sim/rpg/items.ts';
import type { HeroState } from '@marea/sim/rpg/types.ts';

/** Un'arma (o un arco) dello zaino, o una magia conosciuta. */
export type Preferito = { arma: string } | { magia: string };
export type Preferiti = (Preferito | null)[];
export const N_PREFERITI = 3;
const SALVA = 'mz-dng-preferiti';

/** Cosa c'è in mano adesso (DungeonView.hero): l'arma, e la magia se le mani tengono quella. */
export type InMano = { arma: string | null; magia: string | null };
/** Una riga del selettore: cosa, come si chiama e una nota (arma, arco, costo della magia). */
export type Voce = { p: Preferito; nome: string; nota: string };

const idDi = (p: Preferito): string => ('magia' in p ? p.magia : p.arma);
export const stessi = (a: Preferito | null, b: Preferito | null): boolean => (a === null || b === null ? a === b : idDi(a) === idDi(b) && ('magia' in a) === ('magia' in b));

/** Quelli salvati su questo dispositivo; null = non ne hai mai scelto uno. */
export function leggiPreferiti(): Preferiti | null {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(SALVA) ?? 'null');
    if (!Array.isArray(v)) return null;
    return Array.from({ length: N_PREFERITI }, (_, i) => {
      const x = v[i] as Record<string, unknown> | null | undefined;
      return x && typeof x['arma'] === 'string' ? { arma: x['arma'] } : x && typeof x['magia'] === 'string' ? { magia: x['magia'] } : null;
    });
  } catch { return null; }
}
export function salvaPreferiti(p: Preferiti): void { try { localStorage.setItem(SALVA, JSON.stringify(p)); } catch { /* niente: resta per questa partita */ } }

const eArma = (id: string): boolean => hasItem(id) && (itemDef(id).kind === 'arma' || itemDef(id).kind === 'arco');
/** Le armi e gli archi che hai nello zaino, in ordine di nome. */
const armiDi = (h: HeroState): string[] => Object.keys(h.inv).filter((id) => (h.inv[id] ?? 0) > 0 && eArma(id)).sort((a, b) => itemDef(a).nome.localeCompare(itemDef(b).nome));
const nomeMagia = (id: string): string => { try { return spellDef(id).nome; } catch { return id; } };

/** Quelli di partenza: l'arma in mano, la magia preparata (o la prima che conosci) e un'altra arma, meglio se un arco. */
export function predefiniti(h: HeroState): Preferiti {
  const arma = h.equip.arma && (h.inv[h.equip.arma] ?? 0) > 0 ? h.equip.arma : null;
  const altre = armiDi(h).filter((id) => id !== arma);
  const altra = altre.find((id) => itemDef(id).kind === 'arco') ?? altre[0];
  const magia = h.equip.magia && h.magie.includes(h.equip.magia) ? h.equip.magia : h.magie[0];
  return [arma ? { arma } : null, magia ? { magia } : null, altra ? { arma: altra } : null];
}

/** Lo ha ancora (l'arma è nello zaino, la magia è conosciuta)? */
export const ha = (h: HeroState, p: Preferito): boolean => ('magia' in p ? h.magie.includes(p.magia) : (h.inv[p.arma] ?? 0) > 0 && eArma(p.arma));
/** È quello che hai in mano adesso? Con la magia in mano l'arma è a riposo. */
export const inMano = (p: Preferito, m: InMano): boolean => ('magia' in p ? m.magia === p.magia : m.arma === p.arma && !m.magia);
export const nomeDi = (p: Preferito): string => ('magia' in p ? nomeMagia(p.magia) : hasItem(p.arma) ? itemDef(p.arma).nome : p.arma);
/** Metterlo in mano: la stessa azione dello zaino (arma → l'arma, magia → la magia preparata e in mano). `act` è quella della spedizione:
 *  null = fatto, altrimenti il motivo. */
export function mettiInMano(p: Preferito, h: HeroState | null, act: (a: DungeonAzione) => string | null): string | null {
  if (h && !ha(h, p)) return `Non hai più: ${nomeDi(p)}`;
  return act('magia' in p ? { t: 'equip', slot: 'magia', item: p.magia } : { t: 'equip', slot: 'arma', item: p.arma });
}

/** Tra cui scegliere: le armi dello zaino e le magie che conosci. */
export function vociDi(h: HeroState): Voce[] {
  const armi = armiDi(h).map((id): Voce => ({ p: { arma: id }, nome: itemDef(id).nome, nota: itemDef(id).kind === 'arco' ? 'arco' : 'arma' }));
  const magie = h.magie.map((m): Voce => { let costo = ''; try { const s = spellDef(m); costo = `${s.costo}${s.forma === 'raggio' ? '/s' : ''} Magicka`; } catch { /* sconosciuta */ } return { p: { magia: m }, nome: nomeMagia(m), nota: costo }; });
  return [...armi, ...magie];
}
