// Arena, allenamento a squadre (docs/ARENA.md): la build dei gladiatori automatici. Si sceglie a mano come la propria (stesso catalogo per
// tutti), oppure la fa il caso: una dote, due slot diversi tra armi e magie (almeno uno d'attacco; Cura e Furia solo a squadre) e un'ulti.
import { ARENA } from '@marea/content/arena.ts';
import type { Rng } from '../rng.ts';
import { ARMI_ARENA, MAGIE_ARENA, soloSquadre } from './arena.ts';
import type { ArenaBuild, ArenaSlot } from './types.ts';

/** La build a caso di un gladiatore (`squadre`: si può pescare anche Cura e Furia). */
export function botBuildCasuale(rng: Rng, squadre = true): ArenaBuild {
  const tutti: ArenaSlot[] = [...ARMI_ARENA.map((arma) => ({ arma })), ...MAGIE_ARENA.map((magia) => ({ magia }))].filter((s) => squadre || !soloSquadre(s));
  const attacco = tutti.filter((s) => !soloSquadre(s));
  const primo = rng.pick(attacco), resto = tutti.filter((s) => JSON.stringify(s) !== JSON.stringify(primo));
  const slot: ArenaSlot[] = [primo];
  while (slot.length < ARENA.slot && resto.length) slot.push(resto.splice(rng.int(0, resto.length - 1), 1)[0]!);
  if (rng.next() < 0.5) slot.reverse();
  return { dote: rng.pick(ARENA.build.doti).id, slot, ulti: rng.pick(ARENA.ulti.lista).id };
}
