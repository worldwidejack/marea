// Fucina a Pressione (Epopea della Regata, dungeon 3; docs/RPG.md §2e): colate di lava che respirano (crosta e lava a giro), chiazze di
// fuoco a terra (scia della Fornace Semovente, pozze di magma del Mastro Forgiatore), la bruciatura dell'eroe e le cascate d'acqua che la
// spengono (e spengono le Scintille-Vapore). Tutto uguale per tutti gli eroi (sim deterministica, niente funzioni trascendenti); negli
// altri dungeon le liste sono vuote e qui non succede niente.
import { DT } from '../constants.ts';
import type { DungeonState, Enemy } from './state.ts';
import { conEroe, ev, finita, inGioco, secToTicks } from './state.ts';
import { caduto, kill } from './combat.ts';
import { cellOf } from './map.ts';
import type { DMap } from './map.ts';
import { AVVISO_LAVA, BRUCIA_NUMERO, FUOCHI_MAX, GETTO_RAGGIO, HZ } from './tuning.ts';

type LavaDef = DMap['lave'][number];
export type StatoLava = 'crosta' | 'avviso' | 'scorre';

/** Stato di una colata a questo tick e fase 0..1 dentro lo stato (per l'avviso e la resa). */
export function statoLava(s: DungeonState, v: LavaDef): { stato: StatoLava; t: number } {
  const on = secToTicks(v.scorre), off = Math.max(0, Math.round(v.crosta * HZ));
  if (off === 0) return { stato: 'scorre', t: 0 };
  const k = (s.tick + Math.round(v.fase * HZ)) % (on + off);
  if (k < on) return { stato: 'scorre', t: k / on };
  const avviso = Math.min(AVVISO_LAVA, off);
  return k >= on + off - avviso ? { stato: 'avviso', t: (k - (on + off - avviso)) / avviso } : { stato: 'crosta', t: (k - on) / off };
}

/** La colata sotto (x, z) se adesso scorre (null = crosta, o niente lava lì). */
export function lavaSu(s: DungeonState, x: number, z: number): LavaDef | null {
  const i = cellOf(s.map, x, z), n = i >= 0 ? s.map.lava[i]! : 0;
  if (!n) return null;
  const v = s.map.lave.find((l) => l.n === n);
  return v && statoLava(s, v).stato === 'scorre' ? v : null;
}

/** Sotto una cascata d'acqua: entro GETTO_RAGGIO (più `r`) dal centro di una cella `getto`. */
export function inGetto(s: DungeonState, x: number, z: number, r = 0): boolean {
  const rr = (GETTO_RAGGIO + r) * (GETTO_RAGGIO + r);
  for (const g of s.map.getti) { const dx = g.x - x, dz = g.z - z; if (dx * dx + dz * dz <= rr) return true; }
  return false;
}

/** L'eroe di turno prende fuoco (o il fuoco si ravviva): brucia `dps` vita al secondo per `sec` s. Sotto una cascata, appena
 *  risvegliato o a spedizione finita niente. */
export function brucia(s: DungeonState, dps: number, sec: number): void {
  const h = s.hero;
  if (s.done || h.protetto > 0 || inGetto(s, h.x, h.z)) return;
  if (h.brucia <= 0) ev(s, { t: 'bruciato' });
  h.bruciaDps = h.brucia > 0 ? Math.max(h.bruciaDps, dps) : dps;
  h.brucia = Math.max(h.brucia, secToTicks(sec));
}

/** Chiazza di fuoco a terra in (x, z) per `durata` s; nell'acqua, sui muri e sulla Colata non attacca. */
export function fuocoA(s: DungeonState, x: number, z: number, r: number, durata: number, dps: number, secondi: number): void {
  const c = cellOf(s.map, x, z);
  if (c < 0 || s.map.solid[c] || inGetto(s, x, z)) return;
  const t = secToTicks(durata);
  s.fuochi.push({ id: s.nextId++, x, z, r, fine: s.tick + t, durata: t, dps, secondi });
  if (s.fuochi.length > FUOCHI_MAX) s.fuochi.shift();
}

/** Fornace Semovente: camminando lascia dietro di sé una chiazza di fuoco ogni `scia.ogni` s (da ferma no). */
export function scia(s: DungeonState, e: Enemy): void {
  const sc = e.def.scia;
  if (!sc || e.st === 'morto' || e.alleato) return;
  if (e.sciaT !== undefined && s.tick - e.sciaT < secToTicks(sc.ogni)) return;
  const dx = e.x - (e.sciaX ?? -1e6), dz = e.z - (e.sciaZ ?? -1e6);
  if (dx * dx + dz * dz < 0.36) return;
  e.sciaX = e.x; e.sciaZ = e.z; e.sciaT = s.tick;
  fuocoA(s, e.x - e.fx * e.def.raggio, e.z - e.fz * e.def.raggio, sc.raggio, sc.durata, sc.dps, sc.secondi);
}

/** Fine tick: le chiazze vecchie si spengono; ogni eroe in gioco sotto una cascata si spegne, se no brucia sulla lava che scorre e nelle
 *  chiazze; chi brucia perde vita (numero ogni mezzo secondo). Le Scintille-Vapore sotto una cascata si spengono. */
export function stepFuoco(s: DungeonState): void {
  if (s.fuochi.length) s.fuochi = s.fuochi.filter((f) => f.fine > s.tick);
  for (const i of inGioco(s)) {
    conEroe(s, i, () => {
      const h = s.hero, r = s.runHero.raggio;
      if (inGetto(s, h.x, h.z)) {
        if (h.brucia > 0) { h.brucia = 0; h.bruciaAcc = 0; ev(s, { t: 'estinto' }); }
        return;
      }
      const v = lavaSu(s, h.x, h.z);
      if (v) brucia(s, v.dps, v.secondi);
      for (const f of s.fuochi) {
        const dx = h.x - f.x, dz = h.z - f.z, rr = f.r + r * 0.5;
        if (dx * dx + dz * dz <= rr * rr) brucia(s, f.dps, f.secondi);
      }
      if (h.brucia > 0) arde(s);
    });
    if (finita(s)) return;
  }
  if (!s.map.getti.length) return;
  for (const e of s.enemies) {
    if (e.st === 'morto' || e.alleato || !e.def.acqua || !inGetto(s, e.x, e.z, e.def.raggio * 0.5)) continue;
    e.vita -= e.def.acqua.danno * DT;
    if (e.vita <= 0) conEroe(s, s.eroi.length > 1 ? e.ultimo ?? 0 : 0, () => kill(s, e));
  }
}

/** Un tick di bruciatura dell'eroe di turno: il danno non guarda l'armatura (è fuoco addosso), si vede a numeri ogni mezzo secondo. */
function arde(s: DungeonState): void {
  const h = s.hero;
  h.brucia--;
  if (h.protetto > 0) return;
  const d = h.bruciaDps * DT;
  h.vita -= d; h.bruciaAcc += d; s.danniPresi += d;
  if ((h.brucia === 0 || h.brucia % BRUCIA_NUMERO === 0) && h.bruciaAcc >= 1) {
    ev(s, { t: 'colpo', x: Math.round(h.x * 100) / 100, z: Math.round(h.z * 100) / 100, danno: Math.round(h.bruciaAcc), su: 'eroe' });
    h.bruciaAcc = 0;
  }
  if (h.vita <= 0) { h.brucia = 0; h.bruciaAcc = 0; caduto(s); }
}
