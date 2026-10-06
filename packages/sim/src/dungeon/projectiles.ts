// Proiettili 2,5D: frecce con gravità (a terra o su un muro si fermano), magie dritte con esplosione, tiri dei nemici sull'eroe.
import { DT } from '../constants.ts';
import type { DungeonState, Enemy, Proj } from './state.ts';
import { add } from './state.ts';
import { hitEnemy, hitHero } from './combat.ts';
import { isOpaque } from './map.ts';
import { ALTEZZA_BERSAGLIO } from './tuning.ts';

const MARGINE = 0.15;

function explode(s: DungeonState, p: Proj): void {
  for (const e of s.enemies) {
    if (e.alleato || e.st === 'morto') continue;
    const dx = e.x - p.x, dz = e.z - p.z, r = p.raggio + e.def.raggio;
    if (dx * dx + dz * dz <= r * r) hitEnemy(s, e, { danno: p.danno, traits: p.traits, magico: true, skill: null, caricato: false, dirX: 0, dirZ: 0, daAlleato: false });
  }
}

/** Colpisce il primo nemico toccato; true = il proiettile è finito. */
function hitFoes(s: DungeonState, p: Proj): boolean {
  let first: Enemy | null = null, fd = Infinity;
  for (const e of s.enemies) {
    if (e.alleato || e.st === 'morto' || p.colpiti.includes(e.id)) continue;
    const dx = e.x - p.x, dz = e.z - p.z, r = e.def.raggio + MARGINE, d2 = dx * dx + dz * dz;
    if (d2 <= r * r && d2 < fd) { fd = d2; first = e; }
  }
  if (!first) return false;
  if (p.magico) {
    if (p.raggio > 0) explode(s, p);
    else hitEnemy(s, first, { danno: p.danno, traits: p.traits, magico: true, skill: null, caricato: false, dirX: 0, dirZ: 0, daAlleato: false });
    return true;
  }
  const v = Math.sqrt(p.vx * p.vx + p.vz * p.vz) || 1;
  hitEnemy(s, first, { danno: p.danno, traits: p.traits, magico: false, skill: null, caricato: false, dirX: p.vx / v, dirZ: p.vz / v, daAlleato: false });
  add(s.xp, 'arceria', 1);
  if (p.traits.trapassa) { p.colpiti.push(first.id); return false; }
  return true;
}

export function stepProjectiles(s: DungeonState): void {
  if (!s.proj.length) return;
  const h = s.hero, rh = s.runHero, keep: Proj[] = [];
  for (const p of s.proj) {
    p.life--;
    p.vy -= p.g * DT;
    const sx = p.vx * DT, sy = p.vy * DT, sz = p.vz * DT;
    // sotto-passi da 0,4 m: niente tunnel attraverso nemici e muri sottili
    const n = Math.max(1, Math.ceil(Math.sqrt(sx * sx + sz * sz) / 0.4));
    let fine = false;
    for (let i = 0; i < n && !fine; i++) {
      p.x += sx / n; p.y += sy / n; p.z += sz / n;
      if (p.y <= 0) { p.y = 0; fine = true; break; }
      if (isOpaque(s.map, Math.floor(p.x / s.map.tile), Math.floor(p.z / s.map.tile))) {
        if (p.magico && !p.dalNemico && p.raggio > 0) explode(s, p);
        fine = true; break;
      }
      if (p.y > ALTEZZA_BERSAGLIO) continue;
      if (p.dalNemico) {
        const dx = h.x - p.x, dz = h.z - p.z, r = rh.raggio + MARGINE;
        if (dx * dx + dz * dz <= r * r) { hitHero(s, p.danno, p.magico ? 'magia' : 'taglio', h.x, h.z); fine = true; }
      } else fine = hitFoes(s, p);
    }
    if (s.done) return;
    if (!fine && p.life > 0) keep.push(p);
  }
  s.proj = keep;
}
