// Il Santuario del Capo Ardente, il Fuoco del Giuramento (docs/SANTUARIO.md): i bracieri spenti che si accendono con un tocco (A accanto), le stanze che
// si chiudono quando sono tutti accesi (le trappole di lava fanno la crosta, il bacino di lava davanti si raffredda e si passa), la luce che rivela lo
// Sciamano del Fumo, il riparo contro le ondate di calore (l'area 3×3 attorno a ogni braciere acceso) e le ondate di calore stesse. Tutto uguale per tutti
// gli eroi (sim deterministica, niente funzioni trascendenti); negli altri dungeon le liste sono vuote e qui non succede niente.
import type { DungeonState, Enemy } from './state.ts';
import { conEroe, ev, finita, inGioco, secToTicks } from './state.ts';
import { hitHero } from './combat.ts';
import { HZ, SCOLO_TICKS } from './tuning.ts';

/** A entro questa distanza dal centro del braciere (cioè da una cella accanto) lo accende. */
const RAGGIO_BRACIERE = 2.7;
/** L'area di un braciere acceso: 3×3 celle, cioè fino a una cella e mezza dal centro (riparo e luce). */
const AREA_CELLE = 1.5;

/** Il braciere spento più vicino all'eroe di turno entro RAGGIO_BRACIERE (indice in map.bracieri), o -1. */
export function braciereVicino(s: DungeonState): number {
  const h = s.hero;
  let best = -1, bd = RAGGIO_BRACIERE * RAGGIO_BRACIERE;
  for (let i = 0; i < s.map.bracieri.length; i++) {
    if (s.bracieri[i]) continue;
    const b = s.map.bracieri[i]!, dx = b.x - h.x, dz = b.z - h.z, d = dx * dx + dz * dz;
    if (d <= bd) { bd = d; best = i; }
  }
  return best;
}

/** Tutti i bracieri della stanza n sono accesi (e ce n'è almeno uno). */
export function stanzaAcca(s: DungeonState, n: number): boolean {
  let c = 0;
  for (let i = 0; i < s.map.bracieri.length; i++) if (s.map.bracieri[i]!.n === n) { if (!s.bracieri[i]) return false; c++; }
  return c > 0;
}

/** A accanto al braciere i: lo accende (per tutti). Con l'ultimo della stanza si chiude: il bacino di lava col suo numero comincia a raffreddarsi. */
export function accendi(s: DungeonState, i: number): void {
  const b = s.map.bracieri[i];
  if (!b || s.bracieri[i]) return;
  s.bracieri[i] = true;
  ev(s, { t: 'braciere', i, n: b.n, acceso: true });
  if (!stanzaAcca(s, b.n)) return;
  const bac = s.bacini.find((x) => x.n === b.n);
  if (bac && !bac.aperta) { bac.aperta = true; bac.scolo = SCOLO_TICKS; }
  ev(s, { t: 'stanza', n: b.n });
}

/** Il braciere i si spegne (un calcio del Colosso, un globo di lava che ci cade vicino). */
export function spegni(s: DungeonState, i: number): void {
  const b = s.map.bracieri[i];
  if (!b || !s.bracieri[i]) return;
  s.bracieri[i] = false;
  ev(s, { t: 'braciere', i, n: b.n, acceso: false });
}

/** Spegne i bracieri accesi entro `r` m da (x, z). */
export function spegniIn(s: DungeonState, x: number, z: number, r: number): void {
  for (let i = 0; i < s.map.bracieri.length; i++) {
    const b = s.map.bracieri[i]!, dx = b.x - x, dz = b.z - z;
    if (s.bracieri[i] && dx * dx + dz * dz <= r * r) spegni(s, i);
  }
}

/** (x, z) sta nell'area 3×3 di un braciere acceso: lì l'aria non brucia e si vede. */
export function alRiparoBraciere(s: DungeonState, x: number, z: number): boolean {
  const a = AREA_CELLE * s.map.tile;
  for (let i = 0; i < s.map.bracieri.length; i++) {
    const b = s.map.bracieri[i]!;
    if (s.bracieri[i] && Math.abs(x - b.x) <= a && Math.abs(z - b.z) <= a) return true;
  }
  return false;
}

/** Il braciere acceso più vicino a (x, z) entro `r` m (indice in map.bracieri), o -1. */
export function braciereAcceso(s: DungeonState, x: number, z: number, r: number): number {
  let best = -1, bd = r * r;
  for (let i = 0; i < s.map.bracieri.length; i++) {
    if (!s.bracieri[i]) continue;
    const b = s.map.bracieri[i]!, dx = b.x - x, dz = b.z - z, d = dx * dx + dz * dz;
    if (d <= bd) { bd = d; best = i; }
  }
  return best;
}

/** Lo Sciamano del Fumo che nessuno vede: lontano da ogni braciere acceso e mai colpito alla lanterna. Non si prende, né di mira né di lama. */
export function nascosto(s: DungeonState, e: Enemy): boolean {
  const S = e.def.sciamano;
  return !!S && e.st !== 'morto' && !e.rivelato && braciereAcceso(s, e.x, e.z, S.rivela) < 0;
}

/** Stato di un'ondata di calore a questo tick: tick dentro il giro e se sta per scoppiare. */
function giro(s: DungeonState, o: { ogni: number; avviso: number; fase?: number }): { k: number; P: number; A: number } {
  const P = secToTicks(o.ogni), A = Math.min(P - 1, secToTicks(o.avviso));
  return { k: (s.tick + Math.round((o.fase ?? 0) * HZ)) % P, P, A };
}

/** Per la vista: le ondate di calore con la zona in m, e se l'aria sta già scaldando (avviso) con la fase 0..1. */
export function caloreVista(s: DungeonState): { n: number; zona: [number, number, number, number]; stato: 'calma' | 'avviso'; t: number }[] {
  const T = s.map.tile;
  return (s.def.ondate ?? []).map((o) => {
    const { k, P, A } = giro(s, o), da = P - A;
    return { n: o.n, zona: [o.zona[0] * T, o.zona[1] * T, (o.zona[2] + 1) * T, (o.zona[3] + 1) * T] as [number, number, number, number], stato: k >= da ? 'avviso' as const : 'calma' as const, t: k >= da ? (k - da) / A : 0 };
  });
}

/** Fine tick: scoppia l'ondata di calore (dopo `avviso` s di aria che scalda): prende chi sta nella sua zona, tranne al riparo di un braciere acceso
 *  e chi indossa il Manto del Primo Lucignolo. */
export function stepCalore(s: DungeonState): void {
  for (const o of s.def.ondate ?? []) {
    const { k } = giro(s, o);
    if (k !== 0 || s.tick === 0) continue;
    for (const i of inGioco(s)) {
      conEroe(s, i, () => {
        const h = s.hero, T = s.map.tile, cx = Math.floor(h.x / T), cz = Math.floor(h.z / T);
        if (cx < o.zona[0] || cx > o.zona[2] || cz < o.zona[1] || cz > o.zona[3]) return;
        if (s.runHero.armatura.vampa || alRiparoBraciere(s, h.x, h.z)) return;
        ev(s, { t: 'calore' });
        hitHero(s, o.danno, 'magia', h.x, h.z);
      });
      if (finita(s)) return;
    }
  }
}
