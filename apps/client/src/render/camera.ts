// Camera diorama (ART_BIBLE §7): prospettica FOV 30°, pitch 45° verso il basso, yaw 45°, distanza 28 m × zoom ∈ [0,6, 1,6].
// Inseguimento con molla a smorzamento critico (niente scatti all'avvio/arresto, niente jitter da fermo); rotella e pinch fluidi.
import * as THREE from 'three';
export type DioramaCamera = {
  camera: THREE.PerspectiveCamera;
  follow(x: number, y: number, z: number): void;
  zoom: number;
  /** Yaw della camera attorno a Y (0 = guarda verso −Z). La legge l'input per ruotare il joystick in assi mondo. */
  yaw: number;
  setZoom(z: number): void;
  update(dt: number): void;
  dispose(): void;
  /** Porta subito la camera sul bersaglio (teletrasporto, cambio scena). */
  snap?(): void;
};
export const CAM = { PITCH: Math.PI / 4, YAW: Math.PI / 4, FOV: 30, DIST: 28, ZMIN: 0.6, ZMAX: 1.6, SMOOTH: 0.22, ZOOM_SMOOTH: 0.12 } as const;
const clamp = (z: number) => Math.min(CAM.ZMAX, Math.max(CAM.ZMIN, z));

/** Molla critica (SmoothDamp): segue senza overshoot, continua in velocità. */
function damp(cur: number, target: number, vel: { v: number }, smooth: number, dt: number): number {
  const w = 2 / smooth, x = w * dt, e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const d = cur - target, tmp = (vel.v + w * d) * dt;
  vel.v = (vel.v - w * tmp) * e;
  let out = target + (d + tmp) * e;
  if ((target - cur > 0) === (out > target)) { out = target; vel.v = 0; }
  return out;
}

export function createDioramaCamera(o: { aspect: number; canvas: HTMLCanvasElement }): DioramaCamera {
  const camera = new THREE.PerspectiveCamera(CAM.FOV, o.aspect, 1, 300);
  const target = new THREE.Vector3(), cur = new THREE.Vector3();
  const vx = { v: 0 }, vy = { v: 0 }, vz = { v: 0 }, vzoom = { v: 0 };
  // Telefono in verticale: si parte un po' più larghi (sempre dentro [0,6, 1,6]) perché con FOV verticale 30° il campo orizzontale è stretto.
  const portrait = o.canvas.clientHeight > o.canvas.clientWidth * 1.2;
  let zoom = portrait ? 1.3 : 1, zoomTarget = zoom, first = true;
  // Offset unitario camera → bersaglio: da sud-est (yaw 45°) guardando a nord-ovest, 45° dall'alto.
  const off = new THREE.Vector3(Math.sin(CAM.YAW) * Math.cos(CAM.PITCH), Math.sin(CAM.PITCH), Math.cos(CAM.YAW) * Math.cos(CAM.PITCH));

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    // deltaY continuo (trackpad) o a scatti (rotella): zoom esponenziale, così ogni tacca pesa uguale a ogni livello.
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
    zoomTarget = clamp(zoomTarget * Math.exp(Math.max(-60, Math.min(60, dy)) * (e.ctrlKey ? 0.01 : 0.0022)));
  };
  let pinch = 0;
  const onTouchStart = (e: TouchEvent) => { if (e.touches.length !== 2) pinch = 0; };
  const onTouchMove = (e: TouchEvent) => {
    if (e.touches.length !== 2) { pinch = 0; return; }
    const t0 = e.touches[0]!, t1 = e.touches[1]!;
    const d = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
    if (pinch > 0 && d > 0) zoomTarget = clamp(zoomTarget * (pinch / d));
    pinch = d;
  };
  const onTouchEnd = () => { pinch = 0; };
  o.canvas.addEventListener('wheel', onWheel, { passive: false });
  o.canvas.addEventListener('touchstart', onTouchStart, { passive: true });
  o.canvas.addEventListener('touchmove', onTouchMove, { passive: true });
  o.canvas.addEventListener('touchend', onTouchEnd);
  o.canvas.addEventListener('touchcancel', onTouchEnd);

  const place = () => {
    const d = CAM.DIST * zoom;
    camera.position.set(cur.x + off.x * d, cur.y + off.y * d, cur.z + off.z * d);
    camera.lookAt(cur);
  };
  // Orientamento fisso: lo impostiamo una volta, poi si muove solo la posizione (niente micro-rotazioni da lookAt).
  const api: DioramaCamera = {
    camera, zoom, yaw: CAM.YAW, // zoom: valore iniziale, aggiornato a ogni update
    follow: (x, y, z) => {
      target.set(x, y, z);
      if (first || cur.distanceToSquared(target) > 30 * 30) { api.snap!(); first = false; }
    },
    snap: () => { cur.copy(target); vx.v = vy.v = vz.v = 0; place(); },
    setZoom: (z) => { zoomTarget = clamp(z); zoom = zoomTarget; vzoom.v = 0; api.zoom = zoom; place(); },
    update: (dt) => {
      if (!(dt > 0)) return;
      dt = Math.min(dt, 0.1);
      cur.x = damp(cur.x, target.x, vx, CAM.SMOOTH, dt);
      cur.y = damp(cur.y, target.y, vy, CAM.SMOOTH, dt);
      cur.z = damp(cur.z, target.z, vz, CAM.SMOOTH, dt);
      // Da fermo: quando il resto è sotto il millimetro si aggancia, così l'immagine a metà risoluzione non "respira".
      if (Math.abs(cur.x - target.x) < 1e-3 && Math.abs(vx.v) < 1e-3) { cur.x = target.x; vx.v = 0; }
      if (Math.abs(cur.z - target.z) < 1e-3 && Math.abs(vz.v) < 1e-3) { cur.z = target.z; vz.v = 0; }
      zoom = damp(zoom, zoomTarget, vzoom, CAM.ZOOM_SMOOTH, dt);
      if (Math.abs(zoom - zoomTarget) < 1e-4) { zoom = zoomTarget; vzoom.v = 0; }
      api.zoom = zoom;
      place();
    },
    dispose: () => {
      o.canvas.removeEventListener('wheel', onWheel);
      o.canvas.removeEventListener('touchstart', onTouchStart);
      o.canvas.removeEventListener('touchmove', onTouchMove);
      o.canvas.removeEventListener('touchend', onTouchEnd);
      o.canvas.removeEventListener('touchcancel', onTouchEnd);
    },
  };
  place();
  return api;
}
