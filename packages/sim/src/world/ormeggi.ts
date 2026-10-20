// Posti barca del molo: come nei porticcioli liguri, le barche stanno di poppa al molo, una accanto all'altra, sui due lati lunghi e in
// punta; tra un posto e l'altro un pontile a dito con il suo palo. Si ricavano dalle celle del molo, così cambiare la pianta basta.
import { BALANCE } from '@marea/content';
import type { GridMap } from './grid.ts';
import { SCAFO } from './boat.ts';
import type { Posa } from './boat.ts';

/** Un posto barca: la posa della barca ormeggiata e dove sta la bitta (sul bordo del molo, dietro la poppa). */
export type PostoBarca = Posa & { bitta: { x: number; z: number } };
/** Pontile a dito tra due posti: parte dal bordo del molo (x, z) e va verso il largo per `lungo` m lungo la direzione `yaw`. */
export type Dito = { x: number; z: number; yaw: number; lungo: number };
export type PostiMolo = { posti: PostoBarca[]; dita: Dito[] };

const ORMEGGIO = BALANCE.barca.ormeggio;

/** Il molo (celle 'd' collegate) più vicino a (x, z) entro `cells` celle, come rettangolo di celle; null se non c'è. */
function moloVicino(map: GridMap, x: number, z: number, cells = 4): { cx0: number; cz0: number; cx1: number; cz1: number } | null {
  const c = map.worldToCell(x, z);
  let start: [number, number] | null = null, bestD = Infinity;
  for (let dz = -cells; dz <= cells; dz++)
    for (let dx = -cells; dx <= cells; dx++)
      if (map.at(c.cx + dx, c.cz + dz) === 'd' && dx * dx + dz * dz < bestD) { bestD = dx * dx + dz * dz; start = [c.cx + dx, c.cz + dz]; }
  if (!start) return null;
  const seen = new Set<string>([start.join(',')]), todo = [start];
  let cx0 = start[0], cz0 = start[1], cx1 = start[0], cz1 = start[1];
  while (todo.length) {
    const [qx, qz] = todo.pop()!;
    cx0 = Math.min(cx0, qx); cx1 = Math.max(cx1, qx); cz0 = Math.min(cz0, qz); cz1 = Math.max(cz1, qz);
    for (const [ax, az] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const k = `${qx + ax},${qz + az}`;
      if (!seen.has(k) && map.at(qx + ax, qz + az) === 'd') { seen.add(k); todo.push([qx + ax, qz + az]); }
    }
  }
  return { cx0, cz0, cx1, cz1 };
}

/** Tutto lo scafo (poppa compresa) sta in acqua navigabile. */
function scafoLibero(p: Posa, map: GridMap): boolean {
  const s = sinCos(p.yaw);
  for (const l of [-SCAFO.mezzaL, -1.1, 0, 1.1, SCAFO.mezzaL]) for (const w of [-SCAFO.mezzaW, 0, SCAFO.mezzaW]) if (!map.navigable(p.x + s.s * l + s.c * w, p.z - s.c * l + s.s * w)) return false;
  return true;
}
/** Le quattro prue possibili (est, sud, ovest, nord) senza trigonometria: il molo è allineato alla griglia. */
function sinCos(yaw: number): { s: number; c: number } {
  const q = Math.round(yaw / (Math.PI / 2)) & 3;
  return [{ s: 0, c: 1 }, { s: 1, c: 0 }, { s: 0, c: -1 }, { s: -1, c: 0 }][q]!;
}

/**
 * I posti barca del molo più vicino a (x, z), ordinati dal più vicino a (x, z): il primo è di chi ha la barca lì (la B della pianta).
 * Lati lunghi e punta (il lato corto lontano da terra); il lato che tocca terra no. Un posto vale solo se lo scafo intero sta in acqua.
 */
export function postiDelMolo(map: GridMap, x: number, z: number): PostiMolo {
  const r = moloVicino(map, x, z);
  if (!r) return { posti: [], dita: [] };
  const T = map.tile, x0 = r.cx0 * T, x1 = (r.cx1 + 1) * T, z0 = r.cz0 * T, z1 = (r.cz1 + 1) * T;
  const terra = (cx: number, cz: number) => map.walkable((cx + 0.5) * T, (cz + 0.5) * T) && map.at(cx, cz) !== 'd';
  const lungoZ = z1 - z0 >= x1 - x0;
  // i lati: [inizio, fine, normale verso fuori (prua), lato corto?]
  const lati: { ax: number; az: number; bx: number; bz: number; yaw: number; corto: boolean }[] = [
    { ax: x1, az: z0, bx: x1, bz: z1, yaw: Math.PI / 2, corto: !lungoZ },   // est
    { ax: x0, az: z0, bx: x0, bz: z1, yaw: -Math.PI / 2, corto: !lungoZ },  // ovest
    { ax: x0, az: z1, bx: x1, bz: z1, yaw: Math.PI, corto: lungoZ },        // sud
    { ax: x0, az: z0, bx: x1, bz: z0, yaw: 0, corto: lungoZ },              // nord
  ];
  const posti: PostoBarca[] = [], dita: Dito[] = [];
  for (const l of lati) {
    const n = sinCos(l.yaw), len = Math.abs(l.bx - l.ax) + Math.abs(l.bz - l.az), tx = (l.bx - l.ax) / len, tz = (l.bz - l.az) / len;
    if (l.corto) { // la punta: solo se fuori c'è acqua e il lato opposto tocca terra
      let tocca = false;
      for (let k = 0.5; k < len; k += T) { const px = l.ax + tx * k + n.s * T * 0.5, pz = l.az + tz * k - n.c * T * 0.5; if (terra(Math.floor(px / T), Math.floor(pz / T))) tocca = true; }
      if (tocca) continue;
    }
    const quanti = Math.floor(len / ORMEGGIO.passo), off = (len - quanti * ORMEGGIO.passo) / 2;
    const d = SCAFO.mezzaL + ORMEGGIO.stacco;
    const tenuti = new Set<number>();
    for (let i = 0; i < quanti; i++) {
      const k = off + (i + 0.5) * ORMEGGIO.passo, ex = l.ax + tx * k, ez = l.az + tz * k;
      const p: PostoBarca = { x: ex + n.s * d, z: ez - n.c * d, yaw: l.yaw, bitta: { x: ex - n.s * 0.35, z: ez + n.c * 0.35 } };
      if (scafoLibero(p, map)) { posti.push(p); tenuti.add(i); }
    }
    if (l.corto) continue;
    // un dito tra due posti e ai capi della fila, accanto a ogni posto tenuto
    for (let i = 0; i <= quanti; i++) {
      const k = off + i * ORMEGGIO.passo;
      if (k > 0.3 && k < len - 0.3 && (tenuti.has(i - 1) || tenuti.has(i))) dita.push({ x: l.ax + tx * k, z: l.az + tz * k, yaw: l.yaw, lungo: ORMEGGIO.dito });
    }
  }
  posti.sort((a, b) => (a.x - x) * (a.x - x) + (a.z - z) * (a.z - z) - ((b.x - x) * (b.x - x) + (b.z - z) * (b.z - z)) || a.z - b.z || a.x - b.x);
  return { posti, dita };
}
