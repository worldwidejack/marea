// Proiettili 2,5D: frecce con gravità (a terra o su un muro si fermano), magie dritte con esplosione, tiri dei nemici sull'eroe.
// Archivio: l'arpione del Drone Idro-Ragno, se prende, tira l'eroe verso chi l'ha lanciato (vento.ts, spinta da fuori).
import { DT } from '../constants.ts';
import type { DungeonState, Enemy, Proj } from './state.ts';
import { add, ev, finita, inGioco } from './state.ts';
import { hitEnemy, hitHero } from './combat.ts';
import { isOpaque } from './map.ts';
import { ALTEZZA_BERSAGLIO, HZ } from './tuning.ts';
import { spingi } from './vento.ts';

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

/** Tiro nemico a segno sull'eroe di turno; l'arpione lo tira all'indietro lungo il volo. */
function colpisciEroe(s: DungeonState, p: Proj, x: number, z: number): void {
  const arriva = !s.done && s.hero.protetto <= 0;
  hitHero(s, p.danno, p.magico ? 'magia' : p.contundente ? 'contundente' : 'taglio', x, z);
  if (!p.tira || !arriva || s.done) return;
  const v = Math.sqrt(p.vx * p.vx + p.vz * p.vz) || 1;
  spingi(s, -p.vx / v, -p.vz / v, p.tira, (p.tiraT ?? 15) / HZ);
  ev(s, { t: 'arpionato' });
}

/** Insieme: un tiro nemico prende il primo eroe in gioco che tocca; quelli degli eroi lavorano sull'eroe che li ha tirati (xp, uccisioni). */
export function stepProjectiles(s: DungeonState): void {
  if (!s.proj.length) return;
  const prima = s.cur;
  try { muovi(s); } finally { s.cur = prima; }
}
function muovi(s: DungeonState): void {
  const multi = s.eroi.length > 1, keep: Proj[] = [];
  const h = s.hero, rh = s.runHero;
  for (const p of s.proj) {
    if (multi && !p.dalNemico) s.cur = p.da ?? 0;
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
      if (p.dalNemico && multi) {
        for (const k of inGioco(s)) {
          const r = s.eroi[k]!, dx = r.hero.x - p.x, dz = r.hero.z - p.z, rr = r.runHero.raggio + MARGINE;
          if (dx * dx + dz * dz > rr * rr) continue;
          s.cur = k; colpisciEroe(s, p, r.hero.x, r.hero.z); fine = true;
          break;
        }
      } else if (p.dalNemico) {
        const dx = h.x - p.x, dz = h.z - p.z, r = rh.raggio + MARGINE;
        if (dx * dx + dz * dz <= r * r) { colpisciEroe(s, p, h.x, h.z); fine = true; }
      } else fine = hitFoes(s, p);
    }
    if (finita(s)) return;
    if (!fine && p.life > 0) keep.push(p);
  }
  s.proj = keep;
}
