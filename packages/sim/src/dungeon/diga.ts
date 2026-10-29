// La Diga dei Disertori (docs/RPG.md §2g): i rottami acuminati (fanno male a chi ci sta sopra), i piloni dell'arena che la carica del
// Capitano Vaelen fracassa, e le corsie dei colpi dritti (la schiacciata d'ancora della Guardia della Paratia, gli affondi e la carica di
// Vaelen): un rettangolo deciso quando il colpo comincia, che alla fine prende chi ci sta dentro. Il resto della Diga è fatto coi pezzi
// che c'erano: le Ruote di Sentina sono valvole e timoni (acque.ts, vento.ts), le correnti di risacca sono venti, il ponte mobile è un
// bacino. Tutto uguale per tutti gli eroi (sim deterministica, niente funzioni trascendenti); negli altri dungeon qui non succede niente.
import type { HurtKind } from './combat.ts';
import type { DungeonState, Enemy } from './state.ts';
import { conEroe, ev, finita, inGioco, secToTicks } from './state.ts';
import { hitHero } from './combat.ts';
import { cellOf, isOpaque, isSolid } from './map.ts';

const r2 = (v: number): number => Math.round(v * 100) / 100;

/** Fine tick: chi sta sui rottami acuminati si taglia (una volta ogni `ogni` s). */
export function stepRottami(s: DungeonState): void {
  const R = s.def.rottami;
  if (!R) return;
  for (const i of inGioco(s)) {
    conEroe(s, i, () => {
      const h = s.hero, c = cellOf(s.map, h.x, h.z);
      if (c < 0 || !s.map.rottami[c] || h.rottT > s.tick) return;
      h.rottT = s.tick + secToTicks(R.ogni);
      if (h.protetto > 0 || s.runHero.armatura.vampa) return;
      ev(s, { t: 'rottami', x: r2(h.x), z: r2(h.z) });
      hitHero(s, R.danno, 'taglio', h.x, h.z);
    });
    if (finita(s)) return;
  }
}

/** Fin dove arriva un colpo dritto da (x, z) lungo (dx, dz), al massimo `max` m: fino al primo muro, colonna o pilone (`solido` = anche
 *  l'acqua, per chi ci corre sopra: la carica). `pilone` = il pilone che lo ferma (indice in map.piloni), -1 = un'altra cosa o niente. */
export function corsiaFino(s: DungeonState, x: number, z: number, dx: number, dz: number, max: number, solido = false): { len: number; pilone: number } {
  const t = s.map.tile;
  let l = 0;
  while (l < max) {
    const nl = Math.min(max, l + 0.25), cx = Math.floor((x + dx * nl) / t), cz = Math.floor((z + dz * nl) / t);
    if (solido ? isSolid(s.map, cx, cz) : isOpaque(s.map, cx, cz)) return { len: l, pilone: piloneIn(s, cx, cz) };
    l = nl;
  }
  return { len: l, pilone: -1 };
}

/** L'eroe di turno sta nella corsia del nemico: dal nemico lungo `e.mira` (versore e lunghezza), larga `largo` m per lato. */
export function inCorsia(s: DungeonState, e: Enemy, largo: number): boolean {
  const m = e.mira;
  if (!m) return false;
  const h = s.hero, r = s.runHero.raggio, rx = h.x - e.x, rz = h.z - e.z, lungo = rx * m.dx + rz * m.dz;
  return lungo >= -r && lungo <= m.len + r && Math.abs(rx * m.dz - rz * m.dx) <= largo + r;
}

/** Il colpo della corsia arriva: tutti gli eroi in gioco dentro la prendono (`danno`); il bersaglio, se è fuori, l'ha schivata. */
export function colpoCorsia(s: DungeonState, e: Enemy, largo: number, danno: number, kind: HurtKind): void {
  const t = s.cur;
  for (const i of inGioco(s)) {
    conEroe(s, i, () => {
      if (inCorsia(s, e, largo)) hitHero(s, danno, kind, s.hero.x, s.hero.z);
      else if (i === t) ev(s, { t: 'schivato', x: r2(s.hero.x), z: r2(s.hero.z) });
    });
    if (finita(s)) return;
  }
}

/** Il pilone ancora in piedi nella cella (cx, cz), o -1. */
export function piloneIn(s: DungeonState, cx: number, cz: number): number {
  const P = s.map.piloni;
  for (let k = 0; k < P.length; k++) if (P[k]!.cx === cx && P[k]!.cz === cz && !s.piloni[k]) return k;
  return -1;
}

/** La carica del Capitano fracassa il pilone k: la cella diventa pavimento (si passa e ci si vede attraverso) e i nemici rifanno le
 *  strade (flow field e griglie di chi vola). */
export function rompiPilone(s: DungeonState, k: number): void {
  const p = s.map.piloni[k];
  if (!p || s.piloni[k]) return;
  s.piloni[k] = true;
  s.map.solid[p.i] = 0; s.map.opaque[p.i] = 0;
  s.flowTick = -999; s.flowCell = -1; s.flowKey = ''; s.griglie = {}; s.flowAlt = {};
  ev(s, { t: 'pilone', x: r2(p.x), z: r2(p.z) });
}
