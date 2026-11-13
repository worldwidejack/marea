// Dove giace un nemico caduto, com'è disegnato (prima persona): l'impronta a terra del suo corpo, presa dai vertici della posa finale. Serve a
// frugarlo dove si vede: il bottino sta nel punto in cui è caduto, ma il corpo si stende da lì per quanto era alto (un capo, quasi quattro
// metri), e la mira va sul corpo, non su quel punto. Il test del raggio dello sguardo contro l'impronta sta qui, accanto al calcolo.
import * as THREE from 'three';

/** Rettangolo orientato sul pavimento: centro (x, z), asse lungo unitario (ux, uz), mezze misure lungo l'asse e di lato, altezza dal pavimento. */
export type Corpo = { x: number; z: number; ux: number; uz: number; mezzo: number; largo: number; alto: number };

const V = new THREE.Vector3();
/** Misure minime (m): anche un corpo sottile si prende. */
const MIN_LARGO = 0.3, MIN_ALTO = 0.35;

/** L'impronta di tutto quello che sta sotto `root`, nella posa di adesso. `fy` = quota del pavimento. null se non ci sono vertici. */
export function improntaCorpo(root: THREE.Object3D, fy: number): Corpo | null {
  root.updateMatrixWorld(true);
  const px: number[] = [], pz: number[] = [];
  let alto = 0;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.geometry) return;
    const pos = m.geometry.getAttribute('position');
    if (!pos) return;
    for (let i = 0; i < pos.count; i++) {
      m.getVertexPosition(i, V); V.applyMatrix4(m.matrixWorld);
      px.push(V.x); pz.push(V.z); if (V.y - fy > alto) alto = V.y - fy;
    }
  });
  const n = px.length;
  if (!n) return null;
  let mx = 0, mz = 0;
  for (let i = 0; i < n; i++) { mx += px[i]!; mz += pz[i]!; }
  mx /= n; mz /= n;
  let cxx = 0, czz = 0, cxz = 0;
  for (let i = 0; i < n; i++) { const dx = px[i]! - mx, dz = pz[i]! - mz; cxx += dx * dx; czz += dz * dz; cxz += dx * dz; }
  const a = 0.5 * Math.atan2(2 * cxz, cxx - czz), ux = Math.cos(a), uz = Math.sin(a); // asse principale dei vertici sul pavimento
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (let i = 0; i < n; i++) {
    const dx = px[i]! - mx, dz = pz[i]! - mz, u = dx * ux + dz * uz, v = -dx * uz + dz * ux;
    if (u < u0) u0 = u; if (u > u1) u1 = u; if (v < v0) v0 = v; if (v > v1) v1 = v;
  }
  const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2;
  return { x: mx + ux * cu - uz * cv, z: mz + uz * cu + ux * cv, ux, uz, mezzo: (u1 - u0) / 2, largo: Math.max(MIN_LARGO, (v1 - v0) / 2), alto: Math.max(MIN_ALTO, alto) };
}

/** Il corpo come lo vede la mira quando non c'è la posa (ancora in caduta): un disco attorno al punto in cui è caduto, `r` m. */
export function corpoTondo(x: number, z: number, r: number, alto: number): Corpo {
  return { x, z, ux: 1, uz: 0, mezzo: r, largo: r, alto };
}

/** Il raggio dello sguardo (da `o`, direzione unitaria `d`, `fy` = pavimento) passa dentro il corpo, allargato di `margine` m? Si cammina il
 *  raggio dalla cima del corpo fino a terra: dove incontra l'impronta, c'è. */
export function raggioSuCorpo(c: Corpo, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, fy: number, margine: number): boolean {
  const cima = fy + c.alto + margine, giu = fy;
  if (dy >= -1e-4 || oy < giu) return false; // guarda in su o in piano: il raggio non scende mai al corpo
  const t0 = Math.max(0, (cima - oy) / dy), t1 = (giu - oy) / dy;
  if (t1 < t0) return false;
  const passi = 8;
  for (let k = 0; k <= passi; k++) {
    const t = t0 + ((t1 - t0) * k) / passi, x = ox + dx * t - c.x, z = oz + dz * t - c.z;
    if (Math.abs(x * c.ux + z * c.uz) <= c.mezzo + margine && Math.abs(-x * c.uz + z * c.ux) <= c.largo + margine) return true;
  }
  return false;
}

/** Il punto del corpo più vicino a (x, z), in piano: da lì si misura se la mano arriva. */
export function distanzaCorpo(c: Corpo, x: number, z: number): number {
  const dx = x - c.x, dz = z - c.z, u = dx * c.ux + dz * c.uz, v = -dx * c.uz + dz * c.ux;
  const eu = Math.max(0, Math.abs(u) - c.mezzo), ev = Math.max(0, Math.abs(v) - c.largo);
  return Math.sqrt(eu * eu + ev * ev);
}
