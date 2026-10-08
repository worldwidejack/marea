// Impianto di Drenaggio (Epopea della Regata, dungeon 1; docs/RPG.md §2): bacini allagati che le valvole svuotano, geyser di vapore del
// Capoturno, rallentamento del Tubo-strisciante. Tutto uguale per tutti gli eroi (sim deterministica, niente funzioni trascendenti); negli
// altri dungeon le liste sono vuote e qui non succede niente.
import type { EnemyDef } from '@marea/content/rpg.ts';
import type { Bacino, DungeonState, Enemy } from './state.ts';
import { conEroe, ev, finita, inGioco, secToTicks } from './state.ts';
import { hitHero } from './combat.ts';
import { isSolid } from './map.ts';
import { GEYSER_DIR, RAGGIO_VALVOLA, SCOLO_TICKS } from './tuning.ts';

const r2 = (v: number): number => Math.round(v * 100) / 100;
const bacinoDi = (s: DungeonState, n: number): Bacino | undefined => s.bacini.find((b) => b.n === n);

/** Livello dell'acqua di un bacino: 1 = pieno, 0 = asciutto (scende mentre scola). */
export const livello = (b: Bacino): number => (!b.aperta ? 1 : b.scolo / SCOLO_TICKS);

/** Valvola ancora chiusa accanto all'eroe di turno (indice in map.valvole), o -1. */
export function valvolaVicina(s: DungeonState): number {
  const h = s.hero;
  for (let i = 0; i < s.map.valvole.length; i++) {
    const v = s.map.valvole[i]!;
    if (bacinoDi(s, v.n)?.aperta) continue;
    const dx = v.x - h.x, dz = v.z - h.z;
    if (dx * dx + dz * dz <= RAGGIO_VALVOLA * RAGGIO_VALVOLA) return i;
  }
  return -1;
}

/** A accanto alla valvola i: la gira e il suo bacino comincia a svuotarsi (per tutti). */
export function apriValvola(s: DungeonState, i: number): void {
  const v = s.map.valvole[i], b = v ? bacinoDi(s, v.n) : undefined;
  if (!v || !b || b.aperta) return;
  b.aperta = true; b.scolo = SCOLO_TICKS;
  ev(s, { t: 'valvola', n: v.n });
}

/** Fine tick: i bacini aperti scolano; all'asciutto le loro celle diventano pavimento e i nemici rifanno le strade (flow field). */
export function stepAcque(s: DungeonState): void {
  for (const b of s.bacini) {
    if (!b.aperta || b.scolo <= 0) continue;
    b.scolo--;
    if (b.scolo > 0) continue;
    for (const i of s.map.bacini.find((x) => x.n === b.n)?.celle ?? []) s.map.solid[i] = 0;
    s.flowTick = -999; s.flowCell = -1; s.flowKey = '';
    ev(s, { t: 'asciutto', n: b.n });
  }
}

/** Colpo ad area di un nemico con `geyser` (il Capoturno): un geyser sotto ogni eroe in gioco e `n` attorno a lui, a giro diverso a
 *  ogni colpo. Sui muri e sull'acqua non nasce niente. */
export function geyserDa(s: DungeonState, e: Enemy): void {
  const g = e.def.geyser;
  if (!g) return;
  const punti: { x: number; z: number }[] = [];
  for (const i of inGioco(s)) { const h = s.eroi[i]!.hero; punti.push({ x: h.x, z: h.z }); }
  const passo = Math.max(1, Math.floor(GEYSER_DIR.length / Math.max(1, g.n)));
  for (let k = 0; k < g.n; k++) {
    const [dx, dz] = GEYSER_DIR[(e.attacchi + k * passo) % GEYSER_DIR.length]!;
    punti.push({ x: e.x + dx * g.distanza, z: e.z + dz * g.distanza });
  }
  for (const p of punti) {
    if (isSolid(s.map, Math.floor(p.x / s.map.tile), Math.floor(p.z / s.map.tile))) continue;
    s.geyser.push({ id: s.nextId++, x: p.x, z: p.z, r: g.raggio, t: 0, avviso: secToTicks(g.avviso), getto: secToTicks(g.getto), danno: g.danno, colpiti: [] });
  }
}

/** Fine tick: i geyser avvisano, poi eruttano e prendono (una volta) chi ci sta dentro. */
export function stepGeyser(s: DungeonState): void {
  if (!s.geyser.length) return;
  const keep: DungeonState['geyser'] = [];
  for (const g of s.geyser) {
    g.t++;
    if (g.t === g.avviso + 1) ev(s, { t: 'geyser', x: r2(g.x), z: r2(g.z) });
    if (g.t > g.avviso) {
      for (const i of inGioco(s)) {
        if (g.colpiti.includes(i)) continue;
        conEroe(s, i, () => {
          const h = s.hero, dx = h.x - g.x, dz = h.z - g.z, r = g.r + s.runHero.raggio;
          if (dx * dx + dz * dz > r * r) return;
          g.colpiti.push(i);
          hitHero(s, g.danno, 'contundente', h.x, h.z);
        });
        if (finita(s)) return;
      }
    }
    if (g.t < g.avviso + g.getto) keep.push(g);
  }
  s.geyser = keep;
}

/** Colpo andato a segno di un nemico che rallenta (Tubo-strisciante) sull'eroe di turno. */
export function rallenta(s: DungeonState, def: EnemyDef): void {
  const r = def.rallenta, h = s.hero;
  if (!r || s.done) return;
  const gia = h.lento > 0;
  h.lento = Math.max(h.lento, secToTicks(r.secondi)); h.lentoMolt = r.molt;
  if (!gia) ev(s, { t: 'rallentato' });
}
