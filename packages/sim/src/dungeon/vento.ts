// Archivio Navigazionale (Epopea della Regata, dungeon 2; docs/RPG.md §2d): correnti d'aria che soffiano a raffiche (o sempre, la
// tempesta del Condotto Maestro) e spingono chi ci cammina, ripari sottovento degli scaffali, timoni che fermano una corrente per tutti,
// spinte da fuori sull'eroe (arpione, raffica dell'Astrolabio, bombe a pressione) con l'urto contro i muri. Tutto uguale per tutti gli
// eroi (sim deterministica, niente funzioni trascendenti); negli altri dungeon le liste sono vuote e qui non succede niente.
import { DT } from '../constants.ts';
import type { DungeonState, Enemy, HeroRt } from './state.ts';
import { conEroe, ev, inGioco, secToTicks } from './state.ts';
import { hitHero } from './combat.ts';
import { cellOf, moveCircle } from './map.ts';
import type { DMap } from './map.ts';
import { AVVISO_RAFFICA, HZ, RAGGIO_TIMONE, URTO_FRAZ } from './tuning.ts';

const r2 = (v: number): number => Math.round(v * 100) / 100;
type VentoDef = DMap['venti'][number];
export type StatoVento = 'calma' | 'avviso' | 'soffia' | 'ferma';

/** Stato di una corrente a questo tick e fase 0..1 dentro lo stato (per l'avviso e la resa). */
export function statoVento(s: DungeonState, v: VentoDef): { stato: StatoVento; t: number } {
  if (s.correnti.find((c) => c.n === v.n)?.ferma) return { stato: 'ferma', t: 0 };
  const on = secToTicks(v.soffia), off = Math.max(0, Math.round(v.pausa * HZ));
  if (off === 0) return { stato: 'soffia', t: 0 };
  const k = (s.tick + Math.round(v.fase * HZ)) % (on + off);
  if (k < on) return { stato: 'soffia', t: k / on };
  const avviso = Math.min(AVVISO_RAFFICA, off);
  return k >= on + off - avviso ? { stato: 'avviso', t: (k - (on + off - avviso)) / avviso } : { stato: 'calma', t: (k - on) / off };
}

/** Corrente che soffia adesso sulla cella i (null = niente vento lì). `riparo`: la cella sopravvento è uno scaffale o un muro. */
function ventoSu(s: DungeonState, i: number): { v: VentoDef; riparo: boolean } | null {
  const n = i >= 0 ? s.map.zona[i]! : 0;
  if (!n) return null;
  const v = s.map.venti.find((x) => x.n === n);
  if (!v || statoVento(s, v).stato !== 'soffia') return null;
  const m = s.map, cx = i % m.w, cz = (i - cx) / m.w, ux = cx - v.dx, uz = cz - v.dz;
  return { v, riparo: ux >= 0 && uz >= 0 && ux < m.w && uz < m.h && m.opaque[uz * m.w + ux] === 1 };
}
/** L'eroe di turno sta in una corrente che soffia, al riparo dietro uno scaffale (per la vista). */
export function alRiparo(s: DungeonState): boolean {
  const w = ventoSu(s, cellOf(s.map, s.hero.x, s.hero.z));
  return !!w && w.riparo;
}
/** L'eroe di turno sta in una corrente che soffia e lo spinge (per la vista). */
export function nelVento(s: DungeonState): boolean {
  const w = ventoSu(s, cellOf(s.map, s.hero.x, s.hero.z));
  return !!w && !w.riparo;
}

/** Timone di una corrente ancora libera accanto all'eroe di turno (indice in map.timoni), o -1. */
export function timoneVicino(s: DungeonState): number {
  const h = s.hero;
  for (let i = 0; i < s.map.timoni.length; i++) {
    const t = s.map.timoni[i]!;
    if (s.correnti.find((c) => c.n === t.n)?.ferma) continue;
    const dx = t.x - h.x, dz = t.z - h.z;
    if (dx * dx + dz * dz <= RAGGIO_TIMONE * RAGGIO_TIMONE) return i;
  }
  return -1;
}
/** A accanto al timone i: la sua corrente si ferma per sempre (per tutti). */
export function giraTimone(s: DungeonState, i: number): void {
  const t = s.map.timoni[i], c = t ? s.correnti.find((x) => x.n === t.n) : undefined;
  if (!t || !c || c.ferma) return;
  c.ferma = true;
  ev(s, { t: 'timone', n: t.n });
}

/** Spinta da fuori sull'eroe di turno: `m` metri lungo (dx, dz) (versore) in `sec` secondi; `urto` = danno se sbatte contro un muro. */
export function spingi(s: DungeonState, dx: number, dz: number, m: number, sec: number, urto = 0): void {
  const h = s.hero;
  if (s.done || h.protetto > 0) return;
  const t = secToTicks(sec), v = m / (t * DT);
  h.spX = dx * v; h.spZ = dz * v; h.spT = t; h.spUrto = urto;
}

/** Il vento sposta chi cammina: eroi e nemici a terra (non chi vola, non le torrette, non i capi, non chi sta sulle grate). */
function spostaNemico(s: DungeonState, e: Enemy): boolean {
  return !e.def.boss && e.def.muove !== 'vola' && e.def.comportamento !== 'torretta' && e.st !== 'morto';
}

/** Fine tick (dopo nemici e proiettili): correnti che soffiano su eroi e nemici, spinte da fuori sugli eroi (urto contro i muri). */
export function stepVento(s: DungeonState): void {
  const m = s.map;
  if (m.venti.length) {
    for (const i of inGioco(s)) {
      const r = s.eroi[i]!, h = r.hero, w = ventoSu(s, cellOf(m, h.x, h.z));
      if (w && !w.riparo) moveCircle(m, h, w.v.dx * w.v.forza * DT, w.v.dz * w.v.forza * DT, r.runHero.raggio);
    }
    for (const e of s.enemies) {
      if (!spostaNemico(s, e)) continue;
      const w = ventoSu(s, cellOf(m, e.x, e.z)); // sulle grate non c'è vento: il Drone Idro-Ragno resta aggrappato
      if (w && !w.riparo) moveCircle(m, e, w.v.dx * w.v.forza * DT, w.v.dz * w.v.forza * DT, e.def.raggio);
    }
  }
  for (const i of inGioco(s)) {
    const h = s.eroi[i]!.hero;
    if (h.spT <= 0) continue;
    conEroe(s, i, () => spinta(s, h));
  }
}
function spinta(s: DungeonState, h: HeroRt): void {
  const x0 = h.x, z0 = h.z, sx = h.spX * DT, sz = h.spZ * DT;
  moveCircle(s.map, h, sx, sz, s.runHero.raggio);
  h.spT--;
  const fx = h.x - x0, fz = h.z - z0, voluto = sx * sx + sz * sz;
  if (h.spUrto > 0 && fx * fx + fz * fz < voluto * URTO_FRAZ * URTO_FRAZ) {
    // contro il muro: botta (una volta) e la spinta finisce lì
    const urto = h.spUrto;
    h.spT = 0; h.spUrto = 0;
    ev(s, { t: 'urto', x: r2(h.x), z: r2(h.z) });
    hitHero(s, urto, 'contundente', h.x, h.z);
  }
}

/** Bombardiere (Aerostato-Spia): bomba a pressione dove sta l'eroe di turno, che scoppia dopo la caduta (stepGeyser in acque.ts). */
export function bombaDa(s: DungeonState, e: Enemy): void {
  const b = e.def.bomba;
  if (!b) return;
  e.cdTiro = secToTicks(b.ricarica);
  const h = s.hero;
  s.geyser.push({ id: s.nextId++, x: h.x, z: h.z, r: b.raggio, t: 0, avviso: secToTicks(b.caduta), getto: secToTicks(0.25), danno: b.danno, colpiti: [], spinta: b.spinta });
}
