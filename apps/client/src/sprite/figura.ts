// Una figura a sprite: sceglie la vista (dall'angolo fra dove guarda e la camera, col lato sinistro specchiato) e il disegno della mossa.
// I disegni della camminata avanzano coi metri percorsi, non col tempo.
import type * as THREE from 'three';
import type { Atlante, Voce } from './atlante.ts';
import type { SpriteHd } from './strato.ts';

/** Metri per pixel dei disegni: 56 pixel in piedi = 1,85 m, un filo più alto dell'avatar 3D (la testa è più grande). */
const METRI = 1.85 / 56;
/** Quanto il passo sul terreno è più lungo di quello disegnato: a 1 le gambe girano troppo in fretta. */
const LENTO = 2.5;
const PASSO_PX = 14;
/** Gradi in più che servono per cambiare vista: sul confine fra due non sfarfalla. */
const STACCO = 3;

/** La mossa da disegnare: `n` = il numero del disegno (0 = lo sceglie il passo), o una funzione di quanti ce ne sono e di quanto durano. */
export type Mossa = { atlante: Atlante; nome: string; n: number | ((quanti: number, ms: (n: number) => number) => number) };
export type Posto = { x: number; y: number; z: number; yaw: number; muove: boolean; /** rad in più sulla prua (emote, colpo a giro) */ giro?: number; /** rad di capriola sullo schermo */ capriola?: number };
export type Figura = {
  readonly sprite: SpriteHd;
  /** Posa la figura; ritorna la voce del disegno scelto (per la punta della canna) o null se la mossa non c'è. */
  mostra(m: Mossa, p: Posto): Voce | null;
  readonly chiave: string;
};

export function creaFigura(sprite: SpriteHd, cam: THREE.Camera): Figura {
  let dist = 0, px = NaN, pz = NaN, vistaOra = '', chiave = '', lato = false;
  return {
    sprite,
    get chiave() { return chiave; },
    mostra(m, p) {
      const a = m.atlante, fatti = Math.hypot(p.x - px, p.z - pz);
      px = p.x; pz = p.z;
      if (!p.muove) dist = 0; else if (fatti < 2) dist += fatti;
      // 0 = guarda la camera, + = verso la destra dello schermo
      let cx = cam.position.x - p.x, cz = cam.position.z - p.z;
      const l = Math.hypot(cx, cz) || 1; cx /= l; cz /= l;
      const yaw = p.yaw + (p.giro ?? 0), vx = Math.sin(yaw), vz = -Math.cos(yaw);
      const ang = (Math.atan2(vx * cz - vz * cx, vx * cx + vz * cz) * 180) / Math.PI;
      let v = '', best = Infinity;
      for (const x of a.viste(m.nome)) { const d = Math.abs(x.gradi - Math.abs(ang)) - (x.v === vistaOra ? STACCO : 0); if (d < best) { best = d; v = x.v; } }
      if (!v) return null;
      vistaOra = v;
      if (Math.abs(ang) > 2 && Math.abs(ang) < 178) lato = ang < 0;
      const quanti = a.quanti(v, m.nome), ms = (n: number) => a.d[`${v}_${m.nome}_${n}`]?.[6] ?? 100;
      let n = typeof m.n === 'function' ? m.n(quanti, ms) : m.n;
      if (n === 0) n = p.muove ? 1 + (Math.floor(dist / ((PASSO_PX * METRI * LENTO) / (quanti / 2))) % quanti) : 1;
      chiave = `${v}_${m.nome}_${Math.max(1, Math.min(quanti, n))}`;
      const voce = a.d[chiave]!;
      sprite.posa(a, voce, { x: p.x, y: p.y, z: p.z, m: METRI, specchio: lato && v !== 'S' && v !== 'N', gira: p.capriola ?? 0 });
      return voce;
    },
  };
}

/** La capriola: un giro intero sullo schermo, dalla parte in cui si va. `t` 0..1. */
export function capriola(t: number, yaw: number, cam: THREE.Camera): number {
  const e = cam.matrixWorld.elements, versoDestra = Math.sin(yaw) * e[0]! - Math.cos(yaw) * e[2]!;
  return (versoDestra < -0.05 ? 1 : -1) * 2 * Math.PI * t;
}
