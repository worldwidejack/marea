// Il pilota automatico nel Tempio della «Doppia Nera» (lo usano i test e la modalità demo; autopilot.ts lo chiama in tre punti): fa la strada del ghiaccio come un
// rompicapo (ghiaccio_nav.ts), esce da tutto quello che il gioco gli mostra a terra (anello della trottola, cerchi delle fiasche, chiazze, linee dello Sparaneve, cono
// della frenata, quadrato del salto, X della lamina, cerchi di gelo dello slalom) e va a spaccare l'ultima bandierina dello Slalom prima che Jean-Claude ci arrivi.
import type { DungeonState } from './state.ts';
import { cellCenter, cellOf, clearPath } from './map.ts';
import { viaGhiaccio } from './ghiaccio_nav.ts';
import { gelo } from './ghiaccio.ts';
import { DIR16 } from './tuning.ts';

type Dir = { x: number; z: number };
const norm = (dx: number, dz: number): Dir => { const d = Math.sqrt(dx * dx + dz * dz); return d > 1e-6 ? { x: dx / d, z: dz / d } : { x: 0, z: 0 }; };
const ICE = new WeakMap<object, number[]>();

/** Le stanze con ghiaccio ancora vivo (le cache stanno per mappa). */
function stanzeGelo(s: DungeonState): boolean {
  let l = ICE.get(s.map);
  if (!l) { l = [...new Set(s.map.ghiaccio)].filter((n) => n > 0); ICE.set(s.map, l); }
  return l.some((n) => !s.sciolti.includes(n));
}

/** Verso (gx, gz) per la strada del ghiaccio. undefined = qui non serve (niente ghiaccio vivo, o ci siamo già): vale la camminata di sempre; null = non ci si arriva. */
export function navGhiaccio(s: DungeonState, gx: number, gz: number): Dir | null | undefined {
  if (!stanzeGelo(s)) return undefined;
  const m = s.map, h = s.hero;
  if (h.slideDir) return { x: 0, z: 0 }; // sta scivolando: i piedi non servono
  const da = cellOf(m, h.x, h.z), goal = cellOf(m, gx, gz);
  if (da < 0 || goal < 0 || da === goal) return undefined;
  const blocchi = new Set<number>(s.enemies.filter((e) => e.st !== 'morto' && !e.alleato && e.def.velocita === 0).map((e) => cellOf(m, e.x, e.z)));
  const metas = [goal, goal + 1, goal - 1, goal + m.w, goal - m.w].filter((c) => c >= 0 && c < m.w * m.h && !m.solid[c] && !blocchi.has(c));
  if (metas.includes(da)) return undefined;
  const mo = viaGhiaccio(s, da, metas, blocchi);
  if (!mo) return null;
  if (mo.scivola) return { x: mo.dir[0], z: mo.dir[1] };
  const c = cellCenter(m, mo.a);
  return norm(c.x - h.x, c.z - h.z);
}

const inCerchio = (x: number, z: number, cx: number, cz: number, r: number): boolean => (x - cx) * (x - cx) + (z - cz) * (z - cz) < r * r;
const inQuadro = (x: number, z: number, cx: number, cz: number, lato: number): boolean => Math.abs(x - cx) < lato / 2 && Math.abs(z - cz) < lato / 2;
function distSegmento(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz, t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / l2)) : 0;
  return Math.sqrt((px - ax - vx * t) * (px - ax - vx * t) + (pz - az - vz * t) * (pz - az - vz * t));
}

/** In (x, z) il gioco ha segnato un colpo in arrivo (le chiazze già a terra no: ci si passa, costano poco e farle girare in tondo bloccherebbe il pilota). */
function pericolo(s: DungeonState, x: number, z: number): boolean {
  const r = s.runHero.raggio + 0.3;
  for (const g of s.geyser) if (g.t <= g.avviso + g.getto && inCerchio(x, z, g.x, g.z, g.r + r)) return true;
  for (const e of s.enemies) {
    if (e.st === 'morto' || e.alleato) continue;
    const D = e.def, m = e.mira;
    if (D.trottola && e.modo === 'trottola' && (e.st === 'prepara' || e.st === 'colpisce') && inCerchio(x, z, e.x, e.z, D.trottola.raggio + r + 0.5)) return true;
    if (D.fiasche && e.modo === 'fiasca' && e.st === 'prepara' && m && inCerchio(x, z, m.dx, m.dz, D.fiasche.raggio + r)) return true;
    if (D.raffica && e.modo === 'raffica' && e.st === 'prepara') {
      const R = D.raffica, f = e.fx, g = e.fz;
      for (const k of [-1, 0, 1]) { const a = k * R.angolo, vx = f - g * a, vz = g + f * a, l = Math.sqrt(vx * vx + vz * vz); if (distSegmento(x, z, e.x, e.z, e.x + (vx / l) * R.gittata, e.z + (vz / l) * R.gittata) < 0.9 + r) return true; }
    }
    const C = D.claude;
    if (!C) continue;
    if (e.modo === 'frenata' && e.st === 'prepara') { const dx = x - e.x, dz = z - e.z, d = Math.sqrt(dx * dx + dz * dz); if (d < C.frenata.gittata + 0.5 && d > 1e-6 && (dx * e.fx + dz * e.fz) / d > C.frenata.cono - 0.2) return true; }
    if (e.modo === 'salto' && e.st === 'prepara' && m && e.stT >= e.stDur - 40 && inQuadro(x, z, m.dx, m.dz, C.salto.lato + r)) return true;
    if (e.modo === 'lamina' && e.st === 'prepara' && m && inQuadro(x, z, m.dx, m.dz, C.lamina.lato + r)) return true;
  }
  return false;
}

/** Dove si sta male, la direzione verso il posto sicuro più vicino (null = va bene qui). */
export function viaDaiPericoliBaita(s: DungeonState): Dir | null {
  const h = s.hero;
  if (h.slideDir || !pericolo(s, h.x, h.z)) return null;
  let best: Dir | null = null, bd = Infinity;
  for (const k of [1.5, 2.5, 3.5, 4.5, 6]) for (const [dx, dz] of DIR16) {
    const x = h.x + dx * k, z = h.z + dz * k, c = cellOf(s.map, x, z);
    if (c < 0 || s.map.solid[c] || gelo(s, c) || pericolo(s, x, z) || !clearPath(s.map, h.x, h.z, x, z, s.runHero.raggio)) continue;
    if (k < bd) { bd = k; best = { x: dx, z: dz }; }
  }
  return best;
}

/** Slalom: la bandierina da spaccare (l'ultima ancora in piedi) e se siamo già a portata. */
export function bandierinaDaSpaccare(s: DungeonState, portata: number): { x: number; z: number; vicino: boolean } | null {
  const b = [...s.bandierine].reverse().find((x) => !x.abbattuta);
  if (!b || !s.enemies.some((e) => e.def.claude && e.modo === 'slalom' && e.st !== 'morto')) return null;
  return { x: b.x, z: b.z, vicino: (b.x - s.hero.x) * (b.x - s.hero.x) + (b.z - s.hero.z) * (b.z - s.hero.z) <= (portata + 0.3) * (portata + 0.3) };
}
