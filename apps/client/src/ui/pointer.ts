// Freccia sullo schermo verso una cosa del mondo: sopra la cosa se è in vista, sul bordo (nella direzione della cosa vista dal centro della
// fascia libera) se è fuori o dietro la camera. La usano la guida «Primi passi» (gialla) e la bussola con una sola meta scelta.
import * as THREE from 'three';

/** `x, y` in px dentro la tela (ox, oy = angolo della tela nel root). In vista: il punto della cosa; fuori: il punto sul bordo e `ang`
 *  (radianti, 0 = su, orario) verso la cosa. `top`/`bottom` = fascia libera in px dal bordo alto della tela, `m` = margine laterale. */
export type PointerPose = { inView: boolean; x: number; y: number; ang: number; ox: number; oy: number };

const v = new THREE.Vector3();
export function pointerPose(o: { camera: THREE.Camera; canvas: HTMLCanvasElement; root: HTMLElement; target: { x: number; y: number; z: number }; top: number; bottom: number; m: number }): PointerPose {
  v.set(o.target.x, o.target.y, o.target.z).project(o.camera);
  const r = o.canvas.getBoundingClientRect(), rr = o.root.getBoundingClientRect();
  const W = r.width, ox = r.left - rr.left, oy = r.top - rr.top, M = o.m, TOP = o.top, BOT = o.bottom;
  const behind = v.z > 1;
  const px = ((v.x + 1) / 2) * W, py = ((1 - v.y) / 2) * r.height;
  if (!behind && px > M && px < W - M && py > TOP && py < BOT) return { inView: true, x: px, y: py, ang: Math.PI, ox, oy };
  const cx = W / 2, cy = (TOP + BOT) / 2;
  let dx = px - cx, dy = py - cy;
  if (behind) { dx = -dx; dy = -dy; }
  const k = Math.min((W / 2 - M) / Math.max(1e-6, Math.abs(dx)), (dy < 0 ? cy - TOP : BOT - cy) / Math.max(1e-6, Math.abs(dy)));
  return { inView: false, x: cx + dx * k, y: cy + dy * k, ang: Math.atan2(dx, -dy), ox, oy };
}
