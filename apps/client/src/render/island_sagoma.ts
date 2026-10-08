// Sagoma di un'isola (TECH §5, «Come si sta nel budget»): la versione da lontano, disegnata al posto di quella vera quando l'isola è
// oltre LOD_M dalla camera. Lì la foschia (render/post.ts) copre già all'80 %: restano colore del terreno, rive, scogliere, palme e
// sagome degli edifici. Una sola geometria a colori della palette per isola (1 draw call, niente ombre): ~2-6 mila triangoli
// invece di 20-45 mila e una dozzina di draw call. Montagne, torri e decorazioni delle isole a tema non si rifanno: la sagoma usa
// le loro stesse geometrie (island.ts).
import * as THREE from 'three';
import type { GridMap, Tile } from '@marea/sim';
import type { TemaStyle } from '@marea/content';
import { ISLAND, P, M, merged, painted } from './island_parts.ts';

/** Oltre LOD_M (m, dalla camera al bordo dell'isola) si disegna la sagoma; oltre MINUTI_M si spegne la scenografia minuta
 *  (sassi, casse, lanterne: island.ts); ISTERESI evita il tremolio sul confine. */
export const LOD_M = 210, MINUTI_M = 150, LOD_ISTERESI = 15;

/** Colori della sagoma: [faccia su, fianco]. */
type Tinte = { sabbia: [string, string]; erba: [string, string] };
const TINTE: Record<TemaStyle | 'base' | 'neon', Tinte> = {
  base: { sabbia: [P.sabbia, P.legnoChiaro], erba: [P.erba, P.legno] },
  neon: { sabbia: [P.pietraScura, P.roccia], erba: [P.erba, P.legno] },
  tempesta: { sabbia: [P.roccia, P.neroCaldo], erba: [P.boscoOmbra, P.neroCaldo] },
  ghiacci: { sabbia: [P.pietraChiara, P.acquaBassa], erba: [P.sabbiaChiara, P.acquaBassa] },
  vulcano: { sabbia: [P.neroCaldo, P.neroCaldo], erba: [P.roccia, P.neroCaldo] },
  giardino: { sabbia: [P.pietraChiara, P.pietraScura], erba: [P.erba, P.legno] },
};
const N4: readonly [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const LAND = new Set<Tile>(['.', 'g', 'r', 'P', 'L', 'd']);

/** Palma da lontano: tronco e ciuffo (20 triangoli invece di ~90). */
function palma(): THREE.BufferGeometry {
  return merged([
    painted(new THREE.BoxGeometry(0.3, 3.4, 0.3), P.legno, M(0.1, 1.7, 0, 0, 0, -0.08)),
    painted(new THREE.OctahedronGeometry(1, 0), P.erbaScura, M(0.35, 3.4, 0, 0, 0.4, 0, 1.6, 0.45, 1.6)),
  ]);
}
function cespuglio(): THREE.BufferGeometry { return painted(new THREE.OctahedronGeometry(0.55, 0), P.erbaScura, M(0, 0.35, 0, 0, 0.5, 0, 1, 0.7, 1)); }

export type SagomaIn = {
  map: GridMap; area: { x0: number; z0: number; w: number; h: number }; style: string | null; tema: TemaStyle | null;
  /** Quota delle celle di roccia (chiave cz * map.w + cx), come island.ts. */
  rockTop: Map<number, number>;
  /** Celle lastricate (chiave cz * 4096 + cx, come island.ts). */
  paved: Set<number>;
  /** Palme e cespugli piazzati (matrici). */
  palme: THREE.Matrix4[]; cespugli: THREE.Matrix4[];
  /** Edifici e facciate: scatola del modello e dove sta. */
  blocchi: { box: THREE.Box3; mats: THREE.Matrix4[] }[];
};

export function sagomaGeometry(o: SagomaIn): THREE.BufferGeometry | null {
  const { map, area } = o, T = map.tile, TOP = ISLAND.TOP;
  const tinte = TINTE[o.tema ?? (o.style === 'neon' ? 'neon' : 'base')];
  const pos: number[] = [], col: number[] = [];
  const c = new THREE.Color();
  const quad = (a: number[], b: number[], cc: number[], d: number[], hex: string) => {
    c.set(hex);
    for (const v of [a, b, cc, a, cc, d]) { pos.push(v[0]!, v[1]!, v[2]!); col.push(c.r, c.g, c.b); }
  };
  /** Quota della cella (null = non si disegna qui: acqua, montagne a tema e torri del Neon hanno la loro geometria). */
  const quota = (cx: number, cz: number): number | null => {
    const t = map.at(cx, cz);
    if (!LAND.has(t)) return null;
    if (t === 'r') return o.tema || o.style === 'neon' ? null : (o.rockTop.get(cz * map.w + cx) ?? TOP + 1);
    return TOP;
  };
  const inArea = (cx: number, cz: number) => cx >= area.x0 && cz >= area.z0 && cx < area.x0 + area.w && cz < area.z0 + area.h;
  for (let cz = area.z0; cz < area.z0 + area.h; cz++) for (let cx = area.x0; cx < area.x0 + area.w; cx++) {
    const h = quota(cx, cz); if (h === null) continue;
    const t = map.at(cx, cz);
    const [top, side] = t === 'r' ? [P.pietra, P.pietraScura] : t === 'd' ? [P.legnoChiaro, P.legno]
      : o.paved.has(cz * 4096 + cx) ? [P.pietra, P.pietraScura] : t === 'g' || t === 'L' ? tinte.erba : tinte.sabbia;
    const x0 = cx * T, z0 = cz * T, x1 = x0 + T, z1 = z0 + T;
    quad([x0, h, z0], [x0, h, z1], [x1, h, z1], [x1, h, z0], top); // in su (antiorario visto dall'alto)
    // fianchi verso celle più basse (acqua = 0; le montagne a tema e le torri sono più alte: niente fianco)
    for (const [dx, dz] of N4) {
      const nx = cx + dx, nz = cz + dz, tn = map.at(nx, nz);
      const hn = LAND.has(tn) ? (inArea(nx, nz) ? quota(nx, nz) ?? 99 : TOP) : 0;
      if (hn >= h) continue;
      const lo = hn;
      if (dx === 1) quad([x1, h, z1], [x1, lo, z1], [x1, lo, z0], [x1, h, z0], side);
      else if (dx === -1) quad([x0, h, z0], [x0, lo, z0], [x0, lo, z1], [x0, h, z1], side);
      else if (dz === 1) quad([x0, h, z1], [x0, lo, z1], [x1, lo, z1], [x1, h, z1], side);
      else quad([x1, h, z0], [x1, lo, z0], [x0, lo, z0], [x0, h, z0], side);
    }
  }
  const parts: THREE.BufferGeometry[] = [];
  if (pos.length) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    parts.push(g);
  }
  const pg = palma(), cg = cespuglio();
  for (const m of o.palme) parts.push(pg.clone().applyMatrix4(m));
  for (const m of o.cespugli) parts.push(cg.clone().applyMatrix4(m));
  for (const b of o.blocchi) {
    // corpo chiaro e tetto scuro: da lontano un edificio è questo
    const s = b.box.getSize(new THREE.Vector3()), ctr = b.box.getCenter(new THREE.Vector3());
    const corpo = painted(new THREE.BoxGeometry(s.x * 0.9, s.y * 0.7, s.z * 0.9), P.pietraChiara, M(ctr.x, b.box.min.y + s.y * 0.35, ctr.z));
    const tetto = painted(new THREE.BoxGeometry(s.x, s.y * 0.3, s.z), P.legnoScuro, M(ctr.x, b.box.min.y + s.y * 0.85, ctr.z));
    const one = merged([corpo, tetto]);
    for (const m of b.mats) parts.push(one.clone().applyMatrix4(m));
    one.dispose();
  }
  pg.dispose(); cg.dispose();
  if (!parts.length) return null;
  for (const p of parts) if (p.index) { const n = p.toNonIndexed(); parts[parts.indexOf(p)] = n; }
  return merged(parts);
}
