// Arena, allenamento a squadre (docs/ARENA.md): l'equipaggiamento dei gladiatori automatici. Si sceglie a mano tra tutto il catalogo (armi, archi,
// vesti, armature, anelli, tutte le magie), come per il proprio personaggio, oppure lo fa il caso: gli slot divisi a sorte tra armi e magie, con
// tre o quattro armi un'armatura, con tre o quattro magie una veste da mago, con due e due un vestito qualsiasi. Il caso pesca solo tra gli oggetti comuni (niente unici).
import { ARENA } from '@marea/content/arena.ts';
import { SPELLS } from '@marea/content/rpg.ts';
import type { Rng } from '../rng.ts';
import { buildArenaEroe, pulisciLoadout } from './arena.ts';
import type { ArenaEroe } from './arena.ts';
import { ITEMS } from './items.ts';
import type { ArenaLoadout, ArenaSlot, HeroState } from './types.ts';

/** Tutte le magie del gioco (il gladiatore le conosce tutte). */
export const MAGIE_BOT: readonly string[] = SPELLS.map((s) => s.id);

/** Gli oggetti del catalogo di certi tipi, in ordine di nome (la scelta a mano dei gladiatori). */
export const catalogoBot = (kinds: readonly string[]): string[] => ITEMS.filter((i) => kinds.includes(i.kind)).sort((a, b) => a.nome.localeCompare(b.nome)).map((i) => i.id);
const comuni = (kind: string): string[] => ITEMS.filter((i) => i.kind === kind && !i.unico).map((i) => i.id);

/** `n` elementi diversi di `a`, pescati a sorte. */
function diversi<T>(rng: Rng, a: readonly T[], n: number): T[] {
  const pool = [...a], out: T[] = [];
  while (out.length < n && pool.length) out.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]!);
  return out;
}

/** Il set a caso di un gladiatore. */
export function botLoadoutCasuale(rng: Rng): ArenaLoadout {
  const armi = rng.int(0, ARENA.slot), magie = ARENA.slot - armi;
  const attacco = SPELLS.filter((s) => !s.cura && !s.furia).map((s) => s.id);
  const slot: ArenaSlot[] = diversi(rng, [...comuni('arma'), ...comuni('arco')], armi).map((a) => {
    const arco = ITEMS.find((i) => i.id === a)?.kind === 'arco';
    return arco ? { arma: a, frecce: rng.pick(comuni('frecce')) } : { arma: a };
  });
  // le magie: almeno una che fa danno o evoca (se no un gladiatore di sole cure non combatte)
  const prima = magie ? rng.pick(attacco) : null;
  if (prima) for (const m of [prima, ...diversi(rng, MAGIE_BOT.filter((x) => x !== prima), magie - 1)]) slot.push({ magia: m });
  const mischiati = diversi(rng, slot, slot.length);
  const corpo = armi >= 3 ? rng.pick(comuni('armatura')) : magie >= 3 ? rng.pick(comuni('veste')) : rng.pick([...comuni('armatura'), ...comuni('veste')]);
  const vita = ITEMS.filter((i) => i.kind === 'pozione' && !i.unico && i.cura?.vita).map((i) => i.id), tutte = comuni('pozione');
  const [anello1, anello2] = diversi(rng, comuni('anello'), 2);
  const out: ArenaLoadout = { slot: Array.from({ length: ARENA.slot }, (_, i) => mischiati[i] ?? null), pozioni: [rng.pick(vita), rng.pick(tutte)], corpo };
  if (anello1) out.anello1 = anello1;
  if (anello2) out.anello2 = anello2;
  return out;
}

/** La fotografia del duello di un gladiatore dal suo set: i perk e le abilità sono quelli di `h`, le magie le sa tutte, gli oggetti li ha tutti. */
export function eroeBot(h: HeroState, l: ArenaLoadout): ArenaEroe {
  const hb: HeroState = { ...h, magie: [...MAGIE_BOT] };
  return buildArenaEroe(hb, pulisciLoadout(hb, l, () => 99));
}
