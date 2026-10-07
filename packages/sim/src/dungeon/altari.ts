// Altari di salvataggio (docs/RPG.md §4, scelta di Riccardo): passandoci sopra, il bottino e le monete raccolti fin lì sono al sicuro
// (s.salvato). Morendo dopo un altare l'eroe si risveglia sull'ultimo toccato: barre piene, bottino e monete di quel momento (il resto è
// perso, i forzieri aperti restano vuoti), qualche secondo senza danni; i nemici smettono di inseguirlo finché non lo rivedono.
import { RPG } from '@marea/content/rpg.ts';
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

/** Dopo la raccolta del tick: entrando su un altare salva bottino e monete. Evento solo se cambia qualcosa (altare o bottino). */
export function stepAltari(s: DungeonState): void {
  const i = altareSotto(s);
  if (i >= 0 && i !== s.altare) {
    const p = s.salvato;
    if (!p || p.altare !== i || p.monete !== s.monete || !sameBag(p.bottino, s.bottino)) {
      s.salvato = { altare: i, tick: s.tick, bottino: { ...s.bottino }, monete: s.monete };
      s.eventi.push({ t: 'altare', n: i });
    }
  }
  s.altare = i;
}

/** Morte con un altare salvato: risveglio lì invece della fine della spedizione. */
export function risveglio(s: DungeonState): void {
  const sv = s.salvato!, a = s.map.altari[sv.altare]!, h = s.hero, max = s.runHero.max;
  h.x = a.x; h.z = a.z;
  h.vita = max.vita; h.magicka = max.magicka; h.stamina = max.stamina;
  h.act = 'idle'; h.actT = 0; h.actDur = 0; h.carica = 0; h.caricato = false; h.colpito = false;
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
