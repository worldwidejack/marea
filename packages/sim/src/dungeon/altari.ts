// Altari di salvataggio, le «lanterne» (docs/RPG.md §4, scelte di Riccardo): standoci sopra compaiono SALVA ed ESCI (azioni del menu, v5).
// SALVA: il bottino e le monete raccolti fin lì sono al sicuro (s.salvato). ESCI: fuori col bottino, come dalla scala, e alla discesa dopo si
// può ripartire da quella lanterna. Morendo dopo un salvataggio l'eroe si risveglia su quella lanterna: barre piene, bottino e monete di quel
// momento (il resto è perso, i forzieri aperti restano vuoti), qualche secondo senza danni; i nemici smettono di inseguirlo finché non lo
// rivedono. Fino al v4 si salvava da soli passandoci sopra: non si capiva (Riccardo, 7 ott 2026).
import { RPG } from '@marea/content/rpg.ts';
import type { DungeonEvent } from './types.ts';
import type { Bag, DungeonState } from './state.ts';
import { secToTicks } from './state.ts';
import { RAGGIO_ALTARE } from './tuning.ts';

/** Indice dell'altare sotto l'eroe, o -1. */
export function altareSotto(s: DungeonState): number {
  const h = s.hero;
  for (let i = 0; i < s.map.altari.length; i++) {
    const a = s.map.altari[i]!, dx = a.x - h.x, dz = a.z - h.z;
    if (dx * dx + dz * dz <= RAGGIO_ALTARE * RAGGIO_ALTARE) return i;
  }
  return -1;
}

function sameBag(a: Bag, b: Bag): boolean {
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => a[k] === b[k]);
}

/** Fine tick: la lanterna sotto l'eroe (-1 = nessuna). Non salva da sola: lo fa l'azione `salva`. */
export function stepAltari(s: DungeonState): void {
  s.altare = altareSotto(s);
}

/** Sulla lanterna i (di default quella sotto l'eroe) è già salvato tutto quello che hai adesso? */
export function salvatoQui(s: DungeonState, i = altareSotto(s)): boolean {
  const p = s.salvato;
  return !!p && i >= 0 && p.altare === i && p.monete === s.monete && sameBag(p.bottino, s.bottino);
}

/** Azione `salva`: sulla lanterna, bottino e monete al sicuro. null se non sei su una lanterna o lì è già salvato tutto. */
export function salvaQui(s: DungeonState): DungeonEvent[] | null {
  const i = altareSotto(s);
  if (i < 0 || salvatoQui(s, i)) return null;
  s.salvato = { altare: i, tick: s.tick, bottino: { ...s.bottino }, monete: s.monete };
  s.altare = i;
  return [{ t: 'altare', n: i }];
}

/** Azione `esci`: sulla lanterna, fuori col bottino (esito «uscito», come dalla scala) ricordando la lanterna per la discesa dopo. */
export function esciQui(s: DungeonState): DungeonEvent[] | null {
  const i = altareSotto(s);
  if (i < 0) return null;
  s.done = true; s.outcome = 'uscito'; s.uscitaLanterna = i;
  return [{ t: 'uscita', lanterna: i }];
}

/** Morte con un altare salvato: risveglio lì invece della fine della spedizione. */
export function risveglio(s: DungeonState): void {
  const sv = s.salvato!, a = s.map.altari[sv.altare]!, h = s.hero, max = s.runHero.max;
  h.x = a.x; h.z = a.z;
  h.vita = max.vita; h.magicka = max.magicka; h.stamina = max.stamina;
  h.act = 'idle'; h.actT = 0; h.actDur = 0; h.carica = 0; h.caricato = false; h.colpiti = []; h.colpito = false;
  h.hurt = 0; h.moving = false; h.running = false; h.buffs = [];
  h.protetto = secToTicks(RPG.dungeon.altare.protezione);
  s.bottino = { ...sv.bottino }; s.monete = sv.monete;
  s.cadute++;
  s.altare = sv.altare; // già sopra l'altare: niente nuovo salvataggio al risveglio
  s.proj = s.proj.filter((p) => !p.dalNemico);
  for (const e of s.enemies) {
    if (e.alleato || e.st === 'morto') continue;
    e.aggro = false; e.area = false; e.tiro = false;
    if (e.st !== 'dorme') { e.st = 'veglia'; e.stT = 0; e.stDur = 0; }
  }
  s.flowTick = -999; // il flow field verso l'eroe va rifatto dalla nuova cella
  s.eventi.push({ t: 'risveglio', n: sv.altare });
}
