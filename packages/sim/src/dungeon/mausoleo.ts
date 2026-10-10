// Mausoleo Cinetico (Epopea della Regata, dungeon 4; docs/RPG.md §2f): le lancette giganti dell'orologio del Pilone 4 e le onde d'acqua
// (l'ondata del Custode dell'Egida, la scarica della sua Barriera). Le lancette girano a terra attorno al perno a velocità costante: chi
// ci sta sopra prende la botta e vola avanti nel verso del giro (poi quella lancetta per un po' non lo riprende); agli automi non fanno
// niente. Le onde si allargano dal centro: prendono chi sta sulla cresta, tranne nei varchi e dietro le colonne. Tutto uguale per tutti
// gli eroi (sim deterministica, niente funzioni trascendenti: onde.ts); negli altri dungeon le liste sono vuote e qui non succede niente.
import { DT } from '../constants.ts';
import type { DungeonState } from './state.ts';
import { conEroe, ev, finita, inGioco, secToTicks } from './state.ts';
import { hitHero } from './combat.ts';
import { lineOfSight } from './map.ts';
import { spingi } from './vento.ts';
import { lancettaDir } from './onde.ts';

const r2 = (v: number): number => Math.round(v * 100) / 100;

/** Fine tick: ogni lancetta prende gli eroi in gioco che le stanno sopra (una volta ogni `pausa`). */
export function stepLancette(s: DungeonState): void {
  const L = s.map.lancette;
  for (let k = 0; k < L.length; k++) {
    const l = L[k]!, [dx, dz] = lancettaDir(l, s.tick);
    for (const i of inGioco(s)) {
      conEroe(s, i, () => {
        const h = s.hero, r = s.runHero.raggio;
        if (h.protetto > 0 || (h.lancT[k] ?? -1) > s.tick) return;
        const rx = h.x - l.x, rz = h.z - l.z, lungo = rx * dx + rz * dz;
        if (lungo < 0 || lungo > l.lunga + r) return;
        if (Math.abs(rx * dz - rz * dx) > l.largo + r) return;
        h.lancT[k] = s.tick + secToTicks(l.pausa);
        ev(s, { t: 'lancetta', x: r2(h.x), z: r2(h.z) });
        hitHero(s, l.danno, 'contundente', h.x, h.z);
        // via nel verso del giro (la lancetta spazza), un filo verso fuori
        if (s.done) return;
        const g = l.giro >= 0 ? 1 : -1, px = -dz * g + dx * 0.3, pz = dx * g + dz * 0.3, pl = Math.sqrt(px * px + pz * pz);
        spingi(s, px / pl, pz / pl, l.spinta, 0.3);
      });
      if (finita(s)) return;
    }
  }
}

/** Fine tick: le onde si allargano e prendono (una volta) chi sta sulla cresta allo scoperto; finita la corsa spariscono. */
export function stepOnde(s: DungeonState): void {
  const keep: DungeonState['onde'] = [];
  for (const o of s.onde) {
    o.r += o.v * DT;
    for (const i of inGioco(s)) {
      if (o.colpiti.includes(i)) continue;
      conEroe(s, i, () => {
        const h = s.hero, dx = h.x - o.x, dz = h.z - o.z, d = Math.sqrt(dx * dx + dz * dz), r = s.runHero.raggio;
        if (Math.abs(d - o.r) > o.spessore + r) return;
        if (d > 1e-6) for (const [vx, vz] of o.varchi) if ((dx * vx + dz * vz) / d >= o.largo) return; // nel varco
        if (!lineOfSight(s.map, o.x, o.z, h.x, h.z)) return; // dietro una colonna
        o.colpiti.push(i);
        const arriva = h.protetto <= 0;
        hitHero(s, o.danno, 'contundente', h.x, h.z);
        if (arriva && !s.done) spingi(s, d > 1e-6 ? dx / d : h.fx, d > 1e-6 ? dz / d : h.fz, o.spinta, 0.35);
      });
      if (finita(s)) return;
    }
    if (o.r < o.max) keep.push(o);
  }
  s.onde = keep;
}
