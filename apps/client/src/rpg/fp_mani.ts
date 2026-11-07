// Prima persona: gli sprite davanti agli occhi (mani, armi, bacchette, torcia), tutti in un solo gruppo figlio della camera: una draw call, una
// texture, colore per vertice. Niente profondità: si disegnano sopra a tutto, nell'ordine in cui arrivano. La grandezza va a multipli interi di
// pixel del canvas, così i pixel degli sprite restano netti e grossi come quelli del mondo.
import * as THREE from 'three';
import type { Loader } from '../render/loader.ts';
import ATLANTE from './fp_atlante.json';

export type Colore = readonly [number, number, number];
export type Pezzo = {
  id: string;
  /** Dove sta il punto di presa dello sprite: frazioni dell'altezza dello schermo, dal centro in basso (+ destra, + su). */
  x: number; y: number;
  /** Radianti, in senso orario. */
  rot?: number;
  /** Specchiato (la mano sinistra è la destra allo specchio). */
  flip?: boolean;
  /** Stirato (linee e raggi fatti con un pezzo piccolo). */
  sx?: number; sy?: number;
  /** Tinta del pezzo (lame del materiale, colore della magia). */
  c?: Colore;
  /** Fa luce da solo: non prende la tinta della stanza. */
  luce?: boolean;
  a?: number;
};
type Riquadro = { x: number; y: number; w: number; h: number; ax: number; ay: number };
const R = (ATLANTE as { w: number; h: number; pezzi: Record<string, Riquadro> }).pezzi;
const AW = ATLANTE.w, AH = ATLANTE.h;
/** Quanti pixel dello sprite ci sono dal punto di presa alla cima e al fondo del pezzo (per le punte di armi e bacchette, e per le corde). */
export const sopraPresa = (id: string): number => R[id]?.ay ?? 0;
export const sottoPresa = (id: string): number => (R[id] ? R[id]!.h - R[id]!.ay : 0);
/** La mano vera e propria (pugno e avambraccio fino al bordo) prende circa metà altezza dello schermo. */
const QUOTA_MANO = 0.5, ALTO_PUGNO = 45;
const MAX = 40;

export function creaMani(o: { camera: THREE.PerspectiveCamera; canvas: HTMLCanvasElement; loader: Loader }): { disegna(l: readonly Pezzo[], tinta: Colore): void; readonly k: number; /** Un pixel dello sprite, in frazioni dell'altezza dello schermo. */ readonly u: number; dispose(): void } {
  const pos = new Float32Array(MAX * 12), uv = new Float32Array(MAX * 8), col = new Float32Array(MAX * 16), idx = new Uint16Array(MAX * 6);
  for (let i = 0; i < MAX; i++) idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
  const geo = new THREE.BufferGeometry();
  const aPos = new THREE.BufferAttribute(pos, 3), aUv = new THREE.BufferAttribute(uv, 2), aCol = new THREE.BufferAttribute(col, 4);
  for (const a of [aPos, aUv, aCol]) a.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', aPos); geo.setAttribute('uv', aUv); geo.setAttribute('color', aCol); geo.setIndex(new THREE.BufferAttribute(idx, 1));
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, alphaTest: 0.01, depthTest: false, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false });
  const mesh = new THREE.Mesh(geo, mat); mesh.name = 'fp_mani'; mesh.frustumCulled = false; mesh.renderOrder = 1000; mesh.visible = false;
  o.camera.add(mesh);
  let vivo = true, k = 1;
  void o.loader.texture('fp/mani.png').then((t) => { if (!vivo) return; mat.map = t; mat.needsUpdate = true; mesh.visible = true; }, (e: unknown) => console.warn('[marea] mani in prima persona non caricate', e));
  return {
    get k() { return k; },
    get u() { return k / o.canvas.height; },
    disegna(l, tinta) {
      const H = o.canvas.height, W = o.canvas.width;
      k = Math.max(1, Math.round((H * QUOTA_MANO) / ALTO_PUGNO));
      const m = (2 * Math.tan((o.camera.fov * Math.PI) / 360)) / H; // da pixel del canvas a metri, a 1 m dalla camera
      let n = 0;
      for (const p of l) {
        const r = R[p.id];
        if (!r || n >= MAX) continue;
        const sx = (p.sx ?? 1) * k, sy = (p.sy ?? 1) * k, rot = p.rot ?? 0, c = Math.cos(rot), s = Math.sin(rot), f = p.flip ? -1 : 1;
        // ancorato a pixel interi del canvas: fermo, ogni pixel dello sprite è un quadrato di k × k esatto
        const X = Math.round(W / 2 + p.x * H) - W / 2, Y = Math.round(p.y * H) - H / 2;
        const u0 = r.x / AW, u1 = (r.x + r.w) / AW, v0 = 1 - r.y / AH, v1 = 1 - (r.y + r.h) / AH;
        const tr = p.luce ? 1 : tinta[0], tg = p.luce ? 1 : tinta[1], tb = p.luce ? 1 : tinta[2], cr = (p.c?.[0] ?? 1) * tr, cg = (p.c?.[1] ?? 1) * tg, cb = (p.c?.[2] ?? 1) * tb, ca = p.a ?? 1;
        const ang = [[0, 0, u0, v0], [r.w, 0, u1, v0], [r.w, r.h, u1, v1], [0, r.h, u0, v1]] as const;
        for (let i = 0; i < 4; i++) {
          const [tx, ty, u, v] = ang[i]!;
          const dx = (tx - r.ax) * sx * f, dy = (r.ay - ty) * sy;
          const j = n * 4 + i;
          pos[j * 3] = (X + dx * c + dy * s) * m; pos[j * 3 + 1] = (Y - dx * s + dy * c) * m; pos[j * 3 + 2] = -1;
          uv[j * 2] = u; uv[j * 2 + 1] = v;
          col[j * 4] = cr; col[j * 4 + 1] = cg; col[j * 4 + 2] = cb; col[j * 4 + 3] = ca;
        }
        n++;
      }
      geo.setDrawRange(0, n * 6);
      aPos.needsUpdate = true; aUv.needsUpdate = true; aCol.needsUpdate = true;
    },
    dispose() { vivo = false; o.camera.remove(mesh); geo.dispose(); mat.dispose(); },
  };
}
