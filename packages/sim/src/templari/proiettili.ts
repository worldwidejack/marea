// Proiettili dell'eroe (docs/TEMPLARI.md §6): frecce e palle volano dritte (a sotto-passi da 0,4 m: niente tunnel) finché non toccano un
// muro opaco, escono dalla gittata o colpiscono; passano dalle finestre (si spara agli zombie che strappano le assi) e sopra le cose basse.
// Trapassano `trapassa` nemici; uno scudato davanti le ferma. Il vaso del fuoco greco esplode dove arriva (o contro il primo che tocca).
import { armaDef } from '@marea/content/templari.ts';
import type { TArmaDef } from '@marea/content/templari.ts';
import { DT } from '../constants.ts';
import { isOpaque } from '../dungeon/map.ts';
import type { Proj, TState, Zombie } from './stato.ts';
import { colpisci, esplodi } from './colpi.ts';

const MARGINE = 0.15;

/** Ruota il versore (fx, fz) di `a` radianti (seno e coseno col polinomio: solo + − × ÷, uguale su ogni motore; |a| < 0,6). */
export function ruota(fx: number, fz: number, a: number): [number, number] {
  const a2 = a * a, s = a * (1 - a2 / 6 * (1 - a2 / 20 * (1 - a2 / 42))), c = 1 - a2 / 2 * (1 - a2 / 12 * (1 - a2 / 30));
  return [fx * c - fz * s, fx * s + fz * c];
}

/** Proiettile nuovo dall'eroe verso (fx, fz); `fino` = metri di volo (gittata, o per il vaso la distanza del bersaglio). */
export function tira(s: TState, a: TArmaDef, fx: number, fz: number, danno: number, fino: number): void {
  const h = s.eroe, v = a.velocita ?? 30;
  const tipo: Proj['tipo'] = a.tipo === 'arco' ? 'freccia' : a.tipo === 'lancio' ? 'vaso' : 'palla';
  s.proj.push({
    id: s.nextId++, tipo, arma: a.id, x: h.x + fx * 0.45, z: h.z + fz * 0.45, vx: fx * v, vz: fz * v, danno,
    vita: Math.max(1, Math.round((fino / v) * 60)), trapassa: a.trapassa ?? 0, colpiti: [],
  });
}

function scoppia(s: TState, p: Proj): void {
  const a = armaDef(p.arma);
  esplodi(s, p.x, p.z, a.area ?? 2, p.danno, a.fuoco);
}

export function stepProiettili(s: TState): void {
  if (!s.proj.length) return;
  const keep: Proj[] = [], g = s.gr.percorso;
  for (const p of s.proj) {
    p.vita--;
    const sx = p.vx * DT, sz = p.vz * DT, n = Math.max(1, Math.ceil(Math.sqrt(sx * sx + sz * sz) / 0.4));
    let fine = false;
    for (let i = 0; i < n && !fine; i++) {
      p.x += sx / n; p.z += sz / n;
      if (isOpaque(g, Math.floor(p.x / g.tile), Math.floor(p.z / g.tile))) { if (p.tipo === 'vaso') { p.x -= sx / n; p.z -= sz / n; scoppia(s, p); } fine = true; break; }
      let primo: Zombie | null = null, pd = Infinity;
      for (const z of s.zombie) {
        if (z.st === 'morto' || z.st === 'sorge' || p.colpiti.includes(z.id)) continue;
        const dx = z.x - p.x, dz = z.z - p.z, r = z.def.raggio + MARGINE, d2 = dx * dx + dz * dz;
        if (d2 <= r * r && d2 < pd) { pd = d2; primo = z; }
      }
      if (!primo) continue;
      if (p.tipo === 'vaso') { scoppia(s, p); fine = true; break; }
      const vv = Math.sqrt(p.vx * p.vx + p.vz * p.vz) || 1;
      const e = colpisci(s, primo, { danno: p.danno, mischia: false, caricato: false, dirX: p.vx / vv, dirZ: p.vz / vv, spinta: p.tipo === 'palla' ? 0.25 : 0.1 });
      p.colpiti.push(primo.id);
      if (e === 'parato' || p.trapassa-- <= 0) { fine = true; break; }
    }
    if (s.done) return;
    if (!fine && p.vita <= 0) { if (p.tipo === 'vaso') scoppia(s, p); fine = true; }
    if (!fine) keep.push(p);
  }
  s.proj = keep;
}
